// @vitest-environment node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Page } from '../../../apps/www/node_modules/playwright-core/types/types';
import {
  focusEvidenceDigest,
  startFocusScopeNativeFixture,
  type FocusScopeNativeFixture,
  type ScopeKind,
} from './focus-scope-native-browser-fixture';

type FocusRequest = { reason?: 'programmatic' | 'keyboard' | 'pointer'; preventScroll?: boolean };
type FocusMethod = 'focus' | 'focusSelf';
interface ObservedBoolean {
  get(): boolean;
}
interface TargetExposes {
  focused: ObservedBoolean;
  focusVisible: ObservedBoolean;
  focusable: ObservedBoolean;
  focus(options?: FocusRequest): void;
  focusSelf(options?: FocusRequest): void;
}
interface ScopeExposes {
  active: ObservedBoolean;
  hasFocused: ObservedBoolean;
  open(): void;
  openManual(): void;
  close(): void;
  entry?(): void;
  disableEntry?(disabled: boolean): void;
}
interface GeneratedHost<Exposes> extends HTMLElement {
  readonly logicalOwner: symbol | null;
  /** Emitted owner's actual view flag, distinct from ViewIntent and FocusScope.active. */
  readonly present: boolean;
  readonly viewEpoch: number;
  setProps(next: Record<string, unknown>): void;
  getExposes(): Exposes;
  dispose(): void;
}
interface NativeInputReceipt {
  type: string;
  time: number;
  target: string | null;
  targetTag: string | null;
  composedPath: { tag: string; id: string }[];
  trusted: boolean;
  cancelable: boolean;
  key: string | null;
  defaultPreventedAtCapture: boolean;
  eventPhaseAtCapture: number;
  microtaskSample: { time: number; eventPhase: number; defaultPrevented: boolean } | null;
  defaultPrevented: boolean;
  eventPhaseAtRead: number;
}
interface FocusConsumer {
  trigger: GeneratedHost<TargetExposes>;
  destination: GeneratedHost<TargetExposes>;
  nativeOutside: HTMLButtonElement;
  nativeEntry: HTMLButtonElement | null;
  scope: GeneratedHost<ScopeExposes>;
  inside: GeneratedHost<TargetExposes>;
  inner: GeneratedHost<ScopeExposes> | null;
  nestedInside: GeneratedHost<TargetExposes> | null;
  timeline: NativeInputReceipt[];
  handbacks: { time: number; active: boolean }[];
  kind: ScopeKind;
}
interface FocusObservation {
  activeElement: string | null;
  targets: {
    id: string;
    connected: boolean;
    liveOwner: boolean;
    present: boolean;
    epoch: number;
    focused: boolean | null;
    focusVisible: boolean | null;
    focusable: boolean | null;
    tabIndex: number;
    display: string;
    text: string | null;
    rect: { x: number; y: number; width: number; height: number };
  }[];
  scopes: {
    id: string;
    liveOwner: boolean;
    present: boolean;
    active: boolean | null;
    hasFocused: boolean | null;
  }[];
  retainedChild: {
    sameOwner: boolean;
    sameFocusSelf: boolean;
    sameFocusedHandle: boolean;
    initialEpoch: number;
  } | null;
  handbacks: { time: number; active: boolean }[];
  nativeInputCount: number;
}
declare global {
  interface Window {
    focusScopeConsumerReady: boolean;
    focusScopeConsumer: FocusConsumer;
    focusScopeHeld?: {
      insideOwner: symbol | null;
      epoch: number;
      exposes: TargetExposes;
    };
  }
}
let fixture: FocusScopeNativeFixture;
beforeAll(async () => {
  fixture = await startFocusScopeNativeFixture();
}, 120_000);
afterAll(async () => {
  await fixture?.close();
}, 60_000);

