import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { mergeTwTokensV0 } from '@proto.ui/core';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
} from '../src/services/proto-style-css';
import {
  bootstrapButtonRestFill,
  bootstrapButtonInteractiveFill,
  bootstrapButtonFlatFill,
  bootstrapButtonPressedFill,
  bootstrapButtonRaised,
  bootstrapButtonPressed,
} from '../../prototypes/bootstrap-2-3-2/src/button/paint';

// Independent fixed-source values: twbs/bootstrap v2.3.2 compiled CSS:3198-3559.
const cases = [
  ['#fff', '#e6e6e6', '#f5f5f5'],
  ['#08c', '#04c', '#006dcc'],
  ['#fbb450', '#f89406', '#faa732'],
  ['#ee5f5b', '#bd362f', '#da4f49'],
  ['#62c462', '#51a351', '#5bb75b'],
  ['#5bc0de', '#2f96b4', '#49afcd'],
  ['#444', '#222', '#363636'],
];

describe('finite Bootstrap complete paint recipes', () => {
  it.each(cases)(
    'keeps all background properties under one owner for %s / %s',
    (start, end, base) => {
      for (const [color, image, position] of [
        [base, `linear-gradient(${start},${end})`, '0_0'],
        [end, `linear-gradient(${start},${end})`, '0_-15px'],
        [end, 'none', '0_0'],
        [end, 'none', '0_-15px'],
      ]) {
        const token = `bg-[${color}_${image}_${position}_repeat-x]`;
        for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
          const css = render([token]);
          expect(css).not.toContain('Unsupported Proto UI style tokens');
          expect(css).toContain(`background-color: ${color};`);
          expect(css).toContain(
            `background-image: ${image === 'none' ? 'none' : `linear-gradient(to bottom, ${start}, ${end})`};`
          );
          expect(css).toContain(`background-position: ${position.replace('_', ' ')};`);
          expect(css).toContain('background-repeat: repeat-x;');
        }
      }
    }
  );
  it('retains independent size, text, border and background semantics after actual core merging', () => {
    for (const isDefault of [true, false]) {
      const text = isDefault
        ? 'text-paint-[#333_0_1px_1px_rgb(255_255_255/75%)]'
        : 'text-paint-[#fff_0_-1px_0_rgb(0_0_0/25%)]';
      const border = isDefault
        ? 'border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_#b3b3b3_rgb(0_0_0/10%)]'
        : 'border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_rgb(0_0_0/25%)_rgb(0_0_0/10%)]';
      const background = 'bg-[#006dcc_linear-gradient(#08c,#04c)_0_0_repeat-x]';
      const input = [
        'text-[11.9px]',
        'leading-[20px]',
        'border',
        'rounded-[3px]',
        background,
        text,
        border,
        bootstrapButtonRaised,
        'ring-2',
      ];
      expect(mergeTwTokensV0(input).tokens).toEqual(input);
      for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
        const css = render(mergeTwTokensV0(input).tokens);
        expect(css).not.toContain('Unsupported Proto UI style tokens');
        expect(css).toContain('font-size: 11.9px;');
        expect(css).toContain(`color: ${isDefault ? '#333' : '#fff'};`);
        expect(css).toContain(
          `text-shadow: ${isDefault ? '0 1px 1px rgb(255 255 255 / 0.75)' : '0 -1px 0 rgb(0 0 0 / 0.25)'};`
        );
        for (const side of ['top', 'right', 'left'])
          expect(css).toContain(`border-${side}-color: rgb(0 0 0 / 0.1);`);
        expect(css).toContain(
          `border-bottom-color: ${isDefault ? '#b3b3b3' : 'rgb(0 0 0 / 0.25)'};`
        );
        expect(css).toContain('--pui-ring-width: 2px;');
      }
    }
  });
  it('does not widen the finite recipes to arbitrary CSS or URLs', () => {
    for (const token of [
      'bg-[#123_linear-gradient(#fff,#e6e6e6)_0_0_repeat-x]',
      'bg-[#f5f5f5_linear-gradient(#fff,#e6e6e6)_0_-16px_repeat-x]',
      'bg-[url(https://example.test/image)]',
      'bg-[#f5f5f5_none_0_0_repeat-x;color:red]',
      'text-paint-[#333_0_2px_1px_rgb(255_255_255/75%)]',
      'text-paint-[var(--ink)_0_1px_1px_white]',
      'border-[rgb(0_0_0/10%)_red_blue_green]',
      'border-[url(https://example.test/image)]',
    ]) {
      for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
        const css = render([token]);
        expect(css).toContain('Unsupported Proto UI style tokens');
        const paintDeclarations = (value: string) =>
          value
            .split('\n')
            .filter((line) =>
              /^\s*(?:background-color|background-image|background-position|text-shadow|color|border-(?:top|right|bottom|left)-color):/.test(
                line
              )
            );
        expect(paintDeclarations(css)).toEqual(paintDeclarations(render([])));
      }
    }
  });
  it('leaves the exact-base legacy passive paint CSS byte-identical for other owners', () => {
    const tokens = [
      ...new Set(
        [
          ...Object.values(bootstrapButtonRestFill),
          ...Object.values(bootstrapButtonInteractiveFill),
          ...Object.values(bootstrapButtonFlatFill),
          ...Object.values(bootstrapButtonPressedFill),
          bootstrapButtonRaised,
          bootstrapButtonPressed,
        ].flatMap((value) => value.split(' '))
      ),
    ].sort();
    // Byte-pinned output of the complete finite paint recipe set; re-pinned
    // after the 2.3.2 recipe tokens replaced the legacy shorthand exports.
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      expect(createHash('sha256').update(render(tokens)).digest('hex')).toBe(
        '76f413d79db45e7d2d6a70d699dfd7db243882037669c13d5b5738ed6c9bc0bf'
      );
    }
  });
});
