import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import {
  analyzeProtoFiles,
  analyzeProtoProgram,
  createProtoProgram,
  PRELUDE_PATH,
  PROTO_TARGETS,
} from '../src/frontend/index.ts';

function fixture(t, files = { 'entry.ts': 'export const value = 1;' }) {
  const directory = mkdtempSync(path.join(tmpdir(), 'proto-frontend-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(directory, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  return {
    directory,
    file: (name = 'entry.ts') => path.join(directory, name),
    analyze: (options = {}) =>
      analyzeProtoFiles({ rootNames: ['entry.ts'], currentDirectory: directory, ...options }),
  };
}

const errors = (result, rule) =>
  result.diagnostics.filter(
    (item) => item.category === 'source-invalid' && (!rule || item.ruleId === rule)
  );

test('real cross-file aliases and reexports bind a transitive helper and invalidate its digest', (t) => {
  const f = fixture(t, {
    'entry.ts': 'import { flag as predicate } from "./public.ts"; if (predicate) {}',
    'public.ts': 'export { ready as flag } from "./helper.ts";',
    'helper.ts': 'export const ready: boolean = true;',
  });
  const first = f.analyze();
  assert.deepEqual(errors(first), []);
  assert.equal(first.sourceClosure.complete, true);
  assert.deepEqual(
    first.sourceClosure.files
      .filter((item) => item.role === 'source')
      .map((item) => path.basename(item.path))
      .sort(),
    ['entry.ts', 'helper.ts', 'public.ts']
  );
  const second = f.analyze({
    sourceOverrides: { [f.file('helper.ts')]: 'export const ready: number = 1;' },
  });
  const diagnostic = errors(second, 'proto/explicit-bool-condition')[0];
  assert.ok(diagnostic);
  assert.equal(diagnostic.location.file, f.file());
  assert.ok(diagnostic.relatedLocations.some((item) => item.file === f.file('helper.ts')));
  assert.notEqual(first.sourceClosure.digest, second.sourceClosure.digest);
  assert.equal(
    first.sourceClosure.files.find((item) => item.path === f.file()).sha256,
    second.sourceClosure.files.find((item) => item.path === f.file()).sha256
  );
  assert.equal(second.sourceValid, false);
});

test('TypeScript paths resolution checks the actual imported helper', (t) => {
  const f = fixture(t, {
    'entry.ts': 'import { predicate } from "@values/check"; if (predicate) {}',
    'shared/check.ts': 'export const predicate = 7;',
  });
  const result = f.analyze({ compilerOptions: { paths: { '@values/*': ['shared/*'] } } });
  assert.equal(result.sourceClosure.complete, true);
  assert.equal(errors(result, 'proto/explicit-bool-condition').length, 1);
  assert.equal(
    result.sourceClosure.resolutions.find((item) => item.specifier === '@values/check')
      .resolvedPath,
    f.file('shared/check.ts')
  );
});

test('NodeNext resolves each import/require use and retains its mode even for the same target file', (t) => {
  const f = fixture(t, {
    'entry.mts': `
      import { flag } from 'chooser';
      import required = require('chooser');
      import { shared } from 'shared-choice';
      import sharedRequired = require('shared-choice');
      if (flag) {}
      const count: number = required.flag;
      const same: boolean = shared && sharedRequired.shared;
    `,
    'node_modules/chooser/package.json': JSON.stringify({
      name: 'chooser',
      type: 'module',
      exports: { import: './import.d.mts', require: './require.d.cts' },
    }),
    'node_modules/chooser/import.d.mts': 'export declare const flag: boolean;',
    'node_modules/chooser/require.d.cts': 'export declare const flag: number;',
    'node_modules/shared-choice/package.json': JSON.stringify({
      name: 'shared-choice',
      exports: { import: './shared.d.ts', require: './shared.d.ts' },
    }),
    'node_modules/shared-choice/shared.d.ts': 'export declare const shared: boolean;',
  });
  const result = f.analyze({
    rootNames: ['entry.mts'],
    compilerOptions: {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
    },
  });
  assert.deepEqual(errors(result), []);
  assert.equal(result.sourceClosure.complete, true);
  const choices = result.sourceClosure.resolutions.filter((item) => item.specifier === 'chooser');
  assert.deepEqual(
    choices.map((item) => [item.resolutionMode, path.basename(item.resolvedPath)]).sort(),
    [
      ['import', 'import.d.mts'],
      ['require', 'require.d.cts'],
    ]
  );
  const shared = result.sourceClosure.resolutions.filter(
    (item) => item.specifier === 'shared-choice'
  );
  assert.equal(new Set(shared.map((item) => item.resolvedPath)).size, 1);
  assert.deepEqual(shared.map((item) => item.resolutionMode).sort(), ['import', 'require']);
});

test('analysis never imports or executes a top-level author module', (t) => {
  const key = '__proto_author_execution_probe__';
  delete globalThis[key];
  const f = fixture(t, {
    'entry.ts': `globalThis.${key} = true; throw new Error('MUST NOT EXECUTE'); export {};`,
  });
  const result = f.analyze();
  assert.equal(globalThis[key], undefined);
  assert.equal(result.analysisComplete, false);
  assert.ok(result.diagnostics.some((item) => item.category === 'compiler-missing'));
});

test('boolean checks cover control flow, negation and the short-circuit predicate', (t) => {
  const f = fixture(t, {
    'entry.ts': `
    if (1) {}
    while (0) {}
    do {} while (NaN);
    for (; 2;) {}
    const choice = 3 ? true : false;
    const inverse = !4;
    const guarded = 5 && true;
    const fallback = 6 || false;
  `,
  });
  const result = f.analyze();
  assert.equal(errors(result, 'proto/explicit-bool-condition').length, 8);
  for (const diagnostic of errors(result, 'proto/explicit-bool-condition')) {
    assert.deepEqual(diagnostic.criterion, ['C-COMPILER-FOUNDATION-0001-VALUES']);
    assert.ok(diagnostic.location.length > 0);
    assert.match(diagnostic.message, /explicit predicate/);
  }
});

test('boolean flags and numeric comparisons including NaN do not require a truthiness rewrite', (t) => {
  const f = fixture(t, {
    'entry.ts': `
    declare const flag: boolean;
    declare const n: number;
    if (flag) {} if (n > 0) {} if (n == n) {} if (NaN == NaN) {}
    const bool = !flag;
    const logical = flag && !flag;
    const conditionalValue = flag && 'kept';
  `,
  });
  const before = readFileSync(f.file(), 'utf8');
  const result = f.analyze();
  assert.deepEqual(errors(result, 'proto/explicit-bool-condition'), []);
  assert.deepEqual(errors(result, 'proto/no-implicit-coercion'), []);
  assert.equal(readFileSync(f.file(), 'utf8'), before);
  assert.equal(result.sourceValid, null);
});

test('number arithmetic and same-domain equality are distinct from implicit conversion', (t) => {
  const f = fixture(t, {
    'entry.ts': `
    declare const n: number; declare const text: string;
    const a = n + 1; const b = text + 'x'; const c = n == n;
    const mixed = n + text;
    const subtract = text - n;
    const unary = +text;
  `,
  });
  const result = f.analyze();
  const coercions = errors(result, 'proto/no-implicit-coercion');
  assert.equal(coercions.length, 3);
  assert.ok(coercions.some((item) => /number and string/.test(item.message)));
  assert.equal(result.sourceValid, false);
});

test('overlapping union equality is not prohibited solely because it uses ==', (t) => {
  const f = fixture(t, {
    'entry.ts':
      'declare const a: string | number; declare const b: string | number; export const same = a == b;',
  });
  const result = f.analyze();
  assert.deepEqual(errors(result, 'proto/no-implicit-coercion'), []);
  assert.ok(
    result.diagnostics.some(
      (item) => item.capabilityKey === 'frontend/equality-domain-compatibility'
    )
  );
  assert.equal(result.sourceValid, null);
});

test('union arithmetic and comparisons remain correlation analysis debt, not invented coercion errors', (t) => {
  const f = fixture(t, {
    'entry.ts': `
      export function duplicate(x: number | string) { return x + x; }
      export function numeric(x: number | string) { return x - 1; }
      export function compare(x: number | string, y: number | string) { return x < y; }
    `,
  });
  const result = f.analyze();
  assert.deepEqual(errors(result), []);
  for (const capabilityKey of [
    'frontend/addition-domains',
    'frontend/numeric-operand-domain',
    'frontend/comparison-domains',
  ]) {
    assert.ok(result.diagnostics.some((item) => item.capabilityKey === capabilityKey));
  }
  assert.equal(result.sourceValid, null);
});

test('text checks resolve the actual String receiver without matching unrelated length or charAt fields', (t) => {
  const f = fixture(t, {
    'entry.ts': `
    const record = { length: 3, charAt(index: number) { return index; } };
    const length = record.length; const number = record.charAt(0);
    const values = [1, 2]; const size = values.length;
    declare const text: string;
    const units = text.length;
    const broken = text.charAt(0);
    const indexed = text[0];
  `,
  });
  const result = f.analyze();
  const textErrors = errors(result, 'proto/text-api');
  assert.equal(textErrors.length, 3);
  assert.ok(textErrors.every((item) => item.location.line >= 6));
  assert.equal(errors(result).filter((item) => item.code.startsWith('PUI_TYPESCRIPT')).length, 0);
});

test('explicit scalar operations stay implementation work instead of an invented text ban', (t) => {
  const f = fixture(t, {
    'entry.ts':
      'declare function scalars(text: string): readonly number[]; for (const scalar of scalars("A🙂")) { const same = scalar == scalar; }',
  });
  const result = f.analyze();
  assert.deepEqual(errors(result, 'proto/text-api'), []);
  assert.equal(result.analysisComplete, false);
  assert.equal(result.sourceValid, null);
});

test('undeclared text methods are not rejected solely by spelling when their semantic effect is unproved', (t) => {
  const f = fixture(t, {
    'entry.ts': `
      declare const text: string;
      text.split(','); text.slice(0, 1); text.substr(0, 1); text.substring(0, 1); text.charCodeAt(0);
    `,
  });
  const result = f.analyze();
  assert.deepEqual(errors(result), []);
  assert.equal(result.sourceValid, null);
  assert.ok(result.diagnostics.filter((item) => item.code === 'PUI_TYPESCRIPT_2339').length >= 5);
});

test('well-formed Unicode literal checks distinguish scalar pairs from lone surrogates', (t) => {
  const f = fixture(t, {
    'entry.ts': String.raw`
    const badHigh = '\uD800';
    const badLow = '\uDC00';
    const scalar = '\uD83D\uDE42';
    const actual = 'A🙂';
  `,
  });
  const result = f.analyze();
  assert.equal(errors(result).filter((item) => item.code === 'PUI_UNICODE_LITERAL').length, 2);
});

test('known user type violations are errors; absent authoring APIs and prelude members are capability debt', (t) => {
  const broken = fixture(t, {
    'entry.ts': 'const name: string = 1; const record = { value: 1 }; record.misspelled;',
  }).analyze();
  assert.equal(broken.sourceValid, false);
  assert.ok(errors(broken).some((item) => item.code === 'PUI_TYPESCRIPT_2322'));
  assert.ok(errors(broken).some((item) => item.code === 'PUI_TYPESCRIPT_2339'));
  const author = fixture(t, {
    'entry.ts': `
    import { definePrototype } from '@proto.ui/core/authoring';
    export const sample = definePrototype({ setup(def) { return def.derive('label', read => read.get('name')); } });
    declare const text: string; text.someFutureScalarOperation();
  `,
  });
  const bound = author.analyze();
  assert.equal(bound.sourceClosure.complete, true);
  assert.equal(bound.sourceValid, false);
  assert.ok(errors(bound).some((item) => item.code === 'PUI_TYPESCRIPT_2322'));
  const absent = author.analyze({
    compilerOptions: { paths: { '@proto.ui/core/authoring': ['./unavailable.d.ts'] } },
  });
  assert.deepEqual(errors(absent), []);
  assert.equal(absent.sourceValid, null);
  assert.equal(absent.sourceClosure.complete, false);
});

for (const type of [
  'number[]',
  'readonly number[]',
  '[number, number]',
  'readonly [number, number]',
  'readonly number[] | readonly string[]',
  'readonly [number] | readonly [number, number]',
  'readonly number[] | readonly [number]',
]) {
  test(`array and tuple prelude members remain capability debt: ${type}`, (t) => {
    const result = fixture(t, {
      'entry.ts': `declare const values: ${type}; values.slice(0, 1);`,
    }).analyze();
    const diagnostics = result.diagnostics.filter((item) => item.code === 'PUI_TYPESCRIPT_2339');
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].category, 'compiler-missing');
    assert.equal(diagnostics[0].ruleId, 'proto/typescript-capability');
    assert.equal(diagnostics[0].severity, 'info');
    assert.deepEqual(errors(result), []);
    assert.equal(result.sourceValid, null);
    assert.equal(result.analysisComplete, false);
  });
}

