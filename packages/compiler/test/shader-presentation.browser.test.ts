// @vitest-environment node
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '../../../apps/www/node_modules/playwright-core';
import { chromeExecutable } from '../../../apps/www/src/content/docs/zh-cn/browser-harness';
import { buildShaderBrowserFixture } from './shader-browser-fixture';
import type { createShaderBrowserFixture } from './shader-browser-consumer';
import {
  expectedShaderImagePixels,
  expectedShaderLinearPixels,
  shaderSourcePixels,
} from './shader-oracle';

interface ShaderProbe {
  disableWebGL: boolean;
  failCompile: boolean;
  failAt: number;
  holdDecode: boolean;
  onDelete: null | (() => void);
  contexts: WebGL2RenderingContext[];
  activeContexts(): WebGL2RenderingContext[];
  waitForHeldDecode(): Promise<void>;
  releaseDecodes(count?: number): void;
  read(): {
    created: number;
    deleted: number;
    live: number;
    duplicates: number;
    attempts: number;
    waiting: number;
    resumed: number;
    createdIds: number[];
    deletedIds: number[];
    renderers: string[];
    liveByContext: number[];
    lostContextIds: number[];
    restoredContextIds: number[];
  };
}
declare global {
  interface Window {
    shaderNative: { fixture: ReturnType<typeof createShaderBrowserFixture> };
    shaderProbe: ShaderProbe;
  }
}

/** Observe real allocations and delete calls; failure controls change only the named host boundary. */
function installShaderProbe() {
  const live = new Map<object, number>(),
    owners = new Map<object, WebGL2RenderingContext>(),
    createdIds: number[] = [],
    deletedIds: number[] = [],
    contexts: WebGL2RenderingContext[] = [],
    renderers: string[] = [],
    lostContextIds: number[] = [],
    restoredContextIds: number[] = [];
  let attempts = 0,
    duplicates = 0,
    nextId = 0,
    resumed = 0;
  const held: (() => void)[] = [],
    listeners: (() => void)[] = [];
  const probe: ShaderProbe = {
    disableWebGL: false,
    failCompile: false,
    failAt: -1,
    holdDecode: false,
    onDelete: null,
    contexts,
    activeContexts: () => [...new Set(owners.values())],
    waitForHeldDecode() {
      return held.length ? Promise.resolve() : new Promise((resolve) => listeners.push(resolve));
    },
    releaseDecodes(count) {
      if (count === undefined) probe.holdDecode = false;
      for (const release of held.splice(0, count ?? held.length)) release();
    },
    read() {
      return {
        created: createdIds.length,
        deleted: deletedIds.length,
        live: live.size,
        duplicates,
        attempts,
        waiting: held.length,
        resumed,
        createdIds: [...createdIds],
        deletedIds: [...deletedIds],
        renderers: [...renderers],
        liveByContext: contexts.map(
          (gl) => [...owners.values()].filter((owner) => owner === gl).length
        ),
        lostContextIds: [...lostContextIds],
        restoredContextIds: [...restoredContextIds],
      };
    },
  };
  window.shaderProbe = probe;
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: any[]) {
    if (args[0] === 'webgl2' && probe.disableWebGL) return null;
    const context = Reflect.apply(original, this, args);
    if (args[0] !== 'webgl2' || !context) return context;
    const gl = context as WebGL2RenderingContext;
    if (contexts.includes(gl)) return gl;
    contexts.push(gl);
    const contextId = contexts.length - 1;
    this.addEventListener('webglcontextlost', () => lostContextIds.push(contextId));
    this.addEventListener('webglcontextrestored', () => restoredContextIds.push(contextId));
    const renderer = gl.getExtension('WEBGL_debug_renderer_info');
    renderers.push(String(gl.getParameter(renderer?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER)));
    for (const kind of ['Texture', 'Framebuffer', 'Shader', 'Program', 'VertexArray']) {
      const create = 'create' + kind,
        remove = 'delete' + kind;
      const allocate = (gl as any)[create].bind(gl),
        release = (gl as any)[remove].bind(gl);
      (gl as any)[create] = (...input: any[]) => {
        attempts++;
        if (attempts === probe.failAt) return null;
        const value = allocate(...input);
        if (value) {
          const id = ++nextId;
          live.set(value, id);
          owners.set(value, gl);
          createdIds.push(id);
        }
        return value;
      };
      (gl as any)[remove] = (value: any) => {
        if (value) {
          const id = live.get(value);
          if (id === undefined) duplicates++;
          else {
            live.delete(value);
            owners.delete(value);
            deletedIds.push(id);
          }
        }
        const reentry = probe.onDelete;
        probe.onDelete = null;
        if (reentry) reentry();
        return release(value);
      };
    }
    const status = gl.getShaderParameter.bind(gl);
    gl.getShaderParameter = (shader, parameter) =>
      probe.failCompile && parameter === gl.COMPILE_STATUS ? false : status(shader, parameter);
    return gl;
  } as typeof original;
  const decode = HTMLImageElement.prototype.decode;
  HTMLImageElement.prototype.decode = function () {
    return decode.call(this).then(() => {
      if (!probe.holdDecode) return;
      return new Promise<void>((resolve) => {
        held.push(() => {
          resumed++;
          resolve();
        });
        for (const notify of listeners.splice(0)) notify();
      });
    });
  };
}

