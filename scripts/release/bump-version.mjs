#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findProtoPackages, getRoot } from './version-utils.mjs';

// publish-single is patch-only by contract — cross-minor releases must go
// through publish-all + VERSION + stamp-version.mjs so all @proto.ui/* packages
// move in lockstep. Keeping a --bump flag here would imply minor is reachable
// from this script, which it intentionally is not.
const args = process.argv.slice(2);
const targets = [];
for (const arg of args) {
  if (arg === '--') continue;
  targets.push(arg);
}

if (targets.length === 0) {
  console.error('bump-version: at least one package name is required');
  process.exit(1);
}

const all = findProtoPackages();
const byName = new Map(all.map((pkg) => [pkg.manifest.name, pkg]));

// Validate every target before touching disk. If anything is wrong, exit before
// any package.json is rewritten — a half-applied bump would leave the workspace
// in a state that check-lockstep cannot interpret cleanly.
const plan = [];
for (const name of targets) {
  const pkg = byName.get(name);
  if (!pkg) {
    console.error(`bump-version: unknown package ${name}`);
    process.exit(1);
  }
  const current = pkg.manifest.version || '';
  const match = current.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    console.error(`bump-version: bad version on ${name}: ${current}`);
    process.exit(1);
  }
  const [, major, minor, patch] = match;
  const next = `${major}.${minor}.${Number(patch) + 1}`;
  plan.push({ pkg, name, current, next });
}

// All targets validated; apply writes.
const bumped = [];
for (const entry of plan) {
  entry.pkg.manifest.version = entry.next;
  writeFileSync(entry.pkg.manifestPath, `${JSON.stringify(entry.pkg.manifest, null, 2)}\n`);
  console.log(`bumped ${entry.name}: ${entry.current} -> ${entry.next}`);
  bumped.push({ name: entry.name, from: entry.current, to: entry.next });
}

const summaryPath = join(getRoot(), 'release-bump.json');
writeFileSync(summaryPath, `${JSON.stringify({ bumped }, null, 2)}\n`);
console.log(`bump-version: wrote summary to ${summaryPath}`);
