import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { afterEach, expect, it, vi } from 'vitest';
import { readReadingReflow } from './reading-reflow-evidence';
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
it('executes the exact keepNames-transformed page probe without hidden transform helpers', () => {
  const source = readFileSync('apps/www/src/content/docs/zh-cn/reading-reflow-evidence.ts', 'utf8');
  const module = { exports: {} as { readReadingReflow: typeof readReadingReflow } };
  runInNewContext(transformSync(source, { loader: 'ts', format: 'cjs', keepNames: true }).code, {
    module,
    exports: module.exports,
  });
  const serialized = module.exports.readReadingReflow.toString();
  expect(serialized).not.toMatch(/\b__name\s*\(/);
  document.body.innerHTML =
    '<div class="docs-reading-columns"><aside class="docs-sidebar"></aside><aside class="right-sidebar-container"><div class="right-sidebar"><div class="right-sidebar-panel"><div class="sl-container"><sl-toc><nav><a href="#_top">Overview</a></nav></sl-toc></div></div></div></aside><main class="main-pane"></main></div><header data-docs-site-header><div class="site-header-brand"></div><div class="site-header-search"></div><div class="site-header-theme"></div><div class="site-header-menu"></div></header>';
  for (const link of document.querySelectorAll('a'))
    Object.defineProperty(link, 'checkVisibility', { value: () => true });
  const probe = runInNewContext(`(${serialized})`, {
    document,
    innerWidth: 1440,
    getComputedStyle,
  });
  const result = probe();
  expect(result.viewportWidth).toBe(1440);
  expect(Object.keys(result.boxes)).toHaveLength(9);
  expect(result.controls).toHaveLength(4);
  expect(result.visibleTocLinks).toHaveLength(1);
});
