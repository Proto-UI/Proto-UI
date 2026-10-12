import assert from 'node:assert/strict';
import type { launchBrowser } from '../../../../apps/www/src/content/docs/zh-cn/browser-harness';

type Browser = Awaited<ReturnType<typeof launchBrowser>>;

export type InputPoint = { kind: string; x: number; y: number };
export type Box = { x: number; y: number; width: number; height: number };
export type NativeRecord = {
  eventId: number;
  type: string;
  eventPhase: number;
  now: number;
  isTrusted: boolean;
  defaultPrevented: boolean;
  composedPath: string[];
  checked: boolean;
  pointerType?: string;
  clientX?: number;
  clientY?: number;
};
export type TapTrace = {
  checkpoint: { requestedInput: InputPoint; checked: boolean };
  nativeEvents: NativeRecord[];
  stateChanges: { prev: boolean; next: boolean; now: number }[];
  exposedChanges: { checked: boolean; now: number }[];
};

/** Check authored hit regions independently from the UA's native touch adjustment. */
export function assertNoAuthoredOutsideHit(snapshot: {
  staticHitAttribute: string | null;
  outsidePoints: { label: string; ownedHit: boolean }[];
}) {
  assert.equal(snapshot.staticHitAttribute, null, 'New York must not declare a static hit inset');
  assert.equal(snapshot.outsidePoints.length, 4, 'all four close border probes are required');
  for (const point of snapshot.outsidePoints)
    assert.equal(point.ownedHit, false, `authored hit area extends outside ${point.label}`);
}

/** A near-edge tap follows the trusted native target, never its raw-coordinate assumption. */
export function assertNativeTapRoute(
  trace: TapTrace,
  owner: string,
  after: boolean,
  expectedOwned?: boolean
) {
  const expectedTypes = [
    'pointerdown',
    'touchstart',
    'pointerup',
    'touchend',
    'mousedown',
    'mouseup',
    'click',
  ];
  const capture = trace.nativeEvents.filter((event) => event.eventPhase === 1);
  const bubble = trace.nativeEvents.filter((event) => event.eventPhase === 3);
  assert.deepEqual(
    capture.map((event) => event.type),
    expectedTypes,
    'one complete native tap capture sequence'
  );
  assert.deepEqual(
    bubble.map((event) => event.type),
    expectedTypes,
    'one complete native tap bubble sequence'
  );
  assert.equal(trace.nativeEvents.length, 14, 'no duplicate, canceled or extra native input');
  for (let index = 0; index < expectedTypes.length; index++) {
    assert.equal(
      capture[index].eventId,
      bubble[index].eventId,
      'capture/bubble must describe the same event'
    );
    assert.equal(trace.nativeEvents[index * 2], capture[index], 'native event capture order');
    assert.equal(trace.nativeEvents[index * 2 + 1], bubble[index], 'native event bubble order');
  }
  assert.equal(capture[0].pointerType, 'touch');
  assert.equal(capture[0].clientX, trace.checkpoint.requestedInput.x, 'retain raw touch x');
  assert.equal(capture[0].clientY, trace.checkpoint.requestedInput.y, 'retain raw touch y');
  const click = capture.at(-1)!;
  assert.equal(click.pointerType, 'touch');
  const owned = click.composedPath.includes(owner);
  if (expectedOwned !== undefined) assert.equal(owned, expectedOwned, 'native touch owner');
  const before = trace.checkpoint.checked;
  const expected = owned ? !before : before;
  for (const event of trace.nativeEvents) {
    assert.equal(event.isTrusted, true, 'native input must be trusted');
    assert.equal(event.defaultPrevented, false, 'fixture must not suppress native defaults');
    assert.equal(
      event.composedPath.includes(owner),
      owned,
      'stationary tap stays in one native owner domain'
    );
    assert.equal(
      event.checked,
      event === bubble.at(-1) ? expected : before,
      'only native click may commit'
    );
  }
  assert.equal(after, expected, 'checked must follow the actual native click target');
  assert.deepEqual(
    trace.stateChanges.map(({ prev, next }) => ({ prev, next })),
    owned ? [{ prev: before, next: expected }] : [],
    'one state transition per owned click, including hidden repeated toggles'
  );
  assert.deepEqual(
    trace.exposedChanges.map(({ checked }) => checked),
    owned ? [expected] : [],
    'one checkedChange per owned click'
  );
  for (const change of [...trace.stateChanges, ...trace.exposedChanges]) {
    assert.ok(
      change.now >= click.now && change.now <= bubble.at(-1)!.now,
      'state and signal commit inside the click dispatch'
    );
  }
  return {
    owned,
    requested: trace.checkpoint.requestedInput,
    click: { x: click.clientX, y: click.clientY },
  };
}

