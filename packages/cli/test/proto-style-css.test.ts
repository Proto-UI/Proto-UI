import { describe, expect, it } from 'vitest';

import { renderProtoStyleTokenCss } from '../src/services/proto-style-css';

describe('proto style css renderer', () => {
  it('renders internal negative data selector variants', () => {
    const css = renderProtoStyleTokenCss(['data-[hovered]:not-[data-active]:bg-muted']);

    expect(css).toContain(
      ':where([data-pui-style~="data-[hovered]:not-[data-active]:bg-muted"])[data-hovered]:not([data-active])'
    );
    expect(css).toContain('background-color: var(--pui-muted);');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });
});
