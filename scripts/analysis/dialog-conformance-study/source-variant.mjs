import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const studyDirectory = 'scripts/analysis/dialog-conformance-study';
export const studyFiles = [
  'plan.json', 'source-variant.mjs', 'vitest.config.mjs', 'oracle.test.ts',
  'run.mjs', 'report.mjs', 'report.test.mjs', 'source-variant.test.mjs',
].map((name) => `${studyDirectory}/${name}`);

export function readPlan(root) {
  return JSON.parse(fs.readFileSync(path.join(root, studyDirectory, 'plan.json'), 'utf8'));
}

export function checkInputs(root, plan) {
  for (const [relative, expected] of Object.entries(plan.inputs)) {
    if (sha256(fs.readFileSync(path.join(root, relative))) !== expected)
      throw new Error(`Frozen study input changed: ${relative}. Review a new study revision; preserve old runs.`);
  }
  if (plan.checkFreeze) {
    const frozen = JSON.parse(fs.readFileSync(path.join(root, plan.checkFreeze), 'utf8'));
    if (frozen.subjectHead !== plan.subjectHead) throw new Error('Checker freeze subject differs.');
    for (const [relative, expected] of Object.entries(frozen.checkInputs)) {
      const source = fs.readFileSync(path.join(root, relative), 'utf8');
      if (sha256(applyPreparation(source, relative, plan)) !== expected)
        throw new Error(`Executed checker changed after freeze: ${relative}`);
    }
    for (const [relative, expected] of Object.entries(frozen.fixtureInputs)) {
      if (sha256(fs.readFileSync(path.join(root, relative))) !== expected)
        throw new Error(`Subject/fixture changed after freeze: ${relative}`);
    }
    if (plan.heldOutSource) {
      const heldOut = JSON.parse(fs.readFileSync(path.join(root, plan.heldOutSource), 'utf8'));
      if (heldOut.checkFreezeSha256 !== plan.inputs[plan.checkFreeze] ||
          !(Date.parse(heldOut.authoredAt) > Date.parse(frozen.frozenAt)))
        throw new Error('Held-out authorship does not bind the preceding checker freeze.');
      const variants = plan.variants.filter((item) => item.cohort === 'held-out');
      if (JSON.stringify(variants.map(({ cohort, ...variant }) => variant)) !== JSON.stringify(heldOut.variants))
        throw new Error('Held-out variants differ from the independent handoff.');
    }
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

// The repository's early-entry checks stay untouched. Only this experiment
// supplies its explicitly frozen settled-entry precondition before execution.
export function applyPreparation(before, relative, plan) {
  const preparations = (plan.checkPreparations ?? []).filter((item) => item.path === relative);
  if (!preparations.length) return before;
  if (preparations.length !== 1 || !Object.hasOwn(plan.existingSuites, relative))
    throw new Error(`Invalid checker preparation scope: ${relative}`);
  const preparation = preparations[0];
  if (sha256(before) !== preparation.beforeSha256)
    throw new Error(`Checker preparation preimage changed: ${relative}`);
  const after = preparation.replacements.reduce((source, patch, index) =>
    applyVariant(source, { id: `${relative}:preparation:${index}`, patch }), before);
  if (sha256(after) !== preparation.afterSha256)
    throw new Error(`Prepared checker differs from its frozen execution bytes: ${relative}`);
  return after;
}

export function snapshotCell(root, cell, plan, variant) {
  fs.mkdirSync(cell);
  checkInputs(root, plan);
  const inputs = {};
  for (const relative of new Set([...Object.keys(plan.inputs), ...studyFiles])) {
    const bytes = fs.readFileSync(path.join(root, relative));
    const destination = path.join(cell, 'sources', relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes, { flag: 'wx' });
    inputs[relative] = sha256(bytes);
  }
  const preparations = (plan.checkPreparations ?? []).map(({ path: relative }) => {
    const before = fs.readFileSync(path.join(root, relative), 'utf8');
    const after = applyPreparation(before, relative, plan);
    const destination = path.join(cell, 'prepared', relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, after, { flag: 'wx' });
    return { path: relative, beforeSha256: sha256(before), afterSha256: sha256(after) };
  });
  let mutation = null;
  if (variant.patch) {
    if ([...Object.keys(plan.existingSuites), plan.oracleSuite].includes(variant.patch.path))
      throw new Error('Subject variants must not mutate a checker.');
    const before = fs.readFileSync(path.join(root, variant.patch.path), 'utf8');
    const after = applyVariant(before, variant);
    const destination = path.join(cell, 'injected', variant.patch.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, after, { flag: 'wx' });
    mutation = { path: variant.patch.path, beforeSha256: sha256(before), afterSha256: sha256(after) };
  }
  const manifest = {
    schemaVersion: 1, studyId: plan.studyId, subjectHead: plan.subjectHead,
    visibility: plan.visibility, variantId: variant.id, kind: variant.kind, cohort: variant.cohort,
    planSha256: sha256(fs.readFileSync(path.join(root, studyDirectory, 'plan.json'))),
    node: process.version, inputs, mutation, preparations,
    sourceScope: 'Declared Dialog subject/check/runner/study inputs, not a full dependency archive or clean-worktree attestation.',
  };
  fs.writeFileSync(path.join(cell, 'cell.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
  return manifest;
}

// Only this Vite process sees the substitution. No source file or Git object is written.
export function sourceVariantPlugin(root, cell, plan, variant) {
  const seen = new Set();
  const prepared = new Map();
  return {
    name: 'dialog-754-isolated-source-variant',
    enforce: 'pre',
    transform(code, id) {
      const preparation = (plan.checkPreparations ?? []).find((item) => id.split('?')[0] === path.join(root, item.path));
      if (preparation) {
        const after = applyPreparation(code, preparation.path, plan);
        prepared.set(preparation.path, {
          path: preparation.path, beforeSha256: sha256(code), afterSha256: sha256(after),
        });
        fs.writeFileSync(path.join(cell, 'preparations.json'), JSON.stringify({
          variantId: variant.id, files: [...prepared.values()],
          meaning: 'Experiment-only settled-entry precondition; repository early-entry source remains unchanged.',
        }, null, 2));
        return { code: after, map: null };
      }
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
