// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { emitFlutterSource } from '../src/flutter-source';
import { parsePrototype } from '../src/parser';

function emit(body: string) {
  const parsed = parsePrototype(
    `import {definePrototype} from '@proto.ui/core';
     export default definePrototype({name:'ordinary-dart-call',setup(def){${body}}});`,
    { fileName: 'ordinary-dart-call.proto.ts' }
  );
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  return emitFlutterSource(parsed.value);
}

describe('direct Dart ordinary calls', () => {
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
