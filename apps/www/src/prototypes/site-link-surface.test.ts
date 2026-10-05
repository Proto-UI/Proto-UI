import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
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
          expect(surface.style.marginRight).toBe(raised ? '0.25rem' : '');
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
          if (!raised && facts.pressed) expect(tokens).toContain('translate-y-px');
          expect(tokens.includes('ring-2')).toBe(facts.focusVisible);
          if (raised)
            expect(tokens).toContain(facts.pressed ? 'translate-y-1' : 'shadow-[4px_4px_0_0_#000]');
          else if (family === 'brutalist') expect(tokens).not.toContain('shadow-');
          expect(text.getAttribute('data-pui-style')).toContain(
            family === 'shadcn' && (appearance === 'sidebar' || appearance === 'toc')
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
