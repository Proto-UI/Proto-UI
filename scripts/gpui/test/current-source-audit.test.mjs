import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { register } from 'tsx/esm/api';

test('current GPUI source audit retains a valid unsupported lifecycle and never reports execution', async (t) => {
  const unregister = register();
  const { auditGpuiSource } = await import('../audit-source-lowering.mjs');
  t.after(unregister);
  const directory = mkdtempSync(path.join(tmpdir(), 'gpui-source-audit-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const entry = path.join(directory, 'unchanged.proto.ts');
  const source =
    "import {definePrototype} from '@proto.ui/core'; export default definePrototype({name:'audit-disposal',setup(def){def.lifecycle.onBeforeDispose(()=>{});return r=>r.el('div');}});\n";
  writeFileSync(entry, source);
  const report = auditGpuiSource(entry);
  assert.equal(report.kind, 'gpui-semantic-source-admission');
  assert.equal(report.status, 'UNSUPPORTED');
  assert.equal(report.totals.prototypeDeclarations, 1);
  assert.equal(report.totals.nativeEmittedPrototypes, 0);
  assert.equal(report.totals.executionVerifiedPrototypes, 0);
  assert.equal(report.artifacts.length, 0);
  assert.ok(report.diagnostics.some((issue) => issue.code === 'PUI_GPUI_UNSUPPORTED'));
  assert.equal(report.semanticIR.prototypes[0].lifecycle.length, 1);
  assert.ok(report.sourceInputs.some((input) => input.file === entry));
  assert.equal(readFileSync(entry, 'utf8'), source);
});

test('current GPUI source audit keeps TypeScript errors separate from target unsupported', async (t) => {
  const unregister = register();
  const { auditGpuiSource } = await import('../audit-source-lowering.mjs');
  t.after(unregister);
  const directory = mkdtempSync(path.join(tmpdir(), 'gpui-source-audit-invalid-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const entry = path.join(directory, 'invalid.proto.ts');
  writeFileSync(
    entry,
    "import {definePrototype} from '@proto.ui/core';const broken:number='wrong';export default definePrototype({name:'audit-invalid',setup(){return r=>r.el('div');}});\n"
  );
  const report = auditGpuiSource(entry);
  assert.equal(report.status, 'FAIL');
  assert.equal(report.failureKind, 'invalid-input');
  assert.equal(report.totals.nativeEmittedPrototypes, 0);
  assert.equal(report.totals.executionVerifiedPrototypes, 0);
  assert.equal(report.artifacts.length, 0);
  assert.ok(report.diagnostics.some((issue) => issue.category === 'typecheck'));
});
