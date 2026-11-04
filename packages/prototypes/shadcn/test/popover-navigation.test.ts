import { afterEach, describe, expect, it, vi } from 'vitest';
import { readWebPreference, readWebStyleSupport } from '@proto.ui/adapter-base';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
} from '../../../cli/src/services/proto-style-css';
import * as popover from '../src/popover';
import * as brutalistPopover from '../../brutalist/src/popover';
import * as basePopover from '../../base/src/popover';
import type { ExposedStateHandle } from '@proto.ui/core';

// Independent public navigation presentation contract, not native geometry.
// Actual browser focus/available-space/scroll/retained-tree evidence remains separate.
const prototypes = [
  basePopover.popoverRoot,
  basePopover.popoverTrigger,
  basePopover.popoverContent,
  popover.popoverRoot,
  popover.popoverTrigger,
  popover.popoverContent,
  brutalistPopover.popoverRoot,
  brutalistPopover.popoverTrigger,
  brutalistPopover.popoverContent,
];
for (const proto of prototypes) if (!customElements.get(proto.name)) AdaptToWebComponent(proto);
const roots: HTMLElement[] = [];
const fixtureNodes: Array<{ root: HTMLElement; trigger: HTMLElement; content: HTMLElement }> = [];
const fixtureNodeFacts = () =>
  fixtureNodes.map(({ root, trigger, content }, index) => ({
    fixture: index + 1,
    root: {
      tag: root.tagName,
      connected: root.isConnected,
      parent: root.parentElement?.tagName ?? null,
    },
    trigger: {
      tag: trigger.tagName,
      connected: trigger.isConnected,
      parent: trigger.parentElement?.tagName ?? null,
    },
    content: {
      tag: content.tagName,
      connected: content.isConnected,
      parent: content.parentElement?.tagName ?? null,
    },
  }));
