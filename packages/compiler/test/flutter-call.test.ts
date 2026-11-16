// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { emitFlutterSource } from '../src/flutter-source';
import { parsePrototype } from '../src/parser';

function emit(body: string, declarations = '') {
  const parsed = parsePrototype(
    `import {definePrototype,defineAsHook,defineHook} from '@proto.ui/core';
     ${declarations}
     export default definePrototype({name:'ordinary-dart-call',setup(def){${body}}});`,
    { fileName: 'ordinary-dart-call.proto.ts' }
  );
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  return emitFlutterSource(parsed.value);
}

describe('direct Dart ordinary calls', () => {
  it('retains a definite callable result when the source uses optional-call syntax', () => {
    const emitted = emit(`const read = () => 1; def.expose.value('value', read?.());`);
    if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
    // Empty generic arguments are invalid Dart. A non-null callable keeps its
    // checked number result; optional syntax does not add an undefined branch.
    expect(emitted.value.code).not.toContain('nativeOptionalResult<>');
  });

  for (const [label, body] of [
    [
      'local closure and immutable alias',
      `let count = 0; const read = () => { count = count + 1; return count; };
       const alias = read; def.expose.value('value', alias());`,
    ],
    [
      'checked optional parameters and explicit undefined',
      `const add = (left: number, right?: number) => left + (right ?? 2);
       def.expose.value('missing', add(1));
       def.expose.value('undefined', add(1, undefined));
       def.expose.value('present', add(1, 3));`,
    ],
    [
      'optional callable and void-valued arguments',
      `let count = 0; const effect = () => { count = count + 1; };
       const read = (value?: number) => value ?? 2;
       const absent = false ? read : undefined;
       def.expose.value('skipped', absent?.(effect()) === undefined);
       def.expose.value('consumed', read(effect()));
       def.expose.value('count', count);`,
    ],
    [
      'ordinary callable factory and void result',
      `let count = 0;
       const create = () => { count = count + 1; return () => { count = count + 1; }; };
       const empty = create()() === undefined;
       def.expose.value('empty', empty); def.expose.value('count', count);`,
    ],
  ])
    it(`emits ${label}`, () => {
      const emitted = emit(body);
      expect(emitted.ok, emitted.ok ? undefined : JSON.stringify(emitted.diagnostics)).toBe(true);
    });

  for (const [label, body] of [
    [
      'dynamic element',
      `const values = [1]; const index = 0; def.expose.value('v', values[index]);`,
    ],
    ['narrow', `const value = 1; def.expose.value('v', value!);`],
    ['intrinsic', `def.expose.value('v', Number.isFinite(1));`],
    ['object spread', `const value = {n: 1}; def.expose.value('v', {...value});`],
    ['member write', `const value = {n: 1}; value.n = 2; def.expose.value('v', value.n);`],
    [
      'structural callable record',
      `const value = {read: () => 1}; def.expose.value('v', value.read());`,
    ],
  ])
    it(`retains the unimplemented ${label} boundary`, () => {
      expect(emit(body)).toMatchObject({
        ok: false,
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: 'PUI4003',
            message: expect.stringContaining('Ordinary callable / structural value expressions'),
          }),
        ]),
      });
    });

  for (const body of [
    `const read = (value = 1) => value; def.expose.value('v', read());`,
    `const read = (callback: () => number) => callback(); def.expose.value('v', read(() => 1));`,
  ])
    it(`does not discard unsupported parameter semantics: ${body}`, () => {
      expect(emit(body)).toMatchObject({
        ok: false,
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: 'PUI4003',
            message: expect.stringContaining(
              'Checked callback parameters and per-call parameter defaults'
            ),
          }),
        ]),
      });
    });
});

describe('Dart opaque authored hook results', () => {
  it('retains the host Object representation through a returned capture', () => {
    const emitted = emit(
      `const create = () => install(); const first = create(); const second = create();
       def.expose.value('same', first === second);`,
      `const install = defineAsHook({name:'opaque',setup(){}});`
    );
    if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
    expect(emitted.value.code).toContain('as Object Function()');
    expect(emitted.value.code).toContain('nativeSame(');
  });

  it.each(['getState', 'getMethod', 'getAsHook', 'getAsHookHandle'])(
    'diagnoses %s instead of emitting a method on the opaque Object',
    (lookup) => {
      const key = lookup === 'getState' ? 'flag' : lookup === 'getMethod' ? 'read' : 'child';
      expect(
        emit(
          `const result = install(); const found = result.${lookup}('${key}');
           def.expose.value('missing', found === undefined);`,
          `const child = defineAsHook({name:'child',setup(){}});
           const install = defineAsHook({name:'capture',setup(def){
             child(); def.state.bool('flag', true); def.expose.method('read', () => true);
           }});`
        )
      ).toMatchObject({
        ok: false,
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: 'PUI4003',
            message: expect.stringContaining('Authored hook capture lookup'),
          }),
        ]),
      });
    }
  );

  for (const [label, declaration, call, diagnostic] of [
    [
      'identity projection',
      `defineAsHook({name:'projected',setup(){},projectHandle(capture){return capture;}})`,
      'install();',
      'Authored hook handle projection',
    ],
    [
      'configurator',
      `defineHook({name:'configured',mode:'configurable',setup(){},configure(){}})`,
      'install();',
      'Authored hook configuration and repeated installation',
    ],
    [
      'multiple installation',
      `defineHook({name:'multiple',mode:'multiple',setup(){}})`,
      'install(); install();',
      'Authored hook configuration and repeated installation',
    ],
    [
      'ignored effectful options',
      `defineHook<{}, {}, {}, number>({name:'options',setup(){}})`,
      `let count = 0; install(++count); def.expose.value('count', count);`,
      'Authored hook options and installation API',
    ],
    [
      'unsupplied setup API',
      `defineHook({name:'api',setup(def,options,api){}})`,
      'install();',
      'Authored hook options and installation API',
    ],
  ] as const)
    it(`diagnoses the unimplemented ${label} path`, () => {
      expect(emit(call, `const install = ${declaration};`)).toMatchObject({
        ok: false,
        diagnostics: expect.arrayContaining([
          expect.objectContaining({ code: 'PUI4003', message: expect.stringContaining(diagnostic) }),
        ]),
      });
    });
});
