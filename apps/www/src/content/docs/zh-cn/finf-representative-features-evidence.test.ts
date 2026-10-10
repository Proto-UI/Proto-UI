// @vitest-environment node
// Harness/source checks only. Never imports the browser suite or launches a browser.
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
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
  options: { failure?: Error; screenshotFailure?: boolean; navigationFailure?: Error } = {}
) {
  const receipts = new Map<string, any>();
  const page = {
    setDefaultTimeout: vi.fn(),
    on: vi.fn(),
    clock: { setFixedTime: vi.fn() },
    goto: vi.fn(async () => {
      if (options.navigationFailure) throw options.navigationFailure;
      return { status: () => 200 };
    }),
    locator: vi.fn(() => ({ first: () => ({ waitFor: vi.fn() }) })),
    evaluate: vi.fn(async () => ({ locale: 'zh-CN', today: '2026-10-10T12:00:00.000Z' })),
    viewportSize: () => ({ width: 1365, height: 1000 }),
    screenshot: vi.fn(async () => {
      if (options.screenshotFailure) throw new Error('capture unavailable');
    }),
  };
  const context = { newPage: vi.fn(async () => page), route: vi.fn(), close: vi.fn() };
  const browser = { newContext: vi.fn(async () => context), version: () => 'browser fixture only' };
  const run = execute(`${statements(['runCase'])}; runCase;`, {
    browser,
    output: '/test-only',
    path,
    createHash,
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
  return { run: () => run(testCase), receipts, context, browser, page };
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
    expect(receipt.screenshots.map((shot: any) => shot.state)).toEqual(['rest', 'failed']);
    expect(receipt.revision).toBe('a'.repeat(40));
    expect(receipt.tree).toBe('b'.repeat(40));
    expect(receipt.presetCheck).toBe('failure');
    expect(receipt.screenshots[0].sha256).toBe(
      createHash('sha256').update('not-a-real-screenshot').digest('hex')
    );
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