const flush = async () => {
  for (let i = 0; i < 25; i++) await Promise.resolve();
};
const tokens = (node: Element) =>
  (node.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
type PublicHost = HTMLElement & { getExposes(): Record<string, ExposedStateHandle<boolean>> };
function fixture(styleProfile = 'rhea') {
  const root = document.createElement(popover.popoverRoot.name) as PublicHost;
  const trigger = document.createElement(popover.popoverTrigger.name);
  const content = document.createElement(popover.popoverContent.name) as PublicHost;
  setElementProps(root, { styleProfile, defaultOpen: true, a11yLabel: 'Documentation navigation' });
  setElementProps(content, { enterDuration: 0, leaveDuration: 0 });
  trigger.textContent = 'Menu';
  content.append(document.createElement('nav'));
  root.append(trigger, content);
  document.body.append(root);
  roots.push(root);
  fixtureNodes.push({ root, trigger, content });
  return { root, trigger, content };
}
afterEach(async () => {
  try {
    const beforeRemove = { nodes: fixtureNodeFacts(), worlds: preferenceTrace() };
    for (const root of roots.splice(0)) root.remove();
    await flush();
    console.info(
      '[popover-navigation-preference-disposal]',
      JSON.stringify({
        beforeRemove,
        afterOriginalMicrotaskFlush: { nodes: fixtureNodeFacts(), worlds: preferenceTrace() },
      })
    );
    // Root owns the portalled projection. Wait for its actual automatic
    // withdrawal, not a guessed microtask count and never manual Content removal.
    await vi.waitFor(() => {
      for (const { root, content } of fixtureNodes) {
        expect(root.isConnected).toBe(false);
        expect(content.isConnected).toBe(false);
      }
    });
    console.info(
      '[popover-navigation-preference-disposal-settled]',
      JSON.stringify({ nodes: fixtureNodeFacts(), worlds: preferenceTrace() })
    );
  } finally {
    vi.restoreAllMocks();
  }
});

type QueryObservation = {
  id: number;
  query: MediaQueryList;
  listeners: Map<EventListenerOrEventListenerObject, Set<boolean>>;
  added: number;
  removed: number;
  changes: number;
};
const preferenceWorlds: Array<{
  id: number;
  state: Record<string, string>;
  queries: Map<string, QueryObservation>;
}> = [];
const preferenceTrace = () =>
  preferenceWorlds.map((world) => ({
    id: world.id,
    state: { ...world.state },
    queries: [...world.queries.entries()].map(([media, query]) => ({
      id: query.id,
      media,
      matches: query.query.matches,
      listeners: [...query.listeners.values()].reduce((sum, captures) => sum + captures.size, 0),
      added: query.added,
      removed: query.removed,
      changes: query.changes,
    })),
  }));
function preferences(support: boolean | 'unknown' = false) {
  const state: Record<string, string> = {
    'prefers-reduced-motion': 'no-preference',
    'prefers-reduced-transparency': 'no-preference',
    'forced-colors': 'none',
  };
  const queries = new Map<string, MediaQueryList>();
  const world = {
    id: preferenceWorlds.length + 1,
    state,
    queries: new Map<string, QueryObservation>(),
  };
  preferenceWorlds.push(world);
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
    if (!queries.has(query)) {
      const match = /^\(([^:]+): ([^)]+)\)$/.exec(query),
        result = new EventTarget();
      Object.defineProperties(result, {
        media: { value: query },
        matches: { get: () => !!match && state[match[1]!] === match[2] },
      });
      const observed: QueryObservation = {
        id: world.queries.size + 1,
        query: result as MediaQueryList,
        listeners: new Map(),
        added: 0,
        removed: 0,
        changes: 0,
      };
      const add = result.addEventListener.bind(result),
        remove = result.removeEventListener.bind(result);
      Object.defineProperties(result, {
        addEventListener: {
          value: (
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: boolean | AddEventListenerOptions
          ) => {
            if (type === 'change' && listener) {
              const captures = observed.listeners.get(listener) ?? new Set<boolean>();
              captures.add(typeof options === 'boolean' ? options : !!options?.capture);
              observed.listeners.set(listener, captures);
              observed.added++;
            }
            add(type, listener, options);
          },
        },
        removeEventListener: {
          value: (
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: boolean | EventListenerOptions
          ) => {
            if (type === 'change' && listener) {
              const captures = observed.listeners.get(listener);
              captures?.delete(typeof options === 'boolean' ? options : !!options?.capture);
              if (captures?.size === 0) observed.listeners.delete(listener);
              observed.removed++;
            }
            remove(type, listener, options);
          },
        },
      });
      world.queries.set(query, observed);
      queries.set(query, result as MediaQueryList);
    }
    return queries.get(query)!;
  });
  vi.spyOn(Object.getPrototypeOf(window.CSS), 'supports').mockImplementation(() => {
    if (support === 'unknown') throw new Error('Synthetic unknown support');
    return support;
  });
  return (key: string, value: string) => {
    state[key] = value;
    for (const [media, query] of queries) {
      world.queries.get(media)!.changes++;
      query.dispatchEvent(new Event('change'));
    }
  };
}

