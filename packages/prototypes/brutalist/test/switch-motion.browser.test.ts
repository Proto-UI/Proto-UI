// @vitest-environment node
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser } from '../../../../apps/www/src/content/docs/zh-cn/browser-harness';
import { collectProtoStyleTokens } from '../../../cli/src/services/prototype-style-tokens';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowSplitStyleArtifact,
} from '../../../cli/src/services/proto-style-css';
import { BRUTALIST_THEME_CSS } from '../../../cli/src/legacy/type';

const output =
  process.env.PUI_FINF_FEATURE_EVIDENCE_DIR ?? path.join(tmpdir(), 'pui-brutalist-switch-motion');
let browser: Awaited<ReturnType<typeof launchBrowser>>, script: string, tokens: string[];
beforeAll(async () => {
  await mkdir(output, { recursive: true });
  tokens = (await collectProtoStyleTokens('packages/prototypes/brutalist/src/switch')).map(
    (token) => {
      if (typeof token !== 'string') throw new TypeError('Expected collected token');
      return token;
    }
  );
  const result = await build({
    stdin: {
      contents: `
      export {switchRoot,switchThumb} from './packages/prototypes/brutalist/src/switch';
      export {AdaptToWebComponent as adapt} from './packages/adapters/web-component/src/adapt';
      export {setElementProps} from './packages/adapters/web-component/src/props';
    `,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'BrutalistSwitchConsumer',
    platform: 'browser',
    tsconfig: 'tsconfig.json',
  });
  script = result.outputFiles[0].text;
  browser = await launchBrowser();
}, 30000);
afterAll(async () => browser?.close());

describe.each(['document', 'shadow'] as const)('Brutalist resident Switch %s', (scope) => {
  it.each([16, 32])(
    'records real frames and native activation at %ipx root font',
    async (font) => {
      // T-BRUTALIST-SWITCH-0001-CASE-RESIDENT-BROWSER
      const page = await browser.newPage();
      const errors: string[] = [],
        evidence: Record<string, unknown> = { scope, font };
      page.on('pageerror', (error) => errors.push(String(error)));
      const name = `brutalist-switch-${scope}-${font}`;
      try {
        await page.route('**/*', (route) => route.abort());
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.setContent(
          '<main style="padding:80px"><h1>Brutalist Switch</h1><div id="mount" style="margin:40px"></div></main>'
        );
        await page.addScriptTag({ content: script });
        await page.evaluate(
          ({ scope, font, css, theme, artifact }) => {
            const p = (window as any).BrutalistSwitchConsumer;
            document.documentElement.style.fontSize = `${font}px`;
            const sheet = document.createElement('style');
            sheet.textContent = theme + '\n' + css;
            document.head.append(sheet);
            const diagnostics: unknown[] = [];
            const options: any = {
              residentMotion: {
                diagnostics: (reasons: readonly string[]) => {
                  if (reasons.length) diagnostics.push([...reasons]);
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
            root.setAttribute('aria-label', 'Notifications');
            root.append(thumb);
            document.querySelector('#mount')!.append(root);
            const surface = (el: HTMLElement) =>
              (el.shadowRoot?.querySelector('[part="surface"]') ?? el) as HTMLElement;
            const sample = () => {
              const r = surface(root),
                t = surface(thumb),
                rb = r.getBoundingClientRect(),
                tb = t.getBoundingClientRect(),
                ts = getComputedStyle(t);
              return {
                time: performance.now(),
                checked: root.getExposes().checked.get(),
                x: tb.x - rb.x,
                y: tb.y - rb.y,
                width: tb.width,
                height: tb.height,
                rootWidth: rb.width,
                rootHeight: rb.height,
                fill: ts.backgroundColor,
                translate: ts.translate,
                transform: ts.transform,
                transition: ts.transitionProperty,
                inlineTranslate: t.style.getPropertyValue('translate'),
                tokens: t.getAttribute('data-pui-style'),
                diagnostics: [...diagnostics],
              };
            };
            (window as any).switchSubject = { root, thumb, sample, surface, p };
            (window as any).trace = async (duration: number) => {
              const start = performance.now(),
                samples = [sample()];
              do {
                await new Promise(requestAnimationFrame);
                samples.push(sample());
              } while (performance.now() - start < duration);
              return samples;
            };
          },
          {
            scope,
            font,
            css: renderProtoStyleTokenCss(tokens),
            theme: BRUTALIST_THEME_CSS,
            artifact: renderProtoShadowSplitStyleArtifact(tokens),
          }
        );
        await page.waitForTimeout(100);
        const initial = await page.evaluate(() => (window as any).switchSubject.sample());
        evidence.initial = initial;
        expect(initial.checked).toBe(false);
        expect(initial.width).toBeCloseTo(font, 1);
        expect(initial.rootWidth).toBeCloseTo(font * 3, 1);
        expect(initial.rootHeight).toBeCloseTo(font * 1.5, 1);
        await page.evaluate(() => {
          (window as any).pendingTrace = (window as any).trace(350);
        });
        await page.locator('#subject').click();
        const forward = (await page.evaluate(
          () => (window as any).pendingTrace
        )) as (typeof initial)[];
        evidence.nativeForward = forward;
        const settled = forward.at(-1)!;
        expect(settled.checked).toBe(true);
        expect(settled.x - initial.x).toBeCloseTo(font * 1.25, 1);
        expect(forward.some((s) => s.x > initial.x + 0.1 && s.x < settled.x - 0.1)).toBe(true);
        for (const s of forward) {
          expect(s.y).toBeCloseTo(initial.y, 1);
          expect(s.width).toBeCloseTo(font, 1);
          expect(s.fill).toBe('rgb(255, 255, 255)');
          expect(s.tokens).not.toMatch(/transition-|duration-|translate-[xy]-/);
          expect(s.transform === 'none' || s.transform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true);
        }
        await page.screenshot({ path: path.join(output, `${name}-checked.png`) });
        // Reversal uses programmatic activation deliberately, with real rAF paint samples.
        // It does not impersonate native input evidence above.
        const reversal = await page.evaluate(async () => {
          const w = window as any,
            { root, sample } = w.switchSubject;
          root.click();
          const samples = await w.trace(45),
            before = sample();
          root.click();
          await Promise.resolve();
          await Promise.resolve();
          const after = sample(),
            tail = await w.trace(200);
          return { samples, before, after, tail };
        });
        evidence.programmaticReversal = reversal;
        expect(reversal.after.x).toBeCloseTo(reversal.before.x, 2);
        expect(reversal.tail.at(-1).x).toBeCloseTo(settled.x, 1);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.locator('#subject').click();
        const reduced = await page.evaluate(() => (window as any).switchSubject.sample());
        evidence.reduced = reduced;
        expect(reduced.checked).toBe(false);
        expect(reduced.x).toBeCloseTo(initial.x, 1);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        const restored = await page.evaluate(() => (window as any).trace(200));
        evidence.restored = restored;
        expect(restored.every((s: typeof initial) => Math.abs(s.x - initial.x) < 0.1)).toBe(true);
        await page.screenshot({ path: path.join(output, `${name}-unchecked.png`) });
        expect(errors).toEqual([]);
      } finally {
        evidence.errors = errors;
        await writeFile(path.join(output, `${name}.json`), JSON.stringify(evidence, null, 2));
        await page.close();
      }
    },
    30000
  );
});
