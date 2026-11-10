// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  analyzeMarkupObservation,
  highlightedFragmentIssues,
  markupComparison,
  markupDigest,
  originalCodePanels,
  originalInstallCommands,
  sourceBindingIssues,
  type MarkupResponse,
  type SourceBinding,
} from '../../../../../../scripts/coverage-matrices/website-markup-provenance.mjs';
import { highlightCode } from '../../../components/PrototypePreviewer/code-highlight';
import { codeMap as transitionCodeMap } from '../demo_components/base-transition/baseTransitionCode';
import { codeMap as dialogCodeMap } from '../demo_components/shadcn-dialog/shadcnDialogCode';
import { choosePreviewRuntime, launchBrowser, startServer, stopServer } from './browser-harness';

// All execution belongs to Main. These are research observations, not a new
// source-admission rule, an exploit test or proof of arbitrary JS data flow.
const routes = [
  { id: 'generic', path: '/zh-cn/ui-libraries/base/transition/', mode: null, runtimes: ['wc', 'react', 'vue', 'wc'] },
  { id: 'projected', path: '/zh-cn/ui-libraries/shadcn/dialog/', mode: 'fixed-family', runtimes: ['wc', 'react', 'vue', 'vue2', 'wc'] },
] as const;
const installRoute = '/zh-cn/ui-libraries/shadcn/button/';
const directory = join(process.env.RUNNER_TEMP || tmpdir(), 'pui834');
let browser: Browser;
let baseUrl: string;
let profile: SourceBinding;
let binding: SourceBinding;

beforeAll(async () => {
  profile = JSON.parse(await readFile('scripts/coverage-matrices/test/fixtures/website-markup-provenance-source.json', 'utf8'));
  binding = {
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sources: await Promise.all(profile.sources.map(async ({ path }) => ({
      path, sha256: markupDigest(await readFile(path)),
    }))),
  };
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'source-binding.json'), JSON.stringify({ profile, binding }, null, 2));
  const expectedRevision = process.env.CANDIDATE_SHA ?? process.env.PROTO_UI_EXPECTED_REVISION;
  if (expectedRevision) expect(binding.revision).toBe(expectedRevision);
  expect(sourceBindingIssues(profile, binding)).toEqual([]);
  baseUrl = await startServer([...routes.map((route) => route.path), installRoute]);
  browser = await launchBrowser();
  await writeFile(join(directory, 'browser.json'), JSON.stringify({ version: browser.version(), baseUrl, servedSource: 'unobservable' }, null, 2));
}, 300_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
});

async function originalResponse(page: Page, route: string, name: string): Promise<MarkupResponse> {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
  if (!response) throw new Error('The navigation supplied no original HTML response.');
  const html = await response.body();
  await writeFile(join(directory, `${name}.response.html`), html);
  const decoded = html.toString('utf8');
  const metadata = {
    kind: 'navigation-response' as const, navigationId: crypto.randomUUID(), status: response.status(),
    contentType: response.headers()['content-type'] ?? '', html: decoded,
  };
  await writeFile(join(directory, `${name}.response.json`), JSON.stringify({
    url: response.url(), navigationId: metadata.navigationId, status: metadata.status, contentType: metadata.contentType,
    decodedBodySha256: markupDigest(html), note: 'Playwright response body; not compressed wire bytes or original source.',
  }, null, 2));
  return metadata;
}

async function ready(root: Locator, runtime: string): Promise<void> {
  await expect.poll(() => root.evaluate((element) => {
    const preview = element as HTMLElement & { __previewer__?: { getCurrentRuntime(): string | null } };
    return preview.__previewer__?.getCurrentRuntime() ?? null;
  }), { timeout: 30_000 }).toBe(runtime);
  await expect.poll(() => root.locator('[data-code-content] code').getAttribute('data-raw-code'), { timeout: 30_000 })
    .toBe(await root.evaluate((element, runtime) => JSON.parse((element as HTMLElement).dataset.codeMap!)[runtime], runtime));
}

