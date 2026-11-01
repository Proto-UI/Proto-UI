import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const frame = readFileSync('apps/www/src/components/override/PageFrame.astro', 'utf8');
const columns = readFileSync('apps/www/src/components/override/TwoColumnContent.astro', 'utf8');

function expectRootReflowAfterWideGrid(source: string) {
  // Astro 5 reverses separate style tags by default. Source-order assertions
  // are meaningful here only if both equal-specificity rules share one tag.
  const styles = [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)];
  expect(styles, 'the grid and its reflow override need one emitted style block').toHaveLength(1);
  const css = styles[0]![1]!.replace(/\/\*[\s\S]*?\*\//g, '');
  const wideMedia = [...css.matchAll(/@media\s*\(min-width:\s*80rem\)/g)];
  expect(wideMedia, 'both original viewport gates must remain 80rem').toHaveLength(2);
  const grid = [
    ...css.matchAll(/\.docs-reading-columns\[data-layout='docs'\]\s*\{\s*display:\s*grid;/g),
  ];
  const reflow = [...css.matchAll(/@container\s+docs-canvas\s*\(max-width:\s*72rem\)/g)];
  const flex = [
    ...css.matchAll(
      /\.docs-reading-columns\[data-layout='docs'\]\s*\{\s*display:\s*flex;\s*flex-direction:\s*column;/g
    ),
  ];
  expect(grid, 'the wide grid remains present exactly once').toHaveLength(1);
  expect(reflow, 'the root-scaled container gate must remain 72rem').toHaveLength(1);
  expect(flex, 'the existing ungated column override remains present exactly once').toHaveLength(1);
  expect(wideMedia[0]!.index).toBeLessThan(grid[0]!.index!);
  expect(grid[0]!.index).toBeLessThan(wideMedia[1]!.index!);
  expect(wideMedia[1]!.index).toBeLessThan(reflow[0]!.index!);
  expect(reflow[0]!.index).toBeLessThan(flex[0]!.index!);
}

function reverseWideMediaBlocks(source: string) {
  const style = /<style\b[^>]*>([\s\S]*?)<\/style>/.exec(source)!;
  const css = style[1]!;
  const media = [...css.matchAll(/@media\s*\(min-width:\s*80rem\)/g)];
  const first = media[0]!.index!;
  const second = media[1]!.index!;
  return source.replace(css, css.slice(0, first) + css.slice(second) + css.slice(first, second));
}

describe('documentation shell composition contract', () => {
  it('emits the root-scaled reflow after the wide grid inside one Astro style block', () => {
    expectRootReflowAfterWideGrid(columns);
  });

  it.each([
    [
      'separate style tags',
      (source: string) =>
        source.replace(/(?=@media\s*\(min-width:\s*80rem\)\s*\{\s*@container)/, '</style><style>'),
    ],
    ['reversed media blocks', reverseWideMediaBlocks],
    [
      'changed viewport gate',
      (source: string) => source.replace('min-width: 80rem', 'min-width: 90rem'),
    ],
    [
      'changed root-relative budget',
      (source: string) => source.replace('max-width: 72rem', 'max-width: 80rem'),
    ],
    [
      'lost flex override',
      (source: string) =>
        source.replace(
          'display: flex;\n        flex-direction: column;',
          'display: grid;\n        flex-direction: column;'
        ),
    ],
  ] as const)('rejects a broken reflow cascade: %s', (_name, mutate) => {
    // Mutation controls start from the same declarations in one block, even
    // when the baseline source still has two. The positive test above always
    // checks the unmodified source and therefore catches that baseline defect.
    const singleStyleFixture = columns.replace(/<\/style>\s*<style>/g, '\n');
    expectRootReflowAfterWideGrid(singleStyleFixture);
    const broken = mutate(singleStyleFixture);
    expect(broken).not.toBe(singleStyleFixture);
    expect(() => expectRootReflowAfterWideGrid(broken)).toThrow();
  });

  it('separates full-width safe gutters from rail width and bounded reading measure', () => {
    expect(frame).toContain('--docs-shell-gutter: clamp(1rem, 2vw, 2rem)');
    expect(frame).toContain('--docs-reading-width: 42rem');
    expect(frame).toContain('--docs-toc-width: 18rem');
    expect(frame).toContain('padding-inline: var(--docs-shell-gutter)');
    expect(frame).not.toContain('max-width: 85rem');
    expect(frame).not.toContain('3xl:fixed:container');
    expect(columns).toContain('grid-template-columns: minmax(0, 1fr) var(--docs-toc-width, 18rem)');
    expect(columns).toContain('max-width: var(--docs-reading-width, 42rem)');
    expect(columns).not.toContain('100% - var(--sl-content-width)');
  });
  it('retains root-relative reflow, native rail slots and independent narrow navigation', () => {
    expect(frame).toContain('container: docs-canvas / inline-size');
    expect(columns).toContain('@container docs-canvas (max-width: 72rem)');
    expect(columns).toContain('flex-direction: column');
    expect(columns.match(/<slot name="right-sidebar"/g)).toHaveLength(1);
    expect(frame.match(/<slot name="sidebar"/g)).toHaveLength(1);
    expect(frame).toContain('<noscript>');
    expect(frame).toContain('initSiteSidebarCurrentVisibility');
    expect(columns).toContain('top: calc(var(--header-height) + 1px)');
  });
  it('assigns sticky offset and scrolling to the outer TOC rail only', () => {
    const outerMatch = columns.match(
      /\.docs-reading-columns\[data-layout='docs'\] > \.right-sidebar-container\s*\{([^}]+)\}/
    );
    const innerMatch = columns.match(
      /\.docs-reading-columns\[data-layout='docs'\] \.right-sidebar\s*\{([^}]+)\}/
    );
    expect(outerMatch, 'the docs composition must own its outer TOC rail').not.toBeNull();
    expect(innerMatch, 'the docs composition must reset its inner TOC wrapper').not.toBeNull();
    const outer = outerMatch![1];
    const inner = innerMatch![1];
    expect(outer).toContain('position: sticky');
    expect(outer).toContain('overflow-y: auto');
    expect(outer).toContain('height: calc(100svh - var(--header-height) - 1px)');
    expect(inner).toContain('position: static');
    expect(inner).toContain('padding-block: 0');
    expect(inner).toContain('overflow: visible');
    expect(columns).not.toContain('padding-top: var(--sl-nav-height)');
    expect(frame).toContain('height: calc(100svh - var(--header-height) - 1px)');
    const plan = readFileSync('scripts/test/runtime-test-plan.mjs', 'utf8');
    expect(plan.match(/site-docs-columns\.browser\.test\.ts/g)).toHaveLength(1);
  });
});
