// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { emitReact } from '../src/react';
import { emitReactSource } from '../src/react-source';
import { emitVueSource } from '../src/vue-source';
import { emitVue2Source } from '../src/vue2-source';
import { emitWebComponentSource } from '../src/web-component-source';
import { emitGpuiSource } from '../src/gpui-source';
import { emitQtSource } from '../src/qt-source';
import { emitFlutterSource } from '../src/flutter-source';
import type { PrototypeIR } from '../src/ir';

function source(body: string): string {
  return `import { definePrototype } from '@proto.ui/core';
export default definePrototype({name:'portable-pointer-proof',setup(def){
  const label = 'inert';
  def.event.on('pointer.move', (_run, event) => { ${body} });
  return (r) => r.el('span', 'pointer');
}});`;
}
function parse(body: string): PrototypeIR {
  const result = parsePrototype(source(body), { fileName: 'pointer.proto.ts' });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}
/** Mutation helpers deliberately preserve malformed records for validator negative controls. */
function records(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(records);
  const record = value as Record<string, unknown>;
  return [record, ...Object.values(record).flatMap(records)];
}
function member(ir: PrototypeIR, property: string): Record<string, unknown> {
  const node = records(ir).find((node) => node.kind === 'member' && node.property === property);
  if (!node) throw new Error(`Missing test member ${property}`);
  return node;
}
/** Synthetic unit mutation only. Real old-parser artifacts are a separate external replay. */
function oldLabels(ir: PrototypeIR): PrototypeIR {
  const copy: PrototypeIR = JSON.parse(JSON.stringify(ir));
  for (const node of records(copy))
    for (const key of ['type', 'returnType'])
      if (node[key] === 'event-control' || node[key] === 'event-or-control') node[key] = 'event';
  return copy;
}
const web = [
  emitReact,
  emitReactSource,
  emitVueSource,
  emitVue2Source,
  emitWebComponentSource,
] as const;
const native = [emitGpuiSource, emitQtSource, emitFlutterSource] as const;
const ssr = [emitReactSource, emitVueSource, emitVue2Source, emitWebComponentSource] as const;

