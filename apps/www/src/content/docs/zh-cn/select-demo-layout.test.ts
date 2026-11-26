import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import bootstrap from '../demo-bootstrap-2-3-2-select.demo';
import bootstrapDisabled from '../demo_components/select/demo-bootstrap-2-3-2-select-disabled.demo';
import bootstrapRtl from '../demo_components/select/demo-bootstrap-2-3-2-select-rtl.demo';
import bootstrapScrollable from '../demo_components/select/demo-bootstrap-2-3-2-select-scrollable.demo';
import liquid from '../demo-liquid-glass-select.demo';
import liquidDisabled from '../demo_components/select/demo-liquid-glass-select-disabled.demo';
import liquidRtl from '../demo_components/select/demo-liquid-glass-select-rtl.demo';
import liquidScrollable from '../demo_components/select/demo-liquid-glass-select-scrollable.demo';
import type { DemoChild, DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

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

const families = [
  {
    family: 'bootstrap-2-3-2',
    hero: bootstrap,
    scrollable: bootstrapScrollable,
    disabled: bootstrapDisabled,
    rtl: bootstrapRtl,
  },
  {
    family: 'liquid-glass',
    hero: liquid,
    scrollable: liquidScrollable,
    disabled: liquidDisabled,
    rtl: liquidRtl,
  },
] as const;

for (const { family, hero, scrollable, disabled, rtl } of families) {
  const allDemos: readonly DemoSpec[] = [hero, scrollable, disabled, rtl];
  describe(`${family} Select demo intrinsic-width recipe`, () => {
    it('keeps wrapping flex containers on multi-control hero and disabled demos', () => {
      for (const demo of [hero, disabled]) {
        const flexWrap = nodes(demo.root).find(
          (node) => tokens(node).includes('flex') && tokens(node).includes('flex-wrap')
        );
        expect(flexWrap).toBeDefined();
      }
    });
    it('keeps the real Button and controlled setup on the hero demo', () => {
      const button = nodes(hero.root).find((node) => 'ref' in node && node.ref === 'resetProduce')!;
      expect(button.kind).toBe('proto');
      if (button.kind !== 'proto') throw new Error('Expected real Button');
      expect(button.prototypeId).toBe(`${family}-button`);
      expect(text(button)).toBe('Reset');
      expect(hero.setup).toBeTypeOf('function');
    });
    it('does not conceal content, impose fixed height, or drop split Select coverage', () => {
      for (const demo of allDemos) {
        for (const node of nodes(demo.root)) {
          expect(
            tokens(node).some((token) =>
              /^(overflow(?:-[xy])?-(?:hidden|clip)|truncate|line-clamp-|h-)/.test(token)
            )
          ).toBe(false);
        }
      }
      const rootCount = allDemos.reduce(
        (sum, demo) =>
          sum +
          nodes(demo.root).filter(
            (node) => node.kind === 'proto' && node.prototypeId === `${family}-select-root`
          ).length,
        0
      );
      expect(rootCount).toBe(5);
      const rtlBox = nodes(rtl.root).find(
        (node) => node.kind === 'box' && node.attrs?.dir === 'rtl'
      );
      expect(rtlBox).toBeDefined();
    });
  });
}

// This controls the authored 320px/200% inset allocation, not native layout.
it('uses an opt-in Select preview inset on both Bootstrap and Liquid Glass Select pages', () => {
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
});

it('keeps all four Liquid Select examples in independent declared static stages', () => {
  const cases = [
    { demo: liquid, expectedRoots: 1 },
    { demo: liquidScrollable, expectedRoots: 1 },
    { demo: liquidDisabled, expectedRoots: 2 },
    { demo: liquidRtl, expectedRoots: 1 },
  ] as const;
  for (const { demo, expectedRoots } of cases) {
    const all = nodes(demo.root);
    const stages = all.filter((node) => node.kind === 'box' && node.materialStage);
    expect(stages).toHaveLength(1);
    const stage = stages[0]!;
    if (stage.kind !== 'box' || !stage.materialStage) throw Error('Missing stage');
    expect(stage.ref).toBeTruthy();
    expect(tokens(stage)).toEqual(expect.arrayContaining(['min-w-0', 'w-full']));
    const descendants = nodes(stage);
    expect(
      descendants.filter(
        (node) => node.kind === 'proto' && node.prototypeId === 'liquid-glass-select-root'
      )
    ).toHaveLength(expectedRoots);
    const overlay = descendants.find(
      (node) => 'ref' in node && node.ref === stage.materialStage!.overlayRef
    );
    expect(overlay?.kind).toBe('box');
    if (overlay?.kind === 'box') expect(overlay.children).toEqual([]);
  }
});
