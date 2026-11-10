import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const studyDirectory = 'scripts/analysis/dialog-conformance-study';
export const studyFiles = [
  'plan.json', 'source-variant.mjs', 'vitest.config.mjs', 'oracle.test.ts',
  'run.mjs', 'report.mjs', 'report.test.mjs',
].map((name) => `${studyDirectory}/${name}`);

export function readPlan(root) {
  return JSON.parse(fs.readFileSync(path.join(root, studyDirectory, 'plan.json'), 'utf8'));
}

export function checkInputs(root, plan) {
  for (const [relative, expected] of Object.entries(plan.inputs)) {
    if (sha256(fs.readFileSync(path.join(root, relative))) !== expected)
      throw new Error(`Frozen study input changed: ${relative}. Review a new study revision; preserve old runs.`);
  }
}

export function applyVariant(before, variant) {
  if (!variant.patch) return before;
  const { before: needle, after } = variant.patch;
  const position = before.indexOf(needle);
  if (position < 0 || before.indexOf(needle, position + needle.length) !== -1)
    throw new Error(`Mutation preimage is missing or ambiguous: ${variant.id}`);
  return before.slice(0, position) + after + before.slice(position + needle.length);
}

export function snapshotCell(root, cell, plan, variant) {
  fs.mkdirSync(cell);
  checkInputs(root, plan);
  const inputs = {};
  for (const relative of [...Object.keys(plan.inputs), ...studyFiles]) {
    const bytes = fs.readFileSync(path.join(root, relative));
    const destination = path.join(cell, 'sources', relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes, { flag: 'wx' });
    inputs[relative] = sha256(bytes);
  }
  let mutation = null;
  if (variant.patch) {
    const before = fs.readFileSync(path.join(root, variant.patch.path), 'utf8');
    const after = applyVariant(before, variant);
    const destination = path.join(cell, 'injected', variant.patch.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, after, { flag: 'wx' });
    mutation = { path: variant.patch.path, beforeSha256: sha256(before), afterSha256: sha256(after) };
  }
  const manifest = {
    schemaVersion: 1, studyId: plan.studyId, subjectHead: plan.subjectHead,
    visibility: plan.visibility, variantId: variant.id, kind: variant.kind,
    planSha256: sha256(fs.readFileSync(path.join(root, studyDirectory, 'plan.json'))),
    node: process.version, inputs, mutation,
    sourceScope: 'Declared Dialog subject/check/runner/study inputs, not a full dependency archive or clean-worktree attestation.',
  };
  fs.writeFileSync(path.join(cell, 'cell.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
  return manifest;
}

// Only this Vite process sees the substitution. No source file or Git object is written.
export function sourceVariantPlugin(root, cell, plan, variant) {
  const seen = new Set();
  return {
    name: 'dialog-754-isolated-source-variant',
    enforce: 'pre',
    transform(code, id) {
      if (!variant.patch || id.split('?')[0] !== path.join(root, variant.patch.path)) return null;
      if (sha256(code) !== plan.inputs[variant.patch.path])
        throw new Error(`Unexpected transform input for ${variant.id}`);
      const after = applyVariant(code, variant);
      seen.add(variant.patch.path);
      fs.writeFileSync(path.join(cell, 'transforms.json'), JSON.stringify({
        variantId: variant.id, paths: [...seen], beforeSha256: sha256(code), afterSha256: sha256(after),
        meaning: 'Module transformed; only oracle observations can establish an exercised behavioral effect.',
      }, null, 2));
      return { code: after, map: null };
    },
  };
}
