import { createWebInputOriginAnchor } from '../src/web/input-origin-anchor';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnchoredPositionConfig } from '@proto.ui/core';
import { platform as domPlatform } from '@floating-ui/dom';
import { createFloatingUiAnchoredPositionHost } from '../src';

const rect = (x: number, y: number, width: number, height: number): DOMRect =>
  ({
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({}),
  }) as DOMRect;

function setRect(element: HTMLElement, value: DOMRect): void {
  element.getBoundingClientRect = () => value;
  Object.defineProperties(element, {
    offsetWidth: { configurable: true, value: value.width },
    offsetHeight: { configurable: true, value: value.height },
  });
}

const baseConfig: AnchoredPositionConfig = {
  side: 'bottom',
  align: 'start',
  sideOffset: 4,
  alignOffset: 0,
  strategy: 'fixed',
  avoidCollisions: false,
  collisionBoundary: 'clippingAncestors',
  collisionPadding: 0,
};

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

afterEach(() => document.body.replaceChildren());

describe('module-positioning: Floating UI host', () => {
  it('applies side, alignment, offsets, categorical data, and non-transform coordinates', async () => {
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    document.body.append(anchor, floating);
    setRect(anchor, rect(100, 100, 50, 20));
    setRect(floating, rect(0, 0, 40, 10));

    const snapshots: unknown[] = [];
    const lease = createFloatingUiAnchoredPositionHost().attach({
      anchor,
      floating,
      config: baseConfig,
      onResolved: (snapshot) => snapshots.push(snapshot),
    });
    await flush();

    expect(floating.style.position).toBe('fixed');
    expect(floating.style.left).toBe('100px');
    expect(floating.style.top).toBe('124px');
    expect(floating.style.transform).toBe('');
    expect(floating.dataset).toMatchObject({ side: 'bottom', align: 'start' });
    expect(floating.style.getPropertyValue('--proto-ui-anchor-width')).toBe('50px');
    expect(floating.style.getPropertyValue('--proto-ui-anchor-height')).toBe('20px');
    expect(floating.style.getPropertyValue('--proto-ui-available-width')).toMatch(/px$/);
    expect(floating.style.getPropertyValue('--proto-ui-available-height')).toMatch(/px$/);
    expect(snapshots.at(-1)).toEqual({ side: 'bottom', align: 'start', strategy: 'fixed' });

    lease.update({
      anchor,
      floating,
      config: { ...baseConfig, side: 'top', align: 'end', sideOffset: 8 },
    });
    await flush();
    expect(floating.style.left).toBe('110px');
    expect(floating.style.top).toBe('82px');
    expect(floating.dataset).toMatchObject({ side: 'top', align: 'end' });
    lease.dispose();
  });

  it('pins the configured strategy inside the viewport before computePosition yields', () => {
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    document.body.append(anchor, floating);
    setRect(anchor, rect(100, 100, 50, 20));
    setRect(floating, rect(0, 0, 40, 10));
    const lease = createFloatingUiAnchoredPositionHost().attach({
      anchor,
      floating,
      config: baseConfig,
    });
    expect(floating.style.position).toBe('fixed');
    expect(floating.style.top).toBe('0px');
    expect(floating.style.left).toBe('0px');
    lease.dispose();
  });

  it('keeps the available height during floating content scroll and tracks a newly scrollable anchor pane', async () => {
    const pane = document.createElement('div');
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    const contents = document.createElement('div');
    pane.append(anchor);
    floating.append(contents);
    document.body.append(pane, floating);
    setRect(anchor, rect(100, 100, 50, 20));
    setRect(floating, rect(0, 0, 80, 40));
    const availableHeight = '--proto-ui-available-height';
    const onResolved = vi.fn();
    const lease = createFloatingUiAnchoredPositionHost().attach({
      anchor,
      floating,
      config: baseConfig,
      onResolved,
    });
    try {
      await flush();
      const cap = floating.style.getPropertyValue(availableHeight);
      expect(cap).toMatch(/px$/);
      onResolved.mockClear();
      floating.dispatchEvent(new Event('scroll'));
      expect(floating.style.getPropertyValue(availableHeight)).toBe(cap);
      contents.dispatchEvent(new Event('scroll'));
      expect(floating.style.getPropertyValue(availableHeight)).toBe(cap);
      await flush();
      expect(onResolved).not.toHaveBeenCalled();

      pane.style.overflow = 'auto';
      setRect(anchor, rect(100, 75, 50, 20));
      pane.dispatchEvent(new Event('scroll'));
      await flush();
      expect(floating.style.top).toBe('99px');
      expect(onResolved).toHaveBeenCalled();
    } finally {
      lease.dispose();
    }
  });

  it('repositions when scrolling the floating container moves its shadow reference', async () => {
    const floating = document.createElement('div');
    const host = document.createElement('div');
    const anchor = document.createElement('button');
    host.attachShadow({ mode: 'open' }).append(anchor);
    floating.append(host);
    document.body.append(floating);
    setRect(anchor, rect(100, 100, 50, 20));
    setRect(floating, rect(0, 0, 80, 40));
    const lease = createFloatingUiAnchoredPositionHost().attach({
      anchor,
      floating,
      config: baseConfig,
    });
    try {
      await flush();
      expect(floating.style.top).toBe('124px');
      setRect(anchor, rect(100, 75, 50, 20));
      floating.dispatchEvent(new Event('scroll'));
      await flush();
      expect(floating.style.top).toBe('99px');
    } finally {
      lease.dispose();
    }
  });

  it('positions against rendered anchor geometry by default even when the anchor carries a translation', async () => {
    // Reviewer counterexample: a legitimate layout translation (e.g. translate(-50%)
    // centering or an application animation) must keep the floating element where
    // the user actually sees the anchor.
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    document.body.append(anchor, floating);
    // Rendered rect already includes the anchor's own translation (x=200 rendered,
    // layout position x=100 before the 100px translation).
    setRect(anchor, rect(200, 100, 50, 20));
    setRect(floating, rect(0, 0, 40, 10));
    const transformSpy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      transform: 'matrix(1, 0, 0, 1, 100, 0)',
    } as CSSStyleDeclaration);

    const lease = createFloatingUiAnchoredPositionHost().attach({
      anchor,
      floating,
      config: baseConfig,
    });
    await flush();

    expect(floating.style.left).toBe('200px');
    expect(floating.style.top).toBe('124px');
    transformSpy.mockRestore();
    lease.dispose();
  });

  it('excludes the anchor own CSS translation only on explicit opt-in', async () => {
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    document.body.append(anchor, floating);
    setRect(anchor, rect(101, 101, 50, 20));
    setRect(floating, rect(0, 0, 40, 10));
    let transform = 'matrix(1, 0, 0, 1, -1, -1)';
    const transformSpy = vi
      .spyOn(window, 'getComputedStyle')
      .mockImplementation(() => ({ transform }) as CSSStyleDeclaration);

    // Hover-lift decoration: rendered rect shifted by (-1,-1); the opt-in backs
    // the translation out so placement tracks the layout position.
    const lease = createFloatingUiAnchoredPositionHost().attach({
      anchor,
      floating,
      config: { ...baseConfig, excludeAnchorTranslation: true },
    });
    await flush();

    expect(floating.style.left).toBe('102px');
    expect(floating.style.top).toBe('126px');

    // Fixed layout point is (102,102). Change both the computed matrix and
    // rendered rect; a cached first matrix would produce (99,100) and fail.
    transform = 'matrix(1, 0, 0, 1, -4, -3)';
    setRect(anchor, rect(98, 99, 50, 20));
    lease.requestUpdate();
    await flush();
    expect(floating.style.left).toBe('102px');
    expect(floating.style.top).toBe('126px');
    transformSpy.mockRestore();
    lease.dispose();
  });

  it('backs the independent CSS translate property out of the popper basis', async () => {
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    document.body.append(anchor, floating);
    // Rendered rect includes translate: -1px -1px; layout origin is (100, 100).
    setRect(anchor, rect(99, 99, 50, 20));
    setRect(floating, rect(0, 0, 40, 10));
    const transformSpy = vi
      .spyOn(window, 'getComputedStyle')
      .mockImplementation(
        () => ({ transform: 'none', translate: '-1px -1px' }) as CSSStyleDeclaration
      );

    const lease = createFloatingUiAnchoredPositionHost().attach({
      anchor,
      floating,
      config: { ...baseConfig, excludeAnchorTranslation: true },
    });
    await flush();

    expect(floating.style.left).toBe('100px');
    expect(floating.style.top).toBe('124px');
    transformSpy.mockRestore();
    lease.dispose();
  });

  it('reports collision-resolved side and alignment against the viewport', async () => {
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    document.body.append(anchor, floating);
    setRect(anchor, rect(100, 760, 50, 8));
    setRect(floating, rect(0, 0, 80, 40));

    const lease = createFloatingUiAnchoredPositionHost().attach({
      anchor,
      floating,
      config: { ...baseConfig, avoidCollisions: true, collisionPadding: 4 },
    });
    await flush();

    expect(floating.dataset.side).toBe('top');
    expect(floating.dataset.align).toBe('end');
    lease.dispose();
  });

  it('reconsiders intrinsic content after its previous available-space cap', async () => {
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    document.body.append(anchor, floating);
    setRect(anchor, rect(100, 600, 100, 40));
    let contentHeight = 20;
    // This host-unit fixture models max-height: var(--proto-ui-available-height).
    // The initial short content fits below; later content needs the larger top
    // side. A previously published cap is an output, not its intrinsic size.
    const height = () => {
      const limit = Number.parseFloat(
        floating.style.getPropertyValue('--proto-ui-available-height')
      );
      return Number.isFinite(limit) ? Math.min(contentHeight, limit) : contentHeight;
    };
    floating.getBoundingClientRect = () => rect(0, 0, 100, height());
    Object.defineProperties(floating, {
      offsetWidth: { configurable: true, value: 100 },
      offsetHeight: { configurable: true, get: height },
    });
    const viewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    const width = Object.getOwnPropertyDescriptor(document.documentElement, 'clientWidth');
    const heightDescriptor = Object.getOwnPropertyDescriptor(
      document.documentElement,
      'clientHeight'
    );
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      value: 768,
    });
    const lease = createFloatingUiAnchoredPositionHost().attach({
      anchor,
      floating,
      config: { ...baseConfig, avoidCollisions: true, collisionPadding: 4 },
    });
    try {
      await flush();
      expect(floating.dataset.side).toBe('bottom');
      expect(
        Number.parseFloat(floating.style.getPropertyValue('--proto-ui-available-height'))
      ).toBeLessThan(240);

      contentHeight = 240;
      lease.requestUpdate();
      await flush();
      expect(floating.dataset.side).toBe('top');
      expect(height()).toBe(240);

      contentHeight = 20;
      lease.requestUpdate();
      await flush();
      expect(floating.dataset.side).toBe('bottom');
    } finally {
      lease.dispose();
      for (const [target, key, descriptor] of [
        [window, 'visualViewport', viewport],
        [document.documentElement, 'clientWidth', width],
        [document.documentElement, 'clientHeight', heightDescriptor],
      ] as const) {
        if (descriptor) Object.defineProperty(target, key, descriptor);
        else Reflect.deleteProperty(target, key);
      }
    }
  });
});

