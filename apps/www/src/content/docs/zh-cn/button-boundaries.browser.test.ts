// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  COLOR_SCHEMES,
  RUNTIMES,
  applyColorScheme,
  launchBrowser,
  startServer,
  stopServer,
} from './browser-harness';
import { copySourceBindingIssues, type CopySourceBinding } from './copy-command-evidence';

// P-SHADCN-BUTTON-NEW-YORK-PAINT / ICON-COMPACT / WRAP-PROP.
// Independent fixed 02cad611 oracle; do not derive expected sizes/paint from Prototype tables.
const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const;
type Variant = (typeof variants)[number];
type Scheme = (typeof COLOR_SCHEMES)[number];
const sizes = [
  { name: 'default', height: 36, gap: 8 },
  { name: 'sm', height: 32, gap: 6 },
  { name: 'lg', height: 40, gap: 8 },
  { name: 'icon', height: 36, gap: 8 },
  { name: 'icon-compact', height: 28, gap: 8 },
] as const;
let directory: string;
let browser: Browser;
let baseUrl: string;
let source: CopySourceBinding;

beforeAll(async () => {
  directory = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
    ? join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, 'new-york')
    : await mkdtemp(join(tmpdir(), 'pui-b1160-'));
  await mkdir(directory, { recursive: true });
  console.info('[button-boundary-evidence] ' + directory);
  source = {
    exactSHA: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
    expectedSHA: process.env.CANDIDATE_SHA ?? process.env.PROTO_UI_EXPECTED_REVISION ?? null,
    eventSHA: process.env.GITHUB_SHA ?? null,
  };
  expect(copySourceBindingIssues(source, Boolean(process.env.CI))).toEqual([]);
  const sourceHashes: Record<string, string> = {};
  for (const file of [
    'packages/prototypes/base/src/button/button.proto.ts',
    'packages/prototypes/shadcn/src/button/button.proto.ts',
    'packages/prototypes/shadcn/src/button/new-york.ts',
    'packages/prototypes/shadcn/src/button/profiles.ts',
    'packages/prototypes/shadcn/src/button/paint.ts',
    'packages/prototypes/shadcn/src/button/types.ts',
    'packages/cli/src/generated/shadcn-style-tokens.ts',
    'apps/www/src/content/docs/zh-cn/button-boundary-fixture.ts',
    'apps/www/src/content/docs/zh-cn/button-boundaries.browser.test.ts',
    'apps/www/src/pages/en/test/button-boundaries/[runtime].astro',
    'apps/www/src/components/PrototypePreviewer/demo-renderer.ts',
    'apps/www/src/components/PrototypePreviewer/prototype-modules.ts',
    'apps/www/src/components/override/ThemeProvider.astro',
    'apps/www/src/styles/global.css',
    'apps/www/src/content/docs/zh-cn/browser-harness.ts',
    'apps/www/src/content/docs/zh-cn/copy-command-evidence.ts',
  ]) {
    sourceHashes[file] = createHash('sha256').update(await readFile(file)).digest('hex');
  }
  await writeFile(join(directory, 'source.json'), JSON.stringify({
    source,
    sourceHashes,
    bindingScope: 'Named critical inputs, not a complete repository source-membership proof',
    upstream: 'shadcn-ui/ui@02cad61166c4c20edbc8a3f71bd720eed4c1f49b',
    expectedCases: RUNTIMES.length * COLOR_SCHEMES.length * 2,
    result: 'not-run; individual terminal receipts report actual execution',
    limits: 'Direct New York Button browser evidence only; passive Form hover, public Header, other profiles/families, packed consumers and OS AT remain separate.',
  }, null, 2));
  baseUrl = await startServer('/en/test/button-boundaries/wc/');
  expect(['127.0.0.1', 'localhost', '[::1]']).toContain(new URL(baseUrl).hostname);
  const generatedCssHashes: Record<string, string> = {};
  for (const file of ['shadcn-theme.css', 'proto-ui-tokens.generated.css', 'proto-ui-style.css']) {
    generatedCssHashes[file] = createHash('sha256')
      .update(await readFile(`apps/www/src/styles/${file}`)).digest('hex');
  }
  await writeFile(join(directory, 'generated-css.json'), JSON.stringify({
    source,
    generatedCssHashes,
    provenance: 'Normal documentation-server generation; no fixture stylesheet supplies Button paint or geometry',
  }, null, 2));
  browser = await launchBrowser();
}, 300_000);

afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    await stopServer();
  }
}, 60_000);

