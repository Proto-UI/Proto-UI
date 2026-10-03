import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import SitePreviewSurface from './site-preview-surface.proto';

const Surface = AdaptToWebComponent(SitePreviewSurface, {
  registerAs: 'test-site-preview-surface',
});
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
afterEach(() => document.body.replaceChildren());

it('owns actual family tokens while leaving native content and focus semantics passive', async () => {
  const surface = new Surface();
  const content = document.createElement('p');
  content.textContent = 'Actual example result';
  surface.append(content);
  document.body.append(surface);
  await settle();
  const update = async (family: string, emphasis = 'plain') => {
    setElementProps(surface, { family, emphasis });
    surface.update();
    await settle();
    return surface.getAttribute('data-pui-style')!.split(/\s+/);
  };
  expect(await update('shadcn')).toEqual(
    expect.arrayContaining(['rounded-xl', 'border-border', 'bg-background'])
  );
  expect(await update('brutalist', 'accent')).toEqual(
    expect.arrayContaining(['rounded-base', 'border-2', 'border-black', 'bg-main'])
  );
  const plain = await update('shadcn');
  expect(plain).not.toContain('bg-main');
  expect(plain).not.toContain('rounded-base');
  expect(surface.contains(content)).toBe(true);
  expect(content.textContent).toBe('Actual example result');
  expect(surface.hasAttribute('role')).toBe(false);
  expect(surface.hasAttribute('tabindex')).toBe(false);
  expect(surface.getExposes()).toEqual({});
});

// Site roles reuse the accepted family grammar; elevation is never universal.
it.each(['shadcn', 'brutalist'] as const)(
  'switches %s card, popup and canvas paint without taking ownership',
  async (family) => {
    const surface = new Surface();
    document.body.append(surface);
    const update = async (appearance?: string) => {
      setElementProps(surface, { family, ...(appearance ? { appearance } : {}) });
      surface.update();
      await settle();
      return surface.getAttribute('data-pui-style')!.split(/\s+/);
    };
    const radius = family === 'shadcn' ? 'rounded-xl' : 'rounded-base';
    const elevation = family === 'shadcn' ? 'shadow-sm' : 'shadow-[4px_4px_0_0_#000]';
    expect(await update()).toContain(elevation);
    for (const appearance of ['popup', 'canvas', 'card', 'popup']) {
      const tokens = await update(appearance);
      expect(tokens).toContain(radius);
      expect(tokens.includes(elevation)).toBe(appearance === 'card');
      if (family === 'brutalist')
        expect(tokens).toEqual(
          expect.arrayContaining(['border-black', 'font-sans', 'font-medium'])
        );
      expect(tokens).not.toContain('rounded-none');
      expect(surface.hasAttribute('role')).toBe(false);
      expect(surface.hasAttribute('tabindex')).toBe(false);
    }
  }
);
