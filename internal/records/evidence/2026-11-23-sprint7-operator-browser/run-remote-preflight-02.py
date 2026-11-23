#!/usr/bin/env python3
"""Execute the retained #750 operator preview without changing its source or claims."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import signal
import socket
import subprocess
import sys
import time
import traceback
import urllib.request

R = Path('/tank/shared/projects/proto-ui-agent/seven-sprints-20261123-chvf1ono')
TRANSFER = R / 'evidence/i750-transfer'
OUT = R / 'evidence/i750-remote-preflight-02'
PAYLOAD = OUT / 'payload'
SOURCE = R / 'invisible-consumption'
OBSERVER_SOURCE = R / 'i750-observer-followthrough-20261123-0240'
CANDIDATE = R / 'evidence/i750-observer-candidate-02/observer-candidate.json'
NODE = R / 'tools/node-v24.22.3-linux-x64/bin/node'
CHROME = R / 'tools/playwright-browsers/chromium-1208/chrome-linux64/chrome'
ENV = dict(os.environ, PATH=str(NODE.parent) + os.pathsep + os.environ['PATH'],
           COREPACK_HOME=str(R / 'corepack-cache'),
           TMPDIR='/tank/shared/projects/proto-ui-agent/ss-hts7gnjs', CHROME_PATH=str(CHROME))
PHASE = sys.argv[1]
assert PHASE in ['prepare', 'observe']
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
digest = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()

def write_new(name, data):
    with (OUT / name).open('x') as stream:
        json.dump(data, stream, indent=2)
        stream.write('\n')

def status(data):
    data = dict(data, updatedAt=now(), driverSha256=digest(__file__))
    temporary = OUT / ('status.' + str(os.getpid()) + '.tmp')
    temporary.write_text(json.dumps(data, indent=2) + '\n')
    temporary.replace(OUT / 'status.json')

def stop_owned(process):
    if process.poll() is None:
        assert os.getpgid(process.pid) == process.pid
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=5)
    return process.returncode

def run(name, argv, cwd, timeout=60):
    status({'phase': PHASE, 'stage': name})
    started, clock = now(), time.monotonic()
    failure, process = None, None
    with (OUT / (name + '.stdout.log')).open('xb') as stdout, (OUT / (name + '.stderr.log')).open('xb') as stderr:
        try:
            process = subprocess.Popen([str(a) for a in argv], cwd=cwd, env=ENV,
                                       stdin=subprocess.DEVNULL, stdout=stdout, stderr=stderr,
                                       start_new_session=True)
            process.wait(timeout=timeout)
        except Exception as error:
            failure = repr(error)
            if process is not None:
                stop_owned(process)
    code = None if process is None else process.returncode
    receipt = {'argv': [str(a) for a in argv], 'cwd': str(cwd), 'startedAt': started,
               'finishedAt': now(), 'elapsedSeconds': time.monotonic() - clock,
               'exitCode': code if code is not None and code >= 0 else None,
               'signal': -code if code is not None and code < 0 else None,
               'error': failure, 'timeoutSeconds': timeout,
               'stdout': {'path': name + '.stdout.log', 'sha256': digest(OUT / (name + '.stdout.log'))},
               'stderr': {'path': name + '.stderr.log', 'sha256': digest(OUT / (name + '.stderr.log'))}}
    write_new(name + '.result.json', receipt)
    assert code == 0 and failure is None, name + ' failed: ' + str(receipt)
    return receipt

def verify(name, allow_browser=False):
    argv = ['python3', TRANSFER / 'verify-transfer.py', 'verify', '--manifest',
            TRANSFER / 'transfer-manifest.json', '--destination', PAYLOAD, '--source', SOURCE]
    if allow_browser:
        argv.append('--allow-browser')
    run(name, argv, SOURCE)

def verify_observer(name):
    assert digest(CANDIDATE) == '9595fd50d3976550bd617c6a9ada36a0bd27fd3fdd9c113079534ad7936d18ec'
    manifest = json.loads(CANDIDATE.read_text())
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=OBSERVER_SOURCE, text=True).strip()
    assert head == manifest['base']
    changed = subprocess.check_output(['git', 'diff', '--name-only', 'HEAD'], cwd=OBSERVER_SOURCE, text=True).splitlines()
    untracked = subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard'], cwd=OBSERVER_SOURCE, text=True).splitlines()
    assert set(changed + untracked) == {row['path'] for row in manifest['files']}
    for row in manifest['files']:
        assert digest(OBSERVER_SOURCE / row['path']) == row['sha256']
    write_new(name, {'source': str(OBSERVER_SOURCE), 'gitBase': head, 'dirtyCandidate': True,
                    'candidateManifestSha256': digest(CANDIDATE), 'files': manifest['files'],
                    'compilerAndProductRevision': manifest['base'], 'compilerAndProductChanged': False,
                    'checkedAt': now()})

try:
    if PHASE == 'prepare':
        assert not OUT.exists(), 'Preserve every earlier attempt; use a new directory'
        OUT.mkdir(parents=True)
        verify_observer('observer-source-before-prepare.json')
        run('restore', ['python3', TRANSFER / 'verify-transfer.py', 'restore', '--manifest',
                       TRANSFER / 'transfer-manifest.json', '--archive', TRANSFER / 'i750-operator-preflight-01.tar.gz',
                       '--destination', PAYLOAD, '--source', SOURCE], R)
        versions = {}
        for name, argv in [('node', [NODE, '--version']), ('npm', ['npm', '--version']),
                           ('registry', ['npm', 'config', 'get', 'registry']), ('os', ['uname', '-a']),
                           ('chrome', [CHROME, '--version'])]:
            run('version-' + name, argv, SOURCE)
            versions[name] = (OUT / ('version-' + name + '.stdout.log')).read_text().strip()
        assert versions['node'] == 'v24.22.3'
        versions.update(chromeSha256=digest(CHROME), sourceRevision='84105d9226ea40964c5b4fd0225975f75ed28b07',
                        evidenceClass='operator-preflight-only', observedConsumerRuns=0,
                        sourceEnvironment=ENV['PATH'], temporaryDirectory=ENV['TMPDIR'])
        write_new('environment.json', versions)
        run('npm-ci', ['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund', '--cache',
                       R / 'i750-npm-cache-remote-01'], PAYLOAD / 'clean-consumer', timeout=300)
        verify('after-install')
        resolution = "import{createRequire}from'node:module';import{realpathSync}from'node:fs';import path from'node:path';const r=createRequire(path.join(process.cwd(),'package.json'));const root=realpathSync(path.join(process.cwd(),'node_modules'));for(const n of ['react','react-dom','vite','typescript']){const p=realpathSync(r.resolve(n+'/package.json'));if(!p.startsWith(root+path.sep))throw new Error('Source-linked dependency '+n);console.log(JSON.stringify({name:n,path:p,version:r(n+'/package.json').version}));}"
        run('independent-dependencies', [NODE, '--input-type=module', '-e', resolution], PAYLOAD / 'clean-consumer')
        write_new('prepare.completed.json', {'finishedAt': now(), 'status': 'prepared', 'observedConsumerRuns': 0})
        status({'phase': 'prepared', 'observedConsumerRuns': 0})
    else:
        assert json.loads((OUT / 'status.json').read_text())['phase'] == 'prepared'
        assert (OUT / 'prepare.completed.json').is_file()
        assert not (OUT / 'preview-process.json').exists()
        verify('before-observation')
        verify_observer('observer-source-before-run.json')
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 4750))
        command = ['npm', 'run', 'preview', '--', '--port', '4750', '--strictPort']
        with (OUT / 'preview.stdout.log').open('xb') as stdout, (OUT / 'preview.stderr.log').open('xb') as stderr:
            preview = subprocess.Popen(command, cwd=PAYLOAD / 'clean-consumer', env=ENV,
                                       stdin=subprocess.DEVNULL, stdout=stdout, stderr=stderr, start_new_session=True)
            write_new('preview-process.json', {'pid': preview.pid, 'pgid': os.getpgid(preview.pid),
                      'startTicks': Path('/proc/' + str(preview.pid) + '/stat').read_text().split(') ', 1)[1].split()[19],
                      'startedAt': now(), 'argv': command, 'cwd': str(PAYLOAD / 'clean-consumer')})
            try:
                deadline = time.monotonic() + 30
                while True:
                    assert preview.poll() is None, 'Owned preview exited before readiness'
                    try:
                        with urllib.request.urlopen('http://127.0.0.1:4750/', timeout=1) as response:
                            body = response.read()
                            assert response.status == 200
                            assert hashlib.sha256(body).hexdigest() == digest(PAYLOAD / 'clean-consumer/dist/index.html')
                        assert preview.poll() is None
                        assert 'http://127.0.0.1:4750/' in (OUT / 'preview.stdout.log').read_text()
                        break
                    except (OSError, urllib.error.URLError):
                        if time.monotonic() >= deadline:
                            raise
                        time.sleep(0.1)
                run('observer', [NODE, '--import', 'tsx', 'scripts/analysis/invisible-consumption/observe-button.mjs',
                                 PAYLOAD, 'http://127.0.0.1:4750/'], OBSERVER_SOURCE, timeout=600)
                verify('after-observation', allow_browser=True)
                verify_observer('observer-source-after-run.json')
                result = json.loads((PAYLOAD / 'operator/browser/result.json').read_text())
                names = json.loads((TRANSFER / 'remote-execution-plan.json').read_text())['expectedCheckpointNames']
                assert result['status'] == 'passed-operator-preflight'
                assert [row['name'] for row in result['checkpoints']] == names and result['errors'] == []
                inventory = [{'path': str(p.relative_to(OUT)), 'bytes': p.stat().st_size, 'sha256': digest(p)}
                             for p in sorted((PAYLOAD / 'operator/browser').iterdir()) if p.is_file()]
                write_new('browser-inventory.json', {'files': inventory, 'observedConsumerRuns': 0,
                                                    'artifactAdmission': 'not performed', 'visualReview': 'pending'})
            finally:
                code = stop_owned(preview)
                write_new('preview-stopped.json', {'finishedAt': now(), 'exitCode': code,
                                                  'ownedPid': preview.pid, 'processExited': preview.poll() is not None})
        status({'phase': 'completed-operator-preflight', 'observedConsumerRuns': 0, 'artifactAdmission': 'not performed',
                'visualReview': 'pending'})
except Exception:
    error = traceback.format_exc()
    if OUT.exists():
        write_new(PHASE + '.failure.json', {'phase': PHASE, 'failedAt': now(), 'error': error})
        status({'phase': 'failed-' + PHASE, 'error': error, 'observedConsumerRuns': 0})
    print(error, file=sys.stderr)
    raise
