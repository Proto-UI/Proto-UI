// @vitest-environment node
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { launchBrowser } from '../../../../apps/www/src/content/docs/zh-cn/browser-harness';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowSplitStyleArtifact,
} from '../../../cli/src/services/proto-style-css';
const output =
  process.env.PUI_FINF_FEATURE_EVIDENCE_DIR ?? path.join(tmpdir(), 'pui-resident-motion-evidence');
import { RESIDENT_FIXTURE_TOKENS as tokens } from './fixtures/resident-motion';

let browser: Awaited<ReturnType<typeof launchBrowser>>, script: string;
beforeAll(async () => {
  await mkdir(output, { recursive: true });
  const result = await build({
    stdin: {
      contents: `
  export {createResidentMotionFixture} from './packages/adapters/base/test/fixtures/resident-motion';
  export {AdaptToWebComponent as adapt} from './packages/adapters/web-component/src/adapt';
  export {setElementProps,getElementProps} from './packages/adapters/web-component/src/props';
 `,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'ResidentFixture',
    platform: 'browser',
    tsconfig: 'tsconfig.json',
  });
  script = result.outputFiles[0].text;
  browser = await launchBrowser();
}, 30000);
afterAll(async () => {
  await browser?.close();
});
describe('resident motion own-source physical browser fixture', () => {
  it.each(['document', 'shadow'] as const)(
    '%s records RAF coordinate/color, reversal, reduced and reopen',
    async (scope) => {
      const page = await browser.newPage();
      const samples: unknown[] = [];
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(String(error)));
      try {
        await page.route('**/*', (route) => route.abort());
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.setContent(
          '<main style="padding:48px;width:400px;height:220px;background:#ddd"><h1>Resident motion</h1></main>'
        );
        await page.addScriptTag({ content: script });
        await page.evaluate(
          ({ scope, css, artifact }) => {
            const p = (window as any).ResidentFixture;
            // Single fixture color fact source feeds both ordinary CSS and the typed palette.
            const colors = { input: [0, 0, 0, 1], primary: [1, 1, 1, 1] };
            const sheet = document.createElement('style');
            sheet.textContent = css;
            document.head.append(sheet);
            const proto = p.createResidentMotionFixture('resident-owned-fixture');
            (window as any).residentDiagnostics = [];
            const options: any = {
              residentMotion: {
                diagnostics: (reasons: readonly string[]) =>
                  (window as any).residentDiagnostics.push({
                    now: performance.now(),
                    reasons: [...reasons],
                  }),
                palette: { current: () => ({ revision: 1, colors }), subscribe: () => () => {} },
              },
            };
            if (scope === 'shadow')
              options.shadow = { mode: 'open', presentation: 'split', styleArtifact: artifact };
            p.adapt(proto, options);
            const el = document.createElement('resident-owned-fixture');
            el.id = 'subject';
            for (const [role, c] of Object.entries(colors))
              el.style.setProperty(
                '--pui-' + role,
                `rgba(${c[0] * 255},${c[1] * 255},${c[2] * 255},${c[3]})`
              );
            document.querySelector('main')!.append(el);
            (window as any).subject = el;
          },
          {
            scope,
            css: renderProtoStyleTokenCss(tokens),
            artifact: renderProtoShadowSplitStyleArtifact(tokens),
          }
        );
        const sample = () =>
          page.evaluate(() => {
            const el = (window as any).subject as HTMLElement;
            const surface = (el.shadowRoot?.querySelector('[part="surface"]') ?? el) as HTMLElement;
            const css = getComputedStyle(surface),
              box = surface.getBoundingClientRect();
            return {
              now: performance.now(),
              x: box.x,
              width: box.width,
              translate: css.translate,
              color: css.backgroundColor,
              inline: surface.style.getPropertyValue('translate'),
              hostInline: el.style.getPropertyValue('translate'),
              visualIsHost: surface === el,
              raw: (window as any).ResidentFixture.getElementProps(el) ?? {},
              resolved: (el as any).getExposes().readResolved(),
              hostTokens: el.getAttribute('data-pui-style'),
              boundaryTokens: el.getAttribute('data-pui-split-root-style'),
              surfaceTokens: surface.getAttribute('data-pui-style'),
              rootFont: getComputedStyle(document.documentElement).fontSize,
              reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
              diagnostics: [...(window as any).residentDiagnostics],
            };
          });
        const target = (active: boolean) =>
          page.evaluate((active) => {
            const issuedAt = performance.now();
            (window as any).ResidentFixture.setElementProps((window as any).subject, { active });
            return { issuedAt, active };
          }, active);
        await page.waitForTimeout(120);
        const initial = await sample();
        samples.push({ stage: 'initial', ...initial });
        await page.screenshot({
          path: path.join(output, `resident-${scope}-initial.png`),
          fullPage: true,
        });
        samples.push({ stage: 'target-issued', ...(await target(true)) });
        await page.waitForTimeout(120);
        const middle = await sample();
        samples.push({ stage: 'forward-midpoint', ...middle });
        expect(middle.raw).toEqual({ active: true });
        expect(middle.resolved).toEqual({ active: true });
        expect(middle.surfaceTokens).toContain('bg-primary');
        if (scope === 'shadow') expect(middle.hostInline).toBe('');
        expect(middle.x - initial.x).toBeGreaterThan(0);
        expect(middle.x - initial.x).toBeLessThan(14);
        expect(middle.color).not.toBe(initial.color);
        await target(false);
        const reversed = await sample();
        samples.push({ stage: 'reverse-start', ...reversed });
        expect(Math.abs(reversed.x - middle.x)).toBeLessThan(2);
        await page.waitForTimeout(30);
        await target(true);
        const again = await sample();
        samples.push({ stage: 'second-reversal', ...again });
        await page.waitForTimeout(460);
        const end = await sample();
        samples.push({ stage: 'settled', ...end });
        expect(end.x - initial.x).toBeCloseTo(14, 1);
        expect(end.color).toBe('rgb(255, 255, 255)');
        await page.screenshot({
          path: path.join(output, `resident-${scope}-settled.png`),
          fullPage: true,
        });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForTimeout(30);
        await target(false);
        await page.waitForTimeout(30);
        const reduced = await sample();
        samples.push({ stage: 'reduced', ...reduced });
        expect(reduced.x).toBeCloseTo(initial.x, 1);
        expect(reduced.color).toBe('rgb(0, 0, 0)');
        await page.evaluate(() => {
          (window as any).subject.hidden = true;
        });
        await target(true);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.waitForTimeout(40);
        await page.evaluate(() => {
          (window as any).subject.hidden = false;
        });
        await page.waitForTimeout(30);
        const revealed = await sample();
        samples.push({ stage: 'reveal-settled', ...revealed });
        expect(revealed.x - initial.x).toBeCloseTo(14, 1);
        expect(revealed.color).toBe('rgb(255, 255, 255)');
        await page.evaluate(() => {
          const el = (window as any).subject;
          el.remove();
          setTimeout(() => document.querySelector('main')!.append(el), 20);
        });
        await page.waitForTimeout(100);
        const reopened = await sample();
        samples.push({ stage: 'reopen', ...reopened });
        expect(reopened.x - initial.x).toBeCloseTo(14, 1);
        expect(reopened.color).toBe('rgb(255, 255, 255)');
      } finally {
        await writeFile(
          path.join(output, `resident-${scope}-samples.json`),
          JSON.stringify({ scope, samples, pageErrors }, null, 2)
        );
        await page.close();
      }
    },
    30000
  );
});
