// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser, type Locator } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  RUNTIMES,
  applyColorScheme,
  chromeExecutable,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

const route = '/zh-cn/ui-libraries/shadcn/toggle/';
/** The ordinary public demo explicitly selects the shared Rhea scope:
 * apps/www/src/content/docs/zh-cn/demo-shadcn-toggle.demo.ts wraps every subject
 * in `shadcn-style-scope` `styleProfile: 'rhea'` via `withShadcnRheaDemo`. */
const styleProfile = 'rhea';
/** MIT shadcn-ui/ui `3d98900e9b73c45f035f8109e9d41ba6a51685e7`
 * `apps/v4/registry/styles/style-rhea.css` (Git blob
 * `94bbca2a7f78845e7cfbcff68fb8f535e3848a98`): `.cn-toggle` is `gap-1
 * rounded-2xl` with `hover:text-foreground` and `aria-pressed:bg-muted`;
 * `.cn-toggle-variant-outline` is `border-input` + `hover:bg-muted` with no
 * shadow layer; size rules are `h-8/min-w-8`, `h-7/min-w-7`, `h-9/min-w-9`
 * with `px-2.5`. A byte-identical copy is retained under
 * internal/fixtures/shadcn-style-source (same Git blob and sha256). */
const upstream = '3d98900e9b73c45f035f8109e9d41ba6a51685e7';
const upstreamPath = 'apps/v4/registry/styles/style-rhea.css';
const upstreamBlob = '94bbca2a7f78845e7cfbcff68fb8f535e3848a98';
/** The retained New York compatibility recipe keeps its own pinned baseline and
 * module-test consumer; this native journey never measures it and does not
 * replace it with a fake Rhea compat. */
const compatibilityBaseline = {
  styleProfile: 'new-york-v4',
  upstream: '02cad61166c4c20edbc8a3f71bd720eed4c1f49b',
  path: 'apps/v4/registry/new-york-v4/ui/toggle.tsx',
  blob: '0291f01cff0429bbf2fb3575a15867556cc88a89',
  consumer: 'packages/prototypes/shadcn/test/toggle-new-york.test.ts',
};
/** Modeled Rhea source units, not rendered measurements: `style-rhea.css`
 * `.cn-toggle-size-default/sm/lg` are `h-8/min-w-8/px-2.5`, `h-7/min-w-7/px-2.5`
 * and `h-9/min-w-9/px-2.5`; `.cn-toggle` uses `gap-1`. */
const RHEA_REM = {
  default: { height: 2, minWidth: 2, padding: 0.625 },
  small: { height: 1.75, minWidth: 1.75, padding: 0.625 },
  large: { height: 2.25, minWidth: 2.25, padding: 0.625 },
  gap: 0.25,
} as const;
/** Pinned upstream contract: `.cn-toggle` paints `rounded-2xl`, which the
 * upstream theme resolves as `calc(var(--radius) * 1.8)` (18px at the pinned
 * 0.625rem/10px base). The current Proto generator instead emits
 * `--pui-radius-2xl: calc(var(--pui-radius) + 8px)`
 * (packages/cli/src/services/proto-style-css.ts). The two formulas agree only
 * at that default 10px base; the oracle accepts the upstream formula and
 * records the Proto formula as provenance, with no dynamic-base parity claim. */
const RHEA_RADIUS_2XL_FACTOR = 1.8;
const radiusContract = {
  upstream: 'rounded-2xl = calc(var(--radius) * 1.8)',
  proto: '--pui-radius-2xl = calc(var(--pui-radius) + 8px)',
  agreement: '18px only at the pinned 0.625rem (10px) base; dynamic parity unproven',
};
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const patch = execFileSync('git', ['diff', '--binary', 'HEAD']);
const source = {
  sourceSha,
  styleProfile,
  upstream,
  upstreamPath,
  upstreamBlob,
  compatibilityBaseline,
  radiusContract,
  dirty: patch.length > 0,
  patchSha256: createHash('sha256').update(patch).digest('hex'),
};
const output = process.env.PUI_FINF_FEATURE_EVIDENCE_DIR;
let browser: Browser;
let baseUrl: string;
beforeAll(async () => {
  if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.CANDIDATE_SHA || !output)
    throw new Error('Native evidence requires the official exact-head GitHub Actions job');
  expect(sourceSha).toBe(process.env.CANDIDATE_SHA);
  expect(source.dirty).toBe(false);
  expect(
    execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }).trim()
  ).toBe('');
  if (process.env.PROTO_UI_BROWSER_BASE_URL)
    throw new Error('Use only this job own loopback test server');
  await mkdir(output, { recursive: true });
  await writeFile(
    path.join(output, 'shadcn-toggle-source.json'),
    JSON.stringify(
      {
        ...source,
        plannedRuntimeCases: 4,
        themesPerCase: 2,
        status: 'Planned; not acceptance until Vitest completes',
      },
      null,
      2
    )
  );
  baseUrl = await startServer(route);
  browser = await chromium.launch({
    executablePath: await chromeExecutable(),
    headless: true,
    chromiumSandbox: true,
    args: ['--disable-dev-shm-usage'],
  });
  if (output) await mkdir(output, { recursive: true });
}, 150_000);
afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    await stopServer();
  }
}, 60_000);