let browser: Browser;
let fixture: Awaited<ReturnType<typeof buildShaderBrowserFixture>>;
beforeAll(async () => {
  fixture = await buildShaderBrowserFixture();
  browser = await chromium.launch({
    executablePath: await chromeExecutable(),
    headless: true,
    chromiumSandbox: true,
  });
  await writeFile(path.join(fixture.evidenceDir, 'browser-version.txt'), browser.version());
}, 120_000);
afterAll(async () => {
  await browser?.close();
});

async function run(name: string, body: (page: Page) => Promise<void>) {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.setDefaultTimeout(5_000);
  const errors: string[] = [],
    blocked: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let failure: unknown, cleanupFailure: unknown, observation: unknown, resources: unknown;
  try {
    await page.route('**/*', (route) => {
      blocked.push(route.request().url());
      return route.abort();
    });
    await page.setContent(
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Shader presentation consumer</title><style>body{font:18px system-ui;padding:24px;background:white}#consumer>*{min-width:160px;min-height:96px;padding:12px}button{font:inherit;padding:10px;border:1px solid black;background:white}</style></head><body><h1>Actual shader consumer</h1></body></html>'
    );
    await page.evaluate(installShaderProbe);
    await page.addScriptTag({ content: fixture.bundle });
    await body(page);
    expect(errors).toEqual([]);
    expect(blocked).toEqual([]);
  } catch (error) {
    failure = error;
  } finally {
    try {
      observation = await page.evaluate(() => window.shaderNative?.fixture.read());
      await page.screenshot({ path: path.join(fixture.evidenceDir, name + '.png') });
    } catch (error) {
      cleanupFailure = error;
    }
    try {
      await page.evaluate(async () => {
        window.shaderProbe?.releaseDecodes();
        await window.shaderNative?.fixture.close();
      });
      resources = await page.evaluate(() => window.shaderProbe.read());
      expect(resources).toMatchObject({ live: 0, duplicates: 0 });
    } catch (error) {
      cleanupFailure ??= error;
    }
    await writeFile(
      path.join(fixture.evidenceDir, name + '.json'),
      JSON.stringify(
        {
          head: fixture.head,
          buildSha256: fixture.buildSha256,
          scenario: name,
          outcome: failure || cleanupFailure ? 'FAIL' : 'PASS',
          observation,
          resources,
          errors,
          blocked,
          failure: failure instanceof Error ? failure.stack : failure,
          cleanupFailure: cleanupFailure instanceof Error ? cleanupFailure.stack : cleanupFailure,
        },
        null,
        2
      ) + '\n'
    );
    await page.close();
  }
  if (failure) throw failure;
  if (cleanupFailure) throw cleanupFailure;
}
const ready = (page: Page) => page.waitForFunction(() => window.shaderNative.fixture.ready());
const resources = (page: Page) => page.evaluate(() => window.shaderProbe.read());
const zero = (page: Page) => page.waitForFunction(() => window.shaderProbe.read().live === 0);
function linear(actual: number[], expected: number[]) {
  expect(actual).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i++)
    expect(Math.abs(actual[i] - expected[i]), `linear byte ${i}`).toBeLessThanOrEqual(1);
}
function image(actual: number[]) {
  const expected = expectedShaderImagePixels();
  expect(actual).toHaveLength(expected.length);
  // Canvas readback unpremultiplies quantized RGBA8. Compare its represented
  // premultiplied color, allowing one rounding unit per channel, and alpha.
  for (let i = 0; i < expected.length; i++) {
    const a = actual[i - (i % 4) + 3],
      e = expected[i - (i % 4) + 3];
    const observed = i % 4 === 3 ? actual[i] : Math.round((actual[i] * a) / 255);
    const wanted = i % 4 === 3 ? expected[i] : Math.round((expected[i] * e) / 255);
    expect(
      Math.abs(observed - wanted),
      `published top-left premultiplied byte ${i}`
    ).toBeLessThanOrEqual(1);
  }
}

