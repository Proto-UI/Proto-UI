import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [root, output] = process.argv.slice(2);
if (!path.isAbsolute(root ?? '') || !path.isAbsolute(output ?? ''))
  throw new Error('absolute root/output required');
mkdirSync(output, { recursive: false });
const sha = (value) => createHash('sha256').update(value).digest('hex');
const files = [];
for (const base of ['packages/compiler/src', 'packages/core/src', 'packages/hooks/src']) {
  const visit = (directory) => {
    for (const entry of readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else files.push({ path: file, sha256: sha(readFileSync(path.join(root, file))) });
    }
  };
  visit(base);
}
const { compileFile } = await import(
  pathToFileURL(path.join(root, 'packages/compiler/src/compile.ts'))
);
const { checkTargetOperations, TARGET_PROFILES } = await import(
  pathToFileURL(path.join(root, 'packages/compiler/src/targets.ts'))
);
const { OPERATION_RULES } = await import(
  pathToFileURL(path.join(root, 'packages/compiler/src/operations.ts'))
);
const cases = [];
const add = (name, file, carrier) => cases.push({ name, file, carrier });
for (const [name, file] of [
  ['official_button', 'button/button.proto.ts'],
  ['official_label', 'label/root.proto.ts'],
  ['official_input', 'input/root.proto.ts'],
])
  add(name, 'packages/prototypes/base/src/' + file, 'gpui-control-label/consumer.rs');
add(
  'official_input_delegate',
  'packages/compiler/test/fixtures/gpui-control-label/input-delegate.proto.ts',
  'gpui-control-label/consumer.rs'
);
for (const stem of [
  'value',
  'activation',
  'host-activation',
  'text',
  'press-modifiers',
  'tab-focus',
  'tab-scope',
])
  add(
    'numeric_' + stem,
    'packages/compiler/test/fixtures/gpui-a11y-value/' + stem + '.proto.ts',
    'gpui-a11y-value/consumer.rs and sequential_focus.rs'
  );
for (const file of [
  'table/root',
  'table/row',
  'table/cell',
  'table/header-cell',
  'table/caption',
  'image/root',
  'textarea/root',
  'dialog/root',
  'dialog/content',
  'dialog/trigger',
  'scroll-area/root',
  'scroll-area/viewport',
])
  add(
    'original_' + file.replaceAll('/', '_'),
    'packages/prototypes/base/src/' + file + '.proto.ts',
    'unselected original public source; no new native execution asserted'
  );
const result = {
  schemaVersion: 1,
  kind: 'supplemental-source-demand-inventory',
  root,
  compilerFiles: files,
  records: [],
  actualNativeExecution: false,
};
for (const entry of cases) {
  const source = readFileSync(path.join(root, entry.file));
  const start = performance.now();
  const compiled = await compileFile(path.join(root, entry.file), {
    root,
    profile: 'gpui-source-v1',
  });
  const row = {
    ...entry,
    sourceSha256: sha(source),
    sourceBytes: source.length,
    milliseconds: performance.now() - start,
    ok: compiled.ok,
  };
  if (compiled.ok) {
    const demand = checkTargetOperations(compiled.value.ir, TARGET_PROFILES['gpui-source-v1']);
    if (!demand.ok) throw new Error('compiled result failed its own target demand: ' + entry.name);
    row.operations = [...demand.value.operations].sort();
    row.generatedComponentSha256 = sha(compiled.value.output.code);
    row.generatedComponentBytes = Buffer.byteLength(compiled.value.output.code);
    row.sourceClosure = compiled.value.ir.sourceFiles;
    writeFileSync(
      path.join(output, entry.name + '.checked-ir.json'),
      JSON.stringify(compiled.value.ir, null, 2)
    );
    writeFileSync(path.join(output, entry.name + '.rs'), compiled.value.output.code);
  } else row.diagnostics = compiled.diagnostics;
  result.records.push(row);
  console.log(
    JSON.stringify({
      name: entry.name,
      ok: row.ok,
      milliseconds: row.milliseconds,
      operations: row.operations?.length,
      diagnostics: row.diagnostics,
    })
  );
  writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(result, null, 2) + '\n');
}
result.sourceDrift = files.filter(
  (file) => sha(readFileSync(path.join(root, file.path))) !== file.sha256
);
result.sharedOperations = Object.keys(OPERATION_RULES);
result.profileOperations = TARGET_PROFILES['gpui-source-v1'].operations;
result.generatedOperations = [
  ...new Set(result.records.flatMap((row) => row.operations ?? [])),
].sort();
writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(result, null, 2) + '\n');
if (result.sourceDrift.length)
  throw new Error('Source changed during supplemental audit; receipt is not accepted');
console.log(
  JSON.stringify({
    sourceDrift: 0,
    success: result.records.filter((row) => row.ok).length,
    rejected: result.records.filter((row) => !row.ok).length,
    generatedOperations: result.generatedOperations.length,
  })
);