// Read public facts beside the real native active element, view and geometry.
// No Focus helper, logical owner map or native input dispatch is injected here.
async function observation(page: Page): Promise<FocusObservation> {
  return page.evaluate(() => {
    const c = window.focusScopeConsumer;
    const targets = [c.trigger, c.destination, c.inside, c.nestedInside].filter(
      (target): target is GeneratedHost<TargetExposes> => target !== null
    );
    return {
      activeElement: document.activeElement?.id ?? null,
      targets: targets.map((target) => {
        const live = target.logicalOwner !== null;
        const exposed = live ? target.getExposes() : null;
        const rect = target.getBoundingClientRect();
        return {
          id: target.id,
          connected: target.isConnected,
          liveOwner: live,
          present: target.present,
          epoch: target.viewEpoch,
          focused: exposed?.focused.get() ?? null,
          focusVisible: exposed?.focusVisible.get() ?? null,
          focusable: exposed?.focusable.get() ?? null,
          tabIndex: target.tabIndex,
          display: getComputedStyle(target).display,
          text: target.textContent,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        };
      }),
      scopes: [c.scope, c.inner]
        .filter((scope): scope is GeneratedHost<ScopeExposes> => scope !== null)
        .map((scope) => ({
          id: scope.id,
          liveOwner: scope.logicalOwner !== null,
          present: scope.present,
          active: scope.logicalOwner !== null ? scope.getExposes().active.get() : null,
          hasFocused: scope.logicalOwner !== null ? scope.getExposes().hasFocused.get() : null,
        })),
      retainedChild: window.focusScopeHeld
        ? {
            sameOwner: c.inside.logicalOwner === window.focusScopeHeld.insideOwner,
            sameFocusSelf:
              c.inside.getExposes().focusSelf === window.focusScopeHeld.exposes.focusSelf,
            sameFocusedHandle:
              c.inside.getExposes().focused === window.focusScopeHeld.exposes.focused,
            initialEpoch: window.focusScopeHeld.epoch,
          }
        : null,
      handbacks: [...c.handbacks],
      nativeInputCount: c.timeline.length,
    };
  });
}

type RecordObservation = (label: string) => Promise<void>;
async function withConsumer(
  name: string,
  options: { scope?: ScopeKind; nested?: boolean; handback?: boolean; logicalChild?: boolean },
  run: (page: Page, record: RecordObservation) => Promise<void>
) {
  const context = await fixture.browser.newContext({
    viewport: { width: 1000, height: 800 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  const blocked: string[] = [];
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== fixture.baseUrl) {
      blocked.push(url.origin + url.pathname);
      return route.abort();
    }
    return route.continue();
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  const errors: string[] = [];
  const messages: { type: string; text: string }[] = [];
  const observations: { label: string; state: FocusObservation }[] = [];
  const captures: { label: string; path: string; sha256: string }[] = [];
  const cleanupErrors: { phase: string; error: string }[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => messages.push({ type: message.type(), text: message.text() }));
  const record: RecordObservation = async (label) => {
    observations.push({ label, state: await observation(page) });
    const fileName = name + '-' + observations.length + '-' + label + '.png';
    const image = await page.screenshot({
      path: path.join(fixture.evidenceDir, fileName),
      fullPage: true,
    });
    captures.push({ label, path: fileName, sha256: focusEvidenceDigest(image) });
  };
  let failed = false;
  let failure: unknown;
  let timeline: NativeInputReceipt[] = [];
  let traceSha256: string | null = null;
  try {
    const params = new URLSearchParams({
      scope: options.scope ?? 'none',
      nested: String(options.nested ?? false),
      handback: String(options.handback ?? true),
      logicalChild: String(options.logicalChild ?? false),
    });
    const response = await page.goto(fixture.baseUrl + '/?' + params);
    expect(response?.status()).toBe(200);
    await page.waitForFunction(() => window.focusScopeConsumerReady === true);
    // Consumer construction is not an actual-view completion receipt. Wait for
    // the same owner/view predicate before input; do not activate or materialize
    // a scope to manufacture readiness. FocusScope.active remains independent.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const c = window.focusScopeConsumer;
            return [c.trigger, c.destination, c.scope, c.inside, c.inner, c.nestedInside]
              .filter((host) => host !== null)
              .every((host) => host.logicalOwner !== null && host.present);
          }),
        { timeout: 5_000 }
      )
      .toBe(true);
    expect(
      await page.evaluate(() => window.focusScopeConsumer.scope.getExposes().active.get())
    ).toBe(false);
    await record('initial-inactive');
    await run(page, record);
    expect(errors).toEqual([]);
    expect(messages.filter((message) => message.type === 'error')).toEqual([]);
    expect(blocked).toEqual([]);
  } catch (error) {
    failed = true;
    failure = error;
  } finally {
    try {
      await record(failed ? 'failure' : 'complete');
    } catch (error) {
      cleanupErrors.push({ phase: 'final-observation', error: String(error) });
    }
    try {
      timeline = await page.evaluate(() =>
        window.focusScopeConsumer.timeline.map((event) => ({ ...event }))
      );
    } catch (error) {
      cleanupErrors.push({ phase: 'native-input-readback', error: String(error) });
    }
    const tracePath = name + '-trace.zip';
    try {
      await context.tracing.stop({ path: path.join(fixture.evidenceDir, tracePath) });
      traceSha256 = focusEvidenceDigest(await readFile(path.join(fixture.evidenceDir, tracePath)));
    } catch (error) {
      cleanupErrors.push({ phase: 'trace', error: String(error) });
    }
    try {
      await context.close();
    } catch (error) {
      cleanupErrors.push({ phase: 'context-close', error: String(error) });
    }
    await writeFile(
      path.join(fixture.evidenceDir, name + '-result.json'),
      JSON.stringify(
        {
          name,
          options,
          head: fixture.head,
          buildSha256: fixture.buildSha256,
          outcome: failed || cleanupErrors.length > 0 ? 'FAIL' : 'PASS',
          failurePresent: failed,
          failure: failed ? String(failure) : null,
          errors,
          messages,
          blocked,
          observations,
          timeline,
          captures,
          trace: { path: tracePath, sha256: traceSha256 },
          cleanupErrors,
          scope: 'ordinary generated Light DOM Focus consumer in Chromium',
          compiledPopoverConformance: false,
          officialCleanHead32CaseAcceptance: false,
        },
        null,
        2
      )
    );
  }
  if (failed) throw failure;
  if (cleanupErrors.length) throw new Error(JSON.stringify(cleanupErrors));
}

