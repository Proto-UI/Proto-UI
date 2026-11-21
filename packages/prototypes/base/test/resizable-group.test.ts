import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as base from '../src/resizable';
import * as shadcn from '../../shadcn/src/resizable';
import * as brutalist from '../../brutalist/src/resizable';
import * as bootstrap from '../../bootstrap-2-3-2/src/resizable';
import * as liquid from '../../liquid-glass/src/resizable';
const { resizableConstraints, normalizeResizableSizes, resizeAdjacentPanels } = base;
const flush = async () => {
  for (let i = 0; i < 32; i++) await Promise.resolve();
};
const roots: HTMLElement[] = [];
const layoutBoxes = new Map<Element, () => { width: number; height: number }>();
let restoreLayoutStyles: (() => void) | undefined;
afterEach(async () => {
  roots.splice(0).forEach((el) => el.remove());
  await flush();
  restoreLayoutStyles?.();
  restoreLayoutStyles = undefined;
  layoutBoxes.clear();
});
function element(proto: any, props: Record<string, unknown> = {}): any {
  if (!customElements.get(proto.name)) AdaptToWebComponent(proto);
  const el = document.createElement(proto.name);
  setElementProps(el, props);
  return el;
}
async function group(
  family: Pick<typeof base, 'resizableRoot' | 'resizablePanel' | 'resizableHandle'> = base,
  props: Record<string, unknown> = {},
  count = 3,
  append = true
) {
  const root = element(family.resizableRoot, { defaultSizes: [25, 35, 40], ...props });
  const panels = Array.from({ length: count }, (_, index) =>
    element(family.resizablePanel, { index })
  );
  const handles = Array.from({ length: count - 1 }, (_, index) =>
    element(family.resizableHandle, { index })
  );
  panels.forEach((panel, index) => {
    root.append(panel);
    if (handles[index]) root.append(handles[index]);
  });
  const changes: any[] = [],
    commits: any[] = [];
  root.addEventListener('sizesChange', (e: CustomEvent) => {
    if (e.target === root) changes.push(e.detail.sizes);
  });
  root.addEventListener('sizesCommit', (e: CustomEvent) => {
    if (e.target === root) commits.push(e.detail.sizes);
  });
  if (append) {
    document.body.append(root);
    roots.push(root);
    await flush();
  }
  return { root, panels, handles, changes, commits, api: () => root.getExposes() };
}
function geometry(
  g: Awaited<ReturnType<typeof group>>,
  width = 600,
  height = 300,
  vertical = false
) {
  const available = (vertical ? height : width) - 16 * g.handles.length;
  const rootBox = () => ({ left: 0, top: 0, width, height });
  layoutBoxes.set(g.root, rootBox);
  g.root.getBoundingClientRect = () => rootBox() as DOMRect;
  g.panels.forEach((panel, index) => {
    const box = () => ({
      left: 0,
      top: 0,
      width: vertical ? width : (available * g.api().sizes.get()[index]) / 100,
      height: vertical ? (available * g.api().sizes.get()[index]) / 100 : height,
    });
    panel.getBoundingClientRect = () => box() as DOMRect;
    layoutBoxes.set(panel, box);
  });
  // Resolve only these fixture boxes through the same live dimensions used
  // by their rects, including panel redistribution and nested group ownership.
  if (!restoreLayoutStyles) {
    const originalStyle = window.getComputedStyle.bind(window);
    const mock = vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
      const actual = originalStyle(element, pseudo);
      const box = layoutBoxes.get(element);
      if (!box) return actual;
      return new Proxy(actual, {
        get(target, key) {
          if (key === 'width' || key === 'height') return `${box()[key]}px`;
          if (key === 'boxSizing') return 'border-box';
          const value = Reflect.get(target, key, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    });
    restoreLayoutStyles = () => mock.mockRestore();
  }
  return available;
}
function pointer(el: HTMLElement, type: string, x: number, y = 20) {
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      isPrimary: true,
      clientX: x,
      clientY: y,
    })
  );
}

