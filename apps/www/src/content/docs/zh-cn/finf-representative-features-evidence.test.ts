// @vitest-environment node
// Harness/source checks only. Never imports the browser suite or launches a browser.
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { Window } from 'happy-dom';
import ts from 'typescript';
import { parse } from 'yaml';
import { describe, expect, it, vi } from 'vitest';
const { PRODUCTION_BROWSER_OWNERS } = createRequire(import.meta.url)(
  '../../../../../../scripts/test/runtime-test-plan.mjs'
) as { PRODUCTION_BROWSER_OWNERS: Record<string, string> };

const filename = 'apps/www/src/content/docs/zh-cn/finf-representative-features.browser.test.ts';
const workflowFile = '.github/workflows/finf-representative-features-evidence.yml';
const source = ts.createSourceFile(
  filename,
  readFileSync(filename, 'utf8'),
  ts.ScriptTarget.Latest,
  true
);
const workflow = parse(readFileSync(workflowFile, 'utf8'));
function statements(names: string[]) {
  return source.statements
    .filter((statement) =>
      ts.isFunctionDeclaration(statement)
        ? names.includes(statement.name?.text ?? '')
        : ts.isVariableStatement(statement) &&
          statement.declarationList.declarations.some((declaration) =>
            names.includes(declaration.name.getText(source))
          )
    )
    .map((statement) => statement.getText(source))
    .join('\n');
}
function execute(code: string, values: Record<string, unknown>) {
  return vm.runInNewContext(transformSync(code, { loader: 'ts', target: 'es2022' }).code, values);
}
const stub = () => {};
const manifest = execute(
  `${statements(['FAMILIES', 'CALENDAR_STATES', 'cases', 'routeFor'])}; ({cases, routeFor});`,
  {
    formJourney: stub,
    fieldsetJourney: stub,
    checkboxGroupJourney: stub,
    calendarJourney: stub,
    drawerJourney: stub,
    accordionJourney: stub,
    popoverJourney: stub,
    alertDialogJourney: stub,
    runtimeTabsJourney: stub,
  }
) as {
  cases: Array<{ id: string; group: string; family: string; component: string }>;
  routeFor: (family: string, component: string) => string;
};

function mockedCase(
  options: {
    failure?: Error;
    screenshotFailure?: boolean;
    navigationFailure?: Error;
    diagnosticFailure?: boolean;
  } = {}
) {
  const receipts = new Map<string, any>();
  const diagnosticFiles = new Map<string, string>();
  const previewer = {
    waitFor: vi.fn(),
    count: vi.fn(async () => (options.navigationFailure ? 0 : 1)),
    evaluate: vi.fn(async () => {
      if (options.diagnosticFailure) throw new Error('DOM unavailable');
      return '<section data-previewer-id="fixture">current failed preview</section>';
    }),
    ariaSnapshot: vi.fn(async () => {
      if (options.diagnosticFailure) throw new Error('ARIA unavailable');
      return '- tab "React" [selected]';
    }),
    screenshot: vi.fn(async () => {
      if (options.screenshotFailure) throw new Error('capture unavailable');
    }),
  };
  const page = {
    setDefaultTimeout: vi.fn(),
    on: vi.fn(),
    clock: { setFixedTime: vi.fn() },
    goto: vi.fn(async () => {
      if (options.navigationFailure) throw options.navigationFailure;
      return { status: () => 200 };
    }),
    locator: vi.fn(() => ({ first: () => previewer })),
    evaluate: vi.fn(async () => ({ locale: 'zh-CN', today: '2026-10-10T12:00:00.000Z' })),
    viewportSize: () => ({ width: 1365, height: 1000 }),
    screenshot: vi.fn(async () => {
      if (options.screenshotFailure) throw new Error('capture unavailable');
    }),
  };
  const context = { newPage: vi.fn(async () => page), route: vi.fn(), close: vi.fn() };
  const browser = { newContext: vi.fn(async () => context), version: () => 'browser fixture only' };
  const run = execute(`${statements(['captureFailureDiagnostics', 'runCase'])}; runCase;`, {
    browser,
    output: '/test-only',
    path,
    createHash,
    writeFile: async (file: string, value: string) => {
      diagnosticFiles.set(file, value);
    },
    readFile: async () => Buffer.from('not-a-real-screenshot'),
    revision: 'a'.repeat(40),
    tree: 'b'.repeat(40),
    baseUrl: 'http://127.0.0.1:9999',
    HOST_CLOCK: '2026-10-10T12:00:00Z',
    RUNTIME_LABELS: { wc: 'Web Components', react: 'React', vue: 'Vue', vue2: 'Vue 2' },
    routeFor: manifest.routeFor,
    references: () => ({ comparison: 'pending' }),
    process: { env: { PUI_FINF_PRESET_CHECK: 'failure' } },
    writeJson: async (file: string, value: unknown) => {
      receipts.set(file, value);
    },
    expect,
    URL,
    Error,
  }) as (testCase: unknown) => Promise<void>;
  const testCase = {
    id: 'shadcn-form',
    group: 'forms',
    family: 'shadcn',
    component: 'form',
    run: async ({
      capture,
    }: {
      capture: (state: string, observation: unknown) => Promise<void>;
    }) => {
      if (!options.screenshotFailure) await capture('rest', { observed: 'fixture-only' });
      if (options.failure) throw options.failure;
    },
  };
  return { run: () => run(testCase), receipts, diagnosticFiles, context, browser, page, previewer };
}

