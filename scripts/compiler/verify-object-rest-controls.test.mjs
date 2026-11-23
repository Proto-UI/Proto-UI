import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { annotateFrozenLiteral } from './verify-object-rest-controls.mjs';

test('an additive explicit annotation removes only the literal write error and leaves JavaScript unchanged', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'proto-rest-control-'));
  try {
    const file = path.join(directory, 'independent-control.ts');
    const source = `export function observe(){const retained={value:5};const frozen=Object.freeze({count:3,nested:retained});const {...copy}=frozen;copy.count=13;return [frozen.count,copy.count,copy.nested===retained];}`;
    await writeFile(file, source);
    const options = {
      strict: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2022,
      skipLibCheck: true,
      types: [],
    };
    const before = ts.createProgram([file], options);
    const diagnostic = ts.getPreEmitDiagnostics(before);
    assert.equal(diagnostic.length, 1);
    assert.equal(diagnostic[0].code, 2322);
    const control = annotateFrozenLiteral(before, before.getSourceFile(file));
    assert.equal(
      await readFile(file, 'utf8'),
      source,
      'The function must not edit the original file.'
    );
    const afterFile = path.join(directory, 'additive-control.ts');
    await writeFile(afterFile, control.source);
    assert.deepEqual(ts.getPreEmitDiagnostics(ts.createProgram([afterFile], options)), []);
    const emit = (text) =>
      ts.transpileModule(text, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
      }).outputText;
    assert.equal(emit(source), emit(control.source));
    assert.match(control.edit.annotation, /Readonly/);
    assert(!control.source.includes('ts-ignore'));
    assert(!control.source.includes(' as '));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
