// @vitest-environment node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RUNTIMES, launchBrowser, selectRuntime, startServer, stopServer } from './browser-harness';
import {
  measureLabelTextDrag,
  observeLabelDescriptionSelection,
  recordLabelPointerTrace,
} from './label-selection-observer';

const families = ['base', 'shadcn', 'brutalist'] as const;
const subjects = [
  { ref: 'checkbox', role: 'checkbox', name: 'Community updates' },
  { ref: 'switch', role: 'switch', name: 'Enable notifications' },
  { ref: 'radio-email', role: 'radio', name: 'Email delivery' },
  { ref: 'radio-push', role: 'radio', name: 'Push delivery' },
  { ref: 'input', role: 'textbox', name: 'Project name' },
  { ref: 'textarea', role: 'textbox', name: 'Project notes' },
  { ref: 'readonly-input', role: 'textbox', name: 'Read-only project name' },
  { ref: 'readonly-textarea', role: 'textbox', name: 'Read-only project notes' },
  { ref: 'disabled', role: 'checkbox', name: 'Disabled choice' },
  { ref: 'controlled', role: 'checkbox', name: 'Controlled choice (owner keeps it off)' },
  { ref: 'passive', role: 'checkbox', name: 'Naming only: this text can be copied' },
] as const;
const routes = {
  base: '/en/ui-libraries/base/label/',
  shadcn: '/en/ui-libraries/shadcn/label/',
  brutalist: '/en/ui-libraries/brutalist/components/label/',
};
let browser: Browser;
let baseUrl = '';
let evidenceDir = '';
let source: Record<string, unknown>;

beforeAll(async () => {
  evidenceDir = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
    ? path.join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, 'label-consumers')
    : await mkdtemp(path.join(tmpdir(), 'pui-label1094-'));
  await mkdir(evidenceDir, { recursive: true });
  const paths = [
    'apps/www/src/content/docs/zh-cn/demo-control-label.browser.test.ts',
    'apps/www/src/content/docs/zh-cn/label-selection-observer.ts',
    'apps/www/src/content/docs/zh-cn/browser-harness.ts',
    'apps/www/src/components/PrototypePreviewer/control-label-demo.ts',
    'apps/www/src/components/PrototypePreviewer/projection-families.ts',
    'packages/prototypes/base/src/label/root.proto.ts',
    ...families.map((family) => `apps/www/src/content/docs/zh-cn/demo-${family}-label.demo.ts`),
  ];
  source = {
    headSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirtyWorktree: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }),
    files: Object.fromEntries(
      paths.map((file) => [file, createHash('sha256').update(readFileSync(file)).digest('hex')])
    ),
    scope: 'Explicit fixture/demo inputs only; parent retains full candidate source admission.',
  };
  console.log(`Independent Label consumer evidence: ${evidenceDir}`);
  baseUrl = await startServer(Object.values(routes));
  browser = await launchBrowser();
}, 180_000);

afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    await stopServer();
  }
}, 60_000);

