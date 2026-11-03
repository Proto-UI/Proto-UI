import { afterEach, expect, it } from 'vitest';
import {
  AdaptToWebComponent,
  setElementProps,
  getElementProps,
} from '@proto.ui/adapter-web-component';
import ShadcnSurface from '@proto.ui/prototypes-shadcn/surface';
import BrutalistSurface from '@proto.ui/prototypes-brutalist/surface';
import ShadcnText from '@proto.ui/prototypes-shadcn/text';
import BrutalistText from '@proto.ui/prototypes-brutalist/text';
import {
  linkSurfaceProps,
  linkSurfaceLayout,
  linkTextProps,
  appendSiteLinkGlyph,
  type SiteLinkAppearance,
  type SiteLinkEmphasis,
} from '../components/site-link-recipes';
const Constructors = {
  shadcn: AdaptToWebComponent(ShadcnSurface),
  brutalist: AdaptToWebComponent(BrutalistSurface),
};
const Texts = {
  shadcn: AdaptToWebComponent(ShadcnText),
  brutalist: AdaptToWebComponent(BrutalistText),
};
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
afterEach(() => document.body.replaceChildren());

// The accepted website target remains 44px, not upstream Rhea's size-8.
// Paint/focus/press literals follow the public passive Rhea contract; no
// Button, synthetic activation, or page-specific paint is installed here.
for (const emphasis of ['primary', 'secondary', 'minimal', 'link'] as const) {
  it(`Shadcn community ${emphasis}: real Rhea Surface/Text retires feedback without replacing the anchor`, async () => {
    const link = document.createElement('a');
    link.href = 'https://github.com/Proto-UI/Proto-UI';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', 'GitHub community');
    const surface = new Constructors.shadcn();
    const text = new Texts.shadcn();
    appendSiteLinkGlyph(text, 'github');
    const glyph = text.querySelector('svg');
    surface.append(text);
    link.append(surface);
    document.body.append(link);
    const idle = { hovered: false, pressed: false, focusVisible: false, current: false };
    for (const facts of [
      idle,
      { ...idle, hovered: true },
      { ...idle, focusVisible: true },
      { ...idle, pressed: true },
      idle,
    ]) {
      setElementProps(surface, {
        ...linkSurfaceProps('shadcn', 'icon', emphasis, facts),
        surfaceStyle: linkSurfaceLayout('shadcn', 'icon', emphasis, facts),
      });
      setElementProps(text, linkTextProps('icon', facts, 'shadcn'));
      surface.update();
      text.update();
      await settle();
      const tokens = new Set((surface.getAttribute('data-pui-style') ?? '').split(/\s+/));
      for (const token of [
        'rounded-[var(--pui-radius-2xl)]',
        'border',
        'bg-clip-padding',
        'transition-all',
      ])
        expect(tokens.has(token)).toBe(true);
      expect(tokens.has('rounded-lg')).toBe(false);
      expect(tokens.has('rounded-[var(--pui-radius-4xl)]')).toBe(false);
      expect(tokens.has('ring-3')).toBe(facts.focusVisible);
      expect(tokens.has('ring-ring/30')).toBe(facts.focusVisible);
      expect(tokens.has('ring-2')).toBe(false);
      expect(tokens.has('translate-y-px')).toBe(facts.pressed);
      expect(tokens.has('shadow-none')).toBe(false);
      const hoverToken =
        emphasis === 'primary'
          ? 'bg-primary/80'
          : emphasis === 'secondary'
            ? 'bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]'
            : 'bg-muted';
      expect(tokens.has(hoverToken)).toBe(facts.hovered);
      const ink = new Set((text.getAttribute('data-pui-style') ?? '').split(/\s+/));
      expect(ink.has('leading-5')).toBe(true);
      expect(ink.has('font-medium')).toBe(true);
      expect(ink.has('font-semibold')).toBe(false);
      expect(surface.style.width).toBe('2.75rem');
      expect(surface.style.height).toBe('2.75rem');
      expect(surface.style.padding).toBe('0px');
      expect(surface.style.marginBottom).toBe('1px');
      expect(surface.style.pointerEvents).toBe('none');
      for (const passive of [surface, text]) {
        expect(passive.hasAttribute('role')).toBe(false);
        expect(passive.hasAttribute('tabindex')).toBe(false);
        expect(passive.getExposes()).toEqual({});
      }
      expect(link.firstElementChild).toBe(surface);
      expect(text.querySelector('svg')).toBe(glyph);
      expect(glyph?.getAttribute('aria-hidden')).toBe('true');
      expect(glyph?.querySelector('path')?.getAttribute('d')).toBeTruthy();
      expect(link.getAttribute('href')).toBe('https://github.com/Proto-UI/Proto-UI');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.getAttribute('aria-label')).toBe('GitHub community');
      expect(link.hasAttribute('role')).toBe(false);
      expect(link.hasAttribute('tabindex')).toBe(false);
      link.focus();
      expect(document.activeElement).toBe(link);
    }
  });
}