// Preserve every default profile before opting into the explicit presentation.
const profiles = ['vega', 'nova', 'maia', 'lyra', 'mira', 'luma', 'sera', 'rhea', 'new-york-v4'];
describe('public Popover navigation presentation', () => {
  it.each(profiles)(
    '%s replaces card paint and returns to its identical default without replacing public owners',
    async (profile) => {
      preferences(false);
      const f = fixture(profile);
      await flush();
      const beforeContent = tokens(f.content),
        beforeTrigger = tokens(f.trigger);
      const open = f.content.getExposes().open,
        presence = f.content.getExposes().isPresent;
      setElementProps(f.trigger, { presentation: 'navigation' });
      setElementProps(f.content, { presentation: 'navigation' });
      await flush();
      expect(tokens(f.content)).toEqual(
        expect.arrayContaining([
          'rounded-none',
          'border-0',
          'ring-0',
          'p-0',
          'shadow-none',
          'bg-background',
          'overflow-y-auto',
          'w-[var(--proto-ui-available-width)]',
          'h-[var(--proto-ui-available-height)]',
        ])
      );
      for (const forbidden of [
        'w-72',
        'p-4',
        'p-2.5',
        'shadow-lg',
        'shadow-md',
        'ring-1',
        'bg-popover',
        'animate-in',
      ])
        expect(tokens(f.content)).not.toContain(forbidden);
      expect(tokens(f.content)).toContain('animate-none');
      // Explicit synthetic unsupported capability stays opaque; this is not native support evidence.
      expect(tokens(f.content)).not.toContain('bg-background/90');
      expect(tokens(f.content)).not.toContain('backdrop-blur-xs');
      expect(tokens(f.trigger)).toEqual(
        expect.arrayContaining(['bg-secondary', 'text-secondary-foreground'])
      );
      for (const forbidden of ['border-border', 'px-4', 'px-2.5', 'translate-y-px'])
        expect(tokens(f.trigger)).not.toContain(forbidden);
      expect(f.content.getAttribute('aria-modal')).not.toBe('true');
      expect(f.content.getExposes().open).toBe(open);
      expect(f.content.getExposes().isPresent).toBe(presence);
      expect(open.get()).toBe(true);
      expect(presence.get()).toBe(true);
      for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
        const css = render(tokens(f.content));
        expect(css).not.toContain('Unsupported Proto UI style tokens');
        expect(css).toContain('var(--proto-ui-available-width)');
        expect(css).toContain('var(--proto-ui-available-height)');
      }
      setElementProps(f.trigger, { presentation: 'default' });
      setElementProps(f.content, { presentation: 'default' });
      await flush();
      expect(tokens(f.content)).toEqual(beforeContent);
      expect(tokens(f.trigger)).toEqual(beforeTrigger);
    }
  );
  it('keeps one public Trigger request and the same open/presence handles through close/reopen', async () => {
    const f = fixture();
    setElementProps(f.trigger, { presentation: 'navigation' });
    setElementProps(f.content, { presentation: 'navigation' });
    await flush();
    const open = f.content.getExposes().open,
      present = f.content.getExposes().isPresent;
    const requests: unknown[] = [];
    f.root.addEventListener('openChange', (event) => requests.push((event as CustomEvent).detail));
    f.trigger.click();
    await flush();
    expect(requests).toEqual([{ open: false, reason: 'trigger.press', focusReason: 'pointer' }]);
    expect(open.get()).toBe(false);
    // Public zero-duration Transition still schedules completion; microtasks
    // alone are not its closed/presence boundary. No fixed sleep is substituted.
    await vi.waitFor(() => expect(present.get()).toBe(false));
    f.trigger.click();
    await flush();
    expect(requests).toHaveLength(2);
    expect(open.get()).toBe(true);
    expect(present.get()).toBe(true);
    expect(f.content.getExposes().open).toBe(open);
    expect(f.content.getExposes().isPresent).toBe(present);
    setElementProps(f.trigger, { disabled: true });
    await flush();
    f.trigger.click();
    await flush();
    expect(requests).toHaveLength(2);
  });
});

