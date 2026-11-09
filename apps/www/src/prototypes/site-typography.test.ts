import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { URL as NodeURL } from 'node:url';
import { SITE_TYPOGRAPHY_ROLES, siteTextRecipe } from '../components/site-text-recipes';
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
  it('maps every semantic content role to generic Text presentation props', () => {
    for (const family of ['shadcn', 'brutalist'] as const)
      for (const role of SITE_TYPOGRAPHY_ROLES)
        for (const compact of [false, true]) {
          const props = siteTextRecipe(role, family, compact);
          expect(props).not.toHaveProperty('role');
          expect(props).not.toHaveProperty('family');
          expect(props.size).toBeTruthy();
          expect(props.font).toBeTruthy();
          expect(props.weight).toBeTruthy();
          expect(props.tone).toBeTruthy();
          // The Shadcn site hero keeps the source-aligned medium slogan at
          // every viewport; only the Brutalist family scales it down when the
          // viewport is compact.
          if (role === 'slogan')
            expect(props.size).toBe(family === 'shadcn' ? '3xl' : compact ? '2xl' : '4xl');
        }
  });
});
