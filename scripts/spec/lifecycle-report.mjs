#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSpecLifecycleDispositions, getSpecReleases } from '@proto.ui/spec-engine';
import {
  loadSpecLifecycleReport,
  loadSpecWorkspaceFromDirectory,
} from '@proto.ui/spec-engine/node';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
let version;
let out;
let check = false;
let json = false;
let entities;
const args = process.argv.slice(2).filter((arg) => arg !== '--');
for (let index = 0; index < args.length; index++) {
  const arg = args[index];
  if (arg === '--check') check = true;
  else if (arg === '--json') json = true;
  else if (['--version', '--out', '--entities'].includes(arg)) {
    const value = args[++index];
    if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
    if (arg === '--version') version = value;
    if (arg === '--out') out = path.resolve(root, value);
    if (arg === '--entities') {
      entities = value.split(',').map((id) => id.trim());
      if (entities.some((id) => !id))
        throw new Error('--entities requires non-empty comma-separated IDs');
    }
  } else throw new Error(`Unknown argument: ${arg}`);
}
if (entities && !check)
  throw new Error('--entities applies to --check; reports retain the full inventory');
version ??= (await readFile(path.join(root, 'VERSION'), 'utf8')).trim();
const workspace = await loadSpecWorkspaceFromDirectory(path.join(root, 'spec'));
if (workspace.issues.length)
  throw new Error(
    `Cannot report an invalid catalog: ${workspace.issues.map((issue) => issue.message).join('\n')}`
  );
if (!getSpecReleases(workspace).some((release) => release.version === version))
  throw new Error(`No V entity declares ${version}`);
const report = await loadSpecLifecycleReport(root, version, workspace);
const contents = `${JSON.stringify(report, null, 2)}\n`;
if (out) {
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, contents);
}
if (json) process.stdout.write(contents);
else {
  console.log(
    `[lifecycle] current catalog ${version}: ${report.summary.entities} ordinary entities, ${report.summary.drafts} known drafts at this version`
  );
  console.log(
    `[lifecycle] ${report.summary.reviewedDrafts} drafts have dispositions; ${report.unreviewedEntities.length} remain unreviewed`
  );
  console.log(
    `[lifecycle] ${report.summary.legacyActive} non-draft entities lack activation provenance; ${report.summary.unclassifiedBlocks} legacy block targets are unclassified`
  );
  console.log(
    `[lifecycle] ${report.currentCatalogDigest}; recorded evidence is not an execution or admission verdict`
  );
  if (out) console.log(`[lifecycle] report: ${out}`);
}
const issues = check ? checkSpecLifecycleDispositions(report, entities) : report.issues;
if (issues.length) {
  for (const issue of issues)
    console.error(`[lifecycle] ${issue.entityId ?? issue.sliceId ?? version}: ${issue.message}`);
  process.exitCode = 1;
} else if (check && !json)
  console.log(
    `[lifecycle] draft disposition check passed for ${entities ? 'explicit scope' : 'full draft inventory'}; independent admission review is still required`
  );
