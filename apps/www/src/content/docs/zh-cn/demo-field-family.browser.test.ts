// @vitest-environment node
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { Browser, Locator } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  RUNTIMES,
  applyColorScheme,
  launchBrowser,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';
import {
  fieldControlSelector,
  fieldEditorOwnerRef,
  fieldEditorSelector,
} from './field-browser-oracle';
import {
  createFieldFocusObservation,
  recordFieldFocusSample,
  type FieldFocusSnapshot,
} from './field-focus-observation';
import { createFieldAsyncObservation } from './field-async-observation';
const families = ['base', 'shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'];
let browser: Browser,
  baseUrl = '';
const ref = (previewer: Locator, id: string) => previewer.locator(`.host [data-demo-ref="${id}"]`);
const editor = (previewer: Locator, id: string) =>
  previewer.locator('.host').locator(fieldEditorSelector(id));
const route = (family: string, locale = 'en') => `/${locale}/ui-libraries/${family}/field/`;
async function capture(
  previewer: Locator,
  name: string,
  subject: Record<string, unknown>,
  focusObservation?: ReturnType<typeof createFieldFocusObservation>,
  focusAtFailure?: FieldFocusSnapshot
) {
  const directory =
    process.env.PROTO_UI_FIELD_SCREENSHOT_DIR ??
    (process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
      ? path.join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, 'field')
      : null);
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
  const basename = `${source.slice(0, 12)}-${name}`;
  await previewer.screenshot({
    path: path.join(directory, basename + '.png'),
    style: 'astro-dev-toolbar { visibility: hidden; }',
  });
  const focusSamples = await previewer
    .page()
    .evaluate(() => (window as any).__fieldFocusEvidence ?? [])
    .catch(() => [{ diagnosticError: true }]);
  const focusAtCapture = focusObservation?.snapshot();
  await writeFile(
    path.join(directory, basename + '.json'),
    JSON.stringify(
      {
        sourceSha: source,
        dirtyWorktree: !!dirty.trim(),
        fixture: 'demo-field-family.browser.test.ts',
        ...subject,
        focusObservation: focusObservation
          ? { atFailure: focusAtFailure, atCapture: focusAtCapture, browserSamples: focusSamples }
          : undefined,
        checkedAt: new Date().toISOString(),
        viewport: previewer.page().viewportSize(),
        asyncStatuses: await ref(previewer, 'handleStatus').allTextContents(),
        cancelButtons: await ref(previewer, 'reset').evaluateAll((nodes) =>
          nodes.map((el) => ({
            rect: el.getBoundingClientRect().toJSON(),
            focused: el === document.activeElement,
          }))
        ),
        editors: await previewer.locator('input').evaluateAll((nodes) =>
          nodes.map((n) => ({
            value: (n as HTMLInputElement).value,
            disabled: (n as HTMLInputElement).disabled,
            readOnly: (n as HTMLInputElement).readOnly,
            labelledBy: n.getAttribute('aria-labelledby'),
            describedBy: n.getAttribute('aria-describedby'),
            errorMessage: n.getAttribute('aria-errormessage'),
            invalid: n.getAttribute('aria-invalid'),
            required: n.getAttribute('aria-required'),
            busy: n.getAttribute('aria-busy'),
            rect: n.getBoundingClientRect().toJSON(),
          }))
        ),
        trustedInputs: await previewer
          .page()
          .evaluate(() => (window as any).__fieldInputEvidence ?? []),
        comparison:
          'Same source and subject state across families; no historical screenshot is substituted. Optical and OS AT acceptance are independent.',
      },
      null,
      2
    )
  );
}
beforeAll(async () => {
  baseUrl = await startServer(route('base'));
  browser = await launchBrowser();
}, 120000);
afterAll(async () => {
  await Promise.all([browser?.close(), stopServer()]);
});

