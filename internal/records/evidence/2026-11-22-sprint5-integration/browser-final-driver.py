from pathlib import Path
import datetime, gzip, hashlib, json, os, signal, subprocess, sys, time

root = Path('/workspace/scratch/3c698ea06f1e/Proto-UI')
out = Path('/workspace/scratch/3c698ea06f1e/final-browser-gates')
out.mkdir(exist_ok=True)
files = [
    'packages/compiler/test/browser-target-consumer.test.ts',
    'packages/compiler/test/vue-source.test.ts',
    'packages/compiler/test/native-support-plan.test.ts',
    'packages/compiler/test/browser-wasm.test.ts',
    'packages/compiler/test/browser-revision-session.test.ts',
    'packages/compiler/test/browser-client.test.ts',
]

def git(*args):
    return subprocess.check_output(['git', *args], cwd=root).decode().strip()

def source_snapshot():
    paths = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0')
    result = {}
    for name in sorted(p for p in paths if p and not p.startswith('internal/records/')):
        path = root/name
        if path.is_file():
            result[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result

def digest(data):
    return hashlib.sha256(data).hexdigest()

start = datetime.datetime.now(datetime.timezone.utc).isoformat()
before = source_snapshot()
source_bytes = (json.dumps(before, sort_keys=True, indent=2)+'\n').encode()
(out/'source-files.json.gz').write_bytes(gzip.compress(source_bytes, mtime=0))
report = {
    'kind': 'actual-pending-source-browser-integration',
    'startedAtUtc': start,
    'head': git('rev-parse','HEAD'),
    'indexTreeBefore': git('write-tree'),
    'node': subprocess.check_output(['node','--version']).decode().strip(),
    'execution': 'One shared heavy gate; each unchanged test file runs in its own bounded single-worker process.',
    'nodeOptions': '--max-old-space-size=1536',
    'sourceFileCount': len(before),
    'sourceManifestUncompressedSha256': digest(source_bytes),
    'sourceManifest': 'source-files.json.gz',
    'runs': [],
    'realBrowserAcceptance': False,
}
for name in files:
    log_path = out/(Path(name).stem+'.log')
    command = ['node', 'node_modules/vitest/vitest.mjs', 'run', name, '--minWorkers=1', '--maxWorkers=1']
    print('START '+name, flush=True)
    began = time.monotonic()
    timeout = False
    with log_path.open('wb') as log:
        log.write((json.dumps({'command':command,'cwd':str(root),'NODE_OPTIONS':report['nodeOptions']})+'\n').encode())
        log.flush()
        process = subprocess.Popen(command, cwd=root, env={**os.environ,'NODE_OPTIONS':report['nodeOptions']}, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            code = process.wait(timeout=240)
        except subprocess.TimeoutExpired:
            timeout = True
            os.killpg(process.pid, signal.SIGTERM)
            try:
                code = process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                code = process.wait()
    retired_group = False
    if code != 0:
        # Each run owns a fresh process session. Retire only surviving workers
        # from this failed run, so a killed launcher cannot leak into the next.
        try:
            os.killpg(process.pid, signal.SIGTERM)
            retired_group = True
            time.sleep(0.2)
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        except ProcessLookupError:
            pass
    data = log_path.read_bytes()
    row = {'file':name,'command':command,'exitCode':code,'timeout':timeout,'ownedFailedProcessGroupRetired':retired_group,'seconds':round(time.monotonic()-began,2),'log':log_path.name,'logSha256':digest(data)}
    report['runs'].append(row)
    print(json.dumps(row),flush=True)
    (out/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
after = source_snapshot()
report['sourceStable'] = before == after
report['changedSourcesDuringRun'] = sorted(p for p in set(before)|set(after) if before.get(p)!=after.get(p))
report['completedAtUtc'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
report['exitCode'] = 0 if report['sourceStable'] and all(r['exitCode']==0 and not r['timeout'] for r in report['runs']) else 1
(out/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'exitCode':report['exitCode'],'sourceStable':report['sourceStable'],'files':len(files),'validation':str(out/'validation.json')}),flush=True)
sys.exit(report['exitCode'])
