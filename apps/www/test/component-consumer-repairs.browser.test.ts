// @vitest-environment node
import { build } from 'esbuild';
import { globSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { chromium, type Browser, type Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromeExecutable } from '../src/content/docs/zh-cn/browser-harness';
import { collectProtoStyleTokensFromFiles } from '../../../packages/cli/src/services/prototype-style-tokens';
import { renderProtoStyleTokenCss } from '../../../packages/cli/src/services/proto-style-css';
import type { mount } from './fixtures/component-consumer-repairs';

declare global {
  interface Window {
    componentRepairs: { mount: typeof mount };
    repairFixture: Awaited<ReturnType<typeof mount>>;
  }
}
let browser: Browser, bundle: string, css: string;
const output = path.join(
  process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ?? tmpdir(),
  'component-consumer-repairs'
);
const cases = (['base', 'shadcn', 'brutalist'] as const).flatMap((family) =>
  (['react', 'wc'] as const).map((runtime) => ({ family, runtime }))
);
beforeAll(async () => {
  const sourceFiles = [
    ...globSync(
      'packages/prototypes/{base,shadcn,brutalist}/src/{button,toggle,toggle-group,label,tooltip,drawer}/**/*.ts'
    ),
  ];
  const tokens = (await collectProtoStyleTokensFromFiles(sourceFiles)).filter(
    (token): token is string => typeof token === 'string'
  );
  css = renderProtoStyleTokenCss(tokens);
  bundle = (
    await build({
      entryPoints: ['apps/www/test/fixtures/component-consumer-repairs.ts'],
      bundle: true,
      write: false,
      platform: 'browser',
      format: 'iife',
      globalName: 'componentRepairs',
      target: 'es2022',
      define: { 'process.env.NODE_ENV': '"development"' },
    })
  ).outputFiles[0].text;
  await mkdir(output, { recursive: true });
  const files = [
    ...sourceFiles,
    'apps/www/test/fixtures/component-consumer-repairs.ts',
    'packages/adapters/react/src/adapt.ts',
  ];
  await writeFile(
    path.join(output, 'source.json'),
    JSON.stringify(
      {
        source: Object.fromEntries(
          files.map((file) => [file, createHash('sha256').update(readFileSync(file)).digest('hex')])
        ),
        bundleSha256: createHash('sha256').update(bundle).digest('hex'),
        scope:
          'Actual source prototypes in React and WC; no OS assistive-technology certification.',
      },
      null,
      2
    )
  );
  // Keep Chromium's sandbox enabled. Environment restrictions remain failures.
  browser = await chromium.launch({
    executablePath: await chromeExecutable(),
    headless: true,
    chromiumSandbox: true,
  });
}, 60_000);
afterAll(async () => {
  await browser?.close();
});

async function fixture(
  scenario: Parameters<typeof mount>[0],
  family: Parameters<typeof mount>[1],
  runtime: Parameters<typeof mount>[2]
) {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 800 },
    reducedMotion: 'reduce',
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) => route.abort());
  await page.setContent('<!doctype html><html><head></head><body></body></html>');
  await page.addStyleTag({
    content:
      css +
      '\nhtml{font-size:16px}body{margin:0;font:16px system-ui} [data-demo-ref="button"],[data-demo-ref="toggle"],[data-demo-ref="item"]{display:inline-flex;padding:12px;margin:8px} [data-demo-ref$="-label"]{display:inline-block;margin:8px} [data-demo-ref="content"]{background:white;color:black} [data-demo-ref="handle"]{display:block;min-width:20px;min-height:40px}',
  });
  await page.addScriptTag({ content: bundle });
  await page.evaluate(
    async ({ scenario, family, runtime }) => {
      window.repairFixture = await window.componentRepairs.mount(scenario, family, runtime);
    },
    { scenario, family, runtime }
  );
  expect(errors).toEqual([]);
  return { page, errors };
}
const node = (page: Page, key: string) => page.locator(`[data-demo-ref="${key}"]`);
const active = (page: Page) =>
  page.evaluate(() => document.activeElement?.getAttribute('data-demo-ref'));

