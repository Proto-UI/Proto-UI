// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import type { ExpressionIR, PrototypeIR } from '../src/ir';
import { validateIR } from '../src/ir-validation';
import { parsePrototype } from '../src/parser';

const profiles = [
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
] as const;

const shapes = [
  ['direct', 'payload', '{value:0}'],
  ['nested', '{ nested: { payload } }', '{nested:{payload:{value:0}}}'],
  ['union', 'run.props.get().plain ? { value: 0 } : payload', '{value:0}'],
] as const;

function program(body: string, getter = "def.expose.value('illegal',7);return 7;") {
  return `import {definePrototype} from '@proto.ui/core';
    export default definePrototype({name:'getter-publication-admission',setup(def){
      def.props.define({plain:{type:'boolean',default:false}});
      def.expose.event('changed',{payload:'json'});
      const payload={get value():number{${getter}}};
      def.lifecycle.onCreated(run=>{${body}});
      return r=>r.slot();
    }});`;
}

function checked(source: string): PrototypeIR {
  const parsed = parsePrototype(source);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const cold = validateIR(JSON.parse(JSON.stringify(parsed.value)));
  if (!cold.ok) throw new Error(JSON.stringify(cold.diagnostics));
  return cold.value;
}

function expressions(value: unknown): ExpressionIR[] {
  if (value === null || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(expressions);
  const object = value as Record<string, unknown>;
  const current =
    typeof object.kind === 'string' && 'type' in object && 'span' in object
      ? [object as unknown as ExpressionIR]
      : [];
  return [...current, ...Object.values(object).flatMap(expressions)];
}

describe('getter authority at public event payload boundaries', () => {
  it.each(shapes)('rejects a %s accessor without invoking it to publish its data', (_, payload) => {
    for (const getter of [
      'return 7;',
      "throw 'getter';",
      "def.expose.value('illegal',7);return 7;",
    ])
      expect(
        parsePrototype(program(`run.expose.emit('changed',${payload});`, getter))
      ).toMatchObject({
        ok: false,
        diagnostics: [
          {
            code: 'PUI1006',
            message: 'Outward payload does not match its declared data boundary.',
          },
        ],
      });
  });

  it.each(profiles)('rejects setup-only getter authority through the %s entry point', (profile) => {
    expect(
      compilePrototype(program("run.expose.emit('changed',payload);"), { profile })
    ).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI1006', message: 'Outward payload does not match its declared data boundary.' },
      ],
    });
  });

  it.each(shapes)(
    'independently rejects a %s getter payload in cold IR',
    (_, payload, snapshot) => {
      // Creating/inspecting an accessor object is lawful. This independently parsed
      // graph gives the cold validator a real checked binding, not a forged type.
      const ir = checked(
        program(`
      const candidate=${payload};
      typeof candidate;
      run.expose.emit('changed',${snapshot});
    `)
      );
      const nodes = expressions(ir);
      const observation = nodes.find((node) => node.kind === 'intrinsic' && node.name === 'typeof');
      const publication = nodes.find(
        (node) => node.kind === 'operation' && node.operation === 'expose.emit'
      );
      if (observation?.kind !== 'intrinsic' || publication?.kind !== 'operation')
        throw new Error(
          'Expected the independently checked candidate observation and publication.'
        );
      publication.arguments[1] = JSON.parse(JSON.stringify(observation.arguments[0]));
      const cold = validateIR(JSON.parse(JSON.stringify(ir)));
      expect(cold.ok).toBe(false);
      if (!cold.ok)
        expect(
          cold.diagnostics.some((diagnostic) =>
            diagnostic.message.includes('Event payload does not match the declared signature.')
          )
        ).toBe(true);
    }
  );

  it.each(profiles)('preserves readonly data and explicit getter snapshots in %s', (profile) => {
    for (const payload of ['Object.freeze({value:7})', '{...payload}', '{value:payload.value}']) {
      const source = program(`run.expose.emit('changed',${payload});`, 'return 7;');
      checked(source);
      const result = compilePrototype(source, { profile });
      expect(result.ok, JSON.stringify(result.ok ? {} : result.diagnostics)).toBe(true);
    }
  });

  it('keeps explicit getter reads subject to their actual callback phase', () => {
    for (const payload of ['{...payload}', '{value:payload.value}'])
      expect(parsePrototype(program(`run.expose.emit('changed',${payload});`))).toMatchObject({
        ok: false,
        diagnostics: [{ code: 'PUI1007', message: expect.stringMatching(/phase|setup|callback/i) }],
      });
  });
});
