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

it.each([
  [
    'a previously exposed record receives a dangerous function',
    `
    const box = { invoke: empty };
    def.expose.value('box', box);
    def.expose.method('replace', () => { box.invoke = illegal; });`,
  ],
  [
    'a returned public record receives a dangerous function',
    `
    const box = { invoke: empty };
    def.expose.method('read', () => box);
    def.expose.method('replace', () => { box.invoke = illegal; });`,
  ],
  [
    'a returning branch retains its write',
    `
    const box = { invoke: empty };
    const assign = (flag: boolean) => { if(flag) { box.invoke = illegal; return; } box.invoke = empty; };
    assign(true); def.lifecycle.onCreated(() => box.invoke());`,
  ],
  [
    'an exceptional branch retains its write',
    `
    const box = { invoke: empty };
    const assign = (flag: boolean) => { try { box.invoke = illegal; if(flag) throw 'stop'; box.invoke = empty; } catch {} };
    assign(true); def.lifecycle.onCreated(() => box.invoke());`,
  ],
  [
    'a callback can mutate and throw before a later public call',
    `
    const box = { invoke: empty };
    def.expose.method('invoke', () => box.invoke());
    def.expose.method('replace', (flag: boolean) => { if(flag) { box.invoke = illegal; throw 'stop'; } box.invoke = empty; throw 'stop'; });`,
  ],
  [
    'a callback installs a closure produced by a factory',
    `
    const make = () => () => illegal();
    const box = { invoke: empty };
    def.expose.method('invoke', () => box.invoke());
    def.expose.method('replace', () => { box.invoke = make(); });`,
  ],
  [
    'a supplied optional argument can skip a default overwrite',
    `
    const box = { invoke: illegal };
    def.expose.method('invoke', (set: () => void = (box.invoke = empty)) => box.invoke());`,
  ],
])('does not erase a possible effect when %s', (_name, body) => {
  expect(parsePrototype(source(body))).toMatchObject({
    ok: false,
    diagnostics: [{ code: 'PUI1007' }],
  });
});

it.each([
  [
    'a catch removes the dangerous callable',
    `
    const box = { invoke: illegal };
    try { throw 'stop'; } catch { box.invoke = empty; }
    def.lifecycle.onCreated(() => box.invoke());`,
  ],
  [
    'a finally removes the dangerous callable',
    `
    let invoke = illegal;
    try { throw 'stop'; } catch {} finally { invoke = empty; }
    def.lifecycle.onCreated(() => invoke());`,
  ],
  [
    'each callback clears its own invocation slot first',
    `
    const box = { invoke: empty };
    def.expose.method('replace', () => { box.invoke = illegal; });
    def.expose.method('invoke', () => { box.invoke = empty; box.invoke(); });`,
  ],
  [
    'a default overwrite certainly runs when no argument is supplied',
    `
    const box = { invoke: illegal };
    const assign = (set: () => void = (box.invoke = empty)) => {};
    assign(); def.lifecycle.onCreated(() => box.invoke());`,
  ],
  [
    'a public callable argument follows its explicit host signature',
    `
    def.expose.method('invoke', (callback: () => number) => callback());`,
  ],
  [
    'a public callback factory follows its explicit host signature',
    `
    def.expose.method('invoke', (factory: () => (() => number)) => factory()());`,
  ],
])('preserves legal callable flow when %s', (_name, body) => {
  const result = parsePrototype(source(body));
  expect(result.ok, JSON.stringify(result.ok ? {} : result.diagnostics)).toBe(true);
});

const rawCapture = (
  escape: string
) => `import {definePrototype, defineAsHook} from '@proto.ui/core';
  const install = defineAsHook({name:'raw-setup-method', setup(def) {
    const flag = def.state.bool('flag', false);
    def.expose.method('prime', () => flag.setDefault(true));
  }});
  export default definePrototype({name:'raw-setup-consumer', setup(def) {
    const capture = install(); const prime = capture.getMethod?.('prime'); prime?.(); ${escape}
  }});`;

it('retains raw captured setup calls before a public callback boundary', () => {
  const result = parsePrototype(rawCapture(''));
  expect(result.ok, JSON.stringify(result.ok ? {} : result.diagnostics)).toBe(true);
});
it('checks the same raw method when it is explicitly returned to the public caller', () => {
  expect(parsePrototype(rawCapture(`def.expose.method('readPrime', () => prime);`))).toMatchObject({
    ok: false,
    diagnostics: [{ code: 'PUI1007', message: expect.stringContaining('state.setDefault') }],
  });
});