it.each(cases)(
  '$family $runtime names icon controls and preserves command/selection ownership',
  async ({ family, runtime }) => {
    const { page, errors } = await fixture('labels', family, runtime);
    try {
      for (const [key, name] of [
        ['button', 'Save document'],
        ['toggle', 'Pin document'],
        ['item', 'Bold text'],
      ]) {
        expect(await page.getByRole('button', { name, exact: true }).count()).toBe(1);
        const labelId = await node(page, `${key}-label`).getAttribute('id');
        expect(labelId).toBeTruthy();
        expect(await node(page, key).getAttribute('aria-labelledby')).toBe(labelId);
      }
      await node(page, 'button-label').click();
      expect(await active(page)).toBe('button');
      await node(page, 'toggle-label').click();
      expect(await node(page, 'toggle').getAttribute('aria-pressed')).toBe('false');
      await node(page, 'item-label').click();
      expect(await node(page, 'item').getAttribute('aria-pressed')).toBe('false');
      expect(await page.evaluate(() => window.repairFixture.counts)).toEqual({
        click: 1,
        active: [{ active: true }],
        value: [{ value: ['bold'] }],
      });
      await page.evaluate(() => window.repairFixture.set('button', { disabled: true }));
      await node(page, 'button-label').click();
      expect(await page.evaluate(() => window.repairFixture.counts.click)).toBe(1);
      expect(await page.getByRole('button', { name: 'Save document', exact: true }).count()).toBe(
        1
      );
      await page.screenshot({ path: path.join(output, `${family}-${runtime}-labels.png`) });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  }
);

it.each(cases)(
  '$family $runtime Tooltip Button has one Tab stop, one activation and an owned description',
  async ({ family, runtime }) => {
    const { page, errors } = await fixture('tooltip', family, runtime);
    try {
      await node(page, 'before').focus();
      await page.keyboard.press('Tab');
      expect(await active(page)).toBe('button');
      await page.waitForFunction(() => window.repairFixture.exposes('root').open.get());
      expect(await page.getByRole('button', { name: 'Save', exact: true }).count()).toBe(1);
      const contentId = await node(page, 'content').getAttribute('id');
      expect(contentId).toBeTruthy();
      expect(await node(page, 'button').getAttribute('aria-describedby')).toBe(contentId);
      await page.keyboard.press('Enter');
      expect(await page.evaluate(() => window.repairFixture.counts.click)).toBe(1);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !window.repairFixture.exposes('root').open.get());
      expect(await active(page)).toBe('button');
      expect(await node(page, 'button').getAttribute('aria-describedby')).toBeNull();
      await page.keyboard.press('Tab');
      expect(await active(page)).toBe('after');
      await page.keyboard.press('Shift+Tab');
      expect(await active(page)).toBe('button');
      await page.keyboard.press('Shift+Tab');
      expect(await active(page)).toBe('before');
      await node(page, 'button').hover();
      await page.waitForFunction(() => window.repairFixture.exposes('root').open.get());
      await node(page, 'button').click();
      expect(await page.evaluate(() => window.repairFixture.counts.click)).toBe(2);
      await page.screenshot({ path: path.join(output, `${family}-${runtime}-tooltip.png`) });
      await page.evaluate(() =>
        window.repairFixture.set('root', { disabled: true, openDelay: 0, closeDelay: 0 })
      );
      await node(page, 'button').click();
      expect(await page.evaluate(() => window.repairFixture.counts.click)).toBe(3);
      expect(await page.evaluate(() => window.repairFixture.exposes('root').open.get())).toBe(
        false
      );
      await page.evaluate(() => window.repairFixture.set('button', { disabled: true }));
      await node(page, 'before').focus();
      await page.keyboard.press('Tab');
      expect(await active(page)).toBe('after');
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  }
);

// #1455 lifecycle acceptance, bound to the same same-subject recipe the tooltip
// suite above exercises. #1471's DOM-wrapper candidate (a mount-only descendant
// scan gated on an `el instanceof HTMLElement` check) is dispositioned here as
// neither a mainline defect nor an accepted implementation: it was closed
// without merge, and the base tooltip source carries no wrapper heuristic, so the
// wrapped control below is the single focus owner in every phase.
//
// Out-of-band (left unchecked, not claimed by this suite): a fully no-DOM host
// with no browser globals (e.g. the GPUI/native path) and OS assistive-technology
// certification. This harness observes detached-then-attached mounting and real
// Chromium Tab/Shift+Tab, pointer/focus opening, Escape and activation only.
it.each(cases)(
  '$family $runtime Tooltip lifecycle keeps one Tab stop across mounting, removal, eligibility and remount',
  async ({ family, runtime }) => {
    const { page, errors } = await fixture('tooltip-lifecycle', family, runtime);
    const life = (name: 'attach' | 'remove' | 'insert' | 'remount') =>
      page.evaluate((n) => window.repairFixture.lifecycle![n](), name);
    const setTabindex = (value: number) =>
      page.evaluate((v) => window.repairFixture.lifecycle!.setTabindex(v), value);
    const setHidden = (hidden: boolean) =>
      page.evaluate((h) => window.repairFixture.lifecycle!.setHidden(h), hidden);
    const tabIndexFromBefore = async () => {
      await node(page, 'before').focus();
      await page.keyboard.press('Tab');
      return active(page);
    };
    try {
      // no-DOM mounting: the control is created and wired while its host is
      // detached, then mounted; after mounting it is exactly one Tab stop.
      expect(
        await page.evaluate(() => document.querySelector('[data-demo-ref="button"]'))
      ).toBeNull();
      await life('attach');
      expect(await active(page)).not.toBe('button');
      expect(await tabIndexFromBefore()).toBe('button');
      await page.keyboard.press('Tab');
      expect(await active(page)).toBe('after');
      await page.keyboard.press('Shift+Tab');
      expect(await active(page)).toBe('button');
      await page.keyboard.press('Shift+Tab');
      expect(await active(page)).toBe('before');

      // The wiring survived detached mounting: focus opens the tooltip and the
      // focused subject owns the description relation.
      await node(page, 'button').focus();
      await page.waitForFunction(() => window.repairFixture.exposes('root').open.get());
      // The content view reveals a frame or two after the root open state, so
      // wait for the described-by target to carry its id before asserting.
      await page.waitForFunction(
        () => Boolean(document.querySelector('[data-demo-ref="content"]')?.getAttribute('id')),
        { timeout: 5000 }
      );
      const contentId = await node(page, 'content').getAttribute('id');
      expect(contentId).toBeTruthy();
      expect(await node(page, 'button').getAttribute('aria-describedby')).toBe(contentId);
      await page.keyboard.press('Enter');
      expect(await page.evaluate(() => window.repairFixture.counts.click)).toBe(1);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !window.repairFixture.exposes('root').open.get());
      expect(await active(page)).toBe('button');

      // Dynamic removal: the wrapped control leaves the tab order entirely and
      // focus moves across the gap; re-insertion restores exactly one stop.
      await life('remove');
      expect(
        await page.evaluate(() => document.querySelector('[data-demo-ref="button"]'))
      ).toBeNull();
      expect(await tabIndexFromBefore()).toBe('after');
      await life('insert');
      expect(await tabIndexFromBefore()).toBe('button');
      await page.keyboard.press('Tab');
      expect(await active(page)).toBe('after');

      // Command-disabled versus tooltip-disabled ownership: a disabled command is
      // not a Tab stop while the tooltip root stays enabled, and re-enabling it
      // restores the single stop. (Tooltip-disabled ownership is the sibling test
      // above, which disables the root rather than the command.)
      await page.evaluate(() => window.repairFixture.set('button', { disabled: true }));
      expect(await tabIndexFromBefore()).toBe('after');
      await page.evaluate(() => window.repairFixture.set('button', { disabled: false }));
      expect(await tabIndexFromBefore()).toBe('button');

      // Hidden control: removed from the tab order, then restored.
      await setHidden(true);
      expect(await tabIndexFromBefore()).toBe('after');
      await setHidden(false);
      expect(await tabIndexFromBefore()).toBe('button');

      // Negative tabindex: programmatic focus only, so not a Tab stop; restoring a
      // non-negative tabindex restores the single stop.
      // Focus 'before' first: a focus change makes the adapter re-project the
      // button's tabindex, so the negative value must be applied after the last
      // such change and before the Tab, with no intervening focus move.
      await node(page, 'before').focus();
      await setTabindex(-1);
      await page.keyboard.press('Tab');
      expect(await active(page)).toBe('after');
      await setTabindex(0);
      expect(await tabIndexFromBefore()).toBe('button');

      // Remount / shadow-host boundary: the underlying element is replaced and the
      // wiring re-binds; the replacement is exactly one Tab stop and still opens,
      // activates and owns the description.
      await page.evaluate(() =>
        document.querySelector('[data-demo-ref="button"]')?.setAttribute('data-pre-remount', '')
      );
      await life('remount');
      const remounted = await page.evaluate(() => {
        const el = document.querySelector('[data-demo-ref="button"]');
        return { exists: Boolean(el), isReplacement: el ? !el.hasAttribute('data-pre-remount') : false };
      });
      expect(remounted.exists).toBe(true);
      expect(remounted.isReplacement).toBe(true);
      expect(await tabIndexFromBefore()).toBe('button');
      await page.keyboard.press('Tab');
      expect(await active(page)).toBe('after');
      await node(page, 'button').focus();
      await page.waitForFunction(() => window.repairFixture.exposes('root').open.get());
      await page.waitForFunction(
        () => Boolean(document.querySelector('[data-demo-ref="content"]')?.getAttribute('id')),
        { timeout: 5000 }
      );
      const remountedContentId = await node(page, 'content').getAttribute('id');
      expect(remountedContentId).toBe(contentId);
      expect(await node(page, 'button').getAttribute('aria-describedby')).toBe(contentId);
      await page.keyboard.press('Enter');
      expect(await page.evaluate(() => window.repairFixture.counts.click)).toBe(2);
      await page.screenshot({ path: path.join(output, `${family}-${runtime}-tooltip-lifecycle.png`) });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  }
);

it.each(cases)(
  '$family $runtime horizontal Drawer keeps actual width and attachment coherent',
  async ({ family, runtime }) => {
    const { page, errors } = await fixture('drawer', family, runtime);
    const content = node(page, 'content');
    const check = async (side: 'left' | 'right', width: number, viewport = 1200) => {
      await expect
        .poll(async () => {
          const rect = await content.boundingBox();
          if (!rect) return Infinity;
          const edge = side === 'left' ? rect.x : rect.x + rect.width;
          return Math.abs(rect.width - width) + Math.abs(edge - (side === 'left' ? 0 : viewport));
        })
        .toBeLessThan(0.1);
      const rect = (await content.boundingBox())!;
      expect(side === 'left' ? rect.x : rect.x + rect.width).toBeCloseTo(
        side === 'left' ? 0 : viewport,
        1
      );
      expect(rect.y).toBeCloseTo(0, 1);
      expect(rect.height).toBeCloseTo(800, 1);
    };
    try {
      await check('right', 480);
      const header = (await node(page, 'header').boundingBox())!,
        main = (await node(page, 'main').boundingBox())!;
      expect(main.y).toBeCloseTo(header.y + header.height, 1);
      for (const side of ['left', 'right'] as const) {
        await page.evaluate(
          ({ side }) =>
            window.repairFixture.set('content', {
              side,
              maxExtent: { unit: 'logical', value: 480 },
              enterDuration: 0,
              leaveDuration: 0,
            }),
          { side }
        );
        await check(side, 480);
        const handle = (await node(page, 'handle').boundingBox())!;
        const startX = handle.x + handle.width / 2;
        await page.mouse.move(startX, handle.y + handle.height / 2);
        await page.mouse.down();
        await page.mouse.move(
          startX + (side === 'right' ? 120 : -120),
          handle.y + handle.height / 2,
          { steps: 4 }
        );
        const during = (await content.boundingBox())!;
        expect(during.width).toBeGreaterThan(300);
        expect(during.width).toBeLessThan(480);
        expect(side === 'left' ? during.x : during.x + during.width).toBeCloseTo(
          side === 'left' ? 0 : 1200,
          1
        );
        await page.mouse.up();
        await check(side, 480);
        await page.evaluate(
          ({ side }) =>
            window.repairFixture.set('content', {
              side,
              maxExtent: { unit: 'available', value: 0.5 },
              snapPoints: [0.5, 1],
              snapPoint: 0.5,
            }),
          { side }
        );
        await check(side, 300);
        await page.setViewportSize({ width: 600, height: 800 });
        await check(side, 150, 600);
        await page.evaluate(
          ({ side }) =>
            window.repairFixture.set('content', {
              side,
              maxExtent: { unit: 'logical', value: 9000 },
            }),
          { side }
        );
        await check(side, 600, 600);
        await page.evaluate(({ side }) => window.repairFixture.set('content', { side }), { side });
        await check(side, 320, 600);
        await page.setViewportSize({ width: 1200, height: 800 });
        await check(side, 320);
      }
      await page.screenshot({ path: path.join(output, `${family}-${runtime}-drawer.png`) });
      await node(page, 'close').click();
      await page.waitForFunction(() => !window.repairFixture.exposes('root').open.get());
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  }
);
