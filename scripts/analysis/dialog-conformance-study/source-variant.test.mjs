import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { applyPreparation, applyVariant, sha256, sourceVariantPlugin } from './source-variant.mjs';

// Runner integrity controls only; these are not Dialog observations.
const original = 'initialFocus();\npressTab();\n';
const prepared = 'initialFocus();\ncompleteEntry();\npressTab();\n';
const relative = 'checks/example.ts';
const plan = {
  inputs: { [relative]: sha256(original) },
  existingSuites: { [relative]: 1 },
  checkPreparations: [{
    path: relative, beforeSha256: sha256(original), afterSha256: sha256(prepared),
    replacements: [{ before: 'pressTab();', after: 'completeEntry();\npressTab();' }],
  }],
};

test('study preparation preserves the original file and binds the actually transformed checker', (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dialog-preparation-'));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'checks'));
  fs.writeFileSync(path.join(root, relative), original);
  const cell = path.join(root, 'cell');
  fs.mkdirSync(cell);
  const plugin = sourceVariantPlugin(root, cell, plan, { id: 'baseline', patch: null });
  assert.equal(fs.existsSync(path.join(cell, 'preparations.json')), false);
  assert.equal(plugin.transform(original, path.join(root, relative)).code, prepared);
  assert.equal(fs.readFileSync(path.join(root, relative), 'utf8'), original);
  const receipt = JSON.parse(fs.readFileSync(path.join(cell, 'preparations.json'), 'utf8'));
  assert.deepEqual(receipt.files, [{ path: relative, beforeSha256: sha256(original), afterSha256: sha256(prepared) }]);
  assert.equal(plugin.transform('unrelated', path.join(root, 'unrelated.ts')), null);
});

test('changed original source or changed prepared execution bytes cannot silently alter frozen checks', () => {
  assert.throws(() => applyPreparation(`${original}extra();`, relative, plan), /preimage changed/);
  const changed = structuredClone(plan);
  changed.checkPreparations[0].replacements[0].after = 'skipTab();';
  assert.throws(() => applyPreparation(original, relative, changed), /frozen execution bytes/);
  changed.checkPreparations[0].path = 'oracle.ts';
  assert.throws(() => applyPreparation(original, 'oracle.ts', changed), /scope/);
});

test('missing or ambiguous mutation preimages fail before collecting a behavioral result', () => {
  const variant = { id: 'broken', patch: { before: 'target()', after: 'defect()' } };
  assert.throws(() => applyVariant('other()', variant), /missing or ambiguous/);
  assert.throws(() => applyVariant('target(); target()', variant), /missing or ambiguous/);
});
