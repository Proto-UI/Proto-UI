import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { collectProtoStyleTokens } from '../../../../packages/cli/src/services/prototype-style-tokens';
import { renderProtoStyleTokenCss } from '../../../../packages/cli/src/services/proto-style-css';
import SiteTypography, { SITE_TYPOGRAPHY_ROLES } from './site-typography.proto';
const Constructor = AdaptToWebComponent(SiteTypography, { registerAs: 'test-site-typography' });
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
afterEach(() => document.body.replaceChildren());
describe('app-private semantic typography style closure', () => {
  it('preserves the approved bilingual slogan and Chinese CTA source verbatim', () => {
    const zh = readFileSync(
      new NodeURL('../content/docs/zh-cn/index.mdx', import.meta.url),
      'utf8'
    );
    const en = readFileSync(new NodeURL('../content/docs/en/index.mdx', import.meta.url), 'utf8');
    for (const copy of [
      '组件可以独立于框架或设计体系',
      '而不是在不同框架中被反复实现',
      '试试 Demo',
    ])
      expect(zh).toContain(copy);
    for (const copy of [
      'Components should not depend on frameworks or designs.',
      'Defined once — not rebuilt per framework.',
    ])
      expect(en).toContain(copy);
  });
  it('collects and compiles the complete role scale from Prototype source', async () => {
    const tokens = (
      await collectProtoStyleTokens(fileURLToPath(new NodeURL('.', import.meta.url)))
    ).map((token) => {
      if (typeof token !== 'string') throw new Error('Collected style tokens must be strings');
      return token;
    });
    for (const token of [
      'text-2xl',
      'text-3xl',
      'text-4xl',
      'text-5xl',
      'leading-tight',
      'leading-snug',
      'leading-normal',
      'font-heading',
      'font-bold',
    ])
      expect(tokens).toContain(token);
    const css = renderProtoStyleTokenCss(tokens);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('font-size: 3rem');
    expect(css).toContain('line-height: 1.25');
    expect(css).toContain('font-family: var(--pui-font-heading');
  });
  it('has exactly one font/weight/size/color per family-role and keeps compact sizing exclusive', async () => {
    for (const family of ['shadcn', 'brutalist'])
      for (const role of SITE_TYPOGRAPHY_ROLES)
        for (const compact of [false, true]) {
          const surface = new Constructor();
          setElementProps(surface, { family, role, compact });
          document.body.append(surface);
          await settle();
          const tokens = surface.getAttribute('data-pui-style')!.split(/\s+/);
          expect(tokens.filter((t) => /^font-(?:sans|heading)$/.test(t))).toHaveLength(1);
          expect(
            tokens.filter((t) => /^font-(?:normal|medium|semibold|bold)$/.test(t))
          ).toHaveLength(1);
          expect(tokens.filter((t) => /^text-(?:xs|sm|base|lg|xl|[2-5]xl)$/.test(t))).toHaveLength(
            1
          );
          expect(
            tokens.filter((t) => /^text-(?:foreground|muted-foreground)$/.test(t))
          ).toHaveLength(1);
          expect(surface.getExposes()).toEqual({});
          expect(surface.hasAttribute('role')).toBe(false);
          expect(surface.hasAttribute('tabindex')).toBe(false);
          expect(tokens).not.toContain('pointer-events-none');
          surface.remove();
        }
  });
});