describe('portable pointer facts: capability admission', () => {
  for (const property of ['pointerType', 'pointerButtons']) {
    it(`admits ${property} only on a payload, including aliases and closure-returned payloads`, () => {
      const ir = parse(
        `const alias = event; const get = () => alias; const fact = get().${property};`
      );
      expect(validateIR(ir).ok).toBe(true);
      expect(member(ir, property).type).toMatchObject({ kind: 'union' });
      for (const emit of web) expect(emit(ir).ok, emit.name).toBe(true);
    });
    it(`rejects ${property} on a control even when all recorded labels are forged as event`, () => {
      const ir = parse(`const control = event.control; const fact = event.${property};`);
      member(ir, property).object = {
        kind: 'reference',
        name: 'control',
        type: 'event',
        span: ir.setup.span,
      };
      expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
    });
    it(`rejects direct ${property} emission on unsupported native backends`, () => {
      const ir = parse(`const fact = event.${property};`);
      for (const emit of native)
        expect(emit(ir), emit.name).toMatchObject({
          ok: false,
          diagnostics: [{ code: 'PUI4003' }],
        });
    });
  }
  it('admits a control alias operation on Web without granting payload members', () => {
    const ir = parse('const control = event.control; control.requestDefaultActionPrevention();');
    expect(
      records(ir).some((node) => node.operation === 'eventControl.requestDefaultActionPrevention')
    ).toBe(true);
    for (const emit of web) expect(emit(ir).ok, emit.name).toBe(true);
    for (const emit of native)
      expect(emit(ir), emit.name).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI4003' }] });
  });
  for (const emit of ssr) {
    it(`${emit.name} SSR rejects only the new facts and alias operation at its direct entry`, () => {
      for (const body of [
        'const fact = event.pointerType;',
        'const fact = event.pointerButtons;',
        'const control = event.control; control.requestDefaultActionPrevention();',
      ])
        expect(emit(parse(body), { ssr: true })).toMatchObject({
          ok: false,
          diagnostics: [{ code: 'PUI4003' }],
        });
      for (const body of [
        'event.control.requestDefaultActionPrevention();',
        'const control = event.control; const same = control === event;',
      ])
        expect(emit(parse(body), { ssr: true }).ok).toBe(true);
    });
  }
  it('admits unused pointer helpers only when the target actually omits their declaration', () => {
    const ir = parse('const unused = () => event.pointerType; const same = event === event;');
    expect(emitGpuiSource(ir).ok).toBe(true);
    for (const emit of ssr) expect(emit(ir, { ssr: true }).ok, emit.name).toBe(true);
    // These emitters still print unused helper bodies. They must not generate
    // NativeInput.pointerType or an unsupported Qt member merely to return ok.
    for (const emit of [emitQtSource, emitFlutterSource])
      expect(emit(ir), emit.name).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI4003' }] });
  });
  it('does not require new facts after a terminal return that all emitters omit', () => {
    const ir = parse(
      'const unused = () => { return 1; const fact = event.pointerButtons; }; const same = event === event;'
    );
    for (const emit of native) expect(emit(ir).ok, emit.name).toBe(true);
    for (const emit of ssr) expect(emit(ir, { ssr: true }).ok, emit.name).toBe(true);
  });
  it('does require pointer capability through a called helper alias', () => {
    const ir = parse(
      'const read = () => event.pointerType; const alias = read; const value = alias();'
    );
    for (const emit of native)
      expect(emit(ir), emit.name).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI4003' }] });
    for (const emit of ssr)
      expect(emit(ir, { ssr: true }), emit.name).toMatchObject({
        ok: false,
        diagnostics: [{ code: 'PUI4003' }],
      });
  });
  it('retains the original direct default-action operation', () => {
    const ir = parse('event.control.requestDefaultActionPrevention();');
    expect(
      records(ir).some((node) => node.operation === 'event.requestDefaultActionPrevention')
    ).toBe(true);
    for (const emit of [...web, ...native]) expect(emit(ir).ok, emit.name).toBe(true);
  });
  for (const body of [
    'const c = event.control; const bad = c.pointerType;',
    'const c = event.control; const bad = c.control;',
    'const c = event.control; const get = () => c; const bad = get().pointerButtons;',
    'const { control } = event; const bad = control.pointerType;',
    'const bad = event.nativeEvent;',
    'const bad = event.target;',
    'const bad = event.clientX;',
  ])
    it(`rejects unproven authority: ${body}`, () =>
      expect(parsePrototype(source(body)).ok).toBe(false));
});

