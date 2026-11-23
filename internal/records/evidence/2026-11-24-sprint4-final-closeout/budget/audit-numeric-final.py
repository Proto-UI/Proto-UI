#!/usr/bin/env python3
"""Read-only exact-head final budget receipt audit; no builds or tests."""
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
WORKFLOW = ROOT / 'workflow/budget-transaction'
DIRECTORY = ROOT / 'integration-evidence/canonical-final-originals'
ARCHIVE = ROOT / 'integration-evidence/canonical-final-originals.tar.gz'
HEAD = 'c18bf8f8c35a4ec1f69791468a5952c4cb460f41'
PARENT = 'c1f0332eed6ba79734b92bd4407b274f45d5c274'
EXPECTED_ARCHIVE = 'cd1877fa9ed53d5ae07018592d940392cfa1fd585adbbb7a6d5ec30b0452b581'

def digest(data):
    return sha256(data).hexdigest()

def encode(value):
    return json.dumps(value, separators=(',', ':'), ensure_ascii=False).encode()

def git(*args, data=None):
    return subprocess.run(['git', *args], cwd=REPO, input=data, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, check=True).stdout

archive_bytes = ARCHIVE.read_bytes()
assert len(archive_bytes) == 315520 and digest(archive_bytes) == EXPECTED_ARCHIVE
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

before = json.loads((ROOT / 'integration-evidence/canonical-prebudget-originals/report.json').read_text())
current = json.loads((DIRECTORY / 'report.json').read_text())
terminal = json.loads((DIRECTORY / 'terminal.json').read_text())
source = current['source']
assert source['head'] == source['expectedSha'] == terminal['candidate'] == HEAD
assert terminal['source'] == source
assert source['tree'] == git('rev-parse', HEAD + '^{tree}').decode().strip()
assert git('rev-parse', HEAD + '^').decode().strip() == PARENT
for key in ['workingTreeClean', 'measuredSourceMatchesHead', 'stableDuringMeasurement', 'requireClean']:
    assert source[key] is True
assert source['statusSha256'] == digest(b'')
for key in ['environment', 'measurement', 'policy', 'diagnostics']:
    assert current[key] == before[key], f'changed {key}'
assert current['policy']['mode'] == 'strict'
assert current['exitCode'] == terminal['originalReportExitCode'] == 0
assert current['withinBudgets'] is True and terminal['status'] == 'passed' and not terminal['problems']
assert len(current['results']) == 9 and all(row['pass'] is True for row in current['results'])
for step in terminal['workflowSteps'].values():
    assert step['outcome'] == step['conclusion'] == 'success'

numeric = json.loads((WORKFLOW / 'candidate-after.json').read_text())
assert numeric['head'] == HEAD and numeric['parent'] == PARENT and numeric['tree'] == source['tree']
new_caps = {row['name']: row['proposed'] for row in numeric['entries']}
rows = []
for old, new in zip(before['results'], current['results']):
    assert old['name'] == new['name']
    expected = dict(old)
    if old['name'] in new_caps:
        expected.update(budget=new_caps[old['name']], pass_=True)
        del expected['pass_']
        expected['pass'] = True
        expected['overBudgetBytes'] = 0
        expected['blocking'] = False
    assert new == expected, f"unexpected whole result change: {old['name']}"
    assert new['overBudgetBytes'] == 0 and new['blocking'] is False
    rows.append({key: value for key, value in new.items() if key != 'closure'} |
                {'oldBudget': old['budget'], 'oldPass': old['pass'], 'headroom': new['budget'] - new['gzipBytes']})

setup = (DIRECTORY / 'setup.log').read_text()
assert setup.splitlines()[0] == HEAD
assert 'Lockfile is up to date, resolution step is skipped' in setup and 'using pnpm v10.32.1' in setup
assert 'complete: 47/47 public packages' in (DIRECTORY / 'build.log').read_text()
controls = (DIRECTORY / 'controls.log').read_text()
for text in ['checked 47 public manifests', '\u2139 tests 28', '\u2139 pass 28', '\u2139 fail 0',
             '\u2139 skipped 0', '\u2139 cancelled 0', '\u2139 todo 0']:
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
scope_changes = git('diff', '--name-only', PARENT, HEAD, '--', *source['scope']).decode().splitlines()
assert scope_changes == ['scripts/analysis/package-budgets.mjs']
assert not checked_inputs.intersection(scope_changes)

pre_review = json.loads((OUT / 'numeric-transaction-prevalidation-review.json').read_text())
assert pre_review['head'] == HEAD and pre_review['parent'] == PARENT
assert digest(git('show', HEAD + ':internal/records/2026-11-24-sprint4-scene-package-budget.md')) == pre_review['recordSha256']
for handoff in pre_review['handoffs']:
    assert digest((WORKFLOW / handoff['file']).read_bytes()) == handoff['sha256']
handoff_receipts = []
for name in ['budget-to-validate.json', 'validate-to-review.json']:
    data = (WORKFLOW / name).read_bytes()
    value = json.loads(data)
    for artifact in value['artifacts']:
        assert artifact['digest'] == 'sha256:' + digest(Path(artifact['reference']).read_bytes())
    handoff_receipts.append({'file': name, 'sha256': digest(data), 'artifactDigestsMatch': True})
