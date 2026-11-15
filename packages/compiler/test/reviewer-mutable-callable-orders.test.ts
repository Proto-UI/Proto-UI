// @vitest-environment node
import { expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';

const source = (body: string) => `import { definePrototype } from '@proto.ui/core';
  export default definePrototype({ name: 'mutable-callable-order', setup(def) {
    const illegal = () => { def.state.bool('flag', true); };
    const empty = () => {};
    ${body}
    return r => r.el('div', []);
  }});`;

const cases: [string, string][] = [
  [
    'record callbacks installer first',
    `
    const box = { invoke: empty };
    def.expose.method('replace', () => { box.invoke = illegal; });
    def.expose.method('invoke', () => box.invoke());`,
  ],
  [
    'record callbacks caller first',
    `
    const box = { invoke: empty };
    def.expose.method('invoke', () => box.invoke());
    def.expose.method('replace', () => { box.invoke = illegal; });`,
  ],
  [
    'lexical callbacks installer first',
    `
    let invoke = empty;
    def.expose.method('replace', () => { invoke = illegal; });
    def.expose.method('invoke', () => invoke());`,
  ],
  [
    'lexical callbacks caller first',
    `
    let invoke = empty;
    def.expose.method('invoke', () => invoke());
    def.expose.method('replace', () => { invoke = illegal; });`,
  ],
  [
    'if branch record write',
    `
    const box = { invoke: empty };
    const assign = (flag: boolean) => { if (flag) box.invoke = illegal; else box.invoke = empty; };
    assign(true);
    def.lifecycle.onCreated(() => box.invoke());`,
  ],
  [
    'conditional record write',
    `
    const box = { invoke: empty };
    const assign = (flag: boolean) => { flag ? box.invoke = illegal : box.invoke = empty; };
    assign(true);
    def.lifecycle.onCreated(() => box.invoke());`,
  ],
  [
    'nested alias field write',
    `
    const box = { invoke: empty };
    const outer = { nested: box };
    const alias = outer;
    alias.nested.invoke = illegal;
    def.lifecycle.onCreated(() => box.invoke());`,
  ],
  [
    'if branch lexical write',
    `
    let invoke = empty;
    const assign = (flag: boolean) => { if (flag) invoke = illegal; else invoke = empty; };
    assign(true);
    def.lifecycle.onCreated(() => invoke());`,
  ],
];

it.each(cases)('checks possible callback effects through %s', (_name, body) => {
  expect(parsePrototype(source(body))).toMatchObject({
    ok: false,
    diagnostics: [{ code: 'PUI1007' }],
  });
});

it.each([
  `const box = { invoke: illegal }; box.invoke = empty; def.lifecycle.onCreated(() => box.invoke());`,
  `let invoke = illegal; invoke = empty; def.lifecycle.onCreated(() => invoke());`,
])('accepts a setup overwrite that removes the dangerous callable: %s', (body) => {
  const result = parsePrototype(source(body));
  expect(result.ok, JSON.stringify(result.ok ? {} : result.diagnostics)).toBe(true);
});
