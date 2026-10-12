// @vitest-environment node
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { launchBrowser } from '../../../../apps/www/src/content/docs/zh-cn/browser-harness';
import { collectProtoStyleTokens } from '../../../cli/src/services/prototype-style-tokens';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowSplitStyleArtifact,
  renderPrefixedThemeCss,
} from '../../../cli/src/services/proto-style-css';
import { SHADCN_THEME_CSS } from '../../../cli/src/legacy/type';
const output =
  process.env.PUI_FINF_FEATURE_EVIDENCE_DIR ?? path.join(tmpdir(), 'pui-switch-consumer-evidence');
let browser: Awaited<ReturnType<typeof launchBrowser>>, script: string, tokens: string[];
beforeAll(async () => {
  await mkdir(output, { recursive: true });
  tokens = (await collectProtoStyleTokens('packages/prototypes/shadcn/src/switch')).map((token) => {
    if (typeof token !== 'string') throw new TypeError('Expected a collected style token string');
    return token;
  });
  const built = await build({
    stdin: {
      contents: `
 export {switchRoot,switchThumb} from './packages/prototypes/shadcn/src/switch';
 export {AdaptToWebComponent as adapt} from './packages/adapters/web-component/src/adapt';
 export {setElementProps} from './packages/adapters/web-component/src/props';
 export {createCanonicalMotionPalette as palette} from './apps/www/src/components/PrototypePreviewer/canonical-motion-palette';
 `,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'SwitchConsumer',
    platform: 'browser',
    tsconfig: 'tsconfig.json',
  });
  script = built.outputFiles[0].text;
  browser = await launchBrowser();
}, 30000);
afterAll(async () => browser?.close());
describe('New York default Switch with canonical typed theme and unexpanded hit box', () => {
  for (const scope of ['document', 'shadow'] as const)
    for (const font of [16, 32])
      it(`${scope} root ${font}px records actual consumer motion and activation`, async () => {
        const page = await browser.newPage({ hasTouch: true });
        const samples: unknown[] = [];
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(String(error)));
        try {
          await page.route('**/*', (route) => route.abort());
          await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
          await page.setContent(
            '<main style="padding:80px;min-height:280px"><h1>Shadcn Switch prototype</h1><div id="mount" style="margin:60px"></div></main>'
          );
          await page.addScriptTag({ content: script });
          await page.evaluate(
            ({ scope, font, css, theme, artifact }) => {
              const p = (window as any).SwitchConsumer;
              document.documentElement.style.fontSize = font + 'px';
              document.documentElement.classList.add('light');
              const style = document.createElement('style');
              style.textContent = theme + '\n' + css;
              document.head.append(style);
              (window as any).themeSheet = style.sheet;
              const diagnostics: unknown[] = [];
              (window as any).motionDiagnostics = diagnostics;
              const options: any = {
                residentMotion: {
                  palette: p.palette,
                  diagnostics: (reasons: readonly string[]) => {
                    if (reasons.length) diagnostics.push({ now: performance.now(), reasons });
                  },
                },
              };
              if (scope === 'shadow')
                options.shadow = { mode: 'open', presentation: 'split', styleArtifact: artifact };
              const Root = p.adapt(p.switchRoot, options),
                Thumb = p.adapt(p.switchThumb, options);
              const root = new Root(),
                thumb = new Thumb();
              root.id = 'subject';
              thumb.id = 'thumb';
              root.append(thumb);
              document.querySelector('#mount')!.append(root);
              (window as any).subject = root;
              (window as any).thumb = thumb;
              (window as any).sampleSwitch = () => {
                const surface = (root.shadowRoot?.querySelector('[part="surface"]') ??
                  root) as HTMLElement;
                const thumbSurface = (thumb.shadowRoot?.querySelector('[part="surface"]') ??
                  thumb) as HTMLElement;
                const r = surface.getBoundingClientRect(),
                  t = thumbSurface.getBoundingClientRect(),
                  s = getComputedStyle(surface),
                  ts = getComputedStyle(thumbSurface);
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = 1;
                const context = canvas.getContext('2d')!;
                context.fillStyle = s.backgroundColor;
                context.fillRect(0, 0, 1, 1);
                const rgba = Array.from(context.getImageData(0, 0, 1, 1).data);
                return {
                  rgba,
                  now: performance.now(),
                  checked: root.getExposes().checked.get(),
                  root: { x: r.x, y: r.y, width: r.width, height: r.height },
                  thumb: { x: t.x, y: t.y, width: t.width, height: t.height },
                  color: s.backgroundColor,
                  translate: ts.translate,
                  transform: s.transform,
                  radius: s.borderRadius,
                  inlineColor: surface.style.getPropertyValue('background-color'),
                  tokens: surface.getAttribute('data-pui-style'),
                  diagnostics: [...diagnostics],
                };
              };
              // Diagnostic observers only: retain the native input, timing and assertions.
              // `precedingStage` names the last sample, not an inferred native action.
              const nativeEvents: unknown[] = [],
                checkpoints: unknown[] = [];
              let precedingStage = 'setup';
              let precedingCheckpointId = 0;
              let requestedInput: unknown = null;
              let nextEventId = 0;
              const eventIds = new WeakMap<Event, number>();
              const describeTarget = (target: EventTarget | null): string => {
                if (target === window) return 'window';
                if (target === document) return 'document';
                if (target instanceof ShadowRoot)
                  return '#shadow-root:' + describeTarget(target.host);
                if (target instanceof Element)
                  return (
                    target.localName +
                    (target.id ? '#' + target.id : '') +
                    (target.hasAttribute('part')
                      ? '[part=' + target.getAttribute('part') + ']'
                      : '')
                  );
                return target instanceof Node ? target.nodeName : String(target);
              };
              const rect = (element: Element) => {
                const r = element.getBoundingClientRect();
                return { x: r.x, y: r.y, width: r.width, height: r.height };
              };
              const geometry = () => ({
                rootHost: rect(root),
                rootSurface: rect(root.shadowRoot?.querySelector('[part="surface"]') ?? root),
                thumbHost: rect(thumb),
                thumbSurface: rect(thumb.shadowRoot?.querySelector('[part="surface"]') ?? thumb),
              });
              const pointHit = (x: number, y: number) => ({
                x,
                y,
                document: describeTarget(document.elementFromPoint(x, y)),
                documentStack: document.elementsFromPoint(x, y).map(describeTarget),
                rootShadow: root.shadowRoot
                  ? describeTarget(root.shadowRoot.elementFromPoint(x, y))
                  : null,
              });
              const recordNative = (event: Event) => {
                let eventId = eventIds.get(event);
                if (eventId === undefined) {
                  eventId = ++nextEventId;
                  eventIds.set(event, eventId);
                }
                const pointer = event as PointerEvent;
                const touch = event as TouchEvent;
                const changedTouches = Array.from(touch.changedTouches ?? []).map((point) => ({
                  identifier: point.identifier,
                  clientX: point.clientX,
                  clientY: point.clientY,
                  radiusX: point.radiusX,
                  radiusY: point.radiusY,
                  force: point.force,
                  target: describeTarget(point.target),
                }));
                nativeEvents.push({
                  eventId,
                  type: event.type,
                  eventPhase: event.eventPhase,
                  precedingStage,
                  precedingCheckpointId,
                  requestedInput,
                  now: performance.now(),
                  timeStamp: event.timeStamp,
                  isTrusted: event.isTrusted,
                  cancelable: event.cancelable,
                  defaultPrevented: event.defaultPrevented,
                  target: describeTarget(event.target),
                  composedPath: event.composedPath().map(describeTarget),
                  clientX: pointer.clientX,
                  clientY: pointer.clientY,
                  pointerType: pointer.pointerType,
                  pointerId: pointer.pointerId,
                  isPrimary: pointer.isPrimary,
                  width: pointer.width,
                  height: pointer.height,
                  button: pointer.button,
                  detail: pointer.detail,
                  firesTouchEvents: (event as any).sourceCapabilities?.firesTouchEvents ?? null,
                  changedTouches,
                  checked: root.getExposes().checked.get(),
                });
              };
              const eventTypes = [
                'pointerdown',
                'pointerup',
                'pointercancel',
                'touchstart',
                'touchend',
                'touchcancel',
                'mousedown',
                'mouseup',
                'click',
              ];
              for (const type of eventTypes) {
                window.addEventListener(type, recordNative, { capture: true, passive: true });
                window.addEventListener(type, recordNative, { capture: false, passive: true });
              }
              (window as any).switchInputTrace = {
                checkpoint(stage: string, input: unknown, checked: boolean) {
                  precedingStage = stage;
                  precedingCheckpointId += 1;
                  requestedInput = input;
                  const requested = input as { x?: number; y?: number } | null;
                  checkpoints.push({
                    stage,
                    checkpointId: precedingCheckpointId,
                    requestedInput,
                    checked,
                    now: performance.now(),
                    // These are pre-request facts, never dispatch-time hit-test claims.
                    snapshotTiming: requested ? 'pre-request-checkpoint' : 'after-original-sample',
                    geometry: requested ? geometry() : null,
                    pointHit:
                      requested &&
                      typeof requested.x === 'number' &&
                      typeof requested.y === 'number'
                        ? pointHit(requested.x, requested.y)
                        : null,
                    staticHitAttribute: root.getAttribute('data-pui-static-hit'),
                  });
                },
                finish() {
                  for (const type of eventTypes) {
                    window.removeEventListener(type, recordNative, true);
                    window.removeEventListener(type, recordNative, false);
                  }
                  return {
                    nativeEvents,
                    checkpoints,
                    environment: {
                      userAgent: navigator.userAgent,
                      devicePixelRatio,
                      viewport: {
                        width: innerWidth,
                        height: innerHeight,
                        scale: visualViewport?.scale ?? null,
                      },
                    },
                  };
                },
              };
            },
            {
              scope,
              font,
              css: renderProtoStyleTokenCss(tokens),
              theme: renderPrefixedThemeCss(SHADCN_THEME_CSS),
              artifact: renderProtoShadowSplitStyleArtifact(tokens),
            }
          );
          const sample = async (
            stage: string,
            requestedInput: { kind: string; x: number; y: number } | null = null
          ) => {
            const value = await page.evaluate(
              ({ stage, requestedInput }) => {
                const w = window as any;
                const value = w.sampleSwitch();
                w.switchInputTrace.checkpoint(stage, requestedInput, value.checked);
                return value;
              },
              { stage, requestedInput }
            );
            samples.push({ stage, ...value });
            return value;
          };
          await page.waitForTimeout(100);
          const initial = await sample('initial');
          expect(initial.root.width).toBeCloseTo(font * 2, 1);
          expect(initial.root.height).toBeCloseTo(font * 1.15, 1);
          expect(initial.thumb.height).toBeCloseTo(font, 1);
          expect(initial.thumb.width).toBeCloseTo(font, 1);
          expect(initial.inlineColor).toBe('');
          expect(initial.checked).toBe(false);
          await page.screenshot({
            path: path.join(output, `switch-${scope}-${font}-initial.png`),
            fullPage: true,
          });
          await page.mouse.move(initial.root.x + 16, initial.root.y + 9);
          await page.mouse.down();
          const uncheckedPressed = await sample('unchecked-hover-pressed');
          expect(uncheckedPressed.color).toBe(initial.color);
          expect(uncheckedPressed.transform).toBe(initial.transform);
          await page.mouse.move(2, 2);
          await page.mouse.up();
          await page.evaluate(() => (window as any).subject.click());
          await page.waitForTimeout(45);
          const middle = await sample('forward-midpoint');
          const travel = initial.thumb.width - 2;
          expect(middle.checked).toBe(true);
          expect(middle.thumb.x - initial.thumb.x).toBeGreaterThan(0);
          expect(middle.thumb.x - initial.thumb.x).toBeLessThan(travel);
          expect(middle.color).not.toBe(initial.color);
          expect(middle.inlineColor).not.toBe('');
          const reverse = await page.evaluate(() => {
            const before = (window as any).sampleSwitch();
            (window as any).subject.click();
            return { before, after: (window as any).sampleSwitch() };
          });
          samples.push({ stage: 'reverse', ...reverse });
          expect(Math.abs(reverse.before.thumb.x - reverse.after.thumb.x)).toBeLessThan(2);
          await page.waitForTimeout(20);
          await page.evaluate(() => (window as any).subject.click());
          await page.waitForTimeout(200);
          const end = await sample('settled');
          expect(end.thumb.x - initial.thumb.x).toBeCloseTo(travel, 1);
          expect(end.inlineColor).toBe('');
          expect(end.color).not.toBe(initial.color);
          for (let channel = 0; channel < 3; channel++) {
            expect(middle.rgba[channel]).toBeGreaterThan(
              Math.min(initial.rgba[channel], end.rgba[channel])
            );
            expect(middle.rgba[channel]).toBeLessThan(
              Math.max(initial.rgba[channel], end.rgba[channel])
            );
          }
          await page.mouse.move(initial.root.x + 16, initial.root.y + 9);
          await page.mouse.down();
          const pressed = await sample('hover-pressed');
          expect(pressed.color).toBe(end.color);
          expect(pressed.transform).toBe(end.transform);
          await page.mouse.move(2, 2);
          await page.mouse.up();
          // New York does not declare the Nova pseudo-element acquisition area.
          for (const [edge, x, y] of [
            ['left', initial.root.x - 4, initial.root.y + 9],
            ['right', initial.root.x + initial.root.width + 4, initial.root.y + 9],
            ['top', initial.root.x + 16, initial.root.y - 3],
            ['bottom', initial.root.x + 16, initial.root.y + initial.root.height + 4],
          ] as const) {
            const before = await sample('before-' + edge, { kind: 'mouse-click', x, y });
            await page.mouse.click(x, y);
            await page.waitForTimeout(190);
            expect((await sample('outside-' + edge)).checked).toBe(before.checked);
          }
          const centerBefore = await sample('before-center-pointer', {
            kind: 'mouse-click',
            x: initial.root.x + initial.root.width / 2,
            y: initial.root.y + initial.root.height / 2,
          });
          await page.mouse.click(
            initial.root.x + initial.root.width / 2,
            initial.root.y + initial.root.height / 2
          );
          await page.waitForTimeout(190);
          expect((await sample('center-pointer')).checked).toBe(!centerBefore.checked);
          const touchCenterBefore = await sample('before-center-touch', {
            kind: 'touchscreen-tap',
            x: initial.root.x + initial.root.width / 2,
            y: initial.root.y + initial.root.height / 2,
          });
          await page.touchscreen.tap(
            initial.root.x + initial.root.width / 2,
            initial.root.y + initial.root.height / 2
          );
          await page.waitForTimeout(190);
          expect((await sample('center-touch')).checked).toBe(!touchCenterBefore.checked);
          const beforeTouch = await sample('before-touch', {
            kind: 'touchscreen-tap',
            x: initial.root.x - 4,
            y: initial.root.y + 9,
          });
          await page.touchscreen.tap(initial.root.x - 4, initial.root.y + 9);
          await page.waitForTimeout(190);
          expect((await sample('touch-outside')).checked).toBe(beforeTouch.checked);
          await page.evaluate(() => {
            const w = window as any;
            w.SwitchConsumer.setElementProps(w.subject, { checked: false });
          });
          await page.waitForTimeout(190);
          const controlled = await sample('controlled-false');
          await page.mouse.click(initial.root.x + 16, initial.root.y + 9);
          await page.mouse.click(initial.root.x - 4, initial.root.y + 9);
          await page.waitForTimeout(45);
          const refused = await sample('controlled-refused');
          expect(refused.checked).toBe(false);
          expect(refused.thumb.x).toBeCloseTo(controlled.thumb.x, 2);
          expect(refused.color).toBe(controlled.color);
          await page.emulateMedia({ reducedMotion: 'reduce' });
          await page.evaluate(() => {
            const w = window as any;
            w.SwitchConsumer.setElementProps(w.subject, { checked: true });
          });
          await page.waitForTimeout(30);
          const reduced = await sample('reduced');
          expect(reduced.thumb.x - initial.thumb.x).toBeCloseTo(travel, 1);
          expect(reduced.color).toBe(end.color);
          expect(reduced.inlineColor).toBe('');
          await page.evaluate(() => {
            const w = window as any;
            w.SwitchConsumer.setElementProps(w.subject, { checked: true, disabled: true });
          });
          await page.touchscreen.tap(initial.root.x - 4, initial.root.y + 9);
          expect((await sample('disabled-outside')).checked).toBe(true);
          await page.evaluate(() => {
            const el = (window as any).subject;
            el.remove();
            setTimeout(() => document.querySelector('#mount')!.append(el), 20);
          });
          await page.waitForTimeout(90);
          const reopened = await sample('reopen');
          expect(reopened.checked).toBe(true);
          expect(reopened.thumb.x - initial.thumb.x).toBeCloseTo(travel, 1);
          expect(reopened.color).toBe(end.color);
          expect(reopened.inlineColor).toBe('');
          expect(errors).toEqual([]);
          expect(
            reopened.diagnostics
              .flatMap((record: any) => record.reasons)
              .filter((reason: string) => reason.startsWith('theme-source-mismatch:'))
          ).toEqual([]);
          await page.screenshot({
            path: path.join(output, `switch-${scope}-${font}-settled.png`),
            fullPage: true,
          });
          // Silent idle CSSOM mutation: CSS owns settled paint without a perpetual observer frame.
          await page.evaluate(() => {
            const sheet = (window as any).themeSheet as CSSStyleSheet;
            sheet.insertRule('#subject { --pui-primary: rgb(10 20 30); }', sheet.cssRules.length);
          });
          const override = await sample('idle-cssom-override');
          expect(override.color).toBe('rgb(10, 20, 30)');
          expect(override.inlineColor).toBe('');
          await page.evaluate(() => {
            const w = window as any;
            w.SwitchConsumer.setElementProps(w.subject, { checked: false });
          });
          await page.waitForTimeout(190);
          await page.evaluate(() => {
            const w = window as any;
            w.SwitchConsumer.setElementProps(w.subject, { checked: true });
          });
          await page.waitForTimeout(30);
          const mismatched = await sample('next-target-source-mismatch');
          expect(mismatched.color).toBe('rgb(10, 20, 30)');
          expect(mismatched.inlineColor).toBe('');
          expect(
            mismatched.diagnostics.some((record: any) =>
              record.reasons.includes('theme-source-mismatch:primary')
            )
          ).toBe(true);
        } finally {
          try {
            const nativeInput = await page
              .evaluate(() => (window as any).switchInputTrace?.finish() ?? null)
              .catch((error) => ({ collectionError: String(error) }));
            await Promise.all([
              writeFile(
                path.join(output, `switch-${scope}-${font}-samples.json`),
                JSON.stringify({ scope, font, samples, errors }, null, 2)
              ),
              writeFile(
                path.join(output, `switch-${scope}-${font}-native-events.json`),
                JSON.stringify(
                  { scope, font, browserVersion: browser.version(), nativeInput },
                  null,
                  2
                )
              ),
            ]);
          } finally {
            await page.close();
          }
        }
      }, 30000);
});
