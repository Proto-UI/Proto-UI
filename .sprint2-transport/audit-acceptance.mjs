import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const productDir = path.resolve(process.env.GITHUB_WORKSPACE, 'candidate');
const { SPRINT2_SUITES, summarizeReceipt } = await import(pathToFileURL(path.join(productDir, 'scripts/analysis/run-sprint2-consumers.mjs')).href);
const repository = 'Proto-UI/Proto-UI';
const runId = 45029016292;
const sourceHead = 'f8e7d12ebe64343b8caec71a7f23a6b9761b6ef7';
const sourceTree = 'df8009cd19537fa64c315e6427337d1e3cc24026';
const out = path.join(process.env.RUNNER_TEMP, 'sprint2-acceptance-audit');
mkdirSync(out, { recursive: true });
const api = (endpoint, raw = false) => {
  const value = execFileSync('gh', ['api', endpoint], { encoding: raw ? null : 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return raw ? value : JSON.parse(value);
};
const run = api('repos/' + repository + '/actions/runs/' + runId);
assert.equal(run.head_sha, sourceHead);
assert.equal(run.path, '.github/workflows/projection-family-evidence.yml');
assert.equal(run.event, 'workflow_dispatch');
assert.equal(run.status, 'completed', 'only terminal artifacts may be audited');
const artifacts = api('repos/' + repository + '/actions/runs/' + runId + '/artifacts?per_page=100');
assert.ok(artifacts.total_count <= 100, 'artifact list must be complete');
const expectedName = 'sprint2-consumers-' + sourceHead + '-' + runId;
const matches = artifacts.artifacts.filter(a => a.name === expectedName);
assert.equal(matches.length, 1, 'exactly one expected source-bound artifact');
const artifact = matches[0];
assert.equal(artifact.expired, false);
assert.match(artifact.digest, /^sha256:[0-9a-f]{64}$/);
const zip = api('repos/' + repository + '/actions/artifacts/' + artifact.id + '/zip', true);
const zipDigest = 'sha256:' + createHash('sha256').update(zip).digest('hex');
assert.equal(zipDigest, artifact.digest, 'platform archive digest mismatch');
const zipPath = path.join(out, 'original.zip');
writeFileSync(zipPath, zip);
const extract = path.join(out, 'original');
mkdirSync(extract);
execFileSync('python3', ['-c', [
'import pathlib, sys, zipfile',
'root = pathlib.Path(sys.argv[2]).resolve()',
'with zipfile.ZipFile(sys.argv[1]) as z:',
' for item in z.infolist():',
'  target = (root / item.filename).resolve()',
'  if not target.is_relative_to(root): raise RuntimeError("outside archive root")',
'  if ((item.external_attr >> 16) & 0o170000) == 0o120000: raise RuntimeError("unexpected symlink")',
' z.extractall(root)',
].join('\n'), zipPath, extract], { stdio: 'inherit' });
const walk = dir => readdirSync(dir).flatMap(name => {
  const p = path.join(dir, name);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const files = walk(extract);
const candidates = files.filter(p => path.basename(p) === 'receipt.json').map(p => {
  try { return { path: p, data: JSON.parse(readFileSync(p, 'utf8')) }; } catch { return null; }
}).filter(x => x?.data.kind === 'sprint2-sequential-web-consumer-evidence');
assert.equal(candidates.length, 1);
const receiptPath = candidates[0].path, receipt = candidates[0].data;
const root = path.dirname(receiptPath);
assert.equal(receipt.source.head, sourceHead);
assert.equal(receipt.source.tree, sourceTree);
const expectedSteps = ['public-packages','styles','workspace-types','input','collections','geometry','form-select','ordinary-linked-consumers','compiled-consumers','site','preferences','collapsible','accordion'];
assert.deepEqual(receipt.steps.map(s => s.id), expectedSteps);
assert.ok(receipt.finishedAt, 'queue must have a terminal timestamp');
const evidence = [];
for (const step of receipt.steps) {
  const item = { ...step, failedCases: [] };
  const reportPath = path.join(root, step.id, 'report.json');
  if (files.includes(reportPath)) {
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    const suite = SPRINT2_SUITES.find(s => s.id === step.id);
    if (suite) {
      try {
        item.recomputedSummary = summarizeReceipt(suite, report);
        if (step.summary) assert.deepEqual(item.recomputedSummary, step.summary);
      } catch (error) { item.recomputedReceiptError = String(error); }
    }
    const cases = report.cases ?? report.testResults?.flatMap(f => f.assertionResults ?? []) ?? [];
    item.failedCases = cases.filter(c => c.status !== 'passed' && c.status !== 'pending' && c.status !== 'skipped');
    writeFileSync(path.join(out, step.id + '-report.json'), JSON.stringify(report, null, 2) + '\n');
  }
  if (step.status !== 'passed') {
    const logPath = path.join(root, step.id, 'run.log');
    if (files.includes(logPath)) {
      const log = readFileSync(logPath, 'utf8');
      writeFileSync(path.join(out, step.id + '-original.log'), log);
      console.log('=== ORIGINAL FAILED LOG ' + step.id + ' ===');
      console.log(log.length <= 22000 ? log : log.slice(0, 6000) + '\n[DISPLAY TRUNCATION; complete original retained]\n' + log.slice(-16000));
    }
  }
  evidence.push(item);
}
const screenshots = files.filter(p => /\.(png|jpe?g|webp)$/.test(p)).map(p => {
  const bytes = readFileSync(p);
  return { path: path.relative(root, p), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
});
const audit = { kind:'sprint2-original-artifact-audit', auditedAt:new Date().toISOString(), repository, runId, sourceHead, sourceTree, runConclusion:run.conclusion, artifact:{id:artifact.id,name:artifact.name,digest:zipDigest,bytes:zip.length}, source:receipt.source, environment:receipt.environment, queueStatus:receipt.status, steps:evidence, screenshots };
writeFileSync(path.join(out, 'audit.json'), JSON.stringify(audit, null, 2) + '\n');
writeFileSync(path.join(out, 'original-receipt.json'), readFileSync(receiptPath));
console.log('SPRINT2_AUDIT_JSON_BEGIN');
console.log(JSON.stringify(audit));
console.log('SPRINT2_AUDIT_JSON_END');
console.log('Original queue failures remain failures; this read-only audit does not rerun or accept product tests.');
