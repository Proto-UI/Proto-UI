// @vitest-environment node
// Execute only the recorder's own control flow with modeled Playwright/IO/timers.
// No Chromium, server, network request, image artifact or product implementation runs.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { afterEach, expect, it, vi } from 'vitest';
import ts from 'typescript';
import YAML from 'yaml';

const root = new URL('../../../../../../', import.meta.url);
const source = await readFile(
  new URL('apps/www/scripts/capture-transition-frames.ts', root),
  'utf8'
);
const parsed = ts.createSourceFile('recorder.ts', source, ts.ScriptTarget.Latest, true);
let body = source;
for (const node of [...parsed.statements].reverse())
  if (ts.isImportDeclaration(node)) body = body.slice(0, node.pos) + body.slice(node.end);
const executable = ts.transpileModule(body, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const sources = new Map<string, Buffer>();
for (const file of [
  'packages/prototypes/shadcn/src/drawer/content.proto.ts',
  'packages/prototypes/shadcn/src/drawer/mask.proto.ts',
  'apps/www/src/content/docs/demo-shadcn-drawer.demo.ts',
  'packages/prototypes/shadcn/test/drawer-presence-presentation.test.ts',
])
  sources.set(file, await readFile(new URL(file, root)));
afterEach(() => vi.useRealTimers());

async function simulate(scene: string | undefined, stalled?: string) {
  vi.useFakeTimers();
  const files = new Map<string, string | Buffer>();
  const events: string[] = [];
  let settled = false,
    failure: unknown;
  let open = false;
  let handler: ((frame: unknown) => void) | undefined;
  let savedHandler: typeof handler;
  let routeHandler: ((route: unknown) => Promise<void>) | undefined;
  let resolveContext: ((context: unknown) => void) | undefined;
  let resolveBrowser: ((browser: unknown) => void) | undefined;
  const never = () => new Promise<never>(() => {});
  const operation = (name: string) => {
    events.push(name);
    return stalled === name ? never() : Promise.resolve();
  };
  const node = {
    textContent: 'Modeled control',
    getAttribute: (name: string) =>
      (
        ({
          'aria-expanded': String(open),
          'aria-checked': String(open),
          'aria-controls': 'panel',
        }) as Record<string, string>
      )[name] ?? null,
  };
  const target = {
    waitFor: async () => {},
    scrollIntoViewIfNeeded: async () => {},
    boundingBox: async () => ({ x: 50, y: 60, width: 120, height: 36 }),
    evaluate: async (callback: (node: unknown) => unknown) => callback(node),
    click: async () => {
      open = !open;
    },
  };
  const preview = { count: async () => 1, locator: () => ({ getByRole: () => target }) };
  const route = (url: string) => ({
    request: () => ({ url: () => url }),
    continue: async () => {
      events.push(`continue:${url}`);
    },
    abort: async () => {
      events.push(`abort:${url}`);
    },
  });
  const page = {
    setDefaultTimeout: () => {},
    setDefaultNavigationTimeout: () => {},
    on: () => {},
    route: async (_: string, callback: typeof routeHandler) => {
      routeHandler = callback;
    },
    goto: async () => {
      await routeHandler?.(route('http://127.0.0.1:1234/demo'));
      await routeHandler?.(route('https://blocked.invalid/asset'));
    },
    locator: () => preview,
    getByRole: () => ({
      filter: () => ({
        click: async () => {
          open = false;
        },
      }),
    }),
    keyboard: {
      press: async () => {
        open = false;
      },
    },
    waitForTimeout: async () => {},
    evaluate: async (callback: () => unknown) => {
      if (stalled === 'observer-stop' && callback.toString().includes('c.stopped = true'))
        return never();
      return callback();
    },
    close: async () => {
      events.push('late-page-close');
    },
  };
  const frame = (index: number) => ({
    data: Buffer.from(`modeled-frame-${index}`).toString('base64'),
    sessionId: index,
    metadata: { timestamp: 100 + index / 10 },
  });
  const cdp = {
    on: (_: string, callback: typeof handler) => {
      handler = callback;
      savedHandler = callback;
    },
    removeListener: () => {
      events.push('frame-listener-removed');
      handler = undefined;
    },
    send: async (name: string) => {
      if (name === 'Page.startScreencast') {
        handler?.(frame(1));
        handler?.(frame(2));
        return operation('screencast-start');
      }
      if (name === 'Page.stopScreencast') {
        handler?.(frame(3)); // Already-in-flight frames must still be acked before stop settles.
        return operation('screencast-stop');
      }
      if (name === 'Page.screencastFrameAck') return operation('ack-drain');
      throw new Error(`Unexpected CDP operation ${name}`);
    },
    detach: async () => operation('cdp-detach'),
  };
  const context = {
    newPage: async () => {
      events.push('page-create');
      return page;
    },
    newCDPSession: async () => {
      events.push('cdp-create');
      return cdp;
    },
    close: async () => {
      await routeHandler?.(route('http://127.0.0.1:1234/closing'));
      return operation('context-close');
    },
  };
  const browser = {
    version: () => 'modeled-no-browser',
    newContext: async () => {
      events.push('context-create');
      if (stalled === 'context-create')
        return new Promise((resolve) => {
          resolveContext = resolve;
        });
      return context;
    },
    close: async () => operation('browser-close'),
  };
  const environment = vm.createContext({
    assert,
    Buffer,
    createHash,
    path,
    process: {
      env: {
        PUI_TRANSITION_OUTPUT: '/modeled',
        PUI_TRANSITION_SCENE: scene,
        GITHUB_ACTIONS: 'true',
        CANDIDATE_SHA: 'modeled-revision',
      },
    },
    execFileSync: (_: string, args: string[]) =>
      Buffer.from(
        args.includes('HEAD^{tree}')
          ? 'modeled-tree'
          : args.includes('HEAD')
            ? 'modeled-revision'
            : ''
      ),
    mkdir: async () => {},
    readFile: async (file: string) => {
      const bytes = sources.get(file);
      assert(bytes);
      return bytes;
    },
    writeFile: async (file: string, bytes: string | Buffer) => {
      if (stalled === 'summary-write' && path.basename(file) === 'summary.json')
        throw new Error('modeled summary disk failure');
      files.set(file, bytes);
      events.push(`write:${path.basename(file)}`);
    },
    appendFile: async (file: string, bytes: string) => {
      if (stalled === 'progress-write') throw new Error('modeled progress disk failure');
      files.set(file, String(files.get(file) ?? '') + bytes);
    },
    chromium: {
      launch: async () => {
        events.push('browser-launch');
        if (stalled === 'browser-launch')
          return new Promise((resolve) => {
            resolveBrowser = resolve;
          });
        return browser;
      },
    },
    chromeExecutable: async () => '/modeled/no-browser',
    choosePreviewRuntime: async () => {},
    startServer: async () => {
      if (stalled === 'server-start-retry')
        await new Promise((resolve) => setTimeout(resolve, 121_000));
      return 'http://127.0.0.1:1234';
    },
    stopServer: async () => operation('server-stop'),
    console: { log: () => {}, error: () => {} },
    setTimeout,
    clearTimeout,
    Date,
    URL,
    window: {},
    document: {
      fonts: { ready: Promise.resolve() },
      documentElement: { className: 'light' },
      activeElement: node,
      querySelectorAll: () => [],
    },
    getComputedStyle: () => ({ fontSize: '16px', colorScheme: 'light' }),
    matchMedia: () => ({ matches: false }),
    innerWidth: 900,
    innerHeight: 700,
    devicePixelRatio: 1,
    requestAnimationFrame: () => {},
  });
  const running = vm.runInContext(
    `(async () => { ${executable} })()`,
    environment
  ) as Promise<void>;
  void running.then(
    () => {
      settled = true;
    },
    (error) => {
      settled = true;
      failure = error;
    }
  );
  for (let i = 0; i < 500; i++) await Promise.resolve();
  await vi.runAllTimersAsync();
  for (let i = 0; i < 500; i++) await Promise.resolve();
  const json = (file: string) => JSON.parse(String(files.get(`/modeled/${file}`)));
  return {
    files,
    events,
    settled,
    failure,
    json,
    lateFrame: () => savedHandler?.(frame(4)),
    lateContext: async () => {
      resolveContext?.(context);
      for (let i = 0; i < 100; i++) await Promise.resolve();
    },
    lateBrowser: async () => {
      resolveBrowser?.(browser);
      for (let i = 0; i < 100; i++) await Promise.resolve();
    },
  };
}

it.each(['drawer', 'select', 'switch-default', 'switch-sm'])(
  'records only selected scene %s and closes CDP before context',
  async (scene) => {
    const run = await simulate(scene);
    expect(run.settled).toBe(true);
    expect(run.failure).toBeUndefined();
    expect(run.json(`${scene}/receipt.json`).outcome).toBe('passed');
    expect(run.json('summary.json').results).toHaveLength(1);
    expect(run.events.filter((event) => event === 'context-create')).toHaveLength(1);
    expect(run.events.indexOf('screencast-stop')).toBeLessThan(
      run.events.indexOf('frame-listener-removed')
    );
    expect(run.events.indexOf('cdp-detach')).toBeLessThan(run.events.indexOf('context-close'));
    expect(run.events.indexOf('write:summary.json')).toBeLessThan(
      run.events.indexOf('context-close')
    );
    expect(run.events).toContain('continue:http://127.0.0.1:1234/demo');
    expect(run.events).toContain('abort:https://blocked.invalid/asset');
    expect(run.events).toContain('abort:http://127.0.0.1:1234/closing');
    const receipt = run.files.get(`/modeled/${scene}/receipt.json`);
    run.lateFrame();
    expect(run.files.get(`/modeled/${scene}/receipt.json`)).toBe(receipt);
    expect(run.json(`${scene}/receipt.json`).recording.acknowledgementCount).toBe(3);
  }
);

it.each(['context-close', 'browser-close', 'server-stop', 'cdp-detach', 'observer-stop'])(
  'bounds hung %s while retaining the passed capture and failure summary',
  async (stage) => {
    const run = await simulate('drawer', stage);
    expect(run.settled).toBe(true);
    expect(String(run.failure)).toContain('Recorder deadline exceeded');
    expect(run.json('drawer/receipt.json').outcome).toBe('passed');
    expect(run.json('summary.json').failures.length).toBeGreaterThan(0);
    expect(run.events).toContain('server-stop');
    expect(String(run.files.get('/modeled/progress.jsonl'))).toContain(
      `"stage":"${stage}","state":"failed"`
    );
  }
);

it.each(['screencast-start', 'screencast-stop', 'ack-drain'])(
  'bounds hung %s, preserves obtained frames and marks capture incomplete',
  async (stage) => {
    const run = await simulate('drawer', stage);
    expect(run.settled).toBe(true);
    expect(run.failure).toBeDefined();
    expect(run.json('drawer/receipt.json').outcome).toBe('failed');
    expect(run.json('drawer/receipt.json').recording.frameCount).toBeGreaterThan(0);
    expect(run.events).toContain('screencast-stop');
    expect(run.events).toContain('cdp-detach');
    expect(run.events).toContain('context-close');
  }
);

it('bounds context creation and disposes a resource that resolves after its deadline', async () => {
  const run = await simulate('drawer', 'context-create');
  expect(run.settled).toBe(true);
  expect(run.json('drawer/receipt.json').outcome).toBe('failed');
  expect(run.events).not.toContain('page-create');
  await run.lateContext();
  expect(run.events).toContain('context-close');
  expect(run.events).not.toContain('page-create');
});

it('bounds browser creation and closes a browser that resolves after shutdown', async () => {
  const run = await simulate('drawer', 'browser-launch');
  expect(run.settled).toBe(true);
  expect(run.json('summary.json').results[0].outcome).toBe('not-run');
  expect(run.events).not.toContain('context-create');
  await run.lateBrowser();
  expect(run.events).toContain('browser-close');
  expect(run.events).not.toContain('context-create');
});

it.each([undefined, 'all', 'drawer,select', '../drawer'])(
  'rejects unreviewed scene selection %s before launching',
  async (scene) => {
    const run = await simulate(scene);
    expect(run.settled).toBe(true);
    expect(run.failure).toBeDefined();
    expect(run.events).not.toContain('browser-launch');
  }
);

it('isolates the closed scene set in independent fail-fast-disabled jobs with unique artifacts', async () => {
  const workflow = YAML.parse(
    await readFile(new URL('.github/workflows/transition-gif-evidence.yml', root), 'utf8')
  );
  const job = workflow.jobs['actual-frames'];
  expect(job['timeout-minutes']).toBe(15);
  expect(job.strategy['fail-fast']).toBe(false);
  expect(job.strategy.matrix.scene).toEqual(['drawer', 'select', 'switch-default', 'switch-sm']);
  const capture = job.steps.find((step: any) => step.env?.PUI_TRANSITION_SCENE);
  expect(capture.env.PUI_TRANSITION_SCENE).toBe('${{ matrix.scene }}');
  const upload = job.steps.find((step: any) => step.uses === 'actions/upload-artifact@v4');
  expect(upload.if).toBe('always()');
  expect(upload.with.name).toContain('${{ matrix.scene }}');
  expect(upload.with.name).toContain('${{ env.CANDIDATE_SHA }}');
});

// The real harness permits three readiness attempts. The recorder must not race
// only its first 120s and then tear down a retry loop that can still spawn.
it('leaves bounded readiness retries owned by the shared server harness', async () => {
  const run = await simulate('drawer', 'server-start-retry');
  expect(run.settled).toBe(true);
  expect(run.failure).toBeUndefined();
  expect(run.json('drawer/receipt.json').outcome).toBe('passed');
  expect(run.events.indexOf('server-stop')).toBeGreaterThan(run.events.indexOf('browser-launch'));
});

it.each(['progress-write', 'summary-write'])(
  'does not let %s failure skip browser/server cleanup',
  async (stage) => {
    const run = await simulate('drawer', stage);
    expect(run.settled).toBe(true);
    expect(String(run.failure)).toContain(stage);
    expect(run.events).toContain('cdp-detach');
    expect(run.events).toContain('context-close');
    expect(run.events).toContain('browser-close');
    expect(run.events).toContain('server-stop');
    expect(run.json('drawer/receipt.json').outcome).toBe('passed');
    if (stage === 'summary-write') expect(run.files.has('/modeled/summary.json')).toBe(false);
  }
);