describe('Finf representative evidence harness, no native browser', () => {
  it('registers the existing suite with one official owner and exactly five bounded matrix groups', () => {
    expect(PRODUCTION_BROWSER_OWNERS[filename]).toBe(workflowFile);
    expect(manifest.cases).toHaveLength(34);
    expect(new Set(manifest.cases.map(({ id }) => id)).size).toBe(34);
    const counts = Object.fromEntries(
      workflow.jobs['representative-features'].strategy.matrix.group.map((group: string) => [
        group,
        manifest.cases.filter((entry) => entry.group === group).length,
      ])
    );
    expect(counts).toEqual({
      forms: 12,
      calendar: 5,
      'disclosure-overlays': 8,
      'modal-overlays': 5,
      'runtime-tabs': 4,
    });
    expect(workflow.jobs['representative-features'].strategy['fail-fast']).toBe(false);
    expect(workflow.jobs['representative-features'].strategy['max-parallel']).toBe(4);
  });

  it('every selected case uses an existing own documentation route, including nested Neo overlays', () => {
    for (const entry of manifest.cases) {
      const route = manifest.routeFor(
        entry.family,
        entry.component === 'runtime-tabs' ? 'form' : entry.component
      );
      expect(existsSync(`apps/www/src/content/docs${route.slice(0, -1)}.mdx`), route).toBe(true);
    }
  });

  it('records previous screenshots, a new failure capture and original assertion error, then closes the context', async () => {
    const failure = new Error('real assertion would remain red');
    const fixture = mockedCase({ failure });
    await expect(fixture.run()).rejects.toBe(failure);
    const receipt = fixture.receipts.get('shadcn-form.json');
    expect(receipt.result).toBe('failed');
    expect(receipt.error.message).toBe(failure.message);
    expect(receipt.screenshots.map((shot: any) => shot.state)).toEqual([
      'rest',
      'failed',
      'failed-previewer',
    ]);
    expect(receipt.revision).toBe('a'.repeat(40));
    expect(receipt.tree).toBe('b'.repeat(40));
    expect(receipt.presetCheck).toBe('failure');
    expect(receipt.screenshots[0].sha256).toBe(
      createHash('sha256').update('not-a-real-screenshot').digest('hex')
    );
    expect(receipt.failureDiagnostics.files).toEqual({
      dom: 'shadcn-form-failed-dom.txt',
      aria: 'shadcn-form-failed-aria.txt',
    });
    expect(receipt.failureDiagnostics.errors).toEqual([]);
    expect(fixture.diagnosticFiles.get('/test-only/shadcn-form-failed-dom.txt')).toContain(
      'current failed preview'
    );
    expect(fixture.diagnosticFiles.get('/test-only/shadcn-form-failed-aria.txt')).toContain(
      'React'
    );
    expect(fixture.previewer.screenshot).toHaveBeenCalledOnce();
    expect(fixture.context.close).toHaveBeenCalledOnce();
  });

  it('preserves navigation failure and still attempts current-page capture', async () => {
    const failure = new Error('route did not load');
    const fixture = mockedCase({ navigationFailure: failure });
    await expect(fixture.run()).rejects.toBe(failure);
    expect(
      fixture.receipts.get('shadcn-form.json').screenshots.map((shot: any) => shot.state)
    ).toEqual(['failed']);
    expect(fixture.context.close).toHaveBeenCalledOnce();
  });

  it('keeps screenshot failure separate from the original assertion and never invents an image', async () => {
    const failure = new Error('original failure');
    const fixture = mockedCase({ failure, screenshotFailure: true });
    await expect(fixture.run()).rejects.toBe(failure);
    const receipt = fixture.receipts.get('shadcn-form.json');
    expect(receipt.result).toBe('failed');
    expect(receipt.screenshots).toEqual([]);
    expect(receipt.captureErrors).toEqual(['Error: capture unavailable']);
    expect(receipt.error.message).toBe('original failure');
  });

  it('keeps DOM/ARIA diagnostic failures separate from the original assertion', async () => {
    const failure = new Error('original assertion');
    const fixture = mockedCase({ failure, diagnosticFailure: true });
    await expect(fixture.run()).rejects.toBe(failure);
    const receipt = fixture.receipts.get('shadcn-form.json');
    expect(receipt.error.message).toBe(failure.message);
    expect(receipt.failureDiagnostics.files).toEqual({});
    expect(receipt.failureDiagnostics.errors).toEqual([
      'dom: Error: DOM unavailable',
      'aria: Error: ARIA unavailable',
    ]);
    expect(fixture.context.close).toHaveBeenCalledOnce();
  });

  it('does not label a screenshot-less successful interaction as passed', async () => {
    const fixture = mockedCase({ screenshotFailure: true });
    await expect(fixture.run()).rejects.toThrow();
    expect(fixture.receipts.get('shadcn-form.json').result).toBe('capture-failed');
  });

  it('makes independent cases fresh, even after a prior case failed', async () => {
    const failed = mockedCase({ failure: new Error('first case') });
    const passed = mockedCase();
    await expect(failed.run()).rejects.toThrow('first case');
    await passed.run();
    expect(passed.receipts.get('shadcn-form.json').result).toBe('passed');
    expect(passed.browser.newContext).toHaveBeenCalledOnce();
    expect(passed.context.close).toHaveBeenCalledOnce();
  });

  it('keeps the preset gate failing while retaining images and artifacts after that failure', () => {
    const steps = workflow.jobs['representative-features'].steps;
    const presets = steps.find((step: any) => step.id === 'presets');
    expect(presets['continue-on-error']).toBeUndefined();
    const capture = steps.find((step: any) => step.env?.PUI_FINF_FEATURE_GROUP);
    expect(capture.if).toContain('!cancelled()');
    expect(capture.if).not.toContain('steps.presets.outcome');
    expect(capture.env.PUI_FINF_PRESET_CHECK).toBe('${{ steps.presets.outcome }}');
    const upload = steps.find((step: any) => step.uses === 'actions/upload-artifact@v4');
    expect(upload.if).toBe('always()');
    for (const binding of [
      'matrix.group',
      'env.CANDIDATE_SHA',
      'github.run_id',
      'github.run_attempt',
    ])
      expect(upload.with.name).toContain(binding);
  });

  it('uses sandboxed official CI only and never imports the shared unsandboxed launcher or Select-only chooser', () => {
    const text = source.getFullText();
    expect(text).toContain("process.env.GITHUB_ACTIONS !== 'true'");
    expect(text).toContain('chromiumSandbox: true');
    expect(text).not.toContain('--no-sandbox');
    expect(text).not.toMatch(/\b(?:launchBrowser|choosePreviewRuntime|selectRuntime)\b/);
    expect(text).toContain("getByRole('tab'");
    expect(text).toContain("result: 'blocked-before-browser'");
    expect(text).toContain("baseUrl = await startServer('/')");
  });

  it('keeps the readiness deadline and observes generic runtime publications and replaced DOM', () => {
    const readiness = statements(['waitForRealRuntime', 'selectRealRuntime']);
    expect(readiness).toContain('timeout: 20_000');
    expect(readiness).toContain('await tab.click()');
    expect(source.getFullText()).not.toContain('waitForPreviewRuntime');
    const journey = statements(['runtimeTabsJourney']);
    expect(journey).toContain("root.addEventListener('runtime:changed', listener)");
    expect(journey).toContain('.detail.id');
    expect(journey).toContain('expect(await publications()).toEqual(expectedEvents)');
    expect(journey).toContain('await expect.poll(publications).toEqual(expectedEvents)');
    expect(journey).toMatch(/element.isConnected\)\)\.toBe\(false\)/);
    expect(journey).toContain('element.isConnected)).toBe(true)');
    expect(journey).not.toContain('data-projection-generation');
    expect(journey).not.toContain('dispatchEvent');
  });

  it('keeps Calendar retained capacity distinct from five visible weeks and preserves actual Close', () => {
    const calendar = statements(['calendarJourney']);
    expect(calendar).toContain('\'[role="gridcell"]\', 42');
    expect(calendar).toContain('\'[role="gridcell"]:visible\'');
    expect(calendar).toContain('.toBe(35)');
    expect(calendar).toContain('.toBe(101)');
    expect(calendar).toContain('await page.mouse.wheel(0, wheelDelta)');
    expect(calendar).not.toContain('scrollTop =');
    expect(calendar).toContain('Thursday, October 15, 2026');
    const drawer = statements(['drawerJourney']);
    expect(drawer).toContain('await close.click()');
    expect(drawer).toMatch(/capture\(\s*'actually-closed'/);
    expect(drawer).toContain('geometry.availableHeight * 0.85 * 0.5');
  });
});

