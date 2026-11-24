#!/usr/bin/env python3
"""Validate the new exact pre-budget candidate against already reviewed originals."""
from collections import defaultdict
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
import json
import subprocess
import tarfile

ROOT = Path('/workspace/scratch/1494db44bb7b')
REPO = ROOT / 'Proto-UI'
OUT = ROOT / 'ir10-semantics-evidence'
DIRECTORY = ROOT / 'integration-evidence/canonical-prebudget-originals'
ARCHIVE = ROOT / 'integration-evidence/canonical-prebudget-originals.tar.gz'
PREVIOUS = ROOT / 'integration-evidence/canonical-candidate-originals/package-budgets-9fff88cf23d4e55375979bc5c68c033e3deaed38-45262013762-attempt-1-logs/report.json'
HEAD = 'c1f0332eed6ba79734b92bd4407b274f45d5c274'
EXPECTED_ARCHIVE = 'b2fb242e53637823041b5040ec133c868175b06a360ac6cf7cb9fdd05bac4a02'

def digest(data):
    return sha256(data).hexdigest()

def encode(value):
    return json.dumps(value, separators=(',', ':'), ensure_ascii=False).encode()

def git(*args, data=None):
    return subprocess.run(['git', *args], cwd=REPO, input=data, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, check=True).stdout

archive_bytes = ARCHIVE.read_bytes()
assert len(archive_bytes) == 315621 and digest(archive_bytes) == EXPECTED_ARCHIVE
originals = {}
with tarfile.open(ARCHIVE, 'r:gz') as archive:
    members = defaultdict(list)
    for member in archive.getmembers():
        if member.isfile():
            members[Path(member.name).name].append(member)
    for name in ['report.json', 'terminal.json', 'setup.log', 'build.log', 'controls.log', 'gate.log']:
        data = (DIRECTORY / name).read_bytes()
        assert len(members[name]) == 1
        member = members[name][0]
        assert archive.extractfile(member).read() == data
        originals[name] = {'bytes': len(data), 'sha256': digest(data), 'archiveMember': member.name}

before = json.loads(PREVIOUS.read_text())
current = json.loads((DIRECTORY / 'report.json').read_text())
terminal = json.loads((DIRECTORY / 'terminal.json').read_text())
source = current['source']
assert source['head'] == source['expectedSha'] == terminal['candidate'] == HEAD
assert terminal['source'] == source
for key in ['workingTreeClean', 'measuredSourceMatchesHead', 'stableDuringMeasurement', 'requireClean']:
    assert source[key] is True
assert source['tree'] == git('rev-parse', HEAD + '^{tree}').decode().strip()
for key in ['environment', 'measurement', 'policy', 'results', 'diagnostics', 'exitCode', 'withinBudgets']:
    assert current[key] == before[key], f'changed {key}'
assert current['exitCode'] == terminal['originalReportExitCode'] == 1
assert terminal['status'] == 'failed'
assert sum(row['pass'] for row in current['results']) == 6
setup = (DIRECTORY / 'setup.log').read_text()
assert setup.splitlines()[0] == HEAD
assert 'Lockfile is up to date, resolution step is skipped' in setup
assert 'using pnpm v10.32.1' in setup
assert 'complete: 47/47 public packages' in (DIRECTORY / 'build.log').read_text()
controls = (DIRECTORY / 'controls.log').read_text()
for text in ['checked 47 public manifests', '\u2139 tests 28', '\u2139 pass 28', '\u2139 fail 0', '\u2139 skipped 0']:
    assert text in controls

files = {}
listing = git('ls-tree', '-r', '-z', '--full-tree', HEAD, '--', *source['scope'])
for item in listing.split(b'\0'):
    if not item:
        continue
    meta, path = item.split(b'\t', 1)
    mode, kind, oid = meta.decode().split()
    assert kind == 'blob' and mode in ['100644', '100755']
    files[path.decode()] = oid
objects = sorted(set(files.values()))
raw = git('cat-file', '--batch', data=''.join(oid + '\n' for oid in objects).encode())
offset = 0
digests = {}
for oid in objects:
    end = raw.index(b'\n', offset)
    actual, kind, size = raw[offset:end].decode().split()
    assert actual == oid and kind == 'blob'
    length = int(size)
    data = raw[end + 1:end + 1 + length]
    assert len(data) == length and raw[end + 1 + length:end + 2 + length] == b'\n'
    digests[oid] = {'bytes': length, 'sha256': digest(data)}
    offset = end + 2 + length
