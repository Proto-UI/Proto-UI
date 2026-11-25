import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { collectProtoStyleTokens } from '../src/services/prototype-style-tokens';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
  renderProtoShadowSplitStyleArtifact,
} from '../src/services/proto-style-css';
import { SHADCN_STYLE_TOKENS } from '../src/generated/shadcn-style-tokens';

const TOAST_STACK_TOKENS = [
  'duration-300',
  'ease-out',
  'leading-[1.4]',
  'opacity-95',
  'pointer-events-auto',
  'shadow-[0_4px_12px_rgb(0_0_0/10%)]',
  'z-0',
  'z-20',
  'z-30',
];
const TARGETS = [
  ['document', renderProtoStyleTokenCss],
  ['shadow', renderProtoShadowStyleTokenCss],
  ['shadow-split', (tokens: string[]) => renderProtoShadowSplitStyleArtifact(tokens).cssText],
] as const;

// The actual Toast entry supplies the inventory. In particular, the collapsed
// stack rules and seven description recipes must reach CSS through this public
// collector, not only through a manually assembled token list.
describe('official Shadcn Toast style closure', () => {
  let tokens: string[];
  beforeAll(async () => {
    tokens = await collectProtoStyleTokens(path.resolve('packages/prototypes/shadcn/src/toast'));
  }, 30_000);

  for (const [target, render] of TARGETS) {
    it(`${target} delivers the authored stack, hit policy, shadow and description styles`, () => {
      expect(tokens).toEqual(expect.arrayContaining(TOAST_STACK_TOKENS));
      expect(SHADCN_STYLE_TOKENS).toEqual(expect.arrayContaining(tokens));
      const css = render(tokens);
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(css).toContain('z-index: 0;');
      expect(css).toContain('z-index: 20;');
      expect(css).toContain('z-index: 30;');
      expect(css).toContain('opacity: 0.95;');
      expect(css).toContain('pointer-events: auto;');
      expect(css).toContain('line-height: 1.4;');
      expect(css).toContain('transition-duration: 300ms;');
      expect(css).toContain('--pui-animation-duration: 300ms;');
      expect(css).toContain('transition-timing-function: cubic-bezier(0, 0, 0.2, 1);');
      expect(css).toContain('--pui-shadow: 0 4px 12px rgb(0 0 0 / 0.1);');
      // The Toast shadow keeps the existing focus-ring composition rather than
      // replacing box-shadow with a standalone paint declaration.
      expect(css).toContain(
        'box-shadow: var(--pui-ring-offset-shadow, 0 0 #0000), var(--pui-ring-shadow, 0 0 #0000), var(--pui-shadow, 0 0 #0000);'
      );
    });

    it(`${target} keeps explicit timing and line height after the composite defaults`, () => {
      // Feed overrides first: emission order, not caller order, must keep the
      // 300ms/ease-out/1.4 values after transition-all and text-sm defaults.
      const css = render([
        'duration-300',
        'ease-out',
        'leading-[1.4]',
        'transition-all',
        'text-sm',
      ]);
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(css.indexOf('transition-duration: 300ms;')).toBeGreaterThan(
        css.indexOf('transition-duration: 150ms;')
      );
      expect(
        css.indexOf('transition-timing-function: cubic-bezier(0, 0, 0.2, 1);')
      ).toBeGreaterThan(css.indexOf('transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);'));
      expect(css.indexOf('line-height: 1.4;')).toBeGreaterThan(
        css.indexOf('line-height: 1.25rem;')
      );
    });

    it(`${target} keeps nearby unadmitted and malformed recipes unsupported`, () => {
      for (const token of [
        'duration-301',
        'ease-sideways',
        'leading-[1.41]',
        'opacity-94',
        'pointer-events-painted',
        'shadow-[0_4px_13px_rgb(0_0_0/10%)]',
        'z-31',
        'shadow-[0_4px_12px_rgb(0_0_0/10%);color:red]',
      ]) {
        const css = render([token]);
        expect(css, token).toContain('Unsupported Proto UI style tokens');
        expect(css, token).not.toMatch(/(?:^|\n)\s*color:\s*red/);
      }
    });
  }
});
