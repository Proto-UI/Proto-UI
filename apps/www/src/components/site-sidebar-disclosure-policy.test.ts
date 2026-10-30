import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, expect, it, vi } from 'vitest';
import {
  collapsedSidebar,
  sidebarManagedGroups,
  legacySidebarHash,
  sidebarDisclosureLease,
  sidebarGroupIdentities,
  sidebarHasCurrentManualIntent,
} from './site-sidebar-disclosure-policy';
import { initSidebarCurrentVisibility } from './site-sidebar-current-visibility';
const key = 'proto-ui.sidebar.manual.v1';
const rawBootstrap = readFileSync(
  new URL('./site-sidebar-disclosure-bootstrap.js', import.meta.url),
  'utf8'
);
// Execute the exact authored resource in a test-only VM, not a serialized
// bundler function. The production path injects this unchanged resource via ?raw.
function bootstrap(root: HTMLElement, identities: string[], managed = identities.map(() => true)) {
  const script = document.createElement('script');
  script.dataset.sidebarIdentities = JSON.stringify(identities);
  script.dataset.sidebarManaged = JSON.stringify(managed);
  root.append(script);
  vi.spyOn(document, 'currentScript', 'get').mockReturnValue(script);
  runInNewContext(rawBootstrap, { document });
  return sidebarDisclosureLease(root)!.dispose;
}

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});
function fixture() {
  document.body.innerHTML =
    '<nav class="docs-sidebar"><div data-site-sidebar-policy><ul class="top-level"><li><details open><sl-sidebar-restore data-index="0"></sl-sidebar-restore><summary>Current</summary><a aria-current="page" href="/en/current/">Current</a></details></li><li><details><sl-sidebar-restore data-index="1"></sl-sidebar-restore><summary>Other</summary><a href="/en/other/">Other</a></details></li></ul></div></nav>';
  const root = document.querySelector<HTMLElement>('[data-site-sidebar-policy]')!;
  return { root, groups: [...root.querySelectorAll('details')] };
}
it('collapses unrelated SSR groups without changing link payload or authored badges', () => {
  const entries = [
    {
      type: 'group' as const,
      collapsed: false,
      label: 'Group',
      entries: [
        {
          type: 'link' as const,
          href: '/en/ui-libraries/base/',
          isCurrent: true,
          badge: { text: 'WIP' },
        },
      ],
    },
  ];
  const next = collapsedSidebar(entries, ['en']);
  expect(next[0]!.collapsed).toBe(true);
  expect(entries[0]!.collapsed).toBe(false);
  expect(next[0]!.entries[0]).toEqual(entries[0]!.entries[0]);
});
it('restores valid history but current ancestry wins on route entry only', async () => {
  const { root, groups } = fixture();
  localStorage.setItem(
    key,
    JSON.stringify({ version: 1, open: { current: false, other: true, deleted: true } })
  );
  dispose = bootstrap(root, ['current', 'other']);
  expect(groups.map((x) => x.open)).toEqual([true, true]);
  groups[0]!.open = false;
  expect(bootstrap(root, ['current', 'other'])).toBe(dispose);
  document.dispatchEvent(new Event('astro:page-load'));
  await Promise.resolve();
  expect(groups[0]!.open).toBe(false);
  expect(JSON.parse(localStorage.getItem(key)!).open.current).toBe(false);
});
it.each([
  '{',
  'null',
  '{"version":2,"open":{}}',
  '{"version":1,"open":[]}',
  '{"version":1,"open":{"other":"true"}}',
  'x'.repeat(65_537),
])('rejects malformed/versioned/oversize history without destroying it', (raw) => {
  const { root, groups } = fixture();
  localStorage.setItem(key, raw);
  dispose = bootstrap(root, ['current', 'other']);
  expect(groups.map((x) => x.open)).toEqual([true, false]);
  expect(localStorage.getItem(key)).toBe(raw);
});
it('denied storage is nonfatal and preserves usable native defaults', () => {
  const { root, groups } = fixture();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('denied');
  });
  dispose = bootstrap(root, ['current', 'other']);
  expect(groups.map((x) => x.open)).toEqual([true, false]);
});
it('never persists synthetic clicks or programmatic details changes', async () => {
  const { root, groups } = fixture();
  const write = vi.spyOn(Storage.prototype, 'setItem');
  dispose = bootstrap(root, ['current', 'other']);
  groups[1]!.querySelector('summary')!.click();
  groups[1]!.open = true;
  groups[1]!.dispatchEvent(new Event('toggle'));
  await Promise.resolve();
  expect(write).not.toHaveBeenCalled();
});
it('rejects duplicate/mismatched identities rather than sharing one stored row', () => {
  const { root } = fixture();
  expect(() => bootstrap(root, ['same', 'same'])).toThrow();
  expect(() => bootstrap(root, ['one'])).toThrow();
});
it('disposes route and bfcache listeners without stale reactivation', () => {
  const { root, groups } = fixture();
  dispose = bootstrap(root, ['current', 'other']);
  dispose();
  dispose();
  groups[0]!.open = false;
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  expect(groups[0]!.open).toBe(false);
});
it('loads the sole original raw bootstrap with only document supplied', () => {
  const { root, groups } = fixture();
  dispose = bootstrap(root, ['current', 'other']);
  expect(groups.map((x) => x.open)).toEqual([true, false]);
  expect(sidebarDisclosureLease(root)?.readIntent()).toBe('none');
  expect(rawBootstrap).not.toMatch(/\b(?:import|export)\s|new\s+Function\s*\(|\beval\s*\(/);
});
it('normalizes locale and reorder, invalidates changed anchor routes and rejects collisions', () => {
  const group = (href: string) => ({
    type: 'group' as const,
    entries: [{ type: 'link' as const, href }],
  });
  expect(
    sidebarGroupIdentities([group('/en/base/'), group('/en/other/')], ['en', 'zh-cn'])
  ).toEqual(
    sidebarGroupIdentities([group('/zh-cn/base/'), group('/zh-cn/other/')], ['en', 'zh-cn'])
  );
  expect(sidebarGroupIdentities([group('/en/other/'), group('/en/base/')], ['en'])).toEqual(
    sidebarGroupIdentities([group('/en/base/'), group('/en/other/')], ['en']).reverse()
  );
  expect(sidebarGroupIdentities([group('/en/new/')], ['en'])).not.toEqual(
    sidebarGroupIdentities([group('/en/old/')], ['en'])
  );
  expect(() => sidebarGroupIdentities([group('/en/base/'), group('/en/base/')], ['en'])).toThrow(
    'Duplicate'
  );
});
// Active regression gate: the visibility owner must yield to the real policy
// lease before opening current ancestors, including before module initialization.
it('does not let later visibility initialization reopen a current-epoch manual closure', () => {
  const { root, groups } = fixture();
  dispose = bootstrap(root, ['current', 'other']);
  groups[0]!.open = false;
  Object.assign(sidebarDisclosureLease(root)!, { readIntent: () => 'manual' as const });
  const release = initSidebarCurrentVisibility(root.closest<HTMLElement>('.docs-sidebar')!);
  try {
    expect(groups[0]!.open).toBe(false);
  } finally {
    release();
  }
});

it('only a live current-route manual intent yields layout arbitration', () => {
  const { root } = fixture();
  dispose = bootstrap(root, ['current', 'other']);
  expect(sidebarHasCurrentManualIntent(root)).toBe(false);
  Object.assign(sidebarDisclosureLease(root)!, { readIntent: () => 'manual' as const });
  expect(sidebarHasCurrentManualIntent(root)).toBe(true);
  root.dataset.siteSidebarPolicyRoute = '/stale';
  expect(sidebarHasCurrentManualIntent(root)).toBe(false);
  root.dataset.siteSidebarPolicyRoute = location.pathname;
  dispose();
  expect(sidebarHasCurrentManualIntent(root)).toBe(false);
});

// These unit cases model the event/default-action boundary explicitly; only the
// browser journey proves genuine trusted keyboard activation.
function capturedClick(root: HTMLElement, managed = [true, true]) {
  const spy = vi.spyOn(root, 'addEventListener');
  dispose = bootstrap(root, ['current', 'other'], managed);
  const callback = spy.mock.calls.find(([type]) => type === 'click')?.[1];
  if (typeof callback !== 'function') throw new Error('Native click listener missing');
  return (event: Pick<MouseEvent, 'target' | 'defaultPrevented' | 'isTrusted'>) =>
    callback.call(root, event as MouseEvent);
}
it('canceled trusted activation is pending only before cancellation and never manual or stored', async () => {
  const { root, groups } = fixture();
  const click = capturedClick(root);
  const event = {
    target: groups[0]!.querySelector('summary'),
    isTrusted: true,
    defaultPrevented: false,
  };
  click(event);
  const lease = sidebarDisclosureLease(root)!;
  expect(lease.readIntent()).toBe('pending');
  const settled = vi.fn();
  lease.afterSettled(settled);
  event.defaultPrevented = true;
  expect(lease.readIntent()).toBe('none');
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  expect(settled).toHaveBeenCalledOnce();
  expect(lease.readIntent()).toBe('none');
  expect(localStorage.getItem(key)).toBeNull();
  expect(groups[0]!.open).toBe(true);
});
it('committed default closure wins before persistence task and cannot be revived after disposal', async () => {
  const { root, groups } = fixture();
  const click = capturedClick(root);
  click({ target: groups[0]!.querySelector('summary'), isTrusted: true, defaultPrevented: false });
  const lease = sidebarDisclosureLease(root)!;
  const settled = vi.fn();
  lease.afterSettled(settled);
  groups[0]!.open = false; // Modeled native default action, never product mutation.
  expect(lease.readIntent()).toBe('manual');
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  expect(JSON.parse(localStorage.getItem(key)!).open.current).toBe(false);
  expect(settled).toHaveBeenCalledOnce();
  expect(sidebarHasCurrentManualIntent(root)).toBe(true);
  dispose!();
  expect(lease.readIntent()).toBe('none');
  expect(sidebarDisclosureLease(root)).toBeUndefined();
});
it('unsubscribes pending observers and cancels event tasks at owner retirement', async () => {
  const { root, groups } = fixture();
  const click = capturedClick(root);
  click({ target: groups[0]!.querySelector('summary'), isTrusted: true, defaultPrevented: false });
  const lease = sidebarDisclosureLease(root)!;
  const canceled = vi.fn();
  lease.afterSettled(canceled)();
  const retired = vi.fn();
  lease.afterSettled(retired);
  dispose!();
  groups[0]!.open = false;
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  expect(canceled).not.toHaveBeenCalled();
  expect(retired).toHaveBeenCalledTimes(1);
  expect(retired).toHaveBeenCalledWith('retired');
  expect(localStorage.getItem(key)).toBeNull();
});

it('limits collapse/local persistence scope to canonical UI Library subtrees, not translated labels', () => {
  const group = (label: string, href: string, collapsed: boolean) => ({
    type: 'group' as const,
    label,
    collapsed,
    entries: [{ type: 'link' as const, href }],
  });
  const entries = [
    group('UI Libraries', '/en/whitepaper/intro/', false),
    group('任意标签', '/en/ui-libraries/base/', false),
    group('Already closed', '/en/start-here/', true),
  ];
  expect(sidebarManagedGroups(entries, ['en'])).toEqual([false, true, false]);
  expect(collapsedSidebar(entries, ['en']).map((x) => x.collapsed)).toEqual([false, true, true]);
  expect(entries.map((x) => x.collapsed)).toEqual([false, false, true]);
  expect(sidebarManagedGroups([{ type: 'group', entries }], ['en'])).toEqual([
    false,
    false,
    true,
    false,
  ]);
});
it.each([
  [[], '0000000'],
  [
    [{ type: 'group', label: 'G', entries: [{ type: 'link', label: 'Hello', href: '/en/a/' }] }],
    '02k30eo',
  ],
  [
    [
      {
        type: 'group',
        label: '组',
        entries: [{ type: 'link', label: '按钮', href: '/zh-cn/ui-libraries/base/button/' }],
      },
    ],
    '03vdhk3',
  ],
  [[{ type: 'link', label: '😀', href: '/en/emoji/' }], '0v22wir'],
] as const)(
  'retains the pinned Starlight UTF-16 session hash compatibility vector',
  (entries, expected) => {
    expect(legacySidebarHash(entries as unknown as Parameters<typeof legacySidebarHash>[0])).toBe(
      expected
    );
  }
);
it.each([true, false])(
  'restores only non-UI old session indices on desktop=%s and never writes a second legacy record',
  (desktop) => {
    const { root, groups } = fixture();
    root.dataset.hash = 'matching';
    groups[1]!.open = true;
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: desktop } as MediaQueryList);
    sessionStorage.setItem(
      'sl-sidebar-state',
      JSON.stringify({ hash: 'matching', open: [false, false], scroll: 0 })
    );
    const write = vi.spyOn(Storage.prototype, 'setItem');
    dispose = bootstrap(root, ['current', 'other'], [true, false]);
    expect(groups[0]!.open).toBe(true); // UI ignores legacy false, current entry wins.
    expect(groups[1]!.open).toBe(!desktop);
    expect(write).not.toHaveBeenCalled();
  }
);
it.each(['different-hash', 'malformed', 'denied'])(
  'preserves non-UI native state when legacy session is %s',
  (failure) => {
    const { root, groups } = fixture();
    root.dataset.hash = 'matching';
    groups[1]!.open = true;
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    sessionStorage.setItem(
      'sl-sidebar-state',
      failure === 'malformed' ? '{' : JSON.stringify({ hash: 'other', open: [false, false] })
    );
    if (failure === 'denied')
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage denied');
      });
    dispose = bootstrap(root, ['current', 'other'], [true, false]);
    expect(groups[1]!.open).toBe(true);
  }
);
it('does not claim non-UI clicks or put non-UI identifiers in the new local history', async () => {
  const { root, groups } = fixture();
  const click = capturedClick(root, [true, false]);
  click({ target: groups[1]!.querySelector('summary'), isTrusted: true, defaultPrevented: false });
  groups[1]!.open = true;
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  expect(sidebarDisclosureLease(root)!.readIntent()).toBe('none');
  expect(localStorage.getItem(key)).toBeNull();
});
it.each(['route', 'pageshow'] as const)(
  'settles a pending observer after %s epoch reset without losing it or rewriting non-UI state',
  async (action) => {
    const { root, groups } = fixture();
    const click = capturedClick(root, [true, false]);
    groups[1]!.open = true;
    click({
      target: groups[0]!.querySelector('summary'),
      isTrusted: true,
      defaultPrevented: false,
    });
    const lease = sidebarDisclosureLease(root)!;
    const settled = vi.fn();
    lease.afterSettled(settled);
    const previousPath = location.pathname;
    try {
      if (action === 'route') {
        history.replaceState(null, '', '/next-policy-route/');
        document.dispatchEvent(new Event('astro:page-load'));
      } else window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      expect(settled).toHaveBeenCalledTimes(1);
      expect(settled).toHaveBeenCalledWith('settled');
      expect(lease.readIntent()).toBe('none');
      expect(groups[1]!.open).toBe(true);
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      expect(localStorage.getItem(key)).toBeNull();
      expect(settled).toHaveBeenCalledOnce();
    } finally {
      history.replaceState(null, '', previousPath);
    }
  }
);
it('retires old pending listeners before replacement and does not let old tasks write the new owner', async () => {
  const old = fixture();
  const click = capturedClick(old.root);
  click({
    target: old.groups[0]!.querySelector('summary'),
    isTrusted: true,
    defaultPrevented: false,
  });
  const lease = sidebarDisclosureLease(old.root)!;
  const retired = vi.fn(() => expect(sidebarDisclosureLease(old.root)).toBeUndefined());
  lease.afterSettled(retired);
  dispose!();
  const next = fixture();
  dispose = bootstrap(next.root, ['current', 'other']);
  old.groups[0]!.open = false;
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  expect(retired).toHaveBeenCalledTimes(1);
  expect(retired).toHaveBeenCalledWith('retired');
  expect(next.groups[0]!.open).toBe(true);
  expect(sidebarDisclosureLease(next.root)!.readIntent()).toBe('none');
  expect(localStorage.getItem(key)).toBeNull();
});
it('retirement clears resources and notifies every waiter even when one observer throws', () => {
  const { root, groups } = fixture();
  const click = capturedClick(root);
  click({ target: groups[0]!.querySelector('summary'), isTrusted: true, defaultPrevented: false });
  const lease = sidebarDisclosureLease(root)!;
  lease.afterSettled(() => {
    throw new Error('observer failed');
  });
  const remaining = vi.fn();
  lease.afterSettled(remaining);
  expect(() => dispose!()).toThrow('Sidebar layout settlement observers failed');
  expect(remaining).toHaveBeenCalledWith('retired');
  expect(sidebarDisclosureLease(root)).toBeUndefined();
  expect(lease.readIntent()).toBe('none');
});
it('BFCache preserves non-UI live DOM rather than replaying a stale session snapshot', () => {
  const { root, groups } = fixture();
  root.dataset.hash = 'matching';
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
  sessionStorage.setItem(
    'sl-sidebar-state',
    JSON.stringify({ hash: 'matching', open: [false, false], scroll: 0 })
  );
  dispose = bootstrap(root, ['current', 'other'], [true, false]);
  expect(groups[1]!.open).toBe(false);
  groups[1]!.open = true;
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  expect(groups[1]!.open).toBe(true);
});

it('preserves pinned legacy scroll restoration even when matching history has malformed open data', () => {
  const { root, groups } = fixture();
  root.dataset.hash = 'matching';
  root.id = 'starlight__sidebar';
  groups[1]!.open = true;
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
  sessionStorage.setItem(
    'sl-sidebar-state',
    JSON.stringify({ hash: 'matching', open: null, scroll: 173 })
  );
  dispose = bootstrap(root, ['current', 'other'], [true, false]);
  expect(groups[1]!.open).toBe(true);
  expect(root.scrollTop).toBe(173);
});
