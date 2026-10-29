import { SHADCN_STYLE_TOKENS } from '../../../../packages/cli/src/generated/shadcn-style-tokens';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import shadcnSurface from '@proto.ui/prototypes-shadcn/surface';
import shadcnText from '@proto.ui/prototypes-shadcn/text';
import shadcnButton from '@proto.ui/prototypes-shadcn/button';
import brutalistButton from '@proto.ui/prototypes-brutalist/button';
import { shadcnActionAppearance } from '@proto.ui/prototypes-shadcn/surface';
import { brutalistActionAppearance } from '@proto.ui/prototypes-brutalist/surface';
import { renderProtoStyleTokenCss } from '../../../../packages/cli/src/services/proto-style-css';
import { linkSurfaceLayout, linkSurfaceProps, linkTextProps } from './site-link-recipes';

const owned: HTMLElement[] = [];
const flush = async () => {
  for (let i = 0; i < 25; i++) await Promise.resolve();
};
afterEach(async () => {
  for (const element of owned.splice(0)) element.remove();
  await flush();
});

for (const [family, prototype, appearance, sizeToken, height] of [
  ['shadcn', shadcnButton, shadcnActionAppearance, 'min-h-8', '2rem'],
  ['brutalist', brutalistButton, brutalistActionAppearance, 'min-h-10', '2.5rem'],
] as const) {
  describe(`${family} public passive action appearance`, () => {
    it('matches the real default wrapped Button geometry without taking its semantics', async () => {
      if (!customElements.get(prototype.name)) AdaptToWebComponent(prototype);
      const button = document.createElement(prototype.name);
      owned.push(button);
      document.body.append(button);
      setElementProps(button, { size: 'default', wrap: true });
      await flush();
      const tokens = (button.getAttribute('data-pui-style') ?? '').split(/\s+/);
      expect(tokens).toContain(sizeToken);
      const css = renderProtoStyleTokenCss([sizeToken]);
      expect(css).toContain(`min-height: ${height}`);
      const recipe = appearance();
      expect(recipe.layout).toMatchObject({
        minHeight: height,
        boxSizing: 'border-box',
        whiteSpace: 'normal',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        padding: family === 'shadcn' ? '0.25rem 0.75rem' : '0.25rem 1rem',
      });
      expect(Object.keys(recipe).sort()).toEqual(['layout', 'surface', 'text']);
      for (const key of ['role', 'tabIndex', 'href', 'disabled', 'onClick', 'onKeyDown']) {
        expect(recipe.surface).not.toHaveProperty(key);
        expect(recipe.layout).not.toHaveProperty(key);
      }
      expect(button.getAttribute('role')).toBe('button');
      const siteRecipe =
        family === 'shadcn' ? shadcnActionAppearance({ styleProfile: 'luma' }) : recipe;
      expect(linkSurfaceLayout(family, 'action', 'primary')).toEqual({
        ...siteRecipe.layout,
        pointerEvents: 'none',
      });
      expect(linkTextProps('action', undefined, family)).toEqual(siteRecipe.text);
    });
    it('projects only observed facts and leaves ordinary navigation selection unchanged', () => {
      const recipe = appearance({
        ...(family === 'shadcn' ? { styleProfile: 'luma' as const } : {}),
        emphasis: 'secondary',
        hovered: true,
        pressed: true,
        focusVisible: true,
      });
      expect(recipe.surface).toMatchObject({
        hovered: true,
        pressed: true,
        focusVisible: true,
        current: false,
      });
      expect(
        linkSurfaceProps(family, 'action', 'secondary', {
          hovered: true,
          pressed: true,
          focusVisible: true,
          current: false,
        })
      ).toEqual(recipe.surface);
      for (const kind of ['text', 'nav', 'toc', 'sidebar'] as const) {
        expect(linkSurfaceLayout(family, kind, 'minimal')).not.toHaveProperty('userSelect');
      }
    });
  });
}

it('opts only authored action anchors into the SSR recipe and preserves native destinations', () => {
  const source = readFileSync('apps/www/src/components/Homepage/HomeActions.astro', 'utf8');
  const hero = readFileSync('apps/www/src/components/override/Hero.astro', 'utf8');
  expect(source).toContain("appearance === 'action' && !icon");
  expect(source).toContain('linkActionAppearance(initialFamily, variant).layout');
  expect(source).toContain('href={link}');
  expect(source).toContain('{...attrs}');
  expect(source).toContain("appearance ?? attrs['data-site-link-appearance']");
  expect(hero).toContain('appearance="action"');
  expect(source).not.toContain('role="button"');
  expect(source).not.toContain('pointerEvents:');
});

