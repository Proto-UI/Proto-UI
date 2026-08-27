import { describe, expect, it } from 'vitest';

import { renderProtoStyleTokenCss } from '../src/services/proto-style-css';

describe('proto style ring offset defaults', () => {
  it('uses the theme background when no ring offset colour is declared', () => {
    const css = renderProtoStyleTokenCss(['ring-2', 'ring-offset-2']);

    expect(css).toContain(
      '--pui-ring-offset-shadow: 0 0 0 var(--pui-ring-offset-width, 0px) var(--pui-ring-offset-color, var(--pui-background));'
    );
    expect(css).not.toContain('var(--pui-ring-offset-color, #fff)');
  });

  it('preserves the explicit background offset utility', () => {
    const css = renderProtoStyleTokenCss(['ring-2', 'ring-offset-2', 'ring-offset-background']);

    expect(css).toContain('--pui-ring-offset-color: var(--pui-background);');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });
});
