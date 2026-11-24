from pathlib import Path
import gzip, hashlib, json, re, shutil, tarfile

base = Path('/home/ezra/.local/state/proto-ui-header-080997012d40')
transfer = Path('/tank/shared/projects/proto-ui/.git/agent-transfers/header-080997012d40')
destination = base / 'evidence-final-staging'
archive = transfer / 'local-evidence-final.tar.gz'
assert not destination.exists(), destination
destination.mkdir()
with tarfile.open(archive, 'r:gz') as bundle:
    for entry in bundle.getmembers():
        path = Path(entry.name)
        assert not path.is_absolute() and '..' not in path.parts
        assert entry.isfile() or entry.isdir()
    bundle.extractall(destination, filter='data')

copied = []

def copy(source, target, compress=False):
    source = base / source
    target = destination / target
    target.parent.mkdir(parents=True, exist_ok=True)
    data = source.read_bytes()
    target.write_bytes(gzip.compress(data, mtime=0) if compress else data)
    copied.append({'originalRelativePath': str(source.relative_to(base)),
                   'evidenceRelativePath': str(target.relative_to(destination)),
                   'originalBytes': len(data), 'originalSha256': hashlib.sha256(data).hexdigest()})

for tag, prefix in [('baseline-06', 'header-baseline'), ('final-4a', 'header-candidate')]:
    copy(prefix + '-graph.json.gz', f'production/{tag}/graph.json.gz')
    copy(prefix + '-graph-report.json', f'production/{tag}/graph-report.json')
copy('baseline-build.log', 'production/baseline-06/build.log.gz', True)
copy('final-candidate-build.log', 'production/final-4a/build.log.gz', True)
copy('final-validation-results.json', 'production/final-4a/validation-results.json')
copy('final-real-vitest.log', 'production/final-4a/real-vitest.log.gz', True)
for source, target, compress in [
    ('candidate-build.log', 'build.log.gz', True),
    ('header-candidate-graph.json.gz', 'graph.json.gz', False),
    ('header-candidate-graph-report.json', 'graph-report.json', False),
    ('validation-results.json', 'validation-results.json', False),
    ('validation-error.txt', 'validation-error.txt', False),
]:
    copy('failed-ssr/' + source, 'production/failed-c554/' + target, compress)
for source, tag in [('baseline-controls', 'baseline-06'), ('final-candidate-controls', 'final-4a')]:
    copy(source + '/result.json', f'browser/{tag}/result.json.gz', True)
copy('baseline-browser/result.json', 'browser/historical-first-smoke/result.json.gz', True)
copy('baseline-focus-probe/result.json', 'browser/historical-focus-probe/result.json.gz', True)
copy('baseline-controls/shadcn-react-menu.png', 'browser/baseline-06/shadcn-react-menu.png')
for name in ['shadcn-react-menu.png', 'brutalist-react-menu.png', 'bootstrap-react-menu.png', 'shadcn-desktop.png', 'concept-card-open.png']:
    copy('final-candidate-controls/' + name, 'browser/final-4a/' + name)
copy('final-package-budgets.json', 'budget/final-package-budgets.json.gz', True)
copy('final-package-budgets-receipt.json', 'budget/final-package-budgets-receipt.json')
copy('final-package-budgets.stderr.log', 'budget/final-package-budgets.stderr.log')
copy('inspect-header-graph.initial.mjs', 'local/scripts/inspect-header-graph.initial.mjs')
for name in ['source-commit-receipt.txt', 'reexport-commit-receipt.txt', 'budget-merge-receipt.txt']:
    copy(name, 'receipts/' + name)
copy('current-main-merge-check.json', 'receipts/current-main-merge-check.json')

(destination / 'remote-layout.json').write_text(json.dumps(copied, indent=2) + '\n')
entries = []
credential_patterns = [r'gh[pousr]_[A-Za-z0-9]{20,}', r'github_pat_[A-Za-z0-9_]{20,}',
                       r'(?i)authorization\s*:\s*bearer\s+\S+',
                       r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
                       r'https?://[^\s/]+:[^\s/@]+@']
findings = []
for path in sorted(destination.rglob('*')):
    if not path.is_file():
        continue
    data = path.read_bytes()
    entry = {'path': str(path.relative_to(destination)), 'bytes': len(data),
             'sha256': hashlib.sha256(data).hexdigest()}
    if path.suffix == '.gz':
        raw = gzip.decompress(data)
        entry.update(uncompressedBytes=len(raw), uncompressedSha256=hashlib.sha256(raw).hexdigest())
    else:
        raw = data
    if path.suffix != '.png':
        text = raw.decode('utf-8', 'replace')
        if any(re.search(pattern, text) for pattern in credential_patterns):
            findings.append(entry['path'])
    entries.append(entry)
assert not findings, findings
(destination / 'manifest.json').write_text(json.dumps({'schemaVersion': 1, 'files': entries}, indent=2) + '\n')
print(json.dumps({'destination': str(destination), 'files': len(entries) + 1,
                  'bytes': sum(e['bytes'] for e in entries),
                  'manifestSha256': hashlib.sha256((destination/'manifest.json').read_bytes()).hexdigest()}, indent=2))
