// @vitest-environment node
import type { Browser, Page } from 'playwright-core';
import { appendFileSync, mkdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer } from './browser-harness';

const S2 = '[data-shadow-s2]';
const profiles = ['light', 'split', 'mixed'];
let browser: Browser;
let baseUrl: string;
const diagnosticDir = process.env.S2_DIAGNOSTIC_DIR;
let diagnosticVisit = 0;
const receipts = new WeakMap<Page, (phase: string, detail?: unknown) => void>();
beforeAll(async () => {
  if (diagnosticDir && (!process.env.DEBUG?.includes('pw:protocol') ||
    !process.env.DEBUG_FILE || !isAbsolute(process.env.DEBUG_FILE)))
    throw new Error('S2 diagnostics require DEBUG=pw:protocol,pw:api and an absolute DEBUG_FILE set before starting Vitest');
  baseUrl = await startServer('/zh-cn/internal/demo-matrix/');
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);
const component = (page: Page, profile: string, kind: string) =>
  page.locator(`${S2} [data-s2-profile="${profile}"] [data-s2-component="${kind}"]`);
// Endpoint tests deliberately wait past the governed 150/200ms transitions.
// Intermediate-frame/reversal geometry is covered by shadow-s2-motion-browser.mjs.
const settle = (page: Page) => page.waitForTimeout(300);
async function action(page: Page, name: string) {
  const record = receipts.get(page);
  const target = page.locator(`${S2} [data-action="${name}"]`);
  if (record && name === 'checked') {
    record('checked:identity', await target.evaluate((button: HTMLButtonElement) => {
      const formIdentity = (form: HTMLFormElement | null) => form && ({
        outerHTML: form.outerHTML, id: form.id, name: form.name,
        action: form.action, method: form.method, target: form.target,
      });
      const ancestors: string[] = [];
      for (let node = button.parentElement; node; node = node.parentElement)
        ancestors.push(`${node.tagName}#${node.id}`);
      return { outerHTML: button.outerHTML, type: button.type,
        form: formIdentity(button.form), closestForm: formIdentity(button.closest('form')),
        formIsClosest: button.form === button.closest('form'), ancestors, url: location.href };
    }));
    record('checked:frames', page.frames().map((frame) => ({ name: frame.name(), url: frame.url() })));
  }
  record?.('click:before', { name });
  try {
    await target.click();
    record?.('click:after', { name });
  } catch (error) {
    record?.('click:failed', { name, error: String(error) });
    throw error;
  }
  await settle(page);
}
async function expectedPaint(page: Page, variant: string, dark: boolean) {
  // Resolve the documented recipe against the application's inherited theme,
  // not against another component (which could share the same broken output).
  return page.locator(S2).evaluate(
    (section, { variant, dark }) => {
      const ref = document.createElement('div');
      section.append(ref);
      const color = (value: string) => {
        ref.style.backgroundColor = value;
        return getComputedStyle(ref).backgroundColor;
      };
      const mix = (name: string, amount: number) =>
        `color-mix(in oklab, var(--pui-${name}) ${amount}%, transparent)`;
      try {
        return {
          button: color(
            variant === 'default'
              ? 'var(--pui-primary)'
              : variant === 'destructive'
                ? mix('destructive', dark ? 20 : 10)
                : variant === 'outline'
                  ? dark
                    ? mix('input', 30)
                    : 'var(--pui-background)'
                  : variant === 'secondary'
                    ? 'var(--pui-secondary)'
                    : 'transparent'
          ),
          switch: color(mix('input', dark ? 50 : 80)),
        };
      } finally {
        ref.remove();
      }
    },
    { variant, dark }
  );
}
async function read(page: Page) {
  return page.locator(S2).evaluate((section) =>
    Array.from(section.querySelectorAll<HTMLElement>('[data-s2-profile]')).map((column) => {
      const host = (kind: string) =>
        column.querySelector<HTMLElement>(`[data-s2-component="${kind}"]`)!;
      const surface = (kind: string) =>
        host(kind).shadowRoot?.querySelector<HTMLElement>('[part="surface"]') ?? host(kind);
      const measure = (kind: string) => {
        const h = host(kind).getBoundingClientRect(),
          s = surface(kind).getBoundingClientRect(),
          css = getComputedStyle(surface(kind));
        return {
          size: [h.width, h.height],
          surfaceSize: [s.width, s.height],
          background: css.backgroundColor,
          color: css.color,
          opacity: css.opacity,
          shadow: css.boxShadow,
          transform: getComputedStyle(host(kind)).transform,
          checked: host(kind).getAttribute('aria-checked'),
          disabled: host(kind).getAttribute('aria-disabled'),
        };
      };
      return {
        profile: column.dataset.s2Profile,
        button: measure('button'),
        switch: measure('switch'),
        thumb: measure('thumb'),
        checkbox: measure('checkbox'),
        badge: measure('badge'),
        thumbX: host('thumb').getBoundingClientRect().x - host('switch').getBoundingClientRect().x,
        glyphs: Array.from(
          (host('indicator').shadowRoot ?? host('indicator')).querySelectorAll('path')
        ).map((p) => p.getAttribute('d')),
        slot: host('button').textContent,
        slotOwned: host('button').lastElementChild?.getRootNode() === document,
        splitKinds: Array.from(column.querySelectorAll<HTMLElement>('[data-s2-split]'))
          .map((el) => el.dataset.s2Component)
          .sort(),
        counts: [
          Number(column.dataset.buttonClicks),
          Number(column.dataset.switchChanges),
          Number(column.dataset.checkboxChanges),
        ],
        generations: JSON.parse(column.dataset.generations!),
      };
    })
  );
}
async function visit(run: (page: Page) => Promise<void>, locale = 'zh-cn') {
  const context = await browser.newContext({
    colorScheme: 'light',
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
  if (diagnosticDir) {
    mkdirSync(diagnosticDir, { recursive: true });
    const file = join(diagnosticDir, `s2-${process.pid}-${++diagnosticVisit}-${locale}.jsonl`);
    let sequence = 0;
    const record = (phase: string, detail?: unknown) => appendFileSync(file,
      `${JSON.stringify({ sequence: ++sequence, hostTime: new Date().toISOString(),
        hostMonotonicNs: process.hrtime.bigint().toString(), phase, detail })}\n`);
    receipts.set(page, record);
    record('visit:start', { locale, debugFile: process.env.DEBUG_FILE });
    page.on('console', (message) => {
      if (message.text().startsWith('S2_DIAGNOSTIC '))
        record('page:checkpoint', message.text().slice('S2_DIAGNOSTIC '.length));
    });
    page.on('pageerror', (error) => record('page:error', String(error)));
    page.on('request', (request) => {
      if (request.isNavigationRequest()) record('navigation:request', {
        url: request.url(), method: request.method(), frameUrl: request.frame().url(),
      });
    });
    page.on('requestfailed', (request) => {
      if (request.isNavigationRequest()) record('navigation:failed', {
        url: request.url(), failure: request.failure(),
      });
    });
    page.on('requestfinished', (request) => {
      if (request.isNavigationRequest()) record('navigation:finished', { url: request.url() });
    });
    page.on('framenavigated', (frame) => record('navigation:frame', { url: frame.url() }));
    const session = await context.newCDPSession(page);
    for (const event of ['Page.frameRequestedNavigation', 'Page.frameScheduledNavigation',
      'Page.frameClearedScheduledNavigation', 'Page.frameStartedLoading',
      'Page.frameStoppedLoading', 'Page.frameNavigated'] as const)
      session.on(event, (payload) => record(`cdp:${event}`, payload));
    await session.send('Page.enable');
    record('diagnostic-session:Page.enable:complete');
    await context.addInitScript(() => {
      const checkpoint = (value: unknown) => console.debug(`S2_DIAGNOSTIC ${JSON.stringify(value)}`);
      (window as Window & { __s2Checkpoint?: typeof checkpoint }).__s2Checkpoint = checkpoint;
      const identify = (element: Element | null) => element && ({
        tag: element.tagName, id: element.id, action: element.getAttribute('data-action'),
      });
      const click = (event: MouseEvent, phase: string) => {
        const target = event.composedPath().find((item) =>
          item instanceof Element && item.matches('[data-shadow-s2] [data-action="checked"]'));
        if (target instanceof Element) checkpoint({ phase, target: identify(target),
          defaultPrevented: event.defaultPrevented, trusted: event.isTrusted,
          time: performance.now(), url: location.href });
      };
      document.addEventListener('click', (event) => click(event, 'click:capture'), true);
      document.addEventListener('click', (event) => click(event, 'click:document-bubble'));
      document.addEventListener('submit', (event) => checkpoint({ phase: 'submit:capture',
        form: identify(event.target as Element), submitter: identify(event.submitter),
        defaultPrevented: event.defaultPrevented, time: performance.now(), url: location.href }), true);
      window.addEventListener('beforeunload', () => checkpoint({ phase: 'beforeunload',
        time: performance.now(), url: location.href }));
    });
  }
    await page.goto(`${baseUrl}/${locale}/internal/demo-matrix/`);
    await page.waitForSelector(`${S2}[data-ready="true"]`);
    await page.locator(S2).scrollIntoViewIfNeeded();
    await settle(page);
    await run(page);
    expect(errors).toEqual([]);
  } catch (error) {
    receipts.get(page)?.('visit:failed', { error: String(error), errors });
    throw error;
  } finally {
    receipts.get(page)?.('context-close:before', { errors });
    try {
      await context.close();
      receipts.get(page)?.('context-close:after');
    } catch (error) {
      receipts.get(page)?.('context-close:failed', String(error));
      throw error;
    }
  }
}
function parity(rows: Awaited<ReturnType<typeof read>>) {
  for (const row of rows) {
    for (const kind of ['button', 'switch', 'thumb', 'checkbox', 'badge'] as const) {
      expect(row[kind].size, `${row.profile}/${kind}/size`).toEqual(rows[0][kind].size);
      expect(row[kind].surfaceSize, `${row.profile}/${kind}/surface`).toEqual(row[kind].size);
      expect(row[kind].background, `${row.profile}/${kind}/background`).toBe(
        rows[0][kind].background
      );
      expect(row[kind].color, `${row.profile}/${kind}/color`).toBe(rows[0][kind].color);
    }
    expect(row.thumbX).toBeCloseTo(rows[0].thumbX, 2);
  }
}

describe.sequential('S2 public Shadow split settings paths', () => {
  for (const locale of ['zh-cn', 'en'])
    it(`renders all variant/size/theme combinations and exact geometry (${locale})`, async () => {
      await visit(async (page) => {
        const initial = await read(page);
        expect(initial.map((r) => r.splitKinds)).toEqual([
          [],
          ['badge', 'button', 'checkbox', 'indicator', 'switch', 'thumb'],
          ['button', 'indicator', 'switch'],
        ]);
        for (const dark of [false, true]) {
          if (dark) await action(page, 'scheme');
          for (const variant of [
            'default',
            'destructive',
            'outline',
            'secondary',
            'ghost',
            'link',
          ]) {
            await page.locator(`${S2} [data-option="variant"]`).selectOption(variant);
            for (const [size, height] of [
              ['default', 32],
              ['sm', 28],
              ['lg', 36],
              ['icon', 32],
            ] as const) {
              await page.locator(`${S2} [data-option="size"]`).selectOption(size);
              await page.mouse.move(0, 0);
              await settle(page);
              const rows = await read(page);
              parity(rows);
              const paint = await expectedPaint(page, variant, dark);
              for (const row of rows) {
                expect(row.button.size[1]).toBe(height);
                if (size === 'icon') expect(row.button.size[0]).toBe(32);
                expect(row.switch.size).toEqual([44, 24]);
                expect(row.thumb.size).toEqual([20, 20]);
                expect(row.thumbX).toBe(3);
                expect(row.checkbox.size).toEqual([16, 16]);
                expect(row.slotOwned).toBe(true);
                expect(row.counts).toEqual([0, 0, 0]);
                expect(row.badge.background).toBe('rgb(255, 216, 61)');
                expect(row.button.background).toBe(paint.button);
                expect(row.switch.background).toBe(paint.switch);
              }
            }
          }
        }
        await action(page, 'checked');
        await action(page, 'rapid');
        await page.waitForTimeout(450);
        for (const row of await read(page)) {
          expect(row.switch.checked).toBe('true');
          expect(row.thumbX).toBe(21);
          expect(row.glyphs).toEqual(['m20 6-11 11-5-5']);
          expect(row.counts).toEqual([0, 0, 0]);
        }
      }, locale);
    }, 90_000);

  it('routes native pointer, Tab, Space and Enter once, preserves focus paint and suppresses disabled input', async () => {
    await visit(async (page) => {
      for (const profile of profiles) {
        const button = component(page, profile, 'button');
        await button.hover();
        await settle(page);
        const hovered = await read(page);
        expect(hovered.find((r) => r.profile === profile)!.button.background).not.toBe(
          hovered.find((r) => r.profile !== profile)!.button.background
        );
        await page.mouse.down();
        await settle(page);
        expect((await read(page)).find((r) => r.profile === profile)!.button.transform).toBe(
          'matrix(1, 0, 0, 1, 0, 1)'
        );
        await page.mouse.up();
        await settle(page);
        await component(page, profile, 'checkbox').focus();
        await page.keyboard.press('Tab');
        expect(await button.evaluate((el) => document.activeElement === el)).toBe(true);
        await settle(page);
        expect((await read(page)).find((r) => r.profile === profile)!.button.shadow).toContain(
          '0px 0px 0px 3px'
        );
        await page.keyboard.press('Space');
        await page.keyboard.press('Enter');
        await settle(page);
        for (const kind of ['switch', 'checkbox']) {
          if (kind === 'switch') {
            await component(page, profile, kind).hover();
            await page.mouse.down();
            await settle(page);
            const held = (await read(page)).find((r) => r.profile === profile)!;
            expect(held.switch.size[0]).toBeCloseTo(44 * 0.98, 2);
            expect(held.counts[1]).toBe(0);
            await page.mouse.up();
          } else await component(page, profile, kind).click();
          await settle(page);
          await component(page, profile, kind).focus();
          await page.keyboard.press('Space');
          await settle(page);
        }
      }
      for (const row of await read(page)) {
        expect(row.counts).toEqual([3, 2, 2]);
        expect(row.switch.checked).toBe('false');
        expect(row.checkbox.checked).toBe('false');
      }
      await action(page, 'disabled');
      for (const profile of profiles)
        for (const kind of ['button', 'switch', 'checkbox']) {
          const el = component(page, profile, kind);
          await el.click({ force: true });
          await el.focus();
          await page.keyboard.press('Space');
          await page.keyboard.press('Enter');
        }
      await settle(page);
      for (const row of await read(page)) {
        expect(row.counts).toEqual([3, 2, 2]);
        for (const kind of ['button', 'switch', 'checkbox'] as const) {
          expect(row[kind].disabled).toBe('true');
          expect(row[kind].opacity).toBe('0.5');
        }
      }
      await action(page, 'disabled');
      for (const profile of profiles) await component(page, profile, 'button').click();
      await settle(page);
      for (const row of await read(page)) expect(row.counts).toEqual([4, 2, 2]);
    });
  }, 90_000);

  it('retains mixed context, controlled state and slot ownership across move/reconnect without duplicate notifications', async () => {
    await visit(async (page) => {
      for (const name of ['checked', 'slot', 'tone', 'scheme', 'disabled'])
        await action(page, name);
      await page.mouse.move(0, 0);
      await settle(page);
      const before = await read(page);
      await action(page, 'move');
      expect(await read(page)).toEqual(before);
      const hosts = await page.locator(`${S2} [data-s2-split]`).elementHandles();
      await action(page, 'disconnect');
      for (const host of hosts) {
        expect(await host.evaluate((el) => el.isConnected)).toBe(false);
        expect(
          await host.evaluate((el) =>
            el instanceof HTMLElement ? el.shadowRoot?.childNodes.length : -1
          )
        ).toBe(0);
      }
      for (const name of ['tone', 'disabled']) await action(page, name);
      await action(page, 'disconnect');
      const rows = await read(page);
      parity(rows);
      for (const row of rows) {
        expect(Object.values(row.generations)).toEqual([2, 2, 2, 2, 2, 2]);
        expect(row.counts).toEqual([0, 0, 0]);
        expect(row.switch.checked).toBe('true');
        expect(row.thumbX).toBe(21);
        expect(row.checkbox.checked).toBe('true');
        expect(row.glyphs).toEqual(['m20 6-11 11-5-5']);
        expect(row.slot).toBe('Save preferences');
        expect(row.slotOwned).toBe(true);
        expect(row.badge.background).toBe('rgb(255, 147, 127)');
      }
      for (const profile of profiles)
        for (const kind of ['button', 'switch', 'checkbox'])
          await component(page, profile, kind).click();
      await settle(page);
      for (const row of await read(page)) {
        expect(row.counts).toEqual([1, 1, 1]);
        expect(row.thumbX).toBe(3);
        expect(row.glyphs).toEqual([]);
      }
      await action(page, 'tone');
      for (const row of await read(page)) expect(row.badge.background).toBe('rgb(255, 216, 61)');
      await page.setViewportSize({ width: 320, height: 900 });
      await settle(page);
      expect(await page.locator(S2).evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(false);
    });
  }, 90_000);
});
