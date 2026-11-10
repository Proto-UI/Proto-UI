// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import { validateIR } from '../src/ir-validation';
import { parsePrototype } from '../src/parser';
import { emitReactSource } from '../src/react-source';
import { emitVueSource } from '../src/vue-source';
import { emitVue2Source } from '../src/vue2-source';
import { emitWebComponentSource } from '../src/web-component-source';
import type { ExpressionIR, PrototypeIR } from '../src/ir';

const scalarSource = readFileSync(new URL('./fixtures/lexical-values.proto.ts', import.meta.url), 'utf8');
const moduleSource = readFileSync(new URL('./fixtures/module-lexical-values.proto.ts', import.meta.url), 'utf8');

function parsed(source = scalarSource, exportName = 'default'): PrototypeIR {
  const result = parsePrototype(source, { exportName });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function visit(value: unknown, action: (expression: ExpressionIR) => void): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item) => visit(item, action));
    return;
  }
  const record = value as Record<string, unknown>;
  if (record.kind === 'lexical-write') action(value as ExpressionIR);
  for (const [key, child] of Object.entries(record))
    if (key !== 'type' && key !== 'span') visit(child, action);
}

describe('private lexical storage admission', () => {
  it('admits the unchanged reentrant ContainerRegion producer input', () => {
    const source = readFileSync(new URL('./fixtures/gpui-native-template/focus-region.proto.ts', import.meta.url), 'utf8');
    const result = compilePrototype(source, {
      fileName: 'focus-region.proto.ts', exportName: 'ContainerRegion', profile: 'gpui-source-v1',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.value.ir.exposes.map((entry) => entry.name)).toContain('armReentry');
    expect(result.value.ir.exposes.map((entry) => entry.name)).toContain('armIndependentEntry');
    expect(result.value.ir.exposes.map((entry) => entry.name)).toContain('armCloseOnActivate');
  });

  it.each([
    'react-runtime-v1', 'react-dom-source-v1', 'vue-source-v1', 'vue2-source-v1',
    'web-component-source-v1', 'gpui-source-v1',
  ])('lowers ordinary private data and reached helpers through %s', (profile) => {
    const result = compilePrototype(scalarSource, { profile });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.ok).toBe(true);
    expect(result.value.ir.requirements).not.toContain('state');
    expect(result.value.ir.exposes.every((entry) => entry.kind !== 'state')).toBe(true);
    const moduleResult = compilePrototype(moduleSource, { profile });
    if (!moduleResult.ok) throw new Error(JSON.stringify(moduleResult.diagnostics));
    expect(moduleResult.ok).toBe(true);
    const ownedResult = compilePrototype(moduleSource, { profile, exportName: 'WithState' });
    if (!ownedResult.ok) throw new Error(JSON.stringify(ownedResult.diagnostics));
    expect(ownedResult.ok).toBe(true);
  });

  it.each([
    'react-dom-ssr-v1', 'vue-ssr-v1', 'vue2-ssr-v1', 'web-component-ssr-v1',
  ])('retains the explicit unimplemented registry boundary for %s', (profile) => {
    for (const [source, exportName] of [[scalarSource, 'default'], [moduleSource, 'default'], [moduleSource, 'WithState']] as const)
      expect(compilePrototype(source, { profile, exportName }))
        .toMatchObject({ ok: false, diagnostics: [{ code: 'PUI4001', category: 'unsupported-input' }] });
  });

  it.each([
    { profile: 'react-dom-ssr-v1', emit: emitReactSource },
    { profile: 'vue-ssr-v1', emit: emitVueSource },
    { profile: 'vue2-ssr-v1', emit: emitVue2Source },
    { profile: 'web-component-ssr-v1', emit: emitWebComponentSource },
  ])('covers lexical lowering through the existing direct $profile experiment', ({ emit }) => {
    // Preserve the scalar, module and owner-bound cases through the actual experimental entry.
    for (const [source, exportName] of [[scalarSource, 'default'], [moduleSource, 'default'], [moduleSource, 'WithState']] as const) {
      const result = emit(parsed(source, exportName), { ssr: true });
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      expect(result.ok).toBe(true);
    }
  });

  it.each([
    ['const flag=false;flag=true;', 'PUI1004'],
    ['missing=true;', 'PUI1004'],
    ['var flag=false;', 'PUI1004'],
    ['let flag;', 'PUI1004'],
    ['let flag=false;flag=1;', 'PUI1006'],
    ['let flag=false;flag++;', 'PUI1006'],
    ['let state=def.state.bool(\'ready\',false);', 'PUI1004'],
  ])('rejects an ungoverned storage or write boundary: %s', (body, code) => {
    expect(parsePrototype(`import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'invalid-lexical',setup(def){${body}}});`))
      .toMatchObject({ ok: false, diagnostics: [{ code }] });
  });

  it('revalidates forged writes and prevents private storage identities from escaping', () => {
    const wrongValue = parsed();
    let changed = false;
    visit(wrongValue.setup, (node) => {
      if (changed || node.kind !== 'lexical-write') return;
      node.value = { kind: 'literal', value: 'forged', type: 'string', span: node.span };
      changed = true;
    });
    expect(changed).toBe(true);
    expect(validateIR(wrongValue)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });

    const wrongTarget = parsed();
    visit(wrongTarget.setup, (node) => {
      if (node.kind === 'lexical-write') node.cell = { kind: 'reference', name: 'snapshot', type: 'number', span: node.span };
    });
    expect(validateIR(wrongTarget)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });

    const escaping = parsed();
    escaping.setup.body.push({
      kind: 'effect', span: escaping.setup.span,
      expression: { kind: 'reference', name: 'count', type: 'lexical:number', span: escaping.setup.span },
    });
    expect(validateIR(escaping)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });
});