it('ordinary public Shadcn Surface omission still has no Rhea action feedback', async () => {
  const surface = new Constructors.shadcn();
  document.body.append(surface);
  for (const active of [false, true, false]) {
    setElementProps(surface, { hovered: active, pressed: active, focusVisible: active });
    surface.update();
    await settle();
    const tokens = new Set((surface.getAttribute('data-pui-style') ?? '').split(/\s+/));
    expect(tokens.has('rounded-xl')).toBe(true);
    expect(tokens.has('ring-2')).toBe(active);
    expect(tokens.has('ring-3')).toBe(false);
    expect(tokens.has('translate-y-px')).toBe(false);
    expect(tokens.has('rounded-[var(--pui-radius-2xl)]')).toBe(false);
    expect(surface.hasAttribute('role')).toBe(false);
    expect(surface.hasAttribute('tabindex')).toBe(false);
    expect(surface.getExposes()).toEqual({});
  }
});

for (const family of ['shadcn', 'brutalist'] as const)
  for (const appearance of [
    'action',
    'icon',
    'nav',
    'text',
    'brand',
    'nav-group',
    'sidebar',
    'toc',
    'pagination',
  ] as SiteLinkAppearance[])
    it(`${family} ${appearance}: public Surface/Text composition preserves native ownership and exact motion envelope`, async () => {
      for (const emphasis of ['primary', 'secondary', 'minimal', 'link'] as SiteLinkEmphasis[]) {
        const link = document.createElement('a');
        link.href = '/native-destination/';
        link.target = '_blank';
        link.rel = 'noreferrer';
        const surface = new Constructors[family]();
        const text = new Texts[family]();
        const source = document.createTextNode('Original text');
        text.append(source);
        surface.append(text);
        link.append(surface);
        document.body.append(link);
        const layout = linkSurfaceLayout(family, appearance, emphasis);
        const raised =
          family === 'brutalist' &&
          (['brand', 'nav'].includes(appearance) ||
            (['action', 'icon', 'pagination'].includes(appearance) &&
              ['primary', 'secondary'].includes(emphasis)));
        for (const facts of [
          { hovered: false, pressed: false, focusVisible: false, current: false },
          { hovered: true, pressed: true, focusVisible: true, current: true },
          { hovered: false, pressed: false, focusVisible: false, current: false },
        ]) {
          setElementProps(surface, {
            ...linkSurfaceProps(family, appearance, emphasis, facts),
            surfaceStyle: layout,
          });
          surface.update();
          setElementProps(text, { ...linkTextProps(appearance, facts, family) });
          text.update();
          await settle();
          expect(surface.style.pointerEvents).toBe('none');
          expect(surface.style.marginBottom).toBe(raised ? '0.25rem' : '1px');
          expect(surface.style.marginRight).toBe(
            raised ? '0.25rem' : family === 'brutalist' && appearance === 'action' ? '0px' : ''
          );
          expect(surface.hasAttribute('role')).toBe(false);
          expect(surface.hasAttribute('tabindex')).toBe(false);
          expect(surface.getExposes()).toEqual({});
          expect(text.contains(source)).toBe(true);
          expect(link.textContent).toBe('Original text');
          const tokens = surface.getAttribute('data-pui-style')!;
          if (raised && emphasis === 'secondary') {
            expect(tokens).toContain('bg-secondary-background');
            expect(tokens).not.toContain('bg-muted');
          }
          expect(getElementProps(surface)?.pressed).toBe(facts.pressed);
          const shadcnAction = family === 'shadcn' && ['action', 'icon'].includes(appearance);
          if (family === 'shadcn' && !shadcnAction) {
            expect(tokens).not.toContain('translate-y-px');
            expect(tokens).not.toContain('shadow-none');
          } else if (!raised && facts.pressed) expect(tokens).toContain('translate-y-px');
          const focusToken = shadcnAction ? 'ring-3' : 'ring-2';
          expect(tokens.includes(focusToken)).toBe(facts.focusVisible);
          if (raised)
            expect(tokens).toContain(facts.pressed ? 'translate-y-1' : 'shadow-[4px_4px_0_0_#000]');
          else if (family === 'brutalist') expect(tokens).not.toContain('shadow-');
          expect(text.getAttribute('data-pui-style')).toContain(
            appearance === 'action' || (family === 'shadcn' && appearance === 'icon')
              ? 'font-medium'
              : family === 'shadcn' && (appearance === 'sidebar' || appearance === 'toc')
                ? facts.current
                  ? 'font-medium'
                  : 'font-normal'
                : facts.current ||
                    appearance === 'brand' ||
                    (family === 'brutalist' && appearance === 'nav-group')
                  ? 'font-semibold'
                  : 'font-medium'
          );
          link.focus();
          expect(document.activeElement).toBe(link);
          expect(link.getAttribute('href')).toBe('/native-destination/');
          expect(link.getAttribute('target')).toBe('_blank');
          expect(link.getAttribute('rel')).toBe('noreferrer');
        }
        link.remove();
      }
    });
it('keeps brand glyph content stable across public Surface feedback changes', async () => {
  for (const icon of ['github', 'discord', 'x', 'bluesky'] as const) {
    const surface = new Constructors.brutalist();
    const slot = document.createElement('span');
    appendSiteLinkGlyph(slot, icon);
    surface.append(slot);
    document.body.append(surface);
    const svg = slot.querySelector('svg');
    setElementProps(surface, {
      ...linkSurfaceProps('brutalist', 'icon', 'secondary', {
        hovered: true,
        pressed: true,
        focusVisible: false,
        current: false,
      }),
    });
    surface.update();
    await settle();
    expect(slot.querySelector('svg')).toBe(svg);
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.querySelector('path')?.getAttribute('d')).toBeTruthy();
  }
});
