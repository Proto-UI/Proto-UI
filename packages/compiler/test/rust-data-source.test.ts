// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parsePrototype } from '../src/parser';
import { emitRustDataSource, type RustDataModule } from '../src/rust-data-source';
import type { PrototypeIR } from '../src/ir';

const core = `import {definePrototype} from '@proto.ui/core';`;
const source = `${core}
type Phase = 'idle' | 'dragging';
type Input = { phase: Phase; held: boolean };
type Decision = { phase: Phase; consumed: boolean; effects: string[] };
function result(phase: Phase, consumed: boolean, effects: string[]): Decision {
  return { phase, consumed, effects };
}
function decide(input: Input): Decision {
  if (input.held) return result('dragging', true, ['preview', 'commit']);
  return { phase: 'idle', consumed: false, effects: [] };
}
function scale(start: number, delta: number): number { return start + delta * 2; }
function defaults(first: number = 7, last: number): number { return first + last; }
export default definePrototype({ name: 'typed-planner', setup(def) {
  const state = def.state.bool('state', false);
  def.expose.method('decide', decide);
  def.expose.method('scale', scale);
  def.expose.method('defaults', defaults);
  def.expose.method('owned', () => state.get());
  return (r) => r.slot();
}});`;
function checked(text = source): PrototypeIR {
  const parsed = parsePrototype(text);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  return JSON.parse(JSON.stringify(parsed.value));
}
function emitted(text = source, methods = ['decide', 'scale', 'defaults']): RustDataModule {
  const result = emitRustDataSource(checked(text), { methods, crateName: 'typed-data-consumer' });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

const cargo = process.env.PROTO_UI_RUST_DATA_CARGO ?? process.env.CARGO ?? 'cargo';
const cargoAvailable = spawnSync(cargo, ['--version'], { encoding: 'utf8' }).status === 0;
// Cold native linking on macOS can exceed Vitest's 5s JavaScript-test default.
// Keep Cargo consumers mandatory in CI and bound each test explicitly.
const nativeTest = (name: string, run: () => Promise<void>) =>
  it.skipIf(!cargoAvailable && process.env.PROTO_UI_REQUIRE_RUST_DATA_TESTS !== '1')(
    name,
    run,
    60_000
  );
async function native(output: RustDataModule, tests: string): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'proto-rust-data-'));
  try {
    await writeFile(path.join(dir, 'lib.rs'), output.code + '\n' + tests);
    for (const file of output.supportingFiles)
      await writeFile(path.join(dir, file.path), file.contents);
    const run = (args: string[]) => {
      const result = spawnSync(cargo, args, { cwd: dir, encoding: 'utf8', timeout: 60_000 });
      expect(result.error, `${args.join(' ')}: ${result.stderr}`).toBeUndefined();
      expect(result.status, `${args.join(' ')}:\n${result.stdout}\n${result.stderr}`).toBe(0);
      return result.stdout;
    };
    run(['generate-lockfile', '--offline']);
    run(['test', '--locked', '--offline']);
    // This is the resolved graph, with dependencies included, not --no-deps or a lockfile grep.
    const metadata = JSON.parse(
      run(['metadata', '--format-version', '1', '--locked', '--offline'])
    );
    expect(metadata.packages.map((pkg: { name: string }) => pkg.name)).toEqual([
      'typed-data-consumer',
    ]);
    expect(metadata.resolve.nodes).toHaveLength(1);
    expect(metadata.resolve.nodes[0].deps).toEqual([]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('checked Rust data artifacts', () => {
  it('uses native typed fields, enums, direct function calls and only reached support', () => {
    const output = emitted();
    expect(output.dependencies).toEqual([]);
    expect(output.supportingFiles.map((file) => file.path)).toEqual(['Cargo.toml']);
    expect(output.methods.map((method) => method.rustName)).toEqual([
      'decide',
      'scale',
      'defaults',
    ]);
    expect(output.code).toContain('pub enum DecideInputPhase');
    expect(output.code).toContain('pub struct DecideInput');
    expect(output.code).toContain('pub fn scale(argument_0: f64, argument_1: f64)');
    expect(output.code).not.toMatch(
      /enum Value|DataCodec|BTreeMap|serde_json::Value|gpui|Window|Owner|state\.get/
    );
    expect(output.code).not.toContain('ecma_string_number');
    expect(output.code).not.toContain('ecma_number_text');
  });

  it.each(['owned', 'unknown'])(
    'rejects non-independent selected method %s without omitting it',
    (method) => {
      const result = emitRustDataSource(checked(), { methods: ['decide', method] });
      expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI_RUST_DATA_PURITY' }] });
    }
  );

  it.each([
    `let count = 1; function decide(): number { return count; }`,
    `function decide(value: number): number { return decide(value); }`,
    `function decide(): number { const read = () => 2; return read(); }`,
  ])('does not classify mutable, recursive or local-closure code as a pure export: %s', (body) => {
    const parsed = parsePrototype(
      `${core}${body}export default definePrototype({name:'negative',setup(def){def.expose.method('decide',decide)}});`
    );
    if (!parsed.ok) {
      expect(parsed.diagnostics.length).toBeGreaterThan(0);
      return;
    }
    expect(emitRustDataSource(parsed.value, { methods: ['decide'] })).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI_RUST_DATA_PURITY' }],
    });
  });

  it('rejects ambiguous registrations, invalid crate names and colliding selections', () => {
    const ambiguous = source.replace(
      "def.expose.method('scale', scale);",
      "def.expose.method('scale', scale); def.expose.method('scale', scale);"
    );
    expect(emitRustDataSource(checked(ambiguous), { methods: ['scale'] })).toMatchObject({
      ok: false,
    });
    for (const crateName of ['../escape', 'foo"\n[dependencies]', 'self', '-start', 'UPPER'])
      expect(emitRustDataSource(checked(), { methods: ['scale'], crateName })).toMatchObject({
        ok: false,
        diagnostics: [{ code: 'PUI_RUST_DATA_NAME' }],
      });
    expect(emitRustDataSource(checked(), { methods: [] })).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI_RUST_DATA_SELECTION' }],
    });
    expect(emitRustDataSource(checked(), { methods: ['scale', 'scale'] })).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI_RUST_DATA_SELECTION' }],
    });
  });

  it('selects the pure source function explicitly, independently of conditional instance registration', () => {
    const conditional = source.replace(
      "def.expose.method('scale', scale);",
      "if (false) { def.expose.method('scale', scale); }"
    );
    expect(emitted(conditional, ['scale']).methods.map((method) => method.name)).toEqual(['scale']);
  });

  it('revalidates serialized IR before selecting a pure closure', () => {
    const forged = checked();
    forged.schemaVersion = 0 as never;
    expect(emitRustDataSource(forged, { methods: ['scale'] })).toMatchObject({ ok: false });
    const malformed = checked();
    const binding = malformed.moduleBindings!.find(
      (binding) =>
        binding.value.kind === 'function' && binding.value.function.parameters[0]?.name === 'start'
    )!;
    if (binding.value.kind !== 'function') throw new Error('missing scalar fixture');
    binding.value.function.returnType = 'boolean';
    expect(emitRustDataSource(malformed, { methods: ['scale'] })).toMatchObject({ ok: false });
  });

  it('does not select behavior by prototype, file, function or exported method spelling', () => {
    const renamed = source
      .replaceAll('typed-planner', 'unrelated')
      .replaceAll('decide', 'resolveChange')
      .replaceAll('scale', 'adjustValue');
    const output = emitted(renamed, ['resolveChange', 'adjustValue']);
    expect(output.methods.map((method) => method.rustName)).toEqual([
      'resolve_change',
      'adjust_value',
    ]);
    expect(output.code).toContain('pub fn adjust_value(argument_0: f64, argument_1: f64)');
  });

  it('declares numeric-text support only when authored coercion reaches it', () => {
    const numericText = `${core}function format(value:number):string{return 'value='+value;}export default definePrototype({name:'text',setup(def){def.expose.method('format',format)}});`;
    const output = emitted(numericText, ['format']);
    expect(output.dependencies).toEqual([
      { name: 'serde_json', version: '1.0', role: 'language-support' },
    ]);
    expect(output.code).toContain('ecma_number_text');
    expect(output.code).not.toContain('ecma_string_number');
    expect(output.code).not.toContain('DataArray');
  });

  nativeTest(
    'executes typed decisions/defaults/failures and proves the full offline Cargo graph has no GPUI',
    async () => {
      await native(
        emitted(),
        `#[cfg(test)] mod consumer { use super::*;
      #[test] fn typed_trace() {
        let output = decide(DecideInput::new(DecideInputPhase::Idle0, true)).unwrap();
        assert!(matches!(output.phase, DecideInputPhase::Dragging1));
        assert!(output.consumed);
        assert_eq!(output.effects.as_slice(), &["preview", "commit"]);
        let idle = decide(DecideInput::new(DecideInputPhase::Dragging1, false)).unwrap();
        assert!(matches!(idle.phase, DecideInputPhase::Idle0)); assert!(!idle.consumed); assert!(idle.effects.is_empty());
        assert_eq!(scale(0.25, 0.125).unwrap(), 0.5);
        assert_eq!(defaults(None, 4.).unwrap(), 11.);
        assert_eq!(defaults(Some(3.), 4.).unwrap(), 7.);
        assert_eq!(scale(f64::NAN, 0.).unwrap_err(), DataError::NonFiniteNumber);
        assert_eq!(scale(0., f64::MAX).unwrap_err(), DataError::NonFiniteNumber);
      }
    }`
      );
    }
  );

  nativeTest('recompiling a source mutation changes actual Rust behavior', async () => {
    await native(
      emitted(source.replace('delta * 2', 'delta * 7'), ['scale']),
      `#[cfg(test)] mod consumer {use super::*; #[test] fn mutation() { assert_eq!(scale(0.25, 0.125).unwrap(), 1.125); }}`
    );
  });

  nativeTest(
    'preserves binary64, UTF-16 order and reference identity through typed helpers',
    async () => {
      const text = `${core}
      type Input = {value:number;label:string};
      function project(input:Input):{value:number}{return input;}
      function identity(input:Input):boolean{return input === project(input);}
      function arrayIdentity(input:number[]):boolean{const alias=input;return input===alias;}
      function comparison(value:number):boolean{const nan=value/value;return nan<=0;}
      function unicode(first:string,second:string):boolean{return first<second;}
      function inverse(value:number):number{return -value;}
      export default definePrototype({name:'semantics',setup(def){
        def.expose.method('identity',identity);def.expose.method('arrayIdentity',arrayIdentity);
        def.expose.method('comparison',comparison);def.expose.method('unicode',unicode);def.expose.method('inverse',inverse);
      }});`;
      await native(
        emitted(text, ['identity', 'arrayIdentity', 'comparison', 'unicode', 'inverse']),
        `#[cfg(test)] mod consumer {use super::*;
      #[test] fn semantics(){
        assert!(identity(IdentityInput::new(3.,"data".into())).unwrap());
        assert!(array_identity(vec![1.,2.].into()).unwrap());
        assert!(!comparison(0.).unwrap());
        assert!(unicode("\u{10000}".into(),"\u{e000}".into()).unwrap());
        assert!(inverse(0.).unwrap().is_sign_negative());
      }
    }`
      );
    }
  );

  nativeTest(
    'preserves computed undefined defaults and validates optional/literal nested data',
    async () => {
      const text = `${core}
      type Input = {value?:number};
      type Boundary = {tag?:'ok';enabled?:true;numbers:1[]};
      function fallback(value:number|undefined=9):number{return value??77;}
      function forward(input:Input):number {const value=input.value;return fallback(value);}
      function optional(value?:number):number {return fallback(value);}
      function boundary(input:Boundary):number{return input.numbers.length;}
      export default definePrototype({name:'optional',setup(def){
        def.expose.method('forward',forward);def.expose.method('optional',optional);def.expose.method('boundary',boundary);
      }});`;
      await native(
        emitted(text, ['forward', 'optional', 'boundary']),
        `#[cfg(test)] mod consumer {use super::*;
      #[test] fn optional_and_boundary(){
        assert_eq!(forward(ForwardInput::new(None)).unwrap(),9.);
        assert_eq!(forward(ForwardInput::new(Some(3.))).unwrap(),3.);
        assert_eq!(optional(None).unwrap(),9.); assert_eq!(optional(Some(4.)).unwrap(),4.);
        assert_eq!(boundary(BoundaryInput::new(Some("ok".into()),Some(true),vec![1.,1.].into())).unwrap(),2.);
        assert_eq!(boundary(BoundaryInput::new(Some("bad".into()),None,vec![1.].into())).unwrap_err(),DataError::InvalidType("literal"));
        assert_eq!(boundary(BoundaryInput::new(None,None,vec![2.].into())).unwrap_err(),DataError::InvalidType("literal"));
      }
    }`
      );
    }
  );

  nativeTest(
    'applies public defaults to explicit undefined while preserving null and supplied values',
    async () => {
      const text = `${core}
      function fallback(value:number|undefined|null=9):number{return value??77;}
      export default definePrototype({name:'public-default',setup(def){def.expose.method('fallback',fallback)}});`;
      await native(
        emitted(text, ['fallback']),
        `#[cfg(test)] mod consumer {use super::*;
      #[test] fn public_default(){
        assert_eq!(fallback(None).unwrap(),9.);
        assert_eq!(fallback(Some(FallbackValue::Undefined1)).unwrap(),9.);
        assert_eq!(fallback(Some(FallbackValue::Alternative0(3.))).unwrap(),3.);
        assert_eq!(fallback(Some(FallbackValue::Null2)).unwrap(),77.);
      }
    }`
      );
    }
  );

  nativeTest(
    'compares both union operands without shadowing scalar values or record identities',
    async () => {
      const text = `${core}
      type Scalar=number|string; type Reference={value:number}|null;
      function same(a:Scalar,b:Scalar):boolean{return a===b;}
      function different(a:Scalar,b:Scalar):boolean{return a!==b;}
      function sameRecord(a:Reference,b:Reference):boolean{return a===b;}
      function differentRecord(a:Reference,b:Reference):boolean{return a!==b;}
      export default definePrototype({name:'union-equality',setup(def){
        def.expose.method('same',same);def.expose.method('different',different);
        def.expose.method('sameRecord',sameRecord);def.expose.method('differentRecord',differentRecord);
      }});`;
      await native(
        emitted(text, ['same', 'different', 'sameRecord', 'differentRecord']),
        `#[cfg(test)] mod consumer {use super::*;
      #[test] fn union_comparisons(){
        assert!(!same(SameA::Alternative0(1.),SameA::Alternative0(2.)).unwrap());
        assert!(same(SameA::Alternative0(2.),SameA::Alternative0(2.)).unwrap());
        assert!(different(SameA::Alternative1("a".into()),SameA::Alternative1("b".into())).unwrap());
        assert!(!different(SameA::Alternative1("a".into()),SameA::Alternative1("a".into())).unwrap());
        assert!(!same(SameA::Alternative0(1.),SameA::Alternative1("1".into())).unwrap());
        let first=SameRecordA::Alternative0(SameRecordAalternative0::new(1.));
        let other=SameRecordA::Alternative0(SameRecordAalternative0::new(1.));
        assert!(same_record(first.clone(),first.clone()).unwrap());
        assert!(!same_record(first.clone(),other.clone()).unwrap());
        assert!(different_record(first.clone(),other).unwrap());
        assert!(!different_record(first.clone(),first).unwrap());
        assert!(same_record(SameRecordA::Null1,SameRecordA::Null1).unwrap());
      }
    }`
      );
    }
  );

  nativeTest(
    'allocates disjoint public, private, support, record and normalized field names',
    async () => {
      const text = `${core}
      function pui_function_0(value:number):number{return value+1;}
      function ecma_string_number(value:string):number{return +value;}
      function v(ec:{items:number[]}):number{return ec.items.length;}
      function fields(input:{identity:number;identity_689f6a627384:number}):number{return input.identity+input.identity_689f6a627384;}
      export default definePrototype({name:'names',setup(def){
        def.expose.method('pui_function_0',pui_function_0);def.expose.method('ecma_string_number',ecma_string_number);
        def.expose.method('v',v);def.expose.method('fields',fields);
      }});`;
      const output = emitted(text, ['pui_function_0', 'ecma_string_number', 'v', 'fields']);
      const numberName = output.methods[1].rustName;
      const vectorName = output.methods[2].parameters[0].rustType.slice(3, -1);
      await native(
        output,
        `#[cfg(test)] mod consumer {use super::*;
        #[test] fn names(){
          assert_eq!(pui_function_0(3.).unwrap(),4.);
          assert_eq!(${numberName}("0x10".into()).unwrap(),16.);
          assert_eq!(v(${vectorName}::new(vec![1.,2.].into())).unwrap(),2.);
          assert_eq!(fields(FieldsInput::new(3.,7.)).unwrap(),10.);
        }
      }`
      );
    }
  );

  nativeTest('normalizes colliding field names independently of record field order', async () => {
    const text = `${core}
      type Input = {'foo-bar':number;foo_bar:number;identity:number};
      function reorder(input:Input):{identity:number;foo_bar:number;'foo-bar':number}{return input;}
      function select(input:Input):number{return reorder(input).foo_bar;}
      export default definePrototype({name:'fields',setup(def){def.expose.method('select',select)}});`;
    await native(
      emitted(text, ['select']),
      `#[cfg(test)] mod consumer {use super::*;
      #[test] fn fields(){assert_eq!(select(SelectInput::new(3.,7.,11.)).unwrap(),7.);}
    }`
    );
  });
});
