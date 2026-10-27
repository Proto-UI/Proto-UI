// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import ts from 'typescript';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import type { DataType } from '../src/data-types';
import type { ExpressionIR } from '../src/ir';
import { inferBinaryType } from '../src/expression-types';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { diagnosticsJson, formatCompilerDiagnostics } from '../src/diagnostic-format';
import { emitGpuiSource } from '../src/gpui-source';
import { emitFlutterSource } from '../src/flutter-source';
import { emitQtSource } from '../src/qt-source';
import { emitReactSource } from '../src/react-source';
import { emitVueSource } from '../src/vue-source';
import { emitVue2Source } from '../src/vue2-source';
import { emitWebComponentSource } from '../src/web-component-source';

const operators = ['<', '<=', '>', '>='] as const;
const literal = (value: string | number): DataType => ({ kind: 'literal', value });
const union = (...members: DataType[]): DataType => ({ kind: 'union', members });
const source = (body: string) => `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'relational',setup(def){${body};return r=>r.el('div',[]);}});`;
function parse(body: string) {
  const result = parsePrototype(source(body), { fileName: 'relational.proto.ts' });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}
function sourceSpans(value: unknown, spans = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') return spans;
  if ('span' in value) spans.add(JSON.stringify(value.span));
  Object.values(value).forEach(child => sourceSpans(child, spans));
  return spans;
}

describe('relational admission migration', () => {
  for (const op of operators) {
    it(`${op} admits homogeneous primitives, literals and every homogeneous union alternative`, () => {
      for (const [a, b] of [
        ['number', 'number'], ['string', 'string'],
        [literal(1), union(literal(2), 'number')],
        [union(literal('a'), literal('b')), literal('z')],
      ] as [DataType, DataType][]) expect(inferBinaryType(op, a, b)).toBe('boolean');
    });
    for (const [label, a, b] of [
      ['mixed', 'number', 'string'], ['null', 'null', 'number'],
      ['undefined', 'void', 'number'], ['boolean', 'boolean', 'boolean'],
      ['heterogeneous union', union('number', 'string'), 'string'],
      ['nullable union', union('number', 'null'), 'number'],
      ['object', { kind: 'record', fields: [] }, 'number'],
      ['array', { kind: 'array', element: 'number' }, 'number'],
    ] as [string, DataType, DataType][]) {
      it(`${op} rejects ${label} in either operand order`, () => {
        expect(() => inferBinaryType(op, a, b)).toThrow(TypeError);
        expect(() => inferBinaryType(op, b, a)).toThrow(TypeError);
      });
    }
    for (const pair of [['1', "'2'"], ['null', '1'], ['true', 'false'], ["'2'", '1']]) {
      it(`source diagnostic for ${pair.join(op)}`, () => {
        const result = parsePrototype(source(`def.expose.value('result',${pair[0]} ${op} ${pair[1]})`), { fileName: 'migration.proto.ts' });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'PUI1006', message: expect.stringContaining('Relational comparison') })]));
      });
    }
    it(`${op} rejects forged mixed IR before any backend accepts it`, () => {
      const ir = parse(`def.expose.value('result',1 ${op} 2)`);
      const forged = JSON.parse(JSON.stringify(ir), (_key, value) => {
        if (value?.kind === 'binary' && value.operator === op) value.right = { ...value.right, value: '2', type: 'string' };
        return value;
      });
      const checked = validateIR(forged);
      expect(checked.ok).toBe(false);
      if (!checked.ok) expect(checked.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'PUI2002', message: expect.stringContaining('Relational comparison') })]));
      for (const emit of [emitGpuiSource, emitFlutterSource, emitQtSource, emitReactSource, emitVueSource, emitVue2Source, emitWebComponentSource]) expect(emit(forged).ok).toBe(false);
      // The GPUI bottom path must not change invalid non-bottom diagnostics or spans.
      expect(emitGpuiSource(forged)).toEqual(checked);
      if (!checked.ok) for (const diagnostic of checked.diagnostics)
        expect(sourceSpans(forged).has(JSON.stringify(diagnostic.span))).toBe(true);
    });
  }
});

