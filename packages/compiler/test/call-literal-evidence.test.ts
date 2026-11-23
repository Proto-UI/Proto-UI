// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';

const source = (argument: string) => `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'literal-call-proof',setup(def){
  function consume(config:{completion?:{kind:'presentation';timeoutMs:number}|{kind:'manual'}}):number{return 42;}
  def.expose.value('answer',consume(${argument}));
  return()=>null;
}});`;

describe('literal evidence at ordinary call boundaries', () => {
  it('cold-validates recursively checked literal discriminants without an assertion', () => {
    const result = parsePrototype(source("{completion:{kind:'presentation',timeoutMs:500}}"));
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(validateIR(JSON.parse(JSON.stringify(result.value)))).toMatchObject({ ok: true });
  });

  it.each([
    "{completion:{kind:'presentation',timeoutMs:'late'}}",
    "{completion:{kind:'missing',timeoutMs:500}}",
    "{completion:{kind:'manual',authority:def}}",
  ])('does not grant a wrong type or erase runtime authority: %s', (argument) => {
    expect(parsePrototype(source(argument)).ok).toBe(false);
  });

  it('does not recover a stale discriminator from a mutable record initializer', () => {
    const input = source('config').replace(
      "def.expose.value('answer'",
      "const config={completion:{kind:'presentation',timeoutMs:500}};config.completion.kind='wrong';def.expose.value('answer'"
    );
    expect(parsePrototype(input).ok).toBe(false);
  });

  it('checks cold literal node provenance before using contents as evidence', () => {
    const result = parsePrototype(source("{completion:{kind:'presentation',timeoutMs:500}}"));
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    const forged = JSON.parse(JSON.stringify(result.value));
    const change = (value: any): void => {
      if (!value || typeof value !== 'object') return;
      if (value.kind === 'literal' && value.value === 500) value.type = 'string';
      for (const child of Object.values(value)) change(child);
    };
    change(forged);
    expect(validateIR(forged)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });
});
