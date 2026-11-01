// v9 static reconstruction: 38 visible historical cases, not a byte-identical v8 file.
// One original case was not recovered. New controls below do not stand in for its unknown semantics.
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { URL as NodeURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { emitGpuiSource } from '../src/gpui-source';
import type { ExpressionIR, GeneratedModule, PrototypeIR } from '../src/ir';

const wrap = (body: string, name = 'unrelated-native-component') =>
  `import {definePrototype,tw} from '@proto.ui/core'; export default definePrototype({name:${JSON.stringify(name)},setup(def){${body}}});`;
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
let recordIndex = 0;
let recordingDirectory: string | undefined;

// Receipt-only opt-in. This never changes product behavior or starts a Rust process.
// A runner must create one fresh empty directory for each subject/run.
type EmissionOptions = NonNullable<Parameters<typeof emitGpuiSource>[1]>;
function emitRecorded(ir: PrototypeIR, options: EmissionOptions = {}) {
  const before = JSON.stringify(ir);
  const optionsBefore = JSON.stringify(options);
  const directory = process.env.PUI_GPUI_EMISSION_ARTIFACTS;
  if (directory && recordingDirectory === undefined) {
    if (
      !isAbsolute(directory) ||
      !lstatSync(directory).isDirectory() ||
      lstatSync(directory).isSymbolicLink()
    )
      throw new Error('Emission recording requires an explicit real absolute directory');
    if (readdirSync(directory).length !== 0)
      throw new Error('Emission recording directory is not fresh');
    recordingDirectory = directory;
  }
  if (directory !== recordingDirectory && recordingDirectory !== undefined)
    throw new Error('Emission recording directory changed during the suite');
  const inputSha256 = digest(before);
  const record = (outcome: unknown) => {
    if (!directory) return;
    const after = JSON.stringify(ir);
    writeFileSync(
      join(directory, `${String(++recordIndex).padStart(3, '0')}-${inputSha256.slice(0, 16)}.json`),
      JSON.stringify(
        {
          inputSha256,
          ir: JSON.parse(before),
          options: JSON.parse(optionsBefore),
          optionsSha256: digest(optionsBefore),
          afterOptionsSha256: digest(JSON.stringify(options)),
          afterInputSha256: digest(after),
          afterIr: JSON.parse(after),
          outcome,
        },
        null,
        2
      ) + '\n',
      { flag: 'wx' }
    );
  };
  let result: ReturnType<typeof emitGpuiSource>;
  try {
    result = emitGpuiSource(ir, options);
  } catch (error) {
    record({
      kind: 'throw',
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
  record({ kind: 'return', result });
  expect(JSON.stringify(ir), 'Emitter must not mutate its exact input IR').toBe(before);
  expect(JSON.stringify(options), 'Emitter must not mutate its exact options').toBe(optionsBefore);
  return result;
}
function parse(body: string, fileName = 'native-template.proto.ts', name?: string): PrototypeIR {
  const parsed = parsePrototype(wrap(body, name), { fileName });
  expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  return parsed.value;
}
function emitIR(ir: PrototypeIR, options: EmissionOptions = {}): GeneratedModule {
  const checked = validateIR(ir);
  expect(checked.ok, JSON.stringify(checked)).toBe(true);
  if (!checked.ok) throw new Error(JSON.stringify(checked.diagnostics));
  const emitted = emitRecorded(ir, options);
  expect(emitted.ok, JSON.stringify(emitted)).toBe(true);
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  return emitted.value;
}
function emit(body: string): GeneratedModule {
  return emitIR(parse(body));
}
function ownerSource(module: GeneratedModule): string {
  const source = module.supportingFiles?.find(
    (file) => file.path === '.proto-ui/gpui-native/src/gpui-native-owner.rs'
  );
  expect(source, 'Actual emitted SDK owner file').toBeDefined();
  if (!source) throw new Error('Missing emitted SDK owner');
  return source.contents;
}
function assertNativeGraph(module: GeneratedModule): void {
  const owner = ownerSource(module);
  expect(module.code).toMatch(/(?:paint_)?native_root\(&snapshot/);
  expect(module.code).not.toContain('paint(&value');
  expect(owner).not.toContain('Value::Template');
  expect(owner).not.toContain('pub struct Node');
  expect(owner).not.toContain('append_template_children');
  expect(owner).not.toContain('valid_template_children');
  expect(owner).toMatch(/projection\s*:\s*Option<NativeSnapshot>/);
  expect(owner).toContain('Value::Renderer(render)=>render(');
}

// These are Rust source-shape checks, not a Rust parser, compiler or runtime oracle.
// Bind temporary names while retaining exact expression tokens and order.
function tokens(code: string): string[] {
  return (
    code.match(
      /"(?:\\.|[^"\\])*"|[A-Za-z_$][A-Za-z_0-9$]*|\d+(?:\.\d+)?|::|===|!==|=>|->|&&|\|\||\S/g
    ) ?? []
  );
}
function oneOrderedBlock(code: string, left: string, right: string, negated: boolean): boolean {
  const actual = tokens(code);
  const expected = tokens(
    `{ let $lhs = ${left}; let $rhs = ${right}; Value::boolean(${negated ? '!' : ''}false) }`
  );
  let found = 0;
  for (let i = 0; i <= actual.length - expected.length; i++) {
    const bindings = new Map<string, string>();
    if (
      expected.every((token, j) => {
        const observed = actual[i + j]!;
        if (!token.startsWith('$')) return token === observed;
        if (bindings.has(token)) return bindings.get(token) === observed;
        if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(observed) || [...bindings.values()].includes(observed))
          return false;
        bindings.set(token, observed);
        return true;
      })
    )
      found++;
  }
  return found === 1;
}

const samples = [
  ['default slot', ''],
  ['missing children', "return r=>r.el('div');"],
  [
    'nested native aliases',
    "return r=>{const child=r.el('span','a');return r.el('section',[child,[child,null],r.slot()]);};",
  ],
  [
    'helper alias',
    "return r=>{const make=()=>r.el('span','child');const alias=make;return r.el('section',[alias(),alias(),r.slot()]);};",
  ],
  [
    'mixed helper return',
    "const count=def.state.numberDiscrete('count',1);return r=>{const choose=()=>{if(count.get()>0)return r.el('span','positive');return 'negative';};return r.el('section',[choose(),r.slot()]);};",
  ],
  [
    'native result observations',
    "const count=def.state.numberDiscrete('count',1);return r=>{const choose=()=>{if(count.get()>0)return r.el('span','positive');return '';};const value=choose();if(!value)return r.el('span','empty');if(value===value)return r.el('span','same');return value;};",
  ],
  [
    'scalar short circuit in dynamic data',
    "const count=def.state.numberDiscrete('count',1);return r=>r.el('section',[count.get()||null,'tail']);",
  ],
  [
    'text-first helper return',
    "const count=def.state.numberDiscrete('count',1);return r=>{const choose=()=>{if(count.get()>0)return 'first';return r.el('span','node');};return choose();};",
  ],
  [
    'captured native value data return',
    "return r=>{const child=r.el('span','x');const empty=()=>child===null;if(empty())return null;return child;};",
  ],
  [
    'captured helper survives parameter shadow',
    "return r=>{const child=r.el('span','captured');const f=()=>child;const g=(child:string)=>f();return g('shadow');};",
  ],
  [
    'node alias identity',
    "return r=>{const n=r.el('span','same');const alias=n;if(n!==alias)return null;if(n===r.el('span','same'))return null;return n;};",
  ],
  [
    'nested zero-formal helper call',
    "return r=>{const child=r.el('span','nested');const inner=()=>child;const outer=()=>inner();return outer();};",
  ],
  [
    'slot helper identity',
    'return r=>{const s=r.slot();const f=()=>s;const alias=f();if(s!==alias)return null;return s;};',
  ],
] as const;

const returned = [
  ['returned helper', "const draw=()=> 'hello';return draw;"],
  ['returned alias', "const draw=()=> 'hello';const alias=draw;return alias;"],
  ['returned factory', "const draw=()=> 'hello';const factory=()=>draw;return factory();"],
  [
    'distinct factory captures',
    "const factory=(text:string)=>{const draw=()=>text;return draw;};const first=factory('first');const second=factory('second');if(first===second)return second;return first;",
  ],
  [
    'call before renderer use',
    "const draw=()=> 'hello';const text=draw();if(text==='hello')return draw;return ()=> 'unexpected';",
  ],
  [
    'branch renderer aliases',
    "const first=()=> 'first';const second=()=> 'second';const choose=def.state.bool('choose',true);if(choose.get())return first;return second;",
  ],
] as const;

const callableObservations = [
  [
    'alias equality',
    "return r=>{const make=()=>r.el('span','x');const alias=make;if(make!==alias)return null;return make();};",
  ],
  [
    'truthiness',
    "return r=>{const make=()=>r.el('span','x');if(!make)return null;if(make)return make();return null;};",
  ],
  [
    'escaped native function identity',
    "return r=>{const make=()=>r.el('span','x');const factory=()=>make;const alias=factory();if(alias!==make)return null;return make();};",
  ],
] as const;

function nativeParameterIr(predicate: boolean): PrototypeIR {
  const source = predicate
    ? "return r=>{const child=r.el('span','x');const helper=()=>child===null;if(helper())return null;return child;};"
    : "return r=>{const child=r.el('span','x');const helper=()=>child;return helper();};";
  const parsed = parsePrototype(wrap(source), { fileName: 'native-parameter-ir-base.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const ir = parsed.value;
  const returned = ir.setup.body.find((statement) => statement.kind === 'return');
  if (returned?.kind !== 'return' || returned.value?.kind !== 'function')
    throw new Error('Expected renderer');
  const render = returned.value.function;
  const helper = render.body.find(
    (statement) => statement.kind === 'const' && statement.name === 'helper'
  );
  if (helper?.kind !== 'const' || helper.value.kind !== 'function')
    throw new Error('Expected helper');
  const fn = helper.value.function;
  fn.parameters = [{ name: 'nativeValue', type: 'template' }];
  const parameter: ExpressionIR = {
    kind: 'reference',
    name: 'nativeValue',
    type: 'template',
    span: fn.span,
  };
  const child: ExpressionIR = { kind: 'reference', name: 'child', type: 'template', span: fn.span };
  if (predicate) {
    fn.body = [
      {
        kind: 'return',
        span: fn.span,
        value: {
          kind: 'binary',
          operator: '===',
          left: parameter,
          right: { kind: 'literal', value: null, type: 'null', span: fn.span },
          type: 'boolean',
          span: fn.span,
        },
      },
    ];
    const branch = render.body.find((statement) => statement.kind === 'if');
    if (branch?.kind !== 'if' || branch.condition.kind !== 'helper-call')
      throw new Error('Expected helper branch');
    branch.condition.arguments = [child];
  } else {
    fn.body = [{ kind: 'return', value: parameter, span: fn.span }];
    const tail = render.body.at(-1);
    if (tail?.kind !== 'return' || tail.value?.kind !== 'helper-call')
      throw new Error('Expected helper return');
    tail.value.arguments = [
      { kind: 'helper-call', name: 'helper', arguments: [child], type: 'template', span: fn.span },
    ];
  }
  return ir;
}

describe('GPUI native snapshot emission (v9 reconstruction, source evidence only)', () => {
  it.each(samples)('%s uses native frame factories, not a template interpreter', (_label, body) => {
    assertNativeGraph(emit(body));
  });

  it('specializes mixed helper returns instead of boxing native nodes in Value', () => {
    const module = emit(samples[4][1]);
    expect(module.code).toMatch(/->\s*(?:native::gpui_native_owner::)?NativeSnapshot/);
    expect(module.code).toContain('NativeSnapshot::text_value');
    expect(module.code).toMatch(/frame\s*:\s*Rc::new/);
    expect(module.code).toContain('gpui::div().id(');
    expect(module.code).not.toContain('Value::NativeSnapshot');
  });

  it('preserves native result truthiness/equality and scalar short-circuit evaluation', () => {
    const observations = emit(samples[5][1]).code;
    expect(observations).toContain('.equals(');
    expect(observations).toContain('.truthy()');
    const scalar = emit(samples[6][1]).code;
    expect(scalar).toContain('let left =');
    expect(scalar).toContain('left.truthy()');
  });

  it('keeps native paint separate from authored projection and preserves stale-commit checks', () => {
    const module = emit(samples[2][1]);
    const owner = ownerSource(module);
    const begin = owner.search(/pub fn (?:paint_)?native_root\(/);
    const end = owner.indexOf('pub fn modifiers', begin);
    expect(begin).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(begin);
    const nativeRoot = owner.slice(begin, end);
    expect(nativeRoot).not.toContain('renderer');
    expect(nativeRoot).not.toContain('.call(');
    const parameter = nativeRoot.match(
      /pub fn (?:paint_)?native_root\(\s*([A-Za-z_][A-Za-z_0-9]*)\s*:\s*&NativeSnapshot/
    );
    expect(parameter, 'Native root receives a typed captured snapshot').not.toBeNull();
    if (!parameter) throw new Error('Native root snapshot parameter not found');
    expect(nativeRoot).toMatch(new RegExp(`\\(\\s*${parameter[1]}\\.frame\\s*\\)\\s*\\(`));
    expect(owner).toContain('o.projection_revision!=revision');
    expect(owner).toContain('o.committed_revision==revision');
    expect(module.code).toContain('Owner::dispose');
  });

  it('threads flattened sibling indices across factory sequences and slots', () => {
    const module = emit(samples[2][1]);
    const owner = ownerSource(module);
    expect(owner).toContain('(child.frame)(owner,focus,path,drive,slot,index)');
    expect(owner).toContain('(child.frame)(owner,focus,path,drive,&[],index)');
    expect(module.code).toContain('format!("{parent_path}-{}",*index);*index+=1;');
  });

  // Original v5 lines 121–129 were not recovered. Do not infer the missing case
  // from its neighbours or claim this rebuilt file restores all original 39.
  it('keeps duplicate-slot validation before committing a new projection', () => {
    const module = emit("return r=>{const slot=r.slot();return r.el('section',[slot,[slot]]);};");
    const owner = ownerSource(module);
    expect(owner).toContain('slot_count:1');
    expect(owner).toContain('count.saturating_add(child.slot_count).min(2)');
    expect(owner).toContain('self.slot_count <= 1');
    const validation = owner.indexOf('result.assert_children()');
    const commit = owner.indexOf('o.projection=Some(result)', validation);
    expect(validation).toBeGreaterThanOrEqual(0);
    expect(commit).toBeGreaterThan(validation);
  });

  it.each([false, true])('retains checked-IR native parameters with predicate=%s', (predicate) => {
    const module = emitIR(nativeParameterIr(predicate));
    expect(module.code).toMatch(
      /v_6e617469766556616c7565\s*:\s*native::gpui_native_owner::NativeSnapshot/
    );
    expect(module.code).not.toContain('Value::NativeSnapshot');
    expect(module.code).not.toContain('Value::Template');
  });

  it('does not disguise frontend parameter rejection as a successful native consumer', () => {
    const parsed = parsePrototype(
      wrap("return r=>{const id=(child)=>child;return id(r.el('span','x'));};"),
      { fileName: 'unannotated-native-formal.proto.ts' }
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) throw new Error('Unannotated helper parameter unexpectedly admitted');
    expect(parsed.diagnostics).toContainEqual(expect.objectContaining({ code: 'PUI1006' }));
  });

  it('validates every external native child before replacing retained slot state', () => {
    const module = emit('');
    const owner = ownerSource(module);
    expect(owner).toContain('pub fn assert_native_slot_children');
    expect(owner).toContain('child.assert_children()');
    expect(owner).toContain('child.slot_count == 0');
    const begin = module.code.indexOf('pub fn set_slot(');
    const end = module.code.indexOf('pub fn set_parent(', begin);
    expect(begin).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(begin);
    const setter = module.code.slice(begin, end);
    const ensure = setter.indexOf('ensure(');
    const validation = setter.indexOf('assert_native_slot_children');
    const mutation = setter.indexOf('self.owner.borrow_mut()');
    expect(ensure).toBeGreaterThanOrEqual(0);
    expect(validation).toBeGreaterThan(ensure);
    expect(mutation).toBeGreaterThan(validation);
  });

  it.each(returned)(
    'adapts %s at the setup result boundary without changing ordinary calls',
    (_label, body) => {
      const module = emit(body);
      expect(module.code).toContain('match callable');
      expect(module.code).toContain('Value::Function(callback) => Value::Renderer');
      expect(module.code).not.toContain('Value::Template');
    }
  );

  it.each(callableObservations)(
    'preserves native callable %s separately from child snapshots',
    (_label, body) => {
      const module = emit(body);
      expect(module.code).toMatch(/NativeCallable\s*\{\s*identity\s*:\s*Rc::new\(\(\)\)/);
      expect(module.code).toMatch(/\(v_[0-9a-f]+\.call\)\(/);
      expect(module.code).not.toContain('Value::NativeSnapshot');
    }
  );

  it('uses a binding callable ABI even for a render-context direct-IR helper', () => {
    const ir = nativeParameterIr(false);
    const returned = ir.setup.body.find((statement) => statement.kind === 'return');
    if (returned?.kind !== 'return' || returned.value?.kind !== 'function')
      throw new Error('Expected renderer');
    const helper = returned.value.function.body.find(
      (statement) => statement.kind === 'const' && statement.name === 'helper'
    );
    if (helper?.kind !== 'const' || helper.value.kind !== 'function')
      throw new Error('Expected helper');
    helper.value.function.context = 'render';
    helper.value.function.phase = 'render';
    const module = emitIR(ir);
    expect(module.code).toMatch(/NativeCallable\s*\{\s*identity\s*:\s*Rc::new\(\(\)\)/);
    expect(module.code).toContain('(v_68656c706572.call)(');
  });

  it.each(['===', '!=='] as const)(
    'evaluates both callable/snapshot operands for %s without crossing ABI categories',
    (operator) => {
      for (const reverse of [false, true]) {
        const body = `return r=>{const make=()=>r.el('span','x');if(${reverse ? 'make()' : 'make'}${operator}${reverse ? 'make' : 'make()'})return null;return make();};`;
        const module = emit(body);
        const value = 'v_6d616b65.clone()',
          call = '(v_6d616b65.call)()';
        expect(
          oneOrderedBlock(
            module.code,
            reverse ? call : value,
            reverse ? value : call,
            operator === '!=='
          )
        ).toBe(true);
      }
    }
  );
  it('resolves finite repeated checked-IR callable wrappers before entering the callee body', () => {
    const parsed = parsePrototype(
      wrap("const draw=()=> 'captured';const id=()=>draw;const wrapper=()=>id();return wrapper();"),
      { fileName: 'finite-callable-wrapper-ir-base.proto.ts' }
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const ir = parsed.value;
    for (const name of ['id', 'wrapper']) {
      const declared = ir.setup.body.find(
        (statement) => statement.kind === 'const' && statement.name === name
      );
      if (declared?.kind !== 'const' || declared.value.kind !== 'function')
        throw new Error('Expected callable wrapper');
      const fn = declared.value.function;
      fn.parameters = [{ name: 'callable', type: 'function' }];
      const parameter: ExpressionIR = {
        kind: 'reference',
        name: 'callable',
        type: 'function',
        span: fn.span,
      };
      fn.body = [
        {
          kind: 'return',
          span: fn.span,
          value:
            name === 'id'
              ? parameter
              : {
                  kind: 'helper-call',
                  name: 'id',
                  arguments: [parameter],
                  type: 'function',
                  span: fn.span,
                },
        },
      ];
    }
    const tail = ir.setup.body.at(-1);
    if (tail?.kind !== 'return' || !tail.value) throw new Error('Expected setup renderer result');
    const span = tail.value.span;
    const draw: ExpressionIR = { kind: 'reference', name: 'draw', type: 'function', span };
    const inner: ExpressionIR = {
      kind: 'helper-call',
      name: 'wrapper',
      arguments: [draw],
      type: 'function',
      span,
    };
    tail.value = {
      kind: 'helper-call',
      name: 'wrapper',
      arguments: [inner],
      type: 'function',
      span,
    };
    const compiled = emitRecorded(ir);
    expect(compiled.ok, JSON.stringify(compiled)).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.value.code).not.toContain('no scalar callback alternative');
    expect(compiled.value.code).toContain('callback(arguments)');
    expect(compiled.value.code).toContain('NativeSnapshot::text_value');
  });

  it('does not force a scalar render-context direct-IR helper into the native child ABI', () => {
    const parsed = parsePrototype(
      wrap(
        "return r=>{const text=()=> 'x';const consume=(value:string)=>value;return r.el('span',consume(text()));};"
      ),
      { fileName: 'scalar-context-ir-base.proto.ts' }
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const ir = parsed.value;
    const returned = ir.setup.body.find((statement) => statement.kind === 'return');
    if (returned?.kind !== 'return' || returned.value?.kind !== 'function')
      throw new Error('Expected renderer');
    const text = returned.value.function.body.find(
      (statement) => statement.kind === 'const' && statement.name === 'text'
    );
    if (text?.kind !== 'const' || text.value.kind !== 'function')
      throw new Error('Expected scalar helper');
    text.value.function.context = 'render';
    text.value.function.phase = 'render';
    const compiled = emitRecorded(ir);
    expect(compiled.ok, JSON.stringify(compiled)).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.value.code).toContain('v_74657874.call(vec![])');
    expect(compiled.value.code).not.toContain('(v_74657874.call)()');
  });

  it('adapts only the Prototype setup result, not a setup-context helper returning a function', () => {
    const parsed = parsePrototype(
      wrap(
        "const draw=()=> 'x';const factory=()=>draw;const alias=factory();if(alias!==draw)return ()=> 'bad';return draw;"
      ),
      { fileName: 'setup-context-factory-ir-base.proto.ts' }
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const ir = parsed.value;
    const factory = ir.setup.body.find(
      (statement) => statement.kind === 'const' && statement.name === 'factory'
    );
    if (factory?.kind !== 'const' || factory.value.kind !== 'function')
      throw new Error('Expected factory');
    factory.value.function.context = 'setup';
    factory.value.function.phase = 'setup';
    const compiled = emitRecorded(ir);
    expect(compiled.ok, JSON.stringify(compiled)).toBe(true);
    if (!compiled.ok) return;
    const factoryCode = compiled.value.code.slice(
      compiled.value.code.indexOf('let v_666163746f7279 ='),
      compiled.value.code.indexOf('let v_616c696173 =')
    );
    expect(factoryCode).toContain('return v_64726177.clone();');
    expect(factoryCode).not.toContain('match callable');
  });

  it('emits the actual ordinary native consumer fixture rather than a handwritten substitute', () => {
    const source = readFileSync(
      new NodeURL('./fixtures/gpui-native-template/composed.proto.ts', import.meta.url),
      'utf8'
    );
    expect(digest(source)).toBe('32ee71108a670cc76033d2a3394453753fc783a23a81f2ae3f49d9e46d88a1cb');
    const parsed = parsePrototype(source, {
      fileName: 'fixtures/gpui-native-template/composed.proto.ts',
    });
    expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const module = emitIR(parsed.value);
    expect(module.code).toContain('NativeCallable');
    expect(module.code).toMatch(/(?:paint_)?native_root\(&snapshot/);
    expect(module.supportingFiles).toContainEqual(expect.objectContaining({ path: 'Cargo.toml' }));
  });
});

// New v9 controls. These are additions, not a guess at the unrecovered 39th case.
describe('GPUI v9 additional source controls', () => {
  it('keeps style-only properties with explicit and omitted children', () => {
    for (const body of [
      "return r=>r.el('section',{style:tw('p-2')},['content',r.slot()]);",
      "return r=>r.el('section',{style:tw('p-2')});",
    ]) {
      const module = emit(body);
      assertNativeGraph(module);
      expect(module.code).toContain('style_items(');
      expect(module.code).toContain('native_presentation(');
    }
  });

  it('does not use component names or source paths to select native lowering', () => {
    const body = samples[2][1];
    for (const [name, file] of [
      ['plain-a', 'ordinary/a.proto.ts'],
      ['unrelated-b', 'renamed/b.proto.ts'],
    ] as const) {
      const module = emitIR(parse(body, file, name));
      assertNativeGraph(module);
      expect(module.code).toContain('NativeSnapshot');
      expect(module.code).toContain('gpui::div().id(');
    }
  });

  it('ordered-operand source oracle rejects elision, duplication and reversed effects', () => {
    const left = 'factory.clone()',
      right = '(factory.call)()';
    const good = `{ let first = ${left}; let second = ${right}; Value::boolean(false) }`;
    expect(oneOrderedBlock(good, left, right, false)).toBe(true);
    expect(oneOrderedBlock(good.replace(/; /g, ';\n  '), left, right, false)).toBe(true);
    expect(oneOrderedBlock(`{ Value::boolean(false) }`, left, right, false)).toBe(false);
    expect(
      oneOrderedBlock(
        `{ let first = ${right}; let second = ${left}; Value::boolean(false) }`,
        left,
        right,
        false
      )
    ).toBe(false);
    expect(
      oneOrderedBlock(
        `{ let first = ${left}; let second = ${right}; let third = ${right}; Value::boolean(false) }`,
        left,
        right,
        false
      )
    ).toBe(false);
    expect(oneOrderedBlock(good + good, left, right, false)).toBe(false);
  });
});

// New admitted-input closure discovered by independent v9 static review.
// All of these are source/checked-IR controls; emitted Rust still needs separate compilation.
const recordSamples = [
  [
    'local record, alias identity and a distinct construction',
    "return r=>{const child=r.el('span','x');const holder={child};const alias=holder;if(!holder||holder!==alias)return null;if(holder==={child})return null;return child;};",
  ],
  [
    'nested native-containing records',
    "return r=>{const child=r.el('span','x');const holder={outer:{child}};if(!holder)return null;return child;};",
  ],
  [
    'per-call record identity from a native factory',
    "return r=>{const child=r.el('span','x');const make=()=>({child});const first=make();const alias=first;if(first!==alias)return null;if(first===make())return null;return child;};",
  ],
  [
    'captured native-containing record helper',
    "return r=>{const child=r.el('span','x');const holder={child};const capture=()=>holder;const alias=capture();if(holder!==alias)return null;return child;};",
  ],
  [
    'native and state-only module-config result alternatives',
    "const choose=def.state.bool('choose',true);return r=>{const child=r.el('span','x');const make=()=>{if(choose.get())return {child};return {state:choose};};const holder=make();if(!holder)return null;return child;};",
  ],
] as const;

function assertNativeRecordGraph(module: GeneratedModule): void {
  assertNativeGraph(module);
  expect(module.code).toContain('enum __PuiNativeRecordValue');
  expect(module.code).toMatch(/struct __PuiNativeRecord\d+\s*\{/);
  expect(module.code).toMatch(/_field_\d+\s*:\s*native::gpui_native_owner::NativeSnapshot/);
  expect(module.code).toMatch(/Literal\d+\(Rc<__PuiNativeRecord\d+>\)/);
  expect(module.code).not.toContain('Value::NativeSnapshot');
  expect(module.code).not.toContain('Value::Template');
  expect(module.code).not.toContain('dyn Any');
  expect(module.code).not.toContain('Box<dyn');
  expect(module.code).not.toContain('PUI_GPUI_HOST_REQUIRED');
}

function recordForwardIr(mode: 'single' | 'mixed' | 'optional', nativeFirst: boolean): PrototypeIR {
  // This baseline is legal ordinary source. Only semantic formal admission is
  // exercised by the explicit mutation; no unsupported frontend annotation is hidden.
  const ir = parse(
    "const flag=def.state.bool('flag',true);return r=>{const child=r.el('span','x');const holder={child};const ordinary={state:flag};const forward=()=>holder;const first=forward();const second=forward();if(!first||!second)return null;return child;};",
    'native-record-forward-ir-base.proto.ts'
  );
  const returned = ir.setup.body.find((statement) => statement.kind === 'return');
  if (returned?.kind !== 'return' || returned.value?.kind !== 'function')
    throw new Error('Expected renderer');
  const body = returned.value.function.body;
  const forward = body.find(
    (statement) => statement.kind === 'const' && statement.name === 'forward'
  );
  if (forward?.kind !== 'const' || forward.value.kind !== 'function')
    throw new Error('Expected forwarding helper');
  const fn = forward.value.function;
  fn.parameters = [
    { name: 'config', type: 'module-config', ...(mode === 'optional' ? { optional: true } : {}) },
  ];
  fn.body = [
    {
      kind: 'return',
      span: fn.span,
      value: { kind: 'reference', name: 'config', type: 'module-config', span: fn.span },
    },
  ];
  const native: ExpressionIR = {
    kind: 'reference',
    name: 'holder',
    type: 'module-config',
    span: fn.span,
  };
  const ordinary: ExpressionIR = {
    kind: 'reference',
    name: 'ordinary',
    type: 'module-config',
    span: fn.span,
  };
  for (const [index, name] of ['first', 'second'].entries()) {
    const declaration = body.find(
      (statement) => statement.kind === 'const' && statement.name === name
    );
    if (declaration?.kind !== 'const' || declaration.value.kind !== 'helper-call')
      throw new Error('Expected forwarding call');
    const nativeCall = mode === 'single' || (index === 0) === nativeFirst;
    declaration.value.arguments = nativeCall ? [native] : mode === 'optional' ? [] : [ordinary];
  }
  return ir;
}

describe('GPUI finite native-containing record ABI (new v9 static definitions)', () => {
  it.each(recordSamples)(
    'preserves %s without boxing child factories into Value',
    (_label, source) => {
      const module = emit(source);
      assertNativeRecordGraph(module);
      expect(module.code).toContain('.truthy()');
    }
  );

  it('evaluates native-containing record fields once and in authored order', () => {
    const module = emit(
      "return r=>{const left=()=>r.el('span','L');const right=()=>r.el('span','R');const holder={first:left(),second:right()};if(!holder)return null;return r.el('div','done');};"
    );
    assertNativeRecordGraph(module);
    const left = '(v_6c656674.call)()',
      right = '(v_7269676874.call)()';
    expect(module.code.split(left)).toHaveLength(2);
    expect(module.code.split(right)).toHaveLength(2);
    expect(module.code.indexOf(left)).toBeLessThan(module.code.indexOf(right));
    expect(module.code).toMatch(/let\s+[A-Za-z_][A-Za-z_0-9]*\s*=\s*\(v_6c656674\.call\)\(\)\s*;/);
    expect(module.code).toMatch(
      /let\s+[A-Za-z_][A-Za-z_0-9]*\s*=\s*\(v_7269676874\.call\)\(\)\s*;/
    );
  });

  it('keeps record-returning native callable alias identity and truthiness', () => {
    const module = emit(
      "return r=>{const child=r.el('span','x');const make=()=>({child});const alias=make;if(!make||make!==alias)return null;const holder=alias();if(!holder)return null;return child;};"
    );
    assertNativeRecordGraph(module);
    expect(module.code).toMatch(/NativeCallable\s*\{\s*identity\s*:\s*Rc::new\(\(\)\)/);
    expect(module.code).toContain('.equals_native(');
    expect(module.code).toContain('(v_616c696173.call)()');
    expect(module.code).toMatch(/->\s*__PuiNativeRecordValue/);
  });

  it('retains native-record callable identity through an ordinary factory transport', () => {
    const module = emit(
      "return r=>{const child=r.el('span','x');const make=()=>({child});const factory=()=>make;const escaped=factory();if(escaped!==make)return null;const holder=make();if(!holder)return null;return child;};"
    );
    assertNativeRecordGraph(module);
    expect(module.code).toContain('Value::NativeFunction');
    expect(module.code).toContain('.identity.clone()');
    expect(module.code).toContain('.equals_value(');
    expect(module.code).toContain('into_invalid_snapshot()');
  });

  it('evaluates a raw renderer record result once before marking it invalid children', () => {
    const module = emit(
      "return r=>{const child=r.el('span','x');const make=()=>({child});return make();};"
    );
    assertNativeRecordGraph(module);
    expect(module.code.split('(v_6d616b65.call)()')).toHaveLength(2);
    expect(module.code).toContain('into_invalid_snapshot()');
    expect(module.code).toContain('valid:false');
    expect(module.code).toContain('let _retained=&self;');
    expect(ownerSource(module)).toContain('result.assert_children()');
  });

  it('forwards a checked-IR native module-config formal and result', () => {
    const module = emitIR(recordForwardIr('single', true));
    assertNativeRecordGraph(module);
    expect(module.code).toMatch(/v_636f6e666967\s*:\s*__PuiNativeRecordValue/);
    expect(module.code).toMatch(/Fn\(__PuiNativeRecordValue\)\s*->\s*__PuiNativeRecordValue/);
    expect(module.code).toContain('(v_666f7277617264.call)(');
  });

  it.each([true, false])(
    'unifies native and state-only calls independent of native-first=%s',
    (nativeFirst) => {
      const module = emitIR(recordForwardIr('mixed', nativeFirst));
      assertNativeRecordGraph(module);
      expect(module.code).toMatch(/Fn\(__PuiNativeRecordValue\)\s*->\s*__PuiNativeRecordValue/);
      expect(module.code).toContain('__PuiNativeRecordValue::Ordinary(v_6f7264696e617279.clone())');
      expect(module.code.split('(v_666f7277617264.call)(')).toHaveLength(3);
    }
  );

  it.each([true, false])(
    'preserves a checked-IR omitted optional record formal with native-first=%s',
    (nativeFirst) => {
      const module = emitIR(recordForwardIr('optional', nativeFirst));
      assertNativeRecordGraph(module);
      expect(module.code).toMatch(/Fn\(__PuiNativeRecordValue\)\s*->\s*__PuiNativeRecordValue/);
      expect(module.code).toContain('__PuiNativeRecordValue::Ordinary(Value::Undefined)');
      expect(module.code.split('(v_666f7277617264.call)(')).toHaveLength(3);
    }
  );
});

// New review boundary: one checked helper is shared between setup ordinary
// configuration and render native records. No frontend capability annotation is added.
function sharedSetupRecordIr(nested: boolean): PrototypeIR {
  const source = wrap(
    "const flag=def.state.bool('flag',true);const ordinary={disabled:false,meta:{flag}};const identity=()=>ordinary;const config=identity();const alias=config;const nested={disabled:false,meta:config};const nestedAlias=nested;const focus=asFocusable();focus.configure(" +
      (nested ? 'nested' : 'config') +
      ");return r=>{const child=r.el('span','x');const holder={child};const projected=identity();if(config!==alias||nested!==nestedAlias||!projected)return null;return child;};"
  ).replace('export default', "import {asFocusable} from '@proto.ui/hooks'; export default");
  const parsed = parsePrototype(source, { fileName: 'shared-setup-render-record.proto.ts' });
  expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const ir = parsed.value;
  const identity = ir.setup.body.find(
    (statement) => statement.kind === 'const' && statement.name === 'identity'
  );
  if (identity?.kind !== 'const' || identity.value.kind !== 'function')
    throw new Error('Expected shared identity helper');
  const fn = identity.value.function;
  fn.parameters = [{ name: 'config', type: 'module-config' }];
  fn.body = [
    {
      kind: 'return',
      span: fn.span,
      value: { kind: 'reference', name: 'config', type: 'module-config', span: fn.span },
    },
  ];
  const config = ir.setup.body.find(
    (statement) => statement.kind === 'const' && statement.name === 'config'
  );
  if (config?.kind !== 'const' || config.value.kind !== 'helper-call')
    throw new Error('Expected setup identity call');
  config.value.arguments = [
    { kind: 'reference', name: 'ordinary', type: 'module-config', span: fn.span },
  ];
  const returned = ir.setup.body.find((statement) => statement.kind === 'return');
  if (returned?.kind !== 'return' || returned.value?.kind !== 'function')
    throw new Error('Expected renderer');
  const projected = returned.value.function.body.find(
    (statement) => statement.kind === 'const' && statement.name === 'projected'
  );
  if (projected?.kind !== 'const' || projected.value.kind !== 'helper-call')
    throw new Error('Expected render identity call');
  projected.value.arguments = [
    { kind: 'reference', name: 'holder', type: 'module-config', span: fn.span },
  ];
  return ir;
}

describe('GPUI native-record shared phase and private namespace boundaries (new v9)', () => {
  it.each([false, true])(
    'retains ordinary setup configuration and aliases through a native-specialized shared helper, nested=%s',
    (nested) => {
      const module = emitIR(sharedSetupRecordIr(nested));
      assertNativeRecordGraph(module);
      expect(module.code).toMatch(/Fn\(__PuiNativeRecordValue\)\s*->\s*__PuiNativeRecordValue/);
      expect(module.code.split('(v_6964656e74697479.call)(')).toHaveLength(3);
      expect(module.code).toContain('__PuiNativeRecordValue::Ordinary(v_6f7264696e617279.clone())');
      expect(module.code).toContain('.ordinary_value()');
      expect(module.code).toContain('record(vec![');
      const configName = nested ? 'v_6e6573746564' : 'v_636f6e666967';
      expect(module.code).toMatch(
        new RegExp(
          'focus_setup_config\\([^;\\n]*\\(' +
            configName +
            '\\.clone\\(\\)\\)\\.into_ordinary\\(\\)'
        )
      );
      expect(module.code).toContain('.equals(');
      expect(module.code).not.toContain('Value::NativeSnapshot');
    }
  );

  it.each(['NativeRecordValue', 'NativeRecord0', 'NativeSnapshot', 'NativeCallable'] as const)(
    'allows valid public component name %s without private type collision',
    (componentName) => {
      const ir = parse(
        "return r=>{const child=r.el('span','x');const make=()=>({child});const holder=make();if(!holder)return null;return child;};",
        'legal-component-name.proto.ts'
      );
      const module = emitIR(ir, { componentName });
      assertNativeRecordGraph(module);
      expect(module.code).toContain(`pub struct ${componentName} {`);
      expect(module.code).toContain(`impl Render for ${componentName} {`);
      expect(module.code).toContain('enum __PuiNativeRecordValue');
      expect(module.code).toContain('native::gpui_native_owner::NativeSnapshot');
      expect(module.code).toContain('native::gpui_native_owner::NativeCallable');
    }
  );
});

// Both native-record cross-category comparison branches are statically unequal,
// but the authored operands still run once each, left first, in either order.
const recordCrossCategories = [
  ['snapshot', '==='],
  ['snapshot', '!=='],
  ['callable', '==='],
  ['callable', '!=='],
] as const;
describe('GPUI native-record cross-category operand preservation (new v9)', () => {
  it.each(recordCrossCategories)(
    'evaluates record and %s operands once in order for %s',
    (otherKind, operator) => {
      for (const reverse of [false, true]) {
        const otherSource = otherKind === 'snapshot' ? 'child()' : 'child';
        const leftSource = reverse ? otherSource : 'record()';
        const rightSource = reverse ? 'record()' : otherSource;
        const module = emit(
          `return r=>{const child=()=>r.el('span','x');const record=()=>({child:child()});if(${leftSource}${operator}${rightSource})return null;return child();};`
        );
        assertNativeRecordGraph(module);
        const recordCall = '(v_7265636f7264.call)()';
        const other = otherKind === 'snapshot' ? '(v_6368696c64.call)()' : 'v_6368696c64.clone()';
        expect(
          oneOrderedBlock(
            module.code,
            reverse ? other : recordCall,
            reverse ? recordCall : other,
            operator === '!=='
          )
        ).toBe(true);
      }
    }
  );
});

// Explicit checked IR only: frontend unannotated formals are not relaxed.
// The nested helper's declaration-frame binding must track the outer formal's
// settled native-record ABI, not the caller's same-spelled ordinary local.
it('settles nested captured record formals in either call order without caller shadow capture (checked IR)', () => {
  for (const nativeFirst of [true, false]) {
    const ir = parse(
      "const flag=def.state.bool('flag',true);return r=>{const config='caller-shadow';const child=r.el('span','x');const holder={child};const ordinary={state:flag};const forward=()=>{const read=()=>holder;return read();};const first=forward();const second=forward();if(config!=='caller-shadow'||!first||!second)return null;return child;};",
      'captured-record-formal-ir-base.proto.ts'
    );
    const returned = ir.setup.body.find((statement) => statement.kind === 'return');
    if (returned?.kind !== 'return' || returned.value?.kind !== 'function')
      throw new Error('Expected renderer');
    const body = returned.value.function.body;
    const forward = body.find(
      (statement) => statement.kind === 'const' && statement.name === 'forward'
    );
    if (forward?.kind !== 'const' || forward.value.kind !== 'function')
      throw new Error('Expected outer helper');
    const fn = forward.value.function;
    fn.parameters = [{ name: 'config', type: 'module-config' }];
    const read = fn.body.find(
      (statement) => statement.kind === 'const' && statement.name === 'read'
    );
    if (read?.kind !== 'const' || read.value.kind !== 'function')
      throw new Error('Expected nested reader');
    read.value.function.body = [
      {
        kind: 'return',
        span: read.value.function.span,
        value: {
          kind: 'reference',
          name: 'config',
          type: 'module-config',
          span: read.value.function.span,
        },
      },
    ];
    for (const [index, name] of ['first', 'second'].entries()) {
      const declaration = body.find(
        (statement) => statement.kind === 'const' && statement.name === name
      );
      if (declaration?.kind !== 'const' || declaration.value.kind !== 'helper-call')
        throw new Error('Expected outer helper call');
      declaration.value.arguments = [
        {
          kind: 'reference',
          name: (index === 0) === nativeFirst ? 'holder' : 'ordinary',
          type: 'module-config',
          span: fn.span,
        },
      ];
    }
    // emitIR first invokes the real validateIR and then the ordinary emitter.
    const module = emitIR(ir);
    assertNativeRecordGraph(module);
    expect(module.code).toMatch(/Fn\(__PuiNativeRecordValue\)\s*->\s*__PuiNativeRecordValue/);
    expect(module.code).toMatch(/Fn\(\)\s*->\s*__PuiNativeRecordValue/);
    expect(module.code).toContain('let v_636f6e666967 = Value::string("caller-shadow");');
    expect(module.code).toContain('let v_636f6e666967 = v_636f6e666967.clone();');
    const capturedReturn =
      /move\s*\|\|\s*->\s*__PuiNativeRecordValue\s*\{\s*(?:\/\/ Source \"(?:\\.|[^\"\\\r\n])*\":\d+:\d+\r?\n\s*)?return v_636f6e666967\.clone\(\);/;
    expect(module.code).toMatch(capturedReturn);
    // Only the emitter's exact provenance annotation may precede this return;
    // a real intervening statement must not satisfy the capture oracle.
    expect(
      module.code.replace(
        'return v_636f6e666967.clone();',
        'let pui_wrong_capture = Value::Undefined; return v_636f6e666967.clone();'
      )
    ).not.toMatch(capturedReturn);
    expect(module.code).toContain('__PuiNativeRecordValue::Ordinary(v_6f7264696e617279.clone())');
    expect(module.code.split('(v_666f7277617264.call)(')).toHaveLength(3);
    expect(module.code.split('(v_72656164.call)()')).toHaveLength(2);
  }
});