assert offset == len(raw)
inventory = [[path, digests[oid]] for path, oid in sorted(files.items())]
assert len(inventory) == source['fileCount'] == 7831
assert digest(encode(inventory)) == source['fingerprintSha256']
checked_inputs = set()
for row in current['results'] + current['diagnostics']:
    for item in row['closure']['inputs']:
        assert digests[files[item['path']]] == {'bytes': item['sourceBytes'], 'sha256': item['sourceSha256']}
        checked_inputs.add(item['path'])
changed = git('diff', '--name-only', before['source']['head'], HEAD).decode().splitlines()
assert not checked_inputs.intersection(changed)
scope_changes = git('diff', '--name-only', before['source']['head'], HEAD, '--', *source['scope']).decode().splitlines()
assert scope_changes == ['packages/compiler/test/shader-presentation.browser.test.ts']

proposed = {'adapter-react root': 172800, 'adapter-vue root': 171600,
            'adapter-web-component root': 207400}
arithmetic = []
for row in current['results']:
    if row['name'] in proposed:
        ceiling = proposed[row['name']]
        arithmetic.append({'entry': row['name'], 'oldCeiling': row['budget'],
                           'candidateGzipBytes': row['gzipBytes'],
                           'parentProposedCeiling': ceiling,
                           'proposedIncrease': ceiling - row['budget'],
                           'proposedHeadroom': ceiling - row['gzipBytes'],
                           'smallest100ByteCeilingAboveObservedValue': ((row['gzipBytes'] + 99) // 100) * 100 == ceiling})

result = {
    'schemaVersion': 1,
    'kind': 'independent pre-budget exact-candidate continuation receipt',
    'reviewer': '/root/ir10_semantics',
    'head': HEAD, 'runId': 45266820171, 'attempt': 1,
    'runUrl': 'https://github.com/Proto-UI/Proto-UI/actions/runs/45266820171',
    'priorCanonicalHead': before['source']['head'], 'source': source,
    'archive': str(ARCHIVE), 'archiveSha256': EXPECTED_ARCHIVE,
    'originals': originals,
    'checks': {
        'allSixOriginalsMatchArchive': True,
        'fullResultsAndDiagnosticsExactlyEqualPriorCanonicalReport': True,
        'environmentMeasurementAndPolicyExactlyEqual': True,
        'freshExpectedHeadCleanAndStable': True,
        'fullSourceFingerprintRecomputedFromExactGitBlobs': True,
        'sourceFilesChecked': len(inventory), 'uniqueClosureInputsChecked': len(checked_inputs),
        'closureInputsUnchangedAndMatchExactNewGitCandidate': True,
        'onlyMeasuredScopeSourceChange': scope_changes,
        'publicBuild': '47/47', 'manifestCheck': 47, 'measurementControls': '28/28',
    },
    'strictResult': {'passed': 6, 'total': 9, 'exitCode': 1, 'terminal': 'failed', 'originalFailurePreserved': True},
    'costConclusion': 'The complete source-bound 9-entry and 2-consumer results, including hashes, retained closure inputs and policy outcomes, are unchanged from the independently reviewed 9fff canonical candidate. The prior closure and attribution conclusions continue to hold for this new exact candidate.',
    'parentProposedNumericArithmetic': arithmetic,
    'numericDecisionStatus': 'Parent proposal only; no numeric source edit reviewed or post-edit validation available yet.',
    'requiredNextStep': 'Review the separately committed numeric-only transaction and its fresh exact-SHA canonical strict evidence; do not reuse the pre-edit red report as post-edit validation.',
    'testsOrBuildsRerunByThisReview': 0,
    'numericEditsMadeByThisReview': False,
    'finalAcceptance': False,
    'recordedAtUtc': datetime.now(timezone.utc).isoformat(),
}
path = OUT / 'canonical-prebudget-independent-receipt.json'
path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
print(json.dumps({'receipt': str(path), 'sha256': digest(path.read_bytes()),
                  'checks': result['checks'], 'strictResult': result['strictResult'],
                  'proposedArithmetic': arithmetic}, indent=2))
