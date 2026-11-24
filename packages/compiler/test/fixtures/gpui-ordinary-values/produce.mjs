// Actual source -> public parser/checked IR -> native emitter. No emitted Rust is patched.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { parsePrototype } from '../../../src/parser.ts';
import { emitGpuiSource } from '../../../src/gpui-source.ts';
import { compileFile } from '../../../src/compile.ts';

const fixture = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(fixture, '../../../../..');
const output = process.argv[2];
if (!output || !path.isAbsolute(output) || existsSync(output))
  throw new Error('Provide a fresh absolute output directory.');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const receipt = {
  schemaVersion: 1,
  kind: 'actual-generated-native-consumers',
  sources: [],
  modules: [],
};
const sourceFiles = Object.fromEntries(
  ['as-transition.proto.ts', 'machine.ts', 'types.ts'].map((name) => {
    const file = `packages/prototypes/base/src/transition/${name}`;
    const contents = readFileSync(path.join(repository, file), 'utf8');
    receipt.sources.push({ path: file, sha256: digest(contents) });
    return [`transition/${name}`, contents];
  })
);
const transition = (cold) =>
  `import {definePrototype} from '@proto.ui/core';import {asTransition} from './transition/as-transition.proto';export default definePrototype({name:'actual-native-transition',setup(def){const first=asTransition();const second=asTransition();def.expose.value('sameHandle',first===second);${cold ? 'first.configure({coldEntryPreparation:true});' : ''}return r=>r.el('div','transition');}});`;
function emit(name, source, files = {}, exportName = 'default', options = {}) {
  const parsed = parsePrototype(source, {
    fileName: options.fileName ?? `${name}.proto.ts`,
    files,
    exportName,
  });
  if (!parsed.ok) throw new Error(`${name} parser: ${JSON.stringify(parsed.diagnostics)}`);
  const module = emitGpuiSource(parsed.value, {
    ...(name === 'transition' ? {} : { nativeSdkPath: '../transition/.proto-ui/gpui-native' }),
    ...(options.componentName ? { componentName: options.componentName } : {}),
  });
  if (!module.ok) throw new Error(`${name} emitter: ${JSON.stringify(module.diagnostics)}`);
  return retainModule(name, source, parsed.value, module.value);
}
function retainModule(name, source, ir, module) {
  const directory = path.join(output, name);
  const artifacts = [
    { path: 'Component.rs', contents: module.code },
    ...(module.supportingFiles ?? []),
  ];
  for (const file of artifacts) {
    const target = path.join(directory, file.path);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, file.contents);
  }
  writeFileSync(path.join(directory, 'checked-ir.json'), JSON.stringify(ir, null, 2));
  writeFileSync(path.join(directory, 'authored.proto.ts'), source);
  const manifest = readFileSync(path.join(directory, 'Cargo.toml'), 'utf8');
  const generatedPackageName = /^\s*name\s*=\s*"([^"]+)"/m.exec(manifest)?.[1];
  if (!generatedPackageName) throw new Error(`Missing generated package name for ${name}`);
  // Stable names belong to this consumer composition, so its checked-in Cargo
  // dependency lock survives changes to generated source fingerprints. Keep the
  // complete original manifest; no emitted Rust or SDK dependency is patched.
  const packageName = `proto-ui-gpui-consumer-${name.replaceAll('_', '-')}`;
  copyFileSync(path.join(directory, 'Cargo.toml'), path.join(directory, 'Cargo.toml.generated'));
  writeFileSync(
    path.join(directory, 'Cargo.toml'),
    manifest.replace(
      /^(\s*name\s*=\s*)"[^"]+"/m,
      (_match, prefix) => prefix + JSON.stringify(packageName)
    )
  );
  receipt.modules.push({
    name,
    packageName,
    generatedPackageName,
    sourceSha256: digest(source),
    contextIds: ir.contextKeys.map((key) => key.id),
    inputs: ir.sourceFiles.map(({ file, sha256 }) => ({ file, sha256 })),
    files: artifacts.map((file) => ({
      path: file.path,
      sha256: digest(file.contents),
      bytes: Buffer.byteLength(file.contents),
    })),
  });
  return packageName;
}
emit('transition', transition(false), sourceFiles);
const dependencies = [];
receipt.actualControlLabelConsumers = [];
for (const [name, file] of [
  ['base_button', 'button/button.proto.ts'],
  ['base_toggle', 'toggle/toggle.proto.ts'],
  ['base_label', 'label/root.proto.ts'],
]) {
  const entry = `packages/prototypes/base/src/${file}`;
  const source = readFileSync(path.join(repository, entry), 'utf8');
  const result = await compileFile(path.join(repository, entry), {
    root: repository,
    profile: 'gpui-source-v1',
    nativeSdkPath: '../transition/.proto-ui/gpui-native',
  });
  if (!result.ok) throw new Error(`${name}: ${JSON.stringify(result.diagnostics)}`);
  dependencies.push([name, retainModule(name, source, result.value.ir, result.value.output)]);
  receipt.actualControlLabelConsumers.push({ name, entry, sha256: digest(source) });
}
const namedButtonEntry = path.join(fixture, 'control-label-name.proto.ts');
const namedButton = await compileFile(namedButtonEntry, {
  root: repository,
  profile: 'gpui-source-v1',
  nativeSdkPath: '../transition/.proto-ui/gpui-native',
});
if (!namedButton.ok) throw new Error(`named_button: ${JSON.stringify(namedButton.diagnostics)}`);
dependencies.push([
  'named_button',
  retainModule(
    'named_button',
    readFileSync(namedButtonEntry, 'utf8'),
    namedButton.value.ir,
    namedButton.value.output
  ),
]);
const genericEntry = path.join(fixture, 'control-label-generic.proto.ts');
for (const [name, exportName] of [
  ['generic_label', 'default'],
  ['generic_setup_label', 'SetupLabel'],
  ['generic_label_target', 'Target'],
]) {
  const result = await compileFile(genericEntry, {
    root: repository,
    profile: 'gpui-source-v1',
    nativeSdkPath: '../transition/.proto-ui/gpui-native',
    exportName,
  });
  if (!result.ok) throw new Error(`${name}: ${JSON.stringify(result.diagnostics)}`);
  dependencies.push([
    name,
    retainModule(name, readFileSync(genericEntry, 'utf8'), result.value.ir, result.value.output),
  ]);
}
for (const name of ['ordinary', 'plain', 'validation', 'roundtrip', 'scalars'])
  dependencies.push([
    name,
    emit(name, readFileSync(path.join(fixture, `${name}.proto.ts`), 'utf8')),
  ]);
