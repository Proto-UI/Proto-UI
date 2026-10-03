import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import command from './demo-base-transition-command.demo';
import controlled from './demo-base-transition-controlled.demo';

type LayoutNode = { className?: string; ref?: string; children?: readonly unknown[] };
function nodes(root: unknown): LayoutNode[] {
  if (!root || typeof root !== 'object') return [];
  const node = root as LayoutNode;
  return [node, ...(node.children ?? []).flatMap(nodes)];
}
describe('Transition example app layout bounds', () => {
  it('bounds the actual generic RuntimeBox grid instead of hiding overflowing content', () => {
    const source = readFileSync(
      'apps/www/src/components/PrototypePreviewer/PrototypePreviewer.astro',
      'utf8'
    );
    const root = source.match(/\.proto-previewer \{([^}]+)\}/)![1]!;
    expect(root).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(root).toContain('min-width: 0');
    expect(root).not.toMatch(/overflow:\s*(hidden|clip)/);
    for (const name of [
      '.proto-previewer__header',
      '.proto-previewer__preview-panel',
      '.proto-previewer__preview .host',
    ]) {
      const body = source.slice(source.indexOf(name + ' {')).split('}')[0]!;
      expect(body).toContain('min-width: 0');
    }
  });

  it.each([
    ['command', command],
    ['controlled', controlled],
  ] as const)(
    '%s keeps desktop box width while allowing narrow composition reflow',
    (_name, demo) => {
      expect(demo.root.className.split(' ')).toEqual(
        expect.arrayContaining(['w-full', 'min-w-0', 'max-w-full'])
      );
      const tree = nodes(demo.root);
      const wrapper = tree.find((node) => 'ref' in node && node.ref === 'transition')!;
      expect('className' in wrapper && wrapper.className).toContain('max-w-full');
      const box = tree.find(
        (node) => 'className' in node && node.className?.includes('transition-box')
      )!;
      expect('className' in box && box.className?.split(' ')).toEqual(
        expect.arrayContaining(['w-64', 'max-w-full', 'h-40'])
      );
      const states = tree.find(
        (node) => 'className' in node && node.className?.includes('text-xs')
      )!;
      expect('className' in states && states.className?.split(' ')).toEqual(
        expect.arrayContaining(['max-w-full', 'flex-wrap', 'justify-center'])
      );
      // Layout-only correction: no masking, clipped content or semantic changes.
      expect(
        tree.some(
          (node) => 'className' in node && /overflow-(?:hidden|clip)/.test(node.className ?? '')
        )
      ).toBe(false);
    }
  );
});