for (const type of [
  'readonly number[] | { readonly known: number }',
  '{ readonly left: number } | { readonly right: number }',
]) {
  test(`union record member typos remain source-invalid: ${type}`, (t) => {
    const result = fixture(t, {
      'entry.ts': `declare const values: ${type}; values.slice(0, 1);`,
    }).analyze();
    const diagnostics = errors(result);
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].code, 'PUI_TYPESCRIPT_2339');
    assert.equal(diagnostics[0].ruleId, 'proto/typescript-type');
    assert.equal(result.sourceValid, false);
  });
}

test('declared record member typos remain source-invalid with and without a spelling suggestion', (t) => {
  const result = fixture(t, {
    'entry.ts': `
      declare const value: { known: number };
      const present: number = value.known;
      value.typo;
      value.knwon;
    `,
  }).analyze();
  assert.deepEqual(
    errors(result)
      .map((item) => item.code)
      .sort(),
    ['PUI_TYPESCRIPT_2339', 'PUI_TYPESCRIPT_2551']
  );
  assert.ok(errors(result).every((item) => item.ruleId === 'proto/typescript-type'));
  assert.equal(result.sourceValid, false);
});

test('missing source checks and all five target obligations stay explicit after local checks pass', (t) => {
  const result = fixture(t).analyze({ target: 'gpui' });
  assert.equal(result.analysisComplete, false);
  assert.equal(result.sourceValid, null);
  assert.equal(result.selectedTarget, 'gpui');
  assert.deepEqual(Object.keys(result.targets), [...PROTO_TARGETS]);
  assert.ok(Object.values(result.targets).every((target) => target.compilable === false));
  assert.equal(result.diagnostics.filter((item) => item.category === 'backend-missing').length, 5);
  for (const ruleId of ['proto/pure-derivation', 'proto/no-capability-assertion']) {
    assert.ok(
      result.diagnostics.some(
        (item) => item.ruleId === ruleId && item.category === 'compiler-missing'
      )
    );
  }
  for (const diagnostic of result.diagnostics.filter((item) =>
    item.category.endsWith('-missing')
  )) {
    assert.equal(diagnostic.severity, 'info');
    assert.ok(diagnostic.capabilityKey);
    assert.match(diagnostic.trackingRef, /\/pull\/1915$/);
  }
});