describe('constrained complete group model', () => {
  it('normalizes then projects a full vector without moving unrelated entries during resize', () => {
    const c = resizableConstraints(3, [
      { min: 20, max: 60 },
      { min: 10, max: 40 },
      { min: 10, max: 70 },
    ])!;
    const layout = normalizeResizableSizes([1, 2, 7], c)!;
    expect(layout).toEqual([20, 15, 65]);
    expect(resizeAdjacentPanels(layout, c, 0, 55)).toEqual([25, 10, 65]);
    expect(Object.isFrozen(layout)).toBe(true);
  });
  it('rejects infeasible, nonfinite, incomplete, negative and out-of-range inputs', () => {
    const c = resizableConstraints(3)!;
    for (const input of [
      [0, 0, 0],
      [20, NaN, 80],
      [20, -10, 90],
      [50, 50],
    ])
      expect(normalizeResizableSizes(input, c)).toBeNull();
    expect(resizableConstraints(2, [{ min: 80, max: 20 }])).toBeNull();
    expect(
      normalizeResizableSizes([50, 50], resizableConstraints(2, [{ min: 60 }, { min: 60 }])!)
    ).toBeNull();
    expect(resizeAdjacentPanels([25, 35, 40], c, 2, 50)).toBeNull();
    expect(resizeAdjacentPanels([25, 35, 40], c, 0.5, 50)).toBeNull();
  });
  it('keeps collapse a discrete stop while respecting both adjacent constraints', () => {
    const c = resizableConstraints(3, [
      { min: 20, max: 60, collapsible: true },
      { min: 10, max: 60 },
      { min: 10 },
    ])!;
    expect(resizeAdjacentPanels([25, 35, 40], c, 0, 7)).toEqual([0, 60, 40]);
    expect(resizeAdjacentPanels([25, 35, 40], c, 0, 12)).toEqual([20, 40, 40]);
    const limited = resizableConstraints(3, [{ min: 20, collapsible: true }, { max: 40 }, {}])!;
    expect(resizeAdjacentPanels([25, 35, 40], limited, 0, 0)).toEqual([20, 40, 40]);
  });
  it('preserves the total and every bound over multiple feasible group sizes', () => {
    for (let n = 2; n <= 12; n++) {
      const c = resizableConstraints(
        n,
        Array.from({ length: n }, () => ({ min: 1, max: 100 }))
      )!;
      let sizes = normalizeResizableSizes(
        Array.from({ length: n }, (_, i) => i + 1),
        c
      )!;
      for (let index = 0; index < n - 1; index++)
        for (const target of [-20, 0, 30, 75, 150]) {
          const next = resizeAdjacentPanels(sizes, c, index, target)!;
          expect(next.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
          next.forEach((size, i) => {
            expect(size).toBeGreaterThanOrEqual(1 - 1e-10);
            if (i !== index && i !== index + 1) expect(size).toBe(sizes[i]);
          });
          sizes = next;
        }
    }
  });
});

it.each([
  ['base', base],
  ['shadcn', shadcn],
  ['brutalist', brutalist],
  ['bootstrap', bootstrap],
  ['liquid', liquid],
] as const)(
  '%s carries multi-panel sizes, constraints and indexed handles through the actual family',
  async (_name, family) => {
    const g = await group(family);
    expect(g.panels.map((p) => p.getExposes().size.get())).toEqual([25, 35, 40]);
    expect(g.handles.map((h) => h.getExposes().value.get())).toEqual([25, 35]);
    expect(g.api().requestResize(1, 50, true)).toBe(true);
    await flush();
    expect(g.api().sizes.get()).toEqual([25, 50, 25]);
    expect(g.panels.map((p) => p.getExposes().size.get())).toEqual([25, 50, 25]);
    expect(g.commits).toEqual([[25, 50, 25]]);
  }
);
it('controlled requests preserve owner truth, coalesce gestures and allow rejected retries', async () => {
  const g = await group(base, { sizes: [25, 35, 40] });
  g.api().requestResize(1, 50);
  g.api().requestResize(1, 50);
  expect(g.changes).toEqual([[25, 50, 25]]);
  expect(g.api().sizes.get()).toEqual([25, 35, 40]);
  expect(g.panels[1].getExposes().size.get()).toBe(35);
  g.api().requestResize(1, 50, true);
  g.api().requestResize(1, 50, true);
  expect(g.changes).toHaveLength(2);
  expect(g.commits).toHaveLength(2);
  setElementProps(g.root, { sizes: [25, 50, 25] });
  await flush();
  expect(g.api().sizes.get()).toEqual([25, 50, 25]);
});
it('synchronous controlled acceptance preserves the one commit event', async () => {
  const g = await group(base, { sizes: [25, 35, 40] });
  g.root.addEventListener('sizesChange', (e: CustomEvent) =>
    setElementProps(g.root, { sizes: [...e.detail.sizes] })
  );
  g.api().requestResize(1, 45, true);
  await flush();
  expect(g.api().sizes.get()).toEqual([25, 45, 30]);
  expect(g.commits).toEqual([[25, 45, 30]]);
});
it('invalid owner geometry/configuration blocks changes without publishing a partial vector', async () => {
  const g = await group();
  setElementProps(g.root, {
    defaultSizes: [25, 35, 40],
    constraints: [{ min: 80 }, { min: 80 }, {}],
  });
  await flush();
  expect(g.api().sizes.get()).toEqual([25, 35, 40]);
  expect(g.api().requestResize(0, 50, true)).toBe(false);
  expect(g.handles[0].getExposes().disabled.get()).toBe(true);
  expect(g.changes).toEqual([]);
});
it.each(['disabled', 'readOnly'])('%s rejects imperative and pointer requests', async (flag) => {
  const g = await group(base, { [flag]: true });
  geometry(g);
  expect(g.api().requestResize(1, 50, true)).toBe(false);
  pointer(g.handles[1], 'pointerdown', 300);
  pointer(g.handles[1], 'pointermove', 350);
  pointer(g.handles[1], 'pointerup', 350);
  expect(g.api().sizes.get()).toEqual([25, 35, 40]);
  expect(g.changes).toEqual([]);
});
it.each([
  ['horizontal', 'ltr', 1],
  ['horizontal', 'rtl', -1],
  ['vertical', 'ltr', 1],
] as const)(
  'continuously resizes %s %s using panel extent, excludes separators, and commits once',
  async (orientation, direction, sign) => {
    const g = await group(base, { orientation, direction });
    const vertical = orientation === 'vertical',
      available = geometry(g, 600, 300, vertical);
    const h = g.handles[1];
    pointer(h, 'pointerdown', 100, 100);
    pointer(
      h,
      'pointermove',
      vertical ? 100 : 100 + available * 0.1 * sign,
      vertical ? 100 + available * 0.1 : 100
    );
    expect(g.api().sizes.get()[1]).toBeCloseTo(45, 8);
    expect(g.commits).toHaveLength(0);
    pointer(
      h,
      'pointerup',
      vertical ? 100 : 100 + available * 0.15 * sign,
      vertical ? 100 + available * 0.15 : 100
    );
    expect(g.api().sizes.get()[1]).toBeCloseTo(50, 8);
    expect(g.commits).toHaveLength(1);
    expect(g.api().sizes.get()[0]).toBe(25);
  }
);
it('cancellation clears controlled proposal history and a later gesture can retry', async () => {
  const g = await group(base, { sizes: [25, 35, 40] });
  const extent = geometry(g);
  for (let i = 0; i < 2; i++) {
    pointer(g.handles[1], 'pointerdown', 100);
    pointer(g.handles[1], 'pointermove', 100 + extent * 0.1);
    pointer(g.handles[1], 'pointercancel', 100 + extent * 0.1);
  }
  expect(g.changes).toHaveLength(2);
  expect(g.commits).toEqual([]);
  expect(g.api().sizes.get()).toEqual([25, 35, 40]);
});
it('keyboard and accessible separator values use the indexed adjacent constraints', async () => {
  const g = await group(base, { constraints: [{ min: 10 }, { min: 20, max: 50 }, { min: 25 }] });
  const h = g.handles[1];
  h.focus();
  await flush();
  h.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
  expect(g.api().sizes.get()).toEqual([25, 50, 25]);
  expect(h.getAttribute('aria-valuenow')).toBe('50');
  expect(h.getAttribute('aria-valuemax')).toBe('50');
  h.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
  );
  expect(g.api().sizes.get()).toEqual([25, 40, 35]);
});
it('nested groups retain their nearest owner, constraints and displacement basis', async () => {
  const outer = await group();
  const inner = await group(base, { defaultSizes: [40, 60], orientation: 'vertical' }, 2, false);
  outer.panels[1].append(inner.root);
  await flush();
  geometry(outer);
  const extent = geometry(inner, 240, 300, true);
  pointer(inner.handles[0], 'pointerdown', 20, 80);
  pointer(inner.handles[0], 'pointermove', 20, 80 + extent * 0.1);
  pointer(inner.handles[0], 'pointerup', 20, 80 + extent * 0.1);
  expect(inner.api().sizes.get()[0]).toBeCloseTo(50, 8);
  expect(outer.api().sizes.get()).toEqual([25, 35, 40]);
  expect(outer.changes).toEqual([]);
  outer.api().requestResize(0, 30, true);
  expect(outer.api().sizes.get()).toEqual([30, 30, 40]);
  expect(inner.api().sizes.get()[0]).toBeCloseTo(50, 8);
});
it('changing an active handle index cancels stale end and remount rebinds its owner', async () => {
  const g = await group();
  geometry(g);
  pointer(g.handles[0], 'pointerdown', 100);
  setElementProps(g.handles[0], { index: 1 });
  await flush();
  pointer(g.handles[0], 'pointerup', 200);
  expect(g.changes).toEqual([]);
  expect(g.commits).toEqual([]);
  g.handles[0].remove();
  await flush();
  g.root.append(g.handles[0]);
  await flush();
  pointer(g.handles[0], 'pointerdown', 100);
  pointer(g.handles[0], 'pointerup', 156.8);
  expect(g.api().sizes.get()[1]).toBeCloseTo(45, 8);
});

