import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { collectProtoStyleTokens } from '../src/services/prototype-style-tokens';

describe('collectProtoStyleTokens', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'proto-style-tokens-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
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
});
