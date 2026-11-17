// @vitest-environment node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, CDPSession, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  RUNTIMES,
  launchBrowser,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
  waitForPreviewRuntime,
} from './browser-harness';

const ROUTE = '/en/ui-libraries/shadcn/dialog/';
const evidenceDirectory = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
  ? path.join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, 'dialog-public-native')
  : undefined;
const sourcePaths = [
  'apps/www/src/content/docs/zh-cn/demo-shadcn-dialog.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-dialog.demo.ts',
  'apps/www/src/content/docs/en/ui-libraries/shadcn/dialog.mdx',
  'apps/www/src/content/docs/zh-cn/browser-harness.ts',
  'packages/prototypes/base/src/dialog/content.proto.ts',
  'packages/prototypes/base/src/dialog/overlay.proto.ts',
  'packages/prototypes/shadcn/src/dialog/content.proto.ts',
  'spec/tests/T-BASE-DIALOG-CONTENT-0001.yaml',
];

type NativeJourney = {
  id: string;
  result: 'running' | 'passed' | 'failed';
  observations: unknown[];
  pageErrors: string[];
  failure?: string;
};
const nativeJourneys: NativeJourney[] = [];
let sourceBinding: unknown;

async function captureNativeState(
  page: Page,
  cdp: CDPSession,
  contentId: string,
  journey: NativeJourney,
  step: string,
  captureDirectory: string | null = evidenceDirectory ?? null
) {
  const dom = await page.evaluate((id) => {
    const content = document.getElementById(id);
    const active = document.activeElement;
    const describe = (element: Element | null) => {
      if (!element) return null;
      return {
        tag: element.tagName,
        id: element.id,
        text: element.textContent?.trim(),
        attributes: Object.fromEntries(
          Array.from(element.attributes)
            .filter(({ name }) =>
              /^(role|aria-.+|data-projection-.+|data-pui-.+|data-transition-state|data-focus-visible)$/.test(
                name
              )
            )
            .map(({ name, value }) => [name, value])
        ),
      };
    };
    const style = content ? getComputedStyle(content) : null;
    return {
      content: describe(content),
      active: describe(active),
      focusInside: Boolean(content?.contains(active)),
      rect: content?.getBoundingClientRect().toJSON(),
      bodyOverflow: document.body.style.overflow,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      paint: style
        ? {
            display: style.display,
            opacity: style.opacity,
            transform: style.transform,
            transitionProperty: style.transitionProperty,
            animationName: style.animationName,
            animationDuration: style.animationDuration,
          }
        : null,
    };
  }, contentId);
  const dialogs = (await cdp.send('Accessibility.getFullAXTree')).nodes
    .filter((node) => !node.ignored && node.role?.value === 'dialog')
    .map((node) => ({
      role: node.role?.value,
      name: node.name?.value,
      description: node.description?.value,
      properties: node.properties,
      backendDOMNodeId: node.backendDOMNodeId,
    }));
  let image;
  if (captureDirectory) {
    const file = `${journey.id}-${step}.png`;
    const bytes = await page.screenshot({ path: path.join(captureDirectory, file) });
    image = { file, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  const observation = { step, url: page.url(), viewport: page.viewportSize(), dom, dialogs, image };
  journey.observations.push(observation);
  return observation;
}

type PointerSample = { trusted: boolean; partial: boolean };
type PointerSampleWindow = Window & { __nextPointerSample?: Promise<PointerSample> };

type BootstrapInput = { type: string; key: string | null; ref: string | null; trusted: boolean };
type BootstrapWindow = Window & { __bootstrapDialogInputs: BootstrapInput[] };
type BootstrapSourceInputs = {
  files: Array<{ path: string; bytes: number; sha256: string }>;
};

// Private source-bound diagnostic: this describe is selected on its own. The
// existing Shadcn cases remain in the same registered suite and keep their scope.
describe('Bootstrap Dialog PrototypePreviewer native consumer', () => {
  const route = (runtime: string) => `/en/test/bootstrap-dialog-preview/${runtime}/`;
  const directory = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
    ? path.join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, 'bootstrap-dialog-preview')
    : null;
  const journeys: NativeJourney[] = [];
  let nativeBrowser: Browser | undefined;
  let nativeBaseUrl = '';
  let inputs: BootstrapSourceInputs;
  let inputsSha256: string;
  let before: Awaited<ReturnType<typeof snapshotSources>> | undefined;
  let after: Awaited<ReturnType<typeof snapshotSources>> | undefined;

  async function snapshotSources() {
    return {
      observedAt: new Date().toISOString(),
      root: await realpath(process.cwd()),
      headSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      files: await Promise.all(
        inputs.files.map(async (input) => {
          try {
            const bytes = await readFile(input.path);
            const sha256 = createHash('sha256').update(bytes).digest('hex');
            return {
              path: input.path,
              realPath: await realpath(input.path),
              bytes: bytes.length,
              sha256,
              matchesExpected: bytes.length === input.bytes && sha256 === input.sha256,
            };
          } catch (error) {
            return { path: input.path, error: String(error), matchesExpected: false };
          }
        })
      ),
    };
  }

  beforeAll(async () => {
    if (!directory || !process.env.PROTO_UI_NATIVE_SOURCE_INPUTS)
      throw new Error('Bootstrap native evidence requires an output directory and frozen source inputs.');
    await mkdir(directory, { recursive: true });
    const bytes = await readFile(process.env.PROTO_UI_NATIVE_SOURCE_INPUTS);
    inputsSha256 = createHash('sha256').update(bytes).digest('hex');
    inputs = JSON.parse(bytes.toString('utf8')) as BootstrapSourceInputs;
    before = await snapshotSources();
    expect(before.files.every((file) => file.matchesExpected), 'Frozen source admission').toBe(true);
    nativeBaseUrl = await startServer(RUNTIMES.map(route));
    nativeBrowser = await launchBrowser();
  }, 240_000);

  afterAll(async () => {
    try {
      await nativeBrowser?.close();
    } finally {
      try {
        await stopServer();
      } finally {
        if (inputs) after = await snapshotSources();
        if (directory) {
          await writeFile(
            path.join(directory, 'observations.json'),
            JSON.stringify({
              schemaVersion: 1,
              sourceInputs: process.env.PROTO_UI_NATIVE_SOURCE_INPUTS,
              inputsSha256,
              before,
              after,
              invocation: {
                executable: process.execPath,
                argv: process.argv,
                execArgv: process.execArgv,
                cwd: process.cwd(),
                parentReceipt: 'The enclosing original command/terminal receipt binds the parent invocation.',
              },
              browser: nativeBrowser?.version(),
              expectedRuntimes: RUNTIMES,
              viewport: { width: 900, height: 700 },
              journeys,
              qualification: 'First document mount and same-document runtime return through real PrototypePreviewer, authored Bootstrap recipe and production loaders/portals. Named native source bytes are checked before and after. Cold means first browser-document mount, not a cold Astro compiler. No load-count, full dependency-tree, S4, AT, theme/viewport matrix, Compiler or stable Bootstrap acceptance claim.',
            }, null, 2)
          );
        }
        if (after)
          expect(after.files.every((file) => file.matchesExpected), 'Source retained after teardown').toBe(true);
      }
    }
  }, 60_000);

  for (const [index, runtime] of RUNTIMES.entries()) {
    it(`${runtime}: cold mount and warm runtime return preserve Dialog ownership and focus`, async () => {
      const journey: NativeJourney = {
        id: `bootstrap-${runtime}`,
        result: 'running',
        observations: [],
        pageErrors: [],
      };
      journeys.push(journey);
      try {
        if (!nativeBrowser) throw new Error('Native browser did not start.');
        const context = await nativeBrowser.newContext({ viewport: { width: 900, height: 700 } });
        try {
          // This fixes the initial reader preference; it does not mount a host or
          // change Dialog state. Runtime switching below uses the actual toolbar.
          await context.addInitScript((value) =>
            localStorage.setItem('preferred-prototypes-adapter', value), runtime);
          const page = await context.newPage();
          page.on('pageerror', (error) => journey.pageErrors.push(error.message));
          page.on('console', (message) => {
            if (message.type() === 'error') journey.pageErrors.push(`console: ${message.text()}`);
          });
          const response = await page.goto(`${nativeBaseUrl}${route(runtime)}`, { waitUntil: 'networkidle' });
          expect(response?.ok()).toBe(true);
          const previewer = page.locator('[data-previewer-id]');
          expect(await previewer.count()).toBe(1);
          await waitForPreviewRuntime(page, runtime, '[aria-haspopup="dialog"]', 1);
          await page.evaluate(() => {
            const owner = window as BootstrapWindow;
            owner.__bootstrapDialogInputs = [];
            for (const type of ['keydown', 'click']) {
              document.addEventListener(type, (event) => {
                owner.__bootstrapDialogInputs.push({
                  type: event.type,
                  key: event instanceof KeyboardEvent ? event.key : null,
                  ref: (event.target as Element | null)?.closest('[data-demo-ref]')?.getAttribute('data-demo-ref') ?? null,
                  trusted: event.isTrusted,
                });
              }, { capture: true });
            }
          });
          const cdp = await context.newCDPSession(page);
          let coldGeneration: string | null = null;
          for (const phase of ['cold', 'warm'] as const) {
            const trigger = previewer.locator('[data-demo-ref="trigger"][aria-haspopup="dialog"]');
            expect(await trigger.count()).toBe(1);
            const contentId = await trigger.getAttribute('aria-controls');
            if (!contentId) throw new Error('Authored Dialog Trigger has no Content identity.');
            const content = page.locator(`[role="dialog"][id=${JSON.stringify(contentId)}]`);
            const generation = await trigger.evaluate((element) =>
              element.closest('[data-projection-generation]')?.getAttribute('data-projection-generation') ?? null);
            expect(generation).toBeTruthy();
            if (phase === 'cold') coldGeneration = generation;
            else expect(generation, 'Runtime return must materialize a new generation').not.toBe(coldGeneration);
            const capture = async (step: string) => {
              const observation = await captureNativeState(page, cdp, contentId, journey,
                `${phase}-${step}`, phase === 'cold' && step === 'enter-open' ? directory : null);
              journey.observations.push({ step: `${phase}-${step}-owner`, runtime, generation,
                expanded: await trigger.getAttribute('aria-expanded'),
                focusedTrigger: await trigger.evaluate((element) => element === document.activeElement),
              });
              return observation;
            };
            const closed = async (step: string) => {
              await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
              await expect.poll(() => content.isVisible()).toBe(false);
              await expect.poll(() => page.locator('[role="dialog"]:visible').count()).toBe(0);
              await expect.poll(() => trigger.evaluate((element) => element === document.activeElement)).toBe(true);
              expect((await capture(step)).dialogs).toEqual([]);
            };
            const opened = async (step: string) => {
              await page.keyboard.press('Enter');
              await expect.poll(() => content.getAttribute('data-transition-state')).toBe('entered');
              expect(await content.isVisible()).toBe(true);
              expect(await content.count()).toBe(1);
              expect(await page.locator('[role="dialog"]').count()).toBe(1);
              expect(await page.locator('[role="dialog"]:visible').count()).toBe(1);
              expect(await trigger.getAttribute('aria-expanded')).toBe('true');
              expect(await content.getAttribute('data-projection-runtime')).toBe(runtime);
              expect(await content.getAttribute('data-projection-prototype')).toBe('bootstrap-2-3-2-dialog-content');
              expect(await page.locator('[data-demo-ref="mask"]').count()).toBe(1);
              expect(await page.locator('[data-demo-ref="trigger"][aria-haspopup="dialog"]').count()).toBe(1);
              await expect.poll(() => content.evaluate((element) => element.contains(document.activeElement))).toBe(true);
              const close = content.locator('[data-demo-ref="close"]');
              expect(await close.count()).toBe(1);
              expect(await page.locator('[data-demo-ref="close"]').count()).toBe(1);
              expect(await content.locator('[data-demo-ref="footer"]').getByRole('button').count()).toBe(1);
              expect(await close.getAttribute('role')).toBe('button');
              expect(await close.innerText()).toBe('Close project details');
              expect(await close.evaluate((element) => ({
                commands: [element, ...element.querySelectorAll('*')].filter((node) => node.matches('button, [role="button"]')).length,
                focusOwners: [element, ...element.querySelectorAll<HTMLElement>('*')].filter((node) => (node as HTMLElement).tabIndex >= 0).length,
                passive: ['closeAppearance', 'closeLabel'].map((ref) => {
                  const node = element.querySelector<HTMLElement>(`[data-demo-ref="${ref}"]`);
                  return !!node && !node.hasAttribute('role') && !node.hasAttribute('tabindex') && node.tabIndex < 0;
                }),
              }))).toEqual({ commands: 1, focusOwners: 1, passive: [true, true] });
              const observation = await capture(step);
              expect(Number(observation.dom.paint?.opacity)).toBeGreaterThan(0);
              expect(observation.dom.rect?.width).toBeGreaterThan(0);
              expect(observation.dialogs).toHaveLength(1);
            };
            expect(await trigger.getAttribute('aria-expanded')).toBe('false');
            expect(await content.isVisible()).toBe(false);
            await trigger.focus();
            await closed('initial-closed');
            await opened('enter-open');
            await content.getByRole('button', { name: 'Close project details', exact: true }).click();
            await closed('native-close');
            await opened('enter-reopen');
            await page.keyboard.press('Escape');
            await closed('escape-close');
            if (phase === 'cold') {
              const originalTrigger = await trigger.elementHandle();
              if (!originalTrigger) throw new Error('Missing cold Dialog Trigger.');
              try {
                const alternate = RUNTIMES[(index + 1) % RUNTIMES.length]!;
                await selectRuntime(page, previewer, alternate, '[aria-haspopup="dialog"]', 1);
                expect(await originalTrigger.evaluate((element) => element.isConnected)).toBe(false);
                expect(await page.locator('[role="dialog"]:visible').count()).toBe(0);
                journey.observations.push({ step: 'runtime-away', runtime: alternate,
                  oldTriggerConnected: false, url: page.url() });
                await selectRuntime(page, previewer, runtime, '[aria-haspopup="dialog"]', 1);
              } finally {
                await originalTrigger.dispose();
              }
            }
          }
          await previewer.evaluate(async (root) => {
            const controller = (root as HTMLElement & { __previewer__?: { destroy(): Promise<void> | void } }).__previewer__;
            if (!controller) throw new Error('Real PrototypePreviewer controller is missing.');
            await controller.destroy();
            // Drain the queued appearance work and two real host frames after
            // terminal teardown. This is a bounded observation, not an idle proof.
            await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          });
          expect(await previewer.locator('.host [data-pui-root]').count()).toBe(0);
          expect(await page.locator('[role="dialog"]').count()).toBe(0);
          expect(await page.locator('[data-projection-prototype="bootstrap-2-3-2-dialog-content"], [data-projection-prototype="bootstrap-2-3-2-dialog-mask"]').count()).toBe(0);
          const input = await page.evaluate(() => (window as BootstrapWindow).__bootstrapDialogInputs);
          expect(input.every((event) => event.trusted)).toBe(true);
          expect(input.filter((event) => event.type === 'keydown' && event.key === 'Enter' && event.ref === 'trigger')).toHaveLength(4);
          expect(input.filter((event) => event.type === 'keydown' && event.key === 'Escape')).toHaveLength(2);
          expect(input.filter((event) => event.type === 'click' && event.ref === 'close')).toHaveLength(2);
          journey.observations.push({ step: 'terminal-teardown', input, remainingOwners: 0 });
          await cdp.detach();
        } finally {
          await context.close();
        }
        expect(journey.pageErrors).toEqual([]);
        journey.result = 'passed';
      } catch (error) {
        journey.result = 'failed';
        journey.failure = String(error);
        throw error;
      }
    }, 120_000);
  }
});

let browser: Browser;
let baseUrl = '';

describe('Shadcn Dialog native lifecycle', () => {
  beforeAll(async () => {
    if (evidenceDirectory) {
      await mkdir(evidenceDirectory, { recursive: true });
      sourceBinding = {
        headSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        files: await Promise.all(
          sourcePaths.map(async (file) => ({
            path: file,
            sha256: createHash('sha256').update(await readFile(file)).digest('hex'),
          }))
        ),
        qualification:
          'Named worktree inputs only; not a complete transitive source closure or proof of a clean committed tree.',
      };
    }
    baseUrl = await startServer(ROUTE);
    browser = await launchBrowser();
  }, 240_000);

  afterAll(async () => {
    try {
      if (evidenceDirectory) {
        await writeFile(
          path.join(evidenceDirectory, 'observations.json'),
          JSON.stringify(
            {
              sourceBinding,
              browser: browser?.version(),
              route: ROUTE,
              qualification:
                'Ordinary uncontrolled Rhea recipe in Chromium. Native keyboard/pointer and browser AX observations; not screen-reader, first-frame motion, packed consumer, other theme/locale or cross-native-host acceptance. Running entries did not complete setup/assertions/cleanup. The pre-existing WC partial-remount case retains its own Vitest result.',
              nativeJourneys,
            },
            null,
            2
          )
        );
      }
    } finally {
      try {
        await browser?.close();
      } finally {
        await stopServer();
      }
    }
  });

  // T-BASE-DIALOG-CONTENT-0001: the ordinary public recipe must agree with
  // the shared DOM journey under actual host focus, Tab and pointer defaults.
  // Reduced motion is a host condition, not a claim that motion was reviewed.
  for (const runtime of RUNTIMES) {
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      it(`preserves public modal focus, dismissal and AX for ${runtime} with ${reducedMotion}`, async () => {
        const journey: NativeJourney = {
          id: `${runtime}-${reducedMotion}`,
          result: 'running',
          observations: [],
          pageErrors: [],
        };
        nativeJourneys.push(journey);
        const { context, page, previewer } = await openRoute(browser, baseUrl, ROUTE, {
          width: 1100,
          height: 900,
        });
        const cdp = await context.newCDPSession(page);
        page.on('pageerror', (error) => journey.pageErrors.push(error.message));
        try {
          await page.emulateMedia({ reducedMotion });
          await selectRuntime(page, previewer, runtime, '[aria-haspopup="dialog"]', 1);
          const trigger = previewer.locator('[aria-haspopup="dialog"]');
          const contentId = await trigger.getAttribute('aria-controls');
          expect(contentId, 'The public Trigger identifies one Content').toBeTruthy();
          if (!contentId) throw new Error('Dialog Trigger has no Content identity.');
          const content = page.locator(`[role="dialog"][id=${JSON.stringify(contentId)}]`);
          const originalOverflow = await page.evaluate(() => document.body.style.overflow);
          let projectionCoordinates: Record<string, string | null> | undefined;
          const focusIs = (target: Locator) =>
            target.evaluate((element) => element === document.activeElement);
          const capture = (step: string) => captureNativeState(page, cdp, contentId, journey, step);
          const opened = async (activation: 'Enter' | 'Space' | 'pointer', step: string) => {
            if (activation === 'pointer') await trigger.click();
            else await page.keyboard.press(activation);
            await expect.poll(() => content.getAttribute('data-transition-state')).toBe('entered');
            expect(await content.count()).toBe(1);
            expect(await content.isVisible()).toBe(true);
            expect(await trigger.getAttribute('aria-expanded')).toBe('true');
            expect(await content.getAttribute('aria-modal')).toBe('true');
            expect(await content.getAttribute('data-projection-runtime')).toBe(runtime);
            expect(await content.getAttribute('data-projection-prototype')).toBe(
              'shadcn-dialog-content'
            );
            const coordinates = await content.evaluate((element) =>
              Object.fromEntries(
                ['owner', 'family', 'runtime', 'generation'].map((name) => [
                  name,
                  element.getAttribute(`data-projection-${name}`),
                ])
              )
            );
            expect(Object.values(coordinates).every(Boolean)).toBe(true);
            if (!projectionCoordinates) projectionCoordinates = coordinates;
            expect(coordinates, 'Reopening retains the same projection owner').toEqual(
              projectionCoordinates
            );
            await expect
              .poll(() =>
                content.evaluate((element) => element.contains(document.activeElement))
              )
              .toBe(true);
            const relations = await content.evaluate((element) =>
              ['aria-labelledby', 'aria-describedby'].map((attribute) => {
                const ids = (element.getAttribute(attribute) ?? '').split(/\s+/).filter(Boolean);
                return ids.map((id) => {
                  const target = document.getElementById(id);
                  return {
                    presentInside: Boolean(target && element.contains(target)),
                    text: target?.textContent?.trim(),
                  };
                });
              })
            );
            expect(relations).toEqual([
              [{ presentInside: true, text: 'Edit Profile' }],
              [
                {
                  presentInside: true,
                  text: "Make changes to your profile here. Click save when you're done.",
                },
              ],
            ]);
            const observation = await capture(step);
            expect(observation.dom.reducedMotion).toBe(reducedMotion === 'reduce');
            expect(observation.dom.bodyOverflow).toBe('hidden');
            expect(observation.dialogs).toEqual([
              expect.objectContaining({
                role: 'dialog',
                name: 'Edit Profile',
                description: "Make changes to your profile here. Click save when you're done.",
              }),
            ]);
            expect(observation.dialogs[0].properties).toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  name: 'modal',
                  value: expect.objectContaining({ value: true }),
                }),
              ])
            );
          };
          const closed = async (step: string) => {
            // Observe natural transition/L1 completion; never complete an
            // inherited transition control or rewrite the recipe's open fact.
            await expect
              .poll(() =>
                page.evaluate((id) => {
                  const element = document.getElementById(id);
                  return (
                    !element ||
                    (element.getAttribute('data-transition-state') === 'closed' &&
                      element.hasAttribute('data-pui-view-detached'))
                  );
                }, contentId)
              )
              .toBe(true);
            expect(await content.isVisible()).toBe(false);
            await expect
              .poll(() => page.evaluate(() => document.body.style.overflow))
              .toBe(originalOverflow);
            await expect.poll(() => focusIs(trigger)).toBe(true);
            expect(await trigger.getAttribute('aria-expanded')).toBe('false');
            const observation = await capture(step);
            expect(observation.dialogs).toEqual([]);
            expect(observation.dom.focusInside).toBe(false);
          };

          const initial = await capture('initial-closed');
          expect(initial.dialogs).toEqual([]);
          // DOM focus establishes the entry anchor only. All Dialog activation,
          // trapped traversal and dismissal below use native browser input.
          await trigger.focus();
          await opened('Enter', 'keyboard-open');
          const cancel = content.getByRole('button', { name: 'Cancel', exact: true });
          const save = content.getByRole('button', { name: 'Save changes', exact: true });
          const icon = content.getByRole('button', { name: 'Close', exact: true });
          for (const button of [cancel, save, icon]) expect(await button.count()).toBe(1);
          await expect.poll(() => focusIs(cancel)).toBe(true);
          for (const [index, target] of [save, icon, cancel].entries()) {
            await page.keyboard.press('Tab');
            await expect.poll(() => focusIs(target)).toBe(true);
            await capture(`tab-${index + 1}`);
          }
          for (const [index, target] of [icon, save, cancel].entries()) {
            await page.keyboard.press('Shift+Tab');
            await expect.poll(() => focusIs(target)).toBe(true);
            await capture(`reverse-tab-${index + 1}`);
          }
          await page.keyboard.press('Enter');
          await closed('cancel-keyboard-closed');

          await opened('Space', 'space-reopen');
          await save.click();
          await closed('save-pointer-closed');

          await opened('Enter', 'icon-reopen');
          await page.keyboard.press('Shift+Tab');
          await expect.poll(() => focusIs(icon)).toBe(true);
          await capture('icon-focused');
          await page.keyboard.press('Space');
          await closed('icon-keyboard-closed');

          await opened('Enter', 'escape-reopen');
          await page.keyboard.press('Escape');
          await closed('escape-closed');

          await opened('pointer', 'outside-reopen');
          const maskHit = await page.evaluate((coordinates) => {
            const mask = document.elementFromPoint(5, 5);
            return {
              prototype: mask?.getAttribute('data-projection-prototype'),
              coordinates: Object.fromEntries(
                Object.keys(coordinates).map((name) => [
                  name,
                  mask?.getAttribute(`data-projection-${name}`),
                ])
              ),
            };
          }, projectionCoordinates!);
          journey.observations.push({ step: 'outside-mask-hit', ...maskHit });
          expect(maskHit).toEqual({
            prototype: 'shadcn-dialog-mask',
            coordinates: projectionCoordinates,
          });
          await page.mouse.click(5, 5);
          await closed('outside-pointer-closed');

          await opened('Enter', 'final-reopen');
          await page.keyboard.press('Escape');
          await closed('final-closed');
        } catch (error) {
          journey.result = 'failed';
          journey.failure = String(error);
          throw error;
        } finally {
          try {
            await cdp.detach();
          } finally {
            await context.close();
          }
        }
        if (journey.pageErrors.length) {
          journey.result = 'failed';
          journey.failure = `Page errors: ${journey.pageErrors.join('; ')}`;
        }
        expect(journey.pageErrors).toEqual([]);
        journey.result = 'passed';
      }, 120_000);
    }
  }

  it('keeps native mask dismissal after reopening between the two part detachments', async () => {
    const { context, page } = await openRoute(browser, baseUrl, ROUTE, {
      width: 1100,
      height: 900,
    });
    try {
      const trigger = page.locator('[data-previewer-id] [aria-haspopup="dialog"]').first();
      await trigger.waitFor();
      await trigger.evaluate((element) => {
        element.scrollIntoView({ block: 'start' });
        window.scrollBy(0, -160);
      });
      const box = await trigger.boundingBox();
      if (!box) throw new Error('Dialog trigger has no rendered box.');
      const point = { x: box.x + Math.min(15, box.width / 2), y: box.y + box.height / 2 };

      let hitPartialWindow = false;
      for (let attempt = 0; attempt < 5 && !hitPartialWindow; attempt++) {
        await page.mouse.click(point.x, point.y);
        await page.waitForFunction(
          () =>
            document
              .querySelector('wc-shadcn-dialog-content')
              ?.getAttribute('data-transition-state') === 'entered'
        );
        expect(await page.evaluate(() => document.elementFromPoint(5, 5)?.tagName)).toBe(
          'WC-SHADCN-DIALOG-MASK'
        );
        await page.mouse.click(5, 5);

        // The normal 150ms/200ms leave clocks stay intact. A missed window is
        // not evidence of repair: observe the actual next native pointer sample.
        try {
          await page.waitForFunction(
            () => {
              const mask = document.querySelector('wc-shadcn-dialog-mask');
              const content = document.querySelector('wc-shadcn-dialog-content');
              return (
                mask?.hasAttribute('data-pui-view-detached') &&
                content &&
                !content.hasAttribute('data-pui-view-detached')
              );
            },
            undefined,
            { polling: 1, timeout: 1000 }
          );
        } catch {
          await page.waitForFunction(() =>
            document
              .querySelector('wc-shadcn-dialog-content')
              ?.hasAttribute('data-pui-view-detached')
          );
          continue;
        }
        // Install the observer before the click, not alongside it. Sent together,
        // the click could reach the page first; a `once` listener installed
        // after it would then wait for a pointer sample that never comes.
        await page.evaluate(() => {
          (window as PointerSampleWindow).__nextPointerSample = new Promise((resolve) => {
            document.addEventListener(
              'pointerdown',
              (event) => {
                const mask = document.querySelector('wc-shadcn-dialog-mask');
                const content = document.querySelector('wc-shadcn-dialog-content');
                resolve({
                  trusted: event.isTrusted,
                  partial: Boolean(
                    mask?.hasAttribute('data-pui-view-detached') &&
                    content &&
                    !content.hasAttribute('data-pui-view-detached') &&
                    content.getAttribute('data-transition-state') === 'leaving'
                  ),
                });
              },
              { once: true, capture: true }
            );
          });
        });
        await page.mouse.click(point.x, point.y);
        const sample = await page.evaluate(
          () => (window as PointerSampleWindow).__nextPointerSample!
        );
        expect(sample.trusted).toBe(true);
        hitPartialWindow = sample.partial;
        await page.waitForFunction(
          () =>
            document
              .querySelector('wc-shadcn-dialog-content')
              ?.getAttribute('data-transition-state') === 'entered'
        );
        if (!hitPartialWindow) {
          await page.keyboard.press('Escape');
          await page.waitForFunction(() =>
            document
              .querySelector('wc-shadcn-dialog-content')
              ?.hasAttribute('data-pui-view-detached')
          );
        }
      }
      expect(
        hitPartialWindow,
        'a full-detach reopen is not the reported partial-remount scenario'
      ).toBe(true);
      expect(await page.evaluate(() => document.elementFromPoint(5, 5)?.tagName)).toBe(
        'WC-SHADCN-DIALOG-MASK'
      );
      await page.mouse.click(5, 5);
      await page.waitForFunction(
        () =>
          document
            .querySelector('wc-shadcn-dialog-content')
            ?.hasAttribute('data-pui-view-detached'),
        undefined,
        { timeout: 2000 }
      );
      expect(await page.locator('wc-shadcn-dialog-content').getAttribute('data-open')).toBeNull();
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('');

      await page.mouse.click(point.x, point.y);
      await page.waitForFunction(
        () =>
          document
            .querySelector('wc-shadcn-dialog-content')
            ?.getAttribute('data-transition-state') === 'entered'
      );
      await page.keyboard.press('Escape');
      await page.waitForFunction(() =>
        document.querySelector('wc-shadcn-dialog-content')?.hasAttribute('data-pui-view-detached')
      );
    } finally {
      await context.close();
    }
  }, 120_000);
});