it('detaching an active handle retires its original proposal without a ghost commit', async () => {
  const g = await group(base, { sizes: [25, 35, 40] });
  geometry(g);
  pointer(g.handles[1], 'pointerdown', 100);
  pointer(g.handles[1], 'pointermove', 156.8);
  expect(g.changes).toHaveLength(1);
  g.handles[1].remove();
  await flush();
  pointer(g.handles[1], 'pointerup', 200);
  expect(g.commits).toEqual([]);
  g.api().requestResize(1, 45, true);
  expect(g.changes).toHaveLength(2);
});

it('projects the latest owner vector when a scalar observer synchronously replaces props', async () => {
  const g = await group(base, { sizes: [25, 35, 40] });
  const off = g.api().value.subscribe(() => {
    if (g.api().value.get() === 30) setElementProps(g.root, { sizes: [40, 30, 30] });
  });
  setElementProps(g.root, { sizes: [30, 40, 30] });
  await flush();
  off();
  expect(g.api().value.get()).toBe(40);
  expect(g.api().sizes.get()).toEqual([40, 30, 30]);
  expect(g.panels.map((panel) => panel.getExposes().size.get())).toEqual([40, 30, 30]);
});

it('keeps an uncontrolled request canonical across an unrelated synchronous props update', async () => {
  const g = await group();
  const off = g.api().value.subscribe(() => {
    if (g.api().value.get() === 30)
      setElementProps(g.root, { defaultSizes: [25, 35, 40], direction: 'rtl' });
  });
  g.api().requestResize(0, 30, true);
  await flush();
  off();
  expect(g.api().sizes.get()).toEqual([30, 30, 40]);
  expect(g.api().value.get()).toBe(30);
  expect(g.panels.map((panel) => panel.getExposes().size.get())).toEqual([30, 30, 40]);
  expect(g.commits).toEqual([[30, 30, 40]]);
});

