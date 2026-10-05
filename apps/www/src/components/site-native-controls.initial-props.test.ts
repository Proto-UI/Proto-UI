import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initSiteNativeControls } from './site-native-controls';
import { WEBSITE_SHADCN_THEME_TOKENS } from './PrototypePreviewer/projection-theme';

const probe = vi.hoisted(() => ({
  raw: [] as Array<{ host: HTMLElement; connected: boolean; props: Record<string, unknown> }>,
  initial: [] as Array<{ host: HTMLElement; props: Record<string, unknown> }>,
  updates: [] as HTMLElement[],
  events: [] as Array<{ host: HTMLElement; type: string }>,
  normalizations: [] as HTMLElement[],
  styleOwners: new WeakMap<object, HTMLElement>(),
}));
vi.mock('../../../../packages/adapters/web-component/src/props', async (original) => {
  const actual =
    await original<typeof import('../../../../packages/adapters/web-component/src/props')>();
  return {
    ...actual,
    setElementProps(host: HTMLElement, props: Record<string, unknown>) {
      probe.raw.push({ host, connected: host.isConnected, props });
      if (props.surfaceStyle && typeof props.surfaceStyle === 'object')
        probe.styleOwners.set(props.surfaceStyle, host);
      return actual.setElementProps(host, props);
    },
  };
});
vi.mock('../../../../packages/adapters/web-component/src/runtime/session', async (original) => {
  const actual =
    await original<
      typeof import('../../../../packages/adapters/web-component/src/runtime/session')
    >();
  return {
    ...actual,
    createWebComponentHostSession(
      args: Parameters<typeof actual.createWebComponentHostSession>[0]
    ) {
      probe.initial.push({ host: args.host, props: { ...args.rawPropsSource.get() } });
      const session = actual.createWebComponentHostSession({
        ...args,
        onLifecycleEvent(event) {
          probe.events.push({ host: args.host, type: event.type });
          args.onLifecycleEvent?.(event);
        },
      });
      const update = session.controller.update.bind(session.controller);
      session.controller.update = () => {
        probe.updates.push(args.host);
        return update();
      };
      return session;
    },
  };
});
const releases: Array<() => void> = [];
let writes: Array<{ style: CSSStyleDeclaration; property: string }> = [];
const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let index = 0; index < 12; index++) await Promise.resolve();
};
type Visual = HTMLElement & { setProps?: (props: Record<string, unknown>) => void };
const visuals = () => [
  ...document.querySelectorAll<Visual>('[data-site-link-content],[data-site-link-text]'),
];
function metrics(host: HTMLElement) {
  return {
    raw: probe.raw.filter((entry) => entry.host === host).length,
    controllerUpdates: probe.updates.filter((entry) => entry === host).length,
    normalizations: probe.normalizations.filter((entry) => entry === host).length,
    foregroundWrites: writes.filter(
      (entry) => entry.style === host.style && entry.property === '--pui-foreground'
    ).length,
    minWidthWrites: writes.filter(
      (entry) => entry.style === host.style && entry.property === 'min-width'
    ).length,
    mounts: probe.events.filter((entry) => entry.host === host && entry.type === 'mount.render')
      .length,
    renders: probe.events.filter((entry) => entry.host === host && entry.type === 'update.render')
      .length,
  };
}
beforeEach(() => {
  for (const key of ['raw', 'initial', 'updates', 'events', 'normalizations'] as const)
    probe[key].length = 0;
  probe.styleOwners = new WeakMap();
  writes = [];
  for (const token of WEBSITE_SHADCN_THEME_TOKENS)
    document.documentElement.style.setProperty(`--pui-${token}`, '#222222');
  document.body.innerHTML =
    '<a data-site-native-link data-site-link-appearance="nav" href="/docs/" aria-current="page"><span>Docs</span></a>';
  const entries = Object.entries;
  vi.spyOn(Object, 'entries').mockImplementation((value) => {
    const host = value && typeof value === 'object' ? probe.styleOwners.get(value) : undefined;
    if (host) probe.normalizations.push(host);
    return entries(value);
  });
  const setProperty = CSSStyleDeclaration.prototype.setProperty;
  vi.spyOn(CSSStyleDeclaration.prototype, 'setProperty').mockImplementation(function (
    this: CSSStyleDeclaration,
    name,
    value,
    priority
  ) {
    writes.push({ style: this, property: name });
    return setProperty.call(this, name, value, priority);
  });
});
afterEach(async () => {
  for (const release of releases.splice(0)) release();
  document.body.replaceChildren();
  document.documentElement.removeAttribute('style');
  delete document.documentElement.dataset.siteLibraryFamily;
  await settle();
  vi.restoreAllMocks();
});

