// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { PrototypeIR } from '../src/ir';
import { OPERATION_RULES } from '../src/operations';

const sourceFiles = Object.fromEntries(
  ['as-transition.proto.ts', 'machine.ts', 'types.ts'].map((name) => [
    `transition/${name}`,
    readFileSync(new URL(`../../prototypes/base/src/transition/${name}`, import.meta.url), 'utf8'),
  ])
);
const caller = `import {definePrototype} from '@proto.ui/core'; import {asTransition as install} from './transition/as-transition.proto'; export default definePrototype({name:'ordinary-source',setup(def){const transition=install();}});`;
function parsed(source = caller, files = sourceFiles): PrototypeIR {
  const result = parsePrototype(source, { fileName: 'entry.proto.ts', files });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}
function operations(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(operations);
  const node = value as Record<string, unknown>;
  return [
    ...(node.kind === 'operation' ? [String(node.operation)] : []),
    ...Object.entries(node)
      .filter(([key]) => key !== 'type' && key !== 'span' && key !== 'sourceFiles')
      .flatMap(([, child]) => operations(child)),
  ];
}

describe('unchanged authored Transition source', () => {
  it('lowers actual setup, machine, and projection into checked ordinary values plus host atoms', () => {
    const ir = parsed();
    expect(validateIR(JSON.parse(JSON.stringify(ir)))).toMatchObject({ ok: true });
    expect(ir.hooks).toHaveLength(1);
    expect(ir.hooks[0].projectHandle).toBeDefined();
    expect(ir.hooks[0].capture?.states.map((state) => state.name)).toEqual([
      'transitionState',
      'isPresent',
      'transitionAppearDefault',
      'transitionColdEntryPreparation',
      'transitionEnterDurationDefault',
      'transitionLeaveDurationDefault',
      'transitionInterruptDefault',
    ]);
    expect(ir.hooks[0].capture?.methods.map((method) => method.name)).toContain(
      'capturePreparation'
    );
    expect(ir.sourceFiles.map((file) => file.file)).toEqual([
      'entry.proto.ts',
      'transition/as-transition.proto.ts',
      'transition/machine.ts',
      'transition/types.ts',
    ]);
    const used = operations(ir);
    expect(used).toContain('presence.publish');
    expect(used).toContain('scheduler.delay');
    expect(used).toContain('capture.getMethod');
    expect(
      used.some((name) => name === 'hook.asTransition' || name.startsWith('transition.'))
    ).toBe(false);
  });

  it('derives changed machine behavior from supplied source rather than a packaged protocol', () => {
    const original = parsed();
    const source = sourceFiles['transition/machine.ts'];
    const changed = source.replace('if (frame.durationMs === 0)', 'if (frame.durationMs === 1)');
    expect(changed).not.toBe(source);
    const mutant = parsed(caller, { ...sourceFiles, 'transition/machine.ts': changed });
    expect(validateIR(mutant)).toMatchObject({ ok: true });
    expect(mutant.moduleBindings).not.toEqual(original.moduleBindings);
  });

  it('retains top-level effect rejection for every authored dependency', () => {
    const result = parsePrototype(caller, {
      fileName: 'entry.proto.ts',
      files: {
        ...sourceFiles,
        'transition/machine.ts': `globalThis.transitionCompilerExecuted=true;\n${sourceFiles['transition/machine.ts']}`,
      },
    });
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1004' }] });
    expect((globalThis as Record<string, unknown>).transitionCompilerExecuted).toBeUndefined();
  });

  it('requires ordinary source resolution for every packaged authored hook', () => {
    const packaged = caller.replace(
      './transition/as-transition.proto',
      '@proto.ui/prototypes-base/transition'
    );
    const missing = parsePrototype(packaged, { fileName: 'entry.proto.ts' });
    expect(missing).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: 'PUI1003',
          message: expect.stringContaining('proto export or sourceImports mapping'),
        },
      ],
    });
    const resolved = parsePrototype(packaged, {
      fileName: 'entry.proto.ts',
      files: sourceFiles,
      sourceImports: {
        '@proto.ui/prototypes-base/transition': 'transition/as-transition.proto.ts',
      },
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(validateIR(resolved.value)).toMatchObject({ ok: true });
    expect(resolved.value.props).toEqual(parsed().props);
    expect(resolved.value.exposes).toEqual(parsed().exposes);
    expect(Object.keys(OPERATION_RULES).some((name) => /[Tt]ransition/.test(name))).toBe(false);
  });
});