it.each(['commit', 'cancel'])(
  'retires an outer commit after a nested %s terminal action',
  async (terminal) => {
    const g = await group(base, { defaultSizes: [50, 50] }, 2);
    const scalarCommits: number[] = [];
    g.root.addEventListener('valueChange', (e: CustomEvent) => {
      if (e.detail.value !== 60) return;
      if (terminal === 'commit') g.api().requestValue(70, true);
      else g.api().cancelResize();
    });
    g.root.addEventListener('valueCommit', (e: CustomEvent) => scalarCommits.push(e.detail.value));
    g.api().requestValue(60, true);
    expect(scalarCommits).toEqual(terminal === 'commit' ? [70] : []);
    expect(g.commits).toEqual(terminal === 'commit' ? [[70, 30]] : []);
  }
);

it('does not emit a stale scalar tail after sizesCommit triggers a newer committed request', async () => {
  const g = await group(base, { defaultSizes: [50, 50] }, 2);
  const commits: number[] = [];
  g.root.addEventListener('sizesCommit', (e: CustomEvent) => {
    if (e.detail.sizes[0] === 60) g.api().requestValue(70, true);
  });
  g.root.addEventListener('valueCommit', (e: CustomEvent) => commits.push(e.detail.value));
  g.api().requestValue(60, true);
  expect(commits).toEqual([70]);
  expect(g.api().sizes.get()).toEqual([70, 30]);
});

it('preserves an outer vector commit without clearing a newer uncommitted vector proposal', async () => {
  const g = await group(base, { sizes: [25, 35, 40] });
  g.root.addEventListener('sizesChange', (e: CustomEvent) => {
    if (e.detail.sizes[1] === 45) g.api().requestResize(1, 50);
  });
  g.api().requestResize(1, 45, true);
  g.api().requestResize(1, 50);
  expect(g.changes).toEqual([
    [25, 45, 30],
    [25, 50, 25],
  ]);
  expect(g.commits).toEqual([[25, 45, 30]]);
  expect(g.api().sizes.get()).toEqual([25, 35, 40]);
});