async function focused(page: Page, id: string) {
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe(id);
}
async function openedByNativeTrigger(page: Page, record: RecordObservation, label = 'opened') {
  const inputStart = await page.evaluate(() => window.focusScopeConsumer.timeline.length);
  await page.locator('#trigger').click();
  await focused(page, 'inside');
  expect(
    await page.evaluate(() => {
      const c = window.focusScopeConsumer;
      return {
        active: c.scope.getExposes().active.get(),
        trigger: c.trigger.getExposes().focused.get(),
        inside: c.inside.getExposes().focused.get(),
      };
    })
  ).toEqual({ active: true, trigger: false, inside: true });
  // The native click first focused the original trigger, before authored entry.
  const nativeFocusOrder = await page.evaluate(() =>
    window.focusScopeConsumer.timeline
      .filter((event) => event.type === 'focusin')
      .map((event) => event.target)
  );
  expect(nativeFocusOrder.indexOf('trigger')).toBeGreaterThanOrEqual(0);
  expect(nativeFocusOrder.indexOf('inside')).toBeGreaterThan(nativeFocusOrder.indexOf('trigger'));
  // A native hit may target the rendered span inside the generated control.
  // Keep the raw target and native trust, and attribute this action through its
  // recorded DOM path rather than requiring the leaf itself to have the host ID.
  const nativeInput = await page.evaluate((start) => {
    const c = window.focusScopeConsumer;
    return c.timeline
      .slice(start)
      .filter((event) => event.type === 'pointerdown' || event.type === 'click')
      .map((event) => ({
        type: event.type,
        trusted: event.trusted,
        generatedTarget:
          event.composedPath.find((node) => node.tag === c.trigger.localName)?.id ?? null,
      }));
  }, inputStart);
  expect(nativeInput).toEqual([
    { type: 'pointerdown', trusted: true, generatedTarget: 'trigger' },
    { type: 'click', trusted: true, generatedTarget: 'trigger' },
  ]);
  await record(label);
}
async function outsideNativeFocus(
  page: Page,
  record: RecordObservation,
  label = 'outside-native-focus'
) {
  await page.locator('#native-outside').click();
  await focused(page, 'native-outside');
  expect(
    await page.evaluate(() =>
      window.focusScopeConsumer.timeline.some(
        (event) => event.type === 'focusin' && event.target === 'native-outside' && event.trusted
      )
    )
  ).toBe(true);
  await record(label);
}
async function closeScope(page: Page) {
  await page.evaluate(() => window.focusScopeConsumer.scope.getExposes().close());
  expect(await page.evaluate(() => window.focusScopeConsumer.scope.getExposes().active.get())).toBe(
    false
  );
}
async function holdChild(page: Page) {
  await page.evaluate(() => {
    const inside = window.focusScopeConsumer.inside;
    window.focusScopeHeld = {
      insideOwner: inside.logicalOwner,
      epoch: inside.viewEpoch,
      exposes: inside.getExposes(),
    };
  });
}
async function setChildPresent(page: Page, present: boolean) {
  await page.evaluate(
    (next) =>
      window.focusScopeConsumer.inside.setProps({ label: 'Inside focus target', present: next }),
    present
  );
  await expect
    .poll(() => page.evaluate(() => window.focusScopeConsumer.inside.present))
    .toBe(present);
  expect(
    await page.evaluate(() => {
      const c = window.focusScopeConsumer,
        held = window.focusScopeHeld!;
      return {
        connected: c.inside.isConnected,
        sameOwner: c.inside.logicalOwner === held.insideOwner,
        sameFocusSelf: c.inside.getExposes().focusSelf === held.exposes.focusSelf,
        advancedEpoch: c.inside.viewEpoch > held.epoch,
        physicalContent: c.inside.querySelector('span') !== null,
        rendered: c.inside.getClientRects().length > 0,
      };
    })
  ).toEqual({
    connected: true,
    sameOwner: true,
    sameFocusSelf: true,
    advancedEpoch: true,
    physicalContent: present,
    rendered: present,
  });
}
async function afterMountedFrames(page: Page) {
  // Readiness was observed through present/epoch/content above. These two actual
  // frames bound the subsequent no-replay observation; RAF alone is not commit proof.
  await page.evaluate(async () => {
    for (let frame = 0; frame < 2; frame++) {
      const next = Promise.withResolvers<void>();
      requestAnimationFrame(() => next.resolve());
      await next.promise;
    }
  });
}