it.each(['first registration', 'already registered'])(
  'mounts complete initial props with no replay: %s',
  async (registration) => {
    if (registration === 'already registered')
      initSiteNativeControls(document.createElement('div'))();
    expect(!!customElements.get('wc-site-shadcn-surface')).toBe(
      registration === 'already registered'
    );
    const link = document.querySelector('a')!;
    const source = link.firstChild;
    releases.push(initSiteNativeControls());
    const nodes = visuals();
    const setters = nodes.map((node) => vi.spyOn(node, 'setProps'));
    await settle();
    console.info(
      'initial-owner-cost',
      nodes.map((node) => ({ tag: node.localName, ...metrics(node) }))
    );
    expect(probe.initial.find((entry) => entry.host === nodes[0])!.props).toMatchObject({
      variant: 'transparent',
      radius: 'none',
    });
    expect(probe.initial.find((entry) => entry.host === nodes[1])!.props).toMatchObject({
      weight: 'semibold',
      decoration: 'underline',
    });
    for (const [index, node] of nodes.entries()) {
      expect(
        probe.raw.filter((entry) => entry.host === node).every((entry) => !entry.connected)
      ).toBe(true);
      expect(metrics(node)).toMatchObject({
        raw: 1,
        normalizations: 1,
        foregroundWrites: 1,
        mounts: 1,
        controllerUpdates: 0,
        renders: 0,
      });
      expect(setters[index]).not.toHaveBeenCalled();
      expect(node.style.getPropertyValue('--pui-foreground')).toBe('#222222');
    }
    expect(link.querySelector('span')).toBe(source);
    expect(nodes[1].getAttribute('data-pui-style')?.split(/\s+/)).toContain('underline');
  }
);

it('uses one public update per existing atom and retains pressed/current facts', async () => {
  releases.push(initSiteNativeControls());
  await settle();
  const link = document.querySelector('a')!;
  const nodes = visuals();
  const setters = nodes.map((node) => vi.spyOn(node, 'setProps'));
  const before = nodes.map(metrics);
  link.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }));
  await settle();
  console.info(
    'pressed-owner-cost',
    nodes.map((node, index) => ({ before: before[index], after: metrics(node) }))
  );
  for (const [index, node] of nodes.entries()) {
    expect(setters[index]).toHaveBeenCalledTimes(1);
    expect(metrics(node).raw - before[index].raw).toBe(1);
    expect(metrics(node).normalizations - before[index].normalizations).toBe(1);
    // This child already deduplicates equal live custom properties.
    expect(metrics(node).foregroundWrites - before[index].foregroundWrites).toBe(0);
    expect(metrics(node).minWidthWrites - before[index].minWidthWrites).toBe(1);
    expect(node.style.getPropertyValue('--pui-foreground')).toBe('#222222');
    expect(metrics(node).controllerUpdates - before[index].controllerUpdates).toBe(1);
  }
  expect(nodes[0].getAttribute('data-pui-style')?.split(/\s+/)).toContain('translate-y-px');
  expect(nodes[1].getAttribute('data-pui-style')?.split(/\s+/)).toContain('underline');
  const beforeThemeChange = nodes.map(metrics);
  document.documentElement.style.setProperty('--pui-foreground', '#ff0000');
  await settle();
  for (const [index, node] of nodes.entries()) {
    expect(metrics(node).foregroundWrites - beforeThemeChange[index].foregroundWrites).toBe(1);
    expect(node.style.getPropertyValue('--pui-foreground')).toBe('#ff0000');
    expect(setters[index]).toHaveBeenCalledTimes(2);
  }
});

