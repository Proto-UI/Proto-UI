import { describe, expect, it } from 'vitest';
import { compile } from 'tailwindcss';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const theme = readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');
import bootstrap from '../demo-bootstrap-2-3-2-select.demo';
import liquid from '../demo-liquid-glass-select.demo';
import type { DemoChild, DemoNode } from '@/components/PrototypePreviewer/demo-types';

// Source/compiled-CSS regression controls only. Native track sizing, overflow
// and keyboard access remain owned by the unchanged 320px/200% browser journey.
function nodes(root: DemoChild): DemoNode[] {
  if (typeof root === 'string') return [];
  return [root, ...('children' in root ? (root.children ?? []).flatMap(nodes) : [])];
}
function tokens(node: DemoNode): string[] {
  return 'className' in node ? (node.className ?? '').split(/\s+/) : [];
}
function text(node: DemoChild): string {
  if (typeof node === 'string') return node;
  if (node.kind === 'text') return node.text;
  return (node.children ?? []).map(text).join('');
}
for (const [family, demo] of [
  ['bootstrap-2-3-2', bootstrap],
  ['liquid-glass', liquid],
] as const) {
  describe(`${family} Select demo intrinsic-width recipe`, () => {
    it('uses zero-minimum explicit tracks in both outer and RTL grids', async () => {
      const grids = nodes(demo.root).filter((node) => tokens(node).includes('grid'));
      expect(grids).toHaveLength(2);
      for (const grid of grids) {
        expect(tokens(grid)).toContain('grid-cols-1');
        expect(tokens(grid)).toContain('min-w-0');
        const stylesheet = await compile(`${theme}\n@tailwind utilities;`);
        expect(stylesheet.build(tokens(grid))).toContain(
          'grid-template-columns: repeat(1, minmax(0, 1fr))'
        );
      }
    });
    it('allows ordinary demo copy to wrap at intrinsic sizing boundaries', async () => {
      expect(tokens(demo.root)).toContain('wrap-anywhere');
      const stylesheet = await compile(`${theme}\n@tailwind utilities;`);
      expect(stylesheet.build(tokens(demo.root))).toContain('overflow-wrap: anywhere');
    });
    it('keeps the real Button and full accessible label while overriding inherited nowrap on its child', async () => {
      const button = nodes(demo.root).find((node) => 'ref' in node && node.ref === 'accept')!;
      expect(button.kind).toBe('proto');
      if (button.kind !== 'proto') throw new Error('Expected real Button');
      expect(button.prototypeId).toBe(`${family}-button`);
      expect(tokens(button)).toEqual(expect.arrayContaining(['min-w-0', 'max-w-full']));
      const label = button.children?.[0];
      expect(label && typeof label === 'object' && label.kind).toBe('box');
      if (!label || typeof label === 'string' || label.kind !== 'box')
        throw new Error('Expected wrap label');
      expect(label.tag).toBe('span');
      expect(text(button)).toBe('Accept selection');
      expect(tokens(label)).toEqual(
        expect.arrayContaining(['min-w-0', 'whitespace-normal', 'wrap-anywhere'])
      );
      const stylesheet = await compile(`${theme}\n@tailwind utilities;`);
      const css = stylesheet.build(tokens(label));
      expect(css).toContain('min-width:');
      expect(css).toContain('white-space: normal');
      expect(css).toContain('overflow-wrap: anywhere');
      expect(label.attrs).toBeUndefined(); // No aria-hidden/name substitution.
    });
    it('does not conceal content, impose fixed height, or replace existing selection behavior', () => {
      for (const node of nodes(demo.root)) {
        expect(
          tokens(node).some((token) =>
            /^(overflow(?:-[xy])?-(?:hidden|clip)|truncate|line-clamp-|h-)/.test(token)
          )
        ).toBe(false);
      }
      const all = nodes(demo.root);
      expect(
        all.filter((node) => node.kind === 'proto' && node.prototypeId === `${family}-select-root`)
      ).toHaveLength(4);
      const rtl = all.find((node) => node.kind === 'box' && node.attrs?.dir === 'rtl');
      expect(rtl).toBeDefined();
      expect(text(demo.root)).toContain(
        'VeryLongUnbrokenOptionLabelsMustRemainReadableAtTwoHundredPercentTextSize'
      );
      expect(demo.setup).toBeTypeOf('function');
    });
  });
}

// This controls the authored 320px/200% inset allocation, not native layout.
it('uses only an opt-in Select preview inset and removes duplicate narrow demo padding', () => {
  for (const locale of ['en', 'zh-cn'])
    for (const family of ['bootstrap-2-3-2', 'liquid-glass']) {
      const page = readFileSync(
        `apps/www/src/content/docs/${locale}/ui-libraries/${family}/select.mdx`,
        'utf8'
      );
      expect(page).toContain('class="select-content-preview"');
    }
  const css = readFileSync('apps/www/src/styles/runtime-box.css', 'utf8');
  expect(css).toContain('.pui-runtime-box.select-content-preview');
  expect(css).toContain('--runtime-box-content-padding: 1.25rem 0;');
  for (const demo of [bootstrap, liquid]) {
    expect(tokens(demo.root)).toContain('p-0');
    expect(tokens(demo.root)).toContain('sm:p-2');
    expect(tokens(demo.root)).not.toContain('p-2');
  }
});
