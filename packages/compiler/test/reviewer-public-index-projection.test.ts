// @vitest-environment happy-dom
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { emitWebComponentSource } from '../src/web-component-source';
import { writeArtifactSet } from '../src/artifact-output';
import type { ExpressionIR, ValueType } from '../src/ir';

const source = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'index-value',setup(def){
  def.expose.value('box',{action:()=>7});
  return r=>r.el('div',[]);
}});`;
const cleanup: (() => Promise<void>)[] = [];
let sequence = 0;
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
  document.body.replaceChildren();
});

for (const indexed of [false, true])
  it(`retains the public lifetime guard for ${indexed ? 'a portable indexed callable view' : 'the original finite-field record'}`, async () => {
    const parsed = parsePrototype(source, { fileName: 'index-value.proto.ts' });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const ir = JSON.parse(JSON.stringify(parsed.value)) as typeof parsed.value;
    if (indexed) {
      const statement = ir.setup.body[0];
      if (statement.kind !== 'effect' || statement.expression.kind !== 'operation')
        throw new Error('Missing expose operation');
      const operation = statement.expression;
      const original = operation.arguments[1];
      if (typeof original.type === 'string' || original.type.kind !== 'object')
        throw new Error('Missing ordinary callable record');
      const type: ValueType = { kind: 'object', fields: [], index: original.type.fields[0].type };
      (operation.arguments as ExpressionIR[])[1] = {
        kind: 'narrow',
        value: original,
        type,
        span: original.span,
      };
      const exposure = ir.exposes[0];
      if (exposure.kind !== 'value') throw new Error('Missing value exposure');
      exposure.type = type;
    }
    const checked = validateIR(ir);
    // An unimplemented indexed public surface may be explicitly rejected. If
    // the portable validator accepts it, it owes the same lifetime guarantee.
    if (!checked.ok) {
      expect(indexed).toBe(true);
      expect(checked.diagnostics.some((diagnostic) => diagnostic.code === 'PUI2002')).toBe(true);
      return;
    }
    const emitted = emitWebComponentSource(ir);
    expect(emitted.ok, JSON.stringify(emitted.ok ? {} : emitted.diagnostics)).toBe(true);
    if (!emitted.ok) return;
    const parent = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generated-modules');
    await mkdir(parent, { recursive: true });
    const temporary = await mkdtemp(path.join(parent, 'review-index-'));
    cleanup.push(async () => {
      await rm(temporary, { recursive: true, force: true });
    });
    const output = path.join(temporary, 'output');
    const written = await writeArtifactSet(
      [
        { path: 'Component.ts', contents: emitted.value.code, kind: 'source' },
        ...(emitted.value.supportingFiles ?? []),
      ],
      output
    );
    expect(written.ok, JSON.stringify(written.ok ? {} : written.diagnostics)).toBe(true);
    const module = await import(/* @vite-ignore */ path.join(output, 'Component.ts'));
    const tag = `x-review-index-${++sequence}`;
    module.register(tag);
    const element = document.createElement(tag) as HTMLElement & {
      getExposes(): { box: { action(): number } };
      dispose(): void;
    };
    cleanup.push(async () => {
      element.dispose();
      element.remove();
    });
    document.body.append(element);
    await Promise.resolve();
    const action = element.getExposes().box.action;
    expect(action()).toBe(7);
    element.dispose();
    expect(() => action()).toThrow(/dispos|alive|terminal/i);
  });
