import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const frame = readFileSync('apps/www/src/components/override/PageFrame.astro', 'utf8');
const columns = readFileSync('apps/www/src/components/override/TwoColumnContent.astro', 'utf8');
describe('documentation shell composition contract', () => {
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
