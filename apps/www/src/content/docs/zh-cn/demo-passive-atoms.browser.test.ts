// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findDocumentFontSample } from '../../../components/PrototypePreviewer/document-font-probe';
import { RUNTIMES, launchBrowser, selectRuntime, startServer, stopServer } from './browser-harness';

const DOCUMENT_TYPOGRAPHY_SELECTOR = '[data-doc-flow] > p:first-of-type';

type ShellTrace = {
  atMs: number;
  slots: {
    generation: string | null;
    phase: string | null;
    runtime: string | null;
    hostHidden: boolean;
    hostInert: boolean;
    hostDisplay: string | null;
    blockedByAncestor: boolean;
    borrowedContent: boolean;
    prototypeCount: number;
    active: boolean;
  }[];
};
type ShellRecorder = {
  traces: ShellTrace[];
  events: { name: string; atMs: number; detail: unknown; slots: ShellTrace['slots'] }[];
};

function readyEventHasExpectedOwner(event: ShellRecorder['events'][number]): boolean {
  const active = event.slots.filter((slot) => slot.active);
  const detail = event.detail as { id?: string; runtime?: string } | null;
  const expected =
    event.name === 'runtime:changed'
      ? detail?.id
      : event.name === 'previewer:mounted'
        ? detail?.runtime
        : undefined;
  return (
    !!expected &&
    (RUNTIMES as readonly string[]).includes(expected) &&
    active.length === 1 &&
    active[0].runtime === expected
  );
}

function installShellRecorder() {
  const state: ShellRecorder = { traces: [], events: [] };
  (window as typeof window & { __passiveAtomEvidence: ShellRecorder }).__passiveAtomEvidence =
    state;
  let previous = '';
  const capture = () => {
    const preview = document.querySelector('[data-previewer-id]');
    if (!preview) return;
    const slots = [...preview.querySelectorAll<HTMLElement>('[data-passive-shell-slot]')].map(
      (slot) => {
        const surface = slot.closest<HTMLElement>('.pui-runtime-preview-surface');
        const host = surface?.parentElement;
        let blockedByAncestor = false;
        for (
          let ancestor: HTMLElement | null = slot;
          ancestor && ancestor !== preview;
          ancestor = ancestor.parentElement
        ) {
          const style = getComputedStyle(ancestor);
          if (
            ancestor.hidden ||
            ancestor.inert ||
            style.display === 'none' ||
            style.visibility === 'hidden'
          )
            blockedByAncestor = true;
        }
        const borrowedContent = Boolean(
          slot.querySelector('[data-demo-ref="__website_runtime_preview_surface__-content"]')
        );
        const prototypeCount = slot.querySelectorAll('[data-pui-root]').length;
        return {
          generation: surface?.dataset.projectionGeneration ?? null,
          phase: surface?.dataset.projectionState ?? host?.dataset.projectionState ?? null,
          runtime: surface?.dataset.projectionRuntime ?? null,
          hostHidden: host?.hidden ?? false,
          hostInert: host?.inert ?? false,
          hostDisplay: host ? getComputedStyle(host).display : null,
          blockedByAncestor,
          borrowedContent,
          prototypeCount,
          active: !blockedByAncestor && borrowedContent && prototypeCount > 0,
        };
      }
    );
    const key = JSON.stringify(slots);
    if (key !== previous) {
      previous = key;
      state.traces.push({ atMs: performance.now(), slots });
    }
  };
  for (const name of ['runtime:changed', 'previewer:mounted']) {
    document.addEventListener(name, (event) => {
      // Runtime events bubble from each independent public previewer. The
      // snapshots above belong to the first authored hero, so peer examples
      // cannot publish that hero's readiness (or count as its empty owner).
      if (event.target !== document.querySelector('[data-previewer-id]')) return;
      capture();
      state.events.push({
        name,
        atMs: performance.now(),
        detail: (event as CustomEvent).detail,
        slots: state.traces.at(-1)?.slots ?? [],
      });
    });
  }
  new MutationObserver(capture).observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      'hidden',
      'inert',
      'style',
      'class',
      'data-projection-generation',
      'data-projection-state',
      'data-projection-runtime',
    ],
  });
}

