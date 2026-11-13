import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createExposeStateWebNameMap,
  createExposeStateWebNativeVariantPolicy,
  OFFICIAL_EXPOSED_STATE_NAMES,
} from '../../modules/expose-state-web/src/utils';
import {
  collectProtoRootStyleTokenOccurrences,
  collectProtoRootStyleTokens,
  collectProtoStyleTokens,
  collectProtoStyleTokensFromFiles,
} from '../src/services/prototype-style-tokens';

describe('collectProtoStyleTokens', () => {
  it('closes the isolated Shadcn Radio Group state and theme rules', async () => {
    const tokens = await collectProtoStyleTokens(
      path.resolve(process.cwd(), 'packages/prototypes/shadcn/src/radio-group')
    );

    for (const token of [
      'data-[checked]:opacity-100',
      'data-[checked]:bg-primary',
      'data-[checked]:border-primary',
      'data-[checked]:text-primary-foreground',
      'data-[focus-visible]:border-ring',
      'data-[focus-visible]:ring-3',
      'data-[focus-visible]:ring-ring/50',
      'data-[disabled]:cursor-not-allowed',
      'data-[disabled]:opacity-50',
      'dark:not-[data-checked]:bg-input/30',
    ]) {
      expect(tokens).toContain(token);
    }
    // The multi-profile source guards the dark unfilled tint with not-checked
    // instead of painting a dark checked primary surface.
    expect(tokens).not.toContain('dark:data-[checked]:bg-primary');
  });

  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'proto-style-tokens-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('collects lowered state styles through imported helper parameters and forwarding aliases', async () => {
    await writeFile(
      path.join(dir, 'facts.ts'),
      `import { defineAsHook } from '@proto.ui/core';
       export const asFacts = defineAsHook({ name: 'facts',
         setup(def) { def.state.bool('isCurrent', false); },
         projectHandle(result) { return { state: { engaged: result.stateHandles.isCurrent } }; }
       });`
    );
    await writeFile(
      path.join(dir, 'paint.ts'),
      `import { tw } from '@proto.ui/core';
       const fills = { quiet: 'bg-muted', strong: 'bg-accent' };
       export function paint(def, facts: { engaged?: unknown }, fill = 'quiet') {
         if (facts.engaged) def.rule({
           when: w => w.state(facts.engaged!).eq(true),
           intent: i => i.feedback.style.use(tw(fills[fill], 'shadow-sm'))
         });
       }`
    );
    await writeFile(path.join(dir, 'barrel.ts'), `export { paint as decorate } from './paint';`);
    await writeFile(
      path.join(dir, 'forward.ts'),
      `import { decorate } from './barrel';
       export default function forward(def, facts) { decorate(def, facts, 'strong'); }`
    );
    await writeFile(
      path.join(dir, 'unreached.ts'),
      `export function unrelated(def) { def.feedback.style.use(tw('outline-4')); }`
    );
    const entry = path.join(dir, 'entry.proto.ts');
    await writeFile(
      entry,
      `import { definePrototype } from '@proto.ui/core';
       import { asFacts } from './facts';
       import forward from './forward';
       import { paint } from './paint';
       export default definePrototype({ name: 'consumer', setup(def) {
         const inherited = asFacts();
         const facts = inherited.state;
         forward(def, facts);
         const second = def.state.bool('secondFlag', false);
         def.expose.state('publicName', second);
         const alias = paint;
         alias(def, { engaged: second });
       }});`
    );

    const tokens = await collectProtoStyleTokensFromFiles([entry]);
    expect(tokens).toEqual([
      'bg-accent',
      'bg-muted',
      'data-[is-current]:bg-accent',
      'data-[is-current]:shadow-sm',
      'data-[second-flag]:bg-muted',
      'data-[second-flag]:shadow-sm',
      'shadow-sm',
    ]);
    const occurrences = await collectProtoRootStyleTokenOccurrences(dir);
    expect(occurrences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'paint.ts', context: 'rule', token: 'bg-accent' }),
      ])
    );
  });

  it('keeps helper defining scopes and higher-order argument bindings separate', async () => {
    const entry = path.join(dir, 'entry.proto.ts');
    await writeFile(
      entry,
      `import { definePrototype, tw } from '@proto.ui/core';
       export default definePrototype({ name: 'lexical-consumer', setup(def) {
         const captured = def.state.bool('outerFlag', false);
         def.expose.state('outerPublic', captured);
         {
           const captured = def.state.bool('callerFlag', false);
           def.expose.state('callerPublic', captured);
           forward(paint, { ready: captured });
         }
         forward(paint, { ready: captured });
         function forward(writer, facts) { const alias = writer; alias(def, facts); }
         function paint(target, { ready }) {
           target.rule({ when: w => w.state(ready).eq(true),
             intent: i => i.feedback.style.use(tw('opacity-50')) });
           target.rule({ when: w => w.state(captured).eq(true),
             intent: i => i.feedback.style.use(tw('bg-primary')) });
         }
       }});`
    );
    const tokens = await collectProtoStyleTokensFromFiles([entry]);
    expect(tokens).toContain('data-[caller-flag]:opacity-50');
    expect(tokens).toContain('data-[outer-flag]:opacity-50');
    expect(tokens).toContain('data-[outer-flag]:bg-primary');
    expect(tokens).not.toContain('data-[caller-flag]:bg-primary');
  });

  it('delivers conditional CSS after a closed finite mutual callback graph', async () => {
    const entry = path.join(dir, 'entry.proto.ts');
    const tasks = Array.from(
      { length: 12 },
      (_, index) => `
      function task${index}() {
        if (visited.has(${index})) return;
        visited.add(${index});
        ${Array.from({ length: 12 }, (_, next) => `task${next}();`).join('\n')}
      }
    `
    ).join('\n');
    await writeFile(
      entry,
      `
      import { definePrototype, tw } from '@proto.ui/core';
      export function traverse() {
        const visited = new Set();
        ${tasks}
        task0();
        return visited.size;
      }
      definePrototype({ name: 'graph-consumer', setup(def) {
        const first = def.state.bool('firstFlag', false);
        const second = def.state.bool('secondFlag', false);
        def.expose.state('firstPublic', first);
        def.expose.state('secondPublic', second);
        paint(first, 'opacity-50');
        paint(second, 'opacity-100');
        function paint(handle, token) {
          def.rule({ when: w => w.state(handle).eq(true),
            intent: i => i.feedback.style.use(tw(token)) });
        }
      }});
    `
    );
    const root = process.cwd();
    const collector = pathToFileURL(
      path.join(root, 'packages/cli/src/services/prototype-style-tokens.ts')
    ).href;
    const renderer = pathToFileURL(
      path.join(root, 'packages/cli/src/services/proto-style-css.ts')
    ).href;
    // The old path enumeration must fail inside its own process rather than
    // blocking the test runner. This is a termination bound, not a benchmark.
    const child = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '--eval',
        `
      import { collectProtoStyleTokensFromFiles } from ${JSON.stringify(collector)};
      import { renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss } from ${JSON.stringify(renderer)};
      const tokens = await collectProtoStyleTokensFromFiles([${JSON.stringify(entry)}]);
      console.log(JSON.stringify({ tokens,
        documentCss: renderProtoStyleTokenCss(tokens),
        shadowCss: renderProtoShadowStyleTokenCss(tokens) }));
    `,
      ],
      { cwd: root, encoding: 'utf8', timeout: 30_000, killSignal: 'SIGKILL' }
    );
    expect(child.error, child.stderr).toBeUndefined();
    expect(child.status, `${child.stdout}\n${child.stderr}`).toBe(0);
    const result = JSON.parse(child.stdout);
    expect(result.tokens).toEqual([
      'data-[first-flag]:opacity-50',
      'data-[second-flag]:opacity-100',
      'opacity-100',
      'opacity-50',
    ]);
    for (const css of [result.documentCss, result.shadowCss]) {
      expect(css).toContain('[data-pui-style~="data-[first-flag]:opacity-50"]');
      expect(css).toContain('[data-pui-style~="data-[second-flag]:opacity-100"]');
      expect(css).toContain('opacity: 0.5;');
      expect(css).toContain('opacity: 1;');
      expect(css).not.toContain('Unsupported Proto UI style tokens');
    }
  }, 40_000);

  it('replays style-free forwarding regions for distinct callback and State arguments', async () => {
    await writeFile(
      path.join(dir, 'forward.ts'),
      `
      export function forward(writer, target, handle, token) {
        const retained = writer;
        writer = undefined;
        function relay() { retained(target, handle, token); }
        relay();
      }
    `
    );
    const entry = path.join(dir, 'entry.proto.ts');
    await writeFile(
      entry,
      `
      import { definePrototype, tw } from '@proto.ui/core';
      import { forward } from './forward';
      definePrototype({ name: 'callback-consumer', setup(def) {
        const first = def.state.bool('firstFlag', false);
        const second = def.state.bool('secondFlag', false);
        def.expose.state('firstPublic', first);
        def.expose.state('secondPublic', second);
        forward(paint, def, first, 'opacity-50');
        forward(paint, def, second, 'opacity-100');
        forward(unknown, def, first, 'opacity-0');
        function paint(target, handle, token) {
          target.rule({ when: w => w.state(handle).eq(true),
            intent: i => i.feedback.style.use(tw(token)) });
        }
      }});
    `
    );
    expect(await collectProtoStyleTokensFromFiles([entry])).toEqual([
      'data-[first-flag]:opacity-50',
      'data-[second-flag]:opacity-100',
      'opacity-100',
      'opacity-50',
    ]);
  });

  it('retains borrowed-container writes and external captures across later graph replacements', async () => {
    await writeFile(
      path.join(dir, 'replace.ts'),
      `
      export function replace(target, token) {
        const retained = target;
        target = undefined;
        function write() { retained.root = token; }
        write();
      }
    `
    );
    const entry = path.join(dir, 'entry.ts');
    await writeFile(
      entry,
      `
      import { replace } from './replace';
      let captured = 'm-2';
      function changeCapture() { captured = 'm-4'; }
      changeCapture();
      tw(captured);
      const table = { root: 'p-2' };
      replace(table, 'p-4');
      tw(table.root);
      table.root = 'p-6';
      replace(table, 'p-8');
      tw(table.root);
    `
    );
    expect(await collectProtoStyleTokensFromFiles([entry])).toEqual([
      'm-2',
      'm-4',
      'p-2',
      'p-4',
      'p-6',
      'p-8',
    ]);
  });

  it.each([
    ['unknown argument', 'paint(def, external());'],
    ['missing argument', 'paint(def);'],
    ['partial argument', 'paint(def, choose ? facts : external());'],
    ['escaped container', 'external(facts); paint(def, facts);'],
    ['later argument effect', 'paint(def, facts, external(facts));'],
    ['shadowed helper', '{ const paint = external(); paint(def, facts); }'],
    ['lexical shadow before declaration', '{ paint(def, facts); const paint = external(); }'],
    ['reassigned helper alias', 'let alias = paint; alias = external(); alias(def, facts);'],
    ['spread arguments', 'paint(...external());'],
  ])('does not invent helper state selectors from a %s', async (_label, call) => {
    await writeFile(
      path.join(dir, 'helpers.ts'),
      `import { defineAsHook, tw } from '@proto.ui/core';
       export const asFacts = defineAsHook({ name: 'facts',
         setup(def) { def.state.bool('internalFlag', false); },
         projectHandle(result) { return { ready: result.stateHandles.internalFlag }; }
       });
       export function paint(def, facts: { ready: unknown }) {
         def.rule({ when: w => w.state(facts.ready).eq(true),
           intent: i => i.feedback.style.use(tw('opacity-50')) });
       }`
    );
    const entry = path.join(dir, 'entry.proto.ts');
    await writeFile(
      entry,
      `import { asFacts, paint } from './helpers';
       const facts = asFacts();
       ${call}`
    );
    const tokens = await collectProtoStyleTokensFromFiles([entry]);
    expect(tokens.filter((token) => token.endsWith(':opacity-50'))).toEqual([]);
  });

  it.each([
    ['any', 'w.any(w.state(first).eq(true), w.state(second).eq(true))'],
    [
      'returned block any',
      '{ w.state(third).eq(true); return w.any(w.state(first).eq(true), w.state(second).eq(true)); }',
    ],
    [
      'all containing any',
      'w.all(w.state(first).eq(true), w.any(w.state(second).eq(true), w.state(third).eq(true)))',
    ],
    ['not', 'w.not(w.state(first).eq(true))'],
    ['all containing not', 'w.all(w.state(first).eq(true), w.not(w.state(second).eq(true)))'],
    [
      'reduced motion',
      "w.all(w.meta('preference.reducedMotion').eq('no-preference'), w.state(first).eq(true))",
    ],
    [
      'unknown preference',
      "w.all(w.state(first).eq(true), w.meta('preference.other').eq('enabled'))",
    ],
    [
      'light is not dark lowering',
      "w.all(w.meta('colorScheme').eq('light'), w.state(first).eq(true))",
    ],
    [
      'not all with preference and any',
      "w.not(w.all(w.meta('preference.reducedMotion').eq('no-preference'), w.state(first).eq(false), w.any(w.state(second).eq(true), w.state(third).eq(true))))",
    ],
  ])(
    'retains bare intent but no invented selector for runtime-only %s',
    async (_label, expression) => {
      await writeFile(
        path.join(dir, 'runtime-only.proto.ts'),
        `
      import { definePrototype, tw } from '@proto.ui/core';
      export default definePrototype({ name: 'runtime-only', setup(def) {
        const first = def.state.bool('first', false);
        const second = def.state.bool('second', false);
        const third = def.state.bool('third', false);
        def.expose.state('first', first); def.expose.state('second', second); def.expose.state('third', third);
        def.rule({ when: (w) => ${expression}, intent: (i) => i.feedback.style.use(tw('bg-accent transition-none')) });
      }});
    `
      );
      const tokens = await collectProtoStyleTokens(dir);
      expect(tokens).toContain('bg-accent');
      expect(tokens).toContain('transition-none');
      expect(
        tokens.filter((token) => {
          if (typeof token !== 'string') throw new TypeError('Expected a collected string token');
          return token.endsWith(':bg-accent') || token.endsWith(':transition-none');
        })
      ).toEqual([]);
    }
  );

  it.each([
    ['eq', 'w.state(first).eq(true)', 'data-[first]:bg-accent'],
    ['unused empty any', '{ w.any(); return w.state(first).eq(true); }', 'data-[first]:bg-accent'],
    [
      'unused same-name object',
      '{ const other = { any() { return 0; } }; other.any(); return w.state(first).eq(true); }',
      'data-[first]:bg-accent',
    ],
    [
      'unused local helper',
      '{ const unused = () => w.any(); return w.state(first).eq(true); }',
      'data-[first]:bg-accent',
    ],
    [
      'existing returned local alias',
      '{ const condition = w.state(first).eq(true); return condition; }',
      'data-[first]:bg-accent',
    ],
    [
      'builder alias escapes direct receiver proof',
      '{ const alias = w; alias.any = () => w.state(first).eq(true); return w.any(); }',
      'data-[first]:bg-accent',
    ],
    [
      'replaced receiver is not DSL',
      '{ const original = w; w = { any() { return original.state(first).eq(true); } }; return w.any(); }',
      'data-[first]:bg-accent',
    ],
    [
      'nested all',
      'w.all(w.state(first).eq(true), w.all(w.state(second).eq(true)))',
      'data-[first]:data-[second]:bg-accent',
    ],
    [
      'dark with state',
      "w.all(w.meta('colorScheme').eq('dark'), w.state(first).eq(true))",
      'dark:data-[first]:bg-accent',
    ],
  ])('preserves a genuinely lowerable %s selector', async (_label, expression, variant) => {
    await writeFile(
      path.join(dir, 'lowerable.proto.ts'),
      `
      import { definePrototype, tw } from '@proto.ui/core';
      export default definePrototype({ name: 'lowerable', setup(def) {
        const first = def.state.bool('first', false); const second = def.state.bool('second', false);
        def.expose.state('first', first); def.expose.state('second', second);
        def.rule({ when: (w) => ${expression}, intent: (i) => i.feedback.style.use(tw('bg-accent')) });
      }});
    `
    );
    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('bg-accent');
    expect(
      tokens.filter((token) => {
        if (typeof token !== 'string') throw new TypeError('Expected a collected string token');
        return token.endsWith(':bg-accent');
      })
    ).toEqual([variant]);
  });

  it.each(['', ' as const', ' as const satisfies Readonly<Record<string, string>>'])(
    'collects finite string-map choices through erased type syntax %s',
    async (annotation) => {
      await writeFile(
        path.join(dir, 'paint.ts'),
        `
        import { tw } from '@proto.ui/core';
        const masks = { rest: 'bg-black/50', dark: 'bg-black/80' }${annotation};
        export function paint() {
          for (const profile of ['rest', 'dark'] as const) tw(masks[profile]);
        }
      `
      );
      expect(await collectProtoStyleTokens(dir)).toEqual(['bg-black/50', 'bg-black/80']);
    }
  );

  it('separates Root feedback style tokens from Template-node style tokens', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        "const ROOT_TOKENS = 'absolute z-40';",
        "const TEMPLATE_TOKENS = 'pointer-events-none';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        '    def.feedback.style.use(tw(ROOT_TOKENS));',
        '    def.rule({',
        '      when: () => true,',
        "      intent: (i) => i.feedback.style.use(tw('hidden')),",
        '    });',
        '    return (renderer) =>',
        "      renderer.el('span', { style: tw(TEMPLATE_TOKENS) }, 'content');",
        '  },',
        '});',
        'export default widget;',
      ].join('\n')
    );

    expect(await collectProtoRootStyleTokens(dir)).toEqual(['absolute', 'hidden', 'z-40']);

    const occurrences = await collectProtoRootStyleTokenOccurrences(dir);
    expect(occurrences).toEqual([
      expect.objectContaining({
        token: 'absolute',
        path: 'widget.proto.ts',
        context: 'setup',
      }),
      expect.objectContaining({
        token: 'z-40',
        path: 'widget.proto.ts',
        context: 'setup',
      }),
      expect.objectContaining({
        token: 'hidden',
        path: 'widget.proto.ts',
        context: 'rule',
      }),
    ]);
    for (const occurrence of occurrences) {
      expect(occurrence.line).toBeGreaterThan(0);
      expect(occurrence.column).toBeGreaterThan(0);
    }

    const closure = await collectProtoStyleTokens(dir);
    expect(closure).toContain('pointer-events-none');
  });

  it('resolves template literal interpolation and cross-file constant imports', async () => {
    await writeFile(
      path.join(dir, 'style.ts'),
      [
        "export const HOVER_TOKENS = '-translate-x-0.5 -translate-y-0.5 shadow-[8px_8px_0_0_var(--pui-foreground)]';",
        "export const PANEL_TOKENS = 'z-50 w-64 p-4';",
      ].join('\n')
    );
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        "import { asButton } from '@proto.ui/prototypes-base/button';",
        "import { HOVER_TOKENS, PANEL_TOKENS } from './style';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        '    def.feedback.style.use(tw(`fixed ${PANEL_TOKENS} border-2`));',
        '    const { hovered } = asButton().stateHandles;',
        '    def.rule({',
        '      when: (w) => w.state(hovered).eq(true),',
        '      intent: (i) => i.feedback.style.use(tw(HOVER_TOKENS)),',
        '    });',
        '  },',
        '});',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);

    // Template literal interpolation must contribute both literal and imported tokens.
    expect(tokens).toContain('fixed');
    expect(tokens).toContain('border-2');
    expect(tokens).toContain('z-50');
    expect(tokens).toContain('w-64');
    expect(tokens).toContain('p-4');
    // Imported constants referenced by identifier must contribute their tokens.
    expect(tokens).toContain('-translate-x-0.5');
    expect(tokens).toContain('-translate-y-0.5');
    expect(tokens).toContain('shadow-[8px_8px_0_0_var(--pui-foreground)]');
    // Single-state rules serialize on the web adapter as data-state variants,
    // so the static CSS must contain matching data-variant tokens.
    expect(tokens).toContain('data-[hovered]:-translate-x-0.5');
    expect(tokens).toContain('data-[hovered]:shadow-[8px_8px_0_0_var(--pui-foreground)]');
  });
  it('collects all private CodeBlock style constants from the real source tree', async () => {
    const tokens = await collectProtoStyleTokens(
      path.resolve(process.cwd(), 'packages/compositions/chatui')
    );

    expect(tokens).toEqual(
      expect.arrayContaining([
        'flex',
        'justify-between',
        'text-sm',
        'leading-6',
        'whitespace-pre-wrap',
        'wrap-anywhere',
      ])
    );
  });

  it('maps asButton pressed rules to the data-[pressed] web serialization', async () => {
    await writeFile(
      path.join(dir, 'press.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        "import { asButton } from '@proto.ui/prototypes-base/button';",
        '',
        'const pressable = definePrototype({',
        "  name: 'pressable',",
        '  setup(def) {',
        '    const { pressed } = asButton().stateHandles;',
        '    def.rule({',
        '      when: (w) => w.state(pressed).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('translate-x-[5px] translate-y-[5px] shadow-none')),",
        '    });',
        '  },',
        '});',
        'export default pressable;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);

    expect(tokens).toContain('data-[pressed]:translate-x-[5px]');
    expect(tokens).toContain('data-[pressed]:translate-y-[5px]');
    expect(tokens).toContain('data-[pressed]:shadow-none');
    expect(tokens).not.toContain('active:translate-x-[5px]');
  });

  it('maps asTooltipTrigger feedback rules to the serialized Tooltip state attributes', async () => {
    await writeFile(
      path.join(dir, 'tooltip-trigger.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        "import { asTooltipTrigger } from '@proto.ui/prototypes-base/tooltip';",
        '',
        'const trigger = definePrototype({',
        "  name: 'styled-tooltip-trigger',",
        '  setup(def) {',
        '    const state = asTooltipTrigger().stateHandles;',
        '    if (!state) throw new Error("missing state handles");',
        '    def.rule({',
        '      when: (w) => w.state(state.hovered).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('opacity-70')),",
        '    });',
        '    def.rule({',
        '      when: (w) => w.state(state.focusVisible).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('ring-2')),",
        '    });',
        '  },',
        '});',
        'export default trigger;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);

    expect(tokens).toContain('data-[hovered]:opacity-70');
    expect(tokens).toContain('data-[focus-visible]:ring-2');
    expect(tokens).not.toContain('hover:opacity-70');
  });

  it('maps asTextareaRoot state rules to their web data attributes', async () => {
    await writeFile(
      path.join(dir, 'textarea.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        "import { asTextareaRoot } from '@proto.ui/prototypes-base/textarea';",
        '',
        'const textarea = definePrototype({',
        "  name: 'styled-textarea',",
        '  setup(def) {',
        '    const hook = asTextareaRoot();',
        '    const state = hook.stateHandles;',
        '    if (!state) throw new Error("missing state handles");',
        '    def.rule({',
        '      when: (w) => w.state(state.disabled).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('cursor-not-allowed opacity-50')),",
        '    });',
        '    def.rule({',
        '      when: (w) => w.state(state.focusVisible).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('ring-[7px]')),",
        '    });',
        '  },',
        '});',
        'export default textarea;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);

    expect(tokens).toContain('data-[disabled]:cursor-not-allowed');
    expect(tokens).toContain('data-[disabled]:opacity-50');
    expect(tokens).toContain('data-[focus-visible]:ring-[7px]');
  });

  it('maps asSeparatorRoot enum rules to data-orientation value selectors', async () => {
    await writeFile(
      path.join(dir, 'separator.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        "import { asSeparatorRoot } from '@proto.ui/prototypes-base/separator';",
        '',
        'const separator = definePrototype({',
        "  name: 'styled-separator',",
        '  setup(def) {',
        '    const { orientation } = asSeparatorRoot().stateHandles;',
        '    def.rule({',
        "      when: (w) => w.state(orientation).eq('horizontal'),",
        "      intent: (i) => i.feedback.style.use(tw('h-0.5 w-full')),",
        '    });',
        '    def.rule({',
        "      when: (w) => w.state(orientation).eq('vertical'),",
        "      intent: (i) => i.feedback.style.use(tw('h-12 w-0.5')),",
        '    });',
        '  },',
        '});',
        'export default separator;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);

    expect(tokens).toContain('data-[orientation=horizontal]:h-0.5');
    expect(tokens).toContain('data-[orientation=horizontal]:w-full');
    expect(tokens).toContain('data-[orientation=vertical]:h-12');
    expect(tokens).toContain('data-[orientation=vertical]:w-0.5');
  });

  it('maps asScrollAreaScrollbar orientation rules to track selectors', async () => {
    await writeFile(
      path.join(dir, 'scroll-area-scrollbar.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        "import { asScrollAreaScrollbar } from '@proto.ui/prototypes-base/scroll-area';",
        '',
        'const scrollbar = definePrototype({',
        "  name: 'styled-scroll-area-scrollbar',",
        '  setup(def) {',
        '    const state = asScrollAreaScrollbar().stateHandles;',
        '    if (!state) throw new Error("missing state handles");',
        '    def.rule({',
        "      when: (w) => w.state(state.orientation).eq('horizontal'),",
        "      intent: (i) => i.feedback.style.use(tw('h-2.5 flex-col')),",
        '    });',
        '  },',
        '});',
        'export default scrollbar;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);

    expect(tokens).toContain('data-[orientation=horizontal]:h-2.5');
    expect(tokens).toContain('data-[orientation=horizontal]:flex-col');
  });

  it('maps asScrollAreaViewport focus rules to the inherited focus-visible selector', async () => {
    await writeFile(
      path.join(dir, 'scroll-area-viewport.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        "import { asScrollAreaViewport } from '@proto.ui/prototypes-base/scroll-area';",
        '',
        'const viewport = definePrototype({',
        "  name: 'styled-scroll-area-viewport',",
        '  setup(def) {',
        '    const state = asScrollAreaViewport().stateHandles;',
        '    if (!state) throw new Error("missing state handles");',
        '    def.rule({',
        '      when: (w) => w.state(state.focusVisible).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('ring-3 outline-1')),",
        '    });',
        '  },',
        '});',
        'export default viewport;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);

    expect(tokens).toContain('data-[focus-visible]:ring-3');
    expect(tokens).toContain('data-[focus-visible]:outline-1');
  });

  it('maps asAsyncRegionRoot busy rules to the data-busy web serialization', async () => {
    await writeFile(
      path.join(dir, 'async-region.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        "import { asAsyncRegionRoot } from '@proto.ui/prototypes-base/async-region';",
        '',
        'const asyncRegion = definePrototype({',
        "  name: 'styled-async-region',",
        '  setup(def) {',
        '    const { busy } = asAsyncRegionRoot().stateHandles;',
        '    def.rule({',
        '      when: (w) => w.state(busy).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-wait')),",
        '    });',
        '  },',
        '});',
        'export default asyncRegion;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);

    expect(tokens).toContain('data-[busy]:opacity-50');
    expect(tokens).toContain('data-[busy]:cursor-wait');
  });
  it('keeps commas inside arbitrary tokens when an array literal is joined', async () => {
    await writeFile(
      path.join(dir, 'field.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const BASE_TOKENS = [',
        "  'flex',",
        "  'transition-[color,box-shadow]',",
        "  'duration-150',",
        "].join(' ');",
        '',
        'const field = definePrototype({',
        "  name: 'styled-field',",
        '  setup(def) {',
        '    def.feedback.style.use(tw(BASE_TOKENS));',
        '  },',
        '});',
        'export default field;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);

    // The comma belongs to the token, not to the element list, so joining must
    // not hand the splitter an element boundary it never had.
    expect(tokens).toContain('transition-[color,box-shadow]');
    expect(tokens).not.toContain('transition-[color');
    expect(tokens).not.toContain('box-shadow]');
    expect(tokens).toContain('flex');
    expect(tokens).toContain('duration-150');
  });
  it('lowers checkbox mixed and guarded dark conditions into the closure', async () => {
    await writeFile(
      path.join(dir, 'box.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        "import { asCheckboxRoot } from '@proto.ui/prototypes-base/checkbox';",
        '',
        'const box = definePrototype({',
        "  name: 'styled-checkbox',",
        '  setup(def) {',
        '    const { checked, indeterminate } = asCheckboxRoot().stateHandles;',
        '    def.rule({',
        '      when: (w) => w.state(indeterminate).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-primary')),",
        '    });',
        '    def.rule({',
        '      when: (w) =>',
        '        w.all(',
        "          w.meta('colorScheme').eq('dark'),",
        '          w.state(checked).eq(false),',
        '          w.state(indeterminate).eq(false)',
        '        ),',
        "      intent: (i) => i.feedback.style.use(tw('bg-input/30')),",
        '    });',
        '  },',
        '});',
        'export default box;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);

    // Without the checkbox entries in the hook table neither rule contributes a
    // variant, and the tint reaches the closure as a plain `dark:` token that
    // also covers the filled box.
    expect(tokens).toContain('data-[indeterminate]:bg-primary');
    expect(tokens).toContain('dark:not-[data-checked]:not-[data-indeterminate]:bg-input/30');
    expect(tokens).not.toContain('dark:bg-input/30');
  });

  it('lowers a rule on an exposed prototype-owned state', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const hidden = def.state.bool('hidden', true);",
        // The expose call is what gives the state a host attribute, so it is
        // also what tells the extractor the selector.
        "    def.expose.state('hidden', hidden);",
        '    def.rule({',
        '      when: (w) => w.state(hidden).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('hidden')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    expect(await collectProtoStyleTokens(dir)).toContain('data-[hidden]:hidden');
  });

  it('normalizes an exposed key the way the Web runtime does', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const dragOver = def.state.bool('dragOver', false);",
        "    def.expose.state('dragOver', dragOver);",
        '    def.rule({',
        '      when: (w) => w.state(dragOver).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    // `createExposeStateWebNameMap` kebab-cases an unannotated key.
    expect(await collectProtoStyleTokens(dir)).toContain('data-[drag-over]:bg-accent');
  });

  it('uses the declared state name rather than the expose key', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const flag = def.state.bool('internalFlag', false);",
        // `StateKernel` stores the declared name as `__stateSemantic`, and
        // `ExposeStateWebModuleImpl` maps that before the expose key.
        "    def.expose.state('visible', flag);",
        '    def.rule({',
        '      when: (w) => w.state(flag).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[internal-flag]:bg-accent');
    expect(tokens).not.toContain('data-[visible]:bg-accent');
  });

  it('registers an exposure declared after the rule that reads it', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const hidden = def.state.bool('hidden', true);",
        '    def.rule({',
        '      when: (w) => w.state(hidden).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('hidden')),",
        '    });',
        // The runtime builds its exposed-state map after setup returns, so
        // source order does not decide whether the rule lowers.
        "    def.expose.state('hidden', hidden);",
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    expect(await collectProtoStyleTokens(dir)).toContain('data-[hidden]:hidden');
  });

  it('resolves a constant expose key', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const key = 'hidden';",
        "    const hidden = def.state.bool('hidden', true);",
        '    def.expose.state(key, hidden);',
        '    def.rule({',
        '      when: (w) => w.state(hidden).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('hidden')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    expect(await collectProtoStyleTokens(dir)).toContain('data-[hidden]:hidden');
  });

  it('keeps an official semantic when the state is exposed under another key', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const hovered = def.state.fromInteraction('hovered');",
        // The runtime maps the official semantic before it would fall back to
        // the exposed key, so the key must not win here either.
        "    def.expose.state('isHot', hovered);",
        '    def.rule({',
        '      when: (w) => w.state(hovered).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('hover:bg-accent');
    expect(tokens).not.toContain('data-[is-hot]:bg-accent');
  });

  it('registers an exposure however it is written', async () => {
    // Each of these reaches the same runtime exposure, so each must lower.
    const shapes: Record<string, string[]> = {
      wrapped: ["    def.expose.state('visible', flag as never);"],
      elementAccess: ["    def.expose['state']('visible', flag);"],
      aliased: ['    const publicFlag = flag;', "    def.expose.state('visible', publicFlag);"],
      nested: ['    if (enabled) {', "      def.expose.state('visible', flag);", '    }'],
      constantName: [],
    };

    for (const [label, exposeLines] of Object.entries(shapes)) {
      const declaration =
        label === 'constantName'
          ? [
              "    const name = 'internalFlag';",
              '    const flag = def.state.bool(name, false);',
              "    def.expose.state('visible', flag);",
            ]
          : ["    const flag = def.state.bool('internalFlag', false);", ...exposeLines];
      await writeFile(
        path.join(dir, 'widget.proto.ts'),
        [
          "import { definePrototype, tw } from '@proto.ui/core';",
          '',
          'const widget = definePrototype({',
          "  name: 'widget',",
          '  setup(def) {',
          ...declaration,
          '    def.rule({',
          '      when: (w) => w.state(flag).eq(true),',
          "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
          '    });',
          '  },',
          '});',
          '',
          'export default widget;',
        ].join('\n')
      );

      expect(await collectProtoStyleTokens(dir), label).toContain('data-[internal-flag]:bg-accent');
    }
  });

  it('keeps sibling alias names apart', async () => {
    // Two setups in one file may each bind `publicFlag`; a file-wide alias map
    // would attribute the first exposure to the second handle.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'export const first = definePrototype({',
        "  name: 'first',",
        '  setup(def) {',
        "    const flag = def.state.bool('firstFlag', false);",
        '    const publicFlag = flag;',
        "    def.expose.state('visible', publicFlag);",
        '    def.rule({',
        '      when: (w) => w.state(flag).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export const second = definePrototype({',
        "  name: 'second',",
        '  setup(def) {',
        "    const other = def.state.bool('secondFlag', false);",
        '    const publicFlag = other;',
        "    def.expose.state('shown', publicFlag);",
        '  },',
        '});',
      ].join('\n')
    );

    expect(await collectProtoStyleTokens(dir)).toContain('data-[first-flag]:bg-accent');
  });

  it('emits nothing for a declared name it cannot evaluate', async () => {
    // `__stateSemantic` is the call's result at runtime and takes precedence,
    // so the expose key would be the wrong selector rather than a safe default.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        "import { makeStateName } from './names';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        '    const flag = def.state.bool(makeStateName(), false);',
        "    def.expose.state('visible', flag);",
        '    def.rule({',
        '      when: (w) => w.state(flag).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    expect(await collectProtoStyleTokens(dir)).not.toContain('data-[visible]:bg-accent');
  });

  it('lowers a discrete-number comparison on an exposed state', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const step = def.state.numberDiscrete('step', 0);",
        "    def.expose.state('step', step);",
        '    def.rule({',
        '      when: (w) => w.state(step).eq(1),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    // The Web runtime stringifies the literal the way it does for enums.
    expect(await collectProtoStyleTokens(dir)).toContain('data-[step=1]:bg-accent');
  });

  it('keeps sibling blocks from sharing an alias', async () => {
    // Two blocks in one setup may legally reuse `publicFlag` for different
    // handles; a function-scoped map would let the later one overwrite.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    {',
        '      const publicFlag = first;',
        "      def.expose.state('a', publicFlag);",
        '    }',
        '    {',
        '      const publicFlag = second;',
        "      def.expose.state('b', publicFlag);",
        '    }',
        '    def.rule({',
        '      when: (w) => w.state(first).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    expect(await collectProtoStyleTokens(dir)).toContain('data-[first-flag]:bg-accent');
  });

  it('keeps an exposure bound to the alias in effect where it was written', async () => {
    // The runtime captured `first` at the expose call; a later `var` rebinding
    // must not retarget it.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    var publicFlag = first;',
        "    def.expose.state('visible', publicFlag);",
        '    var publicFlag = second;',
        '    def.rule({',
        '      when: (w) => w.state(first).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    expect(await collectProtoStyleTokens(dir)).toContain('data-[first-flag]:bg-accent');
  });

  it('lowers a state exposed through the generic entry', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const ready = def.state.bool('ready', false);",
        // `ExposeStateModuleImpl` recognizes a state handle here as well.
        "    def.expose('ready', ready);",
        '    def.rule({',
        '      when: (w) => w.state(ready).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    expect(await collectProtoStyleTokens(dir)).toContain('data-[ready]:bg-accent');
  });

  it('lowers a signed discrete-number comparison', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const step = def.state.numberDiscrete('step', 0);",
        "    def.expose.state('step', step);",
        // `-1` parses as a prefix unary expression, not a numeric literal.
        '    def.rule({',
        '      when: (w) => w.state(step).eq(-1),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    expect(await collectProtoStyleTokens(dir)).toContain('data-[step=-1]:bg-accent');
  });

  it('resolves each alias hop where that hop was created', async () => {
    // `publicFlag` captured `current` while `current` still meant `first`; a
    // later `var current = second` must not retarget the exposure.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    var current = first;',
        '    const publicFlag = current;',
        '    var current = second;',
        "    def.expose.state('visible', publicFlag);",
        '    def.rule({',
        '      when: (w) => w.state(first).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[first-flag]:bg-accent');
    expect(tokens).not.toContain('data-[second-flag]:bg-accent');
  });

  it('follows an alias reassigned before the exposure', async () => {
    // The runtime captured whatever `publicFlag` held at the expose call, and a
    // plain assignment moves the handle just as a declaration does.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    let publicFlag = first;',
        '    publicFlag = second;',
        "    def.expose.state('visible', publicFlag);",
        '    def.rule({',
        '      when: (w) => w.state(second).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    expect(await collectProtoStyleTokens(dir)).toContain('data-[second-flag]:bg-accent');
  });

  it('reads the declared name through a wrapped initializer', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const flag = (def.state.bool('internalFlag', false)) as never;",
        "    def.expose.state('visible', flag);",
        '    def.rule({',
        '      when: (w) => w.state(flag).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[internal-flag]:bg-accent');
    expect(tokens).not.toContain('data-[visible]:bg-accent');
  });

  it('sees an alias reassigned inside a nested block', async () => {
    // The assignment targets the outer binding, so an exposure written after
    // the block has to see it.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    let publicFlag = first;',
        '    {',
        '      publicFlag = second;',
        '    }',
        "    def.expose.state('visible', publicFlag);",
        '    def.rule({',
        '      when: (w) => w.state(second).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    expect(await collectProtoStyleTokens(dir)).toContain('data-[second-flag]:bg-accent');
  });

  it('records every branch of a conditional alias', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    const publicFlag = enabled ? first : second;',
        "    def.expose.state('visible', publicFlag);",
        "    def.rule({ when: (w) => w.state(second).eq(true), intent: (i) => i.feedback.style.use(tw('bg-accent')) });",
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[second-flag]:bg-accent');
  });

  it('treats a var alias as function scoped', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    var publicFlag = first;',
        '    {',
        '      var publicFlag = second;',
        '    }',
        "    def.expose.state('visible', publicFlag);",
        "    def.rule({ when: (w) => w.state(second).eq(true), intent: (i) => i.feedback.style.use(tw('bg-accent')) });",
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[second-flag]:bg-accent');
  });

  it('reads a handle exposed through a property', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const ready = def.state.bool('ready', false);",
        '    const controls = { ready };',
        "    def.expose.state('ready', controls.ready);",
        "    def.rule({ when: (w) => w.state(ready).eq(true), intent: (i) => i.feedback.style.use(tw('bg-accent')) });",
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[ready]:bg-accent');
  });

  it('reads a state declared through element access', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const flag = def.state['bool']('internalFlag', false);",
        "    def.expose.state('visible', flag);",
        "    def.rule({ when: (w) => w.state(flag).eq(true), intent: (i) => i.feedback.style.use(tw('bg-accent')) });",
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[internal-flag]:bg-accent');
    expect(tokens).not.toContain('data-[visible]:bg-accent');
  });

  it("does not let one prototype's exposure reach a sibling's same-named state", async () => {
    // A sibling that independently declares `flag` and never exposes it must
    // keep its rule on the runtime plan.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'export const exposed = definePrototype({',
        "  name: 'exposed',",
        '  setup(def) {',
        "    const flag = def.state.bool('firstFlag', false);",
        "    def.expose.state('visible', flag);",
        '    def.rule({',
        '      when: (w) => w.state(flag).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export const internal = definePrototype({',
        "  name: 'internal',",
        '  setup(def) {',
        "    const flag = def.state.bool('secondFlag', false);",
        '    def.rule({',
        '      when: (w) => w.state(flag).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-muted')),",
        '    });',
        '  },',
        '});',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[first-flag]:bg-accent');
    expect(tokens).not.toContain('data-[second-flag]:bg-muted');
  });

  it('mirrors the official exposed-state names the Web projection uses', async () => {
    // The extractor duplicates this map to stay free of runtime dependencies,
    // so the copy has to be provably identical.
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(
      path.join(process.cwd(), 'packages/cli/src/services/prototype-style-tokens.ts'),
      'utf8'
    );
    const block = source.match(
      /const OFFICIAL_EXPOSED_STATE_NAMES = Object\.freeze\(\{([\s\S]*?)\}\);/
    );
    if (!block) throw new Error('the extractor must carry an official-name map');

    const mirrored: Record<string, string> = {};
    for (const [, key, value] of block[1].matchAll(/'([^']+)':\s*'([^']+)'/g)) {
      mirrored[key] = value;
    }
    expect(mirrored).toEqual({ ...OFFICIAL_EXPOSED_STATE_NAMES });
  });

  it('maps an official semantic before normalizing the name', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const flag = def.state.bool('@accessibility/checked', false);",
        "    def.expose.state('visible', flag);",
        '    def.rule({',
        '      when: (w) => w.state(flag).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[checked]:bg-accent');
    expect(tokens).not.toContain('data-[accessibility-checked]:bg-accent');
  });

  it('keeps a shadowed object from answering for an outer one', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    const controls = { ready: first };',
        '    {',
        '      const controls = { ready: second };',
        '      void controls;',
        '    }',
        "    def.expose.state('visible', controls.ready);",
        '    def.rule({',
        '      when: (w) => w.state(first).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    expect(await collectProtoStyleTokens(dir)).toContain('data-[first-flag]:bg-accent');
  });

  it('registers a declaration under single-statement control flow', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    if (true) var flag = def.state.bool('gated', false);",
        "    def.expose.state('gated', flag);",
        '    def.rule({',
        '      when: (w) => w.state(flag).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    expect(await collectProtoStyleTokens(dir)).toContain('data-[gated]:bg-accent');
  });

  it('serializes a discrete number the way the runtime does', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const step = def.state.numberDiscrete('step', 0);",
        "    def.expose.state('step', step);",
        // The runtime lowers with `String(literal)`, and `String(-0)` is `0`.
        '    def.rule({',
        '      when: (w) => w.state(step).eq(-0),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[step=0]:bg-accent');
    expect(tokens).not.toContain('data-[step=-0]:bg-accent');
  });

  it('keeps every binding a legal redeclaration installs', async () => {
    // The exposure pre-pass must not flatten sequential declaration scope.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    var T = 'bg-red';",
        '    def.feedback.style.use(tw(T));',
        "    var T = 'bg-blue';",
        '    def.feedback.style.use(tw(T));',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('bg-red');
    expect(tokens).toContain('bg-blue');
  });

  it('lowers the Scroll Area Viewport focus condition into the closure', async () => {
    await writeFile(
      path.join(dir, 'surface.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        "import { asScrollAreaViewport } from '@proto.ui/prototypes-base/scroll-area';",
        '',
        'const surface = definePrototype({',
        "  name: 'styled-scroll-area-viewport',",
        '  setup(def) {',
        '    const { focusVisible } = asScrollAreaViewport().stateHandles;',
        '    def.rule({',
        '      when: (w) => w.state(focusVisible).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('ring-2 ring-inset')),",
        '    });',
        '  },',
        '});',
        'export default surface;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);

    // Without the Viewport entry in the hook table the rule contributes no
    // variant, and the ring reaches the closure unconditional.
    expect(tokens).toContain('data-[focus-visible]:ring-2');
    expect(tokens).toContain('data-[focus-visible]:ring-inset');
  });
  it('lowers an owned interaction semantic to its native variant', async () => {
    // `buildSemanticVariant` runs before the attribute, so the optimizer emits
    // `hover:` and nothing ever renders `data-[hovered]:`.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const hovered = def.state.bool('@interaction/hovered', false);",
        "    def.expose.state('hovered', hovered);",
        '    def.rule({',
        '      when: (w) => w.state(hovered).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('hover:bg-accent');
    expect(tokens).not.toContain('data-[hovered]:bg-accent');
  });

  it('keeps the attribute for an official semantic the policy refuses', async () => {
    // `@interaction/disabled` has a native variant the Web policy rejects, and
    // `@accessibility/checked` has none at all; both stay on the attribute.
    expect(createExposeStateWebNativeVariantPolicy({ semantic: '@interaction/hovered' })).toBe(
      true
    );
    expect(createExposeStateWebNativeVariantPolicy({ semantic: '@interaction/pressed' })).toBe(
      true
    );
    expect(createExposeStateWebNativeVariantPolicy({ semantic: '@interaction/disabled' })).toBe(
      false
    );

    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const off = def.state.bool('@interaction/disabled', false);",
        "    const ticked = def.state.bool('@accessibility/checked', false);",
        "    def.expose.state('off', off);",
        "    def.expose.state('ticked', ticked);",
        '    def.rule({',
        '      when: (w) => w.state(off).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('opacity-50')),",
        '    });',
        '    def.rule({',
        '      when: (w) => w.state(ticked).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[disabled]:opacity-50');
    expect(tokens).toContain('data-[checked]:bg-accent');
  });

  it('follows a handle written into the container before the exposure', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    const controls = { ready: first };',
        '    controls.ready = second;',
        "    def.expose.state('visible', controls.ready);",
        '    def.rule({',
        '      when: (w) => w.state(second).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[second-flag]:bg-accent');
  });

  it('leaves a member write after the exposure out of it', async () => {
    // The exposure captured the member as it read, so the later write moves
    // nothing; only the handle in effect at the call has a variant.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    const controls = { ready: first };',
        "    def.expose.state('visible', controls.ready);",
        '    controls.ready = second;',
        '    def.rule({',
        '      when: (w) => w.state(first).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '    def.rule({',
        '      when: (w) => w.state(second).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-muted')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[first-flag]:bg-accent');
    expect(tokens).not.toContain('data-[second-flag]:bg-muted');
  });

  it('normalizes a state named after an inherited object key', async () => {
    // The official-name table is a plain object literal, so `constructor` must
    // not resolve to the function it inherits.
    expect(createExposeStateWebNameMap('constructor').dataAttr).toBe('data-constructor');

    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const flag = def.state.bool('constructor', false);",
        "    def.expose.state('constructor', flag);",
        '    def.rule({',
        '      when: (w) => w.state(flag).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    expect(await collectProtoStyleTokens(dir)).toContain('data-[constructor]:bg-accent');
  });
  it('negates a native interaction variant through its attribute', async () => {
    // `buildSemanticVariant` only answers a true comparison, so the optimizer
    // falls back to `not-[data-hovered]` and still removes the rule. Emitting
    // only the positive condition would apply the style while hovered.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const hovered = def.state.bool('@interaction/hovered', false);",
        "    const other = def.state.bool('otherFlag', false);",
        "    def.expose.state('hovered', hovered);",
        "    def.expose.state('other', other);",
        '    def.rule({',
        '      when: (w) => w.all(w.state(hovered).eq(false), w.state(other).eq(true)),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[other-flag]:not-[data-hovered]:bg-accent');
  });

  it('negates a hook-sourced native variant the same way', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const hovered = def.state.fromInteraction('hovered');",
        "    const pressed = def.state.fromInteraction('pressed');",
        '    def.rule({',
        '      when: (w) => w.all(w.state(hovered).eq(false), w.state(pressed).eq(true)),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('active:not-[data-hovered]:bg-accent');
  });

  it('binds a loop initializer inside the loop, not over the outer name', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const flag = def.state.bool('outerFlag', false);",
        '    void flag;',
        "    for (let flag = def.state.bool('innerFlag', false); once; ) {",
        "      def.expose.state('visible', flag);",
        '      def.rule({',
        '        when: (w) => w.state(flag).eq(true),',
        "        intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '      });',
        '    }',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[inner-flag]:bg-accent');
    expect(tokens).not.toContain('data-[outer-flag]:bg-accent');
  });

  it('follows a reassigned alias the rule itself reads', async () => {
    // The exposure prepass already followed the assignment; the ordinary walk
    // left the alias frozen at its declaration.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    let current = first;',
        '    current = second;',
        "    def.expose.state('visible', current);",
        '    def.rule({',
        '      when: (w) => w.state(current).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[second-flag]:bg-accent');
    expect(tokens).not.toContain('data-[first-flag]:bg-accent');
  });

  it('follows a handle aliased through a binding pattern', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const flag = def.state.bool('internalFlag', false);",
        '    const { ready: publicFlag } = { ready: flag };',
        "    def.expose.state('visible', publicFlag);",
        '    def.rule({',
        '      when: (w) => w.state(flag).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    expect(await collectProtoStyleTokens(dir)).toContain('data-[internal-flag]:bg-accent');
  });

  it('follows a handle aliased through an array pattern', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const flag = def.state.bool('internalFlag', false);",
        '    const [publicFlag] = [flag];',
        "    def.expose.state('visible', publicFlag);",
        '    def.rule({',
        '      when: (w) => w.state(flag).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    expect(await collectProtoStyleTokens(dir)).toContain('data-[internal-flag]:bg-accent');
  });
  it('replaces the member table when a whole container is assigned', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    let controls = { ready: first };',
        '    controls = { ready: second };',
        "    def.expose.state('visible', controls.ready);",
        '    def.rule({',
        '      when: (w) => w.state(second).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    expect(await collectProtoStyleTokens(dir)).toContain('data-[second-flag]:bg-accent');
  });

  it('gives both branches of a conditional member write a variant', async () => {
    // The runtime picks one at the expose call; over-approximating gives each
    // candidate its variant, while recording neither leaves the chosen one
    // without CSS.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    const controls = { ready: first };',
        '    controls.ready = enabled ? first : second;',
        "    def.expose.state('visible', controls.ready);",
        '    def.rule({',
        '      when: (w) => w.state(first).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-muted')),",
        '    });',
        '    def.rule({',
        '      when: (w) => w.state(second).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[first-flag]:bg-muted');
    expect(tokens).toContain('data-[second-flag]:bg-accent');
  });
  it('reads a member at the position it was written', async () => {
    // The object captured whatever `current` named then; a later reassignment
    // moves the alias, not what the container already holds.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    let current = first;',
        '    const controls = { ready: current };',
        '    current = second;',
        "    def.expose.state('visible', controls.ready);",
        '    def.rule({',
        '      when: (w) => w.state(first).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    expect(await collectProtoStyleTokens(dir)).toContain('data-[first-flag]:bg-accent');
  });

  it('keeps the earlier handle when a write may be skipped', async () => {
    // The runtime takes one path; whichever it takes, that rule is optimized
    // away, so both candidates need a variant.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    let current = first;',
        '    if (enabled) current = second;',
        "    def.expose.state('visible', current);",
        '    def.rule({',
        '      when: (w) => w.state(first).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-muted')),",
        '    });',
        '    def.rule({',
        '      when: (w) => w.state(second).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[first-flag]:bg-muted');
    expect(tokens).toContain('data-[second-flag]:bg-accent');
  });

  it('drops the earlier handle when the branch is statically taken', async () => {
    // `if (true)` executes exactly as written, so retaining the earlier handle
    // would emit a variant for a state the runtime never exposes.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    let current = first;',
        '    if (true) current = second;',
        "    def.expose.state('visible', current);",
        '    def.rule({',
        '      when: (w) => w.state(first).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-muted')),",
        '    });',
        '    def.rule({',
        '      when: (w) => w.state(second).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[second-flag]:bg-accent');
    expect(tokens).not.toContain('data-[first-flag]:bg-muted');
  });

  it('hoists a nested var redeclaration the rule reads', async () => {
    // One function-scoped binding, so the block's declaration is the same one
    // the statements after it see.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    var current = first;',
        '    {',
        '      var current = second;',
        '    }',
        "    def.expose.state('visible', current);",
        '    def.rule({',
        '      when: (w) => w.state(current).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[second-flag]:bg-accent');
    expect(tokens).not.toContain('data-[first-flag]:bg-accent');
  });

  it('normalizes a state name that starts with a digit', async () => {
    // `createExposeStateWebNameMap('1st')` is `data-1st`, and `[data-1st]` is a
    // legal attribute selector, so nothing here may reject it.
    expect(createExposeStateWebNameMap('1st').dataAttr).toBe('data-1st');

    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const flag = def.state.bool('1st', false);",
        "    def.expose.state('1st', flag);",
        '    def.rule({',
        '      when: (w) => w.state(flag).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    expect(await collectProtoStyleTokens(dir)).toContain('data-[1st]:bg-accent');
  });
  it('gives a rule reading a skippable alias both selectors', async () => {
    // The exposure already covered both handles; the rule read did not, so an
    // `enabled === false` build lowered to a variant the closure never carried.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    let current = first;',
        '    if (enabled) current = second;',
        "    def.expose.state('visible', current);",
        '    def.rule({',
        '      when: (w) => w.state(current).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[first-flag]:bg-accent');
    expect(tokens).toContain('data-[second-flag]:bg-accent');
  });

  it('combines a skippable alias with the other conditions of its rule', async () => {
    // One selector per combination the runtime may take, not one selector
    // carrying both alternatives at once.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        "    const other = def.state.bool('otherFlag', false);",
        '    let current = first;',
        '    if (enabled) current = second;',
        "    def.expose.state('visible', current);",
        "    def.expose.state('other', other);",
        '    def.rule({',
        '      when: (w) => w.all(w.state(current).eq(true), w.state(other).eq(true)),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[first-flag]:data-[other-flag]:bg-accent');
    expect(tokens).toContain('data-[other-flag]:data-[second-flag]:bg-accent');
  });

  it('reads a state handle held in a plain container', async () => {
    // The exposure already resolved through the member; the rule read has to
    // reach the same handle or the optimized rule has no CSS.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const flag = def.state.bool('internalFlag', false);",
        '    const controls = { ready: flag };',
        "    def.expose.state('visible', controls.ready);",
        '    def.rule({',
        '      when: (w) => w.state(controls.ready).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    expect(await collectProtoStyleTokens(dir)).toContain('data-[internal-flag]:bg-accent');
  });
  it('reads a destructured handle the rule uses by its alias', async () => {
    // The prepass already traced the pattern for the exposure; the rule reads
    // the alias, so the alias itself has to carry the state semantic.
    for (const [label, container] of [
      ['object literal', 'const { ready: publicFlag } = { ready: flag };'],
      ['array literal', 'const [publicFlag] = [flag];'],
      [
        'container variable',
        'const controls = { ready: flag };\n    const { ready: publicFlag } = controls;',
      ],
    ] as const) {
      await writeFile(
        path.join(dir, 'widget.proto.ts'),
        [
          "import { definePrototype, tw } from '@proto.ui/core';",
          '',
          'const widget = definePrototype({',
          "  name: 'widget',",
          '  setup(def) {',
          "    const flag = def.state.bool('internalFlag', false);",
          `    ${container}`,
          "    def.expose.state('visible', publicFlag);",
          '    def.rule({',
          '      when: (w) => w.state(publicFlag).eq(true),',
          "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
          '    });',
          '  },',
          '});',
          '',
          'export default widget;',
        ].join('\n')
      );

      expect(await collectProtoStyleTokens(dir), label).toContain('data-[internal-flag]:bg-accent');
    }
  });

  it('still reads a joined token array as tokens', async () => {
    // The handle-array reading runs first, so an array holding no handle has to
    // fall through to the element list `join` depends on.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    def.feedback.style.use(tw(['bg-accent', 'text-sm'].join(' ')));",
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('bg-accent');
    expect(tokens).toContain('text-sm');
  });
  it('gives both branches of a conditional alias their own selector', async () => {
    // Falling back to the expose key would emit `data-[visible]`, which the
    // runtime never sets, while both real selectors stayed missing.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    const current = enabled ? first : second;',
        "    def.expose.state('visible', current);",
        '    def.rule({',
        '      when: (w) => w.state(current).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[first-flag]:bg-accent');
    expect(tokens).toContain('data-[second-flag]:bg-accent');
    expect(tokens).not.toContain('data-[visible]:bg-accent');
  });

  it('resolves an alias target where the alias was written', async () => {
    // The exposure sits in a block that rebinds the target's name; the alias
    // captured the outer handle, so that is the one exposed.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const flag = def.state.bool('outerFlag', false);",
        '    const current = flag;',
        '    {',
        "      const flag = def.state.bool('innerFlag', false);",
        '      void flag;',
        "      def.expose.state('visible', current);",
        '    }',
        '    def.rule({',
        '      when: (w) => w.state(flag).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    expect(await collectProtoStyleTokens(dir)).toContain('data-[outer-flag]:bg-accent');
  });

  it('keeps token members of a container that also holds a handle', async () => {
    // Reading the container for its handles must not discard its token data.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const flag = def.state.bool('internalFlag', false);",
        "    def.expose.state('visible', flag);",
        "    const controls = { ready: flag, className: 'bg-red' };",
        // Element access: reading a token map through a property access has
        // never resolved here, with or without a handle in the container.
        "    def.feedback.style.use(tw(controls['className']));",
        '    def.rule({',
        '      when: (w) => w.state(controls.ready).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('bg-red');
    expect(tokens).toContain('data-[internal-flag]:bg-accent');
  });
  it('reads a container member the rule uses after a write', async () => {
    // The exposure prepass already followed the write; the rule reads the
    // member itself, so the ordinary walk has to follow it too.
    for (const [label, write, read] of [
      ['property access', 'controls.ready = second;', 'controls.ready'],
      ['element access', "controls['ready'] = second;", "controls['ready']"],
    ] as const) {
      await writeFile(
        path.join(dir, 'widget.proto.ts'),
        [
          "import { definePrototype, tw } from '@proto.ui/core';",
          '',
          'const widget = definePrototype({',
          "  name: 'widget',",
          '  setup(def) {',
          "    const first = def.state.bool('firstFlag', false);",
          "    const second = def.state.bool('secondFlag', false);",
          '    const controls = { ready: first };',
          `    ${write}`,
          `    def.expose.state('visible', ${read});`,
          '    def.rule({',
          `      when: (w) => w.state(${read}).eq(true),`,
          "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
          '    });',
          '  },',
          '});',
          '',
          'export default widget;',
        ].join('\n')
      );

      const tokens = await collectProtoStyleTokens(dir);
      expect(tokens, label).toContain('data-[second-flag]:bg-accent');
    }
  });

  it('keeps the earlier member when the write may be skipped', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    const controls = { ready: first };',
        '    if (enabled) controls.ready = second;',
        "    def.expose.state('visible', controls.ready);",
        '    def.rule({',
        '      when: (w) => w.state(controls.ready).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[first-flag]:bg-accent');
    expect(tokens).toContain('data-[second-flag]:bg-accent');
  });
  it('follows a member written through an alias of the container', async () => {
    // `alias` and `controls` are one object at runtime, so a write through
    // either has to move the member a read through the other sees.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    const controls = { ready: first };',
        '    const alias = controls;',
        '    alias.ready = second;',
        "    def.expose.state('visible', controls.ready);",
        '    def.rule({',
        '      when: (w) => w.state(controls.ready).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[second-flag]:bg-accent');
    expect(tokens).not.toContain('data-[first-flag]:bg-accent');
  });

  it('keeps both members when the alias write may be skipped', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    const controls = { ready: first };',
        '    const alias = controls;',
        '    if (enabled) alias.ready = second;',
        "    def.expose.state('visible', controls.ready);",
        '    def.rule({',
        '      when: (w) => w.state(controls.ready).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[first-flag]:bg-accent');
    expect(tokens).toContain('data-[second-flag]:bg-accent');
  });
  it('keeps the earlier handle when the write is inside a callback', async () => {
    // The callback has not run when `def.rule` registers, so the runtime lowers
    // the handle the name still holds; the closure has to carry both.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    let flag = first;',
        "    def.on('refresh', () => {",
        '      flag = second;',
        '    });',
        "    def.expose.state('visible', flag);",
        '    def.rule({',
        '      when: (w) => w.state(flag).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[first-flag]:bg-accent');
    expect(tokens).toContain('data-[second-flag]:bg-accent');
  });

  it('treats an immediately invoked write as ordered', async () => {
    // An IIFE runs where it is written, so the earlier handle is gone and a
    // variant for it would be dead CSS the runtime can never match.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    let flag = first;',
        '    (() => {',
        '      flag = second;',
        '    })();',
        "    def.expose.state('visible', flag);",
        '    def.rule({',
        '      when: (w) => w.state(flag).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[second-flag]:bg-accent');
    expect(tokens).not.toContain('data-[first-flag]:bg-accent');
  });
  it('keeps the earlier handle across an async or generator IIFE', async () => {
    // An async function may suspend before the write and a generator does not
    // run its body on the call at all, so neither has happened when the rule
    // registers — being directly invoked is not enough.
    for (const [label, iife] of [
      ['async', ['(async () => {', '  await 0;', '  current = second;', '})();']],
      ['generator', ['(function* () {', '  current = second;', '})();']],
    ] as const) {
      await writeFile(
        path.join(dir, 'widget.proto.ts'),
        [
          "import { definePrototype, tw } from '@proto.ui/core';",
          '',
          'const widget = definePrototype({',
          "  name: 'widget',",
          '  setup(def) {',
          "    const first = def.state.bool('firstFlag', false);",
          "    const second = def.state.bool('secondFlag', false);",
          '    let current = first;',
          ...iife.map((line) => `    ${line}`),
          "    def.expose.state('visible', current);",
          '    def.rule({',
          '      when: (w) => w.state(current).eq(true),',
          "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
          '    });',
          '  },',
          '});',
          '',
          'export default widget;',
        ].join('\n')
      );

      const tokens = await collectProtoStyleTokens(dir);
      expect(tokens, label).toContain('data-[first-flag]:bg-accent');
      expect(tokens, label).toContain('data-[second-flag]:bg-accent');
    }
  });
  it('keeps the earlier handle when an IIFE may not reach the write', async () => {
    // Running in place proves the function starts, not that this write runs.
    for (const [label, iife] of [
      ['early return', ['(() => {', '  return;', '  current = second;', '})();']],
      ['early throw', ['(() => {', "  throw new Error('x');", '  current = second;', '})();']],
      [
        'conditional return',
        ['(() => {', '  if (enabled) return;', '  current = second;', '})();'],
      ],
    ] as const) {
      await writeFile(
        path.join(dir, 'widget.proto.ts'),
        [
          "import { definePrototype, tw } from '@proto.ui/core';",
          '',
          'const widget = definePrototype({',
          "  name: 'widget',",
          '  setup(def) {',
          "    const first = def.state.bool('firstFlag', false);",
          "    const second = def.state.bool('secondFlag', false);",
          '    let current = first;',
          ...iife.map((line) => `    ${line}`),
          "    def.expose.state('visible', current);",
          '    def.rule({',
          '      when: (w) => w.state(current).eq(true),',
          "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
          '    });',
          '  },',
          '});',
          '',
          'export default widget;',
        ].join('\n')
      );

      const tokens = await collectProtoStyleTokens(dir);
      expect(tokens, label).toContain('data-[first-flag]:bg-accent');
      expect(tokens, label).toContain('data-[second-flag]:bg-accent');
    }
  });
  it('keeps the earlier member across a callback, two objects, or an unreadable key', async () => {
    for (const [label, lines, read] of [
      [
        'callback write',
        [
          'const controls = { ready: first };',
          "def.on('refresh', () => { controls.ready = second; });",
        ],
        'controls.ready',
      ],
      [
        'either of two objects',
        [
          'const controlsA = { ready: first };',
          'const controlsB = { ready: first };',
          'const alias = enabled ? controlsA : controlsB;',
          'alias.ready = second;',
        ],
        'controlsA.ready',
      ],
      [
        'unreadable key',
        ['const controls = { ready: first };', "const key = 'ready';", 'controls[key] = second;'],
        'controls.ready',
      ],
    ] as const) {
      await writeFile(
        path.join(dir, 'widget.proto.ts'),
        [
          "import { definePrototype, tw } from '@proto.ui/core';",
          '',
          'const widget = definePrototype({',
          "  name: 'widget',",
          '  setup(def) {',
          "    const first = def.state.bool('firstFlag', false);",
          "    const second = def.state.bool('secondFlag', false);",
          ...lines.map((line) => `    ${line}`),
          `    def.expose.state('visible', ${read});`,
          '    def.rule({',
          `      when: (w) => w.state(${read}).eq(true),`,
          "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
          '    });',
          '  },',
          '});',
          '',
          'export default widget;',
        ].join('\n')
      );

      const tokens = await collectProtoStyleTokens(dir);
      expect(tokens, label).toContain('data-[first-flag]:bg-accent');
      expect(tokens, label).toContain('data-[second-flag]:bg-accent');
    }
  });
  it('measures a member write against the container, not the alias', async () => {
    // The alias is declared inside the callback, so its declaring scope is the
    // callback itself and the write would look ordered against itself. What
    // decides is the lifetime of the object being mutated.
    for (const [label, block, keepsFirst] of [
      [
        'alias inside a callback',
        [
          "def.on('refresh', () => {",
          '  const alias = controls;',
          '  alias.ready = second;',
          '});',
        ],
        true,
      ],
      [
        'alias in a plain block',
        ['{', '  const alias = controls;', '  alias.ready = second;', '}'],
        false,
      ],
    ] as const) {
      await writeFile(
        path.join(dir, 'widget.proto.ts'),
        [
          "import { definePrototype, tw } from '@proto.ui/core';",
          '',
          'const widget = definePrototype({',
          "  name: 'widget',",
          '  setup(def) {',
          "    const first = def.state.bool('firstFlag', false);",
          "    const second = def.state.bool('secondFlag', false);",
          '    const controls = { ready: first };',
          ...block.map((line) => `    ${line}`),
          "    def.expose.state('visible', controls.ready);",
          '    def.rule({',
          '      when: (w) => w.state(controls.ready).eq(true),',
          "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
          '    });',
          '  },',
          '});',
          '',
          'export default widget;',
        ].join('\n')
      );

      const tokens = await collectProtoStyleTokens(dir);
      expect(tokens, label).toContain('data-[second-flag]:bg-accent');
      if (keepsFirst) expect(tokens, label).toContain('data-[first-flag]:bg-accent');
      else expect(tokens, label).not.toContain('data-[first-flag]:bg-accent');
    }
  });
  it('keeps the replaced container when the replacement may be skipped', async () => {
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        '    let controls = { ready: first };',
        '    if (enabled) controls = { ready: second };',
        "    def.expose.state('visible', controls.ready);",
        '    def.rule({',
        '      when: (w) => w.state(controls.ready).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[first-flag]:bg-accent');
    expect(tokens).toContain('data-[second-flag]:bg-accent');
  });

  it('reads both containers a conditional replacement may install', async () => {
    // The assignment itself always runs, so the replaced container is gone and
    // only the two the conditional may install have variants.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        "    const third = def.state.bool('thirdFlag', false);",
        '    let controls = { ready: first };',
        '    controls = enabled ? { ready: second } : { ready: third };',
        "    def.expose.state('visible', controls.ready);",
        '    def.rule({',
        '      when: (w) => w.state(controls.ready).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[second-flag]:bg-accent');
    expect(tokens).toContain('data-[third-flag]:bg-accent');
    expect(tokens).not.toContain('data-[first-flag]:bg-accent');
  });
  it('reaches every leaf of a nested conditional replacement', async () => {
    // A branch may itself be a conditional, so the candidates are the leaves
    // the runtime can land on rather than the composites above them.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        "    const third = def.state.bool('thirdFlag', false);",
        '    let controls = a ? (b ? { ready: first } : { ready: second }) : { ready: third };',
        "    def.expose.state('visible', controls.ready);",
        '    def.rule({',
        '      when: (w) => w.state(controls.ready).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[first-flag]:bg-accent');
    expect(tokens).toContain('data-[second-flag]:bg-accent');
    expect(tokens).toContain('data-[third-flag]:bg-accent');
  });
  it('keeps the literal branch of a mixed conditional replacement', async () => {
    // `enabled ? { … } : otherControls` yields two values, so following the
    // name edge alone abandons the table the literal branch was recorded under.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const first = def.state.bool('firstFlag', false);",
        "    const second = def.state.bool('secondFlag', false);",
        "    const third = def.state.bool('thirdFlag', false);",
        '    const otherControls = { ready: third };',
        '    let controls = { ready: first };',
        '    controls = enabled ? { ready: second } : otherControls;',
        "    def.expose.state('visible', controls.ready);",
        '    def.rule({',
        '      when: (w) => w.state(controls.ready).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    const tokens = await collectProtoStyleTokens(dir);
    expect(tokens).toContain('data-[second-flag]:bg-accent');
    expect(tokens).toContain('data-[third-flag]:bg-accent');
  });
  it('still emits what it can prove when a conditional branch is opaque', async () => {
    // The extractor cannot see through `makeControls()`, so it emits the branch
    // it can prove and the coverage gate refuses to certify the shape at all —
    // that pairing is what keeps the unseen branch from shipping without CSS.
    await writeFile(
      path.join(dir, 'widget.proto.ts'),
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        '',
        'const widget = definePrototype({',
        "  name: 'widget',",
        '  setup(def) {',
        "    const second = def.state.bool('secondFlag', false);",
        "    const third = def.state.bool('thirdFlag', false);",
        '    const makeControls = () => ({ ready: third });',
        '    let controls = { ready: second };',
        '    controls = enabled ? { ready: second } : makeControls();',
        "    def.expose.state('visible', controls.ready);",
        '    def.rule({',
        '      when: (w) => w.state(controls.ready).eq(true),',
        "      intent: (i) => i.feedback.style.use(tw('bg-accent')),",
        '    });',
        '  },',
        '});',
        '',
        'export default widget;',
      ].join('\n')
    );

    expect(await collectProtoStyleTokens(dir)).toContain('data-[second-flag]:bg-accent');
  });
});
