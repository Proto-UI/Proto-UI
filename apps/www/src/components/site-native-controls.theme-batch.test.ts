import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initSiteNativeControls } from './site-native-controls';
const theme = vi.hoisted(() => ({ color: '#222222', read: vi.fn() }));
vi.mock('./PrototypePreviewer/projection-theme', () => ({
  resolveProjectionThemeSurfaceStyle: (...args: unknown[]) => theme.read(...args),
}));
const releases: Array<() => void> = [];
const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
beforeEach(() => {
  theme.color = '#222222';
  theme.read.mockReset().mockImplementation(() => ({ '--pui-foreground': theme.color }));
  document.body.innerHTML =
    '<div class="sidebar-pane"><ul class="top-level"><li><details><summary>Group</summary><a href="/a/">A</a><a href="/b/">B</a></details></li></ul></div>';
});
afterEach(() => {
  for (const release of releases.splice(0)) release();
  document.body.replaceChildren();
  document.documentElement.removeAttribute('class');
  document.documentElement.removeAttribute('style');
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.siteLibraryFamily;
  vi.restoreAllMocks();
});
function assertColor(color: string) {
  const surfaces = document.querySelectorAll<HTMLElement>(
    'wc-site-shadcn-surface,wc-site-shadcn-text,wc-site-brutalist-surface,wc-site-brutalist-text'
  );
  expect(surfaces.length).toBe(6);
  for (const surface of surfaces)
    expect(surface.style.getPropertyValue('--pui-foreground')).toBe(color);
}
it('reads once at initialization and at most twice for a shared interaction burst', async () => {
  releases.push(initSiteNativeControls());
  await settle();
  expect(theme.read).toHaveBeenCalledTimes(1);
  assertColor('#222222');
  const duplicate = initSiteNativeControls();
  duplicate();
  expect(theme.read).toHaveBeenCalledTimes(1);
  for (const link of document.querySelectorAll('a,summary')) {
    link.dispatchEvent(new Event('pointerenter'));
    link.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }));
    link.dispatchEvent(new Event('pointerleave'));
  }
  await settle();
  expect(theme.read).toHaveBeenCalledTimes(3);
});
it('refreshes implicit stylesheet inputs on the next interaction without broadcasting an unchanged palette', async () => {
  releases.push(initSiteNativeControls());
  await settle();
  const [first, second] = [...document.querySelectorAll('a')];
  const untouched = document.querySelector('summary wc-site-shadcn-surface')!;
  const mutations: MutationRecord[] = [];
  const observer = new MutationObserver((records) => mutations.push(...records));
  observer.observe(untouched, { attributes: true, attributeFilter: ['style'] });
  first.dispatchEvent(new Event('pointerenter'));
  second.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }));
  await settle();
  expect(theme.read).toHaveBeenCalledTimes(3);
  expect(mutations).toHaveLength(0);
  theme.color = '#0000ff'; // External stylesheet/CSSOM update, no root attribute event.
  first.dispatchEvent(new Event('pointerleave'));
  second.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  await settle();
  expect(theme.read).toHaveBeenCalledTimes(5);
  assertColor('#0000ff');
  expect(mutations.length).toBeGreaterThan(0);
  observer.disconnect();
});
it('ignores interactions outside its targets and stops sampling after release', async () => {
  const release = initSiteNativeControls();
  releases.push(release);
  await settle();
  document.body.dispatchEvent(new Event('pointerenter'));
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
  await settle();
  expect(theme.read).toHaveBeenCalledTimes(1);
  const link = document.querySelector('a')!;
  release();
  link.dispatchEvent(new Event('pointerenter'));
  await settle();
  expect(theme.read).toHaveBeenCalledTimes(1);
});
it('reads once and broadcasts the latest root class/theme/style/family input, preserving native owners', async () => {
  const summary = document.querySelector('summary')!;
  const link = document.querySelector('a')!;
  releases.push(initSiteNativeControls());
  await settle();
  for (const [attribute, value, color] of [
    ['class', 'dark', '#eeeeee'],
    ['data-theme', 'light', '#111111'],
    ['style', '--external-theme-input: 1', '#cc0000'],
    ['data-site-library-family', 'brutalist', '#00cc00'],
    ['data-site-library-family', 'shadcn', '#0000cc'],
  ]) {
    const previousReads = theme.read.mock.calls.length;
    theme.color = color;
    document.documentElement.setAttribute(attribute, value);
    await settle();
    expect(theme.read).toHaveBeenCalledTimes(previousReads + 1);
    assertColor(color);
    expect(document.querySelector('summary')).toBe(summary);
    expect(document.querySelector('a')).toBe(link);
  }
});
it('releases the batch watcher and resolves a fresh page snapshot on reconnect', async () => {
  const source = document.querySelector('a')!.firstChild;
  const release = initSiteNativeControls();
  releases.push(release);
  await settle();
  release();
  const reads = theme.read.mock.calls.length;
  theme.color = '#abcdef';
  document.documentElement.style.setProperty('--external-theme-input', 'new-page');
  await settle();
  expect(theme.read).toHaveBeenCalledTimes(reads);
  expect(document.querySelector('a')!.firstChild).toBe(source);
  releases.push(initSiteNativeControls());
  await settle();
  expect(theme.read).toHaveBeenCalledTimes(reads + 1);
  assertColor('#abcdef');
});

