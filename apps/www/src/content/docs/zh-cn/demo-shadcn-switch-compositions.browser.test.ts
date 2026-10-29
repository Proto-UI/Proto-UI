// @vitest-environment node
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { Browser, Locator } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RUNTIMES, launchBrowser, openRoute, selectRuntime, startServer, stopServer } from './browser-harness';

const route = '/en/ui-libraries/shadcn/switch/';
let browser: Browser, baseUrl = '';
const ref = (previewer: Locator, id: string) => previewer.locator(`.host [data-demo-ref="${id}"]`);
const checked = (previewer: Locator, id: string) => ref(previewer, `${id}-control`).getAttribute('aria-checked');
const requests = (previewer: Locator, id: string) => ref(previewer, `${id}-requests`).getAttribute('data-request-count');
const paint = (previewer: Locator, id: string) => ref(previewer, `${id}-card`).evaluate((el) => {
  const style = getComputedStyle(el);
  return { background: style.backgroundColor, border: style.borderTopColor };
});

async function capture(previewer: Locator, runtime: string, phase: string) {
  const directory = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR;
  if (!directory) return;
  const root = path.join(directory, 'switch-public-compositions');
  await mkdir(root, { recursive: true });
  const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
  const name = `${sourceSha.slice(0, 12)}-${runtime}-${phase}`;
  // Viewport capture must not scroll the tall previewer while a native pointer is held.
  await previewer.page().screenshot({ path: path.join(root, name + '.png'), style: 'astro-dev-toolbar { visibility: hidden; }' });
  await writeFile(path.join(root, name + '.json'), JSON.stringify({
    sourceSha, tree, dirtyWorktree: !!dirty, runtime, phase, route,
    observedAt: new Date().toISOString(),
    controls: await previewer.locator('.host [role="switch"]').evaluateAll((nodes) => nodes.map((el) => ({
      ref: el.getAttribute('data-demo-ref'), checked: el.getAttribute('aria-checked'),
      labelledBy: el.getAttribute('aria-labelledby'), describedBy: el.getAttribute('aria-describedby'),
      rect: el.getBoundingClientRect().toJSON(),
    }))),
    input: await previewer.page().evaluate(() => (window as any).__switchCompositionInput ?? []),
  }, null, 2));
}

async function open(runtime: typeof RUNTIMES[number]) {
  const opened = await openRoute(browser, baseUrl, route, { width: 1100, height: 1000 });
  const previewer = opened.page.locator('[data-demo-id="demo-shadcn-switch-compositions"]');
  await selectRuntime(opened.page, previewer, runtime, '[role="switch"]', 9);
  await opened.page.evaluate(() => {
    (window as any).__switchCompositionInput = [];
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'click', 'keydown']) {
      document.addEventListener(type, (event) => {
        const elements = event.composedPath().filter((node): node is Element => node instanceof Element);
        if (!elements.some((el) => el.getAttribute('data-demo-id') === 'demo-shadcn-switch-compositions')) return;
        (window as any).__switchCompositionInput.push({
          type, trusted: event.isTrusted, key: (event as KeyboardEvent).key,
          refs: elements.map((el) => el.getAttribute('data-demo-ref')).filter(Boolean),
        });
      }, true);
    }
  });
  return { ...opened, previewer };
}

beforeAll(async () => { baseUrl = await startServer(route); browser = await launchBrowser(); }, 120000);
afterAll(async () => { await Promise.all([browser?.close(), stopServer()]); });

