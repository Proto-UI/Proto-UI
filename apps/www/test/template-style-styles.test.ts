import { expect, it } from 'vitest';
import { renderProtoStyleTokenCss } from '../../../packages/cli/src/services/proto-style-css';
import { STYLE_TOKENS } from './fixtures/template-style/tokens';

it('the standalone Template fixture uses only tokens realized by the actual PUI CSS generator', () => {
  const css = renderProtoStyleTokenCss(STYLE_TOKENS);
  expect(css).not.toContain('Unsupported Proto UI style tokens');
  for (const token of STYLE_TOKENS) {
    expect(css, token).toContain(`[data-pui-style~="${token}"]`);
  }
  expect(css).toContain('background-color: #04c;');
  expect(css).toContain('background-color: #fde047;');
});
