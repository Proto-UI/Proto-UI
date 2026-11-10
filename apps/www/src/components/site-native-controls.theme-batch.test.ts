import { getElementProps } from '@proto.ui/adapter-web-component';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    for (const surface of document.querySelectorAll<HTMLElement>('wc-site-shadcn-surface')) {
      expect(getElementProps(surface)?.pressed).toBe(true);
      expect(surface.getAttribute('data-pui-style')?.split(/\s+/)).not.toContain('translate-y-px');
    }
    const reads = theme.read.mock.calls.length;
    theme.color = '#fedcba';
    window.dispatchEvent(new Event(event));
    await settle();
    expect(theme.read).toHaveBeenCalledTimes(reads + 2);
    assertColor('#fedcba');
    for (const surface of document.querySelectorAll<HTMLElement>('wc-site-shadcn-surface')) {
      expect(getElementProps(surface)?.pressed).toBe(false);
      expect(surface.getAttribute('data-pui-style')?.split(/\s+/)).not.toContain('translate-y-px');
    }
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
  ).not.toContain('translate-y-px');
  expect(
    getElementProps(first.querySelector<HTMLElement>('wc-site-shadcn-surface')!)?.pressed
  ).toBe(false);
  expect(
    getElementProps(second.querySelector<HTMLElement>('wc-site-shadcn-surface')!)?.pressed
  ).toBe(true);
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