it('prepares a fresh family with the current pressed facts before connection', async () => {
  releases.push(initSiteNativeControls());
  await settle();
  const link = document.querySelector('a')!;
  const source = link.querySelector('span');
  link.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }));
  document.documentElement.dataset.siteLibraryFamily = 'brutalist';
  await settle();
  const nodes = visuals();
  console.info(
    'replacement-owner-cost',
    nodes.map((node) => ({ tag: node.localName, ...metrics(node) }))
  );
  expect(nodes.every((node) => node.localName.includes('brutalist'))).toBe(true);
  expect(probe.initial.find((entry) => entry.host === nodes[0])!.props).toMatchObject({
    pressed: true,
    variant: 'secondary',
    radius: 'default',
    border: 'all',
    elevation: 'raised',
  });
  for (const node of nodes) {
    expect(metrics(node)).toMatchObject({
      raw: 1,
      normalizations: 1,
      foregroundWrites: 1,
      mounts: 1,
      controllerUpdates: 0,
      renders: 0,
    });
    expect(
      probe.raw.filter((entry) => entry.host === node).every((entry) => !entry.connected)
    ).toBe(true);
  }
  expect(link.querySelector('span')).toBe(source);
});

it('replays only the latest facts when the public method becomes available in the microtask', async () => {
  releases.push(initSiteNativeControls());
  await settle();
  const link = document.querySelector('a')!;
  const surface = visuals()[0];
  const realSetter = surface.setProps!.bind(surface);
  // This is a delayed-method exposure injection on a real mounted WC, not a
  // claim that ordinary registered elements upgrade asynchronously.
  delete surface.setProps;
  link.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }));
  link.dispatchEvent(new Event('pointercancel'));
  const replay = vi.fn(realSetter);
  surface.setProps = replay;
  await settle();
  expect(replay).toHaveBeenCalledTimes(1);
  expect(replay.mock.calls[0][0].pressed).toBe(false);
  expect(surface.getAttribute('data-pui-style')?.split(/\s+/)).not.toContain('translate-y-px');
});

it('cancels pending method replay when a new family has replaced the old surface', async () => {
  const media = Object.assign(new EventTarget(), { matches: false });
  vi.spyOn(window, 'matchMedia').mockReturnValue(media as MediaQueryList);
  releases.push(initSiteNativeControls());
  await settle();
  const link = document.querySelector('a')!;
  const old = visuals()[0];
  const realSetter = old.setProps!.bind(old);
  delete old.setProps;
  link.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }));
  document.documentElement.dataset.siteLibraryFamily = 'brutalist';
  // The existing media path broadcasts synchronously, before the old replay.
  media.dispatchEvent(new Event('change'));
  const replay = vi.fn(realSetter);
  old.setProps = replay;
  await settle();
  expect(replay).not.toHaveBeenCalled();
  expect(old.isConnected).toBe(false);
  expect(visuals()[0].localName).toBe('wc-site-brutalist-surface');
  expect(probe.initial.find((entry) => entry.host === visuals()[0])!.props.pressed).toBe(true);
});