it.each(families)('%s default Field stacks feedback above the Save and Reset row', async (family) => {
  const { context, page } = await openRoute(browser, baseUrl, route(family), {
    width: 1100,
    height: 1000,
  });
  try {
    const preview = page.locator(`[data-previewer-id][data-demo-id="demo-${family}-field"]`);
    await selectRuntime(page, preview, 'wc', fieldEditorSelector('handle'), 1);
    const host = preview.locator('.host');
    const handle = editor(preview, 'handle');
    const username = editor(preview, 'username');
    const save = host.getByRole('button', { name: 'Save changes', exact: true });
    const reset = host.getByRole('button', { name: 'Reset validation', exact: true });
    const status = ref(preview, 'handleStatus');
    await handle.fill('taken');
    await save.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => username.getAttribute('aria-invalid')).toBe('true');
    await expect.poll(() => status.textContent()).toBe('Handle unavailable');
    await expect.poll(() => handle.getAttribute('aria-invalid')).toBe('true');

    const visibleBox = async (part: Locator) => {
      const box = await part.boundingBox();
      if (!box || box.width <= 0 || box.height <= 0) throw new Error(`Missing visible ${part}`);
      return box;
    };
    const [saveBox, resetBox] = await Promise.all([visibleBox(save), visibleBox(reset)]);
    const column = [ref(preview, 'handleLabel'), handle, ref(preview, 'handleDescription'),
      ref(preview, 'handleError'), status];
    let bottom = -Infinity;
    for (const box of await Promise.all(column.map(visibleBox))) {
      expect(box.y).toBeGreaterThanOrEqual(bottom - 1);
      bottom = box.y + box.height;
    }
    expect(Math.min(saveBox.y, resetBox.y)).toBeGreaterThanOrEqual(bottom - 1);
    expect(resetBox.x).toBeGreaterThanOrEqual(saveBox.x + saveBox.width - 1);
    expect(Math.max(saveBox.y, resetBox.y)).toBeLessThan(
      Math.min(saveBox.y + saveBox.height, resetBox.y + resetBox.height)
    );

    await page.keyboard.press('Tab');
    expect(await reset.evaluate((el) => el.matches(':focus'))).toBe(true);
    await page.keyboard.press('Space');
    await expect.poll(() => status.textContent()).toBe('Handle ready');
    await expect.poll(() => username.getAttribute('aria-invalid')).toBe('false');
    await expect.poll(() => handle.getAttribute('aria-invalid')).toBe('false');
    expect(await handle.getAttribute('aria-errormessage')).toBeNull();
    expect(await handle.inputValue()).toBe('taken');
  } finally {
    await context.close();
  }
}, 120_000);

