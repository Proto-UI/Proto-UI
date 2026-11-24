#!/usr/bin/env python3
"""Run the frozen three-tree producer output. Never alters emitted source.

Each package is built separately with identical release settings and a distinct
native library name. A warm Cargo cache cannot alias another tree's root output.
The clean consumer has only declared dependencies. An existing Cargo target
cache can accelerate dependency compilation; it cannot supply undeclared inputs.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import statistics
import subprocess
import sys
import tomllib

parser = argparse.ArgumentParser()
parser.add_argument('generated', type=Path)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--target-dir', type=Path, required=True)
args = parser.parse_args()
ROOT = args.generated.resolve()
OUT = args.output.resolve()
OUT.mkdir(parents=True, exist_ok=False)
ENV = dict(os.environ)
ENV.update(CARGO_BUILD_JOBS='1', CARGO_TARGET_DIR=str(args.target_dir.resolve()),
           CARGO_PROFILE_DEV_DEBUG='0', CARGO_PROFILE_TEST_DEBUG='0',
           RUSTUP_TOOLCHAIN='1.98.1', CARGO_NET_OFFLINE='false', CI='true')
STATE = {
    'schemaVersion': 1, 'task': 'Sprint 5 #1056 three-tree native costs',
    'controller': 'ChatGPT GPT-6 Astra Pro; auxiliary Cargo execution, no remote model seat',
    'authorization': 'Current user instruction to complete Sprint 5; root delegated native costs',
    'status': 'running', 'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'workspace': str(ROOT), 'environment': {key: ENV[key] for key in [
        'CARGO_BUILD_JOBS', 'CARGO_TARGET_DIR', 'CARGO_PROFILE_DEV_DEBUG',
        'CARGO_PROFILE_TEST_DEBUG', 'RUSTUP_TOOLCHAIN', 'CARGO_NET_OFFLINE']},
    'commands': [], 'cases': [], 'generatedRustEdited': False,
    'productionArtifact': 'optimized native cdylib; no OS application shell or test-support',
    'constructionBoundary': 'same-thread System allocation requests during subject::mount; preexisting App/Window and later layout excluded',
    'budgetAccepted': False,
}


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save():
    (OUT / 'status.json').write_text(json.dumps(STATE, indent=2) + '\n')


def run(name, command, json_output=False):
    log_path = OUT / (name + ('.json' if json_output else '.log'))
    item = {'name': name, 'command': command, 'startedAt': now(), 'log': str(log_path)}
    STATE['commands'].append(item)
    save()
    print('\n[native-cost] ' + name + ': ' + ' '.join(command), flush=True)
    with log_path.open('wb') as log:
        if json_output:
            result = subprocess.run(command, cwd=ROOT, env=ENV, stdout=log,
                                    stderr=subprocess.PIPE, timeout=300)
            code = result.returncode
            (OUT / (name + '.stderr.log')).write_bytes(result.stderr)
            sys.stdout.buffer.write(result.stderr)
        else:
            process = subprocess.Popen(command, cwd=ROOT, env=ENV,
                                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            for line in iter(process.stdout.readline, b''):
                log.write(line)
                log.flush()
                sys.stdout.buffer.write(line)
                sys.stdout.buffer.flush()
            code = process.wait()
    item.update(exitCode=code, finishedAt=now(), sha256=digest(log_path))
    save()
    print('[native-cost] ' + name + ' exit=' + str(code), flush=True)
    return code == 0


def external_packages(lock):
    return {(p['name'], p['version'], p.get('source'), p.get('checksum'))
            for p in lock['package'] if p.get('source')}


def execute():
    manifest = json.loads((ROOT / 'import-manifest.json').read_text())
    STATE['inputsBefore'] = {name: digest(ROOT / name) for name in manifest}
    if manifest != STATE['inputsBefore']:
        raise RuntimeError('Imported files differ from frozen producer input manifest')
    receipt = json.loads((ROOT / 'source-receipt.json').read_text())
    if [case['name'] for case in receipt['cases']] != ['empty', 'base_button', 'composed']:
        raise RuntimeError('The exact empty / original Base Button / composed denominator is required')
    library_names = [case['libraryName'] for case in receipt['cases']]
    if len(set(library_names)) != len(library_names):
        raise RuntimeError('Every measured tree requires its own linked library filename')
    for case in receipt['cases']:
        manifest = tomllib.loads((ROOT / case['consumer'] / 'Cargo.toml').read_text())
        if (case['libraryName'] != 'proto_ui_cost_' + case['name'] or
                manifest['lib']['name'] != case['libraryName'] or
                manifest['package']['name'] != 'proto-ui-cost-' + case['name'].replace('_', '-')):
            raise RuntimeError('Library identity does not match the frozen case: ' + case['name'])
    STATE['sourceReceiptSha256'] = digest(ROOT / 'source-receipt.json')
    STATE['sourceReceipt'] = receipt
    save()
    for name, command in [
        ('rustc', ['rustc', '+1.98.1', '--version', '--verbose']),
        ('cargo', ['cargo', '+1.98.1', '--version']),
        ('host', ['uname', '-a']),
    ]:
        if not run(name, command):
            return False
    lock = ROOT / 'Cargo.lock'
    before = tomllib.loads(lock.read_text())
    shutil.copyfile(lock, OUT / 'Cargo.lock.before')
    # Cargo resolves only the changed local package closure. Preserve and compare
    # the actual original external dependency locks rather than synthesizing it.
    if not run('resolve-consumers', ['cargo', '+1.98.1', 'metadata', '--all-features',
                                    '--format-version', '1', '--manifest-path', str(ROOT / 'Cargo.toml')], True):
        return False
    after = tomllib.loads(lock.read_text())
    added = external_packages(after) - external_packages(before)
    if added:
        raise RuntimeError('New or changed external dependency requires an explicit input review: ' + repr(sorted(added)))
    shutil.copyfile(lock, OUT / 'Cargo.lock.after')
    STATE['lock'] = {'sha256': digest(lock), 'newExternalPackages': [],
                     'removedUnusedExternalPackages': sorted(external_packages(before) - external_packages(after))}
    if not run('locked-graph', ['node', str(ROOT / 'tools/check-cargo-graph.mjs'),
                              '--manifest-path', str(ROOT / 'Cargo.toml'), '--git',
                              'https://github.com/zed-industries/zed', '--rev', receipt['gpuiRevision'],
                              '--toolchain', '1.98.1', '--output', str(OUT / 'cargo-graph.json')]):
        return False
    complete = True
    for case in receipt['cases']:
        name = case['name']
        package = 'proto-ui-cost-' + name.replace('_', '-')
        item = {'name': name, 'status': 'running', 'headlessTestSupport': True, 'productionTestSupport': False}
        STATE['cases'].append(item)
        save()
        passed = run(name + '-construction', ['cargo', '+1.98.1', 'test', '--locked', '-p', package,
                                             '--features', 'test-support', '--test', 'measure', '--',
                                             '--test-threads=1', '--nocapture'])
        if passed:
            text = (OUT / (name + '-construction.log')).read_text()
            if not re.search(r'test result: ok\. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out', text):
                raise RuntimeError(name + ': both complete native tests must execute')
            rows = [json.loads(line.split('native-cost-sample ', 1)[1])
                    for line in text.splitlines() if 'native-cost-sample ' in line]
            if len(rows) != 31 or [row['sample'] for row in rows] != list(range(31)):
                raise RuntimeError(name + ': 31 complete ordered measurement rows required')
            if any(row['case'] != name or row['liveOwnerDelta'] != case['owners'] for row in rows):
                raise RuntimeError(name + ': measurement subject changed')
            (OUT / (name + '-samples.json')).write_text(json.dumps(rows, indent=2) + '\n')
            metrics = ['nanoseconds', 'successfulAllocationCalls', 'successfulReallocationCalls',
                       'deallocationCalls', 'requestedBytesIncludingReallocation']
            item['construction'] = {'passedTests': 2, 'samples': len(rows), 'first': rows[0],
                                    'repeatedSummary': {metric: {
                                        'minimum': min(row[metric] for row in rows[1:]),
                                        'median': statistics.median(row[metric] for row in rows[1:]),
                                        'maximum': max(row[metric] for row in rows[1:]),
                                    } for metric in metrics}}
        else:
            complete = False
            item['construction'] = {'status': 'failed'}
        # Distinct library names preserve artifact identity even on a warm cache.
        # A failed construction never becomes a native pass.
        linked = run(name + '-release', ['cargo', '+1.98.1', 'build', '--locked', '--release',
                                        '-p', package, '--lib', '--no-default-features'])
        if linked:
            suffix = '.dylib' if sys.platform == 'darwin' else '.so'
            artifact = args.target_dir.resolve() / 'release' / ('lib' + case['libraryName'] + suffix)
            if not artifact.is_file():
                raise RuntimeError('No actual linked output for ' + name)
            retained = OUT / (name + suffix)
            shutil.copyfile(artifact, retained)
            item['releaseArtifact'] = {'path': str(retained), 'libraryName': case['libraryName'], 'bytes': retained.stat().st_size,
                                       'sha256': digest(retained), 'defaultFeaturesOnly': True}
            if not run(name + '-linked-file', ['file', str(retained)]):
                complete = False
        else:
            complete = False
            item['releaseArtifact'] = {'status': 'failed'}
        item['status'] = 'passed' if passed and linked else 'failed'
        save()
    return complete


save()
try:
    STATE['status'] = 'passed' if execute() else 'failed'
except Exception as error:
    STATE.update(status='failed', error=repr(error))
    print('[native-cost] exception ' + repr(error), flush=True)
finally:
    manifest = json.loads((ROOT / 'import-manifest.json').read_text())
    STATE['inputsAfter'] = {name: digest(ROOT / name) for name in manifest}
    STATE['sourceDrift'] = [name for name, expected in manifest.items()
                            if name != 'Cargo.lock' and STATE['inputsAfter'][name] != expected]
    if STATE['sourceDrift']:
        STATE['status'] = 'failed'
    STATE['finishedAt'] = now()
    save()
    print('[native-cost] final ' + STATE['status'] + '; ' + str(OUT / 'status.json'), flush=True)
sys.exit(0 if STATE['status'] == 'passed' else 1)
