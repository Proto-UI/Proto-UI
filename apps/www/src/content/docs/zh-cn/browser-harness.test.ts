import type { Locator, Page } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runtimeSelectTrigger, selectRuntime, startServer } from './browser-harness';

describe('runtime evidence counts the original demonstrated slot', () => {
  afterEach(() => document.body.replaceChildren());
  async function observed(runtime: 'wc' | 'react' | 'vue' | 'vue2') {
    let result: boolean | undefined;
    const click = async () => {};
    const trigger = { click, getAttribute: async () => 'runtime-options' };
    const previewer = { locator: () => ({ first: () => trigger }) } as unknown as Locator;
    const page = {
      locator: () => ({ getByRole: () => ({ last: () => ({ click }) }) }),
      waitForFunction: async (
        predicate: (args: unknown) => boolean,
        args: unknown,
        options: unknown
      ) => {
        expect(options).toEqual({ timeout: 20_000 });
        result = predicate(args);
      },
    } as unknown as Page;
    await selectRuntime(page, previewer, runtime, '[data-pui-root]', 2);
    return result;
  }
  function mount(runtime: 'wc' | 'react' | 'vue' | 'vue2') {
    const tag = runtime === 'wc' ? 'wc-test-command' : 'div';
    document.body.innerHTML = `<div data-previewer-id="test" data-projection-mode="fixed-family">
      <div class="host"><div data-projection-scope data-projection-runtime="${runtime}" data-projection-state="ready">
        <div data-projection-content><div class="pui-runtime-preview-surface" data-demo-ref="__website_runtime_preview_surface__" data-pui-root>
          <div data-original-demo ${runtime === 'vue' ? 'data-v-app' : ''}><${tag} data-pui-root></${tag}><${tag} data-pui-root></${tag}></div>
        </div></div>
      </div></div></div>`;
    if (runtime === 'vue2')
      Object.assign(document.querySelector('[data-original-demo] [data-pui-root]')!, {
        __vue__: {},
      });
  }
  it('keeps the remaining-component paint measurements on the same original slot', () => {
    const source = readFileSync(
      'apps/www/src/content/docs/zh-cn/demo-brutalist-remaining.browser.test.ts',
      'utf8'
    );
    const selector = source.match(
      /function roots\(previewer: Locator\): Locator \{\s*return previewer\.locator\(\s*'([^']+)'/
    )?.[1];
    expect(selector).toBeTruthy();
    mount('wc');
    const root = document.querySelector('[data-previewer-id]')!;
    expect(root.querySelectorAll(selector!)).toHaveLength(2);
    const slot = root.querySelector('[data-original-demo]')!;
    slot.append(slot.firstElementChild!.cloneNode());
    expect(root.querySelectorAll(selector!)).toHaveLength(3);
    expect(source).not.toContain("'[data-projection-content] [data-pui-root]'");
  });
  it.each(['demo-brutalist-controls', 'demo-brutalist-button'])(
    'keeps %s private physical-root selectors inside the demonstrated slot',
    (name) => {
      const source = readFileSync(
        `apps/www/src/content/docs/zh-cn/${name}.browser.test.ts`,
        'utf8'
      );
      const selectors = [
        ...source.matchAll(
          /'([^'\n]*\[data-projection-content\][^'\n]*\[data-pui-root\][^'\n]*)'/g
        ),
      ].map((match) => match[1]!);
      expect(selectors.length).toBeGreaterThan(0);
      mount('wc');
      const root = document.querySelector('[data-previewer-id]')!;
      for (const selector of selectors) {
        expect(selector).toContain(
          '.pui-runtime-preview-surface[data-demo-ref="__website_runtime_preview_surface__"]'
        );
        expect(document.querySelectorAll(selector)).toHaveLength(2);
      }
      root.querySelector('[data-original-demo]')!.append(document.createElement('div'));
      root
        .querySelector('[data-original-demo]')!
        .lastElementChild!.setAttribute('data-pui-root', '');
      for (const selector of selectors) expect(document.querySelectorAll(selector)).toHaveLength(3);
    }
  );
  it.each(['wc', 'react', 'vue', 'vue2'] as const)(
    'retains exact %s owner and two original roots',
    async (runtime) => {
      mount(runtime);
      expect(await observed(runtime)).toBe(true);
    }
  );
  it.each([
    'missing',
    'extra-inside',
    'extra-outside',
    'duplicate-boundary',
    'wrong-owner',
    'unmarked-boundary',
    'not-ready',
  ] as const)('rejects %s without increasing the expected root count', async (mutation) => {
    mount('wc');
    const content = document.querySelector('[data-projection-content]')!;
    const surface = content.firstElementChild!;
    const slot = document.querySelector('[data-original-demo]')!;
    if (mutation === 'missing') slot.firstElementChild!.remove();
    if (mutation === 'extra-inside') slot.append(slot.firstElementChild!.cloneNode());
    if (mutation === 'extra-outside') content.append(slot.firstElementChild!.cloneNode());
    if (mutation === 'duplicate-boundary') content.append(surface.cloneNode(true));
    if (mutation === 'wrong-owner')
      slot.innerHTML = '<div data-pui-root></div><div data-pui-root></div>';
    if (mutation === 'unmarked-boundary') surface.removeAttribute('data-demo-ref');
    if (mutation === 'not-ready')
      document.querySelector<HTMLElement>('[data-projection-scope]')!.dataset.projectionState =
        'preparing';
    expect(await observed('wc')).toBe(false);
  });
});