describe('Field real browser journeys', () => {
  for (const family of families)
    for (const runtime of RUNTIMES)
      it(`${family} ${runtime} labels, native editing, validity lease, focus and screenshots`, async () => {
        const {
          context,
          page,
          previewer: mountedPreviewer,
        } = await openRoute(browser, baseUrl, route(family), { width: 1100, height: 1000 });
        let previewer: Locator | undefined;
        const focusObservation = createFieldFocusObservation();
        const asyncObservation =
          family === 'liquid-glass' && runtime !== 'wc'
            ? createFieldAsyncObservation(browser, page, `${family}-${runtime}`)
            : undefined;
        try {
          previewer = mountedPreviewer;
          await selectRuntime(page, previewer, runtime, 'input', 4);
          for (const id of ['username', 'handle', 'email', 'plan']) {
            await expect
              .poll(() => previewer!.locator('.host').locator(fieldControlSelector(id)).count())
              .toBe(1);
            await expect.poll(() => editor(previewer!, id).count()).toBe(1);
            expect(await editor(previewer, id).evaluate(fieldEditorOwnerRef)).toBe(`${id}Control`);
          }
          await page.evaluate(() => {
            (window as any).__fieldInputEvidence = [];
            try {
              (window as any).__fieldFocusEvidence = [];
            } catch {
              // A diagnostic sidecar cannot prevent the original event recorder.
            }
            for (const type of [
              'pointerdown',
              'pointerup',
              'pointercancel',
              'click',
              'keydown',
              'input',
              'change',
              'focusin',
              'focusout',
              'validationRequest',
              'validityChange',
            ])
              document.addEventListener(
                type,
                (event) => {
                  const path = event
                    .composedPath()
                    .filter((node): node is Element => node instanceof Element);
                  const previewer = path.find((node) => node.hasAttribute('data-previewer-id'));
                  if (!previewer) return;
                  const handleOwner = previewer.querySelector('[data-demo-ref="handleControl"]');
                  const input = handleOwner?.matches('input')
                    ? handleOwner
                    : handleOwner?.querySelector('input');
                  const reset = previewer.querySelector('[data-demo-ref="reset"]');
                  const inspectGeometry = [
                    'pointerdown',
                    'pointerup',
                    'click',
                    'change',
                    'validationRequest',
                  ].includes(event.type);
                  const pointer = event instanceof MouseEvent ? event : null;
                  const hit = pointer
                    ? document.elementFromPoint(pointer.clientX, pointer.clientY)
                    : null;
                  (window as any).__fieldInputEvidence.push({
                    type: event.type,
                    at: performance.now(),
                    trusted: event.isTrusted,
                    custom: event instanceof CustomEvent,
                    key: (event as KeyboardEvent).key ?? null,
                    refs: path.map((node) => node.getAttribute('data-demo-ref')).filter(Boolean),
                    requestId:
                      event.type === 'validationRequest'
                        ? (event as CustomEvent).detail?.requestId
                        : null,
                    asyncStatus: previewer.querySelector('[data-demo-ref="handleStatus"]')
                      ?.textContent,
                    asyncValue: (input as HTMLInputElement | null)?.value,
                    asyncInvalid: input?.getAttribute('aria-invalid'),
                    asyncBusy: input?.getAttribute('aria-busy'),
                    // Instantaneous geometry distinguishes a moving target
                    // from an activated command whose validation lease failed.
                    cancelRect: inspectGeometry
                      ? (reset?.getBoundingClientRect().toJSON() ?? null)
                      : null,
                    pointer: pointer ? { x: pointer.clientX, y: pointer.clientY } : null,
                    hitRef: hit?.closest('[data-demo-ref]')?.getAttribute('data-demo-ref') ?? null,
                    hitInsideCancel: hit && reset ? reset.contains(hit) : null,
                    cancelInPath: !!reset && path.includes(reset),
                  });
                },
                { capture: true }
              );
          });
          const input = editor(previewer, 'username');
          expect(await input.getAttribute('aria-labelledby')).toBe(
            await ref(previewer, 'usernameLabel').getAttribute('id')
          );
          expect(await input.getAttribute('aria-describedby')).toBe(
            await ref(previewer, 'usernameDescription').getAttribute('id')
          );
          await ref(previewer, 'usernameLabel').click();
          await expect
            .poll(() =>
              focusObservation.observe((attempt) =>
                input.evaluateAll(recordFieldFocusSample, attempt)
              )
            )
            .toBe(true);
          await page.keyboard.press('Tab');
          await expect.poll(() => input.getAttribute('aria-invalid')).toBe('true');
          expect(await input.getAttribute('aria-errormessage')).toBe(
            await ref(previewer, 'usernameError').getAttribute('id')
          );
          await input.fill('Ada');
          await page.keyboard.press('Tab');
          await expect.poll(() => input.getAttribute('aria-invalid')).toBe('false');
          expect(await input.getAttribute('aria-errormessage')).toBeNull();
          expect(await editor(previewer, 'email').isEditable()).toBe(false);
          expect(await editor(previewer, 'email').isDisabled()).toBe(false);
          expect(await editor(previewer, 'plan').isDisabled()).toBe(true);
          if (asyncObservation) await asyncObservation.start();
          await editor(previewer, 'handle').fill('taken');
          await expect
            .poll(() => editor(previewer!, 'handle').getAttribute('aria-busy'))
            .toBe('true');
          await editor(previewer, 'handle').fill('newer');
          await expect
            .poll(() =>
              asyncObservation
                ? asyncObservation.observe(() => ref(previewer!, 'handleStatus').textContent())
                : ref(previewer!, 'handleStatus').textContent()
            )
            .toContain('Handle available');
          expect(await editor(previewer, 'handle').getAttribute('aria-invalid')).toBe('false');
          await editor(previewer, 'handle').fill('taken');
          await ref(previewer, 'reset').click();
          // Distinguish a command that never arrived from a retired lease that
          // later changed. The original post-reply assertions remain below.
          await expect
            .poll(() => ref(previewer!, 'handleStatus').textContent())
            .toContain('Handle ready');
          await page.waitForTimeout(650);
          expect(await ref(previewer, 'handleStatus').textContent()).toContain('Handle ready');
          expect(await editor(previewer, 'handle').getAttribute('aria-invalid')).toBe('false');
          await capture(
            previewer,
            `${family}-${runtime}-light`,
            { family, runtime, state: 'light-valid-and-owner-invalid' },
            focusObservation
          );
          await applyColorScheme(page, 'dark');
          await page.setViewportSize({ width: 390, height: 1000 });
          await page.evaluate(() => (document.documentElement.style.fontSize = '32px'));
          const geometry = await ref(previewer, 'handleRoot').evaluate((el) => ({
            width: el.getBoundingClientRect().width,
            scroll: el.scrollWidth,
            client: el.clientWidth,
          }));
          expect(geometry.scroll).toBeLessThanOrEqual(geometry.client + 2);
          await capture(
            previewer,
            `${family}-${runtime}-dark-narrow-200`,
            { family, runtime, state: 'dark-narrow-200-percent' },
            focusObservation
          );
          const evidence = await page.evaluate(() => (window as any).__fieldInputEvidence);
          expect(evidence.some((e: any) => e.type === 'keydown' && e.trusted)).toBe(true);
          expect(evidence.some((e: any) => e.type === 'input' && e.trusted)).toBe(true);
        } catch (error) {
          asyncObservation?.markFailure(error);
          let focusAtFailure: FieldFocusSnapshot | undefined;
          // Retain the Node-side deadline boundary even if the browser cannot
          // complete the existing screenshot/evidence capture.
          try {
            focusAtFailure = focusObservation.snapshot();
            console.info(
              '[Field focus diagnostic]',
              JSON.stringify({ family, runtime, atFailure: focusAtFailure })
            );
          } catch {
            // A diagnostic logger cannot replace the original journey error.
          }
          if (previewer)
            await capture(
              previewer,
              `${family}-${runtime}-failure`,
              { family, runtime, state: 'failure', error: String(error) },
              focusObservation,
              focusAtFailure
            ).catch((captureError) => {
              console.error('[Field evidence] failure capture also failed:', captureError);
            });
          throw error;
        } finally {
          if (asyncObservation)
            await asyncObservation.finish().catch((error) => {
              console.error('[Field async diagnostic]', error);
            });
          await context.close();
        }
      }, 120000);
  for (const family of families)
    it(`${family} Chinese public route consumes the same six atoms`, async () => {
      const { context, page, previewer } = await openRoute(
        browser,
        baseUrl,
        route(family, 'zh-cn'),
        { width: 1100, height: 1000 }
      );
      try {
        await selectRuntime(page, previewer, 'wc', 'input', 4);
        expect(await previewer.locator('.host input').count()).toBe(4);
        expect(await ref(previewer, 'usernameLabel').textContent()).toContain('Username');
      } finally {
        await context.close();
      }
    }, 120000);
});