const cases = (['react', 'vue', 'vue2', 'wc'] as const).flatMap((target) =>
  (['runtime', 'compiled'] as const).map((execution) => ({ target, execution }))
);
it.each(cases)(
  '$target $execution uses real WebGL2, preserves children/input, and retires each view',
  async (scenario) => {
    await run(`${scenario.target}-${scenario.execution}`, async (page) => {
      await page.evaluate(async (value) => {
        await window.shaderNative.fixture.mount(value.target, value.execution);
      }, scenario);
      await ready(page);
      image(await page.evaluate(() => window.shaderNative.fixture.pixels()));
      const initial = await page.evaluate(() => window.shaderNative.fixture.read());
      expect(initial.buttonTexts.some((text) => text.startsWith('ordinary child'))).toBe(true);
      expect(initial.canvases).toBe(0);
      await page.getByRole('button', { name: /^ordinary child/ }).click();
      expect(await page.evaluate(() => window.shaderNative.fixture.read())).toMatchObject({
        clicks: 1,
        clickedTag: 'BUTTON',
      });
      await page.screenshot({
        path: path.join(fixture.evidenceDir, `${scenario.target}-${scenario.execution}-paint.png`),
      });
      await page.evaluate(() => window.shaderNative.fixture.visible(false));
      await zero(page);
      expect(await page.getByRole('button', { name: /^ordinary child/ }).count()).toBe(0);
      await page.evaluate(() => window.shaderNative.fixture.visible(true));
      await ready(page);
      image(await page.evaluate(() => window.shaderNative.fixture.pixels()));
      expect((await resources(page)).created).toBeGreaterThan(0);
    });
  },
  30_000
);

it('compares copy and tint GPU readback with an independent linear premultiplied oracle', async () => {
  await run('gpu-linear-oracle', async (page) => {
    const actual = await page.evaluate(() => window.shaderNative.fixture.directPixels());
    linear(actual.copy, shaderSourcePixels);
    linear(actual.tint, expectedShaderLinearPixels());
    expect(await resources(page)).toMatchObject({ live: 0, duplicates: 0 });
  });
});

it.each(['missing', 'compile', 'allocation'] as const)(
  '%s host failure preserves opaque fallback and releases partial resources in reverse',
  async (kind) => {
    await run('failure-' + kind, async (page) => {
      await page.evaluate((value) => {
        window.shaderProbe.disableWebGL = value === 'missing';
        window.shaderProbe.failCompile = value === 'compile';
        window.shaderProbe.failAt = value === 'allocation' ? 10 : -1;
      }, kind);
      await page.evaluate(() => window.shaderNative.fixture.mount('react', 'compiled'));
      await zero(page);
      const current = await page.evaluate(() => window.shaderNative.fixture.read());
      expect(current).toMatchObject({
        background: 'none',
        fallback: 'rgb(38, 51, 64)',
        canvases: 0,
      });
      expect(current.buttonTexts.some((text) => text.startsWith('ordinary child'))).toBe(true);
      const stats = await resources(page);
      expect(stats.deletedIds).toEqual([...stats.createdIds].reverse());
      if (kind !== 'missing') expect(stats.created).toBeGreaterThan(0);
    });
  }
);

it('context loss exposes fallback and restored old context cannot publish again', async () => {
  await run('context-loss', async (page) => {
    await page.evaluate(() => window.shaderNative.fixture.mount('vue', 'runtime'));
    await ready(page);
    // Runtime may replay initial style and retire earlier contexts before the first
    // visible output. Attribute loss to the one context still owning real resources.
    const current = await page.evaluate(() =>
      window.shaderProbe.activeContexts().map((gl) => window.shaderProbe.contexts.indexOf(gl))
    );
    expect(current).toHaveLength(1);
    const contextId = current[0];
    await page.evaluate((id) => {
      const context = window.shaderProbe.contexts[id];
      if (!window.shaderProbe.activeContexts().includes(context))
        throw new Error('Selected shader context is no longer current');
      const extension = context.getExtension('WEBGL_lose_context');
      if (!extension) throw new Error('Context-loss extension required');
      (window as any).shaderLostExtension = extension;
      extension.loseContext();
    }, contextId);
    await page.waitForFunction(
      (id) => window.shaderProbe.read().lostContextIds.includes(id),
      contextId
    );
    await zero(page);
    expect(await page.evaluate(() => window.shaderNative.fixture.read())).toMatchObject({
      background: 'none',
      fallback: 'rgb(38, 51, 64)',
    });
    const retired = await resources(page);
    await page.evaluate(() => (window as any).shaderLostExtension.restoreContext());
    await page.waitForFunction(
      (id) => window.shaderProbe.read().restoredContextIds.includes(id),
      contextId
    );
    expect(await page.evaluate(() => window.shaderNative.fixture.read())).toMatchObject({
      background: 'none',
    });
    expect(await resources(page)).toMatchObject({
      created: retired.created,
      live: 0,
      duplicates: 0,
    });
  });
});

