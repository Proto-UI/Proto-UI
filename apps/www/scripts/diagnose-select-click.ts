// Diagnostic only: instrumentation and Debugger pause can perturb execution.
// No GIF or functional acceptance is derived from these runs.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type BrowserContext, type CDPSession } from 'playwright-core';
import ts from 'typescript';
import {
  chromeExecutable,
  choosePreviewRuntime,
  startServer,
  stopServer,
} from '../src/content/docs/zh-cn/browser-harness';

export const INPUT_PREFIX = '[select-click-input]';
export function observerMode(value: string | undefined): 'on' | 'off' {
  assert(value === 'on' || value === 'off', 'PUI_SELECT_OBSERVER must be on or off');
  return value;
}
export function recorderObserver(source: string): string {
  const parsed = ts.createSourceFile(
    'capture-transition-frames.ts',
    source,
    ts.ScriptTarget.Latest,
    true
  );
  const found: string[] = [];
  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'evaluate'
    ) {
      const callback = node.arguments[0];
      if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
        const text = callback.getText(parsed);
        if (text.includes('observations.length >= 1200')) found.push(text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.equal(found.length, 1, 'Exactly one source-bound passive recorder observer');
  // This trusted local source expression is stripped of TS types, not rewritten.
  return ts.transpile(`(${found[0]})()`, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  });
}
export function inputProbe() {
  let count = 0;
  const probe = {
    handle(event: Event) {
      if (count >= 60) return;
      const target = event.composedPath()[0];
      const node = target instanceof Element ? target : null;
      console.info(
        '[select-click-input]' +
          JSON.stringify({
            sequence: ++count,
            type: event.type,
            trusted: event.isTrusted,
            wallTime: Date.now(),
            performanceTime: performance.now(),
            phase: event.eventPhase,
            tag: node?.localName ?? null,
            role: node?.getAttribute('role') ?? null,
            expanded: node?.getAttribute('aria-expanded') ?? null,
          })
      );
    },
  };
  for (const type of [
    'pointerover',
    'pointerenter',
    'pointermove',
    'pointerdown',
    'mousedown',
    'focusin',
    'pointerup',
    'mouseup',
    'click',
  ]) {
    document.addEventListener(type, probe.handle, { capture: true, passive: true });
  }
}
export async function deadline<T>(
  name: string,
  operation: () => Promise<T>,
  milliseconds = 3000
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Diagnostic deadline: ${name}`)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'CI only; local native browser is prohibited');
  const mode = observerMode(process.env.PUI_SELECT_OBSERVER);
  const output = process.env.PUI_SELECT_DIAGNOSTIC_OUTPUT;
  assert(output, 'PUI_SELECT_DIAGNOSTIC_OUTPUT is required');
  assert(!process.env.PROTO_UI_BROWSER_BASE_URL, 'Use only checked-out source server');
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const revision = git('rev-parse', 'HEAD'),
    tree = git('rev-parse', 'HEAD^{tree}');
  assert.equal(revision, process.env.CANDIDATE_SHA);
  assert.equal(git('diff', '--exit-code'), '');
  assert.equal(git('diff', '--cached', '--exit-code'), '');
  mkdirSync(output, { recursive: true });
  const write = (file: string, value: unknown) =>
    writeFileSync(path.join(output, file), JSON.stringify(value, null, 2) + '\n');
  const log = (stage: string, facts: unknown = {}) => {
    const entry = { revision, tree, mode, at: new Date().toISOString(), stage, facts };
    console.info('[select-click-diagnostic]', JSON.stringify(entry));
    try {
      appendFileSync(path.join(output, 'progress.jsonl'), JSON.stringify(entry) + '\n');
    } catch (error) {
      console.error('Diagnostic progress write failed', error);
    }
  };
  const receipt: Record<string, unknown> = {
    revision,
    tree,
    mode,
    acceptance: false,
    limitation:
      'Diagnostic instrumentation and Debugger pause may perturb execution; not a functional or motion pass.',
    route: '/en/ui-libraries/shadcn/select/',
    viewport: { width: 900, height: 700 },
    outcome: 'not-run',
    errors: [],
    cleanupErrors: [],
    inputEvents: [],
    frames: [],
  };
  const errors = receipt.errors as string[],
    cleanupErrors = receipt.cleanupErrors as string[];
  const inputEvents = receipt.inputEvents as unknown[],
    frames = receipt.frames as unknown[];
  let browser: Browser | undefined,
    context: BrowserContext | undefined,
    cdp: CDPSession | undefined;
  const scripts = new Map<string, { url: string; sourceMapURL: string }>();
  let closing = false,
    paused = false,
    screencasting = false;
  const save = () => {
    try {
      write('receipt.json', receipt);
    } catch (error) {
      log('receipt-write-failed', String(error));
      process.exitCode = 1;
    }
  };
  // Last-resort bound for the owned diagnostic process, leaving CI time to upload.
  const watchdog = setTimeout(() => {
    log('watchdog-expired');
    receipt.outcome = 'diagnostic-watchdog';
    save();
    process.exit(1);
  }, 7 * 60_000);
  const cleanup = async (name: string, operation: () => Promise<unknown>) => {
    log(name + '/start');
    try {
      await deadline(name, operation);
      log(name + '/done');
      return true;
    } catch (error) {
      cleanupErrors.push(String(error));
      log(name + '/failed', String(error));
      return false;
    } finally {
      save();
    }
  };
  try {
    const baseUrl = await startServer('/');
    const executablePath = await chromeExecutable();
    browser = await chromium.launch({
      executablePath,
      headless: true,
      chromiumSandbox: true,
      args: ['--disable-dev-shm-usage'],
    });
    receipt.browser = browser.version();
    context = await browser.newContext({
      viewport: { width: 900, height: 700 },
      deviceScaleFactor: 1,
      colorScheme: 'light',
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(30_000);
    page.on('pageerror', (error) => {
      errors.push(String(error));
      log('pageerror', String(error));
    });
    page.on('console', (message) => {
      const text = message.text();
      if (!text.startsWith(INPUT_PREFIX) || inputEvents.length >= 60) return;
      try {
        const value = JSON.parse(text.slice(INPUT_PREFIX.length));
        inputEvents.push(value);
        log('input', value);
      } catch (error) {
        errors.push(String(error));
      }
    });
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      try {
        if (!closing && new URL(url).origin === baseUrl) await route.continue();
        else {
          log('blocked-request', url);
          await route.abort();
        }
      } catch (error) {
        if (!closing) {
          errors.push(String(error));
          log('route-error', String(error));
        }
      }
    });
    cdp = await context.newCDPSession(page);
    cdp.on('Debugger.scriptParsed', (event) => {
      if (scripts.size < 2000)
        scripts.set(event.scriptId, {
          url: event.url,
          sourceMapURL: event.sourceMapURL?.startsWith('data:')
            ? '[inline data sourcemap omitted]'
            : (event.sourceMapURL ?? '').slice(0, 2048),
        });
    });
    await page.goto(baseUrl + receipt.route, { waitUntil: 'networkidle' });
    const preview = page.locator('[data-demo-id="demo-shadcn-select"]');
    assert.equal(await preview.count(), 1);
    await choosePreviewRuntime(page, preview, 'wc');
    const target = preview
      .locator('.host')
      .getByRole('combobox', { name: 'Adapter selector', exact: true });
    await target.waitFor({ state: 'visible', timeout: 30_000 });
    await target.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    const initial = await target.evaluate((element) => ({
      expanded: element.getAttribute('aria-expanded'),
      placeholder: element.hasAttribute('data-placeholder'),
      runtime: element.getAttribute('data-projection-runtime'),
      rootFont: getComputedStyle(document.documentElement).fontSize,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    }));
    assert.deepEqual(initial, {
      expanded: 'false',
      placeholder: true,
      runtime: 'wc',
      rootFont: '16px',
      reducedMotion: false,
    });
    receipt.initial = initial;
    // Enable before the possibly starving input; a failed renderer may no
    // longer process a new Debugger.enable command, while pause can interrupt V8.
    await deadline('debugger-enable', () => cdp!.send('Debugger.enable'));
    log('debugger/enabled');
    // Both variants have the same passive event probe and real CDP screencast.
    // Only the exact recorder RAF callback is toggled.
    await page.evaluate(`(${inputProbe.toString()})()`);
    if (mode === 'on')
      await page.evaluate(
        recorderObserver(readFileSync('apps/www/scripts/capture-transition-frames.ts', 'utf8'))
      );
    let firstFrame!: () => void;
    const first = new Promise<void>((resolve) => {
      firstFrame = resolve;
    });
    cdp.on('Page.screencastFrame', (event) => {
      firstFrame();
      if (frames.length < 1500)
        frames.push({
          timestamp: event.metadata.timestamp,
          receivedAt: Date.now(),
          sessionId: event.sessionId,
        });
      cdp!.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch((error) => {
        if (!closing) errors.push(String(error));
      });
    });
    screencasting = true;
    await cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 95,
      maxWidth: 900,
      maxHeight: 700,
      everyNthFrame: 1,
    });
    await deadline('first-frame', () => first, 10_000);
    await page.waitForTimeout(1000);
    log('click/request');
    save();
    await target.click();
    log('click/returned');
    await page.waitForTimeout(1200);
    receipt.openState = await target.getAttribute('aria-expanded');
    assert.equal(receipt.openState, 'true');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    receipt.finalState = await target.getAttribute('aria-expanded');
    assert.equal(receipt.finalState, 'false');
    assert.equal(errors.length, 0);
    receipt.outcome = 'diagnostic-completed';
  } catch (error) {
    receipt.outcome = 'diagnostic-failed';
    receipt.error = String(error);
    log('failure', String(error));
    save();
    if (cdp) {
      // Failure-only debugger collection. No expression evaluation, DOM write,
      // breakpoint, force click or timeout extension; resume before teardown.
      const session = cdp;
      let resolvePaused!: (value: unknown) => void;
      const stack = new Promise<unknown>((resolve) => {
        resolvePaused = resolve;
      });
      session.on('Debugger.paused', (event) => {
        paused = true;
        const value = {
          reason: event.reason,
          callFrames: event.callFrames.slice(0, 60).map((frame) => ({
            functionName: frame.functionName,
            url: frame.url,
            location: frame.location,
            script: scripts.get(frame.location.scriptId) ?? null,
          })),
        };
        receipt.pausedStack = value;
        log('debugger/paused', value);
        save();
        resolvePaused(value);
      });
      await cleanup('debugger-pause', async () => {
        await session.send('Debugger.pause');
        await stack;
      });
      // Attempt resume even if the pause acknowledgement or event timed out.
      if (await cleanup('debugger-resume', () => session.send('Debugger.resume'))) paused = false;
    }
    process.exitCode = 1;
  } finally {
    closing = true;
    save();
    if (paused && cdp) await cleanup('final-resume', () => cdp!.send('Debugger.resume'));
    if (cdp) await cleanup('debugger-disable', () => cdp!.send('Debugger.disable'));
    if (screencasting && cdp)
      await cleanup('screencast-stop', () => cdp!.send('Page.stopScreencast'));
    if (cdp) await cleanup('cdp-detach', () => cdp!.detach());
    if (context) await cleanup('context-close', () => context!.close());
    if (browser) await cleanup('browser-close', () => browser!.close());
    await cleanup('server-stop', stopServer);
    if (cleanupErrors.length) process.exitCode = 1;
    save();
    clearTimeout(watchdog);
    // Only our isolated diagnostic process; do not leave a live protocol handle
    // waiting until the job limit after a bounded cleanup failure.
    if (cleanupErrors.length) setTimeout(() => process.exit(1), 100);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main();
