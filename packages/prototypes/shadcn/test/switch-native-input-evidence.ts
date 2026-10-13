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
  rootBox: Box;
  sampling: 'chromium-1-css-pixel-footprint';
  outsidePoints: { label: string; x: number; y: number; ownedHit: boolean }[];
}) {
  assert.equal(snapshot.staticHitAttribute, null, 'New York must not declare a static hit inset');
  assert.equal(snapshot.sampling, 'chromium-1-css-pixel-footprint');
  assert.deepEqual(
    snapshot.outsidePoints.map(({ label }) => label),
    ['left', 'right', 'top', 'bottom']
  );
  const r = snapshot.rootBox;
  assert.ok(
    [r.x, r.y, r.width, r.height].every(Number.isFinite) && r.width > 0 && r.height > 0,
    'finite nonempty root border box is required'
  );
  for (const point of snapshot.outsidePoints) {
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), 'finite query coordinates');
    // Blink point queries cover [x,x+1) × [y,y+1), not a zero-area mathematical point.
    const overlaps =
      point.x < r.x + r.width && point.x + 1 > r.x && point.y < r.y + r.height && point.y + 1 > r.y;
    assert.equal(overlaps, false, `query footprint overlaps the ${point.label} border`);
    assert.equal(point.ownedHit, false, `authored hit area extends outside ${point.label}`);
  }
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
        const decoration =
          'box-sizing:border-box;display:inline-flex;align-items:center;padding:0;border:1px solid transparent;border-radius:9999px;appearance:none;overflow:visible;background:#eee;';
        const rect = (element: Element) => {
          const r = element.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        };
        const styleSnapshot = (element: HTMLElement) => {
          const style = getComputedStyle(element);
          const pseudo = (name: string) => {
            const value = getComputedStyle(element, name);
            return {
              content: value.content,
              position: value.position,
              inset: value.getPropertyValue('inset'),
              pointerEvents: value.pointerEvents,
            };
          };
          return {
            pseudoBefore: pseudo('::before'),
            pseudoAfter: pseudo('::after'),
            cssText: element.style.cssText,
            height: style.height,
            width: style.width,
            boxSizing: style.boxSizing,
            transform: style.transform,
            zoom: style.zoom,
          };
        };
        // Preserve the former floating-pixel cssText read/append/write path as an
        // isolated diagnostic. It is removed before any control native input.
        const roundTripButton = document.createElement('button');
        roundTripButton.type = 'button';
        roundTripButton.setAttribute('role', 'switch');
        const roundTripHost = scope === 'shadow' ? document.createElement('div') : roundTripButton;
        const requestedCssText = `position:absolute;left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px;`;
        roundTripHost.style.cssText = requestedCssText;
        document.body.append(roundTripHost);
        const beforeRoundTrip = { box: rect(roundTripHost), style: styleSnapshot(roundTripHost) };
        const serializedCssText = roundTripHost.style.cssText;
        roundTripButton.style.cssText += decoration;
        if (scope === 'shadow') {
          roundTripButton.style.cssText += 'position:relative;width:100%;height:100%;';
          roundTripHost.attachShadow({ mode: 'open' }).append(roundTripButton);
        }
        const roundTrip = {
          requestedCssText,
          serializedCssText,
          before: beforeRoundTrip,
          after: { box: rect(roundTripHost), style: styleSnapshot(roundTripHost) },
          buttonAfter: { box: rect(roundTripButton), style: styleSnapshot(roundTripButton) },
        };
        roundTripHost.remove();
        const button = document.createElement('button');
        button.id = 'native-button';
        button.type = 'button';
        button.setAttribute('role', 'switch');
        const host = scope === 'shadow' ? document.createElement('div') : button;
        host.id = scope === 'shadow' ? 'control-host' : 'native-button';
        // Build the original New York dimensions from declarations once; do not
        // serialize measured fractional pixels and feed them back through CSSOM.
        host.style.cssText =
          `position:absolute;left:${box.x}px;top:${box.y}px;width:2rem;height:1.15rem;` +
          (scope === 'document' ? decoration : '');
        const container =
          scope === 'shadow' ? host.attachShadow({ mode: 'open' }) : host.parentNode;
        if (scope === 'shadow') {
          button.style.cssText = decoration + 'position:relative;width:100%;height:100%;';
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
        const boundary = () => {
          const r = button.getBoundingClientRect();
          const read = (points: readonly (readonly [string, number, number])[]) =>
            points.map(([label, x, y]) => {
              const hit = document.elementFromPoint(x, y);
              return {
                label,
                x,
                y,
                target: hit?.localName ?? null,
                ownedHit: hit === host || (!!hit && host.contains(hit)),
              };
            });
          return {
            rootBox: rect(button),
            sampling: 'chromium-1-css-pixel-footprint',
            samplingScope:
              'No authored expansion detected at these four 1 CSS pixel footprints; not an arbitrary subpixel guarantee.',
            staticHitAttribute: null,
            style: styleSnapshot(button),
            diagnosticHalfPixelPoints: read([
              ['left', r.x - 0.5, r.y + r.height / 2],
              ['right', r.right + 0.5, r.y + r.height / 2],
              ['top', r.x + r.width / 2, r.y - 0.5],
              ['bottom', r.x + r.width / 2, r.bottom + 0.5],
            ]),
            outsidePoints: read([
              ['left', r.x - 1, r.y + r.height / 2],
              ['right', r.right, r.y + r.height / 2],
              ['top', r.x + r.width / 2, r.y - 1],
              ['bottom', r.x + r.width / 2, r.bottom],
            ]),
          };
        };
        const baselineBoundary = boundary();
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
            style: styleSnapshot(button),
          };
          checkpoints.push(value);
          return value;
        };
        (window as any).nativeButtonProbe = {
          snapshot,
          read: () => ({ checked, events, changes, checkpoints, baselineBoundary, roundTrip }),
          mutationControl(x: number, y: number) {
            const style = document.createElement('style');
            style.textContent =
              '#native-button::after{content:"";position:absolute;inset:-6px;pointer-events:auto}';
            const styleRoot = scope === 'shadow' ? container! : document.head;
            styleRoot.appendChild(style);
            try {
              return { ...snapshot('authored-expansion-mutation', x, y), boundary: boundary() };
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
