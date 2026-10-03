// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./PrototypePreviewer.astro', import.meta.url), 'utf8');

function fixedFamilyRule(className: string): string {
  const selector = `.proto-previewer[data-projection-mode='fixed-family'] :global(.${className}) {`;
  const start = source.lastIndexOf(selector);
  expect(start, `${className}: fixed-family layout rule`).toBeGreaterThanOrEqual(0);
  return source.slice(start + selector.length, source.indexOf('}', start));
}

describe('PrototypePreviewer fixed-family consumer layout', () => {
  it('bounds the grid track by available width instead of the runtime label min-content size', () => {
    const scope = fixedFamilyRule('pui-projection-scope');
    expect(scope).toContain('display: grid;');
    expect(scope).toContain('grid-template-columns: minmax(0, 1fr);');
  });

  it('allows both toolbar and content grid items to shrink to the preview frame', () => {
    for (const className of ['pui-projection-controls', 'pui-projection-content']) {
      expect(fixedFamilyRule(className), className).toContain('min-width: 0;');
    }
  });
});