async function waitForDefaultWc(preview: Locator) {
  await preview.scrollIntoViewIfNeeded();
  await expect.poll(() => preview.evaluate((element) => {
    const root = element as HTMLElement & { __previewer__?: { getCurrentRuntime(): string | null } };
    return root.__previewer__?.getCurrentRuntime();
  })).toBe('wc');
}

it('Brutalist contact Cancel clears validation while retaining the edited name', async () => {
  const { context, page } = await openRoute(browser, baseUrl, route('brutalist'), {
    width: 1100,
    height: 1000,
  });
  try {
    const preview = page.locator('[data-previewer-id][data-demo-id="demo-brutalist-field-contact"]');
    await waitForDefaultWc(preview);
    const name = editor(preview, 'contactName');
    const email = editor(preview, 'contactEmail');
    const message = preview.locator('.host textarea');
    const send = preview.getByRole('button', { name: 'Send message', exact: true });
    const cancel = preview.getByRole('button', { name: 'Cancel', exact: true });
    await name.fill('Ada');
    await send.click();
    const invalidFields = [[email, 'contactEmailError'], [message, 'contactMsgError']] as const;
    for (const [control, errorRef] of invalidFields) {
      await expect.poll(() => control.getAttribute('aria-invalid')).toBe('true');
      const error = ref(preview, errorRef);
      await error.waitFor({ state: 'visible' });
      const id = await error.getAttribute('id');
      expect(id).toBeTruthy();
      expect(await control.getAttribute('aria-errormessage')).toBe(id);
    }
    await send.focus();
    await page.keyboard.press('Tab');
    expect(await cancel.evaluate((el) => el.matches(':focus'))).toBe(true);
    await page.keyboard.press('Space');
    for (const control of [email, message]) {
      await expect.poll(() => control.getAttribute('aria-invalid')).toBe('false');
      expect(await control.getAttribute('aria-errormessage')).toBeNull();
    }
    expect(await name.inputValue()).toBe('Ada');
  } finally {
    await context.close();
  }
}, 120_000);