type Runtime = 'wc' | 'react' | 'vue' | 'vue2';
function runtimeFixture(shell: 'fixed-family' | 'generic', runtime: Runtime = 'react') {
  const window = new Window();
  const document = window.document;
  const labels = { wc: 'Web Components', react: 'React', vue: 'Vue', vue2: 'Vue 2' };
  const tabs = Object.entries(labels)
    .map(
      ([id, label]) =>
        `<button role="tab" data-runtime-tab="${id}" aria-selected="${id === runtime}">${label}</button>`
    )
    .join('');
  const tag = runtime === 'wc' ? 'wc-form' : 'div';
  const demo = `<div class="pui-runtime-preview-surface" data-demo-ref="__website_runtime_preview_surface__" data-pui-root><${tag} data-pui-root data-demo-ref="form"><input></${tag}></div>`;
  document.body.innerHTML =
    shell === 'fixed-family'
      ? `<section data-previewer-id="test" data-projection-mode="fixed-family"><div class="host"><div data-projection-generation-state="active"><div data-projection-scope data-projection-state="ready" data-projection-runtime="${runtime}" aria-busy="false"><div data-projection-control="runtime" data-runtime-tabs><div role="tablist">${tabs}</div></div><div data-projection-content>${demo}</div></div></div></div></section>`
      : `<section data-previewer-id="test"><div data-runtime-tabs-mount><div data-runtime-tabs-root aria-busy="false"><div role="tablist">${tabs}</div><div role="tabpanel"><div class="host">${demo}</div></div></div></div></section>`;
  const root = document.querySelector('[data-previewer-id]')!;
  const host = root.querySelector('.host')!;
  const demonstrated = root.querySelector('[data-demo-ref="form"]')!;
  if (runtime === 'react')
    Object.assign(root.querySelector('.pui-runtime-preview-surface')!, {
      '__reactFiber$fixture': {},
    });
  if (runtime === 'vue') host.setAttribute('data-v-app', '');
  if (runtime === 'vue2') Object.assign(demonstrated, { __vue__: {} });
  let committed: string | null = runtime;
  Object.assign(root, { __previewer__: { getCurrentRuntime: () => committed } });
  const inspect = execute(`${statements(['inspectRuntime'])}; inspectRuntime;`, {
    getComputedStyle: window.getComputedStyle.bind(window),
  }) as (root: unknown, request: unknown) => any;
  const observe = (requested: Runtime = runtime, count = 1) =>
    inspect(root, {
      runtime: requested,
      label: labels[requested],
      readySelector: '[data-demo-ref="form"]',
      count,
    });
  return {
    window,
    document,
    root,
    host,
    demonstrated,
    observe,
    commit: (value: string | null) => {
      committed = value;
    },
  };
}