const externalScrollEntry = path.join(fixture, 'external-scroll.proto.ts');
const externalScroll = await compileFile(externalScrollEntry, {
  root: repository,
  profile: 'gpui-source-v1',
  nativeSdkPath: '../transition/.proto-ui/gpui-native',
});
if (!externalScroll.ok)
  throw new Error(`external_scroll: ${JSON.stringify(externalScroll.diagnostics)}`);
dependencies.push([
  'external_scroll',
  retainModule(
    'external_scroll',
    readFileSync(externalScrollEntry, 'utf8'),
    externalScroll.value.ir,
    externalScroll.value.output
  ),
]);
dependencies.push([
  'scroll_reader',
  emit('scroll_reader', readFileSync(path.join(fixture, 'scroll-reader.proto.ts'), 'utf8')),
]);
dependencies.push([
  'composed_scroll',
  emit('composed_scroll', readFileSync(path.join(fixture, 'composed-scroll.proto.ts'), 'utf8')),
]);
dependencies.push([
  'public_mutation',
  emit('public_mutation', readFileSync(path.join(fixture, 'public-mutation.proto.ts'), 'utf8')),
]);
const hookOnceSource = readFileSync(path.join(fixture, 'hook-once.proto.ts'), 'utf8');
for (const [name, exportName] of [
  ['hook_pending', 'default'],
  ['hook_failed', 'Failed'],
  ['hook_undefined', 'UndefinedProjection'],
  ['hook_project_failed', 'FailedProjection'],
])
  dependencies.push([name, emit(name, hookOnceSource, {}, exportName)]);
const hookOptionsSource = readFileSync(path.join(fixture, 'hook-options.proto.ts'), 'utf8');
for (const [name, exportName] of [
  ['hook_options', 'default'],
  ['hook_options_factory', 'Factory'],
  ['hook_options_multiple', 'Multiple'],
  ['hook_options_nested', 'Nested'],
])
  dependencies.push([name, emit(name, hookOptionsSource, {}, exportName)]);