it('Base Form Cancel submit retires the submission while its field reply can still land', async () => {
  const { context, page } = await openRoute(browser, baseUrl, '/en/ui-libraries/base/form/', {
    width: 1100,
    height: 1000,
  });
  try {
    const preview = page.locator('[data-previewer-id][data-demo-id="demo-base-form-validation"]');
    await waitForDefaultWc(preview);
    const host = preview.locator('.host');
    const form = host.getByRole('form', { name: 'Account validation form', exact: true });
    const submit = form.getByRole('button', { name: 'Submit', exact: true });
    const cancel = host.getByRole('button', { name: 'Cancel submit', exact: true });
    const approve = host.getByRole('button', { name: 'Approve', exact: true });
    const account = editor(preview, 'account');
    const status = ref(preview, 'submissionStatus');
    await account.fill('lin');
    await submit.click();
    await expect.poll(() => form.getAttribute('aria-busy')).toBe('true');
    expect(await account.getAttribute('aria-busy')).toBe('true');
    expect(await status.textContent()).toBe('Not submitted yet.');
    await cancel.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => status.textContent()).toBe('Submission canceled.');
    expect(await form.getAttribute('aria-busy')).not.toBe('true');
    expect(await account.getAttribute('aria-busy')).toBe('true');
    await approve.click();
    await expect.poll(() => ref(preview, 'validatorStatus').textContent())
      .toBe('Accepted success for "lin"');
    expect(await account.getAttribute('aria-busy')).not.toBe('true');
    expect(await account.inputValue()).toBe('lin');
    expect(await status.textContent()).toBe('Submission canceled.');

    await submit.click();
    await expect.poll(() => form.getAttribute('aria-busy')).toBe('true');
    await approve.click();
    await expect.poll(() => status.textContent()).toMatch(/^Submitted \(#1\): /);
    const payload = (await status.textContent())!.slice('Submitted (#1): '.length);
    expect(JSON.parse(payload)).toMatchObject({ account: 'lin' });
  } finally {
    await context.close();
  }
}, 120_000);
