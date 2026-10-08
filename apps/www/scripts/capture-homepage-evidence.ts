/**
 * Actual-browser evidence, not a screenshot mockup. Run this candidate-owned
 * script with cwd set to either clean checkout so both revisions use one probe.
 * Browser input is Playwright's real keyboard/pointer input. DOM evaluation is
 * read-only, except scrollTo(0, 0) to normalize capture framing.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { Browser, Page, Locator } from 'playwright-core';
import { launchBrowser, startServer, stopServer } from '../src/content/docs/zh-cn/browser-harness';
import {
  DOCUMENTATION_VARIANTS,
  HOMEPAGE_KEYBOARD_TRANSITION,
  HOMEPAGE_POINTER_RUNTIME_SEQUENCE,
  HOMEPAGE_ROUTES,
  HOMEPAGE_VIEWPORTS,
  layoutFailures,
  classifyCapturedFailure,
  verifyRevision,
} from './homepage-evidence-contract';
import { revealHeaderPreferences } from '../src/content/docs/zh-cn/site-header-browser';
import { captureDocumentationEvidence } from './capture-documentation-evidence';

const { values } = parseArgs({
  options: {
    'revision-kind': { type: 'string' },
    'expected-revision': { type: 'string' },
    out: { type: 'string' },
  },
});
const revisionKind = values['revision-kind'];
assert.ok(
  revisionKind === 'baseline' || revisionKind === 'candidate',
  '--revision-kind must be baseline or candidate'
);
assert.ok(values.out && values['expected-revision'], '--out and --expected-revision are required');
assert.ok(
  !process.env.PROTO_UI_BROWSER_BASE_URL,
  'External servers cannot prove checkout provenance; unset PROTO_UI_BROWSER_BASE_URL'
);
const out = path.resolve(values.out);
await mkdir(out, { recursive: true });
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const revision = git('rev-parse', 'HEAD');
const status = git('status', '--porcelain', '--untracked-files=all');
verifyRevision(revision, values['expected-revision'], status);
const scriptPath = fileURLToPath(import.meta.url);
const scriptRevision = execFileSync('git', ['-C', path.dirname(scriptPath), 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim();
const scriptSha256 = createHash('sha256')
  .update(await readFile(scriptPath))
  .digest('hex');
const report: Record<string, unknown> & {
  cases: Array<Record<string, unknown>>;
  failures: string[];
} = {
  schemaVersion: 1,
  revisionKind,
  revision,
  scriptRevision,
  scriptSha256,
  startedAt: new Date().toISOString(),
  nodeVersion: process.version,
  platform: process.platform,
  browserContext: { deviceScaleFactor: 1, reducedMotion: 'reduce', freshStoragePerCase: true },
  renderer: {
    mode: 'Astro dev server',
    developerToolbar:
      process.env.PROTO_UI_EVIDENCE_TOOLBAR ?? 'default project preference; toolbar may be visible',
  },
  github: {
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    repository: process.env.GITHUB_REPOSITORY,
  },
  procedure:
    'Real Chromium, clean checkout, shared docs dev-server harness, real pointer/keyboard selection, passive input observation; no visual-state injection',
  scope:
    'Two localized homepages and Base Toggle / Shadcn Radio Group / Brutalist Tooltip docs, desktop/mobile, light/dark; actual controls, ownership, computed/platform fonts and overflow',
  limitations: [
    'Chromium only; screenshots require visual review',
    'No claim of complete assistive-technology or browser-engine parity',
    'Failure, stale-candidate and disposal behavior are outside this capture probe; consult separate runtime regression results',
  ],
  cases: [],
  failures: [],
};
const saveReport = () =>
  writeFile(path.join(out, 'metrics.json'), `${JSON.stringify(report, null, 2)}\n`);
await saveReport();

const HOME =
  revisionKind === 'candidate'
    ? '[data-home-showcase="website-component-gallery"]'
    : '[data-home-demo-options]';
const RUNTIME_LABELS = { wc: 'Web Components', react: 'React', vue: 'Vue', vue2: 'Vue 2' } as const;
type Runtime = keyof typeof RUNTIME_LABELS;
const commonFontSelectors = [
  { name: 'html', selector: 'html' },
  { name: 'body', selector: 'body' },
  { name: 'heading', selector: 'h1' },
  { name: 'tagline', selector: '.homepage-hero__tagline, h1[data-page-title] + div' },
  {
    name: 'hero-action',
    selector: '.homepage-hero [data-homepage-mount] a[href], section:has(h1) a[data-slot="button"]',
  },
  {
    name: 'header-brand',
    selector: '[data-homepage-runtime] [data-home-brand], header a[href]',
  },
  {
    name: 'runtime-control',
    selector:
      '[data-homepage-runtime] [data-projection-control="runtime"] [role="combobox"], [data-home-demo-options] [data-projection-control="runtime"] [role="combobox"]',
  },
];
// The same candidate-owned probe must still sample the immutable picker baseline.
const baselineFontSelectors = [
  {
    name: 'component-control',
    selector: '[data-home-demo-options] [data-projection-control="component"] [role="combobox"]',
  },
  { name: 'definition-label', selector: '.home-demo-previewer__meta-label' },
  { name: 'preview-intro-title', selector: '.home-demo-previewer__intro-title' },
  { name: 'preview-caption', selector: '.home-demo-previewer__description' },
  { name: 'research-lead', selector: '.home-demo-previewer__research-lead' },
  { name: 'demo', selector: '[data-home-demo-host] [data-projection-content] [data-pui-root]' },
];
const candidateFontSelectors = [
  { name: 'task-preview-title', selector: `${HOME} .home-gallery__title` },
  {
    name: 'task-result-title',
    selector: `${HOME} .home-gallery__choice [data-projection-prototype$="-label-root"]`,
  },
  { name: 'task-result-detail', selector: `${HOME} .home-gallery__caption` },
  {
    name: 'task-note-control',
    selector: `${HOME} textarea[data-demo-ref="settings-note"], ${HOME} [data-demo-ref="settings-note"] > textarea`,
  },
  {
    name: 'library-control',
    selector: `[data-homepage-runtime] [data-projection-generation-state="active"] [data-projection-control="family"] [role="combobox"], ${HOME} [data-projection-control="family"] [role="combobox"]`,
  },
  {
    name: 'task-title',
    selector: `${HOME} [data-gallery-demo="preferences"] .home-gallery__title`,
  },
  {
    name: 'task-view-label',
    selector: `${HOME} .home-settings__preferences .home-settings__field .home-settings__label`,
  },
  {
    name: 'task-summary-label',
    selector: `${HOME} .home-settings__switch-row .home-settings__label`,
  },
  {
    name: 'task-note-label',
    selector: `${HOME} .home-settings__fields > .home-settings__field > .home-settings__label`,
  },
  { name: 'task-view-control', selector: `${HOME} [data-demo-ref="settings-view-trigger"]` },
  { name: 'task-save-action', selector: `${HOME} [data-demo-ref="settings-save"]` },
  { name: 'task-reset-action', selector: `${HOME} [data-demo-ref="settings-reset"]` },
  { name: 'task-feedback', selector: `${HOME} [data-demo-ref="settings-feedback"][role="status"]` },
];
const fontSelectors = [
  ...commonFontSelectors,
  ...(revisionKind === 'candidate' ? candidateFontSelectors : baselineFontSelectors),
];
const surfaceSelectors = [
  'header',
  '.homepage-hero',
  'section:has(h1)',
  'h1',
  HOME,
  ...(revisionKind === 'candidate'
    ? [
        `${HOME} .home-settings__title`,
        `${HOME} [data-demo-ref="settings-view-trigger"]`,
        `${HOME} .home-settings__fields`,
        `${HOME} .home-settings__actions`,
        `${HOME} [data-demo-ref="settings-feedback"]`,
      ]
    : [
        '.home-demo-previewer__intro-title',
        '[data-home-demo-host] [data-projection-content] [data-pui-root]',
        '.home-demo-previewer__status',
        '.home-demo-previewer__research-lead',
      ]),
];

async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
  });
}

async function waitForRuntime(page: Page, runtime: Runtime): Promise<void> {
  await page.waitForFunction(
    ({ runtime, requireHeader, homeSelector }) => {
      const home = document.querySelector<HTMLElement>(homeSelector);
      const host = home?.querySelector<HTMLElement>('[data-home-demo-host]');
      const scope = host?.querySelector<HTMLElement>('[data-projection-scope]');
      const header = document.querySelector<HTMLElement>('[data-homepage-runtime]');
      return (
        home?.dataset.runnerState === 'ready' &&
        home.dataset.runnerRuntime === runtime &&
        host?.getAttribute('aria-busy') === 'false' &&
        scope?.dataset.projectionRuntime === runtime &&
        scope.dataset.projectionState === 'ready' &&
        !!scope.querySelector('[data-projection-content] [data-pui-root]') &&
        (!requireHeader ||
          (header?.dataset.runtimeState === 'ready' && header.dataset.runtime === runtime))
      );
    },
    { runtime, requireHeader: revisionKind === 'candidate', homeSelector: HOME },
    { timeout: 30_000 }
  );
  assert.ok(
    !(await page.locator(`${HOME} [data-home-demo-host]`).innerText()).includes('[Home Demo Error]')
  );
  await settle(page);
}

function runtimeTrigger(page: Page) {
  const owner = revisionKind === 'candidate' ? '[data-homepage-runtime]' : HOME;
  return page.locator(`${owner} [data-projection-control="runtime"] [role="combobox"]`).first();
}

let activeProbeStage: string | null = null;
let activeProbeRuntime: Runtime | null = null;
let requestedProbeRuntime: Runtime | null = null;

type PageErrorContext = {
  runtime: Runtime | null;
  requestedRuntime: Runtime | null;
  activeProbeStage: string | null;
};
type PageErrorDetail = PageErrorContext & {
  message: string;
  name: string;
  stack: string | null;
  observedAt: string;
};

function observePageErrors(page: Page, readContext: () => PageErrorContext) {
  const pageErrors: string[] = [];
  const pageErrorDetails: PageErrorDetail[] = [];
  // Capture host-side metadata synchronously at delivery. Do not start browser
  // queries here: their completion could race the next probe stage or teardown.
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
    pageErrorDetails.push({
      message: error.message,
      name: error.name,
      stack: error.stack ?? null,
      observedAt: new Date().toISOString(),
      ...readContext(),
    });
  });
  return { pageErrors, pageErrorDetails };
}

async function recordRuntimeTask<T>(
  runtimeTasks: Array<Record<string, unknown>>,
  pageErrorDetails: PageErrorDetail[],
  runtime: Runtime,
  pointerStep: number,
  run: () => Promise<T>
): Promise<T> {
  const startIndex = pageErrorDetails.length;
  const task: Record<string, unknown> = {
    runtime,
    pointerStep,
    startedAt: new Date().toISOString(),
    pageErrorStartIndex: startIndex,
  };
  runtimeTasks.push(task);
  try {
    return await run();
  } finally {
    // Retain newly observed errors even when the strict task driver throws.
    // Runtime selection/ownership errors outside this interval remain in the
    // complete case-level log, with their event-time context intact.
    task.pageErrorEndIndex = pageErrorDetails.length;
    task.pageErrors = pageErrorDetails.slice(startIndex);
    task.finishedAt = new Date().toISOString();
  }
}

async function chooseRuntime(page: Page, runtime: Runtime, keyboard: boolean): Promise<void> {
  activeProbeStage = null;
  requestedProbeRuntime = runtime;
  if (revisionKind === 'candidate') await revealHeaderPreferences(page);
  const trigger = runtimeTrigger(page);
  if (keyboard) {
    await trigger.focus();
    await page.keyboard.press('Enter');
  } else await trigger.click();
  const id = await trigger.getAttribute('aria-controls');
  assert.ok(id, 'Runtime selector must control an identifiable option portal');
  const portal = page.locator(`[id=${JSON.stringify(id)}]`);
  await portal.waitFor({ state: 'visible' });
  if (keyboard) {
    await page.waitForFunction(
      // The portal itself can receive focus before Select's deferred selected-
      // item focus. Home/ArrowDown require an actual focused roving member.
      (id) =>
        Boolean(
          document.getElementById(id)?.querySelector('[role="option"][aria-selected="true"]:focus')
        ),
      id
    );
    activeProbeStage = 'keyboard-home';
    await page.keyboard.press('Home');
    await page.waitForFunction(
      ([id, label]) =>
        document.getElementById(id)?.querySelector('[role="option"]:focus')?.textContent?.trim() ===
        label,
      [id, RUNTIME_LABELS.wc]
    );
    for (let index = 0; index < Object.keys(RUNTIME_LABELS).indexOf(runtime); index++) {
      activeProbeStage = 'keyboard-arrow-down';
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(
        ([id, label]) =>
          document
            .getElementById(id)
            ?.querySelector('[role="option"]:focus')
            ?.textContent?.trim() === label,
        [id, Object.values(RUNTIME_LABELS)[index + 1]!]
      );
    }
    activeProbeStage = 'keyboard-commit';
    await page.keyboard.press('Enter');
  } else {
    await portal.getByRole('option', { name: RUNTIME_LABELS[runtime], exact: true }).click();
  }
  await waitForRuntime(page, runtime);
  activeProbeRuntime = runtime;
  requestedProbeRuntime = null;
  activeProbeStage = null;
}

type WorkspaceSettingsState = {
  view: string;
  summary: string | null;
  note: string;
  dirty: string | undefined;
  saveDisabled: boolean;
  resetDisabled: boolean;
  feedback: string;
};

// Serialized by Playwright. Keep this read-only observer self-contained, and
// read the Adapter's actual native textarea (WC wraps it; React/Vue own it).
function observeWorkspaceSettings({
  homeSelector,
  expected,
}: {
  homeSelector: string;
  expected: Partial<WorkspaceSettingsState>;
}): WorkspaceSettingsState | false {
  const home = document.querySelector<HTMLElement>(homeSelector);
  const settings = home?.querySelector<HTMLElement>('[data-demo-ref="settings"]');
  const view = home?.querySelector<HTMLElement>('[data-demo-ref="settings-view-trigger"]');
  const summary = home?.querySelector<HTMLElement>('[data-demo-ref="settings-summary"]');
  const noteRoot = home?.querySelector<HTMLElement>('[data-demo-ref="settings-note"]');
  const note = noteRoot?.matches('textarea')
    ? (noteRoot as HTMLTextAreaElement)
    : noteRoot?.querySelector<HTMLTextAreaElement>('textarea');
  const save = home?.querySelector<HTMLElement>('[data-demo-ref="settings-save"]');
  const reset = home?.querySelector<HTMLElement>('[data-demo-ref="settings-reset"]');
  const feedback = home?.querySelector<HTMLElement>(
    '[data-demo-ref="settings-feedback"][role="status"]'
  );
  if (!settings || !view || !summary || !note || !save || !reset || !feedback) return false;
  const state: WorkspaceSettingsState = {
    view: view.textContent?.trim() ?? '',
    summary: summary.getAttribute('aria-checked'),
    note: note.value,
    dirty: settings.dataset.dirty,
    saveDisabled: save.getAttribute('aria-disabled') === 'true' || save.hasAttribute('disabled'),
    resetDisabled: reset.getAttribute('aria-disabled') === 'true' || reset.hasAttribute('disabled'),
    feedback: feedback.textContent?.trim() ?? '',
  };
  for (const key of Object.keys(expected) as Array<keyof WorkspaceSettingsState>) {
    if (state[key] !== expected[key]) return false;
  }
  return state;
}

async function waitForWorkspaceSettings(page: Page, expected: Partial<WorkspaceSettingsState>) {
  const result = await page.waitForFunction(observeWorkspaceSettings, {
    homeSelector: HOME,
    expected,
  });
  try {
    const state = await result.jsonValue();
    assert.ok(state, 'The actual workspace settings state must match the task expectation');
    return state;
  } finally {
    await result.dispose();
  }
}

async function exerciseWorkspaceSettings(
  page: Page,
  route: string,
  capture: (state: string) => Promise<void>
) {
  const copy =
    route === '/en/'
      ? {
          list: 'Email',
          board: 'Push',
          unchanged: 'No unsaved changes',
          changed: 'Unsaved changes',
          saved: 'Saved to this page',
          restored: 'Defaults restored',
          on: 'Weekly summary on',
          off: 'Weekly summary off',
          note: 'Plan the next team check-in.',
          noteLength: (count: number) => `Note: ${count} characters`,
        }
      : {
          list: '邮件',
          board: '推送',
          unchanged: '没有未保存的更改',
          changed: '有未保存的更改',
          saved: '已保存到本页',
          restored: '已恢复默认值',
          on: '显示每周摘要',
          off: '隐藏每周摘要',
          note: '准备下一次团队同步。',
          noteLength: (count: number) => `备注 ${count} 字`,
        };
  const task = page.locator(HOME);
  activeProbeStage = 'workspace-settings-initial';
  const initial = await waitForWorkspaceSettings(page, {
    view: copy.list,
    summary: 'false',
    note: '',
    dirty: 'false',
    saveDisabled: true,
    resetDisabled: true,
    feedback: copy.unchanged,
  });
  const trigger = task.locator('[data-demo-ref="settings-view-trigger"]');
  activeProbeStage = 'workspace-settings-view-open';
  await trigger.click();
  activeProbeStage = 'workspace-settings-view-portal';
  const portalId = await trigger.getAttribute('aria-controls');
  assert.ok(portalId, 'Project-view selector must identify its real option portal');
  const portal = page.locator(`[id=${JSON.stringify(portalId)}]`);
  await portal.waitFor({ state: 'visible' });
  activeProbeStage = 'workspace-settings-view-select';
  await portal.getByRole('option', { name: copy.board, exact: true }).click();
  activeProbeStage = 'workspace-settings-view-observe';
  const viewChanged = await waitForWorkspaceSettings(page, {
    view: copy.board,
    summary: 'false',
    note: '',
    dirty: 'true',
    saveDisabled: false,
    resetDisabled: false,
    feedback: copy.changed,
  });
  activeProbeStage = 'workspace-settings-switch-change';
  await task.locator('[data-demo-ref="settings-summary"]').click();
  activeProbeStage = 'workspace-settings-switch-observe';
  const summaryChanged = await waitForWorkspaceSettings(page, { ...viewChanged, summary: 'true' });
  const note = task.locator(
    'textarea[data-demo-ref="settings-note"], [data-demo-ref="settings-note"] textarea'
  );
  activeProbeStage = 'workspace-settings-textarea-focus';
  await note.click();
  activeProbeStage = 'workspace-settings-textarea-input';
  await page.keyboard.insertText(copy.note);
  activeProbeStage = 'workspace-settings-textarea-observe';
  const edited = await waitForWorkspaceSettings(page, { ...summaryChanged, note: copy.note });
  activeProbeStage = 'workspace-settings-save';
  await task.locator('[data-demo-ref="settings-save"]').click();
  activeProbeStage = 'workspace-settings-save-observe';
  const saved = await waitForWorkspaceSettings(page, {
    ...edited,
    dirty: 'false',
    saveDisabled: true,
    feedback: `${copy.saved} · ${copy.board} · ${copy.on} · ${copy.noteLength(copy.note.length)}`,
  });
  const liveResult = await page
    .locator(`${HOME} [data-gallery-demo]`)
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-gallery-demo')));
  assert.deepEqual(
    [...liveResult].join(','),
    'controls,hover,preferences,editor,overlays,choices',
    'Every real component composition remains present'
  );
  activeProbeStage = 'workspace-settings-saved-capture';
  await capture('saved');
  activeProbeStage = 'workspace-settings-restore';
  await task.locator('[data-demo-ref="settings-reset"]').click();
  activeProbeStage = 'workspace-settings-restore-observe';
  // Restore changes the draft. It must not claim the previously saved local
  // values changed until the user deliberately saves those defaults as well.
  const restoredDraft = await waitForWorkspaceSettings(page, {
    ...initial,
    dirty: 'true',
    saveDisabled: false,
    feedback: `${copy.restored} · ${copy.changed}`,
  });
  activeProbeStage = 'workspace-settings-restored-draft-capture';
  await capture('restored-draft');
  activeProbeStage = 'workspace-settings-default-save';
  await task.locator('[data-demo-ref="settings-save"]').click();
  activeProbeStage = 'workspace-settings-default-save-observe';
  const defaultsSaved = await waitForWorkspaceSettings(page, {
    ...initial,
    feedback: `${copy.saved} · ${copy.list} · ${copy.off} · ${copy.noteLength(0)}`,
  });
  activeProbeStage = null;
  return {
    persistence: 'Local to this page instance; no backend or durable-storage claim',
    input: 'Real project-view option, Switch click, native textarea typing, Save, Restore, Save',
    initial,
    viewChanged,
    summaryChanged,
    edited,
    saved,
    restoredDraft,
    defaultsSaved,
    liveResult,
  };
}

async function waitForDialogEntryFocus(page: Page, dialog: Locator) {
  const element = await dialog.elementHandle();
  assert.ok(element, 'The visible Dialog must have a connected physical surface');
  const initiallyInside = await dialog.evaluate((node) => node.contains(document.activeElement));
  const startedAt = Date.now();
  try {
    // Visibility includes an entering (opacity-zero) surface. Wait for the
    // actual focus owner, not a sleep or a weakened descendant/visibility check.
    await page.waitForFunction(
      (node) =>
        node.isConnected &&
        node.getAttribute('role') === 'dialog' &&
        node.getAttribute('aria-hidden') !== 'true' &&
        !node.closest('[inert]') &&
        node.contains(document.activeElement),
      element,
      { timeout: 5_000 }
    );
    return { initiallyInside, elapsedMs: Date.now() - startedAt, ownsEntryFocus: true };
  } finally {
    await element.dispose();
  }
}

async function exerciseInteractiveGallery(
  page: Page,
  route: string,
  capture: (state: string) => Promise<void>
) {
  const zh = route === '/zh-cn/';
  const gallery = page.locator(`${HOME} [data-home-gallery]`);
  activeProbeStage = 'gallery-button';
  await gallery.locator('[data-demo-ref="gallery-primary"]').click();
  await page.waitForFunction(
    (home) =>
      document
        .querySelector(`${home} [data-demo-ref="gallery-controls-feedback"]`)
        ?.textContent?.includes('✓'),
    HOME
  );
  activeProbeStage = 'gallery-editor';
  const editor = gallery.locator('[data-gallery-demo="editor"]');
  const text = editor.locator('textarea');
  const value = zh ? '直接编辑，立即预览。' : 'Edit directly. Preview immediately.';
  await text.fill(value);
  await editor.locator('[data-demo-ref="editor-bold"]').click();
  await editor.getByRole('tab', { name: zh ? '预览' : 'Preview', exact: true }).click();
  const preview = editor.locator('[data-demo-ref="editor-preview"]');
  await preview.waitFor({ state: 'visible' });
  assert.equal(await preview.textContent(), value);
  // Candidate text is painted by the public Text atom; the immutable before
  // revision paints its box directly. Measure the actual text owner in each.
  const textOwner = preview.locator('[data-demo-ref="editor-preview-text"]');
  assert.equal(
    await ((await textOwner.count()) ? textOwner : preview).evaluate(
      (element) => getComputedStyle(element).fontWeight
    ),
    '700'
  );
  await capture('gallery-editor-preview');
  activeProbeStage = 'gallery-dialog';
  const overlays = gallery.locator('[data-gallery-demo="overlays"]');
  const trigger = overlays.getByRole('button', {
    name: zh ? '打开对话框' : 'Open dialog',
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole('dialog', {
    name: zh ? '确认这次选择？' : 'Confirm this choice?',
    exact: true,
  });
  await dialog.waitFor({ state: 'visible' });
  const entryFocus = await waitForDialogEntryFocus(page, dialog);
  await capture('gallery-dialog-open');
  await dialog.getByRole('button', { name: zh ? '确认' : 'Confirm', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.waitForFunction((home) => {
    const node = document.querySelector(
      `${home} [data-gallery-demo="overlays"] [data-demo-ref="gallery-dialog-feedback"]`
    );
    return node?.textContent === 'Confirmed' || node?.textContent === '已确认';
  }, HOME);
  assert.ok(
    await trigger.evaluate((element) => element === document.activeElement),
    'Dialog returns focus to its real trigger'
  );
  activeProbeStage = 'gallery-menu';
  await overlays
    .getByRole('button', { name: zh ? '更多操作' : 'More actions', exact: true })
    .click();
  await page.getByRole('menuitem', { name: zh ? '增加一份' : 'Add a copy', exact: true }).click();
  assert.equal(
    await overlays.locator('[data-demo-ref="gallery-dialog-feedback"]').textContent(),
    `${zh ? '副本' : 'Copies'}: 1`
  );
  activeProbeStage = 'gallery-checkboxes';
  const choices = gallery.locator('[data-gallery-demo="choices"]');
  await choices
    .getByRole('checkbox', { name: zh ? '产品更新' : 'Product updates', exact: true })
    .click();
  await choices
    .getByRole('button', { name: zh ? '应用选择' : 'Apply selection', exact: true })
    .click();
  assert.equal(
    await choices.getByRole('status').textContent(),
    zh ? '已应用 1 项选择' : 'Applied 1 selections'
  );
  activeProbeStage = 'gallery-hover-card';
  const hover = gallery.locator('[data-demo-ref="gallery-hover-trigger"]');
  await hover.focus();
  const hoverContent = page.locator('[data-demo-ref="gallery-hover-content"]');
  await hoverContent.waitFor({ state: 'visible' });
  assert.ok((await hoverContent.textContent())?.includes('Proto UI'));
  await page.mouse.move(1, 1);
  await gallery.locator('[data-demo-ref="gallery-primary"]').focus();
  await hoverContent.waitFor({ state: 'hidden' });
  activeProbeStage = null;
  return {
    button: true,
    editorValue: value,
    editorBold: true,
    dialogConfirmAndFocus: true,
    entryFocus,
    menuCopies: 1,
    choicesApplied: 1,
    hoverFocus: true,
  };
}

async function ownership(page: Page, runtime: Runtime) {
  const result = await page.evaluate(() => {
    const groups = [...document.querySelectorAll<HTMLElement>('[data-homepage-actions]')];
    const hosts = [
      ...groups.map((group) => ({
        name: group.id || 'homepage-actions',
        host: group.querySelector<HTMLElement>('[data-homepage-mount]'),
      })),
      { name: 'demo', host: document.querySelector<HTMLElement>('[data-home-demo-host]') },
    ];
    return hosts.map(({ name, host }) => ({
      name,
      pageGeneration:
        document.querySelector<HTMLElement>('[data-homepage-runtime]')?.dataset.runtimeGeneration,
      scopes: [...(host?.querySelectorAll<HTMLElement>('[data-projection-scope]') ?? [])].map(
        (scope) => ({
          runtime: scope.dataset.projectionRuntime,
          generation: scope.dataset.projectionGeneration,
          state: scope.dataset.projectionState,
          hidden: scope.hidden,
          inert: scope.inert,
          generationState: scope.closest<HTMLElement>('[data-projection-generation-host]')?.dataset
            .projectionGenerationState,
          generationInert: scope.closest<HTMLElement>('[data-projection-generation-host]')?.inert,
          nativeAnchors: scope.querySelectorAll('[data-projection-content] a[href]').length,
          scopeOwner: {
            vue3: !!scope.closest('[data-v-app]'),
            vue2: !!(scope as HTMLElement & { __vue__?: unknown }).__vue__,
            react: Object.keys(scope).some((key) => key.startsWith('__reactFiber$')),
          },
          roots: [
            ...scope.querySelectorAll<HTMLElement>(
              '[data-projection-content] [data-pui-root], [data-projection-control] [data-pui-root]'
            ),
          ].map((root) => ({
            tag: root.tagName,
            prototype: root.getAttribute('data-prototype'),
            vue3: !!root.closest('[data-v-app]'),
            vue2: !!(root as HTMLElement & { __vue__?: unknown }).__vue__,
            react: Object.keys(root).some((key) => key.startsWith('__reactFiber$')),
          })),
        })
      ),
    }));
  });
  if (revisionKind === 'candidate')
    assert.ok(result.length >= 3, 'Candidate must mount header, hero actions and demo');
  for (const host of result) {
    assert.equal(host.scopes.length, 1, `${host.name}: stale or missing projection scope`);
    const scope = host.scopes[0]!;
    assert.equal(scope.runtime, runtime, `${host.name}: runtime`);
    assert.equal(scope.state, 'ready', `${host.name}: state`);
    assert.equal(scope.hidden, false, `${host.name}: hidden`);
    assert.equal(scope.inert, false, `${host.name}: inert`);
    assert.equal(scope.generationState, 'active', `${host.name}: active generation`);
    assert.equal(scope.generationInert, false, `${host.name}: active generation is interactive`);
    if (revisionKind === 'candidate') {
      assert.ok(Number(host.pageGeneration) > 0, 'Header must expose a committed generation');
      assert.equal(scope.generation, host.pageGeneration, `${host.name}: same page generation`);
    }
    assert.ok(
      scope.roots.length > 0 || (host.name !== 'demo' && scope.nativeAnchors > 0),
      `${host.name}: actual prototype or native-anchor content required`
    );
    if (runtime !== 'wc')
      assert.ok(
        scope.scopeOwner[runtime === 'vue' ? 'vue3' : runtime],
        `${host.name}: actual ${runtime} scope ownership`
      );
    for (const root of scope.roots) {
      if (runtime === 'wc')
        assert.ok(root.tag.startsWith('WC-'), `${host.name}: WC custom element`);
      else if (runtime === 'react') assert.ok(root.react, `${host.name}: React-owned root`);
      else if (runtime === 'vue') assert.ok(root.vue3, `${host.name}: Vue-owned root`);
      else assert.ok(root.vue2, `${host.name}: Vue 2-owned root`);
    }
  }
  return result;
}

async function measure(page: Page, samples = fontSelectors) {
  const metrics = await page.evaluate(
    ({ samples, surfaces }) => ({
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      theme: document.documentElement.dataset.theme,
      family: document.documentElement.dataset.siteLibraryFamily,
      developerToolbarPresent: document.querySelector('astro-dev-toolbar') !== null,
      heading: document.querySelector('h1')?.textContent?.trim(),
      fontVariables: {
        fontSans: getComputedStyle(document.documentElement).getPropertyValue('--font-sans'),
        colorFontGeistSans: getComputedStyle(document.documentElement).getPropertyValue(
          '--color-font-geist-sans'
        ),
      },
      fontFaces: [...document.fonts].map((face) => ({
        family: face.family,
        status: face.status,
        weight: face.weight,
        style: face.style,
      })),
      surfaceGeometry: surfaces.flatMap((selector) =>
        [...document.querySelectorAll<HTMLElement>(selector)].map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            selector,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            margin: style.margin,
            padding: style.padding,
            gap: style.gap,
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
            whiteSpace: style.whiteSpace,
          };
        })
      ),
      fonts: samples.flatMap(({ name, selector }) => {
        const matches = [...document.querySelectorAll<HTMLElement>(selector)];
        const matchIndex = matches.findIndex(
          (element) =>
            element.getBoundingClientRect().width > 2 &&
            element.getBoundingClientRect().height > 2 &&
            getComputedStyle(element).visibility !== 'hidden'
        );
        if (matchIndex < 0) return [];
        const element = matches[matchIndex]!;
        const style = getComputedStyle(element);
        return [
          {
            name,
            selector,
            matchIndex,
            text: element.textContent?.trim().slice(0, 100),
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
            fontWeight: style.fontWeight,
            prototypeId: element.getAttribute('data-projection-prototype'),
            styleTokens: (element.getAttribute('data-pui-style') ?? '').split(/\s+/),
            color: style.color,
            backgroundColor: style.backgroundColor,
          },
        ];
      }),
      overflowingElements: [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return (
            rect.width > 0 &&
            getComputedStyle(element).visibility !== 'hidden' &&
            (rect.left < -1 || rect.right > innerWidth + 1)
          );
        })
        .slice(0, 30)
        .map((element) => ({
          tag: element.tagName,
          class: element.className,
          left: element.getBoundingClientRect().left,
          right: element.getBoundingClientRect().right,
        })),
    }),
    { samples, surfaces: surfaceSelectors }
  );
  const session = await page.context().newCDPSession(page);
  const platformFonts: Array<Record<string, unknown>> = [];
  try {
    await session.send('DOM.enable');
    await session.send('CSS.enable');
    const { root } = await session.send('DOM.getDocument');
    for (const sample of metrics.fonts) {
      const { nodeIds } = await session.send('DOM.querySelectorAll', {
        nodeId: root.nodeId,
        selector: sample.selector,
      });
      const nodeId = nodeIds[sample.matchIndex];
      assert.ok(nodeId, `${sample.name}: measured font node is still present`);
      const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
      platformFonts.push({ name: sample.name, fonts });
    }
  } finally {
    await session.detach();
  }
  return {
    ...metrics,
    platformFonts,
    unmeasuredPlatformFontSamples: platformFonts
      .filter((entry) => !(entry.fonts as unknown[]).length)
      .map((entry) => entry.name),
  };
}

async function nativeLinks(page: Page) {
  return page.locator('[data-homepage-actions]').evaluateAll((groups) =>
    groups.map((group) => {
      const helpers = {
        links(selector: string) {
          return [...group.querySelectorAll<HTMLAnchorElement>(selector)].map((link) => ({
            text: link.textContent?.trim(),
            href: link.getAttribute('href'),
            target: link.getAttribute('target'),
            rel: link.getAttribute('rel'),
          }));
        },
      };
      return {
        group: group.id,
        fallback: helpers.links('[data-homepage-fallback] a[href]'),
        live: helpers.links('[data-homepage-mount] [data-projection-content] a[href]'),
      };
    })
  );
}

let browser: Browser | undefined;
try {
  const baseUrl = await startServer([
    ...HOMEPAGE_ROUTES,
    ...DOCUMENTATION_VARIANTS.map((variant) => variant.route),
  ]);
  browser = await launchBrowser();
  report.browserVersion = browser.version();
  for (const route of HOMEPAGE_ROUTES)
    for (const viewport of HOMEPAGE_VIEWPORTS)
      for (const colorScheme of ['light', 'dark'] as const) {
        const id = `${route.split('/')[1]}-${viewport.name}-${colorScheme}`;
        const evidence: Record<string, unknown> = {
          id,
          route,
          viewport,
          colorScheme,
          screenshots: [],
          transitions: [],
          runtimeTasks: [],
        };
        report.cases.push(evidence);
        const screenshots = evidence.screenshots as string[];
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme,
          reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        await page.addInitScript(() => {
          const events: Array<Record<string, unknown>> = [];
          Object.defineProperty(window, '__protoEvidenceEvents', { value: events });
          document.addEventListener(
            'keydown',
            (event) => {
              queueMicrotask(() => {
                const target = event.target instanceof Element ? event.target : null;
                events.push({
                  type: 'keydown',
                  time: performance.now(),
                  key: event.key,
                  defaultPrevented: event.defaultPrevented,
                  target: target?.tagName,
                  role: target?.getAttribute('role'),
                  text: target?.textContent?.trim().slice(0, 80),
                });
                if (events.length > 150) events.shift();
              });
            },
            { passive: true }
          );
          document.addEventListener(
            'focusin',
            (event) => {
              const target = event.target instanceof Element ? event.target : null;
              events.push({
                type: 'focusin',
                time: performance.now(),
                target: target?.tagName,
                role: target?.getAttribute('role'),
                text: target?.textContent?.trim().slice(0, 80),
              });
              if (events.length > 150) events.shift();
            },
            { passive: true }
          );
        });
        page.setDefaultTimeout(15_000);
        activeProbeRuntime = null;
        requestedProbeRuntime = 'wc';
        activeProbeStage = 'homepage-load';
        const { pageErrors, pageErrorDetails } = observePageErrors(page, () => ({
          // Last readiness-verified runtime; requestedRuntime separately names
          // an in-flight selection rather than claiming the DOM has committed.
          runtime: activeProbeRuntime,
          requestedRuntime: requestedProbeRuntime,
          activeProbeStage,
        }));
        const externalModules = new Map<string, number>();
        page.on('response', (response) => {
          if (new URL(response.url()).hostname === 'esm.sh') {
            externalModules.set(response.url(), response.status());
          }
        });
        evidence.pageErrors = pageErrors;
        evidence.pageErrorDetails = pageErrorDetails;
        const screenshot = async (name: string, fullPage = false) => {
          const filename = `${id}-${name}.png`;
          await page.screenshot({ path: path.join(out, filename), fullPage });
          screenshots.push(filename);
        };
        try {
          await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
          await waitForRuntime(page, 'wc');
          activeProbeRuntime = 'wc';
          requestedProbeRuntime = null;
          activeProbeStage = 'homepage-initial-observe';
          await page.waitForFunction(
            (theme) => document.documentElement.dataset.theme === theme,
            colorScheme
          );
          await page.evaluate(() => scrollTo(0, 0));
          evidence.initial = await measure(page);
          await screenshot('initial-viewport');
          await screenshot('initial-full', true);
          if (revisionKind === 'candidate') {
            await revealHeaderPreferences(page);
            // Initial captures intentionally show the collapsed compact Header.
            // Inspect settings fonts only after the user's real disclosure path.
            evidence.settings = await measure(page);
            assert.equal(
              (evidence.settings as Awaited<ReturnType<typeof measure>>).fonts.length,
              fontSelectors.length,
              'Every candidate font sample must resolve to visible content'
            );
            // The approved mobile composition flows Hero → editor → preview.
            // Do not compress the first task control above the fold at the cost of readable content.
            const globalControls = await page
              .locator(
                '[data-homepage-runtime] [data-projection-generation-state="active"] [data-projection-control] [role="combobox"]'
              )
              .evaluateAll((elements) =>
                elements.map((element) => {
                  const value = element.querySelector<HTMLElement>(
                    '[data-pui-part="select-value"], [data-projection-prototype$="-select-value"]'
                  );
                  const rect = element.getBoundingClientRect();
                  return {
                    name: element.getAttribute('aria-label'),
                    width: rect.width,
                    height: rect.height,
                    text: value?.textContent,
                    fullValueVisible: !!value && value.scrollWidth <= value.clientWidth + 1,
                  };
                })
              );
            evidence.globalControls = globalControls;
            assert.equal(
              globalControls.length,
              2,
              'Exactly one global runtime and library control'
            );
            assert.ok(
              globalControls.every(
                (control) =>
                  control.width >= 120 &&
                  control.height >= (viewport.width < 768 ? 44 : 36) &&
                  control.fullValueVisible
              ),
              'Global selected values and targets must be fully visible'
            );
            const failures = layoutFailures(
              evidence.initial as Awaited<ReturnType<typeof measure>>
            );
            evidence.layoutFailures = failures;
            report.failures.push(...failures.map((failure) => `${id}: ${failure}`));
          }
          evidence.initialOwnership = await ownership(page, 'wc');
          if (revisionKind === 'candidate') {
            activeProbeStage = 'homepage-navigation';
            const menu = page.locator(
              '[data-homepage-runtime] [data-projection-generation-state="active"] [data-demo-ref="home-menu"]'
            );
            if ((await menu.getAttribute('aria-expanded')) !== 'true') await menu.click();
            await page.waitForFunction(
              () =>
                document
                  .querySelector(
                    '[data-homepage-runtime] [data-projection-generation-state="active"] [data-demo-ref="home-menu"]'
                  )
                  ?.getAttribute('aria-expanded') === 'true'
            );
            const settings = page.locator('[data-site-header-settings]');
            assert.ok(await settings.isVisible(), 'Opened settings must be visible');
            assert.ok(
              await settings.locator('[data-homepage-mount] a[href]').first().isVisible(),
              'Opened settings must show a real native navigation link'
            );
            const panelSurface = await page
              .locator('[data-site-header-panel]')
              .evaluate((panel) => {
                const surfaces = panel.querySelectorAll<HTMLElement>('.site-header-popup-surface');
                const surface = surfaces[0];
                if (!surface) return null;
                const content = panel.querySelector('[data-site-header-panel-content]');
                const paint = getComputedStyle(surface);
                const outer = getComputedStyle(panel);
                const rect = surface.getBoundingClientRect();
                return {
                  count: surfaces.length,
                  prototype: surface.dataset.projectionPrototype,
                  family: (panel as HTMLElement).dataset.headerSurfaceFamily,
                  runtime: (panel as HTMLElement).dataset.headerSurfaceRuntime,
                  generation: (panel as HTMLElement).dataset.headerSurfaceGeneration,
                  pageGeneration:
                    document.querySelector<HTMLElement>('[data-homepage-runtime]')?.dataset
                      .runtimeGeneration,
                  containsNativeContent: !!content && surface.contains(content),
                  role: surface.getAttribute('role'),
                  tabindex: surface.getAttribute('tabindex'),
                  border: parseFloat(paint.borderTopWidth),
                  radius: paint.borderTopLeftRadius,
                  shadow: paint.boxShadow,
                  outerBorder: parseFloat(outer.borderTopWidth),
                  outerShadow: outer.boxShadow,
                  outerBackground: outer.backgroundColor,
                  left: rect.left,
                  right: rect.right,
                  top: rect.top,
                  trigger: panel
                    .closest('[data-site-header]')!
                    .querySelector(
                      '[data-projection-generation-state="active"] [data-demo-ref="home-menu"]'
                    )!
                    .getBoundingClientRect()
                    .toJSON(),
                  width: rect.width,
                  height: rect.height,
                  viewportWidth: innerWidth,
                  compact: matchMedia('(max-width: 47.999rem)').matches,
                  headerBottom: panel.closest('[data-site-header]')!.getBoundingClientRect().bottom,
                };
              });
            evidence.headerDisclosureSurface = panelSurface;
            assert.ok(panelSurface, 'Native disclosure requires its actual Prototype surface');
            assert.equal(panelSurface.count, 1, 'Exactly one popup organizing surface');
            assert.equal(panelSurface.prototype, `${panelSurface.family}-surface-root`);
            assert.equal(panelSurface.runtime, 'wc');
            assert.equal(panelSurface.generation, panelSurface.pageGeneration);
            assert.ok(panelSurface.containsNativeContent);
            assert.equal(panelSurface.role, null);
            assert.equal(panelSurface.tabindex, null);
            assert.equal(panelSurface.outerBorder, 0);
            assert.equal(panelSurface.outerShadow, 'none');
            assert.ok(['transparent', 'rgba(0, 0, 0, 0)'].includes(panelSurface.outerBackground));
            assert.equal(panelSurface.border, panelSurface.family === 'brutalist' ? 2 : 1);
            assert.ok(panelSurface.left >= 0 && panelSurface.right <= panelSurface.viewportWidth);
            assert.ok(panelSurface.width > 200 && panelSurface.height > 44);
            assert.ok(
              Math.abs(
                panelSurface.top -
                  (panelSurface.compact ? panelSurface.headerBottom : panelSurface.trigger.bottom) -
                  5
              ) <= 1,
              'Surface follows the full compact Header or actual desktop trigger'
            );
            assert.ok(
              Math.abs(
                panelSurface.right -
                  (panelSurface.compact
                    ? panelSurface.viewportWidth - 8
                    : panelSurface.trigger.right)
              ) <= 1,
              'Surface fills the compact viewport or desktop trigger-aligned box'
            );
            evidence.navigationOwnership = await ownership(page, 'wc');
            await screenshot('navigation-open-viewport');
            await page.keyboard.press('Escape');
            assert.equal(await menu.getAttribute('aria-expanded'), 'false');
            assert.ok(
              await menu.evaluate((element) => document.activeElement === element),
              'Closing settings must restore focus to the real menu control'
            );
          }
          for (const [index, runtime] of HOMEPAGE_POINTER_RUNTIME_SEQUENCE.entries()) {
            await chooseRuntime(page, runtime, false);
            const owners = await ownership(page, runtime);
            const focused = await runtimeTrigger(page).evaluate(
              (element) => document.activeElement === element
            );
            assert.ok(focused, `${runtime}: runtime selector focus must be restored`);
            const links = await nativeLinks(page);
            for (const group of links)
              assert.deepEqual(group.live, group.fallback, `${group.group}: preserve native links`);
            let task: Record<string, unknown>;
            if (revisionKind === 'candidate') {
              task = {
                workspaceSettings: await recordRuntimeTask(
                  evidence.runtimeTasks as Array<Record<string, unknown>>,
                  pageErrorDetails,
                  runtime,
                  index,
                  () =>
                    exerciseWorkspaceSettings(page, route, async (state) => {
                      if (index < 4) {
                        const filename = `${id}-${runtime}-settings-${state}.png`;
                        await page.locator(HOME).screenshot({ path: path.join(out, filename) });
                        screenshots.push(filename);
                      }
                    })
                ),
              };
            } else {
              const button = page
                .locator(`${HOME} [data-projection-content] [data-pui-root]`)
                .first();
              await button.scrollIntoViewIfNeeded();
              const box = await button.boundingBox();
              assert.ok(box, 'Demo button is rendered');
              await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
              await page.mouse.down();
              await page.waitForFunction(
                () =>
                  !!document.querySelector(
                    '[data-home-demo-host] [data-projection-content] [data-pui-root][data-pressed]'
                  )
              );
              const pressed = await button.getAttribute('data-pressed');
              if (index < 3) {
                const filename = `${id}-${runtime}-demo-pressed.png`;
                await page.locator(HOME).screenshot({ path: path.join(out, filename) });
                screenshots.push(filename);
              }
              await page.mouse.up();
              await page.waitForFunction(
                () =>
                  !document.querySelector(
                    '[data-home-demo-host] [data-projection-content] [data-pui-root][data-pressed]'
                  )
              );
              task = { demoPress: { down: pressed, released: true } };
            }
            if (revisionKind === 'candidate')
              task.gallery = await exerciseInteractiveGallery(page, route, async (state) => {
                if (index < 4) {
                  await page.evaluate(() => scrollTo(0, 0));
                  await screenshot(`${runtime}-${state}-viewport`);
                }
              });
            (evidence.transitions as unknown[]).push({
              runtime,
              input: 'pointer',
              owners,
              focusRestored: focused,
              nativeLinks: links,
              ...task,
            });
            if (index < 4) {
              await page.evaluate(() => scrollTo(0, 0));
              await screenshot(`${runtime}-viewport`);
              const metrics = await measure(page);
              (evidence.transitions as Array<Record<string, unknown>>).at(-1)!.layout = metrics;
              if (revisionKind === 'candidate') {
                report.failures.push(
                  ...layoutFailures(metrics).map((failure) => `${id} ${runtime}: ${failure}`)
                );
              }
            }
          }
          if (revisionKind === 'candidate') {
            const themeButton = page.locator(
              '[data-homepage-runtime] [data-demo-ref="home-theme"]'
            );
            const opposite = colorScheme === 'light' ? 'dark' : 'light';
            await themeButton.click();
            await page.waitForFunction(
              (theme) => document.documentElement.dataset.theme === theme,
              opposite
            );
            await themeButton.click();
            await page.waitForFunction(
              (theme) => document.documentElement.dataset.theme === theme,
              colorScheme
            );
            evidence.themeRoundTrip = [colorScheme, opposite, colorScheme];
          }
          // Preserve independent pointer evidence for every runtime before the
          // strict keyboard journey. Start from React so Home must move focus.
          await chooseRuntime(page, HOMEPAGE_KEYBOARD_TRANSITION.from, false);
          await ownership(page, HOMEPAGE_KEYBOARD_TRANSITION.from);
          await chooseRuntime(page, HOMEPAGE_KEYBOARD_TRANSITION.to, true);
          const keyboardOwners = await ownership(page, HOMEPAGE_KEYBOARD_TRANSITION.to);
          const keyboardFocus = await runtimeTrigger(page).evaluate(
            (element) => document.activeElement === element
          );
          assert.ok(keyboardFocus, 'Keyboard runtime selection restores trigger focus');
          const keyboardLinks = await nativeLinks(page);
          for (const group of keyboardLinks)
            assert.deepEqual(
              group.live,
              group.fallback,
              `${group.group}: keyboard transition preserves native links`
            );
          evidence.keyboardJourney = {
            ...HOMEPAGE_KEYBOARD_TRANSITION,
            input: 'focused control + keyboard Enter/Home/ArrowDown/Enter',
            owners: keyboardOwners,
            focusRestored: keyboardFocus,
            nativeLinks: keyboardLinks,
          };
          if (revisionKind === 'candidate') {
            const family = page.locator(
              '[data-homepage-runtime] [data-projection-generation-state="active"] [data-projection-control="family"] [role="combobox"]'
            );
            await revealHeaderPreferences(page);
            await family.click();
            const portalId = await family.getAttribute('aria-controls');
            assert.ok(portalId, 'Global library selector owns a real option portal');
            await page
              .locator(`[id=${JSON.stringify(portalId)}]`)
              .getByRole('option', { name: 'Brutalist', exact: true })
              .click();
            await page.waitForFunction(() => {
              const root = document.querySelector<HTMLElement>('[data-homepage-runtime]');
              return root?.dataset.runtimeState === 'ready' && root.dataset.family === 'brutalist';
            });
            const familyTasks: unknown[] = [];
            for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
              await chooseRuntime(page, runtime, false);
              const owners = await ownership(page, runtime);
              const task = await exerciseWorkspaceSettings(page, route, async (state) => {
                await page.evaluate(() => scrollTo(0, 0));
                await screenshot(`brutalist-${runtime}-${state}-viewport`);
                if (runtime === 'wc') await screenshot(`brutalist-${runtime}-${state}-full`, true);
              });
              const gallery = await exerciseInteractiveGallery(page, route, async (state) => {
                await screenshot(`brutalist-${runtime}-${state}-viewport`);
              });
              const typography = await measure(page);
              familyTasks.push({ family: 'brutalist', runtime, owners, task, gallery, typography });
            }
            evidence.familyTasks = familyTasks;
            if (viewport.name === 'mobile') {
              await page.setViewportSize({ width: 320, height: 844 });
              await page.evaluate(() => scrollTo(0, 0));
              evidence.narrow320 = await measure(page);
              report.failures.push(
                ...layoutFailures(evidence.narrow320 as Awaited<ReturnType<typeof measure>>).map(
                  (failure) => `${id} 320px: ${failure}`
                )
              );
              await screenshot('brutalist-320px-viewport');
              await screenshot('brutalist-320px-full', true);
              await page.setViewportSize({ width: viewport.width, height: viewport.height });
            }
          }
          assert.deepEqual(pageErrors, [], 'No uncaught page errors');
          evidence.outcome = report.failures.some(
            (failure) => failure.startsWith(`${id}:`) || failure.startsWith(`${id} `)
          )
            ? 'failed'
            : 'passed';
        } catch (error) {
          evidence.outcome = 'failed';
          evidence.error = error instanceof Error ? error.stack : String(error);
          const failureState = await page
            .evaluate(() => ({
              activeElement: document.activeElement
                ? {
                    tag: document.activeElement.tagName,
                    id: document.activeElement.id,
                    role: document.activeElement.getAttribute('role'),
                    text: document.activeElement.textContent?.trim().slice(0, 100),
                    outerHTML: document.activeElement.outerHTML.slice(0, 1800),
                  }
                : null,
              home: (
                document.querySelector<HTMLElement>(
                  '[data-home-showcase="website-component-gallery"]'
                ) ?? document.querySelector<HTMLElement>('[data-home-demo-options]')
              )?.dataset,
              page: document.querySelector<HTMLElement>('[data-homepage-runtime]')?.dataset,
              options: [...document.querySelectorAll<HTMLElement>('[role="option"]')].map(
                (option) => ({
                  id: option.id,
                  text: option.textContent?.trim(),
                  focused: option === document.activeElement,
                  tabIndex: option.tabIndex,
                  selected: option.getAttribute('aria-selected'),
                  visible: option.getClientRects().length > 0,
                  data: option.dataset,
                })
              ),
            }))
            .catch(() => null);
          evidence.failureState = failureState;
          evidence.failureStage = activeProbeStage;
          evidence.errorName = error instanceof Error ? error.name : typeof error;
          evidence.failureClassification = classifyCapturedFailure({
            revisionKind,
            route,
            stage: activeProbeStage,
            errorName: String(evidence.errorName),
            failureState,
          });
          report.failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`);
          await screenshot('failure-viewport').catch(() => {});
        } finally {
          evidence.inputEvents = await page
            .evaluate(
              () =>
                (window as Window & { __protoEvidenceEvents?: unknown }).__protoEvidenceEvents ?? []
            )
            .catch(() => []);
          evidence.externalModules = [...externalModules].map(([url, status]) => ({ url, status }));
          await context.close();
          await saveReport();
        }
      }
  // Optional public visual references use the same browser/viewports. They
  // are isolated from candidate acceptance: upstream outages are recorded only.
  if (revisionKind === 'candidate') {
    const references: Array<Record<string, unknown>> = [];
    for (const [name, url] of [
      ['shadcn', 'https://ui.shadcn.com/'],
      ['neobrutalism', 'https://www.neobrutalism.dev/'],
    ] as const) {
      for (const viewport of HOMEPAGE_VIEWPORTS) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme: 'light',
        });
        const page = await context.newPage();
        const reference: Record<string, unknown> = {
          name,
          requestedUrl: url,
          viewport,
          capturedAt: new Date().toISOString(),
          purpose: 'Public upstream reference, not candidate output or copied implementation',
        };
        references.push(reference);
        try {
          const response = await page.goto(url, { waitUntil: 'load', timeout: 15_000 });
          reference.responseStatus = response?.status();
          reference.actualUrl = page.url();
          if (!response?.ok()) throw new Error(`Reference returned ${response?.status()}`);
          await page.evaluate(() => scrollTo(0, 0));
          const file = `reference-${name}-${viewport.name}-light.png`;
          await page.screenshot({ path: path.join(out, file), timeout: 10_000 });
          reference.screenshot = file;
          reference.outcome = 'captured';
        } catch (error) {
          reference.outcome = 'unavailable';
          reference.error = String(error);
        } finally {
          await context.close();
        }
      }
    }
    report.publicReferences = references;
    await saveReport();
  }
  await captureDocumentationEvidence({
    browser,
    baseUrl,
    revisionKind,
    out,
    report,
    saveReport,
    measure,
  });
} catch (error) {
  report.failures.push(error instanceof Error ? (error.stack ?? error.message) : String(error));
} finally {
  await browser?.close();
  await stopServer();
  report.finishedAt = new Date().toISOString();
  report.outcome = report.failures.length ? 'failed' : 'passed';
  // Generated CSS can change during the supported dev startup; retain that
  // fact, rather than presenting startup-generated files as committed source.
  report.postServerWorktreeStatus = git('status', '--porcelain', '--untracked-files=all');
  await saveReport();
  const escape = (value: unknown) =>
    String(value).replace(
      /[&<>"']/g,
      (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!
    );
  await writeFile(
    path.join(out, 'index.html'),
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>Website ${revisionKind} evidence</title><style>body{font:16px system-ui;margin:2rem;max-width:100rem}img{max-width:100%;height:auto;border:1px solid #bbb}figure{margin:2rem 0}code{overflow-wrap:anywhere}</style><h1>Actual website pages: ${revisionKind}</h1><p>Revision <code>${revision}</code>. Browser ${escape(report.browserVersion)}. <a href="metrics.json">Measured results and exact procedure</a>.</p>${report.cases.map((item) => `<section><h2>${escape(item.id)}: ${escape(item.outcome)}</h2>${(item.screenshots as string[]).map((file) => `<figure><figcaption>${escape(file)}</figcaption><a href="${escape(file)}"><img loading="lazy" src="${escape(file)}" alt="Actual rendered page ${escape(file)}"></a></figure>`).join('')}</section>`).join('')}</html>`
  );
}
console.log(
  JSON.stringify(
    {
      revisionKind,
      revision,
      outcome: report.outcome,
      cases: report.cases.length,
      failures: report.failures,
    },
    null,
    2
  )
);
if (report.failures.length) process.exitCode = 1;
