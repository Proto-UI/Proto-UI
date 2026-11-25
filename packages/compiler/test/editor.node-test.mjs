import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { analyzeProtoFiles } from '../src/frontend/index.ts';
import { analyzeProtoDocument } from '../src/editor.ts';

test('editor and CLI-facing analysis share rule results over the same unsaved dependency closure', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'proto-editor-'));
  try {
    const fileName = path.join(cwd, 'entry.proto.ts');
    const helperName = path.join(cwd, 'helper.ts');
    writeFileSync(fileName, 'export const saved: boolean = true;\n');
    writeFileSync(helperName, 'export const count: boolean = true;\n');
    const text =
      "import { count } from './helper';\n// emoji 😀 occupies two UTF-16 editor units\nif (count) {}\n";
    const sourceOverrides = { [helperName]: 'export const count: number = 2;\n' };
    const editor = analyzeProtoDocument({
      fileName,
      text,
      sourceOverrides,
      currentDirectory: cwd,
      target: 'react',
    });
    const direct = analyzeProtoFiles({
      rootNames: [fileName],
      sourceOverrides: { ...sourceOverrides, [fileName]: text },
      currentDirectory: cwd,
      target: 'react',
    });
    assert.deepEqual(editor.analysis, direct);
    const diagnostic = editor.diagnostics.find(
      (item) => item.code === 'proto/explicit-bool-condition'
    );
    assert.ok(diagnostic);
    assert.equal(diagnostic.severity, 1);
    assert.equal(diagnostic.range.start.line, 2);
    assert.equal(diagnostic.range.start.character, 4);
    assert.equal(diagnostic.range.end.line, 2);
    assert.equal(diagnostic.range.end.character, 9);
    assert.equal(diagnostic.data.sourceValid, false);
    assert.equal(diagnostic.data.analysisComplete, false);
    assert.ok(editor.diagnostics.some((item) => item.data.category === 'compiler-missing'));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('an editor noCheck option cannot suppress type errors in its unsaved snapshot', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'proto-editor-no-check-'));
  try {
    const fileName = path.join(cwd, 'entry.proto.ts');
    writeFileSync(fileName, 'export const label: string = "saved";\n');
    const result = analyzeProtoDocument({
      fileName,
      text: 'export const label: string = 1;\n',
      currentDirectory: cwd,
      compilerOptions: { noCheck: true },
    });
    assert.equal(result.analysis.sourceValid, false);
    assert.equal(result.analysis.sourceClosure.compilerOptions.noCheck, false);
    assert.ok(
      result.analysis.diagnostics.some(
        (item) => item.code === 'PUI_TYPESCRIPT_2322' && item.category === 'source-invalid'
      )
    );
    assert.ok(
      result.diagnostics.some(
        (item) => item.code === 'proto/typescript-type' && item.severity === 1
      )
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