const conditionalHookSource = readFileSync(path.join(fixture, 'hook-conditional.proto.ts'), 'utf8');
dependencies.push(['hook_conditional', emit('hook_conditional', conditionalHookSource)]);
dependencies.push([
  'hook_conditional_taken',
  emit('hook_conditional_taken', conditionalHookSource, {}, 'Taken'),
]);
dependencies.push([
  'hook_conditional_multiple',
  emit('hook_conditional_multiple', conditionalHookSource, {}, 'Multiple'),
]);
dependencies.push([
  'render_mutation',
  emit('render_mutation', readFileSync(path.join(fixture, 'render-mutation.proto.ts'), 'utf8')),
]);
const focusSource = readFileSync(path.join(fixture, 'focus.proto.ts'), 'utf8');
dependencies.push([
  'validation_retry',
  emit(
    'validation_retry',
    readFileSync(path.join(fixture, 'validation.proto.ts'), 'utf8'),
    {},
    'Retry'
  ),
]);
dependencies.push([
  'duplicate',
  emit('duplicate', readFileSync(path.join(fixture, 'plain.proto.ts'), 'utf8'), {}, 'Duplicate'),
]);
dependencies.push([
  'created_failure',
  emit(
    'created_failure',
    readFileSync(path.join(fixture, 'plain.proto.ts'), 'utf8'),
    {},
    'CreatedFailure'
  ),
]);
dependencies.push(['focus_scope', emit('focus_scope', focusSource)]);
dependencies.push(['focus_target', emit('focus_target', focusSource, {}, 'Target')]);
dependencies.push(['cold', emit('cold', transition(true), sourceFiles)]);
const contextSource = readFileSync(path.join(fixture, 'context.proto.ts'), 'utf8');
dependencies.push([
  'context_a',
  emit('context_a', contextSource, {}, 'Provider', { fileName: 'private/context.proto.ts' }),
]);
dependencies.push([
  'context_b',
  emit('context_b', contextSource, {}, 'Provider', {
    fileName: 'private/context.proto.ts',
    componentName: 'PrivateContext',
  }),
]);
dependencies.push([
  'context_child',
  emit('context_child', contextSource, {}, 'default', { fileName: 'private/context.proto.ts' }),
]);
const contextModules = receipt.modules.filter((module) => module.name.startsWith('context_'));
if (
  !contextModules.every(
    (module) => JSON.stringify(module.contextIds) === JSON.stringify(contextModules[0].contextIds)
  )
)
  throw new Error('Private Context control must collide in source declaration descriptors.');
const original = sourceFiles['transition/machine.ts'];
const mutation = "driver.emit('afterEnter');";
if (original.split(mutation).length !== 2)
  throw new Error('Mutation must select exactly one authored statement.');