async function sample(root: Locator, response: MarkupResponse) {
  return root.evaluate((element, receipt) => {
    const root = element as HTMLElement & { __previewer__?: { getCurrentRuntime(): string | null } };
    const receivers = root.querySelectorAll<HTMLElement>('[data-code-content]');
    const receiver = receivers.length === 1 ? receivers[0]! : null;
    return {
      responseDigest: receipt.digest, navigationId: receipt.navigationId, previewerId: root.dataset.previewerId ?? null,
      ownerPreviewerId: receiver?.closest<HTMLElement>('[data-previewer-id]')?.dataset.previewerId ?? null,
      runtime: root.__previewer__?.getCurrentRuntime() ?? null, connected: receiver?.isConnected ?? false,
      receiverTag: receiver?.localName ?? null, receiverCount: receivers.length,
      highlightsAttribute: root.dataset.codeHighlights ?? '', codeMapAttribute: root.dataset.codeMap ?? '',
      contentHtml: receiver?.innerHTML ?? null,
    };
  }, { digest: markupDigest(response.html), navigationId: response.navigationId });
}

async function cloneComparison(root: Locator) {
  return root.evaluate((element) => {
    const content = element.querySelector<HTMLElement>('[data-code-content]')!;
    const template = document.createElement('template');
    template.innerHTML = content.innerHTML;
    const clone = content.cloneNode(false) as HTMLElement;
    clone.append(template.content.cloneNode(true));
    const equalTree = content.isEqualNode(clone);
    const width = content.getBoundingClientRect().width;
    clone.style.cssText += `;position:fixed;left:-10000px;top:0;width:${width}px`;
    content.parentNode!.append(clone);
    try {
      const facts = (host: HTMLElement) => {
        const pre = host.querySelector<HTMLElement>('pre')!;
        const code = pre.querySelector<HTMLElement>('code')!;
        const style = getComputedStyle(pre);
        return { text: code.textContent, raw: code.dataset.rawCode, tabIndex: pre.tabIndex,
          height: pre.getBoundingClientRect().height, color: style.color, background: style.backgroundColor,
          font: style.fontFamily, lineHeight: style.lineHeight };
      };
      return { kind: 'injected-template-comparison', equalTree, actual: facts(content), alternative: facts(clone) };
    } finally { clone.remove(); }
  });
}

async function copyWithKeyboard(root: Locator, expected: string): Promise<void> {
  const toggle = root.locator('[data-code-toggle]');
  if (await toggle.isVisible()) { await toggle.focus(); await toggle.press('Enter'); }
  const copy = root.locator('[data-site-copy] [data-demo-ref="copy-button"]');
  await copy.waitFor({ state: 'visible' });
  // A controlled independent Clipboard marker makes a stale success state or
  // a second key that did nothing distinguishable from a real new write.
  await root.page().evaluate(() => navigator.clipboard.writeText('issue834 controlled clipboard precondition'));
  await copy.focus();
  await copy.press('Enter');
  await expect.poll(() => copy.getAttribute('data-copy-state'), { timeout: 30_000 }).toBe('success');
  await expect.poll(() => root.page().evaluate(() => navigator.clipboard.readText()), { timeout: 30_000 }).toBe(expected);
  expect(await copy.evaluate((element) => element.contains(document.activeElement))).toBe(true);
}