it('suppresses duplicate closed-theme broadcasts without losing root input observation', async () => {
  releases.push(initSiteNativeControls());
  await settle();
  const mutations: MutationRecord[] = [];
  const surface = document.querySelector('wc-site-shadcn-surface')!;
  const observer = new MutationObserver((records) => mutations.push(...records));
  observer.observe(surface, { attributes: true, attributeFilter: ['style'] });
  document.documentElement.classList.add('unrelated-layout-state');
  await settle();
  expect(theme.read).toHaveBeenCalledTimes(2);
  expect(mutations).toHaveLength(0);
  assertColor('#222222');
  observer.disconnect();
});

it('broadcasts a live color-scheme change once and releases its media listener', async () => {
  const media = Object.assign(new EventTarget(), { matches: false });
  vi.spyOn(window, 'matchMedia').mockReturnValue(media as MediaQueryList);
  const release = initSiteNativeControls();
  releases.push(release);
  await settle();
  theme.color = '#eeeeee';
  media.matches = true;
  media.dispatchEvent(new Event('change'));
  await settle();
  expect(theme.read).toHaveBeenCalledTimes(2);
  assertColor('#eeeeee');
  release();
  media.dispatchEvent(new Event('change'));
  await settle();
  expect(theme.read).toHaveBeenCalledTimes(2);
});

it.each(['pointerup', 'blur'])(
  'samples CSSOM changes on window %s facts without per-owner reads',
  async (event) => {
    releases.push(initSiteNativeControls());
    await settle();
    for (const link of document.querySelectorAll('a,summary'))
      link.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }));
    await settle();
    for (const surface of document.querySelectorAll('wc-site-shadcn-surface'))
      expect(surface.getAttribute('data-pui-style')?.split(/\s+/)).toContain('translate-y-px');
    const reads = theme.read.mock.calls.length;
    theme.color = '#fedcba';
    window.dispatchEvent(new Event(event));
    await settle();
    expect(theme.read).toHaveBeenCalledTimes(reads + 2);
    assertColor('#fedcba');
    for (const surface of document.querySelectorAll('wc-site-shadcn-surface'))
      expect(surface.getAttribute('data-pui-style')?.split(/\s+/)).not.toContain('translate-y-px');
  }
);

