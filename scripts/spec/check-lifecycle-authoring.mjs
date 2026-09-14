#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { specVersionSchema, validateSpecEntity } from '@proto.ui/spec-schema';
import {
  checkSpecActiveTestMappings,
  checkSpecLifecycleAuthoring,
  getSpecLifecycleReport,
} from '@proto.ui/spec-engine';
import { loadSpecWorkspaceFromDirectory } from '@proto.ui/spec-engine/node';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const args = process.argv.slice(2).filter((arg) => arg !== '--');
if (args.length !== 2 || args[0] !== '--base')
  throw new Error('Usage: pnpm check:spec-authoring -- --base <commit>');
const currentVersion = specVersionSchema.parse(
  readFileSync(path.join(root, 'VERSION'), 'utf8').trim()
);
const git = (args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });
const base = git(['rev-parse', '--verify', '--end-of-options', `${args[1]}^{commit}`]).trim();
const paths = [
  ...git(['diff', '--no-renames', '--name-only', '-z', base, '--', 'spec', 'VERSION']).split('\0'),
  ...git(['ls-files', '--others', '--exclude-standard', '-z', '--', 'spec']).split('\0'),
].filter((file) => file === 'VERSION' || /^spec\/.+\.ya?ml$/.test(file));
if (paths.length === 0) {
  console.log(`[spec-authoring] No changed catalog inputs against ${base}`);
  process.exit(0);
}
// Match by identity, so moving a legacy entity does not invent a new lifecycle.
const previous = new Map();
for (const entry of git(['ls-tree', '-r', '-z', base, '--', 'spec']).split('\0')) {
  const separator = entry.indexOf('\t');
  const file = entry.slice(separator + 1);
  if (!/^100(644|755) blob /.test(entry) || !/^spec\/.+\.ya?ml$/.test(file)) continue;
  const entity = validateSpecEntity(parse(git(['show', `${base}:${file}`])));
  previous.set(entity.id, entity);
}
const workspace = await loadSpecWorkspaceFromDirectory(path.join(root, 'spec'));
const current = new Map(
  workspace.files.map(({ entity, filePath }) => [
    entity.id,
    { entity, file: path.relative(root, filePath) },
  ])
);
const mappingIssues = workspace.issues.length
  ? []
  : checkSpecActiveTestMappings(getSpecLifecycleReport(workspace, currentVersion));
const issues = [
  ...workspace.issues.map((issue) => `${issue.filePath}: ${issue.message}`),
  ...mappingIssues.map((issue) => `${issue.entityId}: ${issue.code}: ${issue.message}`),
  ...[...current.values()].flatMap(({ entity, file }) =>
    checkSpecLifecycleAuthoring(previous.get(entity.id), entity, workspace, currentVersion).map(
      (issue) => `${file}: ${issue}`
    )
  ),
];
for (const [id, entity] of previous) {
  if (!current.has(id))
    issues.push(...checkSpecLifecycleAuthoring(entity, undefined, workspace, currentVersion));
}
if (issues.length) {
  issues.forEach((issue) => console.error(`[spec-authoring] ${issue}`));
  process.exitCode = 1;
} else
  console.log(`[spec-authoring] ${paths.length} changed catalog inputs checked against ${base}`);
