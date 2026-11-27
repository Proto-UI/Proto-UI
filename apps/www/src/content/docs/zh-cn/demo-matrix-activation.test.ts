import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Page } from 'playwright-core';
import { activateMatrixPreviews, waitForMatrixInitialization } from './demo-matrix-activation';
import { matrixPreviewersInitialized } from './demo-matrix-observation';
import { initPreviewerBootstrap } from '../../../components/PrototypePreviewer/previewer-bootstrap';
import { initPreviewer } from '../../../components/PrototypePreviewer/previewer-client';
import { WEBSITE_SHADCN_THEME_TOKENS } from '../../../components/PrototypePreviewer/projection-theme';
import * as renderer from '../../../components/PrototypePreviewer/demo-renderer';
import { loadDemo } from '../../../components/PrototypePreviewer/demo-modules';
import { collectPrototypeIds } from '../../../components/PrototypePreviewer/demo-types';
import { loadPrototypes } from '../../../components/PrototypePreviewer/prototype-modules';

// Happy DOM has no layout/intersection engine. Emulate only that UA boundary
// below; the real bootstrap, initPreviewer and renderers own every inited write.
// These controls do not stand in for the full native Matrix consumer.
vi.mock('../../../components/PrototypePreviewer/runtimes/react-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/react/package.json');
  return {
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
vi.mock('../../../components/PrototypePreviewer/runtimes/vue-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/apps/www/package.json');
  return { loadVue: async () => require('vue') };
});
vi.mock('../../../components/PrototypePreviewer/runtimes/vue2-runtime', async (original) => {
  const current =
    await original<typeof import('../../../components/PrototypePreviewer/runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/vue2/package.json');
  return { ...current, loadVue2: async () => require('vue') };
});

beforeAll(async () => {
  // This fixture injects an already-delivered Previewer client and measures
  // native viewport admission, not Vite's cold framework module transforms.
  // Prepare the exact real fixture dependencies before either measured budget;
  // all eight owners still initialize and render through the real bootstrap.
  const demo = await loadDemo('demo-base-text');
  const prototypeIds = new Set<string>();
  collectPrototypeIds(demo.root, prototypeIds);
  await Promise.all([
    loadPrototypes([...prototypeIds]),
    ...(['wc', 'react', 'vue', 'vue2'] as const).map(renderer.prepareDemoRuntime),
  ]);
});

type Root = HTMLElement & {
  __previewer__?: { destroy(): Promise<void>; getCurrentRuntime(): string | null };
};
let dispose: (() => void) | undefined;
const roots: Root[] = [];
const intersections = new Set<{ root: Element; deliver(visible: boolean): void }>();
const positions = new Map<Element, { top: number; left: number; width: number; height: number }>();
let deliverIntersections = true;
let scrollCost = 0;
let clock: number | undefined;
let beforeIntersection: (() => void) | undefined;
const flushIntersections = () => {
  beforeIntersection?.();
  beforeIntersection = undefined;
  if (!deliverIntersections) return;
  for (const item of intersections) {
    const r = item.root.getBoundingClientRect();
    item.deliver(
      r.bottom > -360 &&
        r.top < window.innerHeight + 360 &&
        r.right > 0 &&
        r.left < window.innerWidth
    );
  }
};

beforeEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  roots.length = 0;
  intersections.clear();
  positions.clear();
  deliverIntersections = true;
  scrollCost = 0;
  clock = undefined;
  beforeIntersection = undefined;
  delete (window as any).__puiMatrixActivation;
  vi.stubGlobal('innerWidth', 1440);
  vi.stubGlobal('innerHeight', 900);
  vi.stubGlobal('scrollX', 0);
  vi.stubGlobal('scrollY', 0);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => {
      callback(performance.now());
      flushIntersections();
    }, 1)
  );
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      entries = new Map<Element, { root: Element; deliver(visible: boolean): void }>();
      constructor(readonly callback: IntersectionObserverCallback) {}
      observe(root: Element) {
        if (this.entries.has(root)) return;
        const entry = {
          root,
          deliver: (isIntersecting: boolean) =>
            this.callback(
              [
                {
                  isIntersecting,
                  target: root,
                  time: window.performance.now(),
                } as IntersectionObserverEntry,
              ],
              this as any
            ),
        };
        this.entries.set(root, entry);
        intersections.add(entry);
      }
      unobserve(root: Element) {
        const entry = this.entries.get(root);
        if (entry) intersections.delete(entry);
        this.entries.delete(root);
      }
      disconnect() {
        for (const entry of this.entries.values()) intersections.delete(entry);
        this.entries.clear();
      }
    }
  );
  vi.spyOn(window, 'scrollTo').mockImplementation(
    (options: ScrollToOptions | number, top?: number) => {
      Object.assign(
        window,
        typeof options === 'number'
          ? { scrollX: options, scrollY: top ?? 0 }
          : { scrollX: options.left ?? window.scrollX, scrollY: options.top ?? window.scrollY }
      );
    }
  );
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(function (
    this: HTMLElement
  ) {
    if (clock !== undefined) clock += scrollCost;
    window.scrollTo({ top: positions.get(this)!.top - 100, left: 0 });
  });
  for (const token of WEBSITE_SHADCN_THEME_TOKENS)
    document.documentElement.style.setProperty(
      `--pui-${token}`,
      token.startsWith('radius') ? '4px' : '#ffffff'
    );
});

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(roots.map((root) => root.__previewer__?.destroy()));
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  for (const token of WEBSITE_SHADCN_THEME_TOKENS)
    document.documentElement.style.removeProperty(`--pui-${token}`);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function fixture(narrow = false) {
  if (narrow) vi.stubGlobal('innerWidth', 390);
  for (let demo = 0; demo < 2; demo++) {
    const item = document.createElement('article');
    item.className = 'demo-matrix__item';
    item.id = `fixture-${demo}`;
    document.body.append(item);
    for (const [column, runtime] of ['wc', 'react', 'vue', 'vue2'].entries()) {
      const adapter = document.createElement('section');
      adapter.className = 'demo-matrix__adapter';
      const root = document.createElement('div') as Root;
      root.className = 'proto-previewer';
      root.dataset.previewerId = `fixture-${demo}-${runtime}`;
      root.dataset.demoId = 'demo-base-text';
      root.dataset.runtimes = JSON.stringify([runtime]);
      root.dataset.initialRuntime = runtime;
      root.dataset.lazy = 'true';
      root.innerHTML =
        '<div data-panel="preview"><div class="host"><div class="proto-previewer__skeleton" role="status">Loading</div></div></div>';
      for (const scope of [root, root.querySelector<HTMLElement>('.host')!])
        for (const token of WEBSITE_SHADCN_THEME_TOKENS)
          scope.style.setProperty(`--pui-${token}`, token.startsWith('radius') ? '4px' : '#ffffff');
      positions.set(root, {
        top: 2000 + (narrow ? demo * 4 + column : demo) * 1400,
        left: narrow ? 0 : column * 340,
        width: 300,
        height: 300,
      });
      vi.spyOn(root, 'getBoundingClientRect').mockImplementation(() => {
        const p = positions.get(root)!;
        return new DOMRect(p.left - window.scrollX, p.top - window.scrollY, p.width, p.height);
      });
      adapter.append(root);
      item.append(adapter);
      roots.push(root);
    }
  }
  const load = vi.fn(async () => ({ initPreviewer }));
  dispose = initPreviewerBootstrap(document, load);
  document.dispatchEvent(new Event('astro:page-load'));
  return { load };
}

