// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { PrototypeIR } from '../src/ir';

function walk(value: unknown, visit: (node: Record<string, any>) => void): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((child) => walk(child, visit));
    return;
  }
  visit(value as Record<string, any>);
  Object.values(value).forEach((child) => walk(child, visit));
}

function parsed(transport: 'direct' | 'record' | 'cell'): PrototypeIR {
  const binding =
    transport === 'record'
      ? 'const holder={get:p.get};'
      : transport === 'cell'
        ? 'let get=p.get;get=p.get;'
        : 'const get=p.get;';
  const callee = transport === 'record' ? 'holder.get' : 'get';
  const result = parsePrototype(`import {defineAsHook,definePrototype} from '@proto.ui/core';
    const asProbe=defineAsHook({name:'lookup-probe',setup(def){
      def.expose.method('read',()=>7);
      def.expose.method('other',()=> 'other');
    },projectHandle(result){return {get:result.getMethod};}});
    export default definePrototype({name:'lookup-owner',setup(def){
      const p=asProbe();${binding}
      def.expose.value('got',${callee}?.('read'));
    }});`);
  expect(result.ok, JSON.stringify(result.ok ? null : result.diagnostics)).toBe(true);
  if (!result.ok) throw new Error('source baseline must parse');
  const ir = JSON.parse(JSON.stringify(result.value));
  expect(validateIR(ir)).toMatchObject({ ok: true });
  return ir;
}

describe('capture getter lookup metadata is a complete key map', () => {
  for (const transport of ['direct', 'record', 'cell'] as const)
    it.each(['all', 'read'] as const)(
      `rejects deleting %s lookup entries through ${transport} provenance`,
      (deletion) => {
        const ir = parsed(transport);
        let calls = 0,
          maps = 0;
        walk(ir, (node) => {
          if (node.kind !== 'call' || node.arguments[0]?.value !== 'read') return;
          const original = node.callee;
          const type = JSON.parse(JSON.stringify(original.type));
          walk(type, (entry) => {
            if (entry.kind !== 'callable' || entry.lookup === undefined) return;
            expect(entry.lookup.map((item: any) => item.key).sort()).toEqual(['other', 'read']);
            entry.lookup =
              deletion === 'all' ? [] : entry.lookup.filter((item: any) => item.key !== 'read');
            maps++;
          });
          node.callee = { kind: 'narrow', value: original, type, span: original.span };
          node.type = 'void';
          calls++;
        });
        const exposed = ir.exposes.find((value) => value.name === 'got');
        if (!exposed || exposed.kind !== 'value') throw new Error('missing public call result');
        exposed.type = 'void';
        expect(calls).toBe(1);
        expect(maps).toBe(1);
        expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
      }
    );

  it('accepts an unchanged complete lookup map even when its key order differs', () => {
    const ir = parsed('record');
    let changed = 0;
    walk(ir, (node) => {
      if (node.kind !== 'call' || node.arguments[0]?.value !== 'read') return;
      const original = node.callee;
      const type = JSON.parse(JSON.stringify(original.type));
      walk(type, (entry) => {
        if (entry.kind === 'callable' && entry.lookup !== undefined) {
          entry.lookup.reverse();
          changed++;
        }
      });
      node.callee = { kind: 'narrow', value: original, type, span: original.span };
    });
    expect(changed).toBe(1);
    expect(validateIR(ir)).toMatchObject({ ok: true });
  });
});
