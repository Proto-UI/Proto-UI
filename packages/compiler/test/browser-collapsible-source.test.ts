// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Locator, Page } from '../../../apps/www/node_modules/playwright-core/types/types';
import { startBrowserFixture, type BrowserFixture } from './browser-fixture';
import {
  COLLAPSIBLE_COMPONENT_NAME,
  COLLAPSIBLE_PARTS,
  COLLAPSIBLE_PROFILE,
  compileCollapsibleProject,
  type CollapsibleProject,
} from './collapsible-project';

const repository = fileURLToPath(new URL('../../../', import.meta.url));
const viewport = { width: 900, height: 720 };
const hash = (relative: string): string =>
  createHash('sha256').update(readFileSync(path.join(repository, relative))).digest('hex');

interface OpenChange {
  open: boolean;
  reason: string;
}

/** The published fixture surface; the page owns the only Collapsible probe contract. */
interface CollapsibleProbe {
  ready(): boolean;
  read(): { requests: OpenChange[]; pending: OpenChange | null; controlledOpen: boolean };
  unmount(): void;
  evidence(): Record<string, unknown>;
}

type CaseObservation = {
  expanded: string | null;
  controls: string | null;
  disabled: string | null;
  triggerFocused: boolean;
  contentCount: number;
  contentId: string | null;
  contentRole: string | null;
  contentTabIndex: number | null;
  contentAriaHidden: string | null;
  contentDisplay: string | null;
  contentVisible: boolean;
  contentTokens: string | null;
};

type Checkpoint = { step: string; cases: Record<string, CaseObservation> };

let fixture: BrowserFixture;
let project: CollapsibleProject;

beforeAll(async () => {
  project = await compileCollapsibleProject();
  process.env.COMPILER_COLLAPSIBLE_MANIFEST = project.manifestPath;
  fixture = await startBrowserFixture('collapsible');
}, 240_000);

afterAll(async () => {
  await fixture?.close();
  delete process.env.COMPILER_COLLAPSIBLE_MANIFEST;
  await project?.remove();
}, 60_000);

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => {
    const { promise, resolve } = Promise.withResolvers<void>();
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    return promise;
  });
}

async function observe(page: Page, name: string): Promise<CaseObservation> {
  return page.evaluate((caseName) => {
    const section = document.querySelector(`[data-collapsible-case="${caseName}"]`);
    if (!section) throw new Error(`Missing Collapsible case: ${caseName}`);
    const roots = Array.from(section.querySelectorAll('[data-pui-root]'));
    const trigger =
      roots.find((node) => node.getAttribute('role') === 'button' || node.tagName === 'BUTTON') ??
      section.querySelector('[role="button"], button');
    const contents = roots.filter(
      (node) => node !== trigger && !node.hasAttribute('data-pui-view-detached')
    );
    const content = contents[0] ?? null;
    return {
      expanded: trigger?.getAttribute('aria-expanded') ?? null,
      controls: trigger?.getAttribute('aria-controls') ?? null,
      disabled: trigger?.getAttribute('aria-disabled') ?? null,
      triggerFocused: trigger instanceof HTMLElement && document.activeElement === trigger,
      contentCount: contents.length,
      contentId: content?.getAttribute('id') ?? null,
      contentRole: content?.getAttribute('role') ?? null,
      contentTabIndex: content instanceof HTMLElement ? content.tabIndex : null,
      contentAriaHidden: content?.getAttribute('aria-hidden') ?? null,
      contentDisplay: content instanceof HTMLElement ? getComputedStyle(content).display : null,
      contentVisible: content instanceof HTMLElement ? content.getClientRects().length > 0 : false,
      contentTokens: content?.getAttribute('data-pui-style') ?? null,
    };
  }, name);
}

async function expanded(trigger: Locator, value: boolean): Promise<void> {
  await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe(String(value));
}

async function focused(locator: Locator): Promise<void> {
  await expect
    .poll(() => locator.evaluate((node) => document.activeElement === node))
    .toBe(true);
}