test('missing transitive source and missing roots cannot yield a complete closure', (t) => {
  const f = fixture(t, { 'entry.ts': 'import { value } from "./missing.ts"; export { value };' });
  const result = f.analyze();
  assert.equal(result.sourceClosure.complete, false);
  assert.ok(result.sourceClosure.missing.some((item) => item.specifier === './missing.ts'));
  assert.equal(result.sourceValid, null);
  const unavailable = f.analyze({ rootNames: ['absent.ts'] });
  assert.equal(unavailable.sourceClosure.complete, false);
  assert.ok(unavailable.sourceClosure.missing.some((item) => item.path === f.file('absent.ts')));
});

test('finding an author error before an unavailable dependency retains false/incomplete', (t) => {
  const f = fixture(t, { 'entry.ts': 'import "./absent.ts"; if (7) {}' });
  const result = f.analyze();
  assert.equal(result.sourceValid, false);
  assert.equal(result.analysisComplete, false);
  assert.equal(result.sourceClosure.complete, false);
});

test('client options cannot inject ambient Node or DOM declarations', (t) => {
  const f = fixture(t, { 'entry.ts': 'document.body; process.exit(0); export {};' });
  const program = createProtoProgram({
    rootNames: [f.file()],
    currentDirectory: f.directory,
    compilerOptions: {
      noLib: false,
      types: ['node'],
      lib: ['lib.dom.d.ts'],
      typeRoots: ['/ambient/types'],
    },
  });
  assert.equal(program.getCompilerOptions().noLib, true);
  assert.deepEqual(program.getCompilerOptions().types, []);
  assert.deepEqual(program.getCompilerOptions().typeRoots, []);
  assert.equal(program.getCompilerOptions().lib, undefined);
  assert.deepEqual(
    program
      .getSourceFiles()
      .map((file) => file.fileName)
      .sort(),
    [PRELUDE_PATH, f.file()].sort()
  );
  const result = analyzeProtoProgram(program);
  assert.deepEqual(errors(result), []);
  assert.ok(result.diagnostics.some((item) => /Cannot find name 'document'/.test(item.message)));
});

