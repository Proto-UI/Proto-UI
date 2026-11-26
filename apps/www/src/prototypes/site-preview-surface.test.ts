import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import ShadcnSurface from '@proto.ui/prototypes-shadcn/surface';
import BrutalistSurface from '@proto.ui/prototypes-brutalist/surface';
import { panelSurfaceProps } from '../components/surface-recipes';
const constructors = {
  shadcn: AdaptToWebComponent(ShadcnSurface),
  brutalist: AdaptToWebComponent(BrutalistSurface),
};
afterEach(() => document.body.replaceChildren());
for (const family of ['shadcn', 'brutalist'] as const)
  it(`${family}: generic Surface composes passive card, popup and canvas without universal elevation`, async () => {
    const surface = new constructors[family]();
    const p = document.createElement('p');
    p.textContent = 'Actual example result';
    surface.append(p);
    document.body.append(surface);
    for (const appearance of ['card', 'popup', 'canvas', 'card'] as const) {
      setElementProps(surface, { ...panelSurfaceProps(appearance) });
      surface.update();
      for (let i = 0; i < 12; i++) await Promise.resolve();
      const tokens = surface.getAttribute('data-pui-style')!;
      expect(tokens).toContain(family === 'shadcn' ? 'rounded-xl' : 'rounded-base');
      expect(tokens.includes('shadow-')).toBe(appearance === 'card');
      expect(tokens).toContain('border-border');
      expect(surface.contains(p)).toBe(true);
      expect(p.textContent).toBe('Actual example result');
      expect(surface.hasAttribute('role')).toBe(false);
      expect(surface.hasAttribute('tabindex')).toBe(false);
      expect(surface.getExposes()).toEqual({});
    }
  });