async function checkpoint(
  page: Page,
  step: string,
  checkpoints: Checkpoint[]
): Promise<Record<string, CaseObservation>> {
  const cases: Record<string, CaseObservation> = {};
  for (const name of ['uncontrolled', 'retained', 'disabled', 'controlled'])
    cases[name] = await observe(page, name);
  checkpoints.push({ step, cases });
  return cases;
}

describe.sequential('compiled Shadcn Collapsible in real React DOM', () => {
  it('mounts the unchanged parts and keeps disclosure ownership through native input and view lifetimes', async () => {
    const context = await fixture.browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors: string[] = [];
    const checkpoints: Checkpoint[] = [];
    let outcome = 'failed';
    let failure: string | null = null;
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) errors.push(message.text());
    });
    const uncontrolled = page.locator('[data-collapsible-case="uncontrolled"]');
    const retained = page.locator('[data-collapsible-case="retained"]');
    const disabled = page.locator('[data-collapsible-case="disabled"]');
    const controlled = page.locator('[data-collapsible-case="controlled"]');
    const owner = page.locator('[data-collapsible-case="owner"]');
    const uncontrolledTrigger = uncontrolled.getByRole('button', { includeHidden: true });
    const retainedTrigger = retained.getByRole('button', { includeHidden: true });
    const disabledTrigger = disabled.getByRole('button', { includeHidden: true });
    const controlledTrigger = controlled.getByRole('button', { includeHidden: true });
    try {
      await page.goto(`${fixture.baseUrl}/collapsible.html`);
      await page.waitForFunction(
        () =>
          (window as Window & { collapsibleProbe?: CollapsibleProbe }).collapsibleProbe?.ready() ===
          true
      );
      await settle(page);

      // The closed default has no Content host view and no dangling IDREF.
      const initial = await checkpoint(page, 'initial', checkpoints);
      expect(initial.uncontrolled.expanded).toBe('false');
      expect(initial.uncontrolled.contentCount).toBe(0);
      expect(initial.uncontrolled.controls).toBeNull();
      expect(initial.retained.expanded).toBe('true');
      expect(initial.disabled.expanded).toBe('true');
      expect(initial.disabled.disabled).toBe('true');
      expect(initial.controlled.expanded).toBe('false');
      expect(initial.controlled.contentCount).toBe(0);
      expect(initial.controlled.controls).toBeNull();
      await page.screenshot({
        path: path.join(fixture.evidenceDir, 'collapsible-initial.png'),
        fullPage: true,
      });

      // Pointer activation focuses the Trigger, never the role-neutral Content.
      await uncontrolledTrigger.click();
      await expanded(uncontrolledTrigger, true);
      await expect.poll(async () => (await observe(page, 'uncontrolled')).contentVisible).toBe(true);
      const opened = await checkpoint(page, 'open', checkpoints);
      expect(opened.uncontrolled.contentId).toBeTruthy();
      expect(opened.uncontrolled.controls).toBe(opened.uncontrolled.contentId);
      expect(opened.uncontrolled.contentRole).toBeNull();
      expect(opened.uncontrolled.contentTabIndex).toBe(-1);
      await focused(uncontrolledTrigger);
      await page.screenshot({
        path: path.join(fixture.evidenceDir, 'collapsible-open.png'),
        fullPage: true,
      });

      // A focused Space closes once and cannot scroll the page.
      const scrollY = await page.evaluate(() => window.scrollY);
      await page.keyboard.press('Space');
      await expanded(uncontrolledTrigger, false);
      const closed = await checkpoint(page, 'closed', checkpoints);
      expect(closed.uncontrolled.contentCount).toBe(0);
      expect(closed.uncontrolled.controls).toBeNull();
      expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
      await focused(uncontrolledTrigger);
      await page.screenshot({
        path: path.join(fixture.evidenceDir, 'collapsible-closed.png'),
        fullPage: true,
      });

      // Repeated activation rematerializes the same logical Content reservation.
      const identity = opened.uncontrolled.contentId;
      for (let cycle = 0; cycle < 2; cycle += 1) {
        await page.keyboard.press('Enter');
        await expanded(uncontrolledTrigger, true);
        const reopened = await checkpoint(page, `enter-open-${cycle}`, checkpoints);
        expect(reopened.uncontrolled.contentId).toBe(identity);
        await focused(uncontrolledTrigger);
        await page.keyboard.press('Enter');
        await expanded(uncontrolledTrigger, false);
        const reclosed = await checkpoint(page, `enter-close-${cycle}`, checkpoints);
        expect(reclosed.uncontrolled.contentCount).toBe(0);
        expect(reclosed.uncontrolled.controls).toBeNull();
      }

      // Natural Tab follows the authored order; the retained Content stays mounted.
      await page.keyboard.press('Tab');
      await focused(retainedTrigger);
      const retainedIdentity = (await observe(page, 'retained')).contentId;
      const retainedView = await retained.locator('[data-pui-root]:not([role="button"])').elementHandle();
      expect(retainedView).not.toBeNull();
      await page.keyboard.press('Space');
      await expanded(retainedTrigger, false);
      const retainedHidden = await checkpoint(page, 'retained-hidden', checkpoints);
      expect(retainedHidden.retained.contentCount).toBe(1);
      expect(retainedHidden.retained.contentId).toBe(retainedIdentity);
      expect(retainedHidden.retained.contentAriaHidden).toBe('true');
      expect(retainedHidden.retained.contentDisplay).toBe('none');
      expect(await retainedView!.evaluate((view) => view.isConnected)).toBe(true);
      expect(await retainedView!.evaluate((view) =>
        view === document.querySelector('[data-collapsible-case="retained"] [data-pui-root]:not([role="button"])')
      )).toBe(true);
      await page.screenshot({
        path: path.join(fixture.evidenceDir, 'collapsible-retained-hidden.png'),
        fullPage: true,
      });

      // The disabled-but-open disclosure is skipped, not forcibly closed.
      await page.keyboard.press('Tab');
      await focused(controlledTrigger);
      const skipped = await checkpoint(page, 'disabled-skipped', checkpoints);
      expect(skipped.disabled.expanded).toBe('true');
      expect(skipped.disabled.contentVisible).toBe(true);
      expect(await disabledTrigger.getAttribute('aria-disabled')).toBe('true');
      const disabledTabIndex = await disabledTrigger.evaluate(
        (node) => (node as HTMLElement).tabIndex
      );
      expect(disabledTabIndex).toBe(-1);

      // An ignored controlled request cannot optimistically open any part.
      await page.keyboard.press('Enter');
      await expanded(controlledTrigger, false);
      const requested = await checkpoint(page, 'controlled-requested', checkpoints);
      expect(requested.controlled.contentCount).toBe(0);
      expect(requested.controlled.controls).toBeNull();
      const probe = await page.evaluate(() => {
        const published = (window as Window & { collapsibleProbe: CollapsibleProbe })
          .collapsibleProbe;
        return published.read();
      });
      expect(probe.requests).toHaveLength(1);
      expect(probe.pending).toEqual({ open: true, reason: 'keyboard' });
      expect(probe.controlledOpen).toBe(false);
      await page.screenshot({
        path: path.join(fixture.evidenceDir, 'collapsible-controlled-requested.png'),
        fullPage: true,
      });

      // The owner accepts the pending request; the disclosure then opens.
      const accept = owner.getByRole('button', { name: 'Accept', exact: true });
      await page.keyboard.press('Tab');
      await focused(accept);
      await page.keyboard.press('Enter');
      await expanded(controlledTrigger, true);
      await expect.poll(async () => (await observe(page, 'controlled')).contentVisible).toBe(true);
      const accepted = await checkpoint(page, 'controlled-accepted', checkpoints);
      expect(accepted.controlled.contentId).toBeTruthy();
      expect(accepted.controlled.controls).toBe(accepted.controlled.contentId);
      expect(accepted.controlled.contentId).not.toBe(retainedIdentity);
      expect(accepted.controlled.contentId).not.toBe(accepted.disabled.contentId);
      await page.screenshot({
        path: path.join(fixture.evidenceDir, 'collapsible-controlled-accepted.png'),
        fullPage: true,
      });

      // Changing the actual renderer terminally removes the old host views.
      const oldViews = await page.locator('[data-pui-root]').elementHandles();
      expect(oldViews.length).toBeGreaterThan(0);
      await page.evaluate(() => {
        const published = (window as Window & { collapsibleProbe: CollapsibleProbe })
          .collapsibleProbe;
        published.unmount();
      });
      await settle(page);
      const connections = await page.evaluate(
        (views) => views.map((view) => view.isConnected),
        oldViews
      );
      expect(connections).toEqual(oldViews.map(() => false));
      await page.screenshot({
        path: path.join(fixture.evidenceDir, 'collapsible-terminal-unmount.png'),
        fullPage: true,
      });
      expect(errors).toEqual([]);
      outcome = 'passed';
    } catch (error) {
      failure = error instanceof Error ? error.stack ?? error.message : String(error);
      throw error;
    } finally {
      await writeFile(
        path.join(fixture.evidenceDir, 'collapsible-journey.json'),
        `${JSON.stringify(
          {
            outcome,
            failure,
            sourceRevision: project.manifest.sourceRevision,
            originalSources: project.manifest.originalSources,
            publishedArtifacts: project.manifest.publishedArtifacts,
            browser: fixture.browser.version(),
            node: process.version,
            viewport,
            deviceScaleFactor: 1,
            profile: COLLAPSIBLE_PROFILE,
            componentName: COLLAPSIBLE_COMPONENT_NAME,
            entries: COLLAPSIBLE_PARTS,
            compilation: project?.manifest?.compilation ?? [],
            projectIdentity: project?.manifest?.projectIdentity ?? null,
            checkpoints,
            errors,
          },
          null,
          2
        )}\n`
      );
      await context.close();
    }
  }, 240_000);

  it('records the source-bound replay identity of the compiled Collapsible project', async () => {
    const inputs = [
      ...Object.values(COLLAPSIBLE_PARTS),
      'packages/prototypes/base/src/collapsible/root.proto.ts',
      'packages/prototypes/base/src/collapsible/trigger.proto.ts',
      'packages/prototypes/base/src/collapsible/content.proto.ts',
      'packages/prototypes/base/src/collapsible/shared.ts',
      'packages/compiler/src/project.ts',
      'packages/compiler/src/project-output.ts',
      'packages/compiler/src/compile.ts',
      'packages/compiler/test/collapsible-project.ts',
      'packages/compiler/test/browser-collapsible-source.test.ts',
      'packages/compiler/test/fixtures/differential-browser/collapsible.ts',
      'packages/compiler/test/fixtures/differential-browser/collapsible.html',
      'packages/compiler/test/fixtures/differential-browser/collapsible.css',
      'packages/compiler/test/fixtures/differential-browser/vite.config.ts',
    ];
    await writeFile(
      path.join(fixture.evidenceDir, 'collapsible-replay.json'),
      `${JSON.stringify(
        {
          declaredRevision: process.env.GITHUB_SHA ?? null,
          sourceRevision: project.manifest.sourceRevision,
          originalSources: project.manifest.originalSources,
          publishedArtifacts: project.manifest.publishedArtifacts,
          revisionExplanation:
            'A declared revision is not an actual-tree identity; file hashes and generated/supporting source hashes capture the executed local inputs.',
          browser: fixture.browser.version(),
          node: process.version,
          viewport,
          profile: COLLAPSIBLE_PROFILE,
          componentName: COLLAPSIBLE_COMPONENT_NAME,
          projectIdentity: project.manifest.projectIdentity,
          generated: project.manifest.compilation.map((entry) => ({
            entry: entry.entry,
            generatedFile: entry.generatedFile,
            generatedSha256: entry.generatedSha256,
            supportingFiles: entry.supportingFiles,
          })),
          files: inputs.map((file) => ({ file, sha256: hash(file) })),
        },
        null,
        2
      )}\n`
    );
    expect(project.manifest.compilation).toHaveLength(Object.keys(COLLAPSIBLE_PARTS).length);
    expect(
      project.manifest.compilation.every((entry) => entry.profile === project.manifest.profile)
    ).toBe(true);
  }, 60_000);
});
