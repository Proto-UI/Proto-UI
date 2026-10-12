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
  tokens = await collectProtoStyleTokens('packages/prototypes/shadcn/src/switch');
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
describe('actual Shadcn prototype with canonical typed theme and static hit inset', () => {
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
            },
            {
              scope,
              font,
              css: renderProtoStyleTokenCss(tokens),
              theme: renderPrefixedThemeCss(SHADCN_THEME_CSS),
              artifact: renderProtoShadowSplitStyleArtifact(tokens),
            }
          );
          const sample = async (stage: string) => {
            const value = await page.evaluate(() => (window as any).sampleSwitch());
            samples.push({ stage, ...value });
            return value;
          };
          await page.waitForTimeout(100);
          const initial = await sample('initial');
          expect(initial.root.width).toBeCloseTo(32, 1);
          expect(initial.root.height).toBeCloseTo(18.4, 1);
          expect(initial.thumb.height).toBeCloseTo(font, 1);
          expect(initial.thumb.width).toBeCloseTo(font === 16 ? 16 : 30, 1);
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
          // Every inset edge remains the same semantic switch, including native touch.
          for (const [edge, x, y] of [
            ['left', initial.root.x - 4, initial.root.y + 9],
            ['right', initial.root.x + 36, initial.root.y + 9],
            ['top', initial.root.x + 16, initial.root.y - 3],
            ['bottom', initial.root.x + 16, initial.root.y + 22],
          ] as const) {
            const before = await sample('before-' + edge);
            await page.mouse.click(x, y);
            await page.waitForTimeout(190);
            expect((await sample('hit-' + edge)).checked).toBe(!before.checked);
          }
          const beforeTouch = await sample('before-touch');
          await page.touchscreen.tap(initial.root.x - 4, initial.root.y + 9);
          await page.waitForTimeout(190);
          expect((await sample('touch-expanded')).checked).toBe(!beforeTouch.checked);
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
          expect((await sample('disabled-expanded')).checked).toBe(true);
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
          await writeFile(
            path.join(output, `switch-${scope}-${font}-samples.json`),
            JSON.stringify({ scope, font, samples, errors }, null, 2)
          );
          await page.close();
        }
      }, 30000);
});