const mutated = original.replace(mutation, "driver.emit('beforeLeave');");
dependencies.push([
  'mutant',
  emit('mutant', transition(false), { ...sourceFiles, 'transition/machine.ts': mutated }),
]);
receipt.mutation = {
  path: 'transition/machine.ts',
  before: mutation,
  after: "driver.emit('beforeLeave');",
  originalSha256: digest(original),
  mutantSha256: digest(mutated),
};
const rootManifest = path.join(output, 'transition/Cargo.toml');
writeFileSync(
  rootManifest,
  readFileSync(rootManifest, 'utf8') +
    '\n' +
    dependencies
      .map(
        ([alias, packageName]) =>
          `${alias} = { package = ${JSON.stringify(packageName)}, path = ${JSON.stringify('../' + alias)}, features = ["test-support"] }`
      )
      .join('\n') +
    '\n'
);
mkdirSync(path.join(output, 'transition/tests'));
copyFileSync(path.join(fixture, 'consumer.rs'), path.join(output, 'transition/tests/ordinary.rs'));
copyFileSync(
  path.join(fixture, 'control-label-consumer.rs'),
  path.join(output, 'transition/tests/control_label.rs')
);
copyFileSync(
  path.join(fixture, 'style-mapping-consumer.rs'),
  path.join(output, 'transition/tests/style_mapping.rs')
);
copyFileSync(
  path.join(fixture, 'a11y-activation-consumer.rs'),
  path.join(output, 'transition/tests/a11y_activation.rs')
);
copyFileSync(
  path.join(fixture, 'scroll-pause-consumer.rs'),
  path.join(output, 'transition/tests/scroll_pause.rs')
);
copyFileSync(
  path.join(fixture, 'scroll-reader-consumer.rs'),
  path.join(output, 'transition/tests/scroll_reader.rs')
);
copyFileSync(
  path.join(fixture, 'composed-scroll-consumer.rs'),
  path.join(output, 'transition/tests/composed_scroll.rs')
);
receipt.consumerSha256 = digest(readFileSync(path.join(fixture, 'consumer.rs')));
receipt.controlLabelConsumerSha256 = digest(
  readFileSync(path.join(fixture, 'control-label-consumer.rs'))
);
receipt.styleMappingConsumerSha256 = digest(
  readFileSync(path.join(fixture, 'style-mapping-consumer.rs'))
);
receipt.a11yActivationConsumerSha256 = digest(
  readFileSync(path.join(fixture, 'a11y-activation-consumer.rs'))
);
receipt.scrollPauseConsumerSha256 = digest(
  readFileSync(path.join(fixture, 'scroll-pause-consumer.rs'))
);
receipt.scrollReaderConsumerSha256 = digest(
  readFileSync(path.join(fixture, 'scroll-reader-consumer.rs'))
);
receipt.composedScrollConsumerSha256 = digest(
  readFileSync(path.join(fixture, 'composed-scroll-consumer.rs'))
);
// Independent ECMAScript operator reference. The Rust consumer calls the
// generated authored methods; this file never replaces their implementation.
const scalarInputs = [
  '',
  ' ',
  '\t\r\n',
  '\uFEFF',
  '\uFEFF 16 \u00A0',
  '\u008516',
  '\u180e16',
  '0',
  '-0',
  '+0',
  '16',
  '.5',
  '1.',
  '-.5',
  '+1.5e+2',
  '00016',
  '0x10',
  '0Xff',
  '0b101',
  '0B101',
  '0o17',
  '0O17',
  '+0x10',
  '-0x10',
  '0x',
  '0xg',
  '0b2',
  '0o8',
  '1_000',
  'Infinity',
  '+Infinity',
  '-Infinity',
  'inf',
  'infinity',
  'NaN',
  '1e',
  '1e+',
  '1e9999',
  '-1e-9999',
  '1e-7',
  '1e-6',
  '1e20',
  '1e21',
  '1e23',
  '1000000000000000100',
  '1.2345678901234567e30',
  '2.98023223876953125e-8',
  '-2.98023223876953125e-8',
  '5e-324',
  '1.7976931348623157e308',
  '0x1fffffffffffff',
  '0x20000000000001',
  '0x20000000000003',
  '0x' + 'f'.repeat(256),
  '0b' + '1'.repeat(1025),
];
// Deterministic binary64 controls exercise shortest-decimal halfway choices and
// exponent boundaries independently of the native formatter implementation.
const conversionBits = new DataView(new ArrayBuffer(8));
function addBitPattern(bits) {
  conversionBits.setBigUint64(0, bits);
  const value = conversionBits.getFloat64(0);
  if (Number.isFinite(value)) scalarInputs.push(value + '');
}
for (const bits of [
  0x3e60000000000000n,
  0x42d98144178b5f88n,
  0x42e4a7a3e51977f4n,
  0x42b0bdaba0d41450n,
  0x42bd860541392710n,
]) {
  addBitPattern(bits);
  addBitPattern(bits | (1n << 63n));
}
for (const exponent of [
  -1022, -100, -26, -25, -24, -21, -20, -1, 0, 1, 24, 25, 26, 52, 53, 54, 100, 1023,
]) {
  conversionBits.setFloat64(0, 2 ** exponent);
  const bits = conversionBits.getBigUint64(0);
  for (const offset of [-1n, 0n, 1n]) {
    addBitPattern(bits + offset);
    addBitPattern((bits + offset) | (1n << 63n));
  }
}
let seed = 0x95ab7509b3f3c4a1n;
for (let index = 0; index < 512; index++) {
  seed = BigInt.asUintN(64, seed ^ (seed << 13n));
  seed ^= seed >> 7n;
  seed = BigInt.asUintN(64, seed ^ (seed << 17n));
  addBitPattern(seed);
}
// Execute the unchanged pure fixture in JavaScript as an independent language
// oracle. The stub records public methods only; it implements no compiler atoms.
const scalarSource = readFileSync(path.join(fixture, 'scalars.proto.ts'), 'utf8');
const scalarModule = { exports: {} };
runInNewContext(
  ts.transpileModule(scalarSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText,
  {
    module: scalarModule,
    exports: scalarModule.exports,
    require(id) {
      if (id !== '@proto.ui/core') throw new Error(`Unexpected scalar oracle import ${id}`);
      return { definePrototype: (definition) => definition };
    },
  },
  { filename: 'scalars.proto.ts', timeout: 1000 }
);
const scalarMethods = new Map();
scalarModule.exports.default.setup({
  expose: { method: (name, callback) => scalarMethods.set(name, callback) },
});
function nativeNumberBits(value) {
  if (typeof value === 'number') {
    const bytes = new DataView(new ArrayBuffer(8));
    bytes.setFloat64(0, value);
    return bytes.getBigUint64(0).toString(16);
  }
  if (Array.isArray(value)) return value.map(nativeNumberBits);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, nativeNumberBits(item)])
    );
  return null;
}
const nativeCases = [
  'typedCallable',
  'typedCallable',
  'typedDefaults',
  'numericLiterals',
  'membership',
  'assignment',
  'assignmentFailure',
  'caughtUnits',
].map((method) => {
  const expected = scalarMethods.get(method)();
  return { method, expected, numberBits: nativeNumberBits(expected) };
});
const scalarReference =
  JSON.stringify(
    {
      strings: scalarInputs.map((input) => {
        const value = +input,
          finite = Number.isFinite(value);
        return {
          input,
          numberBits: finite
            ? (() => {
                const bytes = new DataView(new ArrayBuffer(8));
                bytes.setFloat64(0, value);
                return bytes.getBigUint64(0).toString(16);
              })()
            : null,
          expected: {
            finite,
            nan: value !== value,
            negativeZero: value === 0 && 1 / value < 0,
            number: finite ? value : null,
            text: value + '',
          },
        };
      }),
      arithmeticTexts: {
        negativeZero: -0 + '',
        positiveInfinity: 1 / 0 + '',
        negativeInfinity: -1 / 0 + '',
        nan: 0 / 0 + '',
      },
      nativeCases,
    },
    null,
    2
  ) + '\n';