describe.each(['fixed-family', 'generic'] as const)(
  '%s real Tabs readiness, DOM fixture only',
  (shell) => {
    it.each(['wc', 'react', 'vue', 'vue2'] as const)(
      'admits only committed %s with real selected tab, one surface and target controls',
      (runtime) => {
        const fixture = runtimeFixture(shell, runtime);
        expect(fixture.observe()).toMatchObject({
          ready: true,
          shell,
          framework: runtime,
          targetCount: 1,
        });
        expect(fixture.observe(runtime === 'react' ? 'wc' : 'react').ready).toBe(false);
        expect(fixture.observe(runtime, 2).problems).toContain('target-controls-not-ready');
        fixture.window.happyDOM.abort();
      }
    );

    it('uses the matching real Tabs shell and accessible labels, without legacy Select fallback', async () => {
      const fixture = runtimeFixture(shell);
      let selector = '';
      let role: unknown;
      const getByRole = (name: string, options: unknown) => {
        role = { name, options };
        return role;
      };
      const previewer = {
        getAttribute: async () => (shell === 'fixed-family' ? shell : null),
        locator: (value: string) => {
          selector = value;
          return { getByRole };
        },
      };
      await execute(
        `${statements(['runtimeControls', 'runtimeTab'])}; runtimeTab(previewer, 'react');`,
        {
          previewer,
          RUNTIME_LABELS: { react: 'React' },
        }
      );
      expect(fixture.root.querySelectorAll(selector)).toHaveLength(1);
      expect(role).toEqual({ name: 'tab', options: { name: 'React', exact: true } });
      expect(selector).not.toContain('data-adapter-select-root');
      fixture.root
        .querySelector(
          shell === 'generic' ? '[data-runtime-tabs-root]' : '[data-projection-control]'
        )!
        .remove();
      const obsolete = fixture.document.createElement('div');
      obsolete.innerHTML =
        '<div data-adapter-select-root data-value="react"><div role="combobox">React</div></div><span>React</span>';
      fixture.root.prepend(obsolete);
      expect(fixture.root.querySelectorAll(selector)).toHaveLength(0);
      expect(fixture.observe().ready).toBe(false);
      fixture.window.happyDOM.abort();
    });

    it.each([
      ['inert host', '.host', 'inert', ''],
      ['busy controls', 'CONTROL', 'aria-busy', 'true'],
      ['inert controls', 'CONTROL', 'inert', ''],
      ['hidden surface', '.pui-runtime-preview-surface', 'hidden', ''],
      ['startup host', '.host', 'data-previewer-startup-pending', ''],
      ['hidden tab', '[data-runtime-tab="react"]', 'aria-hidden', 'true'],
      ['disabled tab', '[data-runtime-tab="react"]', 'aria-disabled', 'true'],
      ['unselected tab', '[data-runtime-tab="react"]', 'aria-selected', 'false'],
    ])('rejects %s despite a matching runtime attribute', (_name, selector, attribute, value) => {
      const fixture = runtimeFixture(shell);
      const resolved =
        selector === 'CONTROL'
          ? shell === 'generic'
            ? '[data-runtime-tabs-root]'
            : '[data-projection-control]'
          : selector;
      const element = fixture.root.querySelector(resolved)!;
      element.setAttribute(attribute, value);
      expect(fixture.observe().ready).toBe(false);
      fixture.window.happyDOM.abort();
    });

    it.each([
      'duplicate surface',
      'outside root',
      'two selected tabs',
      'missing target',
      'unowned React DOM',
      'mismatched shell',
    ])('rejects %s', (mutation) => {
      const fixture = runtimeFixture(shell);
      const surface = fixture.root.querySelector('.pui-runtime-preview-surface')!;
      if (mutation === 'duplicate surface') surface.after(surface.cloneNode(true));
      if (mutation === 'outside root') {
        const extra = fixture.document.createElement('div');
        extra.setAttribute('data-pui-root', '');
        surface.after(extra);
      }
      if (mutation === 'two selected tabs')
        fixture.root
          .querySelector('[data-runtime-tab="wc"]')!
          .setAttribute('aria-selected', 'true');
      if (mutation === 'missing target') fixture.demonstrated.remove();
      if (mutation === 'unowned React DOM') delete (surface as any)['__reactFiber$fixture'];
      if (mutation === 'mismatched shell')
        fixture.root.setAttribute(
          'data-projection-mode',
          shell === 'generic' ? 'fixed-family' : 'generic'
        );
      expect(fixture.observe().ready).toBe(false);
      fixture.window.happyDOM.abort();
    });

    it('rejects uncommitted runtime and startup despite a selected tab and rendered target', () => {
      const fixture = runtimeFixture(shell);
      if (shell === 'generic') fixture.commit(null);
      else
        fixture.root
          .querySelector('[data-projection-scope]')!
          .setAttribute('data-projection-state', 'preparing');
      expect(fixture.observe().ready).toBe(false);
      if (shell === 'generic') fixture.commit('react');
      else
        fixture.root
          .querySelector('[data-projection-scope]')!
          .setAttribute('data-projection-state', 'ready');
      expect(fixture.observe().ready).toBe(true);
      const skeleton = fixture.document.createElement('div');
      skeleton.className = 'proto-previewer__skeleton';
      fixture.host.append(skeleton);
      expect(fixture.observe().problems).toContain('startup-pending');
      fixture.window.happyDOM.abort();
    });
  }
);