describe('progressive native decoration', () => {
  // Control only task delivery around real native owners and public WCs.
  // These fixtures do not measure browser idle time or native responsiveness.
  function idleTasks() {
    let id = 0;
    const pending = new Map<number, () => void>();
    vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
      const next = ++id;
      pending.set(next, () => callback({ didTimeout: false, timeRemaining: () => 50 }));
      return next;
    });
    vi.stubGlobal('cancelIdleCallback', (task: number) => pending.delete(task));
    const retainNext = () => {
      const callback = pending.values().next().value;
      if (!callback) throw new Error('No pending native decoration task');
      return callback;
    };
    const next = () => {
      const entry = pending.entries().next().value;
      if (!entry) throw new Error('No pending native decoration task');
      pending.delete(entry[0]);
      entry[1]();
    };
    return {
      next,
      retainNext,
      drain() {
        for (let remaining = 100; pending.size; remaining--) {
          if (!remaining) throw new Error('Native decoration did not finish');
          next();
        }
      },
    };
  }
  afterEach(() => {
    // Release with the same task API that admitted this batch.
    for (const release of releases.splice(0)) release();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('keeps all SSR navigation usable between complete owner moves and decorates the whole population', () => {
    const tasks = idleTasks();
    const owners = [...document.querySelectorAll<HTMLElement>('summary,a')];
    const content = owners.map((owner) => [...owner.childNodes]);
    const summary = document.querySelector('summary')!;
    const details = document.querySelector('details')!;
    const initiallyOpen = details.open;
    const range = document.createElement('div');
    range.dataset.siteTocHighlight = '';
    document.body.append(range);
    const release = initSiteNativeControls(document, { progressive: true });
    releases.push(release);
    expect(document.querySelector('[data-site-link-enhanced]')).toBeNull();
    for (const [index, owner] of owners.entries())
      expect([...owner.childNodes]).toEqual(content[index]);
    expect(details.open).toBe(initiallyOpen);
    summary.click();
    expect(details.open).toBe(!initiallyOpen);
    const link = document.querySelector('a')!;
    link.focus();
    tasks.next();
    expect(range.querySelector('wc-site-shadcn-surface')).not.toBeNull();
    expect(document.querySelector('[data-site-link-enhanced]')).toBeNull();
    tasks.next();
    expect(document.querySelectorAll('[data-site-link-enhanced]')).toHaveLength(1);
    expect(details.open).toBe(!initiallyOpen);
    summary.click();
    expect(details.open).toBe(initiallyOpen);
    tasks.drain();
    expect(document.querySelectorAll('[data-site-link-enhanced]')).toHaveLength(owners.length);
    expect(document.activeElement).toBe(link);
    for (const [index, owner] of owners.entries()) {
      expect(owner.querySelectorAll('[data-site-link-content]')).toHaveLength(1);
      expect(content[index].every((node) => owner.contains(node))).toBe(true);
    }
    expect(link.getAttribute('href')).toBe('/a/');
    release();
    for (const [index, owner] of owners.entries())
      expect([...owner.childNodes]).toEqual(content[index]);
    expect(range.children).toHaveLength(0);
    expect(document.activeElement).toBe(link);
    expect(details.open).toBe(initiallyOpen);
  });

  it('retains pending native facts and samples the current family and CSSOM palette before each move', async () => {
    const tasks = idleTasks();
    releases.push(initSiteNativeControls(document, { progressive: true }));
    tasks.next();
    const link = document.querySelector('a')!;
    const source = link.firstChild;
    link.setAttribute('aria-current', 'page');
    link.dispatchEvent(new Event('pointerenter'));
    link.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }));
    link.focus();
    theme.color = '#123abc'; // CSSOM input with no root mutation notification.
    document.documentElement.dataset.siteLibraryFamily = 'brutalist';
    tasks.next();
    await settle();
    const surface = link.querySelector<HTMLElement>('wc-site-brutalist-surface')!;
    expect(getElementProps(surface)).toMatchObject({ hovered: true, pressed: true, current: true });
    expect(link.contains(source)).toBe(true);
    expect(document.activeElement).toBe(link);
    theme.color = '#abcdef';
    tasks.drain();
    await settle();
    expect(document.querySelectorAll('wc-site-brutalist-surface')).toHaveLength(3);
    expect(document.querySelector('wc-site-shadcn-surface')).toBeNull();
    assertColor('#abcdef');
  });

  it.each(['before the first move', 'after one move'])(
    'releases pending ownership %s and ignores a canceled task after reinitialization',
    (when) => {
      const tasks = idleTasks();
      const owners = [...document.querySelectorAll<HTMLElement>('summary,a')];
      const content = owners.map((owner) => [...owner.childNodes]);
      const release = initSiteNativeControls(document, { progressive: true });
      releases.push(release);
      const duplicate = initSiteNativeControls();
      duplicate();
      if (when === 'after one move') tasks.next();
      const canceled = tasks.retainNext();
      release();
      for (const [index, owner] of owners.entries())
        expect([...owner.childNodes]).toEqual(content[index]);
      document.documentElement.dataset.siteLibraryFamily = 'brutalist';
      theme.color = '#abcdef';
      releases.push(initSiteNativeControls(document, { progressive: true }));
      canceled(); // Deliberate late-delivery injection, after actual cancellation.
      tasks.drain();
      release();
      expect(document.querySelectorAll('wc-site-brutalist-surface')).toHaveLength(3);
      expect(document.querySelector('wc-site-shadcn-surface')).toBeNull();
      assertColor('#abcdef');
      for (const [index, owner] of owners.entries())
        expect(content[index].every((node) => owner.contains(node))).toBe(true);
    }
  );

  it('releases a detached pending owner so its original node can be initialized after reinsertion', () => {
    const tasks = idleTasks();
    const link = document.querySelector('a')!;
    const parent = link.parentElement!;
    const source = link.firstChild;
    releases.push(initSiteNativeControls(document, { progressive: true }));
    link.remove();
    tasks.drain();
    expect(link.querySelector('[data-site-link-content]')).toBeNull();
    expect(document.querySelectorAll('[data-site-link-content]')).toHaveLength(2);
    parent.append(link);
    releases.push(initSiteNativeControls());
    expect(document.querySelectorAll('[data-site-link-content]')).toHaveLength(3);
    expect(link.contains(source)).toBe(true);
  });

  it('captures a Selection created synchronously by the preceding owner connection', () => {
    const tasks = idleTasks();
    const summary = document.querySelector('summary')!;
    const link = document.querySelector('a')!;
    const source = link.firstChild!;
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    // Preserve the existing HappyDOM15 getter boundary; this is not native
    // directionality evidence. Both real owner moves still execute.
    vi.spyOn(selection, 'focusOffset', 'get').mockReturnValue(1);
    const restore = vi.spyOn(selection, 'setBaseAndExtent');
    const append = summary.append.bind(summary);
    vi.spyOn(summary, 'append').mockImplementation((...nodes) => {
      append(...nodes);
      selection.setBaseAndExtent(link, 0, link, 1);
    });
    releases.push(initSiteNativeControls(document, { progressive: true }));
    tasks.next();
    expect(selection.anchorNode).toBe(link);
    tasks.next();
    expect(restore).toHaveBeenLastCalledWith(source.parentNode, 0, source.parentNode, 1);
    expect(selection.anchorNode).toBe(source.parentNode);
    expect(link.contains(source)).toBe(true);
    tasks.drain();
  });

  it('cannot resume a retired first move after synchronous cancellation and replacement initialization', async () => {
    const tasks = idleTasks();
    const summary = document.querySelector('summary')!;
    const source = summary.firstChild;
    const append = summary.append.bind(summary);
    let release = () => {};
    let reenter = true;
    let retired: Node | undefined;
    vi.spyOn(summary, 'append').mockImplementation((...nodes) => {
      append(...nodes); // Actual public WC connection precedes the injected reentry.
      if (!reenter) return;
      reenter = false;
      retired = summary.firstChild!;
      initSiteNativeControls()(); // A duplicate must not acquire queued siblings.
      release();
      releases.push(initSiteNativeControls(document, { progressive: true }));
    });
    release = initSiteNativeControls(document, { progressive: true });
    releases.push(release);
    tasks.next();
    tasks.drain();
    await settle();
    expect(retired?.isConnected).toBe(false);
    expect(document.querySelectorAll('[data-site-link-content]')).toHaveLength(3);
    expect(summary.querySelectorAll('[data-site-link-content]')).toHaveLength(1);
    expect(summary.contains(source)).toBe(true);
    release();
    expect(document.querySelectorAll('[data-site-link-content]')).toHaveLength(3);
  });

  it.each([false, true])(
    'completes or cancels the timer fallback without idle APIs: cancel=%s',
    async (cancel) => {
      vi.stubGlobal('requestIdleCallback', undefined);
      vi.stubGlobal('cancelIdleCallback', undefined);
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const owners = [...document.querySelectorAll<HTMLElement>('summary,a')];
      const content = owners.map((owner) => [...owner.childNodes]);
      const release = initSiteNativeControls(document, { progressive: true });
      releases.push(release);
      expect(document.querySelector('[data-site-link-content]')).toBeNull();
      if (cancel) release();
      await vi.runAllTimersAsync();
      expect(document.querySelectorAll('[data-site-link-content]')).toHaveLength(cancel ? 0 : 3);
      release();
      await vi.runAllTimersAsync();
      for (const [index, owner] of owners.entries())
        expect([...owner.childNodes]).toEqual(content[index]);
    }
  );
});