async function observe(target: Locator) {
  return target.evaluate((element) => {
    const css = getComputedStyle(element),
      rect = element.getBoundingClientRect();
    // Color conversion only; never inserts an oracle element or component CSS.
    const ctx = new OffscreenCanvas(1, 1).getContext('2d')!;
    const rgba = (color: string) => {
      if (!CSS.supports('color', color)) throw new Error('Unresolved observed color');
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data);
    };
    return {
      height: rect.height,
      minWidth: parseFloat(css.minWidth),
      padding: parseFloat(css.paddingLeft),
      gap: parseFloat(css.columnGap),
      radius: parseFloat(css.borderTopLeftRadius),
      border: parseFloat(css.borderTopWidth),
      shadow: css.boxShadow,
      borderColor: rgba(css.borderTopColor),
      inputColor: rgba(css.getPropertyValue('--pui-input').trim()),
      radiusBase: css.getPropertyValue('--pui-radius').trim(),
      rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
      background: rgba(css.backgroundColor),
      foreground: rgba(css.color),
      foregroundToken: rgba(css.getPropertyValue('--pui-foreground').trim()),
      accent: rgba(css.getPropertyValue('--pui-accent').trim()),
      accentForeground: rgba(css.getPropertyValue('--pui-accent-foreground').trim()),
      muted: rgba(css.getPropertyValue('--pui-muted').trim()),
      mutedForeground: rgba(css.getPropertyValue('--pui-muted-foreground').trim()),
      active: element.getAttribute('aria-pressed'),
      disabled: element.getAttribute('aria-disabled'),
      opacity: parseFloat(css.opacity),
      pointerEvents: css.pointerEvents,
    };
  });
}