test('individual strict flags cannot weaken the controlled checking semantics', (t) => {
  const f = fixture(t, {
    'entry.ts':
      'declare const maybe: boolean | null; if (maybe) {} function forward(value) { return value; }',
  });
  const flags = [
    'strictNullChecks',
    'noImplicitAny',
    'noImplicitThis',
    'strictFunctionTypes',
    'strictBindCallApply',
    'strictPropertyInitialization',
    'strictBuiltinIteratorReturn',
    'alwaysStrict',
    'useUnknownInCatchVariables',
  ];
  const program = createProtoProgram({
    rootNames: [f.file()],
    currentDirectory: f.directory,
    compilerOptions: Object.fromEntries(flags.map((flag) => [flag, false])),
  });
  for (const flag of flags) assert.equal(program.getCompilerOptions()[flag], true, flag);
  const result = analyzeProtoProgram(program);
  assert.equal(errors(result, 'proto/explicit-bool-condition').length, 1);
  assert.ok(result.diagnostics.some((item) => item.code === 'PUI_TYPESCRIPT_7006'));
});

test('noCheck cannot suppress the controlled frontend type diagnostics', (t) => {
  const f = fixture(t, { 'entry.ts': 'export const label: string = 1;' });
  const program = createProtoProgram({
    rootNames: [f.file()],
    currentDirectory: f.directory,
    compilerOptions: { noCheck: true },
  });
  assert.equal(program.getCompilerOptions().noCheck, false);
  const result = analyzeProtoProgram(program);
  assert.equal(result.sourceValid, false);
  assert.ok(errors(result).some((item) => item.code === 'PUI_TYPESCRIPT_2322'));
  assert.equal(result.sourceClosure.compilerOptions.noCheck, false);
});

