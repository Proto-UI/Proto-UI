// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { ExpressionIR, PrototypeIR } from '../src/ir';

const unsafeReturn =
  "const actual=()=>({value:'safe',hidden:undefined}); const make:()=>void=actual;";
const genuineVoid = 'const actual=()=>undefined; const make:()=>void=actual;';

function source(setup: string, callback: string, json = false): string {
  return [
    "import {definePrototype} from '@proto.ui/core';",
    "export default definePrototype({name:'lexical-publication',setup(def){",
    json ? "def.expose.event('changed',{payload:'json'});" : "def.expose.event('changed');",
    setup,
    "def.event.on('press.commit',run=>{" + callback + '});',
    'return r=>r.slot();',
    '}});',
  ].join('\n');
}

const cases = [
  {
    name: 'rejects an unsafe actual return through a direct void callable view',
    setup: unsafeReturn,
    callback: "run.expose.emit('changed',make());",
    accepted: false,
  },
  {
    name: 'rejects an unsafe actual return retained by a void cell initializer',
    setup: unsafeReturn + 'let payload=make();',
    callback: "run.expose.emit('changed',payload);",
    accepted: false,
  },
  {
    name: 'rejects an unsafe actual return written into an initially undefined void cell',
    setup: unsafeReturn + 'let payload:void=undefined;',
    callback: "payload=make();run.expose.emit('changed',payload);",
    accepted: false,
  },
  {
    name: 'accepts a real overwrite with undefined before a void publication',
    setup: unsafeReturn + 'let payload=make();',
    callback: "payload=undefined;run.expose.emit('changed',payload);",
    accepted: true,
  },
  {
    name: 'accepts a real mutable number update as JSON data',
    setup: 'let count=0;',
    callback: "count+=1;run.expose.emit('changed',{count});",
    json: true,
    accepted: true,
  },
  {
    name: 'accepts a real mutable string replacement as JSON data',
    setup: "let label='first';",
    callback: "label='next';run.expose.emit('changed',{label});",
    json: true,
    accepted: true,
  },
  {
    name: 'accepts a genuinely undefined direct callable result',
    setup: genuineVoid,
    callback: "run.expose.emit('changed',make());",
    accepted: true,
  },
  {
    name: 'accepts a genuinely undefined result through a mutable void cell',
    setup: genuineVoid + 'let payload=make();',
    callback: "payload=make();run.expose.emit('changed',payload);",
    accepted: true,
  },
];

describe('lexical cells retain actual publication values', () => {
  it.each(cases)('$name', ({ setup, callback, json, accepted }) => {
    const parsed = parsePrototype(source(setup, callback, json));
    expect(parsed.ok, JSON.stringify(parsed.ok ? null : parsed.diagnostics)).toBe(accepted);
    if (parsed.ok) {
      expect(validateIR(JSON.parse(JSON.stringify(parsed.value)))).toMatchObject({ ok: true });
    } else {
      expect(parsed.diagnostics[0]).toMatchObject({
        code: 'PUI1006',
        message: expect.stringContaining('Outward JSON payload retains'),
      });
    }
  });

  it.each(['let payload=make();', 'let payload:void=undefined;'])(
    'rederives a substituted actual void-cell payload in cold IR: %s',
    (declaration) => {
      // The local unsafe graph is legal while publication really emits undefined.
      // Retain an actual lexical read, then substitute that same checked read at
      // the sink without changing types, capture bindings, or the event schema.
      const parsed = parsePrototype(
        source(
          unsafeReturn + declaration,
          "payload=make();const retained=payload;run.expose.emit('changed',undefined);"
        )
      );
      expect(parsed.ok, JSON.stringify(parsed.ok ? null : parsed.diagnostics)).toBe(true);
      if (!parsed.ok) throw new Error('cold IR control did not parse');
      const ir: PrototypeIR = JSON.parse(JSON.stringify(parsed.value));
      const reads: Extract<ExpressionIR, { kind: 'lexical-read' }>[] = [];
      const emits: Extract<ExpressionIR, { kind: 'operation' }>[] = [];
      const visit = (value: unknown): void => {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) {
          value.forEach(visit);
          return;
        }
        const node = value as ExpressionIR;
        if (node.kind === 'lexical-read' && node.type === 'void') reads.push(node);
        if (node.kind === 'operation' && node.operation === 'expose.emit') emits.push(node);
        Object.values(value).forEach(visit);
      };
      visit(ir);
      expect(reads).toHaveLength(1);
      expect(emits).toHaveLength(1);
      const read = reads[0],
        emit = emits[0];
      if (!read || !emit) throw new Error('missing checked lexical read or outward sink');
      emit.arguments[1] = JSON.parse(JSON.stringify(read));
      const checked = validateIR(ir);
      expect(checked.ok, JSON.stringify(checked.ok ? null : checked.diagnostics)).toBe(false);
      if (!checked.ok)
        expect(checked.diagnostics[0].message).toContain('Outward JSON payload retains');
    }
  );
});