it('a decoded image from a retired view never publishes after release', async () => {
  await run('retired-decode', async (page) => {
    await page.evaluate(() => {
      window.shaderProbe.holdDecode = true;
    });
    await page.evaluate(() => window.shaderNative.fixture.mount('wc', 'compiled'));
    await page.waitForFunction(() => window.shaderProbe.read().waiting === 1);
    await page.evaluate(() => window.shaderNative.fixture.visible(false));
    await zero(page);
    await page.evaluate(async () => {
      window.shaderProbe.releaseDecodes();
      await Promise.resolve();
    });
    expect(await page.evaluate(() => window.shaderNative.fixture.ready())).toBe(false);
    expect((await resources(page)).resumed).toBe(1);
    await page.evaluate(() => window.shaderNative.fixture.visible(true));
    await ready(page);
    image(await page.evaluate(() => window.shaderNative.fixture.pixels()));
  });
});

it('throwing preparation invalidates the old decoded image before fallback publication', async () => {
  await run('prepare-throw-stale-decode', async (page) => {
    await page.evaluate(() => {
      window.shaderProbe.holdDecode = true;
    });
    await page.evaluate(() => window.shaderNative.fixture.prepareFailure());
    expect((await resources(page)).waiting).toBe(1);
    await zero(page);
    await page.evaluate(async () => {
      window.shaderProbe.releaseDecodes();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect((await resources(page)).resumed).toBe(1);
    expect(await page.evaluate(() => window.shaderNative.fixture.read())).toMatchObject({
      background: 'none',
      fallback: 'rgb(0, 128, 0)',
    });
    expect(await page.evaluate(() => window.shaderNative.fixture.diagnostics())).toContain(
      'shader-semantic-style-failed'
    );
  });
});

it('cleanup reentry publishes only the newer generation and cannot erase its lease', async () => {
  await run('cleanup-reentry', async (page) => {
    await page.evaluate(() => window.shaderNative.fixture.cleanupReentry());
    await ready(page);
    expect(await page.evaluate(() => window.shaderNative.fixture.read())).toMatchObject({
      fallback: 'rgb(0, 0, 128)',
    });
    image(await page.evaluate(() => window.shaderNative.fixture.pixels()));
    expect((await resources(page)).duplicates).toBe(0);
  });
});

it('late decode failure never overwrites an external paint owner during fallback, recommit or cleanup', async () => {
  await run('external-writer-late-decode', async (page) => {
    await page.evaluate(() => {
      window.shaderProbe.holdDecode = true;
    });
    const external = await page.evaluate(() => window.shaderNative.fixture.externalWriter());
    expect((await resources(page)).waiting).toBe(1);
    await page.evaluate(async () => {
      window.shaderProbe.releaseDecodes();
      await Promise.resolve();
      await Promise.resolve();
    });
    await zero(page);
    expect(await page.evaluate(() => window.shaderNative.fixture.read())).toMatchObject({
      background: external,
    });
    expect(await page.evaluate(() => window.shaderNative.fixture.diagnostics())).toContain(
      'shader-paint-ownership-lost'
    );
    await page.evaluate(() => window.shaderNative.fixture.recommitDirect());
    expect(await page.evaluate(() => window.shaderNative.fixture.read())).toMatchObject({
      background: external,
    });
    await page.evaluate(() => window.shaderNative.fixture.disposeDirect());
    expect(await page.evaluate(() => window.shaderNative.fixture.read())).toMatchObject({
      background: external,
    });
  });
});

it('a newer revision detects external ownership before retiring the still-pending old decode', async () => {
  await run('external-writer-new-revision', async (page) => {
    await page.evaluate(() => {
      window.shaderProbe.holdDecode = true;
    });
    const external = await page.evaluate(() => window.shaderNative.fixture.externalWriter());
    expect((await resources(page)).waiting).toBe(1);
    await page.evaluate(() => window.shaderNative.fixture.recommitDirect());
    await zero(page);
    expect(await page.evaluate(() => window.shaderNative.fixture.read())).toMatchObject({
      background: external,
    });
    expect(await page.evaluate(() => window.shaderNative.fixture.diagnostics())).toContain(
      'shader-paint-ownership-lost'
    );
    await page.evaluate(async () => {
      window.shaderProbe.releaseDecodes();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(await page.evaluate(() => window.shaderNative.fixture.read())).toMatchObject({
      background: external,
    });
    await page.evaluate(() => window.shaderNative.fixture.disposeDirect());
    expect(await page.evaluate(() => window.shaderNative.fixture.read())).toMatchObject({
      background: external,
    });
  });
});

it('capability override and reset reacquire fallback without reviving a released binding', async () => {
  await run('capability-fallback-reacquisition', async (page) => {
    await page.evaluate(() => {
      window.shaderProbe.disableWebGL = true;
    });
    await page.evaluate(() => window.shaderNative.fixture.capabilityStart());
    await page.evaluate(() => {
      window.shaderNative.fixture.capabilityOverride();
      window.shaderNative.fixture.capabilityReset();
      window.shaderNative.fixture.capabilityReset();
    });
    const current = await page.evaluate(() => window.shaderNative.fixture.capabilityRead());
    expect([...new Set(current.views)]).toEqual([1, 2, 3]);
    expect(current.releases).toEqual([1, 2]);
    expect(current.diagnostics).toEqual(['shader-webgl2-unavailable']);
    expect(await page.evaluate(() => window.shaderNative.fixture.read())).toMatchObject({
      background: 'none',
      fallback: 'rgb(38, 51, 64)',
    });
    await page.evaluate(() => {
      window.shaderNative.fixture.capabilityOldRelease();
      window.shaderNative.fixture.capabilityOldCommit();
    });
    expect(await page.evaluate(() => window.shaderNative.fixture.read())).toMatchObject({
      background: 'none',
      fallback: 'rgb(38, 51, 64)',
    });
    expect(
      (await page.evaluate(() => window.shaderNative.fixture.capabilityRead())).diagnostics
    ).toContain('shader-stale-frame');
    await page.evaluate(() => window.shaderNative.fixture.capabilityRemount());
    expect(
      (await page.evaluate(() => window.shaderNative.fixture.capabilityRead())).views.at(-1)
    ).toBe(4);
    expect(await page.evaluate(() => window.shaderNative.fixture.read())).toMatchObject({
      background: 'none',
      fallback: 'rgb(38, 51, 64)',
    });
  });
});

it('late decode and release from an overridden capability cannot affect its reacquired GPU lease', async () => {
  await run('capability-stale-decode', async (page) => {
    await page.evaluate(() => {
      window.shaderProbe.holdDecode = true;
    });
    await page.evaluate(() => window.shaderNative.fixture.capabilityStart());
    await page.waitForFunction(() => window.shaderProbe.read().waiting === 1);
    await page.evaluate(() => window.shaderNative.fixture.capabilityOverride());
    await page.waitForFunction(() => window.shaderProbe.read().waiting === 2);
    await page.evaluate(() => window.shaderNative.fixture.capabilityReset());
    await page.waitForFunction(() => window.shaderProbe.read().waiting === 3);
    await page.evaluate(async () => {
      window.shaderNative.fixture.capabilityOldRelease();
      window.shaderNative.fixture.capabilityOldCommit();
      // Complete only the two retired decodes, keeping the current output pending.
      window.shaderProbe.releaseDecodes(2);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(await resources(page)).toMatchObject({ waiting: 1, resumed: 2, duplicates: 0 });
    expect(await page.evaluate(() => window.shaderNative.fixture.read())).toMatchObject({
      background: 'none',
      fallback: 'rgb(38, 51, 64)',
    });
    await page.evaluate(() => window.shaderProbe.releaseDecodes());
    await ready(page);
    image(await page.evaluate(() => window.shaderNative.fixture.pixels()));
    await page.evaluate(() => window.shaderNative.fixture.capabilityRemount());
    await ready(page);
    image(await page.evaluate(() => window.shaderNative.fixture.pixels()));
    expect(
      (await page.evaluate(() => window.shaderNative.fixture.capabilityRead())).views.at(-1)
    ).toBe(4);
  });
});