test('explicit ambient reference directives remain unresolved and do not import declarations', (t) => {
  const f = fixture(t, { 'entry.ts': '/// <reference types="node" />\nprocess.exit(0);' });
  const result = f.analyze();
  assert.equal(result.sourceClosure.complete, false);
  assert.ok(result.sourceClosure.missing.some((item) => item.specifier === 'node'));
  assert.ok(result.sourceClosure.files.every((item) => !item.path.includes('@types/node')));
});

test('reference paths and lib directives cannot bypass the controlled environment or hide missing dependencies', (t) => {
  const ambient = path.join(
    path.dirname(ts.getDefaultLibFilePath({ target: ts.ScriptTarget.ESNext })),
    'lib.dom.d.ts'
  );
  const f = fixture(t, {
    'entry.ts': `/// <reference path="${ambient}" />\n/// <reference path="./absent.d.ts" />\n/// <reference lib="dom" />\ndocument.body;`,
  });
  const result = f.analyze();
  assert.equal(result.sourceClosure.complete, false);
  assert.ok(result.sourceClosure.missing.some((item) => item.path === f.file('absent.d.ts')));
  assert.ok(result.sourceClosure.missing.some((item) => item.specifier === 'dom'));
  assert.ok(result.sourceClosure.files.every((item) => item.path !== ambient));
  assert.equal(result.sourceValid, null);
});

