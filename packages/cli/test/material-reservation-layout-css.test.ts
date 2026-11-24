import { describe, expect, it } from 'vitest';
import { assertTwTokenV0 } from '@proto.ui/core';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
} from '../src/services/proto-style-css';

describe('finite material reservation layout CSS vocabulary', () => {
  it.each([renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss])(
    'projects the authored container and independently centered content',
    (render) => {
      const tokens = [
        'container-type-inline-size',
        'self-center',
        'mx-auto',
        'min-w-full',
        'w-[calc(100cqw_-_2px)]',
      ];
      tokens.forEach((token) => expect(() => assertTwTokenV0(token)).not.toThrow());
      const css = render(tokens);
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(css).toContain('container-type: inline-size;');
      expect(css).toContain('align-self: center;');
      expect(css).toContain('margin-inline: auto;');
      expect(css).toContain('min-width: 100%;');
      expect(css).toContain('width: calc(100cqw - 2px);');
    }
  );

  it('does not widen the author grammar to arbitrary declarations or container modes', () => {
    expect(() => assertTwTokenV0('[container-type:inline-size]')).toThrow();
    expect(renderProtoStyleTokenCss(['container-type-size'])).toContain(
      'Unsupported Proto UI style tokens'
    );
  });
});
