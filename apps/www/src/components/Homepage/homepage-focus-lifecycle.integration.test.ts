import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SHADCN_THEME_CSS } from '../../../../../packages/cli/src/legacy/type';
import { renderPrefixedThemeCss } from '../../../../../packages/cli/src/services/proto-style-css';
import type { ProjectionCompositionControls } from '../PrototypePreviewer/projection-composition';
import { getElementProps } from '@proto.ui/adapter-web-component';
import { createHomepageContent, initHomepageRuntime } from './homepage-runtime-client';
import * as materializer from '../PrototypePreviewer/projection-materializer';
import type { MaterializedProjectionCandidate } from '../PrototypePreviewer/projection-materializer';

// Real Homepage recipe, loader, materializer, scope controller, renderer and
// public WC Surface. Only UA :focus-visible is controlled in Happy DOM; these
// checks do not establish browser pixels, native Tab, or forced-color contrast.
const realMaterialize = materializer.materializeProjectionCandidate;
type Handle = NonNullable<ReturnType<typeof initHomepageRuntime>>;
let handle: Handle | undefined;
const candidates: MaterializedProjectionCandidate[] = [];
const releases: Array<() => void> = [];
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const tokens = (element: Element) => (element.getAttribute('data-pui-style') ?? '').split(/\s+/);

beforeEach(() => {
  localStorage.clear();
});
afterEach(async () => {
  for (const release of releases.splice(0)) release();
  await handle?.destroy();
  handle = undefined;
  for (const candidate of candidates.splice(0)) await candidate.dispose();
  document.body.replaceChildren();
  document.documentElement.removeAttribute('style');
  document.body.removeAttribute('style');
  vi.restoreAllMocks();
});

function fixture() {
  document.body.innerHTML = `<header data-homepage-runtime>
    <div id="navigation" data-homepage-actions data-homepage-controls="runtime">
      <div data-homepage-fallback>
        <a href="#brand" data-home-brand>Proto UI</a>
        <a href="#whitepaper" data-site-link-appearance="nav">Whitepaper</a>
        <a href="#start" data-site-link-appearance="action" data-home-action-variant="primary">Start</a>
        <a href="#demo" data-site-link-appearance="action" data-home-action-variant="secondary">Try Demo</a>
        <a href="#announcement" data-site-link-appearance="text">Announcement</a>
      </div><div data-homepage-mount></div>
    </div></header>`;
  const root = document.querySelector<HTMLElement>('[data-homepage-runtime]')!;
  const group = document.querySelector<HTMLElement>('#navigation')!;
  const fallback = group.querySelector<HTMLElement>('[data-homepage-fallback]')!;
  const mount = group.querySelector<HTMLElement>('[data-homepage-mount]')!;
  // Same real generated light-theme declarations as projected-previewer-shell.integration.
  // Happy DOM does not inherit custom properties through this fixture tree.
  for (const match of renderPrefixedThemeCss(SHADCN_THEME_CSS)
    .split('}')[0]!
    .matchAll(/(--pui-[\w-]+):\s*([^;]+);/g)) {
    for (const input of [document.documentElement, document.body, root, group, mount])
      input.style.setProperty(match[1]!, match[2]!);
  }
  const links = [...fallback.querySelectorAll('a')];
  return { root, group, fallback, mount, links };
}
function controlNativeFocusVisible(link: HTMLAnchorElement) {
  // Use the concrete anchor seam, like site-native-link-facts.test.ts.
  // Do not assume Happy DOM's realm subclasses inherit global Element spies.
  const original = link.matches.bind(link);
  vi.spyOn(link, 'matches').mockImplementation((selector) =>
    selector === ':focus-visible' ? document.activeElement === link : original(selector)
  );
}
function assertStaging(host: HTMLElement) {
  expect(host.isConnected).toBe(true);
  expect(host.inert).toBe(true);
  expect(host.getAttribute('aria-hidden')).toBe('true');
  expect(host.style.opacity).toBe('0');
  expect(host.dataset.projectionGenerationState).toBe('staging');
}
function assertPassiveSurface(link: HTMLAnchorElement, family: string) {
  const surface = link.querySelector<HTMLElement>(`wc-${family}-surface-root`)!;
  expect(surface).not.toBeNull();
  expect(surface.getAttribute('role')).toBeNull();
  expect(surface.hasAttribute('tabindex')).toBe(false);
  expect(link.getAttribute('role')).toBeNull();
  expect(link.hasAttribute('tabindex')).toBe(false);
  return surface;
}
function controls(): ProjectionCompositionControls {
  return {
    runtime: { label: 'Runtime', options: [{ value: 'wc', label: 'WC' }], onValueChange() {} },
    family: {
      label: 'Family',
      options: [{ value: 'shadcn', label: 'Shadcn' }],
      onValueChange() {},
    },
    component: {
      label: 'Component',
      options: [{ value: 'button', label: 'Button' }],
      onValueChange() {},
    },
  };
}
function holdNavigation() {
  let prepared: MaterializedProjectionCandidate | undefined;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  releases.push(release);
  vi.spyOn(materializer, 'materializeProjectionCandidate').mockImplementation(
    async (request, options) => {
      const candidate = await realMaterialize(request, options);
      if (options.ownerId === 'homepage-navigation') {
        prepared = candidate;
        await gate;
      }
      return candidate;
    }
  );
  return {
    get prepared() {
      return prepared;
    },
    release,
  };
}