writeFileSync(path.join(output, 'transition/tests/scalar-reference.json'), scalarReference);
receipt.scalarReferenceSha256 = digest(scalarReference);
receipt.scalarReferenceEngine = process.version;
const lockfile = path.join(fixture, 'Cargo.lock');
if (existsSync(lockfile)) {
  copyFileSync(lockfile, path.join(output, 'transition/Cargo.lock'));
  receipt.lockSha256 = digest(readFileSync(lockfile));
}
receipt.consumerManifestSha256 = digest(readFileSync(rootManifest));
// The real Button above is now a positive, unchanged source consumer. Keep the
// explicit native Anatomy limitation as a discriminating negative declaration.
const unsupportedPath =
  'packages/compiler/test/fixtures/gpui-ordinary-values/control-label-anatomy.proto.ts';
const unsupportedResult = await compileFile(path.join(repository, unsupportedPath), {
  root: repository,
  profile: 'gpui-source-v1',
});
if (
  unsupportedResult.ok ||
  !unsupportedResult.diagnostics.some((entry) => entry.code === 'PUI_GPUI_CONTROL_LABEL_ANATOMY')
)
  throw new Error(
    'Native ControlLabel Anatomy admission changed; update its acceptance matrix explicitly.'
  );
receipt.unsupportedConsumers = [
  {
    source: unsupportedPath,
    sha256: digest(readFileSync(path.join(repository, unsupportedPath))),
    diagnostics: unsupportedResult.diagnostics,
  },
];
writeFileSync(path.join(output, 'source-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(
  JSON.stringify({
    output,
    modules: receipt.modules.length,
    mutatedSource: receipt.mutation.mutantSha256,
  })
);