it.each([false, 'unknown'] as const)(
  'keeps unsupported/unknown navigation opaque (%s)',
  async (support) => {
    preferences(support);
    const f = fixture();
    setElementProps(f.content, { presentation: 'navigation' });
    await flush();
    expect(tokens(f.content)).toContain('bg-background');
    expect(tokens(f.content)).not.toContain('bg-background/90');
    expect(tokens(f.content)).not.toContain('backdrop-blur-xs');
  }
);
it.each([
  ['prefers-reduced-transparency', 'reduce'],
  ['forced-colors', 'active'],
  ['forced-colors', 'unknown'],
] as const)(
  'withdraws supported translucency for %s=%s without replacing the public owner',
  async (key, value) => {
    const change = preferences(true),
      f = fixture();
    setElementProps(f.content, { presentation: 'navigation' });
    await flush();
    const owner = f.content.getExposes().open;
    console.info(
      '[popover-navigation-preference-initial]',
      JSON.stringify({
        key,
        value,
        nodes: fixtureNodeFacts(),
        worlds: preferenceTrace(),
        reader: {
          transparency: readWebPreference(document, 'preference.reducedTransparency'),
          forcedColors: readWebPreference(document, 'preference.forcedColors'),
          backdropBlur4px: readWebStyleSupport(document, 'styleSupport.backdropBlur4px'),
        },
        tokens: tokens(f.content),
      })
    );
    expect(tokens(f.content)).toContain('bg-background/90');
    expect(tokens(f.content)).toContain('backdrop-blur-xs');
    const before = preferenceTrace();
    change(key, value);
    await flush();
    const inputFacts = {
      key,
      value,
      before,
      after: preferenceTrace(),
      reader: {
        transparency: readWebPreference(document, 'preference.reducedTransparency'),
        forcedColors: readWebPreference(document, 'preference.forcedColors'),
      },
      tokens: tokens(f.content),
    };
    console.info('[popover-navigation-preference-inputs]', JSON.stringify(inputFacts));
    expect(tokens(f.content), JSON.stringify(inputFacts)).toContain('bg-background');
    expect(tokens(f.content)).not.toContain('bg-background/90');
    expect(tokens(f.content)).not.toContain('backdrop-blur-xs');
    expect(f.content.getExposes().open).toBe(owner);
    change(key, key === 'forced-colors' ? 'none' : 'no-preference');
    await flush();
    expect(tokens(f.content)).toContain('bg-background/90');
  }
);
it('Brutalist opts into shared control and panel grammar without changing omitted/default output', async () => {
  preferences(false);
  const root = document.createElement(brutalistPopover.popoverRoot.name),
    trigger = document.createElement(brutalistPopover.popoverTrigger.name),
    content = document.createElement(brutalistPopover.popoverContent.name) as PublicHost;
  setElementProps(root, { defaultOpen: true });
  setElementProps(content, { enterDuration: 0, leaveDuration: 0 });
  root.append(trigger, content);
  document.body.append(root);
  roots.push(root);
  fixtureNodes.push({ root, trigger, content });
  await flush();
  const beforeTrigger = tokens(trigger),
    beforeContent = tokens(content),
    open = content.getExposes().open;
  setElementProps(trigger, { presentation: 'navigation' });
  setElementProps(content, { presentation: 'navigation' });
  await flush();
  expect(tokens(trigger)).toEqual(
    expect.arrayContaining([
      'bg-secondary-background',
      'rounded-base',
      'border-black',
      'shadow-[4px_4px_0_0_#000]',
    ])
  );
  expect(tokens(content)).toEqual(
    expect.arrayContaining([
      'p-0',
      'w-[var(--proto-ui-available-width)]',
      'h-[var(--proto-ui-available-height)]',
    ])
  );
  expect(tokens(content)).not.toContain('p-4');
  expect(tokens(content)).not.toContain('w-72');
  expect(content.getExposes().open).toBe(open);
  setElementProps(trigger, { presentation: 'default' });
  setElementProps(content, { presentation: 'default' });
  await flush();
  expect(tokens(trigger)).toEqual(beforeTrigger);
  expect(tokens(content)).toEqual(beforeContent);
});

