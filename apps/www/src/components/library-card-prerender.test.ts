import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { snapshotLibraryPart } from './library-card-snapshot';
import { renderSnapshotTokenCss } from './snapshot-prototype-style';
import { libraryActionAppearanceForFamily } from './library-card-prototypes';

// Execute the actual Astro frontmatter declarations with the real snapshotter.
// This checks serialization and CSS membership, not native geometry or paint.
const frontmatter = readFileSync('apps/www/src/components/LibraryCardPart.astro', 'utf8').split(
  '---'
)[1]!;
const declarations = frontmatter.slice(frontmatter.indexOf('const { part'));
const javascript = ts.transpileModule(declarations, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const evaluateSnapshot = new AsyncFunction(
  'Astro',
  'snapshotLibraryPart',
  'createHash',
  javascript + '\nreturn { Tag, tokens, cssTokens, snapshotId, snapshotScope, layout: typeof layout === "undefined" ? undefined : layout };'
);
const snapshot = (part: string, props: Record<string, unknown>) =>
  evaluateSnapshot({ props: { part, props } }, snapshotLibraryPart, createHash) as Promise<{
    Tag: string;
    tokens: string[];
    cssTokens: string[];
    snapshotId: string;
    snapshotScope: string;
  }>;

it('prerenders the actual Rhea action recipe and all native-state CSS with its layout', async () => {
  const action = libraryActionAppearanceForFamily('shadcn');
  const result = await evaluateSnapshot(
    { props: { part: 'shadcn-surface', props: action.surface, layout: action.layout } },
    snapshotLibraryPart,
    createHash
  );
  expect(result.Tag).toBe('wc-library-shadcn-surface');
  // Public passive action contract: layout is serialized and state paint is
  // available before upgrade, independently of a second snapshot evaluation.
  const layout = document.createElement('span');
  Object.assign(layout.style, result.layout);
  expect(layout.style.display).toBe('inline-flex');
  expect(layout.style.gap).toBe('0.375rem');
  expect(layout.style.minHeight).toBe('2rem');
  const css = renderSnapshotTokenCss(result.cssTokens, result.snapshotScope);
  for (const declaration of [
    'border-radius: var(--pui-radius-2xl);',
    'background-color: var(--pui-primary);',
    'color: var(--pui-primary-foreground);',
    'border-color: transparent;',
    'color-mix(in oklab, var(--pui-primary) 80%, transparent)',
    'border-color: var(--pui-ring);',
    '--pui-ring-width: 3px;',
    '--pui-translate-y: 1px;',
    'outline-color: Highlight',
  ]) expect(css).toContain(declaration);
  expect(css).not.toContain('0 1px 2px');
  const selectors = [...css.matchAll(/(:where\([^{}]+\))\s*\{/g)].map((rule) => rule[1]!);
  expect(selectors.length).toBeGreaterThan(0);
  expect(selectors.every((selector) => selector.includes(result.snapshotId))).toBe(true);

});

it('binds each real Card token set to a deterministic, exact snapshot host', async () => {
  const title = await snapshot('shadcn-text', { size: '2xl', leading: 'tight' });
  const caption = await snapshot('shadcn-text', { size: 'sm', leading: 'normal' });
  const again = await snapshot('shadcn-text', { size: '2xl', leading: 'tight' });
  expect(title.Tag).toBe('wc-library-shadcn-text');
  expect(title.snapshotId).toMatch(/^[a-f0-9]{64}$/);
  expect(title.snapshotId).toBe(again.snapshotId);
  expect(title.snapshotId).not.toBe(caption.snapshotId);
  const host = document.createElement(title.Tag);
  host.setAttribute('data-library-snapshot', title.snapshotId);
  host.setAttribute('data-pui-style', title.tokens.join(' '));
  const css = renderSnapshotTokenCss(caption.cssTokens, caption.snapshotScope);
  const selectors = [...css.matchAll(/(:where\([^{}]+\))\s*\{/g)].map((rule) => rule[1]!);
  expect(selectors.length).toBeGreaterThan(0);
  expect(selectors.every((selector) => selector.includes(caption.snapshotId))).toBe(true);
  expect(selectors.some((selector) => host.matches(selector))).toBe(false);
});

it('retains interactive Surface token membership without sharing other recipe scopes', async () => {
  const action = await snapshot('shadcn-surface', { variant: 'solid', elevation: 'raised' });
  const passive = await snapshot('base-surface', {});
  expect(action.cssTokens).toContain('bg-primary/80');
  expect(passive.tokens).toEqual([]);
  expect(passive.snapshotId).not.toBe(action.snapshotId);
  const css = renderSnapshotTokenCss(action.cssTokens, action.snapshotScope);
  expect(css).toContain(action.snapshotId);
  expect(css).toContain('[data-pui-style~=');
  expect(css).not.toContain('--pui-shadow: initial');
});

it('uses the private optical tag only for the actual Liquid Surface recipe', async () => {
  const props = { variant: 'outline', radius: 'full', border: 'none', elevation: 'none' };
  const candidate = await evaluateSnapshot(
    { props: { part: 'liquid-glass-surface', props, candidateTag: true } },
    snapshotLibraryPart,
    createHash
  );
  const ordinary = await snapshot('liquid-glass-surface', props);
  expect(candidate.Tag).toBe('wc-library-liquid-optical-surface');
  expect(candidate.tokens).toEqual(ordinary.tokens);
  expect(candidate.snapshotId).toBe(ordinary.snapshotId);
  await expect(
    evaluateSnapshot(
      { props: { part: 'base-surface', candidateTag: true } },
      snapshotLibraryPart,
      createHash
    )
  ).rejects.toThrow('actual Liquid Surface');
});