describe.sequential('ordinary generated Focus scope native consumer', () => {
  it(
    'restore none preserves a native outside destination and releases the request gate',
    async () =>
      withConsumer('none-outside', {}, async (page, record) => {
        await openedByNativeTrigger(page, record);
        await outsideNativeFocus(page, record);
        await page.evaluate(() =>
          window.focusScopeConsumer.trigger.getExposes().focusSelf({ reason: 'programmatic' })
        );
        expect(await page.evaluate(() => document.activeElement?.id)).toBe('native-outside');
        expect(
          await page.evaluate(() => window.focusScopeConsumer.scope.getExposes().active.get())
        ).toBe(true);
        await record('active-gate-retained');
        await closeScope(page);
        expect(
          await page.evaluate(() => ({
            focus: document.activeElement?.id,
            handbacks: window.focusScopeConsumer.handbacks.length,
          }))
        ).toEqual({ focus: 'native-outside', handbacks: 0 });
        await record('closed-none-preserves-outside');
        await page.evaluate(() =>
          window.focusScopeConsumer.destination.getExposes().focusSelf({ reason: 'keyboard' })
        );
        await focused(page, 'destination');
        await record('outside-public-request-accepted');
      }),
    30_000
  );

  it(
    'authored Escape close and explicit public consumer handback survive repeated openings',
    async () =>
      withConsumer('escape-explicit-handback', {}, async (page, record) => {
        for (let cycle = 1; cycle <= 3; cycle++) {
          await openedByNativeTrigger(page, record, 'opened-' + cycle);
          await page.keyboard.press('Escape');
          await focused(page, 'trigger');
          expect(
            await page.evaluate(() => {
              const c = window.focusScopeConsumer;
              return {
                active: c.scope.getExposes().active.get(),
                focused: c.trigger.getExposes().focused.get(),
                visible: c.trigger.getExposes().focusVisible.get(),
                count: c.handbacks.length,
                closedBeforeHandback: c.handbacks.every((event) => !event.active),
              };
            })
          ).toEqual({
            active: false,
            focused: true,
            visible: true,
            count: cycle,
            closedBeforeHandback: true,
          });
          await record('escape-handback-' + cycle);
        }
        // Snapshot the native Event accessors after Keyboard.press and handback
        // complete; eventPhase NONE (0) proves this read is outside dispatch.
        const escapes = await page.evaluate(() =>
          window.focusScopeConsumer.timeline
            .filter((event) => event.type === 'keydown' && event.key === 'Escape')
            .map((event) => ({ ...event }))
        );
        expect(escapes).toHaveLength(3);
        expect(
          escapes.every(
            (event) =>
              event.trusted &&
              event.cancelable &&
              event.eventPhaseAtRead === 0 &&
              event.defaultPrevented
          )
        ).toBe(true);
      }),
    30_000
  );

  it(
    'the same Escape close without consumer handback does not acquire the trigger',
    async () =>
      withConsumer('escape-without-handback', { handback: false }, async (page, record) => {
        await openedByNativeTrigger(page, record);
        await page.keyboard.press('Escape');
        expect(
          await page.evaluate(() => ({
            focus: document.activeElement?.id,
            active: window.focusScopeConsumer.scope.getExposes().active.get(),
            handbacks: window.focusScopeConsumer.handbacks.length,
          }))
        ).toEqual({ focus: 'inside', active: false, handbacks: 1 });
        await record('escape-none-without-consumer-transfer');
      }),
    30_000
  );

  for (const scope of ['ordinary', 'previous'] as const)
    it(
      scope + ' restoration still returns to the captured live trigger',
      async () =>
        withConsumer('restore-' + scope, { scope }, async (page, record) => {
          await openedByNativeTrigger(page, record);
          await outsideNativeFocus(page, record);
          await closeScope(page);
          await focused(page, 'trigger');
          expect(await page.evaluate(() => window.focusScopeConsumer.handbacks)).toEqual([]);
          await record('automatic-previous-restoration');
        }),
      30_000
    );

  for (const scope of ['none', 'manual'] as const)
    it(
      scope + ' manual entry keeps the boundary and allows explicit inside focus',
      async () =>
        withConsumer('manual-' + scope, { scope }, async (page, record) => {
          await page.keyboard.press('Tab');
          await focused(page, 'trigger');
          await record('keyboard-trigger-focused');
          await page.evaluate((perActivation) => {
            const exposed = window.focusScopeConsumer.scope.getExposes();
            if (perActivation) exposed.openManual();
            else exposed.open();
          }, scope === 'none');
          expect(
            await page.evaluate(() => ({
              focus: document.activeElement?.id,
              active: window.focusScopeConsumer.scope.getExposes().active.get(),
            }))
          ).toEqual({ focus: 'trigger', active: true });
          await record('manual-boundary-without-entry');
          await page.evaluate(() =>
            window.focusScopeConsumer.destination.getExposes().focusSelf({ reason: 'keyboard' })
          );
          expect(await page.evaluate(() => document.activeElement?.id)).toBe('trigger');
          await page.evaluate(() =>
            window.focusScopeConsumer.inside.getExposes().focusSelf({ reason: 'keyboard' })
          );
          await focused(page, 'inside');
          await record('explicit-inside-entry');
          await closeScope(page);
          expect(await page.evaluate(() => document.activeElement?.id)).toBe('inside');
          await record('manual-none-close');
          await page.locator('#trigger').click();
          await focused(page, scope === 'none' ? 'inside' : 'trigger');
          expect(
            await page.evaluate(() => window.focusScopeConsumer.scope.getExposes().active.get())
          ).toBe(true);
          await record('next-activation-follows-setup');
        }),
      30_000
    );

  it(
    'nested none leaves the parent boundary active and the parent restores its own capture',
    async () =>
      withConsumer(
        'nested-ownership',
        { scope: 'ordinary', nested: true },
        async (page, record) => {
          await openedByNativeTrigger(page, record);
          await page.evaluate(() => window.focusScopeConsumer.inner!.getExposes().openManual());
          expect(await page.evaluate(() => document.activeElement?.id)).toBe('inside');
          await page.evaluate(() =>
            window.focusScopeConsumer.nestedInside!.getExposes().focusSelf({ reason: 'keyboard' })
          );
          await focused(page, 'nested-inside');
          await record('nested-manual-entry');
          await outsideNativeFocus(page, record);
          await page.evaluate(() => window.focusScopeConsumer.inner!.getExposes().close());
          expect(
            await page.evaluate(() => ({
              focus: document.activeElement?.id,
              parent: window.focusScopeConsumer.scope.getExposes().active.get(),
              inner: window.focusScopeConsumer.inner!.getExposes().active.get(),
            }))
          ).toEqual({ focus: 'native-outside', parent: true, inner: false });
          await page.evaluate(() =>
            window.focusScopeConsumer.destination.getExposes().focusSelf({ reason: 'keyboard' })
          );
          expect(await page.evaluate(() => document.activeElement?.id)).toBe('native-outside');
          await record('inner-close-retains-parent-gate');
          await page.evaluate(() =>
            window.focusScopeConsumer.inside.getExposes().focusSelf({ reason: 'keyboard' })
          );
          await focused(page, 'inside');
          await closeScope(page);
          await focused(page, 'trigger');
          await record('parent-restores-original-trigger');
        }
      ),
    30_000
  );

  it(
    'a disposed previous owner cannot be restored through a stale public callable',
    async () =>
      withConsumer('disposed-previous-owner', { scope: 'ordinary' }, async (page, record) => {
        await openedByNativeTrigger(page, record);
        await outsideNativeFocus(page, record);
        const retired = await page.evaluate(() => {
          const c = window.focusScopeConsumer,
            held = c.trigger.getExposes().focusSelf;
          c.trigger.dispose();
          c.scope.getExposes().close();
          let rejected = false,
            message: string | null = null;
          try {
            held({ reason: 'keyboard' });
          } catch (error) {
            rejected = true;
            message = String(error);
          }
          return {
            rejected,
            message,
            focus: document.activeElement?.id,
            owner: c.trigger.logicalOwner === null,
            exposes: Object.keys(c.trigger.getExposes()),
          };
        });
        expect(retired).toMatchObject({
          rejected: true,
          focus: 'native-outside',
          owner: true,
          exposes: [],
        });
        expect(retired.message).toMatch(/disposed/);
        await record('stale-trigger-rejected-outside-preserved');
      }),
    30_000
  );

  it(
    'disposing an active scope releases its gate without automatic none handback',
    async () =>
      withConsumer('disposed-active-scope', {}, async (page, record) => {
        await openedByNativeTrigger(page, record);
        await outsideNativeFocus(page, record);
        const retired = await page.evaluate(() => {
          const c = window.focusScopeConsumer,
            held = c.scope.getExposes().close;
          c.scope.dispose();
          let rejected = false;
          try {
            held();
          } catch {
            rejected = true;
          }
          return {
            rejected,
            focus: document.activeElement?.id,
            owner: c.scope.logicalOwner === null,
            exposes: Object.keys(c.scope.getExposes()),
          };
        });
        expect(retired).toEqual({
          rejected: true,
          focus: 'native-outside',
          owner: true,
          exposes: [],
        });
        await record('scope-disposed-outside-preserved');
        await page.evaluate(() =>
          window.focusScopeConsumer.destination.getExposes().focusSelf({ reason: 'keyboard' })
        );
        await focused(page, 'destination');
        await record('disposed-boundary-releases-outside');
      }),
    30_000
  );

  // Two public operations reach distinct native queues. The no-close control
  // proves that the request was deferred and retried by the real generated child.
  // Only an actual closing-scope boundary requires cancellation in the red arm;
  // retaining the same logical owner across a view epoch is intentionally allowed.
  for (const method of ['focus', 'focusSelf'] as const) {
    it(
      'queued ' + method + ' survives child view detachment while its scope remains active',
      async () =>
        withConsumer('queued-' + method + '-readiness-control', {}, async (page, record) => {
          await openedByNativeTrigger(page, record);
          await holdChild(page);
          await setChildPresent(page, false);
          await record('child-view-unavailable');
          await page.evaluate(
            (operation: FocusMethod) =>
              window.focusScopeConsumer.inside.getExposes()[operation]({ reason: 'keyboard' }),
            method
          );
          expect(
            await page.evaluate(() => window.focusScopeConsumer.inside.getExposes().focused.get())
          ).toBe(false);
          await record('public-request-pending-without-facts');
          await outsideNativeFocus(page, record);
          expect(
            await page.evaluate(() => window.focusScopeConsumer.scope.getExposes().active.get())
          ).toBe(true);
          await setChildPresent(page, true);
          await afterMountedFrames(page);
          await focused(page, 'inside');
          expect(
            await page.evaluate(() => window.focusScopeConsumer.inside.getExposes().focused.get())
          ).toBe(true);
          await record('live-scope-retries-pending-child-request');
        }),
      30_000
    );

    it(
      'queued ' + method + ' cannot replay after its owning scope closes',
      async () =>
        withConsumer('queued-' + method + '-close-cancellation', {}, async (page, record) => {
          await openedByNativeTrigger(page, record);
          await holdChild(page);
          await setChildPresent(page, false);
          await record('child-view-unavailable');
          await page.evaluate(
            (operation: FocusMethod) =>
              window.focusScopeConsumer.inside.getExposes()[operation]({ reason: 'keyboard' }),
            method
          );
          expect(
            await page.evaluate(() => window.focusScopeConsumer.inside.getExposes().focused.get())
          ).toBe(false);
          await record('public-request-pending-without-facts');
          await closeScope(page);
          await record('owning-scope-closed');
          await outsideNativeFocus(page, record);
          const focusEventsBefore = await page.evaluate(
            () =>
              window.focusScopeConsumer.timeline.filter(
                (event) => event.type === 'focusin' && event.target === 'inside'
              ).length
          );
          await setChildPresent(page, true);
          await afterMountedFrames(page);
          await record('remounted-after-close');
          expect(
            await page.evaluate(() => ({
              focus: document.activeElement?.id,
              active: window.focusScopeConsumer.scope.getExposes().active.get(),
              childFocused: window.focusScopeConsumer.inside.getExposes().focused.get(),
              insideFocusEvents: window.focusScopeConsumer.timeline.filter(
                (event) => event.type === 'focusin' && event.target === 'inside'
              ).length,
            }))
          ).toEqual({
            focus: 'native-outside',
            active: false,
            childFocused: false,
            insideFocusEvents: focusEventsBefore,
          });
        }),
      30_000
    );
  }
});