it('keeps public profile semantics passive and gives the authored hero the explicit Luma recipe', () => {
  const rhea = shadcnActionAppearance();
  const luma = shadcnActionAppearance({ styleProfile: 'luma', emphasis: 'secondary' });
  expect(rhea.layout.minHeight).toBe('2rem');
  expect(luma.layout.minHeight).toBe('2.25rem');
  expect(luma.surface).toMatchObject({ actionProfile: 'luma', variant: 'secondary' });
  expect(luma.text).toMatchObject({ actionProfile: 'luma', size: 'sm', weight: 'medium' });
  for (const locale of ['en', 'zh-cn']) {
    const page = readFileSync(`apps/www/src/content/docs/${locale}/index.mdx`, 'utf8');
    expect(page).toContain('variant: secondary');
    expect(page).not.toContain('icon: external');
  }
  const hero = readFileSync('apps/www/src/components/override/Hero.astro', 'utf8');
  expect(hero).not.toContain('min-height: 2.75rem');
});

it('projects opt-in family action paint without changing default Surface/Text recipes', async () => {
  for (const prototype of [shadcnSurface, shadcnText]) {
    if (!customElements.get(prototype.name)) AdaptToWebComponent(prototype);
  }
  const surface = document.createElement(shadcnSurface.name);
  const text = document.createElement(shadcnText.name);
  owned.push(surface, text);
  document.body.append(surface, text);
  await flush();
  const tokens = (node: HTMLElement) => (node.getAttribute('data-pui-style') ?? '').split(/\s+/);
  expect(tokens(surface)).toContain('rounded-xl');
  expect(tokens(text)).toContain('leading-normal');
  for (const profile of ['rhea', 'luma'] as const) {
    const recipe = shadcnActionAppearance({
      styleProfile: profile,
      emphasis: 'secondary',
      hovered: true,
      focusVisible: true,
    });
    setElementProps(surface, recipe.surface);
    setElementProps(text, recipe.text);
    await flush();
    expect(tokens(surface)).toContain(
      profile === 'rhea' ? 'rounded-[var(--pui-radius-2xl)]' : 'rounded-[var(--pui-radius-4xl)]'
    );
    expect(tokens(surface)).toContain('border');
    expect(tokens(surface)).not.toContain('border-0');
    expect(tokens(surface)).toContain('ring-ring/30');
    expect(tokens(surface)).toContain(
      'bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]'
    );
    expect(tokens(text)).toContain('leading-5');
    expect(tokens(text)).not.toContain('leading-normal');
    expect(surface.getAttribute('role')).not.toBe('button');
  }
  setElementProps(surface, {});
  setElementProps(text, {});
  await flush();
  expect(tokens(surface)).toContain('rounded-xl');
  expect(tokens(surface)).not.toContain('rounded-[var(--pui-radius-4xl)]');
  expect(tokens(text)).toContain('leading-normal');
  expect(tokens(text)).not.toContain('leading-5');
});

it('keeps ordinary pressed navigation stationary while preserving explicit action feedback', async () => {
  if (!customElements.get(shadcnSurface.name)) AdaptToWebComponent(shadcnSurface);
  const surface = document.createElement(shadcnSurface.name);
  owned.push(surface);
  document.body.append(surface);
  const tokens = () => (surface.getAttribute('data-pui-style') ?? '').split(/\s+/);
  for (const kind of ['sidebar', 'toc', 'nav', 'text'] as const) {
    setElementProps(
      surface,
      linkSurfaceProps('shadcn', kind, 'minimal', {
        hovered: true,
        pressed: true,
        focusVisible: true,
        current: true,
      })
    );
    await flush();
    expect(tokens()).not.toContain('translate-y-px');
    expect(tokens()).not.toContain('shadow-none');
    expect(tokens()).toContain('forced-colors-focus-outline');
  }
  for (const styleProfile of ['rhea', 'luma'] as const) {
    setElementProps(surface, shadcnActionAppearance({ styleProfile, pressed: true }).surface);
    await flush();
    expect(tokens()).toContain('translate-y-px');
    expect(tokens()).not.toContain('shadow-none');
    setElementProps(surface, shadcnActionAppearance({ styleProfile, pressed: false }).surface);
    await flush();
    expect(tokens()).not.toContain('translate-y-px');
  }
  setElementProps(surface, { pressed: true, elevation: 'raised' });
  await flush();
  expect(tokens()).toContain('shadow-sm');
  expect(tokens()).not.toContain('translate-y-px');
  expect(tokens()).not.toContain('shadow-none');
});

for (const styleProfile of ['rhea', 'luma'] as const) {
  it(`ships every public ${styleProfile} Button size and wrap branch in the actual generated preset`, async () => {
    if (!customElements.get(shadcnButton.name)) AdaptToWebComponent(shadcnButton);
    const button = document.createElement(shadcnButton.name);
    owned.push(button);
    document.body.append(button);
    for (const size of ['default', 'sm', 'lg', 'icon', 'icon-compact'] as const) {
      for (const wrap of [false, true]) {
        setElementProps(button, { styleProfile, size, wrap });
        await flush();
        const active = (button.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
        expect(active.length).toBeGreaterThan(0);
        expect(
          active.filter((token) => !SHADCN_STYLE_TOKENS.includes(token)),
          `${styleProfile}/${size}/wrap=${wrap}`
        ).toEqual([]);
      }
    }
  });
}