for (const runtime of RUNTIMES) {
  it(`Shadcn Toggle ordinary Rhea native ${runtime}: real dimensions and paint in light/dark`, async () => {
    const { context, page, previewer } = await openRoute(browser, baseUrl, route, {
      width: 1100,
      height: 900,
    });
    page.setDefaultTimeout(10_000);
    // Failure watchdog: real-browser integration needs a wall-clock deadline to
    // force-close the context if the page hangs; it awaits no condition.
    const watchdog = setTimeout(() => {
      void context.close().catch(() => {});
    }, 85_000);
    let failure: string | null = null;
    const subject = (ref: string) => previewer.locator(`.host [data-demo-ref="${ref}"]`);
    const receipt: unknown[] = [];
    const capture = async (scheme: string, state: string) => {
      if (!output) return;
      const name = `shadcn-toggle-${runtime}-${scheme}-${state}`;
      await previewer.screenshot({ path: path.join(output, `${name}.png`) });
      await writeFile(
        path.join(output, `${name}.json`),
        JSON.stringify(
          {
            ...source,
            runtime,
            scheme,
            state,
            scope: 'Real public demo under the authored Rhea scope; not packed/GPUI or complete Toggle parity',
            observations: receipt,
          },
          null,
          2
        )
      );
    };
    try {
      await selectRuntime(page, previewer, runtime, '[aria-pressed]', 6);
      for (const scheme of ['light', 'dark'] as const) {
        await applyColorScheme(page, scheme);
        await page.mouse.move(0, 0);
        for (const ref of ['default', 'small', 'large'] as const) {
          const facts = await observe(subject(ref));
          const model = RHEA_REM[ref];
          expect(Math.abs(facts.height - facts.rem * model.height)).toBeLessThanOrEqual(0.5);
          expect(Math.abs(facts.minWidth - facts.rem * model.minWidth)).toBeLessThanOrEqual(0.5);
          expect(Math.abs(facts.padding - facts.rem * model.padding)).toBeLessThanOrEqual(0.5);
          expect(Math.abs(facts.gap - facts.rem * RHEA_REM.gap)).toBeLessThanOrEqual(0.5);
          expect(facts.border).toBe(0);
          const radiusBase =
            parseFloat(facts.radiusBase) * (facts.radiusBase.endsWith('rem') ? facts.rem : 1);
          expect(Math.abs(facts.radius - radiusBase * RHEA_RADIUS_2XL_FACTOR)).toBeLessThanOrEqual(
            0.5
          );
          receipt.push({ scheme, ref, facts });
        }
        const outline = await observe(subject('outline'));
        expect(outline.border).toBe(1);
        expect(outline.borderColor).toEqual(outline.inputColor);
        // Upstream `style-rhea.css` `.cn-toggle-variant-outline` has no shadow
        // layer; the New York `shadow-xs` paint is not part of this profile.
        expect(outline.shadow).toBe('none');
        const rest = await observe(subject('default'));
        await expect
          .poll(async () => {
            const facts = await observe(subject('active-outline'));
            return JSON.stringify(facts.background) === JSON.stringify(facts.muted);
          })
          .toBe(true);
        const active = await observe(subject('active-outline'));
        expect(active.active).toBe('true');
        // Rhea presses with the muted surface only (`aria-pressed:bg-muted`);
        // the ink stays the inherited rest ink, never accent/accent-foreground.
        expect(active.background).toEqual(active.muted);
        expect(active.foreground).toEqual(rest.foreground);
        const disabled = await observe(subject('disabled-active'));
        expect(disabled.disabled).toBe('true');
        expect(disabled.active).toBe('true');
        expect(disabled.opacity).toBe(0.5);
        expect(disabled.pointerEvents).toBe('none');
        receipt.push({ scheme, outline, active, disabled });
        await capture(scheme, 'rest');
        for (const ref of ['default', 'outline'] as const) {
          const target = subject(ref);
          await target.hover();
          if (ref === 'default') {
            // Source-defined contract: `.cn-toggle` hover changes only the ink
            // (hover:text-foreground). The current Proto rule also adds a
            // bg-muted surface for every non-new-york-v4 variant — no
            // governing entity accepts the default-variant hover surface, so
            // it is recorded as a diagnostic, not asserted.
            const hoverFacts = await observe(target);
            receipt.push({
              scheme,
              ref,
              state: 'hover-background-diagnostic',
              diagnostic:
                'UNGOVERNED: current Proto hover adds bg-muted on the default variant; upstream style-rhea.css defines no hover surface there. Actual background recorded only, explicitly unaccepted.',
              facts: hoverFacts,
            });
            await expect
              .poll(async () => {
                const facts = await observe(target);
                return JSON.stringify(facts.foreground) === JSON.stringify(facts.foregroundToken);
              })
              .toBe(true);
          } else {
            // `.cn-toggle-variant-outline` is source-defined
            // `border-input hover:bg-muted` with the shared hover ink.
            await expect
              .poll(async () => {
                const facts = await observe(target);
                return (
                  JSON.stringify(facts.background) === JSON.stringify(facts.muted) &&
                  JSON.stringify(facts.foreground) === JSON.stringify(facts.foregroundToken)
                );
              })
              .toBe(true);
          }
          receipt.push({ scheme, ref, state: 'hover', facts: await observe(target) });
          if (ref === 'default') {
            receipt.push({
              scheme,
              ref,
              state: 'hover-omitted-property',
              unaccepted: 'background',
              openDisposition:
                'default-variant hover surface is ungoverned (Proto adds bg-muted; upstream defines none) — recorded, never a pass for that property',
            });
          }
          await capture(scheme, `${ref}-hover`);
          await target.click();
          await expect.poll(() => target.getAttribute('aria-pressed')).toBe('true');
          await expect
            .poll(async () => {
              const facts = await observe(target);
              return (
                JSON.stringify(facts.background) === JSON.stringify(facts.muted) &&
                JSON.stringify(facts.foreground) === JSON.stringify(facts.foregroundToken)
              );
            })
            .toBe(true);
          receipt.push({ scheme, ref, state: 'active', facts: await observe(target) });
          await capture(scheme, `${ref}-active`);
          await target.click();
          await expect.poll(() => target.getAttribute('aria-pressed')).toBe('false');
        }
      }
    } catch (error) {
      failure = String(error);
      throw error;
    } finally {
      clearTimeout(watchdog);
      try {
        await context.close();
      } finally {
        if (output)
          await writeFile(
            path.join(output, `shadcn-toggle-${runtime}-result.json`),
            JSON.stringify(
              {
                ...source,
                runtime,
                failure,
                observations: receipt,
                scope: 'Callback result only; Vitest terminal verdict remains authoritative',
              },
              null,
              2
            )
          );
      }
    }
  }, 90_000);
}