describe.sequential('ordinary generated Scope-owned native Entry', () => {
  it(
    'self fallback focuses the Entry Root through a programmatic lease without declaring target state',
    async () =>
      withConsumer('owned-entry-native-self', { scope: 'ownedSelf' }, async (page, record) => {
        await outsideNativeFocus(page, record);
        expect(
          await page.evaluate(() => window.focusScopeConsumer.scope.getAttribute('tabindex'))
        ).toBe(null);
        await page.evaluate(() => window.focusScopeConsumer.scope.getExposes().open());
        await focused(page, 'scope');
        expect(
          await page.evaluate(() => {
            const c = window.focusScopeConsumer;
            return {
              active: c.scope.getExposes().active.get(),
              tabindex: c.scope.getAttribute('tabindex'),
              targetStateExposed: Object.hasOwn(c.scope.getExposes(), 'focused'),
            };
          })
        ).toEqual({ active: false, tabindex: '-1', targetStateExposed: false });
        await record('entry-self-acquired-without-sequential-target');
        await page.evaluate(() => window.focusScopeConsumer.scope.getExposes().disableEntry!(true));
        expect(
          await page.evaluate(() => window.focusScopeConsumer.scope.getAttribute('tabindex'))
        ).toBe(null);
        await outsideNativeFocus(page, record);
        await closeScope(page);
        await afterMountedFrames(page);
        await focused(page, 'native-outside');
        await record('entry-lease-retired-on-role-disable');
      }),
    30_000
  );

  it(
    'keeps manual activation local, then enters the native region without creating a Focusable Root',
    async () =>
      withConsumer('owned-entry-native-region', { scope: 'owned' }, async (page, record) => {
        await outsideNativeFocus(page, record);
        await page.evaluate(() => window.focusScopeConsumer.scope.getExposes().openManual());
        await focused(page, 'native-outside');
        await record('manual-keeps-outside-focus');
        await closeScope(page);
        await page.locator('#trigger').click();
        await focused(page, 'native-entry');
        expect(
          await page.evaluate(() => {
            const c = window.focusScopeConsumer;
            return {
              active: c.scope.getExposes().active.get(),
              rootFocused: document.activeElement === c.scope,
              rootTabindex: c.scope.getAttribute('tabindex'),
              insideFocused: c.inside.getExposes().focused.get(),
              nativeFocusEvents: c.timeline.filter(
                (event) => event.type === 'focusin' && event.target === 'native-entry'
              ).length,
            };
          })
        ).toEqual({
          active: false,
          rootFocused: false,
          rootTabindex: null,
          insideFocused: false,
          nativeFocusEvents: 1,
        });
        await record('native-entry-acquired-once');
        await outsideNativeFocus(page, record);
        await closeScope(page);
        await afterMountedFrames(page);
        await focused(page, 'native-outside');
        await record('inactive-close-preserves-outside-destination');
      }),
    30_000
  );

  it(
    'selected logical child priority survives its missing host view',
    async () =>
      withConsumer(
        'owned-entry-selected-child',
        { scope: 'owned', logicalChild: true },
        async (page, record) => {
          await holdChild(page);
          await setChildPresent(page, false);
          await outsideNativeFocus(page, record);
          await page.evaluate(() => window.focusScopeConsumer.scope.getExposes().open());
          await afterMountedFrames(page);
          await focused(page, 'native-outside');
          expect(
            await page.evaluate(() =>
              window.focusScopeConsumer.timeline.some(
                (event) => event.type === 'focusin' && event.target === 'native-entry'
              )
            )
          ).toBe(false);
          await record('logical-child-selected-without-view');
          await setChildPresent(page, true);
          await afterMountedFrames(page);
          await focused(page, 'inside');
          expect(
            await page.evaluate(() =>
              window.focusScopeConsumer.timeline.some(
                (event) => event.type === 'focusin' && event.target === 'native-entry'
              )
            )
          ).toBe(false);
          await record('selected-child-owns-later-host-readiness');
        }
      ),
    30_000
  );

  it(
    'retains an initial Entry resolution gap and acquires only once when the current descendant appears',
    async () =>
      withConsumer('owned-entry-initial-gap', { scope: 'owned' }, async (page, record) => {
        await page.evaluate(() => {
          const c = window.focusScopeConsumer;
          c.nativeEntry!.remove();
          c.scope.getExposes().entry!();
        });
        await outsideNativeFocus(page, record);
        await page.evaluate(() => {
          const c = window.focusScopeConsumer;
          c.scope.append(c.nativeEntry!);
        });
        await afterMountedFrames(page);
        await focused(page, 'native-outside');
        await record('independent-unresolved-entry-remains-noop');
        await page.evaluate(() => {
          const c = window.focusScopeConsumer;
          c.nativeEntry!.remove();
          c.scope.getExposes().open();
        });
        expect(
          await page.evaluate(() => window.focusScopeConsumer.scope.getExposes().active.get())
        ).toBe(false);
        await record('activation-owns-unresolved-entry');
        await page.evaluate(() => {
          const c = window.focusScopeConsumer;
          c.scope.append(c.nativeEntry!);
        });
        await focused(page, 'native-entry');
        await record('current-native-descendant-satisfies-entry');
        await outsideNativeFocus(page, record);
        await page.evaluate(() =>
          window.focusScopeConsumer.scope.append(document.createElement('span'))
        );
        await afterMountedFrames(page);
        await focused(page, 'native-outside');
        expect(
          await page.evaluate(
            () =>
              window.focusScopeConsumer.timeline.filter(
                (event) => event.type === 'focusin' && event.target === 'native-entry'
              ).length
          )
        ).toBe(1);
        await record('later-readiness-does-not-reacquire');
      }),
    30_000
  );

  for (const cancel of ['deactivate', 'Entry disable', 'new target'] as const) {
    it(
      cancel + ' cancels unavailable native Entry before later readiness',
      async () =>
        withConsumer(
          'owned-entry-cancel-' + cancel.replaceAll(' ', '-'),
          { scope: 'owned' },
          async (page, record) => {
            await outsideNativeFocus(page, record);
            await page.evaluate(() => {
              const c = window.focusScopeConsumer;
              c.nativeEntry!.style.display = 'none';
              c.scope.getExposes().open();
            });
            await focused(page, 'native-outside');
            await record('native-entry-unavailable');
            await page.evaluate((action) => {
              const c = window.focusScopeConsumer;
              if (action === 'deactivate') c.scope.getExposes().close();
              else if (action === 'Entry disable') {
                c.scope.getExposes().disableEntry!(true);
                c.scope.getExposes().disableEntry!(false);
              } else c.destination.getExposes().focusSelf({ reason: 'pointer' });
              c.nativeEntry!.style.display = '';
              c.scope.append(document.createElement('span'));
            }, cancel);
            await afterMountedFrames(page);
            await focused(page, cancel === 'new target' ? 'destination' : 'native-outside');
            expect(
              await page.evaluate(() =>
                window.focusScopeConsumer.timeline.some(
                  (event) => event.type === 'focusin' && event.target === 'native-entry'
                )
              )
            ).toBe(false);
            await record('canceled-entry-does-not-steal-later-focus');
          }
        ),
      30_000
    );
  }

  it(
    'deactivate cancels an owned continuation while the retained Scope view is absent',
    async () =>
      withConsumer('owned-entry-retained-scope-close', { scope: 'owned' }, async (page, record) => {
        await outsideNativeFocus(page, record);
        await page.evaluate(() => {
          const c = window.focusScopeConsumer;
          c.nativeEntry!.remove();
          c.scope.getExposes().open();
          c.scope.setProps({ present: false });
        });
        await expect
          .poll(() => page.evaluate(() => window.focusScopeConsumer.scope.present))
          .toBe(false);
        await record('scope-view-absent-with-owned-continuation');
        await closeScope(page);
        await page.evaluate(() => {
          const c = window.focusScopeConsumer;
          c.scope.append(c.nativeEntry!);
          c.scope.setProps({ present: true });
        });
        await expect
          .poll(() => page.evaluate(() => window.focusScopeConsumer.scope.present))
          .toBe(true);
        await afterMountedFrames(page);
        await focused(page, 'native-outside');
        expect(
          await page.evaluate(() =>
            window.focusScopeConsumer.timeline.some(
              (event) => event.type === 'focusin' && event.target === 'native-entry'
            )
          )
        ).toBe(false);
        await record('retained-scope-readiness-cannot-resurrect-close');
        await page.evaluate(() => window.focusScopeConsumer.scope.getExposes().entry!());
        await focused(page, 'native-entry');
        await record('new-independent-entry-still-available');
      }),
    30_000
  );
});
