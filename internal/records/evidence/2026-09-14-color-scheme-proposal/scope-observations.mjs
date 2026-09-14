import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  applyColorScheme,
  launchBrowser,
  openRoute,
  startServer,
  stopServer,
} from '../../../../apps/www/src/content/docs/zh-cn/browser-harness.ts';

// Current-behavior counterexamples for the proposal, not a new conformance gate.
const output = await mkdtemp(path.join(tmpdir(), 'proto-color-scheme-scope-'));
const repoRoot = new URL('../../../../', import.meta.url);
const sourceUrl = (relative) => `/@fs${new URL(relative, repoRoot).pathname}`;
let browser;

try {
  const baseUrl = await startServer('/en/ui-libraries/shadcn/textarea/');
  browser = await launchBrowser();
  const { context, page } = await openRoute(browser, baseUrl, '/en/ui-libraries/shadcn/textarea/', {
    width: 1280,
    height: 900,
  });
  await applyColorScheme(page, 'light');
  await page.evaluate(
    async (urls) => {
      const { AdaptToWebComponent, setElementProps } = await import(urls.adapter);
      const { default: Textarea } = await import(urls.textarea);
      const { createDefaultWebMetaGetter } = await import(urls.preferences);
      const defaultGetter = createDefaultWebMetaGetter();
      const customGetter = (key) => (key === 'colorScheme' ? 'dark' : undefined);
      const DefaultTextarea = AdaptToWebComponent(Textarea, {
        registerAs: 'proposal-default-scheme-textarea',
      });
      const CustomTextarea = AdaptToWebComponent(Textarea, {
        registerAs: 'proposal-custom-scheme-textarea',
        getMeta: customGetter,
      });

      const board = document.createElement('section');
      board.id = 'proposal-scope-observation';
      board.style.cssText = 'display:grid;gap:16px;padding:24px;max-width:640px';
      for (const [id, title, theme, Constructor, reader] of [
        ['default', 'Default document reader', '', DefaultTextarea, defaultGetter],
        [
          'subtree-dark',
          'Default reader, local dark marker',
          'dark',
          DefaultTextarea,
          defaultGetter,
        ],
        [
          'subtree-light',
          'Default reader, local light marker',
          'light',
          DefaultTextarea,
          defaultGetter,
        ],
        ['custom-dark', 'Custom reader returns dark', '', CustomTextarea, customGetter],
      ]) {
        const box = document.createElement('article');
        box.dataset.case = id;
        box.className = theme;
        const label = document.createElement('p');
        label.textContent = title;
        const editor = new Constructor();
        setElementProps(editor, { defaultValue: title, ariaLabel: title, rows: 2 });
        // The reader is fixture instrumentation on the App container, not Proto state.
        box.readDeclaredScheme = () => reader('colorScheme');
        box.append(label, editor);
        board.append(box);
      }
      document.querySelector('main').append(board);
    },
    {
      adapter: sourceUrl('packages/adapters/web-component/src/index.ts'),
      textarea: sourceUrl('packages/prototypes/shadcn/src/textarea/index.ts'),
      preferences: sourceUrl('packages/adapters/base/src/platform/web-preferences.ts'),
    }
  );
  await page.waitForFunction(
    () => document.querySelectorAll('#proposal-scope-observation textarea').length === 4
  );

  const observations = { browser: browser.version(), profile: 'Web Component', states: [] };
  const board = page.locator('#proposal-scope-observation');
  for (const [name, scheme, explicit] of [
    ['explicit-light', 'light', true],
    ['explicit-dark', 'dark', true],
    ['system-dark', 'dark', false],
    ['system-light', 'light', false],
  ]) {
    await applyColorScheme(page, scheme);
    if (!explicit) {
      await page.evaluate(() => {
        delete document.documentElement.dataset.theme;
        document.documentElement.classList.remove('light', 'dark');
      });
    }
    const sample = await board.evaluate(async (element) => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const editors = [...element.querySelectorAll('textarea')];
      await Promise.allSettled(
        editors.flatMap((editor) => editor.getAnimations().map((animation) => animation.finished))
      );
      return {
        rootTheme: document.documentElement.dataset.theme ?? null,
        rootClass: document.documentElement.className,
        systemDark: matchMedia('(prefers-color-scheme: dark)').matches,
        cases: [...element.querySelectorAll('article')].map((box) => {
          const editor = box.querySelector('textarea');
          const style = getComputedStyle(editor);
          return {
            id: box.dataset.case,
            declaredScheme: box.readDeclaredScheme(),
            localMarker: box.className,
            tokens: editor.getAttribute('data-pui-style'),
            background: style.backgroundColor,
            border: style.borderColor,
            color: style.color,
          };
        }),
      };
    });
    assert.equal(sample.cases.length, 4);
    observations.states.push({ name, ...sample });
    if (explicit) await board.screenshot({ path: path.join(output, `${name}.png`) });
  }
  await writeFile(
    path.join(output, 'observations.json'),
    JSON.stringify(observations, null, 2) + '\n'
  );
  await context.close();
  console.log(`Scope observations: ${output}`);
} finally {
  try {
    await browser?.close();
  } finally {
    await stopServer();
  }
}
