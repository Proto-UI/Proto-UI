import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parsePrototype } from '../../../src/parser';
import { validateIR } from '../../../src/ir-validation';
import { emitQtSource } from '../../../src/qt-source';
import evidenceContract from './evidence-contract.json';

// This checked-in contract is the acceptance denominator, not the emitted receipt.
export const qtNativeCases: readonly string[] = Object.freeze(evidenceContract.cases);

export function prepareQtNativeConsumer(directory: string) {
  const root = path.resolve(import.meta.dirname, '../../../../..');
  const hash = (contents: string | Buffer) => createHash('sha256').update(contents).digest('hex');
  const files = new Map<string, string>();
  const put = (name: string, contents: string) => {
    const previous = files.get(name);
    if (previous !== undefined && previous !== contents)
      throw new Error(`Conflicting actual Qt artifact: ${name}`);
    files.set(name, contents);
  };
  for (const [name, componentName] of [
    ['scroll', 'Component'],
    ['default', 'TemplateDefault'],
    ['siblings', 'TemplateSiblings'],
    ['empty', 'TemplateEmpty'],
  ]) {
    const source = readFileSync(path.join(import.meta.dirname, `${name}.proto.ts`), 'utf8');
    const parsed = parsePrototype(source, { fileName: `qt-native-${name}.proto.ts` });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const cold = validateIR(JSON.parse(JSON.stringify(parsed.value)));
    if (!cold.ok) throw new Error(JSON.stringify(cold.diagnostics));
    const emitted = emitQtSource(cold.value, { componentName });
    if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
    put(`inputs/${name}.proto.ts`, source);
    put(`ir/${name}.json`, JSON.stringify(cold.value, null, 2) + '\n');
    put(`${componentName}.qml`, emitted.value.code);
    for (const file of emitted.value.supportingFiles ?? []) put(file.path, file.contents);
  }
  put('Consumer.qml', readFileSync(path.join(import.meta.dirname, 'Consumer.qml'), 'utf8'));
  assert.deepEqual([...files.keys()].sort(), [...evidenceContract.artifacts].sort());
  const receipt = {
    schemaVersion: evidenceContract.schemaVersion,
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    scope:
      'Dormant direct Qt emitter; actual parser and cold IR validation; no canonical profile activation',
    qtVersion: evidenceContract.qtVersion,
    expectedCases: qtNativeCases,
    inputs: evidenceContract.inputs.map((file) => {
      const contents = readFileSync(path.join(root, file));
      return { file, bytes: contents.byteLength, sha256: hash(contents) };
    }),
    files: [...files].map(([file, contents]) => ({
      file,
      bytes: Buffer.byteLength(contents),
      sha256: hash(contents),
    })),
  };
  for (const [name, contents] of files) {
    const file = path.join(directory, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, contents, { flag: 'wx' });
  }
  writeFileSync(
    path.join(directory, 'source-receipt.json'),
    JSON.stringify(receipt, null, 2) + '\n',
    {
      flag: 'wx',
    }
  );
  return receipt;
}
