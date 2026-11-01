import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const frame = readFileSync('apps/www/src/components/override/PageFrame.astro', 'utf8');
const columns = readFileSync('apps/www/src/components/override/TwoColumnContent.astro', 'utf8');

function expectRightRailOrHidden(source: string) {
  // One emitted style block prevents Astro5 reversing equal-specificity rules.
  // This source guard preserves structure; native geometry is the acceptance
  // oracle for the estimated canvas budget, not a duplicated numeric constant.
  const styles = [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)];
  expect(styles).toHaveLength(1);
  const css = styles[0]![1]!.replace(/\/\*[\s\S]*?\*\//g, '');
  const wideMedia = [...css.matchAll(/@media\s*\(min-width:\s*80rem\)/g)];
  expect(wideMedia).toHaveLength(2);
  const grid = [
    ...css.matchAll(/\.docs-reading-columns\[data-layout='docs'\]\s*\{\s*display:\s*grid;/g),
  ];
  const guard = [...css.matchAll(/@container\s+docs-canvas\s*\(max-width:\s*[\d.]+rem\)/g)];
  expect(grid).toHaveLength(1);
  expect(guard).toHaveLength(1);
  expect(grid[0]!.index).toBeLessThan(guard[0]!.index!);
  expect(css).not.toMatch(/flex-direction:\s*column|order:\s*0/);
  const hiddenRule =
    /\.docs-reading-columns\[data-layout='docs'\] > \.right-sidebar-container\s*\{\s*display:\s*none;\s*\}/;
  expect(css.slice(0, wideMedia[0]!.index)).toMatch(hiddenRule);
  const enlargement = css.slice(guard[0]!.index);
  expect(enlargement).toMatch(hiddenRule);
  expect(enlargement).toMatch(
    /:has\(> \.right-sidebar-container\)\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\);\s*\}/
  );
  expect(css).toContain('grid-template-columns: minmax(0, 1fr) var(--docs-toc-width, 18rem)');
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
  it('keeps the right rail alongside prose or hidden, with one emitted cascade', () => {
    expectRightRailOrHidden(columns);
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
      'TOC lifted above prose',
      (source: string) => source.replace('display: none;', 'display: flex; order: 0;'),
    ],
    [
      'narrow canvas keeps an empty right track',
      (source: string) =>
        source.replace(
          'grid-template-columns: minmax(0, 1fr);\n      }',
          'grid-template-columns: minmax(0, 1fr) var(--docs-toc-width, 18rem);\n      }'
        ),
    ],
    [
      'lost visible wide rail',
      (source: string) =>
        source.replace(
          'grid-template-columns: minmax(0, 1fr) var(--docs-toc-width, 18rem)',
          'grid-template-columns: minmax(0, 1fr)'
        ),
    ],
  ] as const)('rejects a broken rail visibility cascade: %s', (_name, mutate) => {
    // These are current-candidate mutation checks, not independent baseline
    // conformance evidence. A baseline that fails the positive precondition
    // never executes its mutation; keep that failure distinct in reports.
    const singleStyleFixture = columns.replace(/<\/style>\s*<style>/g, '\n');
    expectRightRailOrHidden(singleStyleFixture);
    const broken = mutate(singleStyleFixture);
    expect(broken).not.toBe(singleStyleFixture);
    expect(() => expectRightRailOrHidden(broken)).toThrow();
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
  it('retains a single native rail slot and independent narrow navigation', () => {
    expect(frame).toContain('container: docs-canvas / inline-size');
    expectRightRailOrHidden(columns);
    expect(columns).not.toContain('max-width: 72rem');
    expect(columns.match(/<slot name="right-sidebar"/g)).toHaveLength(1);
    expect(frame.match(/<slot name="sidebar"/g)).toHaveLength(1);
    expect(frame).toContain('<noscript>');
    expect(frame).toContain('initSiteSidebarCurrentVisibility');
    expect(columns).toContain('top: calc(var(--header-height) + 1px)');
  });
  it('assigns sticky offset and scrolling to the outer TOC rail only', () => {
    const outerMatch = [
      ...columns.matchAll(
        /\.docs-reading-columns\[data-layout='docs'\] > \.right-sidebar-container\s*\{([^}]+)\}/g
      ),
    ].find((match) => match[1]!.includes('position: sticky'));
    const innerMatch = columns.match(
      /\.docs-reading-columns\[data-layout='docs'\] \.right-sidebar\s*\{([^}]+)\}/
    );
    expect(outerMatch, 'the docs composition must own its outer TOC rail').toBeDefined();
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