for (const route of routes) for (const theme of ['light', 'dark'] as const) for (const width of [390, 1180]) {
  it(`834 actual ${route.id} response, runtime, copy and remount ${theme} ${width}`, async () => {
    const name = `${route.id}-${theme}-${width}`;
    const context = await browser.newContext({ viewport: { width, height: 844 }, colorScheme: theme,
      permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const evidence: unknown[] = [];
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
    try {
      const response = await originalResponse(page, route.path, name);
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme), { timeout: 30_000 }).toBe(theme);
      const panel = originalCodePanels(response.html).find((panel) => panel.contentCount === 1 && panel.highlightsAttribute);
      expect(panel).toBeDefined();
      const root = page.locator(`[data-previewer-id=${JSON.stringify(panel!.id)}]`);
      await root.scrollIntoViewIfNeeded();
      expect(await root.getAttribute('data-projection-mode')).toBe(route.mode);
      for (const [index, runtime] of route.runtimes.entries()) {
        if (index > 0) await choosePreviewRuntime(page, root, runtime);
        await ready(root, runtime);
        const observation = await sample(root, response);
        const report = analyzeMarkupObservation({ profile, binding, response, observation });
        const raw = JSON.parse(panel!.codeMapAttribute)[runtime] as string;
        const authoredRaw = (route.id === 'generic' ? transitionCodeMap : dialogCodeMap)[runtime]?.[panel!.demoId!];
        const produced = await highlightCode(authoredRaw, runtime === 'react' ? 'tsx' :
          runtime === 'vue' || runtime === 'vue2' ? 'vue' : 'html');
        const producerComparison = markupComparison(produced, JSON.parse(panel!.highlightsAttribute)[runtime]);
        const alternative = await cloneComparison(root);
        evidence.push({ phase: `${index}-${runtime}`, report, alternative,
          actualProducer: { authoredRawSha256: authoredRaw === undefined ? null : markupDigest(authoredRaw),
            outputSha256: markupDigest(produced), producerComparison } });
        await writeFile(join(directory, `${name}.json`), JSON.stringify({ evidence, errors }, null, 2));
        await root.screenshot({ path: join(directory, `${name}-${index}-${runtime}.png`) });
        expect(report.issues).toEqual([]);
        expect(report.sourceAdmission).toBe('unverified');
        expect(raw).toBe(authoredRaw);
        expect(producerComparison.matches).toBe(true);
        expect(alternative.equalTree).toBe(true);
        expect(alternative.alternative).toEqual(alternative.actual);
        await copyWithKeyboard(root, raw);
        await root.screenshot({ path: join(directory, `${name}-${index}-${runtime}-copy.png`) });
        evidence.push({ phase: `${index}-${runtime}-copy`, copiedRawSha256: markupDigest(raw),
          clipboardPrecondition: 'injected-independent-marker' });
      }
      // A new navigation/remount must get a new response receipt. An old sample
      // is deliberately not reused as evidence for this new Document lifetime.
      const nextResponse = await originalResponse(page, route.path, `${name}-remount`);
      const nextPanel = originalCodePanels(nextResponse.html).find((item) => item.contentCount === 1 && item.highlightsAttribute)!;
      const nextRoot = page.locator(`[data-previewer-id=${JSON.stringify(nextPanel.id)}]`);
      await nextRoot.scrollIntoViewIfNeeded();
      await ready(nextRoot, 'wc');
      const next = await sample(nextRoot, nextResponse);
      const report = analyzeMarkupObservation({ profile, binding, response: nextResponse, observation: next });
      const stale = analyzeMarkupObservation({ profile, binding, response, observation: next });
      evidence.push({ phase: 'full-document-remount', report, staleReceiptControl: stale });
      expect(report.issues).toEqual([]);
      expect(stale.matchesRecordedProducer).toBe(false);
      await copyWithKeyboard(nextRoot, JSON.parse(nextPanel.codeMapAttribute).wc);
    } finally {
      await writeFile(join(directory, `${name}.json`), JSON.stringify({ evidence, errors,
        limits: ['Full-document remount is exercised; Astro in-document swaps and AT remain separate acceptance.'] }, null, 2));
      await context.close();
    }
  }, 180_000);
}

for (const theme of ['light', 'dark'] as const) for (const width of [390, 1180]) {
  it(`834 original code and install commands remain readable without JavaScript ${theme} ${width}`, async () => {
    const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: theme, viewport: { width, height: 844 } });
    const page = await context.newPage();
    try {
      for (const route of routes) {
        const name = `no-js-${route.id}-${theme}-${width}`;
        await originalResponse(page, route.path, name);
        const code = page.locator('[data-code-content] code').first();
        expect((await code.textContent())?.trim().length).toBeGreaterThan(0);
        expect(await code.isVisible()).toBe(true);
        expect((await code.getAttribute('data-raw-code'))?.length).toBeGreaterThan(0);
        await writeFile(join(directory, `${name}.theme.json`), JSON.stringify(await page.evaluate(() => ({
          actualThemeAttribute: document.documentElement.dataset.theme ?? null,
          background: getComputedStyle(document.documentElement).backgroundColor,
        })), null, 2));
        await page.screenshot({ path: join(directory, `${name}.png`), fullPage: true });
      }
      await originalResponse(page, installRoute, `no-js-install-${theme}-${width}`);
      const command = page.locator('[data-install-command-card] [data-command-panel]:not([hidden]) [data-command]').first();
      expect(await command.isVisible()).toBe(true);
      expect((await command.textContent())?.trim().length).toBeGreaterThan(0);
      await page.screenshot({ path: join(directory, `no-js-install-${theme}-${width}.png`), fullPage: true });
    } finally { await context.close(); }
  }, 90_000);
}

