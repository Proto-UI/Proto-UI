import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectProtoStyleTokensFromFiles } from '../../../cli/src/services/prototype-style-tokens';
import {
  renderProtoShadowStyleTokenCss,
  renderProtoStyleTokenCss,
} from '../../../cli/src/services/proto-style-css';
import { BRUTALIST_STYLE_TOKENS } from '../../../cli/src/generated/brutalist-style-tokens';
import { BRUTALIST_THEME } from '../src/theme';

describe('Neo-Brutalist AlertDialog physical style closure', () => {
  it('collects actual recipes and resolves them through the unchanged document and Shadow renderers', async () => {
    const tokens = (await collectProtoStyleTokensFromFiles(
      ['content', 'header', 'footer', 'title', 'description', 'mask', 'trigger'].map((part) =>
        path.resolve(`packages/prototypes/brutalist/src/alert-dialog/${part}.proto.ts`)
      )
    )) as string[];
    expect(tokens).toEqual(
      expect.arrayContaining(['flex-wrap-reverse', 'gap-3', 'p-6', 'text-lg'])
    );
    for (const token of tokens) expect(BRUTALIST_STYLE_TOKENS, token).toContain(token);
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      const css = render(tokens);
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      for (const declaration of [
        'flex-wrap: wrap-reverse;',
        'justify-content: flex-end;',
        'gap: 0.75rem;',
        'padding: 1.5rem;',
        'font-size: 1.125rem;',
        'line-height: 1.75rem;',
        'font-weight: 700;',
        'font-weight: 500;',
        'background-color: var(--pui-overlay);',
        'border-color: var(--pui-border);',
        '--pui-shadow: 4px 4px 0 0 #000;',
      ])
        expect(css, declaration).toContain(declaration);
    }
  });

  it('keeps structural ink stable in both themes and the existing readable dark focus extension', () => {
    expect(BRUTALIST_THEME.light.radius).toBe('5px');
    expect(BRUTALIST_THEME.dark.radius).toBe('5px');
    expect(BRUTALIST_THEME.light.border).toBe('#000000');
    expect(BRUTALIST_THEME.dark.border).toBe('#000000');
    expect(BRUTALIST_THEME.light.overlay).toBe('rgba(0, 0, 0, 0.8)');
    expect(BRUTALIST_THEME.dark.overlay).toBe('rgba(0, 0, 0, 0.85)');
    expect(BRUTALIST_THEME.dark.ring).toBe('#f5f5f5');
    expect(BRUTALIST_THEME.dark.background).toBe('#171717');
  });
});
