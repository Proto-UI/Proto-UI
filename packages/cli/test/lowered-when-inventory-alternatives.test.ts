import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HOST_ELEMENT_CAP,
  tw,
  type DefHandle,
  type OwnedStateHandle,
  type StyleHandle,
} from '@proto.ui/core';
import { EFFECTS_CAP } from '@proto.ui/module-feedback';
import { EXPOSE_STATE_WEB_MAP_CAP } from '@proto.ui/module-expose-state-web';
import { createRuntimeSession } from '@proto.ui/runtime';
import { scanRuleStateReads } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

type RuntimeFlags = {
  ready: OwnedStateHandle<boolean>;
  focused: OwnedStateHandle<boolean>;
};

async function runtimeTokens(install: (def: DefHandle<{}>, state: RuntimeFlags) => void) {
  const styles: StyleHandle[] = [];
  const host = document.createElement('div');
  const session = createRuntimeSession(
    {
      name: 'when-inventory-runtime',
      setup(def) {
        const state = {
          ready: def.state.bool('ready', false),
          focused: def.state.bool('focused', true),
        };
        def.expose.state('ready', state.ready);
        def.expose.state('focused', state.focused);
        install(def, state);
        return (renderer) => renderer.el('span', 'native Rule');
      },
    },
    {
      prototypeName: 'when-inventory-runtime',
      getRawProps: () => ({}),
      schedule: (callback) => callback(),
      commit: (_children, completion) => completion?.done(),
      onRuntimeReady(runtime) {
        runtime.attach('feedback', [
          [
            EFFECTS_CAP,
            { queueStyle: (style: StyleHandle) => styles.push(style), requestFlush() {} },
          ],
        ]);
        runtime.attach('expose-state-web', [
          [HOST_ELEMENT_CAP, host],
          [
            EXPOSE_STATE_WEB_MAP_CAP,
            (key: string) => ({ dataAttr: `data-${key}`, cssVar: `--pui-${key}` }),
          ],
        ]);
      },
    }
  );
  try {
    await session.mount();
    return styles.at(-1)?.tokens ?? [];
  } finally {
    await session.dispose();
  }
}

function installOptionalRule(
  def: DefHandle<{}>,
  state: RuntimeFlags,
  optional: OwnedStateHandle<boolean> | null = null
) {
  def.rule({
    when: (when) =>
      optional
        ? when.all(when.state(state.focused).eq(true), when.state(optional).eq(false))
        : when.state(state.focused).eq(true),
    intent: (intent) => intent.feedback.style.use(tw('bg-primary')),
  });
}

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
  it.each([false, true])(
    'executes a defaulted State parameter with supplied=%s',
    async (supplied) => {
      const tokens = await runtimeTokens((def, state) => {
        if (supplied) installOptionalRule(def, state, state.ready);
        else installOptionalRule(def, state);
      });
      expect(tokens).toEqual([
        supplied ? 'data-[focused]:not-[data-ready]:bg-primary' : 'data-[focused]:bg-primary',
      ]);
    }
  );

  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])(
    'executes only a complete native branch for reversed=%s choose=%s',
    async (reversed, choose) => {
      const tokens = await runtimeTokens((def, state) => {
        const optional = reversed ? (choose ? state : state.ready) : choose ? state.ready : state;
        // Deliberately retain the non-State alternative from the static negative
        // fixture. The real web module must reject its entire selector candidate.
        installOptionalRule(def, state, optional as OwnedStateHandle<boolean>);
      });
      expect(tokens).toEqual(
        choose !== reversed ? ['data-[focused]:not-[data-ready]:bg-primary'] : []
      );
      expect(tokens).not.toContain('data-[focused]:bg-primary');
      expect(tokens).not.toContain('not-[data-ready]:bg-primary');
    }
  );

  it.each(['argument', 'initializer'])(
    'does not turn the inventory vocabulary into a Runtime branch after an effectful %s',
    async (form) => {
      const tokens = await runtimeTokens((def, state) => {
        const ready = state.ready;
        const focused = state.focused;
        function erase(bag: Partial<RuntimeFlags>) {
          bag.ready = undefined;
          return true;
        }
        function paint(optional: OwnedStateHandle<boolean> | undefined) {
          def.rule({
            when: (when) => (optional ? when.state(ready).eq(true) : when.state(focused).eq(true)),
            intent: (intent) => intent.feedback.style.use(tw('bg-primary')),
          });
        }
        if (form === 'argument') paint(erase(state) ? state.ready : state.ready);
        else {
          const optional = erase(state) ? state.ready : state.ready;
          paint(optional);
        }
        expect(state.ready).toBeUndefined();
      });
      expect(tokens).toEqual(['data-[focused]:bg-primary']);
      expect(tokens).not.toContain('data-[ready]:bg-primary');
    }
  );

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