describe('IR5 legacy control identity compatibility', () => {
  const bodies = [
    'const control = event.control; const alias = control; const same = alias === control;',
    'const control = event.control; const get = () => control; const same = get() === control;',
    'const control = event.control; const choose = (flag: boolean) => { if (flag) return event; return control; }; const mixed = choose(true); const same = mixed === event;',
    'const control = event.control; const choose = (flag: boolean) => { if (flag) return control; return event; }; const get = () => choose(false); const same = get() !== control;',
  ];
  for (const body of bodies)
    it(`normalizes only proven old event labels: ${body}`, () => {
      const old = oldLabels(parse(body));
      const before = JSON.stringify(old);
      const checked = validateIR(old);
      expect(checked.ok).toBe(true);
      expect(JSON.stringify(old)).toBe(before);
      if (!checked.ok) return;
      expect(checked.value).not.toBe(old);
      expect(checked.value.schemaVersion).toBe(5);
      const again = validateIR(checked.value);
      expect(again.ok).toBe(true);
      if (again.ok) expect(again.value).toBe(checked.value);
      for (const emit of [...web, ...native]) expect(emit(old).ok, emit.name).toBe(true);
    });
  for (const guard of ['mixed === event', '!(mixed !== event)'])
    it(`positive identity narrows an inert join: ${guard}`, () => {
      const ir = parse(`const control = event.control;
      const choose = (flag: boolean) => { if (flag) return event; return control; };
      const mixed = choose(true); if (${guard}) { const fact = mixed.pointerType; }`);
      expect(records(ir).some((node) => node.returnType === 'event-or-control')).toBe(true);
      expect(validateIR(ir).ok).toBe(true);
      for (const emit of web) expect(emit(ir).ok, emit.name).toBe(true);
    });
  for (const guard of ['mixed !== event', 'mixed === mixed', 'mixed', 'event === event'])
    it(`does not narrow by insufficient proof: ${guard}`, () => {
      const result = parsePrototype(
        source(`const control = event.control;
      const choose = (flag: boolean) => { if (flag) return event; return control; };
      const mixed = choose(true); if (${guard}) { const fact = mixed.pointerType; }`)
      );
      expect(result.ok).toBe(false);
    });
  it('unreachable control returns do not erase a proven payload return', () => {
    const ir = parse(
      'const get = () => { return event; return event.control; }; const fact = get().pointerType;'
    );
    expect(validateIR(ir).ok).toBe(true);
    for (const emit of web) expect(emit(ir).ok, emit.name).toBe(true);
  });
  it('a legacy event label on a mixed value does not create pointer authority', () => {
    const ir = oldLabels(
      parse(`const control = event.control;
      const choose = (flag: boolean) => { if (flag) return event; return control; };
      const mixed = choose(true); const fact = event.pointerType;`)
    );
    member(ir, 'pointerType').object = {
      kind: 'reference',
      name: 'mixed',
      type: 'event',
      span: ir.setup.span,
    };
    expect(validateIR(ir).ok).toBe(false);
  });
  it('does not accept a forged callback control parameter', () => {
    const ir = parse('const same = event === event;');
    const callback = records(ir).find((node) => node.context === 'event');
    if (!callback || !Array.isArray(callback.parameters)) throw new Error('Missing callback');
    const parameter = callback.parameters[1] as Record<string, unknown>;
    parameter.type = 'event-control';
    expect(validateIR(ir).ok).toBe(false);
  });
});

describe('IR data safety before canonical normalization', () => {
  function legacy(): PrototypeIR {
    return oldLabels(parse('const control = event.control; const same = control === control;'));
  }
  it('normalizes a recursively frozen legacy graph without mutation', () => {
    const ir = legacy();
    function freeze(value: unknown): void {
      if (!value || typeof value !== 'object') return;
      for (const child of Object.values(value)) freeze(child);
      Object.freeze(value);
    }
    freeze(ir);
    const before = JSON.stringify(ir);
    const result = validateIR(ir);
    expect(result.ok).toBe(true);
    expect(JSON.stringify(ir)).toBe(before);
    if (result.ok) {
      expect(result.value).not.toBe(ir);
      expect(validateIR(result.value).ok).toBe(true);
    }
  });
  it('rejects a nested Proxy without invoking its traps', () => {
    const ir = legacy();
    let traps = 0;
    const literal = records(ir).find((node) => node.kind === 'literal');
    if (!literal) throw new Error('Missing literal');
    literal.handle = new Proxy(
      {},
      {
        get() {
          traps++;
          throw new Error('get');
        },
        getPrototypeOf() {
          traps++;
          throw new Error('prototype');
        },
        ownKeys() {
          traps++;
          throw new Error('keys');
        },
      }
    );
    expect(validateIR(ir).ok).toBe(false);
    expect(traps).toBe(0);
  });
  it('rejects a nested array accessor before reading its index', () => {
    const ir = legacy();
    let calls = 0;
    Object.defineProperty(ir.setup.body, '0', {
      enumerable: true,
      get() {
        calls++;
        return null;
      },
    });
    expect(validateIR(ir).ok).toBe(false);
    expect(calls).toBe(0);
  });
  it('rejects an unused literal.handle getter without invoking it', () => {
    const ir = legacy();
    let calls = 0;
    const literal = records(ir).find((node) => node.kind === 'literal');
    if (!literal) throw new Error('Missing literal');
    literal.handle = Object.defineProperty({}, 'payload', {
      enumerable: true,
      get() {
        calls++;
        return 'leak';
      },
    });
    expect(validateIR(ir).ok).toBe(false);
    expect(calls).toBe(0);
  });
  for (const payload of [Object.create({ foreign: true }), () => 'executable', Symbol('not-data')])
    it(`rejects unused foreign data (${typeof payload}) before copy`, () => {
      const ir = legacy();
      const literal = records(ir).find((node) => node.kind === 'literal');
      if (!literal) throw new Error('Missing literal');
      literal.handle = payload;
      expect(validateIR(ir).ok).toBe(false);
    });
  it('rejects cycles before walking semantics', () => {
    const ir = legacy();
    const literal = records(ir).find((node) => node.kind === 'literal');
    if (!literal) throw new Error('Missing literal');
    literal.handle = ir;
    expect(validateIR(ir).ok).toBe(false);
  });
  it('rejects a Proxy without running any traps', () => {
    let traps = 0;
    const ir = new Proxy(legacy(), {
      get() {
        traps++;
        throw new Error('get');
      },
      getPrototypeOf() {
        traps++;
        throw new Error('prototype');
      },
      ownKeys() {
        traps++;
        throw new Error('keys');
      },
    });
    expect(validateIR(ir).ok).toBe(false);
    expect(traps).toBe(0);
  });
  it('rejects harmless but kind-inapplicable fields rather than copying them', () => {
    const ir = legacy();
    const literal = records(ir).find((node) => node.kind === 'literal');
    if (!literal) throw new Error('Missing literal');
    literal.handle = { payload: 'unused' };
    expect(validateIR(ir).ok).toBe(false);
  });
});

