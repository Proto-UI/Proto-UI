import { describe, expect, it } from 'vitest';

import {
  PROTO_SHADOW_STYLE_ARTIFACT_KIND,
  PROTO_SHADOW_STYLE_ARTIFACT_VERSION,
  PROTO_SHADOW_STYLE_ENVIRONMENT,
  renderPrefixedThemeCss,
  renderProtoShadowStyleArtifact,
  renderProtoShadowStyleTokenCss,
  renderProtoShadowSplitStyleArtifact,
  renderProtoStyleEntryCss,
  renderProtoStyleTokenCss,
} from '../src/services/proto-style-css';
import { BRUTALIST_STYLE_TOKENS } from '../src/generated/brutalist-style-tokens';
import { SHADCN_THEME_PAINT_CSS, SHADCN_THEME_VARIABLES_CSS } from '../src/legacy/type';

describe('proto style css renderer', () => {
  it('lowers finite recovered radius and legacy shadow recipes without arbitrary CSS admission', () => {
    const renderers = [
      renderProtoStyleTokenCss,
      renderProtoShadowStyleTokenCss,
      (tokens: string[]) => renderProtoShadowSplitStyleArtifact(tokens).cssText,
    ];
    for (const render of renderers) {
      const css = render(['rounded-[calc(var(--radius)-5px)]', 'shadow', 'ring-1']);
      const radiusBlock = css
        .split('}')
        .find((block) => block.includes('[data-pui-style~="rounded-[calc(var(--radius)-5px)]"]'));
      expect(radiusBlock).toBeDefined();
      expect(radiusBlock).toMatch(
        /\{\s*border-radius: calc\(var\(--pui-radius\) - 5px\);(?:\s*--pui-split-compiled-receipt: [a-z0-9]+;)?\s*$/
      );
      const shadowBlock = css
        .split('}')
        .find((block) => block.includes('[data-pui-style~="shadow"]'));
      expect(shadowBlock).toBeDefined();
      expect(shadowBlock).toContain(
        '--pui-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);'
      );
      expect(shadowBlock).toContain(
        'box-shadow: var(--pui-ring-offset-shadow, 0 0 #0000), var(--pui-ring-shadow, 0 0 #0000), var(--pui-shadow, 0 0 #0000);'
      );
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(render(['shadow-sm'])).toContain(
        '--pui-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);'
      );
      expect(render(['rounded-[calc(var(--radius)-3px)]'])).toContain(
        'border-radius: calc(var(--pui-radius) - 3px);'
      );
      for (const token of [
        'rounded-[calc(var(--radius)-6px)]',
        'rounded-[calc(var(--private-radius)-5px)]',
        'rounded-[calc(var(--radius)-5px);color:red]',
        'shadow-unknown',
        '-shadow',
        'shadow-[0_0_0_red;color:red]',
      ]) {
        const rejected = render([token]);
        expect(rejected).toContain('Unsupported Proto UI style tokens');
        expect(rejected).not.toMatch(/(?:^|\n)\s*(?:border-radius|box-shadow):/);
        expect(rejected).not.toMatch(/(?:^|\n)\s*--pui-shadow:\s*(?!initial;)[^\s]/);
      }
    }
  });

  it('lowers zero scroll padding in light and shadow CSS without accepting unknown scroll tokens', () => {
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      const css = render(['scroll-py-0']);
      const block = css
        .split('}')
        .find((entry) => entry.includes('[data-pui-style~="scroll-py-0"]'));
      expect(block).toBeDefined();
      expect(block).toMatch(/\{\s*scroll-padding-block: 0px;\s*$/);
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      for (const token of ['scroll-py-unknown', '-scroll-py-0', 'scroll-py-[0px;color:red]']) {
        const unsupported = render([token]);
        expect(unsupported).toContain('Unsupported Proto UI style tokens');
        expect(unsupported).not.toMatch(/(?:^|\n)\s*scroll-padding(?:-[a-z]+)?:/);
      }
    }
  });

  it('lowers scroll-py-1 in light and shadow CSS without widening the token vocabulary', () => {
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      const css = render(['scroll-py-1', 'scroll-my-1']);
      expect(css).toContain('[data-pui-style~="scroll-py-1"]');
      expect(css).toContain('scroll-padding-block: 0.25rem;');
      expect(css).toContain('scroll-margin-block: 0.25rem;');
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      for (const token of ['scroll-py-unknown', '-scroll-py-1', 'scroll-py-[1px;color:red]']) {
        const unsupported = render([token]);
        expect(unsupported).toContain('Unsupported Proto UI style tokens');
        expect(unsupported).not.toMatch(/(?:^|\n)\s*scroll-padding(?:-[a-z]+)?:/);
      }
    }
  });

  it('lowers finite physical top and bottom scroll padding in document and shadow targets', () => {
    for (const render of [
      renderProtoStyleTokenCss,
      renderProtoShadowStyleTokenCss,
      (tokens: string[]) => renderProtoShadowSplitStyleArtifact(tokens).cssText,
    ]) {
      const tokens = ['scroll-pt-2', 'scroll-pb-1.5'];
      for (const input of [tokens, [...tokens].reverse()]) {
        const css = render(input);
        for (const [token, declaration] of [
          ['scroll-pt-2', 'scroll-padding-top: 0.5rem;'],
          ['scroll-pb-1.5', 'scroll-padding-bottom: 0.375rem;'],
        ]) {
          const block = css
            .split('}')
            .find((entry) => entry.includes(`[data-pui-style~="${token}"]`));
          expect(block).toBeDefined();
          // Split output may add only its existing content-bound receipt.
          const declarations = block!
            .split('{')
            .at(-1)!
            .trim()
            .split(/\n/)
            .map((line) => line.trim());
          expect(declarations[0]).toBe(declaration);
          expect(
            declarations
              .slice(1)
              .every((line) => /^--pui-split-compiled-receipt: [a-z0-9]+;$/.test(line))
          ).toBe(true);
        }
        expect(css).not.toContain('Unsupported Proto UI style tokens');
      }
      const unchanged = render(['scroll-py-0', 'scroll-py-1', 'scroll-py-1.5', 'scroll-my-1']);
      for (const declaration of [
        'scroll-padding-block: 0px;',
        'scroll-padding-block: 0.25rem;',
        'scroll-padding-block: 0.375rem;',
        'scroll-margin-block: 0.25rem;',
      ])
        expect(unchanged).toContain(declaration);
      expect(unchanged).not.toContain('Unsupported Proto UI style tokens');
    }
  });

  it('keeps unknown negative and injection-shaped physical scroll padding explicitly unsupported', () => {
    for (const render of [
      renderProtoStyleTokenCss,
      renderProtoShadowStyleTokenCss,
      (tokens: string[]) => renderProtoShadowSplitStyleArtifact(tokens).cssText,
    ]) {
      for (const token of [
        'scroll-pt-unknown',
        'scroll-pb-unknown',
        'scroll-pt-1',
        'scroll-pb-2',
        '-scroll-pt-2',
        '-scroll-pb-1.5',
        'scroll-pt-[8px]',
        'scroll-pb-[6px]',
        'scroll-pt-[8px;color:red]',
        'scroll-pb-[6px;color:red]',
      ]) {
        const css = render([token]);
        expect(css).toContain('Unsupported Proto UI style tokens');
        expect(css).not.toMatch(/(?:^|\n)\s*scroll-padding(?:-[a-z]+)?:/);
        expect(css).not.toMatch(/(?:^|\n)\s*color:\s*red;/);
      }
    }
  });

  it('retains the opaque source fallback when a menu or progress gradient is selected', () => {
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      for (const [token, color] of [
        ['bg-[linear-gradient(#08c,#0077b3)]', '#0081c2'],
        ['bg-[linear-gradient(#f5f5f5,#f9f9f9)]', '#f7f7f7'],
        ['bg-[linear-gradient(#149bdf,#0480be)]', '#0e90d2'],
      ] as const) {
        const css = render([token]);
        expect(css).toContain(`background-color: ${color};`);
        expect(css).toContain('background-image: linear-gradient(to bottom,');
        expect(css).toContain('background-repeat: repeat-x;');
      }
    }
  });

  it('preserves complete legacy focus paint and lets timing override its transition defaults', () => {
    const tokens = [
      'border-[3px]',
      'border-[rgb(82_168_236/80%)]',
      'shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%),0_0_8px_rgb(82_168_236/60%)]',
      'ring-[3px]',
      'ring-offset-1',
      'transition-[border,box-shadow]',
      'duration-200',
      'ease-in-out',
    ];
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      for (const input of [tokens, tokens.toReversed()]) {
        const css = render(input);
        expect(css).toContain('border-width: 3px;');
        expect(css).toContain('border-color: rgb(82 168 236 / 0.8);');
        expect(css).toContain(
          '--pui-shadow: inset 0 1px 1px rgb(0 0 0 / 0.075), 0 0 8px rgb(82 168 236 / 0.6);'
        );
        expect(css).toContain('var(--pui-ring-shadow, 0 0 #0000), var(--pui-shadow, 0 0 #0000)');
        expect(css).toContain('--pui-ring-offset-width: 1px;');
        expect(css.indexOf('transition-duration: 200ms;')).toBeGreaterThan(
          css.indexOf('transition-duration: 150ms;')
        );
        expect(css).not.toContain('Unsupported Proto UI style tokens');
      }
      expect(
        render(['border-[3.5px]', 'border-[rgb(82_168_236/81%)]', 'transition-[border,filter]'])
      ).toContain('Unsupported Proto UI style tokens');
    }
  });

  it('keeps literal bottom-edge paint after shorthand color and source radius expressions scoped', () => {
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      const css = render([
        'border-b-[#fff]',
        'border-[#ccc]',
        'rounded-xs',
        'rounded-t-[5px]',
        'rounded-[calc(var(--radius-md)-2px)]',
        'pl-7.5',
        'py-0.75',
      ]);
      expect(css.indexOf('border-bottom-color: #fff;')).toBeGreaterThan(
        css.indexOf('border-color: #ccc;')
      );
      expect(css).toContain('border-radius: 0.125rem;');
      expect(css).toContain('border-radius: calc(var(--pui-radius-md) - 2px);');
      expect(css).toContain('border-top-left-radius: 5px;');
      expect(css).toContain('padding-left: 1.875rem;');
      expect(css).toContain('padding-block: 0.1875rem;');
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(render(['rounded-[calc(var(--radius-md)-3px)]'])).toContain(
        'Unsupported Proto UI style tokens'
      );
    }
  });

  it('keeps directional edge paint after all-edge shorthands in document and Shadow CSS', () => {
    const tokens = [
      'border',
      'border-transparent',
      'border-b-input',
      'rounded-none',
      'rounded-l-md',
      'rounded-r-lg',
    ];
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      for (const input of [tokens.toSorted(), tokens.toSorted().reverse()]) {
        const css = render(input);
        expect(css.indexOf('border-bottom-color: var(--pui-input);')).toBeGreaterThan(
          css.indexOf('border-color: transparent;')
        );
        expect(css.indexOf('border-top-left-radius: var(--pui-radius-md);')).toBeGreaterThan(
          css.indexOf('border-radius: 0px;')
        );
        expect(css.indexOf('border-top-right-radius: var(--pui-radius-lg);')).toBeGreaterThan(
          css.indexOf('border-radius: 0px;')
        );
        expect(css).not.toContain('Unsupported Proto UI style tokens');
      }
    }
  });

  it('preserves fractional root-relative sizes and affine thumb travel without rounding to pixels', () => {
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      const css = render([
        'h-4.5',
        'w-6.25',
        'w-8.25',
        'translate-x-0.25',
        'translate-x-[calc(100%_+_2px)]',
        'translate-x-[calc(100%_-_8px)]',
        'rounded-[5px]',
        'ring-[3px]',
      ]);
      expect(css).toContain('height: 1.125rem;');
      expect(css).toContain('width: 1.5625rem;');
      expect(css).toContain('width: 2.0625rem;');
      expect(css).toContain('--pui-translate-x: 0.0625rem;');
      expect(css).toContain('--pui-translate-x: calc(100% + 2px);');
      expect(css).toContain('--pui-translate-x: calc(100% - 8px);');
      expect(css).toContain('border-radius: 5px;');
      expect(css).toContain('--pui-ring-width: 3px;');
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      for (const rejected of ['rounded-[5.5px]', 'rounded-[5px;color:red]', 'ring-[3.5px]']) {
        expect(render([rejected])).toContain('Unsupported Proto UI style tokens');
      }
    }
  });

  it('projects only the named Rhea/Luma radii and secondary hover mix', () => {
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      const css = render([
        'rounded-[var(--pui-radius-2xl)]',
        'rounded-[var(--pui-radius-4xl)]',
        'bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]',
      ]);
      expect(css).toContain('border-radius: var(--pui-radius-2xl);');
      expect(css).toContain('border-radius: var(--pui-radius-4xl);');
      expect(css).toContain(
        'background-color: color-mix(in oklch, var(--pui-secondary), var(--pui-foreground) 5%);'
      );
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(render(['rounded-2xl'])).toContain('border-radius: 1rem;');
      for (const token of [
        'rounded-[var(--pui-radius-5xl)]',
        'rounded-[var(--private-radius)]',
        'rounded-[var(--pui-radius-2xl);color:red]',
        'bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_6%)]',
        'bg-[color-mix(in_srgb,var(--secondary),var(--foreground)_5%)]',
        'bg-[color-mix(in_oklch,var(--primary),var(--foreground)_5%)]',
        'bg-[var(--secondary)]',
      ]) {
        expect(render([token])).toContain('Unsupported Proto UI style tokens');
      }
    }
    const theme = renderPrefixedThemeCss(':root { --radius: 0.625rem; }');
    expect(theme).toContain('--pui-radius-2xl: calc(var(--pui-radius) + 8px);');
    expect(theme).toContain('--pui-radius-4xl: calc(var(--pui-radius) + 16px);');

    const selectionPaint = renderPrefixedThemeCss(SHADCN_THEME_PAINT_CSS, {
      variableDeclarations: SHADCN_THEME_VARIABLES_CSS,
    });
    expect(selectionPaint).toContain('background-color: var(--pui-selection);');
    expect(selectionPaint).toContain('color: var(--pui-selection-foreground);');
    expect(selectionPaint).not.toContain('--pui-selection:');
  });

  it('renders the finite 3px corner token without admitting arbitrary radius CSS', () => {
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      for (const value of [3, 4, 6]) {
        const css = render([`rounded-[${value}px]`]);
        expect(css).toContain(`border-radius: ${value}px;`);
        expect(css).not.toContain('Unsupported Proto UI style tokens');
      }
      for (const token of [
        'rounded-[3.5px]',
        'rounded-[-3px]',
        'rounded-[3px;color:red]',
        'rounded-[var(--radius)]',
      ]) {
        const css = render([token]);
        expect(css).toContain('Unsupported Proto UI style tokens');
        expect(css).not.toMatch(/(?:^|\n)\s*border-radius:/);
      }
    }
  });
  it('renders nonnegative finite pixel typography without accepting arbitrary CSS', () => {
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      for (const value of ['0', '0.5', '.5', '14', '20', '17.5']) {
        const css = render([`text-[${value}px]`, `leading-[${value}px]`]);
        expect(css).not.toContain('Unsupported Proto UI style tokens');
        expect(css).toContain(`font-size: ${value}px;`);
        expect(css).toContain(`line-height: ${value}px;`);
      }
      for (const value of [
        '-1px',
        '+1px',
        'NaNpx',
        'Infinitypx',
        '1e3px',
        '1.px',
        '1..2px',
        '14PX',
        '14px;color:red',
        'var(--size)',
        'calc(14px)',
        '14 px',
        '14px_!important',
        `${'9'.repeat(400)}px`,
      ]) {
        for (const prefix of ['text', 'leading']) {
          const css = render([`${prefix}-[${value}]`]);
          expect(css).toContain('Unsupported Proto UI style tokens');
          expect(css).not.toMatch(/(?:^|\n)\s*(?:font-size|line-height):/);
        }
      }
    }
  });
  it('renders literal black rings independently of theme ring in document and Shadow output', () => {
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      const css = render([
        'ring-2',
        'ring-black',
        'data-[focus-visible]:ring-black',
        'ring-ring',
        'ring-ring/50',
      ]);
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(css).toContain('--pui-ring-color: #000000;');
      expect(css).toContain('--pui-ring-color: var(--pui-ring);');
      expect(css).toContain('var(--pui-ring) 50%, transparent');
      expect(css).toContain('box-shadow: var(--pui-ring-offset-shadow');
      for (const unsupported of ['ring-black/50', 'ring-[#000]', 'ring-black;color:red']) {
        const rejected = render([unsupported]);
        expect(rejected).toContain('Unsupported Proto UI style tokens');
        expect(rejected).not.toContain('--pui-ring-color: #000000;');
      }
    }
  });
  it.each([
    ['w-72', 'width: 18rem;'],
    ['text-[1.3125rem]', 'font-size: 1.3125rem;'],
    ['border-[#e5e5e5]', 'border-color: #e5e5e5;'],
    ['outline-border', 'outline-color: var(--pui-border);'],
  ])(
    'renders the existing physical vocabulary %s in document and Shadow output',
    (token, declaration) => {
      for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
        const css = render([token]);
        expect(css).not.toContain('Unsupported Proto UI style tokens');
        expect(css).toContain(declaration);
      }
    }
  );
  it('keeps malformed physical values outside the bounded resource vocabulary', () => {
    for (const token of [
      'w-NaN',
      'w-Infinity',
      'text-[1.3125rem;color:red]',
      'border-[#e5e5e5;color:red]',
      'outline-[url(javascript:bad)]',
    ]) {
      for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
        const css = render([token]);
        expect(css).toContain('Unsupported Proto UI style tokens');
        expect(css).not.toMatch(/(?:^|\n)\s*(?:font-size|border-color|outline-color|width):/);
      }
    }
  });
  it.each([
    ['-mx-1', 'margin-inline: -0.25rem;'],
    ['duration-100', 'transition-duration: 100ms;'],
    ['ring-1', '--pui-ring-width: 1px;'],
    ['tracking-widest', 'letter-spacing: 0.1em;'],
    ['text-[0.6875rem]', 'font-size: 0.6875rem;'],
    ['bg-[#f5f5f5]', 'background-color: #f5f5f5;'],
  ])('projects the bounded physical recipe %s without component dispatch', (token, declaration) => {
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      const css = render([token]);
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(css).toContain(declaration);
      if (token === 'duration-100') expect(css).toContain('--pui-animation-duration: 100ms;');
      if (token === 'ring-1') expect(css).toContain('box-shadow: var(--pui-ring-offset-shadow');
    }
  });
  it('keeps arbitrary color and font values outside the existing finite recipe table unsupported', () => {
    for (const token of [
      'text-[0.6875rem;color:red]',
      'text-[Infinityrem]',
      'bg-[#f5f5f5;color:red]',
      'bg-[#f5f5f5ff]',
      'duration-NaN',
      'ring-Infinity',
    ]) {
      for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
        const css = render([token]);
        expect(css).toContain('Unsupported Proto UI style tokens');
        expect(css).not.toMatch(
          /(?:^|\n)\s*(?:font-size|background-color):|(?:^|\n)\s*color:\s*red/
        );
      }
    }
  });
  it('projects explicit logical text direction in document and shadow styles', () => {
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      const css = render(['direction-ltr', 'direction-rtl']);
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(css).toContain('direction: ltr;');
      expect(css).toContain('direction: rtl;');
      expect(css).not.toContain('flex-direction:');
    }
    expect(renderProtoStyleTokenCss(['direction-sideways'])).toContain(
      'Unsupported Proto UI style tokens'
    );
  });
  it('keeps invisible preparation distinct from display suppression', () => {
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      const css = render(['invisible']);
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(css).toContain('visibility: hidden;');
      expect(css).not.toContain('display: none;');
    }
  });
  it('keeps authored spaces and newlines without hanging preserved spaces into padding', () => {
    const css = renderProtoStyleTokenCss(['whitespace-break-spaces']);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('white-space: break-spaces;');
  });
  it('lowers intrinsic action wrapping and bounded grid tracks without media variants', () => {
    const css = renderProtoStyleTokenCss([
      'flex-wrap-reverse',
      'grid-cols-1',
      'min-w-0',
      'h-auto',
      'min-h-8',
      'max-w-full',
    ]);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('flex-wrap: wrap-reverse;');
    expect(css).toContain('grid-template-columns: repeat(1, minmax(0, 1fr));');
    expect(css).toContain('min-width: 0px;');
  });
  it('lowers logical available-region bounds without dropping max-width arithmetic', () => {
    const css = renderProtoStyleTokenCss([
      'left-[var(--proto-ui-available-region-center-x,50%)]',
      'max-w-[min(32rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))]',
      'max-h-[calc(var(--proto-ui-available-region-height,100%)_-_2rem)]',
    ]);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('left: var(--proto-ui-available-region-center-x,50%);');
    expect(css).toContain(
      'max-width: min(32rem,calc(var(--proto-ui-available-region-width,100%) - 2rem));'
    );
    expect(css).toContain('max-height: calc(var(--proto-ui-available-region-height,100%) - 2rem);');
  });
  it.each(['auto', 'text', 'none'])(
    'diagnoses selection:select-%s instead of emitting inert highlight CSS',
    (value) => {
      const token = `selection:select-${value}`;
      const css = renderProtoStyleTokenCss([token, `dark:${token}`]);
      expect(css).toContain('Unsupported Proto UI style tokens');
      expect(css).toContain(`* - ${token}`);
      expect(css).toContain(`* - dark:${token}`);
      expect(css).not.toContain('::selection');
      expect(css).not.toContain('user-select:');
    }
  );
  it('closes explicit content-selection affordances only on their authored subjects', () => {
    // T-CONTENT-SELECTION-AFFORDANCE-0001-CASE-CSS
    const css = renderProtoStyleTokenCss(['select-auto', 'select-text', 'select-none']);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    for (const value of ['auto', 'text', 'none']) {
      expect(css).toContain(`:where([data-pui-style~="select-${value}"])`);
      expect(css).toContain(`-webkit-user-select: ${value};`);
      expect(css).toContain(`user-select: ${value};`);
    }
    expect(css).not.toMatch(/(?:html|body|\*)\s*\{[^}]*user-select/s);
  });

  it('lowers both Scroll Area track inset dimensions to valid spaced CSS math', () => {
    const css = renderProtoStyleTokenCss([
      'data-[orientation=vertical]:h-[calc(100%_-_var(--proto-ui-scroll-track-end-inset,0px))]',
      'data-[orientation=horizontal]:w-[calc(100%_-_var(--proto-ui-scroll-track-end-inset,0px))]',
    ]);
    expect(css).toContain('height: calc(100% - var(--proto-ui-scroll-track-end-inset,0px));');
    expect(css).toContain('width: calc(100% - var(--proto-ui-scroll-track-end-inset,0px));');
  });
  it('keeps motion hit envelopes on the same host and behind lowered state predicates', () => {
    const css = renderProtoStyleTokenCss([
      'hit-envelope-translate-1',
      'data-[hovered]:hit-envelope-translate-1',
      'data-[pressed]:hit-envelope-translate-1',
    ]);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain(`:where([data-pui-style~="hit-envelope-translate-1"])::before`);
    expect(css).toContain(
      `:where([data-pui-style~="data-[hovered]:hit-envelope-translate-1"])[data-hovered]::before`
    );
    expect(css).toContain(
      `:where([data-pui-style~="data-[pressed]:hit-envelope-translate-1"])[data-pressed]::before`
    );
    expect(css).toContain('top: calc(-0.25rem - 2px);');
    expect(css).toContain('left: calc(-0.25rem - 2px);');
    expect(css).toContain('right: -2px;');
    expect(css).toContain('bottom: -2px;');
  });
  it('places generated theme defaults below the Proto UI layer and consumer layers', () => {
    // T-PROTOTYPE-STYLE-CLOSURE-0001-CASE-GENERATED-LAYER-SLOT
    const css = renderProtoStyleEntryCss({
      themeImport: './shadcn-theme.css',
      tokensImport: './proto-ui-tokens.generated.css',
    });
    const preludeAt = css.indexOf('@layer theme, proto-ui;');
    const themeImportAt = css.indexOf("@import './shadcn-theme.css' layer(theme);");
    const tokensImportAt = css.indexOf("@import './proto-ui-tokens.generated.css';");
    const declaredLayerSlots = [...css.matchAll(/@layer\s+([^;{]+)\s*;/g)].map((match) =>
      match[1].trim()
    );

    expect(preludeAt).toBeGreaterThan(-1);
    expect(preludeAt).toBeLessThan(themeImportAt);
    expect(preludeAt).toBeLessThan(tokensImportAt);
    expect(declaredLayerSlots).toEqual(['theme, proto-ui']);
    expect(css).not.toContain("@import './shadcn-theme.css';");
  });

  it('normalizes only styled native controls at zero specificity before token rules', () => {
    // T-PROTOTYPE-STYLE-CLOSURE-0001-CASE-GENERATED-NORMALIZATION
    // T-PROTOTYPE-STYLE-CLOSURE-0001-CASE-NORMALIZATION-SCOPE
    const css = renderProtoStyleTokenCss([
      'border',
      'border-input',
      'bg-background',
      'p-2',
      'text-foreground',
    ]);
    const selector =
      ':where(button[data-pui-style], input[data-pui-style], select[data-pui-style], textarea[data-pui-style])';
    const layerAt = css.indexOf('@layer proto-ui {');
    const normalizationAt = css.indexOf(selector);
    const firstTokenAt = css.indexOf(':where([data-pui-style~=');

    expect(normalizationAt).toBeGreaterThan(layerAt);
    expect(normalizationAt).toBeLessThan(firstTokenAt);

    const normalization = css.slice(normalizationAt, firstTokenAt);
    for (const declaration of [
      'font: inherit;',
      'font-feature-settings: inherit;',
      'font-variation-settings: inherit;',
      'letter-spacing: inherit;',
      'color: inherit;',
      'margin: 0;',
      'padding: 0;',
      'border: 0;',
      'background: transparent;',
      'opacity: 1;',
    ]) {
      expect(normalization).toContain(declaration);
    }

    expect(css).not.toMatch(/(^|\n)\s*(button|input|select|textarea)\s*(,|\{)/);
    expect(css).not.toMatch(/(^|\n)\s*\*\s*(,|\{)/);
    expect(css).not.toContain('!important');
  });

  it('renders space-between layout utilities used by compound controls', () => {
    const css = renderProtoStyleTokenCss(['flex', 'justify-between']);

    expect(css).toContain('display: flex;');
    expect(css).toContain('justify-content: space-between;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders only finite field sizing and resize vocabulary on light and shadow targets', () => {
    for (const render of [
      renderProtoStyleTokenCss,
      renderProtoShadowStyleTokenCss,
      (tokens: string[]) => renderProtoShadowSplitStyleArtifact(tokens).cssText,
    ]) {
      for (const [token, declaration] of [
        ['resize-none', 'resize: none;'],
        ['resize-y', 'resize: vertical;'],
        ['field-sizing-content', 'field-sizing: content;'],
        ['field-sizing-fixed', 'field-sizing: fixed;'],
      ]) {
        const css = render([token]);
        expect(css).toContain(declaration);
        expect(css).not.toContain('Unsupported Proto UI style tokens');
      }
      for (const token of [
        'resize-auto',
        'field-sizing-auto',
        'field-sizing-[content]',
        'field-sizing-content;display:none',
      ]) {
        const css = render([token]);
        expect(css).toContain('Unsupported Proto UI style tokens');
        expect(css).not.toMatch(/(?:^|\n)\s*(?:field-sizing|resize):/);
      }
    }
  });

  it('renders the vertical resize utility used by Brutalist Textarea', () => {
    const css = renderProtoStyleTokenCss(['resize-y']);

    expect(css).toContain('resize: vertical;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders whitespace-preserving wrapping utilities for private compositions', () => {
    const css = renderProtoStyleTokenCss(['whitespace-pre-wrap', 'wrap-anywhere']);

    expect(css).toContain('white-space: pre-wrap;');
    expect(css).toContain('overflow-wrap: anywhere;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders intrinsic sizing and surface utilities used by Shadcn Tabs v4', () => {
    const css = renderProtoStyleTokenCss([
      'w-fit',
      'h-fit',
      'flex-1',
      'shadow-sm',
      'outline-1',
      'outline-ring',
    ]);

    expect(css).toContain('width: fit-content;');
    expect(css).toContain('height: fit-content;');
    expect(css).toContain('flex: 1 1 0%;');
    expect(css).toContain('--pui-shadow: 0 1px 3px 0');
    expect(css).toContain('outline-style: solid;');
    expect(css).toContain('outline-width: 1px;');
    expect(css).toContain('outline-color: var(--pui-ring);');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders solid black surfaces and treats brutalist group markers as no-ops', () => {
    const css = renderProtoStyleTokenCss([
      'bg-black',
      'group/brutalist-button',
      'group/brutalist-toggle',
    ]);

    expect(css).toContain('[data-pui-style~="bg-black"]');
    expect(css).toContain('background-color: #000;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders the composed inset and outer hard shadows used by active Brutalist Toggle', () => {
    const css = renderProtoStyleTokenCss([
      'shadow-[inset_0_0_0_2px_#000,3px_3px_0_0_#000]',
      'shadow-[inset_0_0_0_2px_#000]',
    ]);

    expect(css).toContain('--pui-shadow: inset 0 0 0 2px #000, 3px 3px 0 0 #000;');
    expect(css).toContain('--pui-shadow: inset 0 0 0 2px #000;');
    expect(css).toContain(
      'box-shadow: var(--pui-ring-offset-shadow, 0 0 #0000), var(--pui-ring-shadow, 0 0 #0000), var(--pui-shadow, 0 0 #0000);'
    );
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders the exact box and glyph geometry used by Shadcn Checkbox', () => {
    const css = renderProtoStyleTokenCss(['rounded-[4px]', 'size-4', 'size-3.5']);

    // The theme-derived `rounded-sm` is 6px and `size-3` is 12px. On a 16px box
    // both are visible, so the projection needs these two exact values.
    expect(css).toContain('border-radius: 4px;');
    expect(css).toContain('width: 0.875rem;');
    expect(css).toContain('height: 0.875rem;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('closes and renders the current paired Checkbox fills without the superseded reversed frame', () => {
    const tokens = [
      'border-border',
      'data-[checked]:not-[data-indeterminate]:bg-main',
      'data-[checked]:not-[data-indeterminate]:text-main-foreground',
      'data-[indeterminate]:bg-main',
      'data-[indeterminate]:text-main-foreground',
    ];
    for (const token of tokens) expect(BRUTALIST_STYLE_TOKENS).toContain(token);
    expect(BRUTALIST_STYLE_TOKENS).not.toContain(
      'data-[checked]:not-[data-indeterminate]:border-background'
    );
    const css = renderProtoStyleTokenCss(tokens);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('border-color: var(--pui-border);');
    expect(css).toContain('background-color: var(--pui-main);');
    expect(css).toContain('color: var(--pui-main-foreground);');
    expect(css).not.toContain('border-color: var(--pui-background);');
    // Legacy generic utilities remain supported even though this component no
    // longer uses the old state-swapped frame recipe.
    const legacyCss = renderProtoStyleTokenCss([
      'text-current',
      'opacity-0',
      'opacity-100',
      'border-main-foreground',
      'border-background',
    ]);
    expect(legacyCss).toContain('color: currentColor;');
    expect(legacyCss).toContain('opacity: 0;');
    expect(legacyCss).toContain('opacity: 1;');
    expect(legacyCss).toContain('border-color: var(--pui-main-foreground);');
    expect(legacyCss).toContain('border-color: var(--pui-background);');
    expect(legacyCss).not.toContain('Unsupported Proto UI style tokens');
  });

  it('resets composed custom properties inside the layer, below every token rule', () => {
    const css = renderProtoStyleTokenCss(['ring-2', 'shadow-[3px_3px_0_0_#000]', 'translate-x-0']);

    const layerAt = css.indexOf('@layer proto-ui {');
    const resetAt = css.indexOf(':where([data-pui-style]) {');
    const firstTokenAt = css.indexOf(':where([data-pui-style~=');

    // Inside the layer, because the unlayered baseline would outrank every
    // token rule and no ring could paint at all.
    expect(layerAt).toBeGreaterThanOrEqual(0);
    expect(resetAt).toBeGreaterThan(layerAt);
    // First in the layer, because a token rule is `:where()` too and only
    // source order puts it on top.
    expect(resetAt).toBeLessThan(firstTokenAt);

    // `initial` restores the guaranteed-invalid value, so the fallback declared
    // next to each `var()` stays the one place the default is written.
    for (const property of [
      '--pui-ring-offset-shadow',
      '--pui-ring-shadow',
      '--pui-shadow',
      '--pui-translate-x',
      '--pui-scale-x',
    ]) {
      expect(css.slice(resetAt, firstTokenAt)).toContain(`${property}: initial;`);
    }
  });

  it('renders directional separator borders in the theme foreground', () => {
    const css = renderProtoStyleTokenCss(['border-b-2', 'border-t-2', 'border-foreground']);

    expect(css).toContain('border-bottom-width: 2px;');
    expect(css).toContain('border-top-width: 2px;');
    expect(css).toContain('border-color: var(--pui-foreground);');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders internal negative data selector variants', () => {
    const css = renderProtoStyleTokenCss(['data-[hovered]:not-[data-active]:bg-muted']);

    expect(css).toContain(
      ':where([data-pui-style~="data-[hovered]:not-[data-active]:bg-muted"])[data-hovered]:not([data-active])'
    );
    expect(css).toContain('background-color: var(--pui-muted);');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders the allowlisted static text-selection pseudo-element variants', () => {
    const css = renderProtoStyleTokenCss([
      'selection:bg-primary',
      'selection:text-primary-foreground',
    ]);

    expect(css).toContain(
      ':where([data-pui-style~="selection:bg-primary"])::selection {\n    background-color: var(--pui-primary);'
    );
    expect(css).toContain(
      ':where([data-pui-style~="selection:text-primary-foreground"])::selection {\n    color: var(--pui-primary-foreground);'
    );
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('lets dark tokens follow the system preference when the host has no explicit theme', () => {
    const css = renderProtoStyleTokenCss(['dark:bg-input/30']);

    expect(css).toContain(':where(.dark)');
    expect(css).toContain(":where([data-theme='dark'])");
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(
      ":where(:root:not(.dark):not(.light):not([data-theme='dark']):not([data-theme='light']))"
    );
  });

  it('uses the host-color-scheme-v1 marker as the only Shadow dark environment selector', () => {
    const css = renderProtoShadowStyleTokenCss(['dark:bg-input/30']);

    expect(css).toContain(
      `:where(:host([data-pui-color-scheme='dark'])) :where([data-pui-style~="dark:bg-input/30"])`
    );
    expect(css).toContain(
      'background-color: color-mix(in oklab, var(--pui-input) 30%, transparent);'
    );
    expect(css).not.toContain(':where(.dark)');
    expect(css).not.toContain('[data-theme=');
    expect(css).not.toContain(':root');
    expect(css).not.toContain('@media (prefers-color-scheme: dark)');
  });

  it('keeps ordinary Shadow dark context at zero specificity against state rules', () => {
    // D-WEB-COMPONENT-SHADOW-STYLE-0001 B/C: environment substitution must
    // not give dark:p-2 precedence over the document's data-[open]:p-4.
    const tokens = ['dark:p-2', 'data-[open]:p-4', 'dark:data-[open]:p-8'];
    const shadow = renderProtoShadowStyleTokenCss(tokens);
    expect(shadow).toContain(
      `:where(:host([data-pui-color-scheme='dark'])) :where([data-pui-style~="dark:p-2"])`
    );
    expect(shadow).toContain(`:where([data-pui-style~="data-[open]:p-4"])[data-open]`);
    expect(shadow).toContain(
      `:where(:host([data-pui-color-scheme='dark'])) :where([data-pui-style~="dark:data-[open]:p-8"])[data-open]`
    );
    expect(shadow).not.toContain(`:host([data-pui-color-scheme='dark']) :where`);
    for (const css of [shadow, renderProtoStyleTokenCss(tokens)]) {
      expect(css).toContain('padding: 0.5rem;');
      expect(css).toContain('padding: 1rem;');
      expect(css).toContain('padding: 2rem;');
    }
  });

  it('keeps non-environment Shadow output identical to document output', () => {
    const tokens = [
      'animate-in',
      'duration-200',
      'fade-in-0',
      'ring-2',
      'translate-x-0',
      'unsupported-shadow-token',
    ];

    expect(renderProtoShadowStyleTokenCss(tokens)).toBe(renderProtoStyleTokenCss(tokens));
  });

  it('preserves declarations, ordering, keyframes, baseline, and diagnostics around Shadow dark rules', () => {
    const css = renderProtoShadowStyleTokenCss([
      'animate-in',
      'dark:bg-input/30',
      'duration-200',
      'fade-in-0',
      'unsupported-shadow-token',
    ]);

    expect(css).toContain('@keyframes pui-enter');
    expect(css).toContain('--pui-enter-opacity: 0');
    expect(css).toContain('transition-duration: 200ms;');
    expect(css).toContain('Unsupported Proto UI style tokens:');
    expect(css).toContain('* - unsupported-shadow-token');
    expect(css.indexOf('[data-pui-style~="animate-in"]')).toBeLessThan(
      css.indexOf('[data-pui-style~="duration-200"]')
    );
  });

  it('builds a frozen versioned Shadow style artifact without exporting theme declarations', () => {
    const artifact = renderProtoShadowStyleArtifact(['dark:bg-input/30']);

    expect(artifact).toEqual({
      kind: PROTO_SHADOW_STYLE_ARTIFACT_KIND,
      version: PROTO_SHADOW_STYLE_ARTIFACT_VERSION,
      cssText: renderProtoShadowStyleTokenCss(['dark:bg-input/30']),
      environment: PROTO_SHADOW_STYLE_ENVIRONMENT,
    });
    expect(Object.isFrozen(artifact)).toBe(true);
    expect(artifact.cssText).not.toContain('--pui-background:');
  });

  it('adds a system dark fallback to generated theme variables', () => {
    const css = renderPrefixedThemeCss(`:root {
  --background: white;
}

:root.dark,
:root[data-theme='dark'] {
  --background: black;
}`);

    expect(css).toContain('--pui-background: white;');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(
      ":root:not(.dark):not(.light):not([data-theme='dark']):not([data-theme='light']) {"
    );
    expect(css).toContain('--pui-background: black;');
  });

  it('renders composable enter and exit animation utilities', () => {
    const css = renderProtoStyleTokenCss([
      'animate-in',
      'fade-in-0',
      'zoom-in-95',
      'animate-out',
      'fade-out-0',
      'zoom-out-95',
      'transition-none',
      'duration-200',
    ]);

    expect(css).toContain('@keyframes pui-enter');
    expect(css).toContain('@keyframes pui-exit');
    expect(css).toContain('animation-name: pui-enter;');
    expect(css).toContain('animation-name: pui-exit;');
    expect(css).toContain('--pui-enter-opacity: 0;');
    expect(css).toContain('--pui-exit-opacity: 0;');
    expect(css).toContain('--pui-enter-scale: 0.95;');
    expect(css).toContain('--pui-exit-scale: 0.95;');
    expect(css).toContain(
      'transform: translate(var(--pui-translate-x, 0), var(--pui-translate-y, 0)) scale(var(--pui-enter-scale, 1));'
    );
    expect(css).toContain(
      'transform: translate(var(--pui-translate-x, 0), var(--pui-translate-y, 0)) scale(var(--pui-exit-scale, 1));'
    );
    expect(css).not.toContain('scale: var(--pui-enter-scale');
    expect(css).toContain('--pui-animation-duration: 200ms;');
    expect(css).toContain('transition-property: none;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });
  it('emits explicit duration and ease overrides after transition utilities so they win the cascade', () => {
    const css = renderProtoStyleTokenCss([
      'duration-200',
      'ease-in-out',
      'transition-all',
      'transition-colors',
    ]);

    const transitionAll = css.indexOf('[data-pui-style~="transition-all"]');
    const transitionColors = css.indexOf('[data-pui-style~="transition-colors"]');
    const duration = css.indexOf('[data-pui-style~="duration-200"]');
    const ease = css.indexOf('[data-pui-style~="ease-in-out"]');

    expect(transitionAll).toBeGreaterThan(-1);
    expect(duration).toBeGreaterThan(transitionAll);
    expect(duration).toBeGreaterThan(transitionColors);
    expect(ease).toBeGreaterThan(transitionAll);
    expect(ease).toBeGreaterThan(transitionColors);
    expect(css).toContain('transition-duration: 150ms;');
    expect(css).toContain('transition-duration: 200ms;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });
  it('emits explicit leading overrides after text-size utilities', () => {
    const css = renderProtoStyleTokenCss(['leading-6', 'text-sm']);

    const textSize = css.indexOf('[data-pui-style~="text-sm"]');
    const leading = css.indexOf('[data-pui-style~="leading-6"]');

    expect(textSize).toBeGreaterThan(-1);
    expect(leading).toBeGreaterThan(textSize);
    expect(css).toContain('line-height: 1.25rem;');
    expect(css).toContain('line-height: 1.5rem;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('emits explicit leading overrides after text-size utilities so they win the cascade', () => {
    const css = renderProtoStyleTokenCss(['leading-6', 'text-sm']);
    const textSize = css.indexOf('[data-pui-style~="text-sm"]');
    const leading = css.indexOf('[data-pui-style~="leading-6"]');

    expect(textSize).toBeGreaterThan(-1);
    expect(leading).toBeGreaterThan(textSize);
  });

  it('renders state-driven spacing translations used by the Switch thumb', () => {
    const css = renderProtoStyleTokenCss([
      'translate-x-0',
      'data-[checked]:translate-x-[calc(100%_-_2px)]',
      'ring-offset-0',
    ]);

    expect(css).toContain('--pui-translate-x: 0px;');
    expect(css).toContain(
      ':where([data-pui-style~="data-[checked]:translate-x-[calc(100%_-_2px)]"])[data-checked]'
    );
    expect(css).toContain('--pui-translate-x: calc(100% - 2px);');
    expect(css).toContain('--pui-ring-offset-width: 0px;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders Hover Card positioning, popover, shadow, and directional motion utilities', () => {
    const css = renderProtoStyleTokenCss([
      'bg-popover',
      'text-popover-foreground',
      'w-64',
      'shadow-md',
      'bottom-full',
      'right-full',
      'mb-1',
      'translate-y-0',
      'slide-in-from-left-2',
      'slide-in-from-top-2',
    ]);

    expect(css).toContain('background-color: var(--pui-popover);');
    expect(css).toContain('color: var(--pui-popover-foreground);');
    expect(css).toContain('width: 16rem;');
    expect(css).toContain('bottom: 100%;');
    expect(css).toContain('right: 100%;');
    expect(css).toContain('margin-bottom: 0.25rem;');
    expect(css).toContain('--pui-shadow: 0 4px 6px -1px');
    expect(css).toContain('--pui-translate-x: -0.5rem;');
    expect(css).toContain('--pui-translate-y: -0.5rem;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });
  it('renders the Bootstrap 2.3.2 field inset and alignment without losing current shared tokens', () => {
    const css = renderProtoStyleTokenCss([
      'justify-start',
      'font-sans',
      'rounded-base',
      'shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%)]',
    ]);
    expect(css).toContain('justify-content: flex-start;');
    expect(css).toContain(
      'font-family: var(--pui-font-sans, ui-sans-serif, system-ui, sans-serif);'
    );
    expect(css).toContain('border-radius: var(--pui-radius);');
    expect(css).toContain('--pui-shadow: inset 0 1px 1px rgb(0 0 0 / 0.075);');
    expect(css).toContain('var(--pui-ring-shadow, 0 0 #0000), var(--pui-shadow, 0 0 #0000)');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });
});

describe('normalized continuous layout projection', () => {
  it('lowers static exposed-state flex basis and vertical slider positions', () => {
    const tokens = [
      'basis-2',
      'basis-[calc(var(--pui-size)*1%)]',
      'bottom-[calc(var(--pui-percentage)*1%)]',
    ];
    for (const css of [renderProtoStyleTokenCss(tokens), renderProtoShadowStyleTokenCss(tokens)]) {
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(css).toContain('flex-basis: 0.5rem;');
      expect(css).toContain('flex-basis: calc(var(--pui-size)*1%);');
      expect(css).toContain('bottom: calc(var(--pui-percentage)*1%);');
    }
  });
});

describe('Finf authored layout utility closure', () => {
  it('realizes the collected component vocabulary in document and Shadow CSS', () => {
    const tokens = [
      'border-dashed',
      'cursor-move',
      'grid-cols-7',
      'grow',
      'grow-0',
      'h-48',
      'inline-grid',
      'items-stretch',
      'max-w-md',
      'min-h-24',
      'min-w-40',
      'mx-0',
      'mx-1',
      'my-1',
      'rounded',
      'self-stretch',
      'shadow-[2px_2px_0_0_var(--pui-border)]',
      'shrink',
      'tabular-nums',
      'text-center',
      'w-1/3',
      'w-96',
      'w-auto',
    ];
    for (const css of [renderProtoStyleTokenCss(tokens), renderProtoShadowStyleTokenCss(tokens)]) {
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(css).toContain('grid-template-columns: repeat(7, minmax(0, 1fr));');
      expect(css).toContain('flex-grow: 0;');
      expect(css).toContain('flex-shrink: 1;');
      expect(css).toContain('margin-inline: 0.25rem;');
      expect(css).toContain('margin-block: 0.25rem;');
      expect(css).toContain('--pui-shadow: 2px 2px 0 0 var(--pui-border);');
      expect(css).toContain('font-variant-numeric: tabular-nums;');
      expect(css).toContain('width: 24rem;');
    }
  });
});

describe('Classic Drawer handle physical styling', () => {
  it('lowers the three collected handle tokens without dropping the inset shadow', () => {
    for (const css of [
      renderProtoStyleTokenCss(['bg-[#ccc]', 'border-[#bbb]', 'shadow-inner']),
      renderProtoShadowStyleTokenCss(['bg-[#ccc]', 'border-[#bbb]', 'shadow-inner']),
    ]) {
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(css).toContain('background-color: #ccc;');
      expect(css).toContain('border-color: #bbb;');
      expect(css).toContain('--pui-shadow: inset 0 2px 4px 0 rgb(0 0 0 / 0.05);');
    }
  });
});

it('keeps bounded Drawer grid rows at the start of the actual scrollport', () => {
  for (const css of [
    renderProtoStyleTokenCss(['content-start']),
    renderProtoShadowStyleTokenCss(['content-start']),
  ]) {
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('align-content: flex-start;');
  }
});

it('lowers the complete physical Drawer handle cursor and local stacking vocabulary', () => {
  const tokens = ['cursor-ew-resize', 'cursor-ns-resize', 'z-10'];
  for (const css of [renderProtoStyleTokenCss(tokens), renderProtoShadowStyleTokenCss(tokens)]) {
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('cursor: ew-resize;');
    expect(css).toContain('cursor: ns-resize;');
    expect(css).toContain('z-index: 10;');
  }
});

it('delivers the standard fixed white foreground through each existing CSS target without admitting arbitrary colors', () => {
  const renderers = [
    renderProtoStyleTokenCss,
    renderProtoShadowStyleTokenCss,
    (tokens: string[]) => renderProtoShadowSplitStyleArtifact(tokens).cssText,
  ];
  for (const render of renderers) {
    const css = render(['text-white']);
    expect(css).toContain('color: #fff;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).not.toContain('var(--pui-destructive-foreground)');
    for (const token of [
      'text-snow',
      'text-white/90',
      'text-[#fff]',
      'text-[white]',
      'text-white;display:none',
    ]) {
      const rejected = render([token]);
      expect(rejected, token).toContain('Unsupported Proto UI style tokens');
      expect(rejected, token).not.toContain('color: #fff;');
    }
  }
});

it('lowers only the two additional bounded theme radius slots for Command', () => {
  for (const render of [
    renderProtoStyleTokenCss,
    renderProtoShadowStyleTokenCss,
    (tokens: string[]) => renderProtoShadowSplitStyleArtifact(tokens).cssText,
  ]) {
    const css = render(['rounded-[var(--pui-radius-xl)]', 'rounded-[var(--pui-radius-3xl)]']);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('border-radius: var(--pui-radius-xl);');
    expect(css).toContain('border-radius: var(--pui-radius-3xl);');
    for (const token of [
      'rounded-[var(--other-radius-xl)]',
      'rounded-[calc(var(--pui-radius-3xl)+1px)]',
      'rounded-[var(--pui-radius-5xl)]',
    ]) {
      expect(render([token])).toContain('Unsupported Proto UI style tokens');
    }
  }
  const theme = renderPrefixedThemeCss(':root{--radius:0.625rem;}');
  expect(theme).toContain('--pui-radius-xl: calc(var(--pui-radius) + 4px);');
  expect(theme).toContain('--pui-radius-3xl: calc(var(--pui-radius) + 12px);');
});

describe('transform transition property closure', () => {
  it('includes independent transform properties on all three targets and preserves reduced motion', () => {
    for (const render of [
      renderProtoStyleTokenCss,
      renderProtoShadowStyleTokenCss,
      (tokens: string[]) => renderProtoShadowSplitStyleArtifact(tokens).cssText,
    ]) {
      const css = render(['transition-transform', 'translate-x-[calc(100%_-_4px)]']);
      expect(css).toContain('transition-property: transform, translate, scale, rotate;');
      expect(css).toContain('@media (prefers-reduced-motion: reduce)');
      expect(css).toContain('transition-property: none;');
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(render(['transition-[transform,translate,opacity]'])).toContain(
        'Unsupported Proto UI style tokens'
      );
    }
  });
});
