import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectProtoStyleTokensFromFiles } from '../../../cli/src/services/prototype-style-tokens';
import {
  renderProtoShadowStyleTokenCss,
  renderProtoStyleTokenCss,
} from '../../../cli/src/services/proto-style-css';
import { BRUTALIST_STYLE_TOKENS } from '../../../cli/src/generated/brutalist-style-tokens';

// Source reference: ekmas/neobrutalism-components 3306a802724874a85f93079702b2795370a279d4.
// Normal CSS closure only; these checks do not establish browser pixels or upstream API parity.
describe('Neo Button and Select source-to-normal-CSS closure', () => {
  it('collects Button recipes and resolves the pinned text size geometry in both renderers', async () => {
    const tokens = (await collectProtoStyleTokensFromFiles([
      path.resolve('packages/prototypes/brutalist/src/button/button.proto.ts'),
    ])) as string[];
    for (const token of ['h-9', 'h-10', 'h-11', 'px-3', 'px-4', 'px-8', 'text-sm']) {
      expect(tokens).toContain(token);
      expect(BRUTALIST_STYLE_TOKENS).toContain(token);
    }
    for (const token of ['h-12', 'px-6', 'text-xs', 'text-base'])
      expect(tokens).not.toContain(token);
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      const css = render(tokens);
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      for (const declaration of [
        'height: 2.25rem;',
        'height: 2.5rem;',
        'height: 2.75rem;',
        'padding-inline: 2rem;',
        'font-size: 0.875rem;',
        'line-height: 1.25rem;',
      ])
        expect(css, declaration).toContain(declaration);
    }
  });

  it('collects the default Select height and retains full-opacity icon geometry and highlight paint', async () => {
    const tokens = (await collectProtoStyleTokensFromFiles([
      path.resolve('packages/prototypes/brutalist/src/select/trigger.proto.ts'),
      path.resolve('packages/prototypes/brutalist/src/select/item.proto.ts'),
    ])) as string[];
    expect(tokens).toContain('h-10');
    expect(tokens).not.toContain('h-9');
    for (const token of tokens) expect(BRUTALIST_STYLE_TOKENS, token).toContain(token);
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      const css = render(tokens);
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      for (const declaration of [
        'height: 2.5rem;',
        'background-color: var(--pui-main);',
        'color: var(--pui-main-foreground);',
        'pointer-events: none;',
      ])
        expect(css, declaration).toContain(declaration);
    }
  });
});