/** Self-authored HTML control. Its target choice is evidence, not guaranteed custom-element parity. */
export async function measureNativeButtonControl(
  browser: Browser,
  scope: 'document' | 'shadow',
  box: Box
) {
  const page = await browser.newPage({ hasTouch: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  try {
    await page.route('**/*', (route) => route.abort());
    await page.setContent(
      '<main style="padding:80px;min-height:280px"><div id="mount"></div></main>'
    );
    await page.evaluate(
      ({ scope, box }) => {
        document.documentElement.style.fontSize = box.width / 2 + 'px';
        const button = document.createElement('button');
        button.id = 'native-button';
        button.type = 'button';
        button.setAttribute('role', 'switch');
        const host = scope === 'shadow' ? document.createElement('div') : button;
        host.id = scope === 'shadow' ? 'control-host' : 'native-button';
        host.style.cssText = `position:absolute;left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px;`;
        const container =
          scope === 'shadow' ? host.attachShadow({ mode: 'open' }) : host.parentNode;
        button.style.cssText +=
          'box-sizing:border-box;display:inline-flex;align-items:center;padding:0;border:1px solid transparent;border-radius:9999px;appearance:none;overflow:visible;background:#eee;';
        if (scope === 'shadow') {
          button.style.cssText += 'position:relative;width:100%;height:100%;';
          container!.appendChild(button);
        }
        document.querySelector('#mount')!.append(host);
        let checked = true,
          stage = 'setup',
          eventId = 0;
        const events: unknown[] = [],
          changes: unknown[] = [],
          checkpoints: unknown[] = [];
        const ids = new WeakMap<Event, number>();
        const types = [
          'pointerdown',
          'touchstart',
          'pointerup',
          'touchend',
          'mousedown',
          'mouseup',
          'click',
        ];
        const record = (event: Event) => {
          if (!ids.has(event)) ids.set(event, ++eventId);
          const pointer = event as PointerEvent;
          events.push({
            stage,
            eventId: ids.get(event),
            type: event.type,
            eventPhase: event.eventPhase,
            now: performance.now(),
            checked,
            isTrusted: event.isTrusted,
            defaultPrevented: event.defaultPrevented,
            target: (event.target as Element)?.localName,
            composedPath: event
              .composedPath()
              .map((target) =>
                target instanceof Element
                  ? target.localName + (target.id ? '#' + target.id : '')
                  : target instanceof ShadowRoot
                    ? '#shadow-root'
                    : target === document
                      ? 'document'
                      : 'window'
              ),
            ownerInPath: event.composedPath().includes(button),
            clientX: pointer.clientX,
            clientY: pointer.clientY,
            pointerType: pointer.pointerType,
            width: pointer.width,
            height: pointer.height,
            changedTouches: Array.from((event as TouchEvent).changedTouches ?? []).map((point) => ({
              clientX: point.clientX,
              clientY: point.clientY,
              radiusX: point.radiusX,
              radiusY: point.radiusY,
            })),
          });
        };
        for (const type of types) {
          window.addEventListener(type, record, { capture: true, passive: true });
          window.addEventListener(type, record, { passive: true });
        }
        button.addEventListener('click', () => {
          checked = !checked;
          changes.push({ stage, checked, now: performance.now() });
        });
        const snapshot = (name: string, x: number, y: number) => {
          stage = name;
          const pointTarget = document.elementFromPoint(x, y);
          const r = button.getBoundingClientRect();
          const value = {
            stage,
            checked,
            now: performance.now(),
            x,
            y,
            box: { x: r.x, y: r.y, width: r.width, height: r.height },
            pointHit: pointTarget?.localName ?? null,
            ownedPointHit: pointTarget === host || (!!pointTarget && host.contains(pointTarget)),
          };
          checkpoints.push(value);
          return value;
        };
        (window as any).nativeButtonProbe = {
          snapshot,
          read: () => ({ checked, events, changes, checkpoints }),
          mutationControl(x: number, y: number) {
            const style = document.createElement('style');
            style.textContent =
              '#native-button::after{content:"";position:absolute;inset:-6px;pointer-events:auto}';
            const styleRoot = scope === 'shadow' ? container! : document.head;
            styleRoot.appendChild(style);
            try {
              return snapshot('authored-expansion-mutation', x, y);
            } finally {
              style.remove();
            }
          },
        };
      },
      { scope, box }
    );
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    for (const [stage, point, kind] of [
      ['center-pointer', center, 'mouse'],
      ['center-touch', center, 'touch'],
      ['near-touch', { x: box.x - 4, y: box.y + 9 }, 'touch'],
      ['far-touch', { x: box.x - 40, y: box.y + 9 }, 'touch'],
    ] as const) {
      await page.evaluate(
        ({ stage, point }) => (window as any).nativeButtonProbe.snapshot(stage, point.x, point.y),
        { stage, point }
      );
      if (kind === 'mouse') await page.mouse.click(point.x, point.y);
      else await page.touchscreen.tap(point.x, point.y);
      await page.waitForTimeout(190);
    }
    const mutation = await page.evaluate(
      ({ x, y }) => (window as any).nativeButtonProbe.mutationControl(x, y),
      { x: box.x - 4, y: box.y + 9 }
    );
    const evidence = await page.evaluate(() => (window as any).nativeButtonProbe.read());
    return {
      browserVersion: browser.version(),
      scope,
      requestedBox: box,
      evidence,
      mutation,
      errors,
      measurementError: null,
      boundary:
        'Standard HTML button with role=switch; no claim of equivalence to the Proto custom-element target selection.',
    };
  } catch (error) {
    const evidence = await page
      .evaluate(() => (window as any).nativeButtonProbe?.read() ?? null)
      .catch((collectionError) => ({ collectionError: String(collectionError) }));
    return {
      browserVersion: browser.version(),
      scope,
      requestedBox: box,
      evidence,
      mutation: null,
      errors,
      measurementError: String(error),
      boundary: 'Partial failed native-button diagnostic; not a passing control.',
    };
  } finally {
    await page.close();
  }
}