const subjects = [
  ...(['base', 'shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'] as const).map(
    (family) => ({ family, atom: 'text' })
  ),
  ...(['base', 'shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'] as const).map(
    (family) => ({ family, atom: 'surface' })
  ),
];
// These are the current authored public heroes. Their content is deliberately
// explicit so a changed example is reviewed instead of waiting for an obsolete
// node count through every runtime's readiness budget.
const textExamples = {
  base: { roots: 4, title: 'A reusable Text atom', underlined: 'font: mono · tracking: tight' },
  shadcn: {
    roots: 10, // Nine Text atoms and the passive Rhea style-scope carrier.
    title: 'Taxing Laughter: The Joke Tax Chronicles',
    underlined: 'a brilliant plan',
  },
  brutalist: {
    roots: 5,
    title: 'Bold Print. Zero Ambiguity.',
    underlined: 'npx @proto.ui/cli add wc brutalist-text',
  },
  'bootstrap-2-3-2': {
    roots: 5,
    title: 'Classic Bootstrap 2.3.2 Heading (24.5px / 40px)',
    underlined: '@proto.ui/prototypes-bootstrap-2-3-2/text',
  },
  'liquid-glass': {
    roots: 4,
    title: 'Spatial Clarity on Content Canvas',
    underlined: '@proto.ui/prototypes-liquid-glass/text',
  },
} as const;
const surfaceExamples = {
  base: { roots: 4, title: 'Outline · rest' },
  shadcn: { roots: 6, title: 'Workspace Sync' },
  brutalist: { roots: 5, title: 'Project Overview' },
  'bootstrap-2-3-2': { roots: 8, title: 'Overview' },
  'liquid-glass': { roots: 4, title: 'Floating Glass Shell (material="auto")' },
} as const;
const cases = subjects.flatMap(({ family, atom }) =>
  (['en', 'zh-cn'] as const).flatMap((locale) =>
    RUNTIMES.map((runtime) => ({
      family,
      atom,
      locale,
      runtime,
      route: `/${locale}/ui-libraries/${family}/${family === 'brutalist' ? 'components/' : ''}${atom}/`,
    }))
  )
);
let browser: Browser;
let baseUrl = '';
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const trackedDiff = execFileSync('git', ['diff', '--binary', 'HEAD'], { encoding: 'utf8' });
const untrackedSource = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter(
    (file) =>
      /^(apps\/www\/src|scripts\/test|packages|spec)\//.test(file) &&
      /\.(?:[cm]?[jt]sx?|mdx?|json|ya?ml)$/.test(file)
  );
const sourceDirty = trackedDiff.length > 0 || untrackedSource.length > 0;
const sourceDigest = createHash('sha256').update(sourceSha).update(trackedDiff);
for (const file of untrackedSource.sort()) sourceDigest.update(file).update(readFileSync(file));
const sourceSnapshotSha256 = sourceDigest.digest('hex');
const runId = `${new Date().toISOString().replaceAll(':', '-')}-${process.pid}`;
const evidence = path.join(
  process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ?? tmpdir(),
  'passive-atom-docs',
  `${sourceSha.slice(0, 12)}-${runId}`
);

beforeAll(async () => {
  await mkdir(evidence, { recursive: true });
  baseUrl = await startServer('/en/ui-libraries/base/text/');
  browser = await launchBrowser();
}, 180_000);
afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    await stopServer();
  }
}, 60_000);

