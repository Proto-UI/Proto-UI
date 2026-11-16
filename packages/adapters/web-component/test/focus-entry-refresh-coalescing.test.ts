import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHostSurfaceProjection } from '@proto.ui/adapter-base';
import { FOCUS_SET_ENTRY_FOCUSABLE_CAP } from '@proto.ui/module-focus';
import { createWebComponentModules } from '../src/runtime/modules';

const settle = async () => {
  await Promise.resolve();
  await (
    window as unknown as { happyDOM: { waitUntilComplete(): Promise<void> } }
  ).happyDOM.waitUntilComplete();
};

afterEach(async () => {
  document.body.replaceChildren();
  await settle();
  vi.restoreAllMocks();
});

function entryFixture() {
  const nativeObserver = window.MutationObserver;
  const observers: DeliveryObserver[] = [];
  const observations: Array<{ node: Node; options?: MutationObserverInit }> = [];
  class DeliveryObserver extends nativeObserver {
    constructor(private readonly callback: MutationCallback) {
      super(callback);
      observers.push(this);
    }
    override observe(node: Node, options?: MutationObserverInit) {
      observations.push({ node, options });
      super.observe(node, options);
    }
    deliverPendingRecords() {
      const records = this.takeRecords();
      if (records.length) this.callback(records, this);
    }
  }
  vi.spyOn(window, 'MutationObserver').mockImplementation(
    (callback) => new DeliveryObserver(callback)
  );
  const target = document.createElement('div');
  const style = document.createElement('style');
  style.textContent = '.entry-refresh-button { visibility: visible; }';
  document.body.append(style, target);
  const modules = createWebComponentModules({
    el: target,
    surfaceProjection: createHostSurfaceProjection(target),
    instanceToken: {} as never,
    router: { rootTarget: target, globalTarget: window },
    rawPropsSource: { get: () => ({}), subscribe: () => () => {} },
    effectsPort: {} as never,
    textControlTarget: null,
    imageViewTarget: null,
    getMeta: () => undefined,
    setExposes() {},
    runInCallbackScope: (fn) => fn(),
    isViewReady: () => true,
    isEntryAcquisitionReady: () => true,
    subscribeTargetReady: () => () => {},
    retryTargetReady() {},
  });
  const setEntry = modules.focus!({ prototypeName: 'entry-refresh-coalescing' }).find(
    ([key]) => key === FOCUS_SET_ENTRY_FOCUSABLE_CAP
  )![1] as (
    target: HTMLElement,
    config: { strategy: 'descendant-first'; fallback: 'self' },
    enabled: boolean
  ) => void;
  const config = { strategy: 'descendant-first', fallback: 'self' } as const;
  setEntry(target, config, true);
  return {
    target,
    style,
    observations,
    setEntry: (next: HTMLElement, enabled: boolean) => setEntry(next, config, enabled),
    // Happy DOM normally delivers observers through its task manager. Deliver
    // its real pending records explicitly to exercise the browser's allowed
    // same-checkpoint CSSOM/DOM ordering, without inventing mutation facts.
    deliver: () => {
      for (const observer of [...observers]) observer.deliverPendingRecords();
    },
    rebuilds: (node = target) =>
      observations.filter(
        (observation) =>
          observation.node === node && observation.options?.attributeFilter?.includes('tabindex')
      ).length,
    dispose: () => setEntry(target, config, false),
  };
}