describe('real public Switch page compositions', () => {
  for (const runtime of RUNTIMES) {
    it(`${runtime} card, label, description, link, disabled and controlled ownership`, async () => {
      const { page, context, previewer } = await open(runtime);
      try {
        for (const id of ['description', 'choice', 'selected', 'disabled', 'controlled', 'readonly', 'rtl', 'drag', 'drag-rtl']) {
          expect(await ref(previewer, `${id}-control`).getAttribute('aria-labelledby')).toBe(await ref(previewer, `${id}-label`).getAttribute('id'));
          expect(await ref(previewer, `${id}-control`).getAttribute('aria-describedby')).toBe(await ref(previewer, `${id}-description`).getAttribute('id'));
          expect(await ref(previewer, `${id}-label`).getAttribute('id')).toBeTruthy();
          expect(await ref(previewer, `${id}-description`).getAttribute('id')).toBeTruthy();
        }
        const offPaint = await paint(previewer, 'choice');
        expect(await paint(previewer, 'selected')).not.toEqual(offPaint);
        const card = ref(previewer, 'choice-card');
        await card.scrollIntoViewIfNeeded();
        const box = await card.boundingBox();
        expect(box).not.toBeNull();
        // Native click on blank card padding, not merely on the small control.
        await page.mouse.click(box!.x + 8, box!.y + 8);
        await expect.poll(() => checked(previewer, 'choice')).toBe('true');
        expect(await requests(previewer, 'choice')).toBe('1');
        expect(await paint(previewer, 'choice')).toEqual(await paint(previewer, 'selected'));
        await ref(previewer, 'choice-label').click();
        await expect.poll(() => checked(previewer, 'choice')).toBe('false');
        expect(await requests(previewer, 'choice')).toBe('2');
        await expect.poll(() => ref(previewer, 'choice-control').evaluate((el) => el.matches(':focus'))).toBe(true);
        await page.keyboard.press('Space');
        await expect.poll(() => checked(previewer, 'choice')).toBe('true');
        expect(await requests(previewer, 'choice')).toBe('3');
        await ref(previewer, 'choice-control').click();
        await expect.poll(() => checked(previewer, 'choice')).toBe('false');
        expect(await requests(previewer, 'choice')).toBe('4');
        await ref(previewer, 'choice-link').click();
        await expect.poll(() => new URL(page.url()).hash).toBe('#switch-composition-details');
        expect(await checked(previewer, 'choice')).toBe('false');
        expect(await requests(previewer, 'choice')).toBe('4');
        for (const id of ['disabled', 'readonly']) {
          const controlBefore = await checked(previewer, id);
          const target = ref(previewer, `${id}-card`);
          await target.scrollIntoViewIfNeeded();
          const rect = await target.boundingBox();
          await page.mouse.click(rect!.x + 8, rect!.y + 8);
          expect(await checked(previewer, id)).toBe(controlBefore);
          expect(await requests(previewer, id)).toBe('0');
        }
        const rejectedPaint = await paint(previewer, 'controlled');
        await ref(previewer, 'controlled-label').click();
        await expect.poll(() => requests(previewer, 'controlled')).toBe('1');
        expect(await checked(previewer, 'controlled')).toBe('false');
        expect(await paint(previewer, 'controlled')).toEqual(rejectedPaint);
        const trusted = await page.evaluate(() => (window as any).__switchCompositionInput);
        expect(trusted.some((event: any) => event.type === 'pointerdown' && event.trusted)).toBe(true);
        expect(trusted.some((event: any) => event.type === 'keydown' && event.trusted && event.key === ' ')).toBe(true);
      } finally {
        await capture(previewer, runtime, 'card-result');
        await context.close();
      }
    }, 120000);

    it(`${runtime} opt-in LTR and RTL thumb moves while held, before one release request`, async () => {
      const { page, context, previewer } = await open(runtime);
      try {
        const plain = ref(previewer, 'description-control'), plainThumb = ref(previewer, 'description-thumb');
        await plain.scrollIntoViewIfNeeded();
        const plainStart = (await plainThumb.boundingBox())!;
        await page.mouse.move(plainStart.x + plainStart.width / 2, plainStart.y + plainStart.height / 2);
        await page.mouse.down();
        await page.mouse.move(plainStart.x + plainStart.width / 2 + 9, plainStart.y + plainStart.height / 2, { steps: 6 });
        expect(Math.abs((await plainThumb.boundingBox())!.x - plainStart.x)).toBeLessThan(1);
        expect(await checked(previewer, 'description')).toBe('false');
        expect(await requests(previewer, 'description')).toBe('0');
        await page.mouse.up();
        for (const [id, sign] of [['drag', 1], ['drag-rtl', -1]] as const) {
          const control = ref(previewer, `${id}-control`), thumb = ref(previewer, `${id}-thumb`);
          await control.scrollIntoViewIfNeeded();
          // Observe stable painted geometry, not a fixed sleep or an author-supplied extent.
          await control.evaluate(async (element) => {
            let previous = '', stable = 0;
            for (let i = 0; i < 120; i++) {
              await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
              const r = element.getBoundingClientRect();
              const next = `${r.x}:${r.y}:${r.width}:${r.height}`;
              stable = next === previous ? stable + 1 : 0; previous = next;
              if (stable >= 3) return;
            }
            throw new Error('Public Switch geometry never stabilized');
          });
          const rootBox = (await control.boundingBox())!, start = (await thumb.boundingBox())!;
          const travel = rootBox.width - start.width - 2;
          expect(travel).toBeGreaterThan(8);
          if (sign === 1) expect(start.x).toBeLessThan(rootBox.x + rootBox.width / 2);
          else expect(start.x).toBeGreaterThan(rootBox.x + rootBox.width / 3);
          const x = start.x + start.width / 2, y = start.y + start.height / 2;
          await page.mouse.move(x, y); await page.mouse.down();
          await page.mouse.move(x + sign * travel * 0.65, y, { steps: 6 });
          await expect.poll(async () => sign * ((await thumb.boundingBox())!.x - start.x)).toBeGreaterThan(2);
          const held = (await thumb.boundingBox())!;
          expect(sign * (held.x - start.x)).toBeLessThan(travel - 1);
          expect(await checked(previewer, id)).toBe('false');
          expect(await requests(previewer, id)).toBe('0');
          await capture(previewer, runtime, `${id}-held`);
          await page.mouse.move(x + sign * travel, y, { steps: 4 });
          await page.mouse.up();
          await expect.poll(() => checked(previewer, id)).toBe('true');
          expect(await requests(previewer, id)).toBe('1');
        }
      } finally {
        await page.mouse.up();
        await capture(previewer, runtime, 'drag-result');
        await context.close();
      }
    }, 120000);
  }
});