describe('shared FunctionIR lexical capture provenance', () => {
  function twoCallbacks(first: string, second: string, setup = ''): PrototypeIR {
    const result = parsePrototype(
      `import { definePrototype } from '@proto.ui/core';
      export default definePrototype({name:'shared-capture-proof',setup(def){
        ${setup}
        def.event.on('pointer.move', (_run,event) => { ${first} });
        def.event.on('pointer.enter', (_run,event) => { ${second} });
      }});`,
      { fileName: 'shared-capture.proto.ts' }
    );
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    return result.value;
  }
  function functionValues(ir: PrototypeIR, name: string): Record<string, unknown>[] {
    return records(ir)
      .filter((node) => node.kind === 'const' && node.name === name)
      .map((node) => {
        const value = node.value;
        if (
          !value ||
          typeof value !== 'object' ||
          (value as Record<string, unknown>).kind !== 'function'
        )
          throw new Error(`Expected function declaration ${name}`);
        return value as Record<string, unknown>;
      });
  }
  function share(ir: PrototypeIR, name: string): void {
    const values = functionValues(ir, name);
    if (values.length !== 2) throw new Error(`Expected two declarations of ${name}`);
    values[1].function = values[0].function;
  }
  const safe = 'const h = () => {};';
  const unsafe =
    'const h = () => { const c = event.control; c.requestDefaultActionPrevention(); };';
  const wrappers = [
    'const f = () => { h(); }; f();',
    'const alias = h; const f = () => { alias(); }; f();',
    'const f = () => { const nested = () => { h(); }; nested(); }; f();',
  ];
  for (const reverse of [false, true])
    for (const wrapper of wrappers)
      it(`rejects one shared body with different helper captures (reverse=${reverse}, ${wrapper})`, () => {
        const ir = twoCallbacks(
          (reverse ? unsafe : safe) + wrapper,
          (reverse ? safe : unsafe) + wrapper
        );
        share(ir, 'f');
        expect(validateIR(ir)).toMatchObject({
          ok: false,
          diagnostics: [{ code: 'PUI2002', message: expect.stringMatching(/capture provenance/) }],
        });
        for (const emit of ssr)
          expect(emit(ir, { ssr: true })).toMatchObject({
            ok: false,
            diagnostics: [{ code: 'PUI2002' }],
          });
      });
  it('checks a shared captured helper transitively instead of trusting its void result', () => {
    const wrapper = 'const h = () => { k(); }; const f = () => { h(); }; f();';
    const ir = twoCallbacks(
      'const k = () => {};' + wrapper,
      'const k = () => { const c = event.control; c.requestDefaultActionPrevention(); };' + wrapper
    );
    share(ir, 'f');
    share(ir, 'h');
    expect(validateIR(ir)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI2002', message: expect.stringMatching(/capture provenance/) }],
    });
  });
  it('allows a shared body with the same actual helper capture and extra unrelated locals', () => {
    const ir = parse(
      'const h = () => {}; const f = () => { h(); }; const unrelated = 1; const g = () => { h(); }; f(); g();'
    );
    const first = functionValues(ir, 'f')[0],
      second = functionValues(ir, 'g')[0];
    if (!first || !second) throw new Error('Missing local functions');
    second.function = first.function;
    expect(validateIR(ir).ok).toBe(true);
    for (const emit of ssr) expect(emit(ir, { ssr: true }).ok).toBe(true);
  });
  it('allows the same outer capture across callbacks and ordinary shared source spans', () => {
    const wrapper = 'const f = () => { h(); }; f();';
    const ir = twoCallbacks(wrapper, wrapper, 'const h = () => {};');
    share(ir, 'f');
    for (const node of records(ir)) if (Object.hasOwn(node, 'span')) node.span = ir.setup.span;
    expect(validateIR(ir).ok).toBe(true);
    for (const emit of ssr) expect(emit(ir, { ssr: true }).ok).toBe(true);
  });
  it('does not mistake a shadowing parameter for a capture when parameter records are shared', () => {
    const ir = parse(
      'const h1 = (flag: boolean) => { const f = (flag: boolean) => flag; return f(flag); }; const h2 = (flag: boolean) => { const f = (flag: boolean) => flag; return f(flag); }; const same = h1(true) === h2(false);'
    );
    const outer = functionValues(ir, 'h1')[0]?.function;
    const values = functionValues(ir, 'f');
    const inner = values[0]?.function;
    if (!outer || typeof outer !== 'object' || !inner || typeof inner !== 'object')
      throw new Error('Missing parameter owners');
    const outerParameters = (outer as Record<string, unknown>).parameters;
    const innerParameters = (inner as Record<string, unknown>).parameters;
    if (!Array.isArray(outerParameters) || !Array.isArray(innerParameters))
      throw new Error('Missing parameter lists');
    innerParameters[0] = outerParameters[0];
    if (values.length !== 2) throw new Error('Expected two inner functions');
    values[1].function = values[0].function;
    expect(validateIR(ir).ok).toBe(true);
  });
  it('allows matching legacy control-return captures despite normalized helper wrappers', () => {
    const ir = oldLabels(
      parse(
        'const c = event.control; const h = () => c; const f = () => h(); const g = () => h(); const same = f() === g();'
      )
    );
    const first = functionValues(ir, 'f')[0],
      second = functionValues(ir, 'g')[0];
    if (!first || !second) throw new Error('Missing local functions');
    second.function = first.function;
    const before = JSON.stringify(ir);
    const checked = validateIR(ir);
    expect(checked.ok).toBe(true);
    expect(JSON.stringify(ir)).toBe(before);
    if (checked.ok) expect(validateIR(checked.value).ok).toBe(true);
  });
});

describe('callback expression exact-kind boundary', () => {
  for (const field of ['handle', 'value'])
    it(`rejects an inert callback-only extra ${field}`, () => {
      const ir = parse('const same = event === event;');
      const callback = records(ir).find(
        (node) =>
          node.kind === 'function' &&
          node.function &&
          typeof node.function === 'object' &&
          (node.function as Record<string, unknown>).context === 'event'
      );
      if (!callback) throw new Error('Missing callback expression');
      callback[field] = { payload: 'unused' };
      expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
    });
  it('does not accept an incorrect callback expression type label', () => {
    const ir = parse('const same = event === event;');
    const callback = records(ir).find(
      (node) =>
        node.kind === 'function' &&
        node.function &&
        typeof node.function === 'object' &&
        (node.function as Record<string, unknown>).context === 'event'
    );
    if (!callback) throw new Error('Missing callback expression');
    callback.type = 'event';
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });
});