function pageFixture() {
  const waitForFunction = vi.fn(
    async (
      predicate: (count: number) => boolean,
      count: number,
      { timeout }: { timeout: number }
    ) => {
      await vi.waitFor(() => expect(predicate(count)).toBe(true), { timeout, interval: 5 });
    }
  );
  return {
    page: {
      evaluate: (fn: any, argument: any) => fn(argument),
      waitForFunction,
    } as unknown as Pick<Page, 'evaluate' | 'waitForFunction'>,
    waitForFunction,
  };
}

const waitForMountedRuntimes = () =>
  vi.waitFor(
    () =>
      expect(roots.map((root) => root.__previewer__?.getCurrentRuntime())).toEqual([
        'wc',
        'react',
        'vue',
        'vue2',
        'wc',
        'react',
        'vue',
        'vue2',
      ]),
    { timeout: 1000 } // Pin the pre-existing vi.waitFor default; never renew it.
  );

describe('complete Matrix activation keeps the original inited deadline', () => {
  it('the unchanged no-scroll predicate stays at zero for the whole 60s negative control', async () => {
    const { load } = fixture();
    vi.useFakeTimers();
    const deadline = Date.now() + 60_000;
    const observations: boolean[] = [];
    // Model only Playwright's polling/timer boundary. The tested predicate is
    // the unchanged actual browser predicate, and no fixture writes inited.
    const waiting = new Promise<void>((resolve, reject) => {
      const poll = () => {
        const ready = matrixPreviewersInitialized(4);
        observations.push(ready);
        if (ready) resolve();
        else if (Date.now() >= deadline)
          reject(new Error('Original 60000ms inited wait timed out'));
        else setTimeout(poll, 1000);
      };
      poll();
    }).then(
      () => null,
      (error: Error) => error
    );
    await vi.advanceTimersByTimeAsync(60_000);
    expect((await waiting)?.message).toBe('Original 60000ms inited wait timed out');
    expect(observations).toHaveLength(61);
    expect(observations.every((ready) => !ready)).toBe(true);
    expect(load).not.toHaveBeenCalled();
    expect(roots.every((root) => root.dataset.inited === undefined)).toBe(true);
  });

  for (const narrow of [false, true]) {
    it(`scrolls every actual cell with ${narrow ? 'four stacked mobile hosts' : 'four desktop columns'}, then retains mounted owners`, async () => {
      const { load } = fixture(narrow);
      const { page, waitForFunction } = pageFixture();
      await waitForMatrixInitialization(page, 4);
      expect(matrixPreviewersInitialized(4)).toBe(true);
      expect(load).toHaveBeenCalledTimes(8);
      const receipt = (window as any).__puiMatrixActivation;
      expect(receipt.status).toBe('covered');
      expect(receipt.visited).toHaveLength(8);
      expect(receipt.scrolls).toBe(narrow ? 8 : 2);
      expect(receipt.restoredScroll).toEqual({ x: 0, y: 0 });
      expect(waitForFunction.mock.calls[0]![2].timeout).toBeLessThan(60_000);
      const owners = roots.map((root) => root.__previewer__);
      await waitForMountedRuntimes();
      await waitForMatrixInitialization(page, 4);
      roots.forEach((root, index) => expect(root.__previewer__).toBe(owners[index]));
      expect(load).toHaveBeenCalledTimes(8);
      expect((window as any).__puiMatrixActivation.scrolls).toBe(0);
    });
  }

  it('retains the original 1s mounted-owner deadline when an actual renderer cannot publish', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let enter!: () => void;
    const entered = new Promise<void>((resolve) => {
      enter = resolve;
    });
    const render = renderer.renderDemo;
    vi.spyOn(renderer, 'renderDemo').mockImplementation(async (options) => {
      const result = await render(options);
      if (options.runtime === 'wc') {
        enter();
        await gate;
      }
      return result;
    });
    try {
      fixture();
      const { page } = pageFixture();
      await waitForMatrixInitialization(page, 4);
      await entered;
      expect(matrixPreviewersInitialized(4)).toBe(true);
      // This is the same real 1000ms waiter used by both positive cases. The
      // real rendered result stays held until after its rejection is observed.
      await expect(waitForMountedRuntimes()).rejects.toThrow();
      expect(
        roots
          .filter((root) => root.dataset.initialRuntime === 'wc')
          .map((root) => root.__previewer__?.getCurrentRuntime())
      ).toEqual([null, null]);
    } finally {
      release();
    }
  });

  it('does not count a viewport visit as initialization when no intersection is delivered', async () => {
    const { load } = fixture(true);
    deliverIntersections = false;
    const now = Date.now();
    const receipt = await activateMatrixPreviews({ startedAt: now, deadline: now + 60_000 });
    expect(receipt.status).toBe('covered');
    expect(receipt.visited).toHaveLength(8);
    expect(receipt.missingAtTraversalEnd).toHaveLength(8);
    expect(matrixPreviewersInitialized(4)).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it('revisits an actual target displaced by earlier asynchronous row layout', async () => {
    fixture();
    beforeIntersection = () => {
      for (const root of roots.slice(0, 4)) positions.get(root)!.top += 2000;
    };
    const { page } = pageFixture();
    await waitForMatrixInitialization(page, 4);
    expect(matrixPreviewersInitialized(4)).toBe(true);
    const receipt = (window as any).__puiMatrixActivation;
    expect(receipt.status).toBe('covered');
    expect(receipt.layoutRevisits).toBe(1);
    expect(receipt.visited).toHaveLength(8);
    expect(receipt.restoredScroll).toEqual({ x: 0, y: 0 });
  });

  it('uses one deadline across batches, fails at exhausted time and still restores scrolling', async () => {
    fixture();
    clock = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => clock!);
    scrollCost = 30_000;
    const { page, waitForFunction } = pageFixture();
    await expect(waitForMatrixInitialization(page, 4)).rejects.toThrow('original 60000ms');
    const receipt = (window as any).__puiMatrixActivation;
    expect(receipt.deadline - receipt.startedAt).toBe(60_000);
    expect(receipt.finishedAt).toBe(receipt.deadline);
    expect(receipt.status).toBe('failed');
    expect(receipt.visited).toHaveLength(4);
    expect(receipt.missingAtTraversalEnd).toHaveLength(4);
    expect(waitForFunction).not.toHaveBeenCalled();
    expect(receipt.restoredScroll).toEqual({ x: 0, y: 0 });
  });

  it('the runner deadline rejects a blocked renderer and a late reply cannot start a renewed wait', async () => {
    vi.useFakeTimers();
    let resolve!: (value: unknown) => void;
    const waitForFunction = vi.fn();
    const page = {
      evaluate: () =>
        new Promise((done) => {
          resolve = done;
        }),
      waitForFunction,
    } as unknown as Pick<Page, 'evaluate' | 'waitForFunction'>;
    const waiting = expect(waitForMatrixInitialization(page, 4)).rejects.toThrow(
      'original 60000ms'
    );
    await vi.advanceTimersByTimeAsync(60_000);
    await waiting;
    resolve({ status: 'covered' });
    await vi.advanceTimersByTimeAsync(0);
    expect(waitForFunction).not.toHaveBeenCalled();
  });

  it('a non-scrolling control cannot claim viewport coverage and restoration errors preserve the first failure', async () => {
    fixture(true);
    vi.mocked(HTMLElement.prototype.scrollIntoView).mockImplementation(() => {});
    vi.mocked(window.scrollTo).mockImplementation(() => {
      throw new Error('restore failed');
    });
    const now = Date.now();
    const receipt = await activateMatrixPreviews({ startedAt: now, deadline: now + 60_000 });
    expect(receipt.status).toBe('failed');
    expect(receipt.error).toContain('Native scrolling did not expose');
    expect(receipt.restorationError).toBe('restore failed');
    expect(receipt.visited).toEqual([]);
    expect(receipt.missingAtTraversalEnd).toHaveLength(8);
    expect(matrixPreviewersInitialized(4)).toBe(false);
  });
});