describe.sequential('Public passive atom documentation previews', () => {
  it.each(cases)(
    '$locale/$family/$atom/$runtime retains public content and passive ownership',
    async ({ family, atom, locale, runtime, route }) => {
      const example = atom === 'text' ? textExamples[family] : surfaceExamples[family];
      const expectedAtoms = example.roots;
      const context = await browser.newContext({
        viewport: { width: 1280, height: 1000 },
        colorScheme: 'light',
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(installShellRecorder);
      const name = `${locale}-${family}-${atom}-${runtime}`;
      let documentTypography: Record<string, unknown> | null = null;
      try {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
        const preview = page.locator('[data-previewer-id]').first();
        const readinessDeadline = Date.now() + 20_000;
        await selectRuntime(page, preview, runtime, '[data-pui-root]', expectedAtoms);
        if (Date.now() >= readinessDeadline)
          throw new Error('Passive atom readiness exceeded its original 20-second budget');
        // A preparing hidden/empty candidate is not another active content owner.
        // Keep every observed candidate in the trace; never use .first() to hide duplicates.
        await page.waitForFunction(
          () => {
            const state = (window as typeof window & { __passiveAtomEvidence: ShellRecorder })
              .__passiveAtomEvidence;
            const latest = state.traces.at(-1);
            return latest?.slots.filter((slot) => slot.active).length === 1;
          },
          undefined,
          { timeout: Math.max(1, readinessDeadline - Date.now()) }
        );
        await page.waitForFunction(
          () => {
            // Select content is portalled outside the preview; observe its real document surface.
            return [...document.querySelectorAll<HTMLElement>('[role="listbox"]')].every(
              (listbox) => {
                for (let node: HTMLElement | null = listbox; node; node = node.parentElement) {
                  const style = getComputedStyle(node);
                  if (node.hidden || style.display === 'none' || style.visibility === 'hidden')
                    return true;
                }
                return listbox.getClientRects().length === 0;
              }
            );
          },
          undefined,
          { timeout: Math.max(1, readinessDeadline - Date.now()) }
        );
        if (Date.now() >= readinessDeadline)
          throw new Error(
            'Passive atom frame/menu readiness exceeded its original 20-second budget'
          );
        const shellEvidence = await page.evaluate(
          () =>
            (window as typeof window & { __passiveAtomEvidence: ShellRecorder })
              .__passiveAtomEvidence
        );
        expect(
          shellEvidence.traces.every(
            (trace) => trace.slots.filter((slot) => slot.active).length <= 1
          )
        ).toBe(true);
        expect(shellEvidence.events.length).toBeGreaterThan(0);
        expect(shellEvidence.events.every(readyEventHasExpectedOwner)).toBe(true);
        const facts = await preview.evaluate((root) => {
          // Code-copy controls own a separate projection outside the rendered demo.
          const host = root.querySelector<HTMLElement>('[data-panel="preview"] .host');
          if (!host) throw new Error('Public preview host is missing');
          const slots = [...host.querySelectorAll<HTMLElement>('[data-passive-shell-slot]')];
          const active = slots.filter((slot) => {
            if (
              !slot.querySelector('[data-demo-ref="__website_runtime_preview_surface__-content"]')
            )
              return false;
            for (
              let ancestor: HTMLElement | null = slot;
              ancestor && ancestor !== root;
              ancestor = ancestor.parentElement
            ) {
              const style = getComputedStyle(ancestor);
              if (
                ancestor.hidden ||
                ancestor.inert ||
                style.display === 'none' ||
                style.visibility === 'hidden'
              )
                return false;
            }
            return slot.querySelectorAll('[data-pui-root]').length > 0;
          });
          if (active.length !== 1)
            throw new Error(
              `Expected exactly one active borrowed-content frame, got ${active.length}`
            );
          const content = active[0];
          const nodes = [...content.querySelectorAll<HTMLElement>('[data-pui-root]')];
          return nodes.map((node) => {
            const style = getComputedStyle(node);
            return {
              ref: node.getAttribute('data-demo-ref'),
              text: node.textContent?.trim(),
              role: node.getAttribute('role'),
              tabIndex: node.tabIndex,
              display: style.display,
              emittedStyle: node.getAttribute('data-pui-style'),
              width: node.getBoundingClientRect().width,
              height: node.getBoundingClientRect().height,
              size: Number.parseFloat(style.fontSize),
              fontFamily: style.fontFamily,
              fontWeight: style.fontWeight,
              decoration: style.textDecorationLine,
              color: style.color,
              background: style.backgroundColor,
              radius: style.borderRadius,
              shadow: style.boxShadow,
              transform: style.transform,
            };
          });
        });
        // P-BASE-TEXT-PASSIVE / P-BASE-SURFACE-PASSIVE: a visual sample must not gain input ownership.
        expect(facts).toHaveLength(expectedAtoms);
        // selectRuntime's Shadcn count includes the Rhea style-scope. That
        // root is an admitted `display: contents` carrier: it has descendant
        // text, no box, and no emitted `data-pui-style`. Paint settles on the
        // following atoms. Indexing facts[0] would read the unsettled scope.
        const samples = facts.filter((fact) => fact.display !== 'contents');
        if (family === 'shadcn') {
          const scopes = facts.filter((fact) => fact.display === 'contents');
          expect(scopes).toHaveLength(1);
          expect(scopes[0]?.emittedStyle ?? null).toBeNull();
          expect(scopes[0]?.role).toBeNull();
          expect(scopes[0]?.tabIndex).toBe(-1);
          expect(samples).toHaveLength(expectedAtoms - 1);
        } else {
          expect(samples).toHaveLength(expectedAtoms);
        }
        for (const fact of samples) {
          expect(fact.text?.length).toBeGreaterThan(0);
          expect(fact.role).toBeNull();
          expect(fact.tabIndex).toBe(-1);
          expect(fact.width).toBeGreaterThan(0);
          expect(fact.height).toBeGreaterThan(0);
        }
        const sample = (text: string) => {
          const match = samples.find((fact) => fact.text === text);
          expect(match, `${family}/${atom} authored sample: ${text}`).toBeDefined();
          return match!;
        };
        if (atom === 'text') {
          expect(samples[0].text).toBe(textExamples[family].title);
          if (family !== 'base') {
            expect(samples[0].size).toBeGreaterThan(samples[1].size);
            expect(sample(textExamples[family].underlined).decoration).toContain('underline');
          }
        } else {
          expect(samples[0].text).toContain(surfaceExamples[family].title);
          if (family === 'shadcn') {
            expect(sample('Publish Release').shadow).not.toBe('none');
            expect(sample('Elevated Callout').shadow).not.toBe('none');
            expect(sample('Elevated Callout').transform).toBe('none');
          } else if (family === 'brutalist') {
            expect(sample('Raised Action').shadow).not.toBe('none');
            expect(sample('Pressed Snap').transform).not.toBe('none');
          } else if (family === 'liquid-glass') {
            expect(samples[0].shadow).not.toBe('none');
            const opaque = sample(
              'Opaque content card nested with concentric corners (12px outer = 8px inner + 4px padding).'
            );
            expect(opaque.background).not.toBe('rgba(0, 0, 0, 0)');
            expect(sample('Prominent Action').background).not.toBe('rgba(0, 0, 0, 0)');
          }
          if (family === 'bootstrap-2-3-2') {
            // Current public hero separates navbar facts from Button-profile
            // paint. The historical cross-context props matrix remains in
            // prototypes-bootstrap-2-3-2/test/navbar-surface.test.ts and its
            // real CSS lowering checks; it is not a nonexistent public demo.
            expect(sample('Overview').color).toBe('rgb(255, 255, 255)');
            expect(sample('Overview').background).not.toBe(sample('Components').background);
            expect(sample('Docs').shadow).not.toBe('none');
            expect(
              sample('Thumbnail frame using classic Bootstrap 2.3.2 border and subtle lift.').shadow
            ).not.toBe('none');
            expect(sample('Primary Action').shadow).not.toBe('none');
            expect(sample('Pressed Primary').shadow).not.toBe(sample('Primary Action').shadow);
          }
        }
        expect(errors).toEqual([]);
        await preview.screenshot({ path: path.join(evidence, `${name}.png`) });
        const documentCapture =
          family === 'shadcn' && atom === 'surface' && runtime === 'wc'
            ? `${name}-document.png`
            : null;
        if (documentCapture) {
          await page.evaluate(() => document.fonts.ready);
          const selector = DOCUMENT_TYPOGRAPHY_SELECTOR;
          const computed = await page.locator(selector).evaluate((node) => {
            const css = getComputedStyle(node);
            return {
              text: node.textContent,
              html: node.innerHTML,
              family: css.fontFamily,
              size: css.fontSize,
              weight: css.fontWeight,
              lineHeight: css.lineHeight,
            };
          });
          documentTypography = { selector, computed, renderedSample: null, platformFonts: [] };
          const cdp = await context.newCDPSession(page);
          try {
            await cdp.send('DOM.enable');
            await cdp.send('CSS.enable');
            await cdp.send('DOM.getDocument');
            // Typography preserves the native paragraph but projects authored text
            // through a nested Text slot. Query the real text-bearing element,
            // as the existing typography evidence does, not its empty native owner.
            const { result } = await cdp.send('Runtime.evaluate', {
              expression: `(${findDocumentFontSample.toString()})(${JSON.stringify(selector)}, ${locale === 'zh-cn'})`,
              objectGroup: 'passive-atom-document-fonts',
            });
            expect(result.objectId, 'An actual text-bearing document element').toBeTruthy();
            const { nodeId } = await cdp.send('DOM.requestNode', { objectId: result.objectId! });
            expect(nodeId).toBeGreaterThan(0);
            const sample = await cdp.send('Runtime.callFunctionOn', {
              objectId: result.objectId!,
              functionDeclaration: `function() {
                const css = getComputedStyle(this);
                return { tag: this.localName, text: this.textContent,
                  directText: Array.from(this.childNodes).filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent),
                  family: css.fontFamily,
                  size: css.fontSize, weight: css.fontWeight, lineHeight: css.lineHeight };
              }`,
              returnByValue: true,
            });
            const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
            documentTypography = {
              scope:
                'Actual text-bearing element within first paragraph; whole-page visual inspection required',
              selector,
              computed,
              renderedSample: sample.result.value,
              platformFonts: fonts,
            };
            expect(fonts.some((font) => font.glyphCount > 0)).toBe(true);
            if (locale === 'zh-cn') {
              expect(computed.text).toMatch(/[\u3400-\u9fff]/);
              expect(fonts.some((font) => /CJK/.test(font.familyName) && font.glyphCount > 0)).toBe(
                true
              );
            }
          } finally {
            await cdp.send('Runtime.releaseObjectGroup', {
              objectGroup: 'passive-atom-document-fonts',
            });
            await cdp.detach();
          }
          await page.screenshot({ path: path.join(evidence, documentCapture), fullPage: true });
        }
        await writeFile(
          path.join(evidence, `${name}.json`),
          JSON.stringify(
            {
              sourceSha,
              sourceDirty,
              sourceSnapshotSha256,
              runId,
              route,
              runtime,
              viewport: { width: 1280, height: 1000 },
              theme: 'light',
              captures: { preview: `${name}.png`, document: documentCapture },
              documentTypography,
              facts,
              shellEvidence,
              errors,
            },
            null,
            2
          )
        );
      } catch (error) {
        const shellEvidence = await page.evaluate(
          () =>
            (window as typeof window & { __passiveAtomEvidence?: ShellRecorder })
              .__passiveAtomEvidence ?? null
        );
        await writeFile(
          path.join(evidence, `${name}-failure.json`),
          JSON.stringify(
            {
              sourceSha,
              sourceDirty,
              sourceSnapshotSha256,
              runId,
              route,
              runtime,
              error: String(error),
              documentTypography,
              shellEvidence,
              errors,
            },
            null,
            2
          )
        );
        await page.screenshot({ path: path.join(evidence, `${name}-failure.png`), fullPage: true });
        throw error;
      } finally {
        await context.close();
      }
    },
    90_000
  );
});