// Independent controlled public owner: no website materializer/navigation lease.
// The existing website outside-focus assertions remain unchanged.
it.each([
  { name: 'base', family: basePopover, coldCancel: false, presentation: 'default' },
  { name: 'base', family: basePopover, coldCancel: true, presentation: 'default' },
  { name: 'shadcn', family: popover, coldCancel: false, presentation: 'default' },
  { name: 'shadcn', family: popover, coldCancel: true, presentation: 'default' },
  { name: 'shadcn-navigation', family: popover, coldCancel: false, presentation: 'navigation' },
  { name: 'shadcn-navigation', family: popover, coldCancel: true, presentation: 'navigation' },
  {
    name: 'brutalist-navigation',
    family: brutalistPopover,
    coldCancel: false,
    presentation: 'navigation',
  },
  {
    name: 'brutalist-navigation',
    family: brutalistPopover,
    coldCancel: true,
    presentation: 'navigation',
  },
] as const)(
  '$name controlled public WC Popover preserves outside-focus without the website (cold cancel $coldCancel)',
  async ({ name: _family, family, coldCancel, presentation }) => {
    const root = document.createElement(family.popoverRoot.name) as PublicHost;
    const trigger = document.createElement(family.popoverTrigger.name);
    const content = document.createElement(family.popoverContent.name) as PublicHost;
    const inside = document.createElement('button'),
      outside = document.createElement('button');
    inside.textContent = 'Inside';
    outside.textContent = 'Outside';
    trigger.textContent = 'Open';
    content.append(inside);
    root.append(trigger, content);
    roots.push(root, outside);
    fixtureNodes.push({ root, trigger, content });
    const requests: unknown[] = [],
      trace: unknown[] = [];
    const snapshot = (stage: string, detail: unknown = null) => {
      const exposes = content.getExposes();
      const state = (key: string) =>
        (exposes[key] as { get?: () => unknown } | undefined)?.get?.() ?? null;
      trace.push({
        stage,
        detail,
        open: state('open'),
        present: state('isPresent'),
        transition: state('transitionState'),
        activeTag: document.activeElement?.tagName,
        activeIsOutside: document.activeElement === outside,
        rootConnected: root.isConnected,
        contentConnected: content.isConnected,
      });
    };
    setElementProps(root, {
      open: false,
      a11yLabel: 'Controlled public navigation',
    });
    if (presentation === 'navigation') {
      setElementProps(trigger, { presentation });
      setElementProps(content, { presentation });
    }
    // WC exposes events through the public DOM bridge, not callback props.
    const onOpenChange = (event: Event) => {
      const detail = (event as CustomEvent<{ open: boolean; reason: string; focusReason: string }>)
        .detail;
      requests.push(detail);
      snapshot('request.before', detail);
      setElementProps(root, { open: detail.open });
      snapshot('request.after', detail);
    };
    root.addEventListener('openChange', onOpenChange);
    setElementProps(content, { enterDuration: 0, leaveDuration: 0 });
    const onFocus = (event: Event) =>
      snapshot('document.focusin', {
        composed: event.composed,
        trusted: event.isTrusted,
        targetTag: event.target instanceof Element ? event.target.tagName : null,
      });
    document.addEventListener('focusin', onFocus, true);
    try {
      document.body.append(root, outside);
      await flush();
      if (coldCancel) {
        setElementProps(root, { open: true });
        setElementProps(root, { open: false });
        await vi.waitFor(() => {
          expect(content.getExposes().open.get()).toBe(false);
          expect(content.getExposes().isPresent.get()).toBe(false);
        });
        snapshot('after.cold.cancel');
      }
      trigger.click();
      await vi.waitFor(() => {
        expect(content.getExposes().open.get()).toBe(true);
        expect(content.getExposes().isPresent.get()).toBe(true);
      });
      expect(requests).toEqual(
        expect.arrayContaining([expect.objectContaining({ open: true, reason: 'trigger.press' })])
      );
      snapshot('before.outside.focus');
      outside.focus();
      snapshot('after.outside.focus');
      await vi.waitFor(() => {
        expect(content.getExposes().open.get()).toBe(false);
        expect(content.getExposes().isPresent.get()).toBe(false);
        expect(document.activeElement).toBe(outside);
      });
      expect(requests).toEqual(
        expect.arrayContaining([expect.objectContaining({ open: false, reason: 'focus.outside' })])
      );
    } finally {
      snapshot('terminal');
      document.removeEventListener('focusin', onFocus, true);
      root.removeEventListener('openChange', onOpenChange);
      console.info(
        '[controlled-popover-public-trace]',
        JSON.stringify({ family: _family, coldCancel, requests, trace })
      );
    }
  }
);