describe('WC entry dependency refresh coalescing', () => {
  it.each(['dom-first', 'cssom-first'] as const)(
    'rebuilds once for a shared %s invalidation checkpoint',
    async (order) => {
      const fixture = entryFixture();
      const { target, style } = fixture;
      try {
        await settle();
        expect(target.tabIndex).toBe(0);
        fixture.observations.length = 0;
        const button = document.createElement('button');
        button.className = 'entry-refresh-button';
        button.tabIndex = 0;
        const mutateDom = () => {
          target.append(button);
        };
        const mutateCss = () => {
          (style.sheet!.cssRules[0] as CSSStyleRule).style.setProperty('visibility', 'visible');
        };
        if (order === 'dom-first') {
          mutateDom();
          mutateCss();
        } else {
          mutateCss();
          mutateDom();
        }
        fixture.deliver();
        await settle();
        expect(target.hasAttribute('tabindex')).toBe(false);
        expect(fixture.rebuilds()).toBe(1);

        // A later checkpoint still samples the current DOM and stylesheet.
        fixture.observations.length = 0;
        button.remove();
        fixture.deliver();
        await settle();
        expect(target.tabIndex).toBe(0);
        expect(fixture.rebuilds()).toBe(1);
      } finally {
        fixture.dispose();
      }
    }
  );

  it('merges DOM delivery into a sample already queued by the stylesheet notification', async () => {
    const fixture = entryFixture();
    try {
      await settle();
      fixture.observations.length = 0;
      (fixture.style.sheet!.cssRules[0] as CSSStyleRule).style.setProperty('visibility', 'visible');
      const button = document.createElement('button');
      button.tabIndex = 0;
      fixture.target.append(button);
      await Promise.resolve();
      fixture.deliver();
      await settle();
      expect(fixture.target.hasAttribute('tabindex')).toBe(false);
      expect(fixture.rebuilds()).toBe(1);
    } finally {
      fixture.dispose();
    }
  });

  it('still rebuilds stylesheet-only dependencies without a DOM signal', async () => {
    const fixture = entryFixture();
    try {
      await settle();
      fixture.observations.length = 0;
      const rule = fixture.style.sheet!.cssRules[0] as CSSStyleRule;
      rule.style.setProperty('display', 'none');
      await settle();
      expect(fixture.rebuilds()).toBe(1);
      expect(rule.style.getPropertyValue('display')).toBe('none');
    } finally {
      fixture.dispose();
    }
  });

  it('retains a newer stylesheet invalidation raised during the current graph rebuild', async () => {
    const fixture = entryFixture();
    try {
      await settle();
      fixture.observations.length = 0;
      const query = fixture.target.querySelectorAll.bind(fixture.target);
      const rule = fixture.style.sheet!.cssRules[0] as CSSStyleRule;
      let changed = false;
      vi.spyOn(fixture.target, 'querySelectorAll').mockImplementation((selector: string) => {
        if (!changed) {
          changed = true;
          rule.style.setProperty('display', 'none');
        }
        return query(selector);
      });
      rule.style.setProperty('color', 'red');
      await settle();
      expect(changed).toBe(true);
      expect(fixture.rebuilds()).toBe(2);
      expect(rule.style.getPropertyValue('display')).toBe('none');
    } finally {
      fixture.dispose();
    }
  });

  it('cancels a queued stylesheet refresh when the entry is disabled', async () => {
    const fixture = entryFixture();
    try {
      await settle();
      fixture.observations.length = 0;
      (fixture.style.sheet!.cssRules[0] as CSSStyleRule).style.setProperty('display', 'none');
      // Let the window-wide notification enqueue the generation-owned sample,
      // then retire that generation before the sample is allowed to run.
      await Promise.resolve();
      fixture.observations.length = 0;
      fixture.setEntry(fixture.target, false);
      await settle();
      expect(fixture.target.hasAttribute('tabindex')).toBe(false);
      expect(fixture.rebuilds()).toBe(0);
    } finally {
      fixture.dispose();
    }
  });

  it('does not rebuild a retired target when its replacement receives the pending signal', async () => {
    const fixture = entryFixture();
    const replacement = document.createElement('div');
    document.body.append(replacement);
    try {
      await settle();
      (fixture.style.sheet!.cssRules[0] as CSSStyleRule).style.setProperty('visibility', 'hidden');
      fixture.setEntry(replacement, true);
      fixture.observations.length = 0;
      await settle();
      expect(fixture.rebuilds()).toBe(0);
      expect(replacement.tabIndex).toBe(0);
      const button = document.createElement('button');
      button.tabIndex = 0;
      replacement.append(button);
      fixture.deliver();
      await settle();
      expect(replacement.hasAttribute('tabindex')).toBe(false);
    } finally {
      fixture.setEntry(replacement, false);
      fixture.dispose();
    }
  });
});