function expectedPaint(variant: Variant, scheme: Scheme, hover: boolean) {
  const dark = scheme === 'dark';
  switch (variant) {
    case 'default':
      return {
        background: hover
          ? 'color-mix(in oklab, var(--pui-primary) 90%, transparent)'
          : 'var(--pui-primary)',
        foreground: 'var(--pui-primary-foreground)',
      };
    case 'destructive':
      return {
        background: dark
          ? 'color-mix(in oklab, var(--pui-destructive) 60%, transparent)'
          : hover
            ? 'color-mix(in oklab, var(--pui-destructive) 90%, transparent)'
            : 'var(--pui-destructive)',
        foreground: 'white',
      };
    case 'outline':
      return {
        background: dark
          ? `color-mix(in oklab, var(--pui-input) ${hover ? 50 : 30}%, transparent)`
          : hover
            ? 'var(--pui-accent)'
            : 'var(--pui-background)',
        foreground: hover ? 'var(--pui-accent-foreground)' : 'var(--pui-foreground)',
      };
    case 'secondary':
      return {
        background: hover
          ? 'color-mix(in oklab, var(--pui-secondary) 80%, transparent)'
          : 'var(--pui-secondary)',
        foreground: 'var(--pui-secondary-foreground)',
      };
    case 'ghost':
      return {
        background: hover
          ? dark
            ? 'color-mix(in oklab, var(--pui-accent) 50%, transparent)'
            : 'var(--pui-accent)'
          : 'transparent',
        foreground: hover ? 'var(--pui-accent-foreground)' : 'var(--pui-foreground)',
      };
    case 'link':
      return { background: 'transparent', foreground: 'var(--pui-primary)' };
  }
}

async function metrics(control: Locator, paint = expectedPaint('default', 'light', false)) {
  return control.evaluate((element, paint) => {
    const css = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    // Resolve the contract's palette expressions without writing any style to the Button.
    const probe = document.createElement('span');
    probe.hidden = true;
    probe.style.backgroundColor = paint.background;
    probe.style.color = paint.foreground;
    for (const role of ['primary', 'primary-foreground', 'destructive', 'input', 'accent', 'accent-foreground', 'background', 'foreground', 'secondary', 'secondary-foreground']) {
      probe.style.setProperty(`--pui-${role}`, css.getPropertyValue(`--pui-${role}`));
    }
    document.body.append(probe);
    const canvas = new OffscreenCanvas(1, 1);
    const context = canvas.getContext('2d')!;
    const rgba = (color: string) => {
      if (!CSS.supports('color', color)) throw new Error(`Unresolved observed color: ${color}`);
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    };
    try {
      const expected = getComputedStyle(probe);
      return {
        width: rect.width,
        height: rect.height,
        fontSize: parseFloat(css.fontSize),
        lineHeight: parseFloat(css.lineHeight),
        gap: parseFloat(css.gap),
        paddingLeft: parseFloat(css.paddingLeft),
        paddingRight: parseFloat(css.paddingRight),
        whiteSpace: css.whiteSpace,
        transform: css.transform,
        translate: css.translate,
        textDecoration: css.textDecorationLine,
        boxShadow: css.boxShadow,
        background: rgba(css.backgroundColor),
        foreground: rgba(css.color),
        expectedBackground: rgba(expected.backgroundColor),
        expectedForeground: rgba(expected.color),
        opacity: css.opacity,
        pointerEvents: css.pointerEvents,
        role: element.getAttribute('role'),
        disabled: element.getAttribute('aria-disabled'),
        focused: element === document.activeElement,
        focusVisible: element.hasAttribute('data-focus-visible'),
        pressed: element.hasAttribute('data-pressed'),
        tokens: element.getAttribute('data-pui-style'),
      };
    } finally {
      probe.remove();
    }
  }, paint);
}

async function assertPaint(control: Locator, variant: Variant, scheme: Scheme, hover: boolean) {
  const paint = expectedPaint(variant, scheme, hover);
  await expect.poll(async () => {
    const observed = await metrics(control, paint);
    return {
      backgroundMatches: JSON.stringify(observed.background) === JSON.stringify(observed.expectedBackground),
      foregroundMatches: JSON.stringify(observed.foreground) === JSON.stringify(observed.expectedForeground),
      underline: observed.textDecoration.includes('underline'),
    };
  }, { timeout: 2_000 }).toEqual({
    backgroundMatches: true,
    foregroundMatches: true,
    underline: variant === 'link' && hover,
  });
  return metrics(control, paint);
}

async function counts(page: Page): Promise<Record<string, number>> {
  return JSON.parse(await page.locator('[data-demo-ref="counts"]').innerText());
}