describe('module-positioning: relevant scroll observation', () => {
  let viewportDescriptors: [string, PropertyDescriptor | undefined][];
  beforeEach(() => {
    viewportDescriptors = ['clientWidth', 'clientHeight'].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(document.documentElement, name),
    ]);
    Object.defineProperties(document.documentElement, {
      clientWidth: { configurable: true, value: 1024 },
      clientHeight: { configurable: true, value: 768 },
    });
  });
  afterEach(() => {
    for (const [name, descriptor] of viewportDescriptors) {
      if (descriptor) Object.defineProperty(document.documentElement, name, descriptor);
      else Reflect.deleteProperty(document.documentElement, name);
    }
  });

  function attach(anchor: HTMLElement, floating: HTMLElement) {
    setRect(anchor, rect(100, 100, 50, 20));
    setRect(floating, rect(0, 0, 40, 10));
    const onResolved = vi.fn();
    const lease = createFloatingUiAnchoredPositionHost().attach({
      anchor,
      floating,
      config: baseConfig,
      onResolved,
    });
    return { lease, onResolved };
  }

  function overflowingPanel(anchorY: number, avoidCollisions = false) {
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    document.body.append(anchor, floating);
    setRect(anchor, rect(100, anchorY, 50, 20));
    // Explicit host-unit layout facts. No native wheel or browser clamping is
    // simulated: these tests observe the cap's synchronous ownership boundary.
    const naturalHeight = 1000;
    const height = () => {
      const cap = Number.parseFloat(floating.style.getPropertyValue('--proto-ui-available-height'));
      return Number.isFinite(cap) ? Math.min(naturalHeight, Math.max(0, cap)) : naturalHeight;
    };
    floating.getBoundingClientRect = () => rect(0, 0, 100, height());
    Object.defineProperties(floating, {
      offsetWidth: { configurable: true, value: 100 },
      offsetHeight: { configurable: true, get: height },
      clientWidth: { configurable: true, value: 100 },
      clientHeight: { configurable: true, get: height },
      scrollWidth: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: naturalHeight },
    });
    const lease = createFloatingUiAnchoredPositionHost().attach({
      anchor,
      floating,
      config: { ...baseConfig, avoidCollisions },
    });
    return { anchor, floating, lease, height };
  }

  it('keeps an overflowing panel capped while its reference moves', async () => {
    const panel = overflowingPanel(100);
    try {
      await flush();
      const cap = panel.floating.style.getPropertyValue('--proto-ui-available-height');
      expect(cap).toBe('644px');
      setRect(panel.anchor, rect(100, 96, 50, 20));
      window.dispatchEvent(new Event('scroll'));
      expect(panel.floating.style.getPropertyValue('--proto-ui-available-height')).toBe(cap);
      await flush();
      expect(panel.floating.style.top).toBe('120px');
      expect(panel.height()).toBe(648);
    } finally {
      panel.lease.dispose();
    }
  });

  it('reconsiders the natural size and side when a capped panel reference crosses the viewport', async () => {
    const panel = overflowingPanel(600, true);
    try {
      await flush();
      expect(panel.floating.dataset.side).toBe('top');
      expect(panel.height()).toBe(596);
      setRect(panel.anchor, rect(100, 100, 50, 20));
      window.dispatchEvent(new Event('scroll'));
      expect(panel.floating.style.getPropertyValue('--proto-ui-available-height')).toBe('596px');
      await flush();
      expect(panel.floating.dataset.side).toBe('bottom');
      expect(panel.floating.style.top).toBe('124px');
      expect(panel.height()).toBe(644);
    } finally {
      panel.lease.dispose();
    }
  });

  it('uses the current viewport after a capped panel resize', async () => {
    const panel = overflowingPanel(100);
    try {
      await flush();
      Object.defineProperty(document.documentElement, 'clientHeight', {
        configurable: true,
        value: 400,
      });
      window.dispatchEvent(new Event('resize'));
      await flush();
      expect(panel.floating.style.top).toBe('124px');
      expect(panel.height()).toBe(276);
      expect(panel.floating.style.getPropertyValue('--proto-ui-available-height')).toBe('276px');
    } finally {
      panel.lease.dispose();
    }
  });

  it('remeasures natural dimensions when placement CSS changes the overflowing content', async () => {
    const stylesheet = document.createElement('style');
    stylesheet.textContent = '.placement-intrinsic-panel[data-side="top"] { padding-top: 200px; }';
    document.head.append(stylesheet);
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    floating.className = 'placement-intrinsic-panel';
    document.body.append(anchor, floating);
    setRect(anchor, rect(100, 600, 50, 20));
    const measurements: number[] = [];
    const naturalHeight = () =>
      1000 + (Number.parseFloat(getComputedStyle(floating).paddingTop) || 0);
    const height = () => {
      const natural = naturalHeight();
      const cap = Number.parseFloat(floating.style.getPropertyValue('--proto-ui-available-height'));
      if (Number.isFinite(cap)) return Math.min(natural, Math.max(0, cap));
      measurements.push(natural);
      return natural;
    };
    floating.getBoundingClientRect = () => rect(0, 0, 100, height());
    Object.defineProperties(floating, {
      offsetWidth: { configurable: true, value: 100 },
      clientWidth: { configurable: true, value: 100 },
      scrollWidth: { configurable: true, value: 100 },
      offsetHeight: { configurable: true, get: height },
      clientHeight: { configurable: true, get: height },
      scrollHeight: { configurable: true, get: naturalHeight },
    });
    const lease = createFloatingUiAnchoredPositionHost().attach({
      anchor,
      floating,
      config: { ...baseConfig, avoidCollisions: true },
    });
    try {
      await flush();
      expect(floating.dataset.side).toBe('top');
      expect(getComputedStyle(floating).paddingTop).toBe('200px');
      expect(floating.scrollHeight).toBe(1200);
      measurements.length = 0;
      window.dispatchEvent(new Event('scroll'));
      // The owned data-side write changed actual layout. Measure the new 1200px
      // content while returning with the prior viewport already restored.
      expect(floating.style.getPropertyValue('--proto-ui-available-height')).toBe('596px');
      await flush();
      expect(measurements).toContain(1200);
      expect(floating.dataset.side).toBe('top');
    } finally {
      lease.dispose();
      stylesheet.remove();
    }
  });

  it('remeasures natural size for the next solve after a reference change across a provider await', async () => {
    let panel: ReturnType<typeof overflowingPanel> | undefined;
    const measurements: number[] = [];
    let changed = false;
    const original = domPlatform.getElementRects;
    const originalDimensions = domPlatform.getDimensions;
    const dimensions = vi.spyOn(domPlatform, 'getDimensions').mockImplementation((element) => {
      const result = originalDimensions(element);
      if (!('then' in result)) measurements.push(result.height);
      return result;
    });
    const measurement = vi.spyOn(domPlatform, 'getElementRects').mockImplementation(async function (
      this: typeof domPlatform,
      input
    ) {
      const result = await original.call(this, input);
      if (!changed && panel) {
        changed = true;
        // An independent input changes after this real platform measurement,
        // without a floating subtree mutation or an intervening RO delivery.
        setRect(panel.anchor, rect(100, 100, 80, 20));
      }
      return result;
    });
    try {
      panel = overflowingPanel(100);
      await flush();
      expect(changed).toBe(true);
      expect(panel.anchor.offsetWidth).toBe(80);
      expect(panel.height()).toBe(644);
      measurements.length = 0;
      window.dispatchEvent(new Event('scroll'));
      await flush();
      // The synchronous DOM dimension read must see the natural content,
      // while the asynchronous provider continues with a restored viewport.
      expect(measurements[0]).toBe(1000);
      expect(panel.floating.style.top).toBe('124px');
    } finally {
      panel?.lease.dispose();
      measurement.mockRestore();
      dimensions.mockRestore();
    }
  });

  it.each(['floating', 'descendant', 'unrelated', 'reference'] as const)(
    'retains its available-space cap during %s scrolling',
    async (target) => {
      const anchor = document.createElement('button');
      const floating = document.createElement('div');
      const descendant = document.createElement('div');
      const unrelated = document.createElement('div');
      floating.append(descendant);
      document.body.append(anchor, floating, unrelated);
      const { lease, onResolved } = attach(anchor, floating);
      try {
        await flush();
        const cap = floating.style.getPropertyValue('--proto-ui-available-height');
        expect(cap).toMatch(/px$/);
        onResolved.mockClear();
        ({ floating, descendant, unrelated, reference: anchor })[target].dispatchEvent(
          new Event('scroll')
        );
        // This checks the synchronous lease boundary, before a new async solve
        // could restore the cap. Happy DOM does not certify native scrolling.
        expect(floating.style.getPropertyValue('--proto-ui-available-height')).toBe(cap);
        await flush();
        expect(onResolved).not.toHaveBeenCalled();
      } finally {
        lease.dispose();
      }
    }
  );

  it('keeps the outer cap while a newly scrolling outer panel moves an inner anchor', async () => {
    const outerAnchor = document.createElement('button');
    const outerFloating = document.createElement('div');
    const innerAnchor = document.createElement('button');
    const innerFloating = document.createElement('div');
    outerFloating.append(innerAnchor);
    document.body.append(outerAnchor, outerFloating, innerFloating);
    const outer = attach(outerAnchor, outerFloating);
    const inner = attach(innerAnchor, innerFloating);
    try {
      await flush();
      const cap = outerFloating.style.getPropertyValue('--proto-ui-available-height');
      expect(cap).toMatch(/px$/);
      outer.onResolved.mockClear();
      inner.onResolved.mockClear();
      // autoUpdate did not see an overflow ancestor at attach time.
      outerFloating.style.overflow = 'auto';
      setRect(innerAnchor, rect(100, 80, 50, 20));
      outerFloating.dispatchEvent(new Event('scroll'));
      expect(outerFloating.style.getPropertyValue('--proto-ui-available-height')).toBe(cap);
      await flush();
      expect(outer.onResolved).not.toHaveBeenCalled();
      expect(inner.onResolved).toHaveBeenCalled();
      expect(innerFloating.style.top).toBe('104px');
    } finally {
      inner.lease.dispose();
      outer.lease.dispose();
    }
  });

  it('observes a newly scrolling floating ancestor when the reference is outside it', async () => {
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    const scroller = document.createElement('div');
    scroller.append(floating);
    document.body.append(anchor, scroller);
    const { lease, onResolved } = attach(anchor, floating);
    try {
      await flush();
      onResolved.mockClear();
      scroller.style.overflow = 'auto';
      scroller.dispatchEvent(new Event('scroll'));
      await flush();
      expect(onResolved).toHaveBeenCalled();
    } finally {
      lease.dispose();
    }
  });

  it('still updates when a scroller inside the floating box moves its reference', async () => {
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    const scroller = document.createElement('div');
    scroller.append(anchor);
    floating.append(scroller);
    document.body.append(floating);
    const { lease, onResolved } = attach(anchor, floating);
    try {
      await flush();
      onResolved.mockClear();
      scroller.style.overflow = 'auto';
      setRect(anchor, rect(100, 80, 50, 20));
      scroller.dispatchEvent(new Event('scroll'));
      await flush();
      expect(onResolved).toHaveBeenCalled();
      expect(floating.style.top).toBe('104px');
    } finally {
      lease.dispose();
    }
  });

  it.each(['document', 'viewport'] as const)('retains %s scroll updates', async (target) => {
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    document.body.append(anchor, floating);
    const { lease, onResolved } = attach(anchor, floating);
    try {
      await flush();
      setRect(anchor, rect(100, 80, 50, 20));
      (target === 'document' ? document : window).dispatchEvent(new Event('scroll'));
      await flush();
      expect(floating.style.top).toBe('104px');
      lease.dispose();
      onResolved.mockClear();
      setRect(anchor, rect(100, 60, 50, 20));
      (target === 'document' ? document : window).dispatchEvent(new Event('scroll'));
      await flush();
      expect(onResolved).not.toHaveBeenCalled();
    } finally {
      lease.dispose();
    }
  });

  it.each(['shadow', 'slot'] as const)(
    'observes a new scroll ancestor through %s ancestry and revokes it on disposal',
    async (kind) => {
      const host = document.createElement('div');
      const root = host.attachShadow({ mode: 'open' });
      const scroller = document.createElement('div');
      const anchor = document.createElement('button');
      const floating = document.createElement('div');
      root.append(scroller);
      if (kind === 'slot') {
        const slot = document.createElement('slot');
        scroller.append(slot);
        host.append(anchor);
        // Happy DOM omits assignedSlot. Model this flattened-tree link while
        // using a real ShadowRoot for the non-composed event boundary below.
        Object.defineProperty(anchor, 'assignedSlot', { configurable: true, value: slot });
      } else scroller.append(anchor);
      document.body.append(host, floating);
      const { lease, onResolved } = attach(anchor, floating);
      try {
        await flush();
        scroller.style.overflow = 'auto';
        setRect(anchor, rect(100, 80, 50, 20));
        // Native element scroll does not cross its shadow boundary.
        scroller.dispatchEvent(new Event('scroll'));
        await flush();
        expect(floating.style.top).toBe('104px');
        lease.dispose();
        onResolved.mockClear();
        setRect(anchor, rect(100, 60, 50, 20));
        scroller.dispatchEvent(new Event('scroll'));
        await flush();
        expect(onResolved).not.toHaveBeenCalled();
      } finally {
        lease.dispose();
      }
    }
  );

  it('uses the actual scroll origin rather than a retargeted shadow host', async () => {
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    const anchor = document.createElement('button');
    const unrelated = document.createElement('div');
    const floating = document.createElement('div');
    root.append(anchor, unrelated);
    document.body.append(host, floating);
    const { lease, onResolved } = attach(anchor, floating);
    try {
      await flush();
      const cap = floating.style.getPropertyValue('--proto-ui-available-height');
      expect(cap).toMatch(/px$/);
      onResolved.mockClear();
      // A composed synthetic event exercises retargeting; it does not stand
      // in for the browser's non-composed native scroll acceptance.
      unrelated.dispatchEvent(new Event('scroll', { composed: true }));
      expect(floating.style.getPropertyValue('--proto-ui-available-height')).toBe(cap);
      await flush();
      expect(onResolved).not.toHaveBeenCalled();
    } finally {
      lease.dispose();
    }
  });

  it('refreshes shadow observation after a same-target update and releases the old root', async () => {
    const firstHost = document.createElement('div');
    const secondHost = document.createElement('div');
    const firstRoot = firstHost.attachShadow({ mode: 'open' });
    const secondRoot = secondHost.attachShadow({ mode: 'open' });
    const firstScroller = document.createElement('div');
    const secondScroller = document.createElement('div');
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    firstScroller.append(anchor);
    firstRoot.append(firstScroller);
    secondRoot.append(secondScroller);
    document.body.append(firstHost, secondHost, floating);
    const { lease, onResolved } = attach(anchor, floating);
    const removedFromFirst = vi.spyOn(firstRoot, 'removeEventListener');
    const removedFromSecond = vi.spyOn(secondRoot, 'removeEventListener');
    try {
      await flush();
      secondScroller.append(anchor);
      lease.update({ anchor, floating, config: baseConfig, onResolved });
      await flush();
      expect(removedFromFirst).toHaveBeenCalledWith('scroll', expect.any(Function), true);
      onResolved.mockClear();
      secondScroller.style.overflow = 'auto';
      setRect(anchor, rect(100, 80, 50, 20));
      secondScroller.dispatchEvent(new Event('scroll'));
      await flush();
      expect(onResolved).toHaveBeenCalled();
      expect(floating.style.top).toBe('104px');
      lease.dispose();
      expect(removedFromSecond).toHaveBeenCalledWith('scroll', expect.any(Function), true);
    } finally {
      lease.dispose();
      removedFromFirst.mockRestore();
      removedFromSecond.mockRestore();
    }
  });

  it('allows the same composed scroll event to be dispatched again after propagation', async () => {
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    const scroller = document.createElement('div');
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    scroller.append(anchor);
    root.append(scroller);
    document.body.append(host, floating);
    const { lease, onResolved } = attach(anchor, floating);
    try {
      await flush();
      scroller.style.overflow = 'auto';
      const event = new Event('scroll', { composed: true });
      for (const y of [80, 60]) {
        onResolved.mockClear();
        setRect(anchor, rect(100, y, 50, 20));
        scroller.dispatchEvent(event);
        await flush();
        expect(floating.style.top).toBe(`${y + 24}px`);
        expect(onResolved).toHaveBeenCalledTimes(1);
      }
    } finally {
      lease.dispose();
    }
  });
});