// C-CONTROL-LABEL-0001 NAME/ACTIVATION/INPUT/FOCUS/CONTENT/WEB,
// P-BASE-LABEL OPTIONS/CONTENT/ACTION and T-CONTROL-LABEL-0001 CASE-NATIVE.
// Real browser input and accessible-name lookup are recorded separately from
// OS assistive technology, package delivery and complete lifecycle admission.
describe.sequential('Independent Label public consumer journeys', () => {
  it.each(families.flatMap((family) => RUNTIMES.map((runtime) => ({ family, runtime }))))(
    '$family $runtime names five real target types and preserves their operation owners',
    async ({ family, runtime }) => {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 1000 },
        colorScheme: 'light',
        hasTouch: true,
      });
      const page = await context.newPage();
      const errors: string[] = [];
      const consoleMessages: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (['error', 'warning'].includes(message.type()) && consoleMessages.length < 100)
          consoleMessages.push(`${message.type()}: ${message.text()}`);
      });
      const stages: Record<string, unknown>[] = [];
      const observations: Record<string, unknown> = {
        source,
        family,
        runtime,
        route: routes[family],
        browser: browser.version(),
        viewport: page.viewportSize(),
        criteria: 'C-CONTROL-LABEL-0001 NAME/ACTIVATION/INPUT/FOCUS/CONTENT/WEB',
        acceptance: 'Browser consumer evidence only; OS AT and full Issue #1094 remain separate.',
        stages,
        errors,
        consoleMessages,
      };
      const preview = page.locator('[data-previewer-id]').first();
      const content = preview.locator('.host');
      const label = (id: string) => content.locator(`[data-demo-ref="label-${id}"]`);
      const controlled = content.getByRole('checkbox', {
        name: 'Controlled choice (owner keeps it off)',
        exact: true,
      });
      const requests = content.locator('[data-demo-ref="controlled-requests"]');
      const checkbox = content.getByRole('checkbox', { name: 'Community updates', exact: true });
      const switchControl = content.getByRole('switch', {
        name: 'Enable notifications',
        exact: true,
      });
      const email = content.getByRole('radio', { name: 'Email delivery', exact: true });
      const push = content.getByRole('radio', { name: 'Push delivery', exact: true });
      const input = content.getByRole('textbox', { name: 'Project name', exact: true });
      const textarea = content.getByRole('textbox', { name: 'Project notes', exact: true });
      const passive = content.getByRole('checkbox', {
        name: 'Naming only: this text can be copied',
        exact: true,
      });
      const capture = async (stage: string) => {
        const rendered = await content.locator('[data-demo-ref]').evaluateAll((elements) =>
          elements.map((element) => {
            const root = element as HTMLElement;
            const editor = root.matches('input,textarea')
              ? (root as HTMLInputElement | HTMLTextAreaElement)
              : root.querySelector<HTMLInputElement | HTMLTextAreaElement>('input,textarea');
            const subject = editor ?? root;
            const style = getComputedStyle(root);
            return {
              ref: root.dataset.demoRef,
              tag: root.tagName,
              role: subject.getAttribute('role'),
              labelId: root.id,
              labelledBy: subject.getAttribute('aria-labelledby'),
              checked: subject.getAttribute('aria-checked'),
              disabled: subject.getAttribute('aria-disabled'),
              value: editor?.value,
              readOnly: editor?.readOnly,
              selectionStart: editor?.selectionStart,
              selectionEnd: editor?.selectionEnd,
              focused: subject === document.activeElement,
              tabIndex: root.tabIndex,
              userSelect: style.userSelect,
              font: style.font,
              color: style.color,
              rect: root.getBoundingClientRect().toJSON(),
            };
          })
        );
        stages.push({ stage, rendered, accessibility: await content.ariaSnapshot() });
        await writeFile(
          path.join(evidenceDir, `${family}-${runtime}.json`),
          JSON.stringify(observations, null, 2)
        );
        await preview.screenshot({
          path: path.join(evidenceDir, `${family}-${runtime}-${stage}.png`),
          style: 'astro-dev-toolbar { visibility: hidden; }',
        });
      };
      try {
        await page.goto(`${baseUrl}${routes[family]}`, { waitUntil: 'domcontentloaded' });
        await selectRuntime(page, preview, runtime, '[data-demo-ref="label-checkbox"]', 1);
        for (const subject of subjects) {
          const target = content.getByRole(subject.role, { name: subject.name, exact: true });
          await expect.poll(() => target.count()).toBe(1);
          const nameSource = label(subject.ref);
          await expect.poll(() => nameSource.getAttribute('id')).toBeTruthy();
          await expect
            .poll(() => target.getAttribute('aria-labelledby'))
            .toBe(await nameSource.getAttribute('id'));
          expect((await target.getAttribute('aria-label')) ?? '').toBe('');
          expect(await nameSource.getAttribute('role')).toBeNull();
          expect(await nameSource.evaluate((element) => (element as HTMLElement).tabIndex)).toBe(
            -1
          );
        }
        expect(await requests.textContent()).toBe('Requests: 0');
        await capture('initial');

        await label('checkbox').click();
        await expect.poll(() => checkbox.getAttribute('aria-checked')).toBe('true');
        await expect
          .poll(() => checkbox.evaluate((element) => element === document.activeElement))
          .toBe(true);
        await page.keyboard.press('Space');
        await expect.poll(() => checkbox.getAttribute('aria-checked')).toBe('false');
        await label('checkbox').tap();
        await expect.poll(() => checkbox.getAttribute('aria-checked')).toBe('true');

        await label('switch').click();
        await expect.poll(() => switchControl.getAttribute('aria-checked')).toBe('true');
        await expect
          .poll(() => switchControl.evaluate((element) => element === document.activeElement))
          .toBe(true);
        await page.keyboard.press('Space');
        await expect.poll(() => switchControl.getAttribute('aria-checked')).toBe('false');
        await label('switch').tap();
        await expect.poll(() => switchControl.getAttribute('aria-checked')).toBe('true');

        await label('radio-push').click();
        await expect.poll(() => push.getAttribute('aria-checked')).toBe('true');
        expect(await email.getAttribute('aria-checked')).toBe('false');
        await expect
          .poll(() => push.evaluate((element) => element === document.activeElement))
          .toBe(true);
        await page.keyboard.press('ArrowLeft');
        await expect.poll(() => email.getAttribute('aria-checked')).toBe('true');
        await label('radio-push').tap();
        await expect.poll(() => push.getAttribute('aria-checked')).toBe('true');
        await capture('toggle-radio');

        const inputValue = await input.inputValue();
        await label('input').click();
        await expect
          .poll(() => input.evaluate((element) => element === document.activeElement))
          .toBe(true);
        expect(await input.inputValue()).toBe(inputValue);
        await page.keyboard.press('End');
        await page.keyboard.type(' notes');
        await expect.poll(() => input.inputValue()).toBe(`${inputValue} notes`);
        const textareaValue = await textarea.inputValue();
        await label('textarea').tap();
        await expect
          .poll(() => textarea.evaluate((element) => element === document.activeElement))
          .toBe(true);
        expect(await textarea.inputValue()).toBe(textareaValue);
        // End stops at a wrapped visual line; the append target is the document end.
        await page.keyboard.press('Control+End');
        await page.keyboard.type('!');
        await expect.poll(() => textarea.inputValue()).toBe(`${textareaValue}!`);
        await capture('editors');

        // Label requests the same focus operation for read-only editors; the
        // native editor still owns selection and rejects keyboard editing.
        for (const subject of subjects.filter((item) => item.ref.startsWith('readonly-'))) {
          const editor = content.getByRole(subject.role, { name: subject.name, exact: true });
          const originalValue = await editor.inputValue();
          expect(
            await editor.evaluate(
              (element) => (element as HTMLInputElement | HTMLTextAreaElement).readOnly
            )
          ).toBe(true);
          await label(subject.ref).click();
          await expect
            .poll(() => editor.evaluate((element) => element === document.activeElement))
            .toBe(true);
          expect(await editor.inputValue()).toBe(originalValue);
          // Native Chromium read-only editors support Select All, while Home and
          // Shift+ArrowRight do not move their caret. Preserve a real native range.
          await page.keyboard.press('ControlOrMeta+A');
          expect(
            await editor.evaluate((element) => {
              const native = element as HTMLInputElement | HTMLTextAreaElement;
              return { start: native.selectionStart, end: native.selectionEnd };
            })
          ).toEqual({ start: 0, end: originalValue.length });
          await label(subject.ref).tap();
          await expect
            .poll(() => editor.evaluate((element) => element === document.activeElement))
            .toBe(true);
          expect(
            await editor.evaluate((element) => {
              const native = element as HTMLInputElement | HTMLTextAreaElement;
              return { start: native.selectionStart, end: native.selectionEnd };
            })
          ).toEqual({ start: 0, end: originalValue.length });
          await page.keyboard.type('ignored');
          expect(await editor.inputValue()).toBe(originalValue);
        }
        await capture('readonly-editors');

        const disabled = content.getByRole('checkbox', { name: 'Disabled choice', exact: true });
        await label('disabled').click();
        await label('disabled').tap();
        expect(await disabled.getAttribute('aria-checked')).toBe('false');
        expect(await disabled.getAttribute('aria-disabled')).toBe('true');
        expect(await disabled.evaluate((element) => element === document.activeElement)).toBe(
          false
        );
        await label('controlled').click();
        await expect.poll(() => requests.textContent()).toBe('Requests: 1');
        expect(await controlled.getAttribute('aria-checked')).toBe('false');
        await label('controlled').tap();
        await expect.poll(() => requests.textContent()).toBe('Requests: 2');
        expect(await controlled.getAttribute('aria-checked')).toBe('false');
        await expect
          .poll(() => controlled.evaluate((element) => element === document.activeElement))
          .toBe(true);
        await page.keyboard.press('Space');
        await expect.poll(() => requests.textContent()).toBe('Requests: 3');
        expect(await controlled.getAttribute('aria-checked')).toBe('false');
        await controlled.click();
        await expect.poll(() => requests.textContent()).toBe('Requests: 4');
        expect(await controlled.getAttribute('aria-checked')).toBe('false');
        await label('controlled').click({ modifiers: ['Shift'] });
        await label('controlled').click({ button: 'right' });
        await page.keyboard.press('Escape');
        // Deliberately untrusted negative input; it is never positive native evidence.
        await label('controlled').evaluate((element) => (element as HTMLElement).click());
        expect(await requests.textContent()).toBe('Requests: 4');
        await capture('controlled-disabled');

        await label('passive').click();
        expect(await passive.getAttribute('aria-checked')).toBe('false');
        for (const ref of ['label-passive', 'description']) {
          const subject = content.locator(`[data-demo-ref="${ref}"]`);
          await subject.scrollIntoViewIfNeeded();
          const geometry = await subject.evaluate(measureLabelTextDrag);
          const bounds = { ...geometry.bounds, start: geometry.start, end: geometry.end };
          const trace = await subject.evaluateHandle(recordLabelPointerTrace);
          try {
            await page.mouse.move(geometry.start.x, geometry.start.y);
            await page.mouse.down();
            await page.mouse.move(geometry.end.x, geometry.end.y, { steps: 20 });
            const beforeRelease = await subject.evaluate(observeLabelDescriptionSelection, bounds);
            await page.mouse.up();
            const afterRelease = await subject.evaluate(observeLabelDescriptionSelection, bounds);
            observations[`${ref}-selection`] = { geometry, beforeRelease, afterRelease };
            expect(beforeRelease.selectedLength).toBeGreaterThan(5);
            expect(afterRelease.selected).toBe(beforeRelease.selected);
            expect(afterRelease.anchorWithin && afterRelease.focusWithin).toBe(true);
            expect(await passive.getAttribute('aria-checked')).toBe('false');
            expect(await checkbox.getAttribute('aria-checked')).toBe('true');
            await capture(ref);
          } finally {
            observations[`${ref}-pointer-trace`] = await trace.evaluate((recorder) =>
              recorder.finish()
            );
            await trace.dispose();
          }
        }

        // Dispose/recreate the actual recipe through the reader's runtime control.
        // This checks a real remount, not the complete detach/adoption/AT matrix.
        const alternate = runtime === 'wc' ? 'react' : 'wc';
        await selectRuntime(page, preview, alternate, '[data-demo-ref="label-checkbox"]', 1);
        await selectRuntime(page, preview, runtime, '[data-demo-ref="label-checkbox"]', 1);
        await expect.poll(() => requests.textContent()).toBe('Requests: 0');
        await expect.poll(() => checkbox.getAttribute('aria-checked')).toBe('false');
        expect(await input.inputValue()).toBe('Proto UI');
        expect(await textarea.inputValue()).toBe('Useful content stays selectable');
        await label('checkbox').click();
        await expect.poll(() => checkbox.getAttribute('aria-checked')).toBe('true');
        await label('controlled').click();
        await expect.poll(() => requests.textContent()).toBe('Requests: 1');
        expect(await controlled.getAttribute('aria-checked')).toBe('false');
        expect(errors).toEqual([]);
        await capture('remounted');
      } catch (error) {
        observations.failure =
          error instanceof Error ? { message: error.message, stack: error.stack } : String(error);
        await writeFile(
          path.join(evidenceDir, `${family}-${runtime}.json`),
          JSON.stringify(observations, null, 2)
        );
        try {
          await page.screenshot({
            path: path.join(evidenceDir, `${family}-${runtime}-failure.png`),
            fullPage: true,
          });
        } catch (captureError) {
          throw new AggregateError(
            [error, captureError],
            'Label consumer and failure capture both failed.'
          );
        }
        throw error;
      } finally {
        await context.close();
      }
    },
    180_000
  );
});
