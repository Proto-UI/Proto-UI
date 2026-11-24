// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { launchBrowser } from './browser-harness';
import { observeContentsWheel } from './contents-wheel-evidence';

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser?.close();
});

// This authored viewport controls the observation oracle with real UA input.
// It does not certify a public Popover; the Docs matrix owns that acceptance.
describe('Contents wheel observer / native event controls', () => {
  it.each([false, true])(
    'preserves native cancellation=%s and current dialog identity',
    async (cancel) => {
      const context = await browser.newContext({ viewport: { width: 640, height: 480 } });
      const directory = path.join(
        process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ?? path.join(os.tmpdir(), 'homepage-evidence'),
        'contents-wheel-controls'
      );
      const receipt: Record<string, unknown> = {
        sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '',
        observerSha256: createHash('sha256')
          .update(readFileSync('apps/www/src/content/docs/zh-cn/contents-wheel-evidence.ts'))
          .digest('hex'),
        browser: browser.version(),
        scope: 'authored oracle control, not public Popover acceptance',
        cancel,
      };
      let failure: unknown;
      try {
        const page = await context.newPage();
        await page.setContent(`<!doctype html><html><body style="margin:0">
        <div role="dialog" aria-label="Wheel control" style="position:fixed;left:40px;top:40px;
          width:300px;height:240px;overflow-y:auto;--proto-ui-available-width:300px;
          --proto-ui-available-height:240px"><div style="height:1200px">Wheel target</div></div>
      </body></html>`);
        const dialog = page.getByRole('dialog', { name: 'Wheel control' });
        const probe = await dialog.evaluateHandle(observeContentsWheel);
        const dispatch = await dialog.evaluateHandle((element, cancel) => {
          const trace: Array<{ phase: string; defaultPrevented: boolean }> = [];
          document.addEventListener(
            'wheel',
            (event) => {
              trace.push({ phase: 'capture', defaultPrevented: event.defaultPrevented });
              queueMicrotask(() =>
                trace.push({ phase: 'capture-microtask', defaultPrevented: event.defaultPrevented })
              );
            },
            { capture: true, passive: true, once: true }
          );
          element.addEventListener(
            'wheel',
            (event) => {
              if (cancel) event.preventDefault();
              trace.push({ phase: 'target', defaultPrevented: event.defaultPrevented });
            },
            { passive: false, once: true }
          );
          return trace;
        }, cancel);
        try {
          const before = await probe.evaluate((observer) => observer.read());
          receipt.before = before;
          expect(before.ready).toBe(true);
          expect(before.max).toBeGreaterThan(0);
          await page.mouse.move(before.x, before.y);
          await page.mouse.wheel(0, 400);
          await vi.waitFor(
            async () => {
              const after = await probe.evaluate((observer) => observer.read());
              expect(after.wheels).toHaveLength(1);
              if (!cancel) expect(after.top).toBeGreaterThan(before.top);
            },
            { timeout: 1000 }
          );
          const after = await probe.evaluate((observer) => observer.read());
          receipt.after = after;
          receipt.dispatch = await dispatch.jsonValue();
          expect(after.wheels[0]).toMatchObject({
            trusted: true,
            surfaceInPath: true,
            contentInPath: true,
            defaultPrevented: cancel,
          });
          expect(after.documentY).toBe(before.documentY);
          if (cancel) expect(after.top).toBe(before.top);
          await dialog.evaluate((element) => element.replaceWith(element.cloneNode(true)));
          const current = await dialog.elementHandles();
          try {
            expect(current).toHaveLength(1);
            const replaced = await probe.evaluate(
              (observer, dialogs) => observer.read(dialogs[0]),
              current
            );
            receipt.replaced = replaced;
            expect(replaced).toMatchObject({
              connected: false,
              sameDialog: false,
              sameSurface: true,
              ready: false,
            });
          } finally {
            await Promise.all(current.map((element) => element.dispose()));
          }
        } finally {
          // Retain the final native observations even if input delivery or an
          // assertion failed before the normal receipt assignment above.
          receipt.final = await probe.evaluate((observer) => observer.read());
          receipt.dispatch = await dispatch.jsonValue();
          await probe.evaluate((observer) => observer.dispose());
          await probe.dispose();
          await dispatch.dispose();
        }
      } catch (error) {
        failure = error;
        receipt.error = String(error);
      } finally {
        try {
          await mkdir(directory, { recursive: true });
          await writeFile(
            path.join(directory, `cancellation-${cancel}.json`),
            JSON.stringify(receipt, null, 2)
          );
        } catch (error) {
          if (failure) console.error('[Contents wheel control evidence]', error);
          else failure = error;
        }
        try {
          await context.close();
        } catch (error) {
          if (failure) console.error('[Contents wheel control cleanup]', error);
          else failure = error;
        }
      }
      if (failure) throw failure;
    }
  );
});
