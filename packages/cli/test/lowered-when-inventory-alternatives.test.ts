import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanRuleStateReads } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

async function observe(when: string, extra = '') {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-when-css-')));
  try {
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({ extends: path.resolve(process.cwd(), 'tsconfig.json') })
    );
    await writeFile(
      path.join(directory, 'state.ts'),
      `import { defineAsHook } from '@proto.ui/core';
       export const asFlags = defineAsHook({ name: 'inventory-flags',
         setup(def) { def.state.bool('focused', false); def.state.bool('invalid', false); },
         projectHandle: result => ({ focused: result.stateHandles.focused, invalid: result.stateHandles.invalid })
       });`
    );
    const file = path.join(directory, 'entry.proto.ts');
    const source = `import { definePrototype, tw } from '@proto.ui/core';
      import { asFlags } from './state';
      declare const external: any;
      export default definePrototype({ name: 'when-inventory', setup(def) {
        const state = asFlags(); const binding = state;
        const invalid = state.invalid; const focused = state.focused;
        ${extra}
        def.rule({ when: ${when}, intent: i => i.feedback.style.use(tw('ring-2')) });
      } });`;
    await writeFile(file, source);
    return {
      scan: scanRuleStateReads(source, file),
      variants: (await collectProtoStyleTokensFromFiles([file])).filter((token) =>
        token.endsWith(':ring-2')
      ),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe('CSS inventory enumerates complete closed When alternatives', () => {
  it('retains the actual Brutalist OTP focus and invalid conjunction', async () => {
    const tokens = await collectProtoStyleTokensFromFiles([
      path.resolve('packages/prototypes/brutalist/src/input-otp/control.proto.ts'),
    ]);
    for (const intent of [
      'outline-none',
      'forced-colors-focus-outline',
      'ring-2',
      'ring-ring',
      'ring-offset-2',
      'ring-offset-background',
    ]) {
      expect(tokens).toContain(`data-[focus-visible]:not-[data-invalid]:${intent}`);
    }
  });

  it('retains the actual Brutalist Field Textarea dark invalid guard', async () => {
    const tokens = await collectProtoStyleTokensFromFiles([
      path.resolve('packages/prototypes/brutalist/src/field/textarea.proto.ts'),
    ]);
    expect(tokens).toContain('dark:not-[data-invalid]:border-foreground');
  });

  it('does not drop the actual Shadcn private style selection guard', async () => {
    const tokens = await collectProtoStyleTokensFromFiles([
      path.resolve('packages/prototypes/shadcn/src/field/control.proto.ts'),
    ]);
    // Its real Runtime keeps the complete Rule in the JavaScript plan because
    // shadcnStyleSelection is private. Public focus/invalid leaves cannot form
    // a partial selector which silently omits that additional State guard.
    for (const intent of [
      'border-b-ring',
      'border-ring',
      'ring-1',
      'ring-2',
      'ring-3',
      'ring-ring/30',
      'ring-ring/50',
    ]) {
      expect(tokens).not.toContain(`data-[focus-visible]:not-[data-invalid]:${intent}`);
    }
    expect(tokens).toContain('ring-ring/50');
  });

  it('keeps complete conjunctions separate instead of mixing their leaves', async () => {
    const { variants, scan } = await observe(
      '(w) => binding ? w.all(w.state(focused).eq(true), w.state(binding.invalid).eq(false)) : w.state(focused).eq(true)'
    );
    expect(variants).toContain('data-[focused]:not-[data-invalid]:ring-2');
    expect(variants).not.toContain('data-[focused]:data-[focused]:not-[data-invalid]:ring-2');
    expect(variants).not.toContain('not-[data-invalid]:ring-2');
    expect(scan.unresolved.some(({ reason }) => reason === 'condition')).toBe(true);
  });

  it.each([
    ['prop dependency', "w.all(w.state(focused).eq(true), w.prop('variant').eq('solid'))"],
    ['any group', 'w.any(w.state(focused).eq(true), w.state(invalid).eq(true))'],
    ['not group', 'w.not(w.state(invalid).eq(true))'],
    ['unsupported meta', "w.all(w.state(focused).eq(true), w.meta('reducedMotion').eq(true))"],
  ])('does not turn the %s branch into partial CSS', async (_name, branch) => {
    const { variants } = await observe(`w => binding ? ${branch} : w.state(invalid).eq(true)`);
    expect(variants).toEqual(['data-[invalid]:ring-2']);
  });

  it.each([
    ['opaque condition', 'w => external ? w.state(focused).eq(true) : w.state(invalid).eq(true)'],
    [
      'eager condition call',
      'w => external() ? w.state(focused).eq(true) : w.state(invalid).eq(true)',
    ],
    [
      'getter condition',
      'w => external.ready ? w.state(focused).eq(true) : w.state(invalid).eq(true)',
    ],
    [
      'receiver replacement',
      'w => { w = external; return binding ? w.state(focused).eq(true) : w.state(invalid).eq(true); }',
    ],
    [
      'receiver member write',
      'w => { w.state = external; return binding ? w.state(focused).eq(true) : w.state(invalid).eq(true); }',
    ],
    [
      'opaque branch subject',
      'w => binding ? w.all(w.state(focused).eq(true), w.state(external.ready).eq(true)) : w.state(invalid).eq(true)',
    ],
  ])('retains the boundary for %s', async (_name, when) => {
    const { variants, scan } = await observe(when);
    expect(variants).toEqual([]);
    expect(scan.unresolved.length).toBeGreaterThan(0);
  });
});
