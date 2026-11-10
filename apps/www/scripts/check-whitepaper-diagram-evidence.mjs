import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readContrastProvenance } from './contrast-provenance.mjs';
import { verifyDiagramBuild } from './whitepaper-diagram-build.mjs';
import { diagramProfiles } from './whitepaper-diagram-evidence-profiles.mjs';
import { diagramSha256, verifyDiagramReport } from './whitepaper-diagram-evidence-receipts.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const directory = process.env.DIAGRAM_EVIDENCE_DIR;
assert.ok(directory && path.isAbsolute(directory), 'An absolute evidence directory is required');
const provenance = readContrastProvenance(root);
assert.equal(provenance.head, process.env.CANDIDATE_SHA, 'Check the actual candidate revision');
const build = await verifyDiagramBuild({ root, directory, revision: provenance.head });
const summary = {
  schemaVersion: 1,
  kind: 'proto-ui.whitepaper-diagram-evidence-receipt',
  revision: provenance.head,
  provenance,
  build,
  captureIntegrity: 'running',
  acceptance: 'pending-independent-review-and-project-gates',
  reports: [],
  failures: [],
  limits: [
    'Capture completeness and byte identity do not approve diagram meaning or visual quality.',
    'Browser accessibility snapshots are not assistive-technology acceptance.',
    'Clean source identity and recorded build bytes are not a hermetic build attestation.',
    'Inventory/provenance review, generation/docs/agent/production checks, exact-head CI and per-commit publication remain separate evidence.',
  ],
};
for (const profile of diagramProfiles()) {
  const relative = `${profile.figure}/metrics.json`;
  try {
    const bytes = await fs.readFile(path.join(directory, relative));
    const report = JSON.parse(bytes);
    const result = await verifyDiagramReport(profile, report, {
      revision: provenance.head,
      provenance,
      build,
      readSource: (filename) => fs.readFile(path.join(root, filename)),
      readScreenshot: (filename) => fs.readFile(path.join(directory, profile.figure, filename)),
    });
    summary.reports.push({ ...result, file: relative, sha256: diagramSha256(bytes) });
  } catch (error) {
    summary.failures.push({ figure: profile.figure, file: relative, error: String(error) });
  }
}
try {
  assert.deepEqual(readContrastProvenance(root), provenance, 'Source changed while checking evidence');
  assert.deepEqual(await verifyDiagramBuild({ root, directory, revision: provenance.head }), build);
} catch (error) {
  summary.failures.push({ stage: 'source-identity', error: String(error) });
}
summary.captureIntegrity = summary.failures.length ? 'failed' : 'passed';
await fs.writeFile(path.join(directory, 'receipt.json'), JSON.stringify(summary, null, 2) + '\n');
assert.deepEqual(summary.failures, [], 'Diagram evidence remains incomplete; see receipt.json');
console.log(`Verified ${summary.reports.length} diagram profiles and their source-bound article, figure and preview captures.`);