intake = json.loads((WORKFLOW / 'budget-to-validate.json').read_text())
returned = json.loads((WORKFLOW / 'validate-to-review.json').read_text())
assert returned['fromId'] == 'pui-validate' and returned['nextSkillId'] == 'pui-review'
old_artifacts = {v['type']: v for v in intake['artifacts']}
new_artifacts = {v['type']: v for v in returned['artifacts']}
for key in ['capability-envelope', 'authority-map', 'candidate-change', 'implementation-authorization']:
    assert old_artifacts[key] == new_artifacts[key]
assert old_artifacts['evidence-report']['reference'] != new_artifacts['evidence-report']['reference']
assert old_artifacts['evidence-report']['digest'] != new_artifacts['evidence-report']['digest']

old_reds = []
for label, directory, archive, expected in [
    ('implementation', ROOT / 'integration-evidence/canonical-candidate-originals/package-budgets-9fff88cf23d4e55375979bc5c68c033e3deaed38-45262013762-attempt-1-logs',
     ROOT / 'integration-evidence/canonical-candidate-originals.tar.gz',
     '0656c0b1e50f1490e904ab73010194a2f254a3186785ebf13cb8b3cd3741805b'),
    ('prebudget', ROOT / 'integration-evidence/canonical-prebudget-originals',
     ROOT / 'integration-evidence/canonical-prebudget-originals.tar.gz',
     'b2fb242e53637823041b5040ec133c868175b06a360ac6cf7cb9fdd05bac4a02')]:
    assert digest(archive.read_bytes()) == expected
    data = (directory / 'report.json').read_bytes()
    old = json.loads(data)
    assert old['exitCode'] == 1 and old['withinBudgets'] is False and sum(v['pass'] for v in old['results']) == 6
    old_reds.append({'kind': label, 'head': old['source']['head'], 'archiveSha256': expected,
                    'reportSha256': digest(data), 'strictPassed': 6, 'strictTotal': 9, 'exitCode': 1})

result = {
    'schemaVersion': 1,
    'kind': 'independent final exact-head canonical numeric-transaction review',
    'reviewer': '/root/ir10_semantics',
    'head': HEAD, 'parent': PARENT, 'runId': 45269915996, 'attempt': 1,
    'runUrl': 'https://github.com/Proto-UI/Proto-UI/actions/runs/45269915996',
    'disposition': 'adequate for this bounded numerical transaction and its exact-head strict package-budget acceptance',
    'source': source, 'environment': current['environment'], 'measurement': current['measurement'],
    'policy': current['policy'], 'archive': str(ARCHIVE), 'archiveBytes': len(archive_bytes),
    'archiveSha256': EXPECTED_ARCHIVE, 'originals': originals,
    'checks': {
        'allSixOriginalsMatchArchive': True, 'freshExpectedHeadCleanAndStable': True,
        'fullSourceFingerprintRecomputedFromExactGitBlobs': True,
        'sourceFilesChecked': len(inventory), 'uniqueClosureInputsChecked': len(checked_inputs),
        'allNineArtifactBytesHashesAndClosuresUnchanged': True,
        'bothDiagnosticProfilesExactlyUnchanged': True,
        'onlyThreeBudgetAndPassOverageBlockingFieldsChanged': True,
        'otherSixEntireResultRowsUnchanged': True,
        'environmentMeasurementAndStrictPolicyUnchanged': True,
        'productAndSourceClosureUnchangedAtNumericHead': True,
        'numericCandidateAndOriginalInputsPreserved': True,
        'factualReportRefreshedThroughActualValidationHandoff': True,
        'publicBuild': '47/47', 'manifestCheck': 47, 'measurementControls': '28/28',
    },
    'strictResult': {'passed': 9, 'total': 9, 'exitCode': 0, 'terminal': 'passed'},
    'wholeEntryResults': rows,
    'preservedRedResults': old_reds,
    'handoffs': handoff_receipts,
    'prevalidationReviewSha256': digest((OUT / 'numeric-transaction-prevalidation-review.json').read_bytes()),
    'testsOrBuildsRerunByThisReview': 0,
    'numericEditsMadeByThisReview': False,
    'formalGitHubApproval': False,
    'integrationAuthorizedByThisReceipt': False,
    'overallSprint4Accepted': False,
    'limitations': [
        'This is an independent local technical receipt for the three numeric caps, not a formal platform APPROVE, merge decision, stable-definition activation or entire Sprint 4 acceptance.',
        'Minified/gzip measurements originate from the exact-source canonical Actions run. This audit independently verified original bytes, accounting, source fingerprints and closure identities, without rerunning the package build.',
        'Lightweight CI results, DCO, deployment and platform reviews remain separate conditions; a successful package-budget job does not convert skipped CI jobs into executed passes.',
        'The next formal local packet still needs the canonical review-input, eligibility, packet validation and inspection. No GitHub write is performed here.',
    ],
    'recordedAtUtc': datetime.now(timezone.utc).isoformat(),
}
path = OUT / 'numeric-transaction-final-independent-receipt.json'
path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
print(json.dumps({'receipt': str(path), 'sha256': digest(path.read_bytes()),
                  'checks': result['checks'], 'strictResult': result['strictResult'],
                  'preservedRedResults': old_reds}, indent=2))
