#!/usr/bin/env python3
"""Read retained originals and optional immutable Git blobs; never run a browser."""
import argparse
import datetime
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parent
SHA = lambda data: hashlib.sha256(data).hexdigest()

def read_json(path):
    return json.loads(path.read_bytes())

def checked_path(base, relative):
    part = PurePosixPath(relative)
    assert not part.is_absolute() and '..' not in part.parts, relative
    return base / relative

def check_file(base, item):
    path = checked_path(base, item['path'])
    assert path.is_file() and not path.is_symlink(), str(path)
    data = path.read_bytes()
    assert len(data) == item['bytes'] and SHA(data) == item['sha256'], str(path)
    return data

def read_tar(base, item):
    archive = check_file(base, item)
    values = {}
    with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as tar:
        for member in tar.getmembers():
            p = PurePosixPath(member.name)
            assert member.isfile() and not p.is_absolute() and '..' not in p.parts
            assert member.name not in values, member.name
            values[member.name] = tar.extractfile(member).read()
    return values

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo', type=Path, help='Local repository with the c1 Git objects and historical evidence')
parser.add_argument('--refresh-manifest', action='store_true', help='Refresh only the package inventory, then verify')
args = parser.parse_args()

if args.refresh_manifest:
    paths = sorted(p for p in ROOT.rglob('*') if p.is_file() and p != ROOT / 'manifest.json')
    assert all(not p.is_symlink() for p in ROOT.rglob('*'))
    files = [{'path': str(p.relative_to(ROOT)), 'bytes': p.stat().st_size, 'sha256': SHA(p.read_bytes())} for p in paths]
    manifest = {'schemaVersion': 1, 'kind': 'publishable bounded evidence package inventory',
                'pathBase': 'this directory', 'generatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'selfExcluded': 'manifest.json', 'fileCountExcludingSelf': len(files),
                'bytesExcludingSelf': sum(x['bytes'] for x in files), 'files': files}
    (ROOT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')

manifest = read_json(ROOT / 'manifest.json')
actual = {str(p.relative_to(ROOT)) for p in ROOT.rglob('*') if p.is_file() and p != ROOT / 'manifest.json'}
assert actual == {x['path'] for x in manifest['files']}
for item in manifest['files']:
    check_file(ROOT, item)

browser = read_json(ROOT / 'browser/manifest.json')
members = read_tar(ROOT / 'browser', browser['archive'])
assert len(members) == len(browser['files']) == 250
assert set(members) == {x['path'] for x in browser['files']}
for item in browser['files']:
    value = members[item['path']]
    assert len(value) == item['bytes'] and SHA(value) == item['sha256'], item['path']
prefix = browser['archive']['root'] + '/'
assert all(x.startswith(prefix) for x in members)
payload = {name[len(prefix):]: value for name, value in members.items()}
head = browser['actualExecution']['head']
tree = browser['actualExecution']['tree']
report = json.loads(payload['browser-vitest.json'])
assert report['success'] and report['numPassedTests'] == report['numTotalTests'] == 37
assert report['numFailedTests'] == report['numPendingTests'] == report['numTodoTests'] == 0
assert len(report['testResults']) == 1
assert report['testResults'][0]['name'] == browser['actualExecution']['originalSuitePath']
cases = report['testResults'][0]['assertionResults']
names = [x['fullName'] for x in cases]
assert len(names) == len(set(names)) == 37
assert sorted(names) == sorted(browser['selection']['fullNames'])
assert all(x['status'] == 'passed' and not x['failureMessages'] for x in cases)
for name in ['receipt.json', 'source-prepare.json', 'source-run.json', 'isolation-prepare.json', 'isolation-run.json']:
    value = json.loads(payload[name])
    assert value['candidateSha'] == head and value['tree'] == tree and value['expectedCases'] == 37
    assert value['selectionSha256'] == browser['selection']['sha256']
iso = json.loads(payload['isolation-run.json'])
assert iso['uid'] != 0 and all(int(x, 16) == 0 for x in iso['capabilities'].values())
assert len(iso['links']) == 1 and iso['links'][0]['ifname'] == 'lo'
assert iso['ipv4DefaultRoutes'] == iso['ipv6DefaultRoutes'] == ''

expected_profiles = [('react', 'react-dom-source-v1'), ('vue', 'vue-source-v1'),
                     ('vue2', 'vue2-source-v1'), ('wc', 'web-component-source-v1')]
builds = []
artifact_count = hidden_count = receipt_count = 0
for item in browser['builds']:
    build_path = item['build']['path']
    build_bytes = payload[build_path]
    assert SHA(build_bytes) == item['build']['sha256']
    build = json.loads(build_bytes)
    directory = str(PurePosixPath(build_path).parent) + '/'
    assert build['candidate']['head'] == head and build['candidate']['headTree'] == tree
    assert build['candidate']['dirty'] is False
    assert sorted((x['target'], x['profile']) for x in build['compilations']) == expected_profiles
    assert len({x['sourceSha256'] for x in build['compilations']}) == 1
    assert all(x['sourceFiles'] == build['compilations'][0]['sourceFiles'] for x in build['compilations'])
    assert SHA(payload[directory + 'entry.ts']) == build['entrySha256']
    assert SHA(payload[directory + 'client.js']) == build['bundleSha256']
    assert len({x['path'] for x in build['artifacts']}) == len(build['artifacts'])
    for art in build['artifacts']:
        value = payload[directory + art['path']]
        assert len(value) == art['bytes'] and SHA(value) == art['sha256']
        artifact_count += 1
        hidden_count += '.proto-ui' in PurePosixPath(art['path']).parts
    for name, value in payload.items():
        if not name.startswith(directory) or '/' in name[len(directory):] or not name.endswith('.json'):
            continue
        if name.endswith('/build.json') or name.endswith('-paint.json'):
            continue
        receipt = json.loads(value); resource = receipt['resources']
        assert receipt['head'] == head and receipt['buildSha256'] == SHA(build_bytes) and receipt['outcome'] == 'PASS'
        assert not receipt['errors'] and not receipt['blocked']
        assert resource['created'] == resource['deleted'] and resource['live'] == resource['duplicates'] == resource['waiting'] == 0
        receipt_count += 1
    builds.append(build)
assert artifact_count == 106 and hidden_count == 70 and receipt_count == 37
for item in browser['visualReview']['images']:
    data = payload[item['path']]
    assert SHA(data) == item['sha256'] and len(data) == item['bytes']
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    assert int.from_bytes(data[16:20], 'big') == 640 and int.from_bytes(data[20:24], 'big') == 360
    checkpoint = json.loads(payload[str(PurePosixPath(item['path']).with_suffix('.json'))])
    scene_build = payload[str(PurePosixPath(item['path']).parent / 'build.json')]
    assert checkpoint['head'] == head and checkpoint['buildSha256'] == SHA(scene_build)
    if item['path'].endswith('-paint.png'):
        phase = 'initial-paint' if item['path'].endswith('-initial-paint.png') else 'replacement-paint'
        assert checkpoint['checkpoint'] == phase
        assert PurePosixPath(item['path']).stem == checkpoint['scenario'] + '-' + phase
        observation = checkpoint['observation']
        assert observation['source']['subscriptions'] == 1 and observation['source']['borrowedDisposals'] == 0
        assert observation['source']['sourceAvailable'] is True and len(observation['pixels']) == 16
        assert observation['resources']['live'] == 16 and observation['resources']['duplicates'] == observation['resources']['waiting'] == 0
        assert observation['presentation']['canvases'] == 0 and observation['presentation']['childText'] == 'ordinary childslot child'
    else:
        assert checkpoint['scenario'] == 'scene-default-unconfigured'
        assert checkpoint['observation']['background'] == 'none' and checkpoint['observation']['fallback'] == 'rgb(38, 51, 64)'
        assert checkpoint['resources']['attempts'] == checkpoint['resources']['live'] == 0
previews = read_json(ROOT / 'visual/index.json')
assert len(previews['images']) == 5
for item in previews['images']:
    data = check_file(ROOT / 'visual', item)
    assert data == members[item['sourceMember']]
    assert item['actualBrowserHead'] == head and item['edited'] is False and item['recaptured'] is False

reviews = read_json(ROOT / 'reviews/index.json')
for item in reviews['archives']:
    raw = read_tar(ROOT / 'reviews', item['archive'])
    assert set(raw) == {x['path'] for x in item['members']}
    for member in item['members']:
        assert len(raw[member['path']]) == member['bytes'] and SHA(raw[member['path']]) == member['sha256']
    original = json.loads(raw[item['reportJsonMember']])
    assert original['actualBrowserHead'] == item['actualBrowserHead']

source_count = history_count = None
if args.repo:
    repo = args.repo.resolve()
    git = lambda *cmd: subprocess.check_output(['git', *cmd], cwd=repo)
    assert git('rev-parse', head + '^{tree}').decode().strip() == tree
    paths = {'pnpm-lock.yaml', 'scripts/test/shader-browser-selection.json',
             'packages/compiler/test/shader-presentation.browser.test.ts'}
    for build in builds:
        paths.update(x['file'] for x in build['sourceGenerator']['files'])
        paths.update(build['harness'])
        paths.update(x for x in build['inputs'] if x.startswith(('packages/', 'scripts/')))
        for compilation in build['compilations']:
            paths.update(x['file'] for x in compilation['sourceFiles'])
    paths = sorted(paths)
    process = subprocess.run(['git', 'cat-file', '--batch'], cwd=repo, check=True,
                             input=''.join(head + ':' + x + '\n' for x in paths).encode(), capture_output=True)
    stream = io.BytesIO(process.stdout); blobs = {}
    for name in paths:
        header = stream.readline().decode().strip().split()
        assert len(header) == 3 and header[1] == 'blob'
        blobs[name] = stream.read(int(header[2])); assert stream.read(1) == b'\n'
    assert stream.read() == b'' and len(blobs) == 608
    selection = blobs['scripts/test/shader-browser-selection.json']
    assert SHA(selection) == browser['selection']['sha256']
    selected = json.loads(selection)
    assert selected['originalJourneys'] + selected['sceneJourneys'] == browser['selection']['fullNames']
    for build in builds:
        generator = build['sourceGenerator']
        assert len(generator['files']) == 194
        assert SHA(json.dumps(generator['files'], separators=(',', ':'), ensure_ascii=False).encode()) == generator['sha256']
        for member in generator['files'] + build['compilations'][0]['sourceFiles']:
            assert len(blobs[member['file']]) == member['bytes'] and SHA(blobs[member['file']]) == member['sha256']
        for name, digest in build['harness'].items():
            assert SHA(blobs[name]) == digest
        for name, digest in build['inputs'].items():
            if name in blobs:
                assert SHA(blobs[name]) == digest
        assert SHA(blobs['pnpm-lock.yaml']) == build['lockSha256']
    source_count = len(blobs)
    history = read_json(ROOT / 'history-index.json')
    for item in history['files']:
        check_file(repo, {**item, 'path': item['repositoryPath']})
    history_count = len(history['files'])

budget = read_json(ROOT / 'final-budget.json')
assert budget['numericalCommit'] == 'c18bf8f8c35a4ec1f69791468a5952c4cb460f41'
assert budget['strictResults']['expectedEntries'] == 9
if budget['status'] == 'pending':
    assert budget['strictResults']['passed'] is None and budget['strictResults']['exitCode'] is None
elif budget['status'] == 'passed':
    assert budget['source']['head'] == budget['source']['expectedSha'] == budget['numericalCommit']
    assert all(budget['source'][k] is True for k in ['requireClean', 'workingTreeClean', 'measuredSourceMatchesHead', 'stableDuringMeasurement'])
    assert budget['strictResults']['passed'] == 9 and budget['strictResults']['failed'] == budget['strictResults']['exitCode'] == 0
    assert all(value == 'success' for value in budget['workflowSteps'].values())
    assert budget['independentReview']['status'] in ['passed', 'accepted']
    assert all(budget['run'][k] is not None for k in ['url', 'id', 'attempt'])
    raw = read_tar(ROOT, budget['originals']['archive'])
    check_file(ROOT, budget['originals']['manifest'])
    assert SHA(raw[budget['originals']['reportMember']]) == budget['originals']['reportSha256']
    assert SHA(raw[budget['originals']['terminalMember']]) == budget['originals']['terminalSha256']
    assert json.loads(raw[budget['originals']['reportMember']])['exitCode'] == 0
    assert json.loads(raw[budget['originals']['terminalMember']])['status'] == 'passed'
else:
    assert budget['status'] == 'failed', 'Unknown final budget disposition'

print(json.dumps({'packageFilesIncludingManifest': len(manifest['files']) + 1,
                  'packageBytesIncludingManifest': sum(x['bytes'] for x in manifest['files']) + (ROOT / 'manifest.json').stat().st_size,
                  'browserHead': head, 'archiveFilesVerified': 250, 'uniqueCasesPassed': 37,
                  'generatedArtifactsVerified': 106, 'hiddenSupportArtifactsVerified': 70,
                  'retainedImageFilesVerified': 17, 'sourceBlobsVerified': source_count,
                  'directPreviewCopiesVerified': 5,
                  'historyReferencesVerified': history_count, 'independentReviewArchivesVerified': 2,
                  'finalBudgetStatus': budget['status'],
                  'browserExecutedByThisReader': False, 'newVisualReviewClaimedByThisReader': False}, ensure_ascii=False))
