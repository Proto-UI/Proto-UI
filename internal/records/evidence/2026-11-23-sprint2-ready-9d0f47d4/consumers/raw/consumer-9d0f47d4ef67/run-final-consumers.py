#!/usr/bin/env python3
"""Source-bound Sprint 2 compiler/CLI and frozen actual-consumer replay.

This is temporary orchestration of the candidate's maintained verification tools.
It never edits product source or uses a native browser/device.  A PREPARED result
is not acceptance.  The selected candidate must remain clean at the supplied SHA.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
import traceback

SHENKO = 'f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42'
VERDANT = '91a775546ebd21a87d76d76568195a6513437719'
PATTERNS = {
    'shenko': ['/AGENTS.md', '/.agents/skills/shenko-dev/', '/crates/shenko-ui/'],
    'verdant': ['/AGENTS.md', '/frontend/proto-ui/', '/frontend/Cargo.toml'],
}
TOOLS = [
    'scripts/compiler/build-pinned.ts', 'scripts/compiler/pinned-cli-smoke.mjs',
    'scripts/compiler/native-consumer-smoke.mjs',
    'scripts/compiler/release-family-smoke.mjs',
    'scripts/compiler/release-family-runtime.mjs',
    'scripts/compiler/release-family-costs.mjs',
    'scripts/compiler/sprint2-consumer-inventory.mjs',
    'scripts/compiler/shenko-consumer-smoke.mjs',
    'scripts/build/public-packages.mjs',
]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def save(file, value):
    file = Path(file)
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()


def snapshot_files(root):
    """Hash physical files and links without following package symlinks."""
    root = Path(root)
    rows = []
    for base, dirs, files in os.walk(root, followlinks=False):
        for name in sorted(dirs + files):
            file = Path(base) / name
            if file.is_symlink():
                target = file.resolve(strict=True)
                if not target.is_relative_to(root.resolve()):
                    raise RuntimeError(f'Installed dependency link escapes its payload: {file}')
                rows.append({'path': str(file.relative_to(root)), 'link': os.readlink(file)})
            elif file.is_file():
                data = file.read_bytes()
                rows.append({'path': str(file.relative_to(root)), 'bytes': len(data), 'sha256': sha(data)})
    return sorted(rows, key=lambda row: row['path'])


class Replay:
    def __init__(self, args):
        self.args = args
        self.source = Path(args.source).resolve()
        self.out = Path(args.out).resolve()
        self.out.mkdir(parents=True, exist_ok=False)
        self.work = Path(tempfile.mkdtemp(prefix='proto-s2-final-consumers-'))
        self.env = dict(os.environ, CI='true', NODE_PATH='', NODE_OPTIONS='')
        for key in ['NATIVE_CONSUMER_COMPILER', 'NATIVE_CONSUMER_PROFILES',
                    'NATIVE_CONSUMER_PACKAGE_ROOT', 'PROTO_UI_SOURCE', 'PROTO_UI_BUILD_RECEIPT']:
            self.env.pop(key, None)
        self.summary = {
            'schema': 'proto-ui.sprint2.final-consumer-replay.v1',
            'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'expectedHead': args.head, 'source': str(self.source),
            'orchestratorSha256': sha(Path(__file__).read_bytes()),
            'scope': 'Pinned compiler build/install/determinism and CLI; ordinary real framework mounts in Happy DOM; frozen Shenko application build/Node tests; frozen Verdant producer; all 47 public builds and separate Tabs 13. Separate docs style generation and check:types:docs are executed locally; the aggregate check:types is NOT_RUN_HERE and check:types:workspace belongs to official hosted run 45188583301 with independent readback. No native-browser, Cargo, desktop, live backend or release claim.',
            'work': str(self.work), 'status': 'RUNNING', 'commands': [],
            'evidenceMappings': [], 'results': {},
        }
        self.flush()

    def flush(self):
        save(self.out / 'summary.json', self.summary)

    def guard(self):
        actual = git(self.source, 'rev-parse', 'HEAD')
        if actual != self.args.head:
            raise RuntimeError(f'Candidate changed: expected {self.args.head}, found {actual}')
        changed = git(self.source, 'status', '--porcelain', '--untracked-files=normal')
        if changed:
            raise RuntimeError('Candidate is not clean: ' + changed)

    def run(self, name, args, cwd=None, env=None, expected=0, timeout=1200):
        self.guard()
        print(json.dumps({'stage': name, 'state': 'START'}), flush=True)
        stdout = self.out / 'logs' / (name + '.stdout.log')
        stderr = self.out / 'logs' / (name + '.stderr.log')
        stdout.parent.mkdir(exist_ok=True)
        record = {'name': name, 'argv': [str(x) for x in args],
                  'cwd': str(cwd or self.source), 'expectedExit': expected,
                  'stdout': str(stdout.relative_to(self.out)), 'stderr': str(stderr.relative_to(self.out))}
        start = time.monotonic()
        with stdout.open('w') as out, stderr.open('w') as err:
            try:
                completed = subprocess.run([str(x) for x in args], cwd=cwd or self.source,
                                           env=env or self.env, stdout=out, stderr=err, timeout=timeout)
                record['exitCode'] = completed.returncode
            except (subprocess.TimeoutExpired, OSError) as error:
                record['exitCode'] = None
                record['error'] = str(error)
        record['wallSeconds'] = round(time.monotonic() - start, 3)
        record['stdoutSha256'] = sha(stdout.read_bytes())
        record['stderrSha256'] = sha(stderr.read_bytes())
        self.summary['commands'].append(record)
        self.flush()
        print(json.dumps({'stage': name, 'state': 'END', 'exitCode': record['exitCode'],
                          'wallSeconds': record['wallSeconds']}), flush=True)
        if record['exitCode'] != expected:
            raise RuntimeError(f'{name}: expected exit {expected}, observed {record["exitCode"]}; see {stderr}')
        self.guard()
        return stdout.read_text()

    def clone(self, name, repo, revision):
        target = self.work / name
        self.run(name + '-clone', ['git', 'clone', '--shared', '--no-checkout', repo, target])
        self.run(name + '-sparse', ['git', '-C', target, 'sparse-checkout', 'set',
                                  '--no-cone', '--no-sparse-index', *PATTERNS[name]])
        self.run(name + '-checkout', ['git', '-C', target, 'checkout', '--detach', revision])
        assert git(target, 'rev-parse', 'HEAD') == revision
        assert git(target, 'status', '--porcelain') == ''
        return target

    def archive(self, label, directory):
        directory = Path(directory).resolve()
        if not directory.is_relative_to(Path(tempfile.gettempdir()).resolve()):
            raise RuntimeError('Evidence path is not in the OS temporary directory: ' + str(directory))
        dest = self.out / 'evidence' / label
        shutil.copytree(directory, dest, symlinks=True,
                        ignore=shutil.ignore_patterns('node_modules', '.git', '.npm-cache'))
        self.summary['evidenceMappings'].append({
            'originalRoot': str(directory), 'archivedRoot': str(dest.relative_to(self.out)),
            'omittedPayloads': ['node_modules', '.git', '.npm-cache'],
            'note': 'Raw receipts retain original paths. Dependency delivery receipts retain payload identities.'})
        self.flush()
        return dest

    def marked(self, label, script, marker, extra=(), timeout=1200):
        failure = None
        try:
            output = self.run(label, ['node', '--import', 'tsx', script, *extra], timeout=timeout)
        except RuntimeError as error:
            failure = error
            output = (self.out / 'logs' / (label + '.stdout.log')).read_text()
        match = re.search(re.escape(marker) + r':?\s+(\S+)', output)
        if not match:
            raise failure or RuntimeError(label + ': evidence marker absent')
        directory = Path(match.group(1))
        if failure:
            self.archive(label + '-failed', directory)
            raise failure
        value = json.loads((directory / 'summary.json').read_text())
        if not value.get('ok'):
            raise RuntimeError(label + ': child summary is not successful')
        self.summary['results'][label] = {'ok': True, 'originalEvidence': str(directory)}
        self.flush()
        return directory, value

    def install_shenko(self, shenko):
        web = shenko / 'crates/shenko-ui/web'
        before = sha((web / 'pnpm-lock.yaml').read_bytes())
        original = self.args.shenko_installed_root
        delivery = {'mode': self.args.shenko_install, 'lockSha256': before}
        if original:
            seed = Path(original).resolve()
            for filename in ['package.json', 'pnpm-lock.yaml']:
                assert (seed / filename).read_bytes() == (web / filename).read_bytes(), filename
            payload = snapshot_files(seed / 'node_modules')
            shutil.copytree(seed / 'node_modules', web / 'node_modules', symlinks=True)
            assert payload == snapshot_files(web / 'node_modules')
            delivery.update({'source': str(seed), 'payload': payload,
                             'payloadInventorySha256': sha(json.dumps(payload, sort_keys=True).encode())})
        elif self.args.shenko_install == 'copy':
            raise RuntimeError('--shenko-install copy requires --shenko-installed-root')
        if self.args.shenko_install == 'frozen':
            command = ['corepack', 'pnpm@10.32.1', 'install', '--frozen-lockfile', '--ignore-scripts']
            command += ['--offline'] if self.args.offline else ['--fetch-retries=0', '--fetch-timeout=30000']
            self.run('shenko-frozen-install', command, cwd=web)
            delivery['claim'] = 'Actual frozen pnpm install; install lifecycle scripts disabled.'
        else:
            delivery['claim'] = 'Whole existing installed payload copied with exact per-file/link identity; NOT a fresh package-manager or registry install.'
        assert sha((web / 'pnpm-lock.yaml').read_bytes()) == before
        manifest = json.loads((web / 'package.json').read_text())
        direct = {}
        for name, expected in (manifest.get('dependencies', {}) | manifest.get('devDependencies', {})).items():
            actual = json.loads((web / 'node_modules' / name / 'package.json').read_text())['version']
            assert actual == expected, (name, actual, expected)
            direct[name] = actual
        delivery['verifiedDirectVersions'] = direct
        save(self.out / 'receipts/shenko-dependency-delivery.json', delivery)

    def execute(self):
        if not re.fullmatch('[0-9a-f]{40}', self.args.head):
            raise RuntimeError('--head must be a full 40-character lowercase Git SHA')
        self.guard()
        node = self.run('node-version', ['node', '--version']).strip()
        assert node.startswith('v24.'), node
        pnpm = self.run('pnpm-version', ['corepack', 'pnpm@10.32.1', '--version']).strip()
        assert pnpm == '10.32.1', pnpm
        self.summary['tools'] = {'node': node, 'pnpm': pnpm}
        self.summary['lockSha256'] = sha((self.source / 'pnpm-lock.yaml').read_bytes())
        self.summary['executedToolInputs'] = [{'path': p, 'sha256': sha((self.source / p).read_bytes())} for p in TOOLS]
        shenko = self.clone('shenko', self.args.shenko_repository, SHENKO)
        verdant = self.clone('verdant', self.args.verdant_repository, VERDANT)
        self.summary['frozenConsumers'] = [
            {'name': 'Shenko', 'revision': SHENKO, 'path': str(shenko), 'sparsePaths': PATTERNS['shenko']},
            {'name': 'Verdant', 'revision': VERDANT, 'path': str(verdant), 'sparsePaths': PATTERNS['verdant']},
        ]
        self.flush()
        if self.args.prepare_only:
            self.summary['status'] = 'PREPARED_ONLY'
            self.summary['acceptanceClaim'] = False
            self.guard()
            return
        build_a, build_b = self.work / 'compiler-a', self.work / 'compiler-b'
        for name, dest in [('pinned-build-a', build_a), ('pinned-build-b', build_b)]:
            self.run(name, ['node', '--import', 'tsx', 'scripts/compiler/build-pinned.ts',
                            '--revision', self.args.head, '--output', dest])
        hashes_a, hashes_b = snapshot_files(build_a), snapshot_files(build_b)
        assert hashes_a == hashes_b, 'Pinned builds differ'
        identity = json.loads((build_a / 'compiler-build.json').read_text())
        assert identity['revision'] == self.args.head
        self.summary['compilerBuild'] = identity
        save(self.out / 'receipts/pinned-determinism.json', {'ok': True, 'revision': self.args.head,
             'method': 'Two separately produced complete artifact sets; all paths and bytes equal before installation',
             'files': hashes_a})
        self.archive('pinned-artifact', build_a)
        install = ['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund']
        if self.args.offline:
            install.append('--offline')
        self.run('pinned-artifact-install', install, cwd=build_a)
        self.env.update(NATIVE_CONSUMER_COMPILER=str(build_a / 'index.js'),
                        NATIVE_CONSUMER_DEPENDENCIES='copy',
                        NATIVE_CONSUMER_PACKAGE_ROOT=str(self.source),
                        SHENKO_SOURCE_SNAPSHOT=str(Path(self.args.shenko_repository).resolve()))
        cli_dir, cli = self.marked('pinned-cli', 'scripts/compiler/pinned-cli-smoke.mjs', 'PINNED_CLI_EVIDENCE')
        self.archive('pinned-cli', cli_dir)
        ordinary_dir, ordinary = self.marked('ordinary-frameworks', 'scripts/compiler/native-consumer-smoke.mjs', 'NATIVE_CONSUMER_EVIDENCE')
        assert len(ordinary['results']) == 4
        self.archive('ordinary-frameworks', ordinary_dir)
        family_dir, family = self.marked('ordinary-families', 'scripts/compiler/release-family-smoke.mjs', 'RELEASE_FAMILY_EVIDENCE')
        assert len(family['results']) == 4 and all(len(row['families']) == 3 for row in family['results'])
        self.run('family-production-costs', ['node', 'scripts/compiler/release-family-costs.mjs', family_dir / 'summary.json'])
        self.archive('ordinary-families', family_dir)
        inventory = self.out / 'receipts/source-admission.json'
        self.run('frozen-source-inventory', ['node', 'scripts/compiler/sprint2-consumer-inventory.mjs', shenko, verdant, inventory])
        value = json.loads(inventory.read_text())
        assert not any(row.get('status') == 'FAIL' for row in value['sourceAdmission'])
        build_stdout = self.run('public-shenko-closure', ['node', 'scripts/build/public-packages.mjs',
                    '--package', '@proto.ui/adapter-react', '--package', '@proto.ui/prototypes-shadcn',
                    '--package', '@proto.ui/cli', '--json'])
        public_build = json.loads(build_stdout)
        receipt = self.out / 'receipts/public-build-shenko-closure.json'
        save(receipt, public_build)
        assert len(public_build['results']) == public_build['selectedCount']
        self.install_shenko(shenko)
        shenko_dir, app = self.marked('shenko-application', 'scripts/compiler/shenko-consumer-smoke.mjs',
                                      'SHENKO_CONSUMER_EVIDENCE', [shenko, build_a, receipt])
        assert app['authoredSourcesMatchFrozenCommit'] and app['authoredSourcesUnchanged']
        assert [lane['name'] for lane in app['lanes']] == ['source-seam', 'pinned-artifact']
        self.archive('shenko-application', shenko_dir)
        producer = verdant / 'frontend/proto-ui/tools/build-proto-ui.mjs'
        pinfile = verdant / 'frontend/proto-ui/compiler.pin.json'
        original_pin = json.loads(pinfile.read_text())
        original_source = (verdant / original_pin['source']).read_bytes()
        original_producer = producer.read_bytes()
        self.run('verdant-original-pin-rejection', ['node', producer, '--upstream', self.source, '--check'], cwd=verdant, expected=2)
        pin = json.loads(json.dumps(original_pin))
        pin['upstream']['revision'] = self.args.head
        save(pinfile, pin)
        save(self.out / 'receipts/verdant-original-pin.json', original_pin)
        save(self.out / 'receipts/verdant-temporary-pin.json', pin)
        self.run('verdant-producer', ['node', producer, '--upstream', self.source], cwd=verdant)
        self.run('verdant-producer-check', ['node', producer, '--upstream', self.source, '--check'], cwd=verdant)
        assert (verdant / pin['source']).read_bytes() == original_source
        assert producer.read_bytes() == original_producer
        producer_receipt = json.loads((verdant / pin['output']['receipt']).read_text())
        save(self.out / 'receipts/verdant-producer.json', producer_receipt)
        save(self.out / 'receipts/verdant-scope.json', {'ok': True, 'consumerRevision': VERDANT,
             'upstreamRevision': self.args.head, 'authoredSourceSha256': sha(original_source),
             'originalProducerSha256': sha(original_producer), 'authoredAndProducerUnchanged': True,
             'artifacts': len(producer_receipt['artifacts']), 'cargo': 'UNTESTED', 'desktopRuntime': 'UNTESTED'})
        self.archive('verdant-generated', verdant / pin['output']['directory'])
        (self.out / 'receipts/verdant-temporary-consumer.patch').write_text(git(verdant, 'diff') + '\n')
        # The hosted gate owns check:types:workspace, not the whole check:types aggregate.
        # Preserve each consumer's own typecheck and every original smoke assertion.
        external_types = {
            'head': self.args.head,
            'aggregate': {
                'command': 'corepack pnpm@10.32.1 check:types',
                'status': 'NOT_RUN_HERE',
                'claim': 'No all-types acceptance claim from this bounded local replay.'
            },
            'workspace': {
                'command': 'corepack pnpm@10.32.1 check:types:workspace',
                'owner': 'official Sprint 2 hosted consumer workflow',
                'runUrl': 'https://github.com/Proto-UI/Proto-UI/actions/runs/45188583301',
                'localStatus': 'NOT_RUN_HERE',
                'externalStatus': 'REQUIRES_INDEPENDENT_READBACK'
            },
            'docs': {
                'command': 'corepack pnpm@10.32.1 check:types:docs',
                'localStatus': 'NOT_EXECUTED_YET',
                'owner': 'this replay after complete public build and Tabs 13',
                'prerequisite': 'corepack pnpm@10.32.1 --filter apps-www generate:proto-ui-style'
            }
        }
        save(self.out / 'receipts/typechecks.external.json', external_types)
        self.summary['externalGates'] = {'typechecks': external_types}
        self.flush()
        all_public_stdout = self.run('public-all-47-before-tabs',
            ['node', 'scripts/build/public-packages.mjs', '--json'])
        all_public = json.loads(all_public_stdout)
        save(self.out / 'receipts/public-build-all-47.json', all_public)
        assert all_public['packageCount'] == 47 and all_public['selectedCount'] == 47
        assert len(all_public['results']) == 47
        self.summary['results']['public-all-47-before-tabs'] = {
            'ok': True, 'built': 47, 'scope': 'Actual complete public export builds before ordinary Code consumption'}
        tabs_receipt = self.out / 'receipts/tabs-profile-switch.json'
        self.run('tabs-profile-switch-separate-13', ['corepack', 'pnpm@10.32.1', 'exec', 'vitest', 'run',
            'apps/www/src/components/PrototypePreviewer/tabs-profile-switch.test.ts',
            'apps/www/src/components/PrototypePreviewer/tabs-profile-switch-code.test.ts',
            '--maxWorkers=1', '--reporter=json', '--outputFile=' + str(tabs_receipt)])
        tabs = json.loads(tabs_receipt.read_text())
        assert tabs['numTotalTests'] == 13 and tabs['numPassedTests'] == 13 and tabs['numFailedTests'] == 0
        self.summary['results']['tabs-profile-switch-separate-13'] = {
            'ok': True, 'passed': 13, 'scope': 'Separate targeted Tabs/ordinary Code tests; not part of the fixed 304 inventory'}
        try:
            self.run('docs-generate-proto-ui-style',
                ['corepack', 'pnpm@10.32.1', '--filter', 'apps-www', 'generate:proto-ui-style'])
            self.run('docs-types', ['corepack', 'pnpm@10.32.1', 'check:types:docs'])
        except BaseException:
            last = self.summary['commands'][-1]
            external_types['docs'].update({
                'localStatus': 'TIMEOUT_OR_EXECUTION_ERROR' if last['exitCode'] is None else 'FAIL',
                'lastStage': last['name'], 'exitCode': last['exitCode'],
                'stdout': last['stdout'], 'stderr': last['stderr']})
            save(self.out / 'receipts/typechecks.external.json', external_types)
            self.flush()
            raise
        external_types['docs'].update({'localStatus': 'PASS', 'exitCode': 0,
            'stdout': 'logs/docs-types.stdout.log', 'stderr': 'logs/docs-types.stderr.log'})
        save(self.out / 'receipts/typechecks.external.json', external_types)
        self.guard()
        self.summary['status'] = 'PASS'
        self.summary['acceptanceClaim'] = False
        self.summary['localVerificationClaim'] = True
        self.summary['consumerScopeAccepted'] = True
        self.summary['acceptanceDisposition'] = 'Bounded local verification passed; external gates are not claimed by this replay.'
        self.summary['finalHead'] = git(self.source, 'rev-parse', 'HEAD')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['source', 'head', 'out', 'shenko-repository', 'verdant-repository']:
        parser.add_argument('--' + name, required=True)
    parser.add_argument('--shenko-install', choices=['frozen', 'copy'], default='frozen')
    parser.add_argument('--shenko-installed-root', help='Existing frozen Shenko web root; exact manifest/lock and physical payload checked before copying')
    parser.add_argument('--offline', action='store_true', help='Require actual npm/pnpm installs to use their caches; missing entries remain failures')
    parser.add_argument('--prepare-only', action='store_true', help='Restore exact consumers and validate source/tool identities; no acceptance/build/test claim')
    args = parser.parse_args()
    replay = Replay(args)
    try:
        replay.execute()
    except BaseException as error:
        replay.summary['status'] = 'FAIL'
        replay.summary['acceptanceClaim'] = False
        replay.summary['failure'] = {'message': str(error), 'traceback': traceback.format_exc()}
        print(json.dumps({'state': 'FAIL', 'message': str(error)}), file=sys.stderr, flush=True)
    finally:
        replay.summary['finishedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        replay.flush()
        print(json.dumps({'status': replay.summary['status'], 'summary': str(replay.out / 'summary.json')}), flush=True)
    return 1 if replay.summary['status'] == 'FAIL' else 0


if __name__ == '__main__':
    sys.exit(main())