it('updates a same-size anchor when only root space changes and releases that observation', async () => {
  const root = document.documentElement;
  const oldWidth = Object.getOwnPropertyDescriptor(root, 'clientWidth');
  const oldObserver = Object.getOwnPropertyDescriptor(window, 'ResizeObserver');
  let width = 1000;
  Object.defineProperty(root, 'clientWidth', { configurable: true, get: () => width });
  const observers: { targets: Set<Element>; fire(): void; disconnect: ReturnType<typeof vi.fn> }[] =
    [];
  class Resize {
    targets = new Set<Element>();
    disconnect = vi.fn(() => this.targets.clear());
    constructor(callback: ResizeObserverCallback) {
      observers.push({
        targets: this.targets,
        fire: () =>
          callback(
            [
              {
                target: root,
                contentRect: root.getBoundingClientRect(),
                borderBoxSize: [],
                contentBoxSize: [],
                devicePixelContentBoxSize: [],
              },
            ],
            this as unknown as ResizeObserver
          ),
        disconnect: this.disconnect,
      });
    }
    observe(target: Element) {
      this.targets.add(target);
    }
    unobserve(target: Element) {
      this.targets.delete(target);
    }
  }
  vi.stubGlobal('ResizeObserver', Resize);
  Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: Resize });
  const anchor = document.createElement('button'),
    floating = document.createElement('div');
  document.body.append(anchor, floating);
  setRect(anchor, rect(100, 100, 50, 20));
  setRect(floating, rect(0, 0, 40, 10));
  const lease = createFloatingUiAnchoredPositionHost().attach({
    anchor,
    floating,
    config: baseConfig,
  });
  try {
    await flush();
    expect(floating.style.left).toBe('100px');
    const observer = observers.find((o) => o.targets.has(root));
    expect(observer).toBeDefined();
    width = 985;
    setRect(anchor, rect(92.5, 100, 50, 20));
    observer!.fire();
    await flush();
    expect(floating.style.left).toBe('92.5px');
    width = 1000;
    setRect(anchor, rect(100, 100, 50, 20));
    observer!.fire();
    await flush();
    expect(floating.style.left).toBe('100px');
    lease.dispose();
    expect(observer!.disconnect).toHaveBeenCalledTimes(1);
    width = 985;
    setRect(anchor, rect(92.5, 100, 50, 20));
    observer!.fire();
    await flush();
    expect(floating.style.left).toBe('100px');
  } finally {
    lease.dispose();
    vi.unstubAllGlobals();
    if (oldObserver) Object.defineProperty(window, 'ResizeObserver', oldObserver);
    else Reflect.deleteProperty(window, 'ResizeObserver');
    if (oldWidth) Object.defineProperty(root, 'clientWidth', oldWidth);
    else Reflect.deleteProperty(root, 'clientWidth');
  }
});

it('positions an opaque pointer origin and switches back to element geometry without changing Portal policy', async () => {
  const trigger = document.createElement('button'),
    floating = document.createElement('div');
  document.body.append(trigger, floating);
  setRect(trigger, rect(100, 100, 50, 20));
  setRect(floating, rect(0, 0, 40, 10));
  const point = createWebInputOriginAnchor(trigger, { x: 170, y: 210 });
  const lease = createFloatingUiAnchoredPositionHost().attach({
    anchor: point.anchor,
    floating,
    config: baseConfig,
  });
  await flush();
  expect(floating.style.left).toBe('170px');
  expect(floating.style.top).toBe('214px');
  expect(floating.style.getPropertyValue('--proto-ui-anchor-width')).toBe('0px');
  expect(floating.style.transform).toBe('');
  point.dispose();
  const keyboard = createWebInputOriginAnchor(trigger);
  lease.update({ anchor: keyboard.anchor, floating, config: baseConfig });
  await flush();
  expect(floating.style.left).toBe('100px');
  expect(floating.style.top).toBe('124px');
  lease.dispose();
  keyboard.dispose();
});