it('cancels missing-method replay across release and immediate reinitialization', async () => {
  const source = document.querySelector('a')!.firstChild;
  const release = initSiteNativeControls();
  await settle();
  const old = visuals()[0];
  const realSetter = old.setProps!.bind(old);
  delete old.setProps;
  document.querySelector('a')!.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }));
  release();
  const replay = vi.fn(realSetter);
  old.setProps = replay;
  releases.push(initSiteNativeControls());
  await settle();
  expect(replay).not.toHaveBeenCalled();
  expect(visuals()[0]).not.toBe(old);
  expect(document.querySelector('a span')).toBe(source);
  expect(visuals()[0].getAttribute('data-pui-style')?.split(/\s+/)).not.toContain('translate-y-px');
});

it.each(['forward', 'backward'])(
  'preserves native focus and forwards injected %s Selection through initial/family publication and release',
  async (direction) => {
    const link = document.querySelector('a')!;
    const source = link.querySelector('span')!.firstChild!;
    link.focus();
    const selection = document.getSelection()!;
    const anchor = direction === 'forward' ? 1 : 3;
    const focus = direction === 'forward' ? 3 : 1;
    selection.setBaseAndExtent(source, anchor, source, focus);
    // Happy DOM 15 aliases focusOffset to anchorOffset (also documented by the
    // existing lease suite). Inject only that getter and verify the actual
    // forwarded call; native browser directional Selection remains CI evidence.
    vi.spyOn(selection, 'focusOffset', 'get').mockReturnValue(focus);
    const restore = vi.spyOn(selection, 'setBaseAndExtent');
    const check = () => {
      expect(document.activeElement).toBe(link);
      expect(selection.anchorNode).toBe(source);
      expect(selection.focusNode).toBe(source);
      expect(selection.anchorOffset).toBe(anchor);
      expect(restore).toHaveBeenLastCalledWith(source, anchor, source, focus);
      expect(link.getAttribute('href')).toBe('/docs/');
    };
    const release = initSiteNativeControls();
    releases.push(release);
    check();
    for (const family of ['brutalist', 'shadcn']) {
      document.documentElement.dataset.siteLibraryFamily = family;
      await settle();
      check();
    }
    release();
    await settle();
    check();
    expect(link.querySelector('[data-site-link-content]')).toBeNull();
  }
);

it.each(['new facts', 'new family', 'release'])(
  'stops a synchronous stale props batch after setter reentry: %s',
  async (reentry) => {
    const media = Object.assign(new EventTarget(), { matches: false });
    vi.spyOn(window, 'matchMedia').mockReturnValue(media as MediaQueryList);
    const link = document.querySelector('a')!;
    link.removeAttribute('aria-current');
    const source = link.firstChild;
    const release = initSiteNativeControls();
    releases.push(release);
    await settle();
    const [surface, text] = visuals();
    const before = metrics(text).raw;
    const setter = surface.setProps!.bind(surface);
    let reenter = true;
    surface.setProps = (props) => {
      setter(props); // Real public setter/controller/render is never replaced.
      if (!reenter) return;
      reenter = false;
      if (reentry === 'new facts') link.dispatchEvent(new Event('pointerleave'));
      else if (reentry === 'new family') {
        document.documentElement.dataset.siteLibraryFamily = 'brutalist';
        media.dispatchEvent(new Event('change'));
      } else release();
    };
    link.dispatchEvent(new Event('pointerenter'));
    await settle();
    // New facts/cleanup may legitimately write once to the old Text. The
    // superseded outer hover batch must never add another old Text write.
    expect(metrics(text).raw - before).toBe(reentry === 'new family' ? 0 : 1);
    expect(link.querySelector('span')).toBe(source);
    if (reentry === 'new facts')
      expect(text.getAttribute('data-pui-style')?.split(/\s+/)).not.toContain('underline');
    else if (reentry === 'new family') {
      expect(surface.isConnected).toBe(false);
      expect(
        link.querySelector('wc-site-brutalist-text')!.getAttribute('data-pui-style')?.split(/\s+/)
      ).toContain('underline');
    } else {
      expect(visuals()).toHaveLength(0);
      expect(link.firstChild).toBe(source);
    }
  }
);