it('keeps next-current-fact CSSOM sampling and the child reading-specific text feedback', async () => {
  releases.push(initSiteNativeControls());
  await settle();
  theme.color = '#123abc';
  const link = document.querySelector('a')!;
  const tokens = () =>
    link.querySelector('wc-site-shadcn-text')!.getAttribute('data-pui-style')?.split(/\s+/);
  expect(tokens()).toContain('font-normal');
  link.setAttribute('aria-current', 'page');
  await settle();
  expect(theme.read).toHaveBeenCalledTimes(2);
  assertColor('#123abc');
  expect(tokens()).toContain('font-medium');
  expect(tokens()).not.toContain('font-normal');
  expect(tokens()).not.toContain('font-semibold');
});

it('settles a CSSOM palette change between two synchronous native fact publications', async () => {
  releases.push(initSiteNativeControls());
  await settle();
  const [first, second] = [...document.querySelectorAll('a')];
  first.dispatchEvent(new Event('pointerenter'));
  theme.color = '#ff0000'; // No root attribute event; both facts occur in the same task.
  second.focus();
  await settle();
  expect(document.activeElement).toBe(second);
  assertColor('#ff0000');
});

it('resamples later microtask facts and preserves the final per-owner interaction order', async () => {
  releases.push(initSiteNativeControls());
  await settle();
  const [first, second] = [...document.querySelectorAll('a')];
  first.dispatchEvent(new Event('pointerenter'));
  first.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }));
  theme.color = '#ff0000';
  first.dispatchEvent(new Event('pointercancel'));
  queueMicrotask(() => {
    theme.color = '#0000ff';
    second.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }));
  });
  await settle();
  assertColor('#0000ff');
  expect(
    first.querySelector('wc-site-shadcn-surface')!.getAttribute('data-pui-style')?.split(/\s+/)
  ).not.toContain('translate-y-px');
  expect(
    second.querySelector('wc-site-shadcn-surface')!.getAttribute('data-pui-style')?.split(/\s+/)
  ).toContain('translate-y-px');
});

it('cancels a dirty trailing sample when its batch is released before the microtask', async () => {
  const release = initSiteNativeControls();
  releases.push(release);
  await settle();
  const [first, second] = [...document.querySelectorAll('a')];
  const retiredSurfaces = [first.firstChild, second.firstChild];
  first.dispatchEvent(new Event('pointerenter'));
  theme.color = '#ff0000';
  second.dispatchEvent(new Event('focus'));
  const reads = theme.read.mock.calls.length;
  release();
  await settle();
  expect(theme.read).toHaveBeenCalledTimes(reads);
  expect(document.querySelector('[data-site-link-content]')).toBeNull();
  expect(retiredSurfaces.every((surface) => !surface!.isConnected)).toBe(true);
});

it('rebuilds the actual family even when its injected closed palette is identical', async () => {
  const links = [...document.querySelectorAll('a')];
  const content = links.map((link) => link.firstChild);
  releases.push(initSiteNativeControls());
  await settle();
  for (const family of ['brutalist', 'shadcn']) {
    document.documentElement.dataset.siteLibraryFamily = family;
    await settle();
    expect(document.querySelectorAll(`wc-site-${family}-surface`)).toHaveLength(3);
    assertColor('#222222');
    for (const [index, link] of links.entries()) {
      expect(link.querySelector(`wc-site-${family}-text`)!.firstChild).toBe(content[index]);
      expect(link.getAttribute('href')).toBe(`/${String.fromCharCode(97 + index)}/`);
    }
  }
});

it('isolates successive batches and cancels old queued work on immediate release/reinitialization', async () => {
  const firstRelease = initSiteNativeControls();
  firstRelease();
  theme.color = '#abcdef';
  const secondRelease = initSiteNativeControls();
  releases.push(secondRelease);
  await settle();
  expect(theme.read).toHaveBeenCalledTimes(2);
  assertColor('#abcdef');
  firstRelease();
  assertColor('#abcdef');
  secondRelease();
  expect(document.querySelectorAll('[data-site-link-content]')).toHaveLength(0);
  theme.color = '#fedcba';
  document.documentElement.classList.add('dark');
  window.dispatchEvent(new Event('blur'));
  await settle();
  expect(theme.read).toHaveBeenCalledTimes(2);
});