describe('native-link enhancement reveal and failure boundaries', () => {
  for (const family of ['shadcn', 'brutalist'] as const) {
    it(`${family} prepares actual passive Surfaces while inert, then paints all five native focus owners`, async () => {
      const f = fixture();
      let active = false;
      const demo = createHomepageContent(
        {
          root: f.group,
          mount: f.mount,
          fallback: f.fallback,
          ownerId: 'native-focus',
          links: f.links,
          theme: false,
          runtime: false,
        },
        'wc',
        () => active,
        family
      );
      const candidate = await realMaterialize(
        {
          selection: { runtimeId: 'wc', projectionFamilyId: family },
          generation: 1,
        },
        {
          mount: f.mount,
          ownerId: 'native-focus',
          componentId: 'button',
          controlIds: [],
          controls: controls(),
          content: {
            demo,
            recipe: {
              id: 'native-focus',
              prototypeIds: [`${family}-surface-root`, `${family}-text-root`],
              rootPrototypeId: `${family}-surface-root`,
            },
          },
        }
      );
      candidates.push(candidate);
      assertStaging(candidate.host);
      expect(f.fallback.hidden).toBe(false);
      const links = [...candidate.host.querySelectorAll<HTMLAnchorElement>('a.home-runtime-link')];
      expect(links).toHaveLength(5);
      for (const link of links) {
        expect(link.dataset.siteLinkEnhanced).toBe('true');
        expect(getElementProps(assertPassiveSurface(link, family))?.focusVisible).toBe(false);
      }
      candidate.activate();
      active = true;
      f.fallback.hidden = true;
      for (const [index, link] of links.entries()) {
        controlNativeFocusVisible(link);
        link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        link.focus();
        await flush();
        expect(document.activeElement).toBe(link);
        expect(link.matches(':focus-visible'), 'controlled native fact').toBe(true);
        expect(link.getAttribute('href')).toBe(f.links[index].getAttribute('href'));
        const surface = assertPassiveSurface(link, family);
        expect(getElementProps(surface)?.focusVisible).toBe(true);
        expect(tokens(surface).some((token) => /^ring-\d+$/.test(token))).toBe(true);
        expect(tokens(surface)).toContain('forced-colors-focus-outline');
        expect(document.activeElement).not.toBe(surface);
        link.blur();
        await flush();
        expect(getElementProps(surface)?.focusVisible).toBe(false);
      }
    }, 20_000);
  }

  it('real partial setup failure removes enhanced anchors and retains focused unenhanced SSR', async () => {
    const f = fixture();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let observedPartial = false;
    vi.spyOn(materializer, 'materializeProjectionCandidate').mockImplementation(
      (request, options) => {
        if (options.ownerId !== 'homepage-navigation' || !options.content)
          return realMaterialize(request, options);
        const content = options.content;
        const setup = content.demo.setup;
        return realMaterialize(request, {
          ...options,
          content: {
            ...content,
            demo: {
              ...content.demo,
              setup(context) {
                const cleanup = setup?.(context);
                try {
                  const link = context.refs['home-link-0'] as HTMLAnchorElement;
                  expect(link.dataset.siteLinkEnhanced).toBe('true');
                  assertPassiveSurface(link, 'shadcn');
                  assertStaging(link.closest<HTMLElement>('[data-projection-generation-host]')!);
                  observedPartial = true;
                  throw new Error('controlled failure after real native-link setup');
                } finally {
                  if (typeof cleanup === 'function') cleanup();
                }
              },
            },
          },
        });
      }
    );
    f.links[0].focus();
    handle = initHomepageRuntime(f.root);
    await expect.poll(() => f.root.dataset.runtimeState, { timeout: 10_000 }).toBe('error');
    expect(observedPartial).toBe(true);
    expect(error.mock.calls.flat().map(String).join(' ')).toContain('controlled failure');
    expect(f.fallback.hidden).toBe(false);
    expect(document.activeElement).toBe(f.links[0]);
    expect(f.links.every((link) => !link.hasAttribute('data-site-link-enhanced'))).toBe(true);
    expect(f.mount.querySelector('[data-projection-generation-host]')).toBeNull();
  }, 20_000);

  it('initial success transfers focused SSR to the same native anchor, not to its Surface', async () => {
    const f = fixture();
    const held = holdNavigation();
    f.links[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    f.links[1].focus();
    handle = initHomepageRuntime(f.root);
    await expect.poll(() => !!held.prepared, { timeout: 10_000 }).toBe(true);
    assertStaging(held.prepared!.host);
    expect(f.fallback.hidden).toBe(false);
    expect(document.activeElement).toBe(f.links[1]);
    const preparedLink = held.prepared!.host.querySelector<HTMLAnchorElement>(
      '[data-demo-ref="home-link-1"]'
    )!;
    controlNativeFocusVisible(preparedLink);
    held.release();
    await expect.poll(() => f.root.dataset.runtimeState, { timeout: 10_000 }).toBe('ready');
    const link = f.mount.querySelector<HTMLAnchorElement>(
      '[data-projection-generation-state="active"] [data-demo-ref="home-link-1"]'
    )!;
    expect(document.activeElement).toBe(link);
    expect(link.getAttribute('href')).toBe('#whitepaper');
    const surface = assertPassiveSurface(link, 'shadcn');
    await expect.poll(() => getElementProps(surface)?.focusVisible).toBe(true);
    expect(tokens(surface)).toContain('ring-3');
    expect(tokens(surface)).toContain('forced-colors-focus-outline');
  }, 20_000);

  it('destroy during prepared-but-hidden work cannot reveal an enhanced dead generation', async () => {
    const f = fixture();
    const held = holdNavigation();
    f.links[2].focus();
    handle = initHomepageRuntime(f.root);
    await expect.poll(() => !!held.prepared, { timeout: 10_000 }).toBe(true);
    assertStaging(held.prepared!.host);
    const destroy = handle!.destroy();
    held.release();
    await destroy;
    expect(f.fallback.hidden).toBe(false);
    expect(document.activeElement).toBe(f.links[2]);
    expect(f.mount.querySelector('[data-projection-generation-host]')).toBeNull();
    expect(f.links.every((link) => !link.hasAttribute('data-site-link-enhanced'))).toBe(true);
    handle = undefined;
  }, 20_000);
});