for (const lang of ['html', 'tsx', 'vue'] as const) {
  it(`834 real Shiki producer and native template clone preserve hostile example text for ${lang}`, async () => {
    const raw = '<script src="/never-request-this.js">alert("<&>")</script>\r\n<!-- 中文 -->\r\n';
    const html = await highlightCode(raw, lang);
    expect(highlightedFragmentIssues(html, raw)).toEqual([]);
    const context = await browser.newContext();
    const page = await context.newPage();
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    try {
      const facts = await page.evaluate(({ html }) => {
        const direct = document.createElement('div'); direct.innerHTML = html;
        const template = document.createElement('template'); template.innerHTML = html;
        const cloned = document.createElement('div'); cloned.append(template.content.cloneNode(true));
        return { equal: direct.isEqualNode(cloned), directRaw: direct.querySelector<HTMLElement>('code')?.dataset.rawCode,
          clonedRaw: cloned.querySelector<HTMLElement>('code')?.dataset.rawCode,
          executableCount: direct.querySelectorAll('script,iframe,link,img').length,
          tabIndex: direct.querySelector<HTMLElement>('pre')?.tabIndex, text: direct.textContent };
      }, { html });
      await writeFile(join(directory, `producer-${lang}.json`), JSON.stringify({ kind: 'supplied-hostile-example', raw, html, facts, requests }, null, 2));
      expect(facts.equal).toBe(true);
      expect(facts.directRaw).toBe(raw);
      expect(facts.clonedRaw).toBe(raw);
      expect(facts.executableCount).toBe(0);
      expect(facts.tabIndex).toBe(0);
      expect(facts.text).toContain('<script src="/never-request-this.js">');
      expect(requests).toEqual([]);
    } finally { await context.close(); }
  }, 30_000);
}

for (const theme of ['light', 'dark'] as const) {
  it(`834 current install Copy preserves original command and stable glyphs ${theme}`, async () => {
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 390, height: 844 },
      permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const evidence: unknown[] = [];
    try {
      for (const visit of ['first', 'remount']) {
        const response = await originalResponse(page, installRoute, `install-${theme}-${visit}`);
        const original = originalInstallCommands(response.html)[0]!;
        expect(original).toBeDefined();
        const expected = original.commands.find((command) => command.manager === original.activeManager)!.text;
        const card = page.locator(`[id=${JSON.stringify(original.id)}]`);
        await card.scrollIntoViewIfNeeded();
        const copy = card.locator('[data-site-copy] [data-demo-ref="copy-button"]');
        await copy.waitFor({ state: 'visible' });
        const glyphs = copy.locator('[data-demo-ref^="copy-glyph-"]');
        const before = await glyphs.elementHandles();
        expect(before.length).toBeGreaterThan(0);
        for (const key of ['Enter', 'Space']) {
          await page.evaluate(() => navigator.clipboard.writeText('issue834 controlled clipboard precondition'));
          await copy.focus(); await copy.press(key);
          await expect.poll(() => copy.getAttribute('data-copy-state'), { timeout: 30_000 }).toBe('success');
          await expect.poll(() => page.evaluate(() => navigator.clipboard.readText()), { timeout: 30_000 }).toBe(expected);
          const actual = await page.evaluate(() => navigator.clipboard.readText());
          evidence.push({ kind: 'native-runtime-output', visit, key, responseDigest: markupDigest(response.html),
            copiedSha256: markupDigest(actual), clipboardPrecondition: 'injected-independent-marker',
            sourceAdmission: 'unverified', servedSource: 'unobservable' });
          await writeFile(join(directory, `install-${theme}.json`), JSON.stringify(evidence, null, 2));
          await card.screenshot({ path: join(directory, `install-${theme}-${visit}-${key}.png`) });
          expect(actual).toBe(expected);
          expect(await glyphs.count()).toBe(before.length);
          for (const glyph of before) expect(await glyph.evaluate((element) => element.isConnected)).toBe(true);
          expect(await copy.evaluate((element) => element.contains(document.activeElement))).toBe(true);
        }
      }
    } finally {
      await writeFile(join(directory, `install-${theme}.json`), JSON.stringify(evidence, null, 2));
      await context.close();
    }
  }, 90_000);
}
