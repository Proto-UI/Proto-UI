#!/usr/bin/env python3
"""Verify retained collaboration receipts without writing GitHub or running tests."""
import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parent
REMOTE = '/tank/shared/projects/proto-ui-agent/sprint4-completion-20261124-1494/'
HEAD = 'c18bf8f8c35a4ec1f69791468a5952c4cb460f41'
sha = lambda b: hashlib.sha256(b).hexdigest()
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo', type=Path)
args = parser.parse_args()
transport = json.loads((ROOT / 'transport.json').read_bytes())
archive = (ROOT / 'originals.tar.gz').read_bytes()
assert len(archive) == transport['bytes'] and sha(archive) == transport['sha256']
manifest_bytes = (ROOT / 'manifest.json').read_bytes()
assert sha(manifest_bytes) == transport['manifestSha256']
manifest = json.loads(manifest_bytes)
members = {}
with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as tar:
    for member in tar.getmembers():
        path = PurePosixPath(member.name)
        assert member.isfile() and not path.is_absolute() and '..' not in path.parts
        assert member.name not in members
        members[member.name] = tar.extractfile(member).read()
assert set(members) == {m['path'] for m in manifest['members']}
assert len(members) == transport['members']
for m in manifest['members']:
    assert len(members[m['path']]) == m['bytes'] and sha(members[m['path']]) == m['sha256']
read = lambda name: json.loads(members[name])
relative = lambda name: name[len(REMOTE):] if name.startswith(REMOTE) else name
recovery = read('github-cli-recovery-v2/compatible-attempt-recovery.json')
assert recovery['outcome'] == 'confirmed-no-write-compatible-new-attempt-prepared'
assert recovery['headSha'] == HEAD and recovery['draft'] is True
assert recovery['fullCommentCount'] == 2 and recovery['externalWrites'] == 0
for m in recovery['boundEvidence']:
    assert len(members[m['path']]) == m['bytes'] and sha(members[m['path']]) == m['sha256']
old = read('final-collaboration-results/journal.json')
assert list(old['operations']) == ['progress-01-cc6f2c5f']
failed = old['operations']['progress-01-cc6f2c5f']
assert failed['state'] == 'halted-unresolved'
failed_dir = relative(failed['directory'])
assert failed_dir + '/receipt.json' not in members
assert b'unknown flag: --slurp' in members[failed_dir + '/apply.stderr.log']
no_write = read('github-cli-recovery-v2/no-write-reconciliation.json')
assert no_write['matches'] == [] and no_write['firstInvocationFailedBeforeWriteDuringReadOnlyCollection']
assert no_write['oldRequestDigest'] == recovery['oldRequestDigest'] == failed['requestDigest']
before = read('final-collaboration-tools/payload.json')
after = read('final-collaboration-tools/payload-compatible-gh.json')
assert [k for k in after if after[k] != before[k]] == ['outputDirectory']
journal = read(after['outputDirectory'] + '/journal.json')
assert journal['headSha'] == HEAD
assert journal['localIntentSha256'] == old['localIntentSha256'] == recovery['localIntentSha256']
assert len(journal['operations']) == 17 and 'ready' in journal['operations']
outcomes = {}
for name, operation in journal['operations'].items():
    assert operation['state'] in ['verified', 'observed-already-present']
    directory = relative(operation['directory'])
    if operation['state'] == 'verified':
        request = read(directory + '/request.json')
        receipt = read(directory + '/receipt.json')
        handoff = read(directory + '/completed-handoff.json')
        assert request['requestDigest'] == receipt['requestDigest'] == operation['requestDigest']
        assert receipt['outcome'] in ['applied', 'no-op'] and receipt['actor'] == 'cyjin-yl'
        expected_verification = 'idempotency-marker-present' if receipt['action'] == 'post-bounded-reconciliation-comment' else 'live-state-matches-desired'
        assert receipt['verification'] == expected_verification
        assert receipt['mutationCount'] == operation['mutationCount']
        assert handoff['fromId'] == 'pui-collaborate' and handoff['nextSkillId'] is None
        assert handoff['executionMode'] == 'human-assisted' and handoff['executionModeSource'] == 'current-user'
        outcomes[receipt['outcome']] = outcomes.get(receipt['outcome'], 0) + 1
        if name == 'ready':
            assert request['target']['headSha'] == HEAD and request['desired']['isDraft'] is False
    else:
        outcomes['observed-already-present'] = outcomes.get('observed-already-present', 0) + 1
readback = read('final-platform-closeout/receipt.json')
assert (ROOT / 'readback.json').read_bytes() == members['final-platform-closeout/receipt.json']
assert readback['headSha'] == HEAD and readback['isDraft'] is False and readback['merged'] is False
assert len(readback['progressComments']) == 13 and len(readback['issues']) == 9
assert readback['journalOperationCount'] == 17
assert readback['journalSha256'] == sha(members[after['outputDirectory'] + '/journal.json'])
assert readback['claims']['allSprint4Complete'] is False and readback['claims']['privateIR10Replayed'] is False
for issue in readback['issues']:
    original = read('final-platform-closeout/issue-' + str(issue['number']) + '.stdout')
    assert original['state'] == issue['state'] == 'open'
    assert sha(original['body'].encode()) == issue['bodySha256']
definitions = json.loads((ROOT / 'public-definition-byte-continuity.json').read_bytes())
assert definitions['targetRevision'] == HEAD and definitions['allSame'] is True
assert len(definitions['definitions']) == 61 and definitions['privateOriginalRead'] is False
source_count = None
if args.repo:
    for d in definitions['definitions']:
        blob = subprocess.check_output(['git', 'show', HEAD + ':' + d['path']], cwd=args.repo)
        assert sha(blob) == d['targetSha256'] == d['comparisonSha256']
    source_count = 61
print(json.dumps({'archiveMembersVerified': len(members), 'journalOperations': 17,
                  'outcomes': outcomes, 'progressCommentsVerified': 13,
                  'issueBodiesVerified': 9, 'readyAtHead': HEAD,
                  'formalReviewCountAtReadback': readback['formalReviewCount'],
                  'oldFailureRetained': True, 'confirmedNoWriteRecovery': True,
                  'publicDefinitionBlobsVerified': source_count,
                  'githubWritesByThisReader': 0, 'testsRunByThisReader': 0}))
