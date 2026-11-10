// @vitest-environment node
// Harness/source checks only. Never executes the browser suite or launches a browser.
import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { Window, type HTMLDivElement } from 'happy-dom';
import ts from 'typescript';
import { parse } from 'yaml';
import { describe, expect, it, vi } from 'vitest';
import type {
  PopoverCaptureObservation,
  PopoverFrame,
  PopoverMotionProbe,
} from './finf-representative-features.browser.test';
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

type HarnessCapture = (state: string, observation?: unknown) => Promise<void>;
type HarnessScreenshot = { path: string; animations: 'allow' | 'disabled'; timeout: number };

function mockedCase(
  options: {
    failure?: Error;
    screenshotFailure?: boolean;
    navigationFailure?: Error;
    diagnosticFailure?: boolean;
    component?: 'form' | 'popover';
    journey?: (capture: HarnessCapture) => Promise<void>;
    screenshotEffect?: (options: HarnessScreenshot) => void;
    imageBytes?: (file: string) => Buffer;
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
    screenshot: vi.fn(async (shot: HarnessScreenshot) => {
      if (options.screenshotFailure) throw new Error('capture unavailable');
      options.screenshotEffect?.(shot);
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
    screenshot: vi.fn(async (shot: HarnessScreenshot) => {
      if (options.screenshotFailure) throw new Error('capture unavailable');
      options.screenshotEffect?.(shot);
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
    readFile: async (file: string) =>
      options.imageBytes ? options.imageBytes(file) : Buffer.from('not-a-real-screenshot'),
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
    id: `shadcn-${options.component ?? 'form'}`,
    group: options.component === 'popover' ? 'disclosure-overlays' : 'forms',
    family: 'shadcn',
    component: options.component ?? 'form',
    run: async ({ capture }: { capture: HarnessCapture }) => {
      if (options.journey) await options.journey(capture);
      else if (!options.screenshotFailure) await capture('rest', { observed: 'fixture-only' });
      if (options.failure) throw options.failure;
    },
  };
  return { run: () => run(testCase), receipts, diagnosticFiles, context, browser, page, previewer };
}

describe('Finf representative evidence harness, no native browser', () => {
  it('registers the existing suite with one official owner and five representative groups plus separately owned suites', () => {
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
      slider: 0, // Separate suites register their own runtime cases.
      'drawer-command-density': 0,
      'drawer-intrinsic': 0,
      dropdown: 0,
      'liquid-dropdown': 0, // Separate suites register their own runtime cases.
      'neo-popover-title': 0,
      'popover-command-density': 0,
      'popover-title': 0,
      'popover-navigation': 0, // Dedicated 32-subject suite, not a representative case.
      'resident-motion-capability': 0,
      'shadcn-card': 0,
      'shadcn-toggle': 0, // Separate suites register their own runtime cases.
      'shadcn-switch-consumer': 0,
      'shadcn-drawer-presence': 0,
      'brutalist-switch-consumer': 0,
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
    expect(drawer).toContain(
      'Math.max(0, geometry.availableHeight - 6 * geometry.rootTextSize) * 0.5'
    );
  });
});

// Deterministic DOM/Animation API fixtures exercise the actual page-side probe
// and capture oracle. These are not native geometry, pixels or motion evidence.
function popoverMotionFixture(
  expectedEntryAnimation: string | null = 'pui-enter',
  reducedMotion = false
) {
  const window = new Window();
  const document = window.document;
  document.documentElement.style.fontSize = '16px';
  document.body.innerHTML =
    '<button aria-expanded="true" aria-controls="panel">Open Popover</button><div id="panel" role="dialog" style="display:block;visibility:visible;opacity:1;transform:none;box-shadow:none"></div>';
  const trigger = document.querySelector('button')!;
  // This fixture declares #panel as an HTML div; Happy DOM's id query returns Element.
  const panel = document.getElementById('panel') as HTMLDivElement;
  let animations: Array<{
    animationName?: string;
    playState: string;
    pending: boolean;
    currentTime: number;
  }> = expectedEntryAnimation
    ? [
        {
          animationName: expectedEntryAnimation,
          playState: 'finished',
          pending: false,
          currentTime: 100,
        },
      ]
    : [];
  const animate = vi.fn(() => {
    const animation = { playState: 'running', pending: false, currentTime: 0 };
    animations.push(animation);
    return animation;
  });
  Object.assign(panel, {
    getAnimations: () => animations,
    animate,
    getBoundingClientRect: () => {
      const scale = Number(panel.style.transform.match(/^scale\(([\d.]+)\)$/)?.[1] ?? 1);
      return {
        x: 100,
        y: 100,
        width: Number.parseFloat(panel.style.width || '18rem') * 16 * scale,
        height: 100 * scale,
      };
    },
  });
  Object.defineProperty(panel, 'clientWidth', {
    get: () => Number.parseFloat(panel.style.width || '18rem') * 16,
  });
  let clock = 0;
  let nextRaf = 0;
  const pending = new Map<number, (at: number) => void>();
  const cancelAnimationFrame = vi.fn((id: number) => pending.delete(id));
  const clearTimeout = vi.fn();
  // This is the known in-process probe extracted above, with simulated host APIs.
  const probe = execute(
    `${statements(['createPopoverMotionProbe'])}; createPopoverMotionProbe(trigger, expectedEntryAnimation);`,
    {
      trigger,
      expectedEntryAnimation,
      document,
      getComputedStyle: window.getComputedStyle.bind(window),
      matchMedia: () => ({ matches: reducedMotion }),
      performance: { now: () => clock },
      window: { setTimeout: vi.fn(() => 1) },
      clearTimeout,
      requestAnimationFrame: (callback: (at: number) => void) => {
        pending.set(++nextRaf, callback);
        return nextRaf;
      },
      cancelAnimationFrame,
    }
  ) as PopoverMotionProbe;
  const frame = () => {
    clock += 16;
    const callbacks = [...pending.values()];
    pending.clear();
    for (const callback of callbacks) callback(clock);
  };
  const handle = {
    evaluate: async <T>(collect: (value: PopoverMotionProbe) => T) => collect(probe),
  };
  const locator = {
    getAttribute: async (name: string) => panel.getAttribute(name),
    evaluate: async <T, Arg>(collect: (element: unknown, arg: Arg) => T, arg: Arg) =>
      collect(panel, arg),
  };
  type Capture = (state: string, observation: PopoverCaptureObservation) => Promise<void>;
  // These are the three known in-process helpers extracted from this exact source.
  const helpers = execute(
    `${statements(['waitForSettledPopover', 'captureSettledPopover', 'installPopoverNegativeControl'])}; ({waitForSettledPopover, captureSettledPopover, installPopoverNegativeControl});`,
    { expect }
  ) as {
    waitForSettledPopover: (probe: typeof handle) => Promise<void>;
    installPopoverNegativeControl: (panel: typeof locator, control: string) => Promise<void>;
    captureSettledPopover: (
      probe: typeof handle,
      panel: typeof locator,
      family: string,
      capture: Capture,
      state: string
    ) => Promise<void>;
  };
  const shots: PopoverCaptureObservation[] = [];
  const capture: Capture = async (_state, observation) => {
    shots.push(observation);
  };
  return {
    panel,
    trigger,
    probe,
    frame,
    animate,
    shots,
    deferEntry: () => {
      animations = [];
    },
    replacePanel: () => {
      const replacement = panel.cloneNode(true) as HTMLDivElement;
      Object.assign(replacement, {
        getAnimations: () => animations,
        getBoundingClientRect: () => panel.getBoundingClientRect(),
      });
      Object.defineProperty(replacement, 'clientWidth', { get: () => panel.clientWidth });
      panel.replaceWith(replacement);
    },
    enter: () => {
      animations = [
        { animationName: 'pui-enter', playState: 'running', pending: false, currentTime: 0 },
      ];
      panel.style.opacity = '0';
      panel.style.transform = 'scale(0.95)';
    },
    finish: () => {
      for (const animation of animations) {
        animation.playState = 'finished';
        animation.currentTime = 200;
      }
      panel.style.opacity = '1';
      panel.style.transform = 'none';
    },
    settle: () => helpers.waitForSettledPopover(handle),
    inject: (control: string) => helpers.installPopoverNegativeControl(locator, control),
    capture: (duringCapture = capture) =>
      helpers.captureSettledPopover(
        handle,
        locator,
        expectedEntryAnimation === null ? 'brutalist' : 'shadcn',
        duringCapture,
        'opened'
      ),
    close: () => {
      probe.stop();
      window.happyDOM.abort();
    },
  };
}

type PopoverCaseReceipt = {
  result: string;
  error: { message: string } | null;
  screenshots: Array<{ state: string; file: string; sha256: string; observation: unknown }>;
};

// Join the actual runCase capture callback to the actual probe/capture oracle.
// The in-memory image payload encodes simulated paint, and screenshot mode has
// observable phase/geometry effects. No payload is a native screenshot.
function popoverCaptureCase(
  options: { changePhaseDuringCapture?: boolean; forceFinal?: boolean; failure?: Error } = {}
) {
  const motion = popoverMotionFixture();
  const images = new Map<string, { paint: PopoverFrame; bytes: Buffer }>();
  const observations: PopoverCaptureObservation[] = [];
  let changePending = options.changePhaseDuringCapture;
  const image = (file: string) => {
    const recorded = images.get(path.basename(file));
    if (!recorded) throw new Error(`No simulated paint captured for ${file}`);
    return recorded;
  };
  const fixture = mockedCase({
    component: 'popover',
    failure: options.failure,
    journey: async (capture) => {
      if (options.failure) {
        motion.enter();
        return;
      }
      motion.frame();
      motion.frame();
      await motion.capture(async (state, observation) => {
        observations.push(observation);
        await capture(state, observation);
      });
    },
    screenshotEffect: (shot) => {
      if (changePending) {
        changePending = false;
        motion.enter();
      }
      if (options.forceFinal || shot.animations === 'disabled') motion.finish();
      const paint = motion.probe.read();
      images.set(path.basename(shot.path), {
        paint,
        bytes: Buffer.from(
          JSON.stringify({ simulation: 'Popover paint, not native pixels', paint })
        ),
      });
    },
    imageBytes: (file) => image(file).bytes,
  });
  return {
    run: fixture.run,
    image,
    observations,
    motion,
    receipt: () => {
      // This value was produced by the extracted in-process runCase above.
      const receipt = fixture.receipts.get('shadcn-popover.json') as PopoverCaseReceipt | undefined;
      if (!receipt) throw new Error('Actual runCase did not retain its Popover receipt');
      return receipt;
    },
    close: motion.close,
  };
}

describe('Popover same-phase capture and controls, no native browser', () => {
  it('observes an already finished current entry and still requires consecutive frames before capture', async () => {
    const fixture = popoverMotionFixture();
    try {
      expect(fixture.probe.read().animations[0]).toMatchObject({
        name: 'pui-enter',
        currentOpen: true,
        playState: 'finished',
      });
      expect(fixture.probe.settled).toBe(false);
      fixture.frame();
      expect(fixture.probe.settled).toBe(false);
      fixture.frame();
      expect(fixture.probe.settled).toBe(true);
      await fixture.capture();
      const binding = fixture.shots[0].captureBinding;
      expect(binding.animations).toBe('allow');
      expect(binding.before.signature).toBe(binding.after?.signature);
      expect(binding.before.rect?.width).toBe(288);
    } finally {
      fixture.close();
    }
  });

  it.each([false, true])(
    'waits through the empty pre-animation gap and genuine entry endpoint, reducedMotion=%s',
    async (reducedMotion) => {
      const fixture = popoverMotionFixture('pui-enter', reducedMotion);
      try {
        fixture.deferEntry();
        fixture.probe.mark('reduced-or-normal-entry');
        fixture.frame();
        fixture.frame();
        expect(fixture.probe.read().animations).toEqual([]);
        expect(fixture.probe.read().reducedMotion).toBe(reducedMotion);
        expect(fixture.probe.settled).toBe(false);
        fixture.enter();
        fixture.frame();
        fixture.frame();
        expect(fixture.probe.settled).toBe(false);
        fixture.finish();
        fixture.frame();
        expect(fixture.probe.settled).toBe(false);
        fixture.frame();
        await fixture.capture();
        const binding = fixture.shots[0].captureBinding;
        expect(binding.before.animations[0]).toMatchObject({
          name: 'pui-enter',
          currentOpen: true,
          playState: 'finished',
        });
        expect(binding.before.signature).toBe(binding.after?.signature);
      } finally {
        fixture.close();
      }
    }
  );

  it.each(['reopen', 'replace'] as const)(
    'rejects an earlier finished animation after panel %s, even with the same content ID',
    async (boundary) => {
      const fixture = popoverMotionFixture();
      try {
        fixture.frame();
        fixture.frame();
        expect(fixture.probe.settled).toBe(true);
        const previous = fixture.probe.read();
        if (boundary === 'reopen') {
          fixture.trigger.setAttribute('aria-expanded', 'false');
          fixture.probe.mark('closed');
          fixture.trigger.setAttribute('aria-expanded', 'true');
        } else {
          // Adversarial simulated native-object reuse across a replaced panel.
          fixture.replacePanel();
        }
        fixture.probe.mark('reentry');
        fixture.frame();
        fixture.frame();
        expect(fixture.probe.read().contentId).toBe(previous.contentId);
        expect(fixture.probe.read().openSequence).toBeGreaterThan(previous.openSequence);
        expect(fixture.probe.read().animations[0]).toMatchObject({
          name: 'pui-enter',
          currentOpen: false,
          playState: 'finished',
        });
        expect(fixture.probe.settled).toBe(false);
        fixture.enter();
        fixture.finish();
        fixture.frame();
        fixture.frame();
        await fixture.capture();
        expect(fixture.shots[0].captureBinding.before.animations[0].sequence).not.toBe(
          previous.animations[0].sequence
        );
      } finally {
        fixture.close();
      }
    }
  );

  it('keeps a genuinely animation-free family observable without inventing an entry animation', async () => {
    const fixture = popoverMotionFixture(null);
    try {
      fixture.frame();
      fixture.frame();
      await fixture.capture();
      const binding = fixture.shots[0].captureBinding;
      expect(binding.before.animations).toEqual([]);
      expect(binding.before.signature).toBe(binding.after?.signature);
    } finally {
      fixture.close();
    }
  });

  it('rejects a missing authored entry within the original bounded poll without capturing', async () => {
    const fixture = popoverMotionFixture();
    try {
      fixture.deferEntry();
      fixture.frame();
      fixture.frame();
      await expect(fixture.settle()).rejects.toThrow();
      expect(fixture.probe.frames.some((sample) => sample.settled)).toBe(false);
      expect(fixture.shots).toEqual([]);
    } finally {
      fixture.close();
    }
  });

  it('rejects genuinely wrong settled width with the unchanged 1px oracle and retains its capture', async () => {
    const fixture = popoverMotionFixture();
    try {
      await fixture.inject('wrong-width');
      expect(fixture.panel.style.getPropertyPriority('width')).toBe('important');
      fixture.frame();
      fixture.frame();
      expect(fixture.probe.settled).toBe(true);
      await expect(fixture.capture()).rejects.toThrow(/less than or equal/);
      expect(fixture.shots[0].captureBinding.before.rect?.width).toBe(320);
      expect(fixture.shots[0].captureBinding.after?.rect?.width).toBe(320);
      expect(fixture.shots[0].captureBinding.before.signature).toBe(
        fixture.shots[0].captureBinding.after?.signature
      );
    } finally {
      fixture.close();
    }
  });

  it('rejects nonsettling animation despite stable geometry within the actual bounded poll', async () => {
    const fixture = popoverMotionFixture();
    try {
      await fixture.inject('nonsettling');
      expect(fixture.animate).toHaveBeenCalledWith([{ opacity: 0.5 }, { opacity: 1 }], {
        duration: 200,
        iterations: Infinity,
      });
      fixture.frame();
      fixture.frame();
      const frame = fixture.probe.read();
      expect(frame.rect?.width).toBe(288);
      expect(frame.animations[0]).toMatchObject({
        name: 'pui-enter',
        currentOpen: true,
        playState: 'finished',
      });
      expect(frame.animations[1].playState).toBe('running');
      expect(fixture.probe.settled).toBe(false);
      // The bounded poll's rejection is under test; native-frame time is simulated.
      await expect(fixture.settle()).rejects.toThrow();
      expect(fixture.probe.frames.some((sample) => sample.settled)).toBe(false);
      expect(fixture.shots).toEqual([]);
    } finally {
      fixture.close();
    }
  });

  it('rejects a screenshot-time geometry change even when it is within the width tolerance', async () => {
    const fixture = popoverMotionFixture();
    try {
      fixture.frame();
      fixture.frame();
      await expect(
        fixture.capture(async (_state, observation) => {
          fixture.shots.push(observation);
          fixture.panel.style.width = '18.01rem';
        })
      ).rejects.toThrow();
      const binding = fixture.shots[0].captureBinding;
      expect(Math.abs((binding.after?.rect?.width ?? NaN) - 288)).toBeLessThanOrEqual(1);
      expect(binding.before.signature).not.toBe(binding.after?.signature);
    } finally {
      fixture.close();
    }
  });

  it('binds actual runCase image payloads to the settled probe observation', async () => {
    const fixture = popoverCaptureCase();
    try {
      await fixture.run();
      const receipt = fixture.receipt();
      expect(receipt.result).toBe('passed');
      const opened = receipt.screenshots.find((shot) => shot.state === 'opened');
      expect(opened).toBeDefined();
      if (!opened) throw new Error('Missing actual opened capture');
      const observation = fixture.observations[0];
      const captured = fixture.image(opened.file);
      expect(opened.observation).toEqual(observation);
      expect(captured.paint.signature).toBe(observation.captureBinding.before.signature);
      expect(captured.paint.signature).toBe(observation.captureBinding.after?.signature);
      expect(opened.sha256).toBe(createHash('sha256').update(captured.bytes).digest('hex'));
      expect(captured.paint.rect?.width).toBe(288);
    } finally {
      fixture.close();
    }
  });

  it.each([false, true])(
    'rejects a screenshot-time phase change through actual runCase, forced final=%s',
    async (forceFinal) => {
      const fixture = popoverCaptureCase({ changePhaseDuringCapture: true, forceFinal });
      try {
        await expect(fixture.run()).rejects.toThrow();
        const receipt = fixture.receipt();
        expect(receipt.result).toBe('failed');
        const opened = receipt.screenshots.find((shot) => shot.state === 'opened');
        expect(opened).toBeDefined();
        if (!opened) throw new Error('Phase control failed before actual capture');
        const binding = fixture.observations[0].captureBinding;
        const captured = fixture.image(opened.file);
        expect(binding.before.rect?.width).toBe(288);
        expect(captured.paint.signature).toBe(binding.after?.signature);
        expect(captured.paint.signature).not.toBe(binding.before.signature);
        expect(captured.paint.rect?.width).toBe(forceFinal ? 288 : 288 * 0.95);
        expect(captured.paint.animations[0]?.playState).toBe(forceFinal ? 'finished' : 'running');
        expect(opened.sha256).toBe(createHash('sha256').update(captured.bytes).digest('hex'));
      } finally {
        fixture.close();
      }
    }
  );

  it('preserves active simulated paint and the original failure in actual failure captures', async () => {
    const failure = new Error('original journey failure with active entry');
    const fixture = popoverCaptureCase({ failure });
    try {
      await expect(fixture.run()).rejects.toBe(failure);
      const receipt = fixture.receipt();
      expect(receipt.result).toBe('failed');
      expect(receipt.error?.message).toBe(failure.message);
      expect(receipt.screenshots.map((shot) => shot.state)).toEqual(['failed', 'failed-previewer']);
      for (const shot of receipt.screenshots) {
        const captured = fixture.image(shot.file);
        expect(captured.paint.rect?.width).toBe(288 * 0.95);
        expect(captured.paint.opacity).toBe('0');
        expect(captured.paint.animations[0]?.playState).toBe('running');
        expect(captured.paint.signature).toBe(fixture.motion.probe.read().signature);
        expect(shot.sha256).toBe(createHash('sha256').update(captured.bytes).digest('hex'));
      }
    } finally {
      fixture.close();
    }
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

describe('Shadcn Card official evidence carrier, no native browser', () => {
  const cardFile = 'apps/www/src/content/docs/zh-cn/demo-shadcn-card.browser.test.ts';
  const inventory = createRequire(import.meta.url)(
    '../../../../../../scripts/test/runtime-test-plan.mjs'
  ) as {
    BROWSER_SUITES: string[];
    PRODUCTION_BROWSER_SUITES: string[];
    PRODUCTION_BROWSER_OWNERS: Record<string, string>;
    discoverBrowserSuites(root: string): string[];
    assertBrowserInventory(
      discovered: string[],
      development?: string[],
      production?: string[]
    ): unknown;
  };
  const capture = workflow.jobs['representative-features'].steps.find(
    (step: { env?: { PUI_FINF_FEATURE_GROUP?: string } }) => step.env?.PUI_FINF_FEATURE_GROUP
  );

  it('owns the exact Card suite once and rejects missing or duplicate whole-inventory registration', () => {
    const all = inventory.discoverBrowserSuites(process.cwd());
    expect(inventory.BROWSER_SUITES).not.toContain(cardFile);
    expect(inventory.PRODUCTION_BROWSER_SUITES.filter((file) => file === cardFile)).toHaveLength(1);
    expect(inventory.PRODUCTION_BROWSER_OWNERS[cardFile]).toBe(workflowFile);
    inventory.assertBrowserInventory(all);
    expect(() =>
      inventory.assertBrowserInventory(
        all,
        inventory.BROWSER_SUITES,
        inventory.PRODUCTION_BROWSER_SUITES.filter((file) => file !== cardFile)
      )
    ).toThrow(/unregistered=/);
    expect(() =>
      inventory.assertBrowserInventory(all, inventory.BROWSER_SUITES, [
        ...inventory.PRODUCTION_BROWSER_SUITES,
        cardFile,
      ])
    ).toThrow(/Duplicate/);
  });

  it('executes the actual workflow report guard and rejects incomplete, duplicate, renamed or nonpassing journeys', () => {
    const match = capture.run.match(
      /\/\/ CARD_REPORT_VALIDATOR_BEGIN([\s\S]*?)\/\/ CARD_REPORT_VALIDATOR_END/
    );
    expect(match).not.toBeNull();
    if (!match) throw new Error('Actual Card report validator absent');
    const validate = vm.runInNewContext(`${match[1]}\nassertShadcnCardReport`, { assert }) as (
      report: unknown
    ) => void;
    const assertions = ['wc', 'react', 'vue', 'vue2'].flatMap((runtime) => [
      {
        ancestorTitles: [`Shadcn Card New York compatibility native ${runtime}`],
        title: 'preserves distinct card paint, inherited content ink and native navigation',
        status: 'passed',
      },
      {
        ancestorTitles: [`Shadcn Card ordinary Rhea native ${runtime}`],
        title: 'preserves default light Rhea paint, passive content and native navigation',
        status: 'passed',
      },
    ]);
    for (const enabled of [false, true])
      assertions.push({
        ancestorTitles: [],
        title: `gallery keeps distinct Card ink with JavaScript=${enabled}`,
        status: 'passed',
      });
    const valid = {
      success: true,
      numTotalTests: 10,
      numPassedTests: 10,
      numFailedTests: 0,
      numPendingTests: 0,
      testResults: [{ name: `/work/repo/${cardFile}`, assertionResults: assertions }],
    };
    validate(valid);
    const missing = structuredClone(valid);
    missing.testResults[0]!.assertionResults.pop();
    expect(() => validate(missing)).toThrow();
    const duplicate = structuredClone(valid);
    duplicate.testResults[0]!.assertionResults[1] = duplicate.testResults[0]!.assertionResults[0]!;
    expect(() => validate(duplicate)).toThrow();
    const renamed = structuredClone(valid);
    renamed.testResults[0]!.assertionResults[0]!.title += ' renamed';
    expect(() => validate(renamed)).toThrow();
    const pending = structuredClone(valid);
    pending.testResults[0]!.assertionResults[0]!.status = 'pending';
    expect(() => validate(pending)).toThrow();
    expect(() => validate({ ...valid, success: false })).toThrow();
  });
});

describe('Finf acceptance concurrency policy, configuration only', () => {
  it('retains queued evidence without increasing simultaneous work', () => {
    // This validates repository policy, not the hosted queue or retention of a legacy run.
    const check = (actual: typeof workflow) => {
      expect(actual.concurrency).toEqual({
        group: 'finf-feature-evidence-${{ github.event.pull_request.number || github.ref }}',
        'cancel-in-progress': false,
      });
      expect(actual.permissions).toEqual({ contents: 'read' });
      expect(actual.jobs['representative-features'].strategy['max-parallel']).toBe(4);
      expect(actual.jobs['representative-features'].strategy['fail-fast']).toBe(false);
      expect(actual.jobs['representative-features']['timeout-minutes']).toBe(35);
      // The obsolete per-pull-request heavy admission stays retired. This lane
      // is dispatched by the existing serial production cycle only.
      expect(actual.on).not.toHaveProperty('pull_request');
      expect(actual.on).not.toHaveProperty('push');
    };
    check(workflow);
    const faults = [
      (value: typeof workflow) => {
        // The obsolete per-push queue policy stays retired: an active run is
        // preserved, and pending acceptance is owned by the serial cycle.
        value.concurrency.queue = 'max';
      },
      (value: typeof workflow) => {
        value.on.pull_request = { paths: ['packages/**'] };
      },
      (value: typeof workflow) => {
        value.concurrency['cancel-in-progress'] = true;
      },
      (value: typeof workflow) => {
        value.concurrency.group = '${{ github.run_id }}';
      },
      (value: typeof workflow) => {
        value.jobs['representative-features'].strategy['max-parallel'] = 5;
      },
    ];
    for (const fault of faults) {
      const changed = structuredClone(workflow);
      fault(changed);
      expect(() => check(changed)).toThrow();
    }
  });
});
