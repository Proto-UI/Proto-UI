// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import { emitFlutterSource } from '../src/flutter-source';
import { validateIR } from '../src/ir-validation';
import { parsePrototype } from '../src/parser';
import { emitQtSource } from '../src/qt-source';
import { emitReactSource } from '../src/react-source';
import { emitVueSource } from '../src/vue-source';
import { emitVue2Source } from '../src/vue2-source';
import { emitWebComponentSource } from '../src/web-component-source';
import type { ExpressionIR, PrototypeIR, StatementIR } from '../src/ir';

const source = readFileSync(new URL('./fixtures/exception-flow.proto.ts', import.meta.url), 'utf8');

function parsed(exportName = 'default'): PrototypeIR {
  const result = parsePrototype(source, { fileName: 'exception-flow.proto.ts', exportName });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function visit(value: unknown, action: (node: Record<string, unknown>) => void): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item) => visit(item, action));
    return;
  }
  // This is a parsed IR object under deliberate test mutation, not raw input admission.
  const node = value as Record<string, unknown>;
  action(node);
  for (const [key, child] of Object.entries(node))
    if (key !== 'type' && key !== 'span') visit(child, action);
}

describe('authored exception source admission', () => {
  it.each([
    'react-runtime-v1', 'react-dom-source-v1', 'vue-source-v1', 'vue2-source-v1',
    'web-component-source-v1', 'gpui-source-v1',
  ])('preserves thrown data and finalizer control flow through %s', (profile) => {
    for (const exportName of ['default', 'FinallyRenderer']) {
      const result = compilePrototype(source, { profile, exportName, fileName: 'exception-flow.proto.ts' });
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      expect(result.ok).toBe(true);
      expect(validateIR(result.value.ir).ok).toBe(true);
    }
  });

  it.each([
    'react-dom-ssr-v1', 'vue-ssr-v1', 'vue2-ssr-v1', 'web-component-ssr-v1',
  ])('retains the explicit unimplemented registry boundary for %s', (profile) => {
    for (const exportName of ['default', 'FinallyRenderer'])
      expect(compilePrototype(source, { profile, exportName, fileName: 'exception-flow.proto.ts' }))
        .toMatchObject({ ok: false, diagnostics: [{ code: 'PUI4001', category: 'unsupported-input' }] });
  });

  it.each([
    { profile: 'react-dom-ssr-v1', emit: emitReactSource },
    { profile: 'vue-ssr-v1', emit: emitVueSource },
    { profile: 'vue2-ssr-v1', emit: emitVue2Source },
    { profile: 'web-component-ssr-v1', emit: emitWebComponentSource },
  ])('covers exception lowering through the existing direct $profile experiment', ({ emit }) => {
    // Existing ssr:true entry points are experiments; success does not activate a registry profile.
    for (const exportName of ['default', 'FinallyRenderer']) {
      const result = emit(parsed(exportName), { ssr: true });
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      expect(result.ok).toBe(true);
    }
  });

  it('infers only reachable returned values when a finalizer replaces return or throw', () => {
    const ir = parsed();
    const methods = ir.exposes.filter((entry) => entry.kind === 'method');
    expect(methods.find((entry) => entry.name === 'finalThrow')?.returnType).toBe('boolean');
    expect(methods.find((entry) => entry.name === 'finalReturn')?.returnType).toBe('string');
    expect(methods.find((entry) => entry.name === 'uncaughtFalsy')?.returnType).toBe('void');
    expect(methods.find((entry) => entry.name === 'caughtScope')?.returnType).toBe('boolean');
  });

  it('keeps dormant Qt and Flutter emitters exhaustive without activating either profile', () => {
    const ir = parsed();
    expect(emitQtSource(ir).ok).toBe(true);
    expect(emitFlutterSource(ir).ok).toBe(true);
  });

  it('does not turn a source assertion over a catch into public State or data authority', () => {
    for (const action of [
      "def.expose.value('leak', error as {code:string});",
      "def.expose.state('leak', error as {get:()=>boolean});",
    ]) {
      expect(parsePrototype(`import {definePrototype} from '@proto.ui/core';
        export default definePrototype({name:'opaque-catch',setup(def){
          try {throw {code:'private'};} catch(error) {${action}}
        }});`)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
    }
  });

  it('independently rejects forged exception-member types and malformed control flow', () => {
    const forged = parsed();
    let changed = false;
    visit(forged, (node) => {
      if (changed || node.kind !== 'member') return;
      // The entire object is already parser-produced; mutate only the asserted result type.
      const member = node as unknown as Extract<ExpressionIR, { kind: 'member' }>;
      if (member.object.type !== 'exception') return;
      member.type = 'state:boolean';
      changed = true;
    });
    expect(changed).toBe(true);
    expect(validateIR(forged)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });

    const malformed = parsed();
    let removed = false;
    visit(malformed, (node) => {
      if (removed || node.kind !== 'try') return;
      // Deliberately break a validated statement's required catch/finally alternative.
      const statement = node as unknown as Extract<StatementIR, { kind: 'try' }>;
      delete statement.catch;
      delete statement.finally;
      removed = true;
    });
    expect(removed).toBe(true);
    expect(validateIR(malformed)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });
});
