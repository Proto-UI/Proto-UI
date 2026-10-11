import { expect, it } from 'vitest';
import { tw } from '@proto.ui/core';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
} from '../src/services/proto-style-css';
// C-FEEDBACK-STYLE-0003 A-D: accepted author-side atomic style tokens retain
// their layout intention through the finite Web CSS translation.
it('maps non-growing flex items and a single flex row in document and Shadow output', () => {
  const tokens = tw('flex-none flex-nowrap border-b-transparent rounded-t-[0.25rem]').tokens;
  for (const css of [renderProtoStyleTokenCss(tokens), renderProtoShadowStyleTokenCss(tokens)]) {
    expect(css).toContain('flex: none;');
    expect(css).toContain('flex-wrap: nowrap;');
    expect(css).toContain('border-bottom-color: transparent;');
    expect(css).toContain('border-top-left-radius: 0.25rem;');
    expect(css).toContain('border-top-right-radius: 0.25rem;');
    expect(css).not.toContain('border-bottom-left-radius: 0.25rem;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).not.toContain('flex: 1 1 0%;');
    expect(css).not.toContain('flex-wrap: wrap;');
  }
});
it('does not admit near-spelled arbitrary flex declarations', () => {
  for (const css of [
    renderProtoStyleTokenCss([
      'flex-unknown',
      'flex-nowrap-unknown',
      'border-b-transparent-invalid',
      'rounded-t-[unsafe]',
    ]),
    renderProtoShadowStyleTokenCss([
      'flex-unknown',
      'flex-nowrap-unknown',
      'border-b-transparent-invalid',
      'rounded-t-[unsafe]',
    ]),
  ]) {
    expect(css).toContain('Unsupported Proto UI style tokens');
    expect(css).not.toContain('flex: none;');
    expect(css).not.toContain('flex-wrap: nowrap;');
  }
});