test('a Program snapshots nested resolution options instead of accepting later client mutation', (t) => {
  const f = fixture(t, {
    'entry.ts': 'import { value } from "@helper"; export { value };',
    'good.ts': 'export const value = true;',
    'other.ts': 'export const value = 1;',
  });
  const paths = { '@helper': ['good.ts'] };
  const program = createProtoProgram({
    rootNames: [f.file()],
    currentDirectory: f.directory,
    compilerOptions: { paths },
  });
  const before = analyzeProtoProgram(program);
  paths['@helper'][0] = 'other.ts';
  const after = analyzeProtoProgram(program);
  assert.equal(after.sourceClosure.digest, before.sourceClosure.digest);
  assert.equal(
    after.sourceClosure.resolutions.find((entry) => entry.specifier === '@helper').resolvedPath,
    f.file('good.ts')
  );
});

test('source hashes bind original bytes and identical disk/editor snapshots share the semantic digest', (t) => {
  const source = 'export const value = "A🙂";\r\n';
  const f = fixture(t, { 'entry.ts': source });
  const disk = f.analyze();
  const hash = createHash('sha256').update(readFileSync(f.file())).digest('hex');
  assert.equal(disk.sourceClosure.files.find((item) => item.path === f.file()).sha256, hash);
  const editor = f.analyze({ sourceOverrides: { [f.file()]: source } });
  assert.equal(editor.sourceClosure.digest, disk.sourceClosure.digest);
  const changed = f.analyze({ sourceOverrides: { [f.file()]: source.replace('\r\n', '\n') } });
  assert.notEqual(changed.sourceClosure.digest, disk.sourceClosure.digest);
  assert.equal(changed.sourceClosure.configurationHash, disk.sourceClosure.configurationHash);
  const react = f.analyze({ target: 'react' });
  const gpui = f.analyze({ target: 'gpui' });
  assert.equal(react.sourceClosure.digest, gpui.sourceClosure.digest);
  assert.notEqual(react.analysisConfigurationHash, gpui.analysisConfigurationHash);
});

test('resolution probes preserve virtual editor files and directories without changing identical saved input', (t) => {
  const f = fixture(t, {
    'entry.ts': 'import { flag } from "./unsaved/helper"; if (flag) {}',
  });
  const helper = f.file('unsaved/helper.ts');
  const source = 'export const flag: boolean = true;';
  const editor = f.analyze({ sourceOverrides: { [helper]: source } });
  assert.deepEqual(errors(editor), []);
  assert.equal(editor.sourceClosure.complete, true);
  assert.ok(
    editor.sourceClosure.resolutionProbes.some(
      (probe) => probe.kind === 'file' && probe.path === helper && probe.exists
    )
  );
  assert.ok(
    editor.sourceClosure.resolutionProbes.some(
      (probe) => probe.kind === 'directory' && probe.path === path.dirname(helper) && probe.exists
    )
  );
  assert.equal(
    new Set(editor.sourceClosure.resolutionProbes.map((probe) => `${probe.kind}:${probe.path}`))
      .size,
    editor.sourceClosure.resolutionProbes.length
  );
  mkdirSync(path.dirname(helper));
  writeFileSync(helper, source);
  const disk = f.analyze();
  assert.equal(disk.sourceClosure.digest, editor.sourceClosure.digest);
});

test('diagnostic spans use one-based TypeScript UTF-16 positions', (t) => {
  const source = 'const label = "🙂"; if (1) {}';
  const result = fixture(t, { 'entry.ts': source }).analyze();
  const diagnostic = errors(result, 'proto/explicit-bool-condition')[0];
  assert.equal(diagnostic.location.line, 1);
  assert.equal(diagnostic.location.column, source.indexOf('(1)') + 2);
  assert.equal(diagnostic.location.length, 1);
});

test('uncontrolled editor Programs must be rebuilt through the Proto factory', (t) => {
  const f = fixture(t);
  const foreign = ts.createProgram([f.file()], { noEmit: true });
  assert.throws(() => analyzeProtoProgram(foreign), /ambient editor Programs/);
  assert.throws(
    () => createProtoProgram({ rootNames: [], sourceOverrides: { 'relative.ts': 'export {};' } }),
    /absolute paths/
  );
});
