import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { collectProtoStyleTokens } from '../../../../packages/cli/src/services/prototype-style-tokens';
import { renderProtoStyleTokenCss } from '../../../../packages/cli/src/services/proto-style-css';
import SiteLinkSurface from './site-link-surface.proto';
const Constructor = AdaptToWebComponent(SiteLinkSurface, { registerAs: 'test-site-link-surface' });
const settle = async () => {
  for (let index = 0; index < 12; index++) await Promise.resolve();
};
afterEach(() => document.body.replaceChildren());
describe('app-owned passive link surface', () => {
  it.each(['action', 'icon', 'nav', 'text', 'brand'])(
    'keeps the %s surface passive for every family',
    async (appearance) => {
      for (const family of ['shadcn', 'brutalist']) {
        const surface = new Constructor();
        setElementProps(surface, { family, appearance });
        document.body.append(surface);
        await settle();
        expect(surface.getAttribute('data-pui-style')?.split(/\s+/)).toContain(
          'pointer-events-none'
        );
        expect(surface.hasAttribute('role')).toBe(false);
        expect(surface.hasAttribute('tabindex')).toBe(false);
        expect(surface.getExposes()).toEqual({});
      }
    }
  );
  it('leaves the stable native anchor as hit owner while visual props rebuild decoration', async () => {
    const link = document.createElement('a');
    link.href = '/native-destination/';
    link.target = '_blank';
    link.rel = 'noreferrer';
    const surface = new Constructor();
    const props = { family: 'brutalist', appearance: 'icon', icon: 'github' };
    setElementProps(surface, props);
    link.append(surface);
    document.body.append(link);
    await settle();
    const originalGlyph = surface.querySelector('svg')!;
    link.focus();
    const update = (facts: Record<string, unknown>) => {
      setElementProps(surface, { ...props, ...facts });
      surface.update();
    };
    update({ hovered: true, pressed: true });
    await settle();
    // Actual WC behavior: decoration is replaced on a visual-only update.
    // Native activation therefore must never depend on the glyph being the
    // pointer target. This does not pretend Happy DOM performs hit testing.
    expect(surface.querySelector('svg')).not.toBe(originalGlyph);
    expect(originalGlyph.isConnected).toBe(false);
    expect(link.firstElementChild).toBe(surface);
    expect(document.activeElement).toBe(link);
    const tokens = surface.getAttribute('data-pui-style')!.split(/\s+/);
    expect(tokens).toEqual(
      expect.arrayContaining(['translate-x-1', 'translate-y-1', 'shadow-none'])
    );
    expect(tokens).toContain('pointer-events-none');
    expect(renderProtoStyleTokenCss(['pointer-events-none'])).toContain('pointer-events: none;');
    expect(link.getAttribute('href')).toBe('/native-destination/');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noreferrer');
    expect(surface.hasAttribute('role')).toBe(false);
    expect(surface.hasAttribute('tabindex')).toBe(false);
  });
  it.each(['shadcn', 'brutalist'] as const)(
    'reserves %s body-motion space without moving pointer ownership or changing feedback',
    async (family) => {
      for (const appearance of [
        'action',
        'icon',
        'pagination',
        'nav',
        'text',
        'brand',
        'sidebar',
        'toc',
      ]) {
        for (const emphasis of ['primary', 'secondary', 'minimal', 'link']) {
          const framed =
            family === 'brutalist' &&
            ['action', 'icon', 'pagination'].includes(appearance) &&
            ['primary', 'secondary'].includes(emphasis);
          const surface = new Constructor();
          const props = { family, appearance, emphasis };
          setElementProps(surface, props);
          document.body.append(surface);
          await settle();
          const idle = surface.getAttribute('data-pui-style')!.split(/\s+/);
          expect(idle).toContain(framed ? 'mb-1' : 'mb-px');
          expect(idle.includes('mr-1')).toBe(framed);
          expect(idle).not.toContain(framed ? 'mb-px' : 'mb-1');
          for (const feedback of [{ hovered: true }, { pressed: true }, { focusVisible: true }]) {
            setElementProps(surface, { ...props, ...feedback });
            surface.update();
            await settle();
            const tokens = surface.getAttribute('data-pui-style')!.split(/\s+/);
            expect(tokens).toContain(framed ? 'mb-1' : 'mb-px');
            expect(tokens.includes('mr-1')).toBe(framed);
            expect(tokens).toContain('pointer-events-none');
            expect(surface.hasAttribute('tabindex')).toBe(false);
            if ('pressed' in feedback)
              expect(tokens).toContain(framed ? 'translate-y-1' : 'translate-y-px');
          }
          surface.remove();
        }
      }
    }
  );

  it('compiles every website token and leaves text wrapping unforced', async () => {
    const collected = await collectProtoStyleTokens(
      fileURLToPath(new NodeURL('.', import.meta.url))
    );
    const tokens = collected.filter((token): token is string => typeof token === 'string');
    expect(tokens).toHaveLength(collected.length);
    expect(renderProtoStyleTokenCss(tokens)).not.toContain('Unsupported Proto UI style tokens');
    const element = new Constructor();
    setElementProps(element, { appearance: 'text' });
    document.body.append(element);
    await settle();
    expect(element.getAttribute('data-pui-style')).not.toContain('whitespace-nowrap');
    for (const appearance of ['action', 'icon', 'nav', 'brand']) {
      setElementProps(element, { appearance });
      (element as HTMLElement & { update?(): void }).update?.();
      await settle();
      expect(element.getAttribute('data-pui-style')).toContain('whitespace-nowrap');
    }
  });
  it('uses one family visual contract for all four social glyphs without adding control semantics', async () => {
    for (const icon of ['github', 'discord', 'x', 'bluesky']) {
      const element = new Constructor();
      setElementProps(element, { family: 'brutalist', appearance: 'icon', icon });
      document.body.append(element);
      await settle();
      const tokens = element.getAttribute('data-pui-style')!;
      for (const token of [
        'size-11',
        'border-2',
        'border-black',
        'rounded-base',
        'font-sans',
        'font-medium',
      ])
        expect(tokens).toContain(token);
      expect(element.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      expect(element.querySelector('path')?.getAttribute('d')).toBeTruthy();
      expect(element.hasAttribute('role')).toBe(false);
      expect(element.hasAttribute('tabindex')).toBe(false);
      expect(element.getExposes()).toEqual({});
    }
  });
  it('responds to controlled focus and press facts without any event or focus API', async () => {
    const element = new Constructor();
    document.body.append(element);
    const update = async (facts: Record<string, unknown>) => {
      setElementProps(element, {
        family: 'shadcn',
        appearance: 'action',
        emphasis: 'primary',
        ...facts,
      });
      (element as HTMLElement & { update?(): void }).update?.();
      await settle();
    };
    await update({ focusVisible: true, pressed: true });
    expect(element.getAttribute('data-pui-style')).toContain('ring-2');
    expect(element.getAttribute('data-pui-style')).toContain('translate-y-px');
    await update({ focusVisible: false, pressed: false });
    expect(element.getAttribute('data-pui-style')).not.toContain('ring-2');
    expect(element.getAttribute('data-pui-style')).not.toContain('translate-y-px');
    expect(element.getExposes()).toEqual({});
  });
});

it.each(['action', 'icon', 'pagination'])(
  'applies canonical Brutalist elevation only to framed %s links',
  async (appearance) => {
    const surface = new Constructor();
    document.body.append(surface);
    const update = async (facts: Record<string, unknown> = {}) => {
      setElementProps(surface, {
        family: 'brutalist',
        appearance,
        emphasis: 'secondary',
        ...facts,
      });
      surface.update();
      await settle();
      return surface.getAttribute('data-pui-style')!.split(/\s+/);
    };
    const resting = await update();
    expect(resting).toEqual(
      expect.arrayContaining(['rounded-base', 'border-black', 'shadow-[4px_4px_0_0_#000]'])
    );
    for (const facts of [{ hovered: true }, { hovered: true, pressed: true }, { pressed: true }]) {
      const active = await update(facts);
      expect(active).toEqual(
        expect.arrayContaining(['translate-x-1', 'translate-y-1', 'shadow-none'])
      );
      expect(active).not.toContain('translate-y-px');
      expect(active).not.toContain('bg-main');
    }
    expect(await update()).toEqual(resting);
    for (const emphasis of ['minimal', 'link']) {
      const flat = await update({ emphasis, hovered: true });
      expect(flat).not.toContain('border-black');
      expect(
        flat.some((token) => token.startsWith('shadow-') || token.startsWith('translate-'))
      ).toBe(false);
    }
  }
);
it.each(['nav', 'text', 'brand', 'sidebar', 'toc'])(
  'does not apply control elevation to Brutalist %s navigation',
  async (appearance) => {
    const surface = new Constructor();
    setElementProps(surface, { family: 'brutalist', appearance, hovered: true });
    document.body.append(surface);
    await settle();
    const tokens = surface.getAttribute('data-pui-style')!.split(/\s+/);
    expect(
      tokens.some((token) => token.startsWith('shadow-') || token.startsWith('translate-'))
    ).toBe(false);
    expect(tokens).not.toContain('border-2');
    expect(tokens).toContain('pointer-events-none');
  }
);

it.each(['action', 'icon', 'nav', 'text', 'brand', 'sidebar', 'toc', 'pagination'])(
  'owns Brutalist %s typography without overriding brand or current emphasis',
  async (appearance) => {
    const surface = new Constructor();
    document.body.append(surface);
    const update = async (family: string, current = false) => {
      setElementProps(surface, { family, appearance, current });
      surface.update();
      await settle();
      return surface.getAttribute('data-pui-style')!.split(/\s+/);
    };
    const resting = await update('brutalist');
    expect(resting).toContain('font-sans');
    expect(resting).toContain(appearance === 'brand' ? 'font-semibold' : 'font-medium');
    expect(await update('brutalist', true)).toEqual(
      expect.arrayContaining(['font-sans', 'font-semibold'])
    );
    expect(await update('shadcn')).not.toContain('font-sans');
    expect(renderProtoStyleTokenCss(['font-sans'])).toContain(
      'font-family: var(--pui-font-sans, ui-sans-serif, system-ui, sans-serif)'
    );
  }
);
