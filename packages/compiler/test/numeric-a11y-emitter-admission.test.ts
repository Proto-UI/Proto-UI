// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  emitFlutterSource,
  emitQtSource,
  emitReact,
  emitReactSource,
  emitVueSource,
  emitVue2Source,
  emitWebComponentSource,
  parsePrototype,
} from '../src/index';
import type { PrototypeIR } from '../src/ir';

const fileName = 'numeric-a11y-emitter.proto.ts';
const imports = `import {definePrototype,defineAsHook} from '@proto.ui/core';
  import {asAccessible} from '@proto.ui/hooks';`;
const action = `const accessible=asAccessible();
  accessible.action('setValue',{event:'host:numeric'});`;
const state = `const count=def.state.numberDiscrete('count',0);def.expose.state('count',count);`;
function prototype(body: string, declarations = ''): string {
  return `${imports}${declarations}
    export default definePrototype({name:'numeric-a11y-emitter',setup(def){
      ${body}return r=>r.slot();
    }});`;
}
function parse(source: string): PrototypeIR {
  const result = parsePrototype(source, { fileName });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}
function listener(body: string): PrototypeIR {
  return parse(prototype(`${action}${state}def.event.on('host:numeric',(_run,event)=>{${body}});`));
}
const unsupportedEmitters = [
  emitQtSource,
  emitFlutterSource,
  emitReact,
  emitReactSource,
  emitVueSource,
  emitVue2Source,
  emitWebComponentSource,
].map((emit) => ({ name: emit.name, emit }));
const repairedEmitters = [emitQtSource, emitFlutterSource, emitReact].map((emit) => ({
  name: emit.name,
  emit,
}));

describe('numeric accessibility payload admission at public emitter entries', () => {
  it.each(unsupportedEmitters)(
    '$name rejects a consumed numeric value without compilePrototype',
    ({ emit }) => {
      const result = emit(listener('count.set(event.value);'));
      expect(result).toMatchObject({
        ok: false,
        diagnostics: [
          {
            code: 'PUI4003',
            category: 'unsupported-input',
            message: expect.stringContaining('Numeric accessibility action payloads'),
            span: expect.objectContaining({ file: fileName }),
          },
        ],
      });
    }
  );

  describe.each(repairedEmitters)('$name emitted declaration closure', ({ emit }) => {
    it.each([
      'const payload=event;const read=()=>payload.value;count.set(read());',
      'const control=event.control;control.requestDefaultActionPrevention();',
    ])('rejects consumed payload members through %s', (body) => {
      expect(emit(listener(body))).toMatchObject({
        ok: false,
        diagnostics: [
          {
            code: 'PUI4003',
            message: expect.stringContaining('Numeric accessibility action payloads'),
          },
        ],
      });
    });

    it('keeps an ordinary host event with no numeric payload contract', () => {
      const ir = parse(
        prototype(`${state}def.event.on('host:ordinary',(_run,event)=>{count.set(1);});`)
      );
      const result = emit(ir);
      expect(result.ok, JSON.stringify(result.ok ? {} : result.diagnostics)).toBe(true);
    });

    it('does not reject an action declaration without a consumed numeric payload', () => {
      const result = emit(parse(prototype(action)));
      expect(result.ok, JSON.stringify(result.ok ? {} : result.diagnostics)).toBe(true);
    });

    it('allows a numeric member in an unused local function that pruning removes', () => {
      const result = emit(listener('const unused=()=>event.value;count.set(1);'));
      expect(result.ok, JSON.stringify(result.ok ? {} : result.diagnostics)).toBe(true);
      if (result.ok) expect(result.value.code).not.toContain('unused');
    });

    it('checks unreferenced Hook setup bodies that the emitter still prints', () => {
      const ir = parse(
        prototype(
          'const unused=()=>useNumeric();',
          `const useNumeric=defineAsHook({name:'numeric-child',setup(def){
            ${action}${state}def.event.on('host:numeric',(_run,event)=>{count.set(event.value);});
          }});`
        )
      );
      expect(emit(ir)).toMatchObject({
        ok: false,
        diagnostics: [
          {
            code: 'PUI4003',
            message: expect.stringContaining('Numeric accessibility action payloads'),
          },
        ],
      });
    });
  });

  it('checks an unreferenced Hook projection that React Runtime still emits', () => {
    const ir = parse(
      prototype(
        'const unused=()=>useNumeric();',
        `import type {A11ySetValueEventPayload} from '@proto.ui/core';
        const useNumeric=defineAsHook({name:'numeric-projection',setup(){},projectHandle(){
          return (event:A11ySetValueEventPayload)=>event.value;
        }});`
      )
    );
    expect(emitReact(ir)).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: 'PUI4003',
          message: expect.stringContaining('Numeric accessibility action payloads'),
          span: expect.objectContaining({ file: fileName }),
        },
      ],
    });
  });

  it.each(['return;', "throw 'finished';"])(
    'follows actual emitted statements after %s',
    (terminal) => {
      const ir = listener(`${terminal}count.set(event.value);`);
      for (const emit of [emitQtSource, emitFlutterSource]) {
        const result = emit(ir);
        expect(result.ok, JSON.stringify(result.ok ? {} : result.diagnostics)).toBe(true);
      }
      // React Runtime preserves these statements in its editable source output.
      expect(emitReact(ir)).toMatchObject({
        ok: false,
        diagnostics: [
          {
            code: 'PUI4003',
            message: expect.stringContaining('Numeric accessibility action payloads'),
          },
        ],
      });
    }
  );
});