/** Resolve the real selector against DOM fixtures without launching a browser. */
function locatorFor(root: HTMLElement): Locator {
  return {
    locator(selector: string) {
      return { first: () => root.querySelector(selector) };
    },
  } as unknown as Locator;
}

describe('documentation runtime control locator', () => {
  it.each(['shadcn', 'brutalist'])(
    'uses the actual %s runtime Select through its shared accessible role',
    (family) => {
      const previewer = document.createElement('div');
      previewer.innerHTML = `
        <wc-${family}-select-root data-language-select-root>
          <wc-${family}-select-trigger role="combobox" data-control="language"></wc-${family}-select-trigger>
        </wc-${family}-select-root>
        <wc-${family}-select-root data-adapter-select-root>
          <wc-${family}-select-trigger role="combobox" data-control="runtime"></wc-${family}-select-trigger>
        </wc-${family}-select-root>`;
      const trigger = runtimeSelectTrigger(locatorFor(previewer)) as unknown as HTMLElement;
      expect(trigger?.dataset.control).toBe('runtime');
      expect(trigger?.localName).toBe(`wc-${family}-select-trigger`);
    }
  );

  it('keeps fixed-family runtime controls separate from other projection Selects', () => {
    const previewer = document.createElement('div');
    previewer.innerHTML = `
      <div data-projection-control="component"><div role="combobox" data-control="component"></div></div>
      <div data-projection-control="runtime"><div role="combobox" data-control="runtime"></div></div>`;
    const trigger = runtimeSelectTrigger(locatorFor(previewer)) as unknown as HTMLElement;
    expect(trigger?.dataset.control).toBe('runtime');
  });
});

describe('documentation server readiness diagnostics', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('accepts the observed 3.6s HTTP 200 response within the existing total budget', async () => {
    vi.useFakeTimers();
    vi.stubEnv('PROTO_UI_BROWSER_BASE_URL', 'http://documentation.test');
    // Native AbortSignal.timeout does not use Vitest's fake clock. Model its
    // real deadline so the old 2s abort remains a discriminating negative.
    vi.spyOn(AbortSignal, 'timeout').mockImplementation((delay) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), delay);
      return controller.signal;
    });
    const cancel = vi.fn().mockResolvedValue(undefined);
    const fetch = vi.fn(
      (_url, { signal }: RequestInit) =>
        new Promise((resolve, reject) => {
          const finish = () => {
            signal?.removeEventListener('abort', abort);
            clearTimeout(timer);
          };
          const abort = () => {
            finish();
            reject(signal?.reason);
          };
          const timer = setTimeout(() => {
            finish();
            resolve({ ok: true, status: 200, statusText: 'OK', body: { cancel } });
          }, 3_600);
          signal?.addEventListener('abort', abort, { once: true });
        })
    );
    vi.stubGlobal('fetch', fetch);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = startServer('/ready/').catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(125_000);
    expect(await result).toBe('http://documentation.test');
    expect(fetch).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('reports the last HTTP status immediately before rejecting the hook', async () => {
    vi.useFakeTimers();
    vi.stubEnv('PROTO_UI_BROWSER_BASE_URL', 'http://documentation.test');
    const cancel = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        body: { cancel },
      })
    );
    const output = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = startServer('/ready/').catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(await result).toMatchObject({
      message: expect.stringContaining('HTTP 503 Service Unavailable'),
    });
    expect(output).toHaveBeenCalledOnce();
    expect(output).toHaveBeenCalledWith(
      expect.stringContaining(
        '[browser-harness] readiness failed: Timed out waiting for http://documentation.test/ready/'
      )
    );
    expect(cancel).toHaveBeenCalled();
  });

  it('retains the latest connection error and cause instead of a prior HTTP response', async () => {
    vi.useFakeTimers();
    vi.stubEnv('PROTO_UI_BROWSER_BASE_URL', 'http://documentation.test');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' })
        .mockRejectedValue(
          new TypeError('fetch failed', { cause: new Error('connect ECONNREFUSED 127.0.0.1:1234') })
        )
    );
    const output = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = startServer('/ready/').catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(120_000);
    const error = await result;
    expect(error).toMatchObject({
      message: expect.stringContaining(
        'TypeError: fetch failed; cause=Error: connect ECONNREFUSED'
      ),
    });
    expect(output).toHaveBeenCalledOnce();
  });

  it('releases an unused successful readiness response and does not report failure', async () => {
    vi.stubEnv('PROTO_UI_BROWSER_BASE_URL', 'http://documentation.test');
    const cancel = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', body: { cancel } })
    );
    const output = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await startServer('/ready/')).toBe('http://documentation.test');
    expect(cancel).toHaveBeenCalledOnce();
    expect(output).not.toHaveBeenCalled();
  });
});