describe.sequential('direct New York Button consumer boundaries', () => {
  for (const runtime of RUNTIMES) for (const scheme of COLOR_SCHEMES) for (const scale of [1, 2]) {
    it(`${runtime}/${scheme}/${scale * 100}% text`, async () => {
      const id = `${runtime}-${scheme}-${scale * 100}`;
      const context = await browser.newContext({ viewport: { width: 960, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors: string[] = [];
      const observations: Record<string, unknown> = {};
      const screenshots: string[] = [];
      let result = 'failed';
      let failure: string | undefined;
      page.on('pageerror', (error) => errors.push(error.message));
      const capture = async (name: string, control?: Locator) => {
        const file = `${id}-${name}.png`;
        if (control) await control.screenshot({ path: join(directory, file) });
        else await page.screenshot({ path: join(directory, file), fullPage: true });
        screenshots.push(file);
      };
      try {
        const response = await page.goto(`${baseUrl}/en/test/button-boundaries/${runtime}/`, { waitUntil: 'domcontentloaded' });
        expect(response?.status()).toBe(200);
        await applyColorScheme(page, scheme);
        await page.evaluate((size) => { document.documentElement.style.fontSize = `${size}px`; }, scale * 16);
        await page.waitForFunction(() => {
          const state = document.querySelector<HTMLElement>('[data-button-boundary-host]')?.dataset.mountState;
          return state === 'ready' || state === 'error';
        }, undefined, { timeout: 20_000 });
        expect(await page.locator('[data-button-boundary-host]').getAttribute('data-mount-state')).toBe('ready');
        expect(await page.locator('[data-button-boundary-error]').textContent()).toBe('');
        const host = page.locator('[data-button-boundary-host]');
        await expect.poll(() => host.locator('[data-pui-root][role="button"]').count()).toBe(14);
        const framework = await host.locator('[data-pui-root]').first().evaluate((root) => root.tagName.startsWith('WC-') ? 'wc' : (root as HTMLElement & { __vue__?: unknown }).__vue__ ? 'vue2' : root.closest('[data-v-app]') ? 'vue' : Object.keys(root).some((key) => key.startsWith('__reactFiber$')) ? 'react' : null);
        expect(framework).toBe(runtime);
        observations.framework = framework;
        observations.rootFontSize = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
        expect(observations.rootFontSize).toBe(`${scale * 16}px`);
        await expect.poll(async () =>
          (await metrics(host.locator('[data-demo-ref="variant-default"]'))).height
        ).toBe(36 * scale);
        await capture('rest');
        const variantObservations: Record<string, unknown> = {};
        observations.variants = variantObservations;
        for (const variant of variants) {
          const control = host.locator(`[data-demo-ref="variant-${variant}"]`);
          await control.scrollIntoViewIfNeeded();
          await page.mouse.move(0, 0);
          const rest = await assertPaint(control, variant, scheme, false);
          expect(rest.height).toBe(36 * scale);
          expect(rest.fontSize).toBe(14 * scale);
          expect(rest.lineHeight).toBe(20 * scale);
          expect(rest.role).toBe('button');
          await control.hover();
          const hover = await assertPaint(control, variant, scheme, true);
          await capture(`${variant}-hover`, control);
          await page.mouse.down();
          await expect.poll(async () => (await metrics(control)).pressed).toBe(true);
          expect((await metrics(control)).transform).toBe('none');
          expect((await metrics(control)).translate).toBe('none');
          if (variant === 'default') await capture('pressed', control);
          await page.mouse.up();
          await expect.poll(async () => (await counts(page))[`variant-${variant}`]).toBe(1);
          await control.press('Enter');
          await expect.poll(async () => (await counts(page))[`variant-${variant}`]).toBe(2);
          await control.press('Space');
          await expect.poll(async () => (await counts(page))[`variant-${variant}`]).toBe(3);
          await expect.poll(async () => (await metrics(control)).focusVisible).toBe(true);
          await expect.poll(async () => (await metrics(control)).boxShadow, { timeout: 2_000 })
            .toMatch(/0px 0px 0px 3px/);
          const focus = await metrics(control);
          if (variant === 'default') await capture('keyboard-focus');
          variantObservations[variant] = { rest, hover, focus, acceptedActivations: 3 };
        }
        const sizeObservations: Record<string, unknown> = {};
        observations.sizes = sizeObservations;
        for (const size of sizes) {
          const control = host.locator(`[data-demo-ref="size-${size.name}"]`);
          const observed = await metrics(control);
          expect(observed.height).toBe(size.height * scale);
          expect(observed.gap).toBe(size.gap * scale);
          if (size.name === 'icon' || size.name === 'icon-compact') {
            expect(observed.width).toBe(size.height * scale);
            expect(observed.whiteSpace).toBe('nowrap');
          }
          sizeObservations[size.name] = observed;
        }
        const disabled = host.locator('[data-demo-ref="disabled"]');
        await disabled.scrollIntoViewIfNeeded();
        const disabledFacts = await metrics(disabled);
        expect(disabledFacts.disabled).toBe('true');
        expect(disabledFacts.pointerEvents).toBe('none');
        expect(disabledFacts.opacity).toBe('0.5');
        const bounds = await disabled.boundingBox();
        expect(bounds).not.toBeNull();
        await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
        expect((await counts(page)).disabled).toBe(0);
        await host.locator('[data-demo-ref="size-icon-compact"]').focus();
        await page.keyboard.press('Tab');
        const wrapped = host.locator('[data-demo-ref="wrapped"]');
        await expect.poll(() => wrapped.evaluate((element) => element === document.activeElement)).toBe(true);
        observations.disabled = { ...disabledFacts, outwardActivations: (await counts(page)).disabled, skippedByTab: true };

        const changing = host.locator('[data-demo-ref="changing"]');
        const identity = await changing.elementHandle();
        expect(identity).not.toBeNull();
        const replacement: unknown[] = [];
        for (const size of sizes) {
          await page.locator('[data-button-boundary-size]').selectOption(size.name);
          await page.locator('[data-button-boundary-wrap-input]').check();
          const icon = size.name === 'icon' || size.name === 'icon-compact';
          await expect.poll(async () => {
            const observed = await metrics(changing);
            return {
              height: observed.height,
              gap: observed.gap,
              whiteSpace: observed.whiteSpace,
              fixedIcon: !icon || observed.width === size.height * scale,
            };
          }).toEqual({
            height: size.height * scale,
            gap: size.gap * scale,
            whiteSpace: icon ? 'nowrap' : 'normal',
            fixedIcon: true,
          });
          expect(await changing.evaluate((element, original) => element === original, identity)).toBe(true);
          replacement.push(await metrics(changing));
        }
        await page.locator('[data-button-boundary-disabled]').check();
        await expect.poll(async () => (await metrics(changing)).disabled).toBe('true');
        await page.locator('[data-button-boundary-reset]').click();
        await expect.poll(async () => {
          const observed = await metrics(changing);
          return { height: observed.height, gap: observed.gap, disabled: observed.disabled, whiteSpace: observed.whiteSpace };
        }).toEqual({ height: 36 * scale, gap: 8 * scale, disabled: 'false', whiteSpace: 'nowrap' });
        expect(await changing.evaluate((element, original) => element === original, identity)).toBe(true);
        await changing.click();
        await expect.poll(async () => (await counts(page)).changing).toBe(1);
        await identity?.dispose();
        observations.propReplacement = replacement;
        await page.setViewportSize({ width: 320, height: 900 });
        await wrapped.scrollIntoViewIfNeeded();
        const wrapFacts = await wrapped.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const parent = element.parentElement!.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(element);
          return { height: rect.height, textHeight: range.getBoundingClientRect().height, left: rect.left, right: rect.right, parentLeft: parent.left, parentRight: parent.right, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth };
        });
        expect(wrapFacts.height).toBeGreaterThan(36 * scale);
        expect(wrapFacts.textHeight).toBeGreaterThan(20 * scale);
        expect(wrapFacts.left).toBeGreaterThanOrEqual(wrapFacts.parentLeft);
        expect(wrapFacts.right).toBeLessThanOrEqual(wrapFacts.parentRight);
        expect(wrapFacts.scrollWidth).toBeLessThanOrEqual(wrapFacts.clientWidth);
        await wrapped.click();
        await expect.poll(async () => (await counts(page)).wrapped).toBe(1);
        observations.narrowWrap = wrapFacts;
        observations.finalCounts = await counts(page);
        await capture('320px-wrapped');
        expect(errors).toEqual([]);
        result = 'passed';
      } catch (error) {
        failure = String(error);
        try { await capture('failure'); } catch (captureError) { observations.captureError = String(captureError); }
        throw error;
      } finally {
        try {
          await writeFile(join(directory, `${id}.json`), JSON.stringify({ source, runtime, scheme, scale, browser: browser.version(), result, failure, errors, observations, screenshots, limits: 'No OS AT, passive Form, packed consumer, other profile/family or public Header acceptance.' }, null, 2));
        } finally {
          await context.close();
        }
      }
    }, 120_000);
  }
});