// Handwritten truth tables, not results computed using the operator under test.
const cases: [string, string, string, boolean[]][] = [
  ['less', '1', '2', [true, true, false, false]],
  ['greater', '2', '1', [false, false, true, true]],
  ['zero', '-0', '0', [false, true, false, true]],
  ['nan-left', '(0/0)', '1', [false, false, false, false]],
  ['nan-right', '1', '(0/0)', [false, false, false, false]],
  ['nan-both', '(0/0)', '(0/0)', [false, false, false, false]],
  ['positive-infinity-left', '(1/0)', '0', [false, false, true, true]],
  ['positive-infinity-right', '0', '(1/0)', [true, true, false, false]],
  ['negative-infinity-left', '(-1/0)', '0', [true, true, false, false]],
  ['negative-infinity-right', '0', '(-1/0)', [false, false, true, true]],
  ['positive-infinity-equal', '(1/0)', '(1/0)', [false, true, false, true]],
  ['negative-infinity-equal', '(-1/0)', '(-1/0)', [false, true, false, true]],
  ['opposite-infinities', '(-1/0)', '(1/0)', [true, true, false, false]],
  ['numeric-strings', "'2'", "'10'", [false, false, true, true]],
  ['prefix', "'a'", "'aa'", [true, true, false, false]],
  ['equal', "'a'", "'a'", [false, true, false, true]],
  ['empty', "''", "'a'", [true, true, false, false]],
  ['utf16', "'\\u{10000}'", "'\\uE000'", [true, true, false, false]],
  ['utf16-reversed', "'\\uE000'", "'\\u{10000}'", [false, false, true, true]],
  ['no-normalization', "'e\\u0301'", "'\\u00E9'", [true, true, false, false]],
  ['control', "'\\b'", "'\\f'", [true, true, false, false]],
  ['escape-text', "'a\\\\u0000'", "'a\\\\u{0000}'", [true, true, false, false]],
];
const floatingUi = createRequire(fileURLToPath(new NodeURL('../../modules/positioning/package.json', import.meta.url)))('@floating-ui/dom');
let tagIndex = 0;
function generatedModules(body: string, emit = emitWebComponentSource): Record<string, unknown> {
  const emitted = emit(parse(body));
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  const files = new Map((emitted.value.supportingFiles ?? []).map(f => [f.path, f.contents]));
  files.set('component.ts', emitted.value.code);
  const cache = new Map<string, Record<string, unknown>>();
  function load(name: string): Record<string, unknown> {
    const cached = cache.get(name);
    if (cached) return cached;
    const text = files.get(name);
    if (text === undefined) throw new Error('Missing generated file: ' + name);
    const exports: Record<string, unknown> = {};
    cache.set(name, exports);
    // Execution harness only: transpileModule is not a type check.
    const js = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    new Function('exports', 'require', js)(exports, (id: string) => {
      if (id === '@floating-ui/dom') return floatingUi;
      if (id === 'react') return React;
      if (id === 'vue') return emit === emitVue2Source ? Vue2 : Vue;
      if (!id.startsWith('.')) throw new Error('Unexpected generated import: ' + id);
      const next = path.posix.normalize(path.posix.join(path.posix.dirname(name), id));
      return load(next.endsWith('.ts') ? next : next + '.ts');
    });
    return exports;
  }
  return load('component.ts');
}
function consumer(body: string): { getExposes(): Record<string, unknown>; dispose(): void; remove(): void } {
  const mod = generatedModules(body) as { register(tag: string): void };
  const tag = 'relational-case-' + (++tagIndex);
  mod.register(tag);
  const element = document.createElement(tag) as HTMLElement & { getExposes(): Record<string, unknown>; dispose(): void };
  document.body.append(element);
  return element;
}
for (const [label, a, b, expected] of cases) {
  it(`actual generated WC consumer: ${label}`, () => {
    const element = consumer(operators.map((op, i) => `def.expose.value('r${i}',${a} ${op} ${b});`).join(''));
    try { expect(element.getExposes()).toEqual(Object.fromEntries(expected.map((v, i) => ['r' + i, v]))); }
    finally { element.dispose(); element.remove(); }
  });
}
for (const [name, emit] of Object.entries({ React: emitReactSource, Vue: emitVueSource, Vue2: emitVue2Source, WC: emitWebComponentSource, Qt: emitQtSource, Flutter: emitFlutterSource, GPUI: emitGpuiSource })) {
  it(`${name} emits admitted numeric and string relations (not native acceptance)`, () => {
    for (const [, a, b] of cases) expect(emit(parse(operators.map((op, i) => `def.expose.value('r${i}',${a} ${op} ${b});`).join(''))).ok).toBe(true);
  });
}
it('GPUI uses UTF-16 comparison for literal string types and evaluates operands into ordered temporaries', () => {
  const result = emitGpuiSource(parse("def.expose.value('result','\\u{10000}' < '\\uE000')"));
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.code).toContain('encode_utf16()');
    expect(result.value.code).toMatch(/let relational_left = .*; let relational_right = /);
    expect(result.value.code).not.toContain('scalar_number() <');
  }
});
type ConsumerApi = { getExposes(): Record<string, unknown> };
type LegacyInstance = { $mount(host: Element): void; $refs: Record<string, ConsumerApi>; $destroy(): void; $el: HTMLElement };
const Vue2 = createRequire(fileURLToPath(new NodeURL('../../adapters/vue2/package.json', import.meta.url)))('vue') as {
  new(options: { render(h: (component: unknown, options: { ref: string }) => unknown): unknown }): LegacyInstance;
  nextTick(): Promise<void>;
};
const frameworkBody = cases.map(([, a, b], c) => operators.map((op, o) => `def.expose.value('c${c}o${o}',${a} ${op} ${b});`).join('')).join('') + `
const log=def.state.string('log','');
const left=()=>{log.set(log.get()+'L');return 1;};
const right=()=>{log.set(log.get()+'R');return 2;};
def.expose.method('compare',()=>left()<right());
def.expose.method('trace',()=>log.get());`;
const frameworkExpected = Object.fromEntries(cases.flatMap(([, , , expected], c) => expected.map((v, o) => ['c'+c+'o'+o, v])));
function checkFramework(api: ConsumerApi): void {
  const exposed = api.getExposes() as Record<string, unknown> & { compare(): boolean; trace(): string };
  expect(exposed).toMatchObject(frameworkExpected);
  expect(exposed.compare()).toBe(true);
  expect(exposed.trace()).toBe('LR');
  exposed.compare();
  expect(exposed.trace()).toBe('LRLR');
}
it('actual generated React consumer covers the truth tables and effect order', async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const mod = generatedModules(frameworkBody, emitReactSource);
  const host = document.createElement('div');document.body.append(host);
  const root = createRoot(host);const ref = React.createRef<ConsumerApi>();
  try {
    await React.act(async () => root.render(React.createElement(mod.CompiledComponent as React.ComponentType<{ ref: React.Ref<ConsumerApi> }>, { ref })));
    expect(ref.current).not.toBeNull();
    await React.act(async () => checkFramework(ref.current!));
  } finally { await React.act(async () => root.unmount());host.remove(); }
});
it('actual generated Vue consumer covers the truth tables and effect order', async () => {
  const mod = generatedModules(frameworkBody, emitVueSource);
  const host = document.createElement('div');document.body.append(host);
  const app = Vue.createApp(mod.default as Vue.Component);
  try { const api = app.mount(host) as unknown as ConsumerApi;await Vue.nextTick();checkFramework(api); }
  finally { app.unmount();host.remove(); }
});
it('actual generated Vue2 consumer covers the truth tables and effect order', async () => {
  const mod = generatedModules(frameworkBody, emitVue2Source);
  const host = document.createElement('div');document.body.append(host);
  const vm = new Vue2({ render: h => h(mod.default, { ref: 'child' }) });
  try { vm.$mount(host);await Vue2.nextTick();checkFramework(vm.$refs.child); }
  finally { vm.$destroy();vm.$el.remove();host.remove(); }
});
it('GPUI explicitly rejects lone-surrogate literals instead of replacing them', () => {
  for (const value of ['\\uD800', '\\uDC00']) {
    const result = emitGpuiSource(parse(`def.expose.value('result','${value}' < 'a')`));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'PUI_GPUI_STRING_UNSUPPORTED' })]));
  }
});
for (const op of operators) {
  it(`actual WC ${op} evaluates effectful operands once, left then right on each call`, () => {
    const element = consumer(`
      const log=def.state.string('log','');
      const left=()=>{log.set(log.get()+'L');return 1;};
      const right=()=>{log.set(log.get()+'R');return 2;};
      def.expose.method('compare',()=>left() ${op} right());
      def.expose.method('trace',()=>log.get());
    `);
    try {
      const api = element.getExposes() as { compare(): boolean; trace(): string };
      expect(api.compare()).toBe(op === '<' || op === '<=');
      expect(api.trace()).toBe('LR');
      api.compare();
      expect(api.trace()).toBe('LRLR');
    } finally { element.dispose(); element.remove(); }
  });
}
it('GPUI keeps control characters and literal backslash-u strings distinct in Rust source', () => {
  const result = emitGpuiSource(parse("def.expose.value('result','\\b' < '\\f');def.expose.value('escaped','a\\\\u0000' < 'a\\\\u{0000}')"));
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.code).toContain('Value::string("\\u{8}")');
    expect(result.value.code).toContain('Value::string("\\u{c}")');
    expect(result.value.code).toContain('Value::string("a\\\\u0000")');
    expect(result.value.code).toContain('Value::string("a\\\\u{0000}")');
  }
});
it('homogeneous literal unions reach GPUI string comparison through the source parser', () => {
  const body = `def.expose.method('compare',(a:'a'|'z',b:'b'|'y')=>a<b);`;
  const result = emitGpuiSource(parse(body));
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.value.code).toContain('encode_utf16()');
  const element = consumer(body);
  try { expect((element.getExposes() as { compare(a: string, b: string): boolean }).compare('a', 'y')).toBe(true); }
  finally { element.dispose(); element.remove(); }
});
it('source admission rejects a mixed parameter union rather than choosing a possible branch', () => {
  const result = parsePrototype(source(`def.expose.method('compare',(a:number|string,b:string)=>a<b);`));
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'PUI1006', message: expect.stringContaining('Relational comparison') })]));
});
for (const rhs of ['null', 'false']) {
  it(`GPUI handles a narrowed bottom operand against ${rhs} without escaping CompileResult`, () => {
    const body = `def.expose.method('compare',(x:'a')=>{if(x==='a')return false;return x<${rhs};});`;
    const ir = parse(body);
    expect(validateIR(ir).ok).toBe(true);
    expect(() => emitGpuiSource(ir)).not.toThrow();
    expect(emitGpuiSource(ir).ok).toBe(true);
    const element = consumer(body);
    try { expect((element.getExposes() as { compare(x: string): boolean }).compare('a')).toBe(false); }
    finally { element.dispose(); element.remove(); }
  });
}
for (const body of [
  `const value={'\\uD800':1,'\\uD801':2};def.expose.value('result',value['\\uD800']<2);`,
  `def.props.define({'\\uDC00':{type:'string',default:'a'}});`,
  `def.expose.method('probe',(r:{'\\uD800':number})=>r['\\uD800']);`,
]) {
  it(`GPUI diagnoses non-literal lone-surrogate string sites: ${body}`, () => {
    const ir = parse(body);
    expect(() => emitGpuiSource(ir)).not.toThrow();
    const emitted = emitGpuiSource(ir);
    expect(emitted.ok).toBe(false);
    if (!emitted.ok) {
      const strings = emitted.diagnostics.filter(d => d.code === 'PUI_GPUI_STRING_UNSUPPORTED');
      expect(strings.length).toBeGreaterThan(0);
      for (const diagnostic of emitted.diagnostics) {
        expect(diagnostic.span).toBeDefined();
        expect(sourceSpans(ir).has(JSON.stringify(diagnostic.span))).toBe(true);
        expect(diagnostic.span?.file).toBe('relational.proto.ts');
        expect(diagnostic.span!.start).toBeGreaterThanOrEqual(0);
        expect(diagnostic.span!.end).toBeLessThanOrEqual(source(body).length);
        expect(source(body).slice(diagnostic.span!.start, diagnostic.span!.end).length).toBeGreaterThan(0);
      }
      expect(emitted).not.toHaveProperty('value');
    }
  });
}
it('GPUI keeps valid string output UTF-8 roundtrippable and preserves opaque UTF-16 hook keys', () => {
  const input = `import {definePrototype,defineAsHook} from '@proto.ui/core';
const a=defineAsHook({name:'\\uD800',setup(){}});
const b=defineAsHook({name:'\\uD801',setup(){}});
export default definePrototype({name:'keys',setup(def){
 const first=a();const second=b();def.expose.value('different',first!==second);
 const r={'\\u{10000}':1,'\\uE000':2};def.expose.value('result',r['\\u{10000}']<r['\\uE000']);
}});`;
  const parsed = parsePrototype(input, { fileName: 'keys.proto.ts' });
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  const emitted = emitGpuiSource(parsed.value);
  expect(emitted.ok).toBe(true);
  if (!emitted.ok) return;
  expect(emitted.value.code).toContain('"u16:d800"');
  expect(emitted.value.code).toContain('"u16:d801"');
  for (const text of [emitted.value.code, ...(emitted.value.supportingFiles ?? []).map(f => f.contents)]) {
    expect(Buffer.from(text, 'utf8').toString('utf8')).toBe(text);
  }
});
it('GPUI literal type diagnostics carry the owning parameter source span', () => {
  const body = `def.expose.method('probe',(x:'\\uD800')=>true);`;
  const ir = parse(body);
  const result = emitGpuiSource(ir);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  const realSpans = sourceSpans(ir);
  expect(result.diagnostics.length).toBeGreaterThan(0);
  for (const diagnostic of result.diagnostics) {
    expect(diagnostic.code).toBe('PUI_GPUI_STRING_UNSUPPORTED');
    expect(diagnostic.span).toBeDefined();
    expect(realSpans.has(JSON.stringify(diagnostic.span))).toBe(true);
    expect(diagnostic.span?.file).toBe('relational.proto.ts');
    expect(source(body).slice(diagnostic.span!.start, diagnostic.span!.end)).toContain("x:'\\uD800'");
  }
});
for (const format of ['json', 'text'] as const) {
  it(`GPUI unsupported literal types survive the actual ${format} diagnostic formatter`, () => {
    const body = `def.expose.method('probe',(x:'\\uD800')=>true);`;
    const result = emitGpuiSource(parse(body));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    if (format === 'json') {
      expect(() => diagnosticsJson(result.diagnostics)).not.toThrow();
      const json = diagnosticsJson(result.diagnostics);
      expect(json.diagnostics.length).toBeGreaterThan(0);
      for (const diagnostic of json.diagnostics) {
        expect(diagnostic.span.file).toBe('relational.proto.ts');
        expect(source(body).slice(diagnostic.span.start, diagnostic.span.end)).toContain("x:'\\uD800'");
      }
    } else {
      const options = { sources: { 'relational.proto.ts': source(body) } };
      expect(() => formatCompilerDiagnostics(result.diagnostics, options)).not.toThrow();
      const text = formatCompilerDiagnostics(result.diagnostics, options);
      expect(text).toContain('PUI_GPUI_STRING_UNSUPPORTED');
      expect(text).toContain('relational.proto.ts:');
      expect(text).toContain("x:'\\uD800'");
      expect(text).not.toContain('source unavailable');
    }
  });
}

// These exercise admitted raw IR representations and actual emitted source.
// Typed receiver assertions are emission checks, not a substitute for rustc.
for (const operator of operators) {
  for (const rhs of ['null', 'false']) {
    for (const position of ['return', 'condition', 'not', 'logical-left']) {
      for (const nested of [false, true]) {
        it(`GPUI preserves semantic bottom for ${operator} ${rhs}, ${position}, nested=${nested}`, () => {
          const relationSource = `x${operator}${rhs}`;
          const tail = position === 'return' ? `return ${relationSource};`
            : position === 'condition' ? `if(${relationSource})return true;return false;`
            : position === 'not' ? `return !(${relationSource});`
            : `return (${relationSource})&&true;`;
          const body = `def.expose.method('compare',(x:'a')=>{if(x==='a')return false;${tail}});`;
          const ir = parse(body);
          const relations: Extract<ExpressionIR, { kind: 'binary' }>[] = [];
          const visit = (value: unknown) => {
            if (!value || typeof value !== 'object') return;
            if ('kind' in value && value.kind === 'binary' && 'operator' in value && value.operator === operator)
              relations.push(value as Extract<ExpressionIR, { kind: 'binary' }>);
            Object.values(value).forEach(visit);
          };
          visit(ir);
          expect(relations).toHaveLength(1);
          const relation = relations[0]!;
          expect(relation.type).toEqual({ kind: 'union', members: [] });
          if (nested) relation.type = { kind: 'union', members: [{ kind: 'union', members: [] }] };
          // Validator accepts both representations; emitter must not escape CompileResult.
          expect(validateIR(ir).ok).toBe(true);
          expect(() => emitGpuiSource(ir)).not.toThrow();
          const emitted = emitGpuiSource(ir);
          expect(emitted.ok).toBe(true);
          if (emitted.ok) {
            expect(emitted.value.code).toMatch(/\{ let _relational_left = [^;]+; let _relational_right = [^;]+; let _relational_result: Value = unreachable!\("uninhabited Proto relational expression"\); _relational_result \}/);
            expect(emitted.value.code).not.toContain(`scalar_number() ${operator}`);
          }
          const element = consumer(body);
          try { expect((element.getExposes() as { compare(x: string): boolean }).compare('a')).toBe(false); }
          finally { element.dispose(); element.remove(); }
        });
      }
    }
  }
}
