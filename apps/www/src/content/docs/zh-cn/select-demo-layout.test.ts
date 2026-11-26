import { describe, expect, it } from 'vitest';
import { compile } from 'tailwindcss';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import bootstrap from '../demo-bootstrap-2-3-2-select.demo';
import liquid from '../demo-liquid-glass-select.demo';
import bootstrapDisabled from '../demo_components/select/demo-bootstrap-2-3-2-select-disabled.demo';
import bootstrapRtl from '../demo_components/select/demo-bootstrap-2-3-2-select-rtl.demo';
import bootstrapScrollable from '../demo_components/select/demo-bootstrap-2-3-2-select-scrollable.demo';
import liquidDisabled from '../demo_components/select/demo-liquid-glass-select-disabled.demo';
import liquidRtl from '../demo_components/select/demo-liquid-glass-select-rtl.demo';
import liquidScrollable from '../demo_components/select/demo-liquid-glass-select-scrollable.demo';
import type { DemoChild, DemoNode } from '@/components/PrototypePreviewer/demo-types';

const require = createRequire(import.meta.url);
const theme = readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');

// Source/compiled-CSS regression controls only. Native track sizing, overflow
// and keyboard access remain owned by the 320px/200% browser journey. The
// public page now has separate hero, disabled, RTL and long-list examples.
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

for (const [family, hero, disabled, rtl, scrollable] of [
  ['bootstrap-2-3-2', bootstrap, bootstrapDisabled, bootstrapRtl, bootstrapScrollable],
  ['liquid-glass', liquid, liquidDisabled, liquidRtl, liquidScrollable],
] as const) {
  const examples = [hero, disabled, rtl, scrollable];
  describe(`${family} Select demo intrinsic-width recipe`, () => {
    it('bounds the actual hero, disabled and RTL wrappers without clipping their children', async () => {
      for (const demo of [hero, disabled, rtl]) {
        const classes = tokens(demo.root);
        expect(classes).toContain('min-w-0');
        expect(classes).toContain(family === 'liquid-glass' ? 'w-full' : 'max-w-full');
        const stylesheet = await compile(`${theme}\n@tailwind utilities;`);
        const css = stylesheet.build(classes);
        expect(css).toContain('min-width:');
        expect(css).toContain(family === 'liquid-glass' ? 'width: 100%' : 'max-width: 100%');
      }
      const direction = nodes(rtl.root).filter(
        (node) => node.kind === 'box' && node.attrs?.dir === 'rtl'
      );
      expect(direction).toHaveLength(1);
      for (const demo of [hero, disabled])
        expect(nodes(demo.root).some((node) => tokens(node).includes('flex-wrap'))).toBe(true);
    });

    it('retains every full timezone label in the separately scrollable viewport', () => {
      const all = nodes(scrollable.root);
      const items = all.filter(
        (node) => node.kind === 'proto' && node.prototypeId === `${family}-select-item`
      );
      expect(items).toHaveLength(11);
      for (const item of items) {
        if (item.kind !== 'proto') throw new Error('Expected Select Item');
        expect(text(item)).toBe(item.props?.textValue);
        expect(text(item).length).toBeGreaterThan(15);
      }
      expect(text(scrollable.root)).toContain('Australian Eastern Standard Time (AEST)');
      const viewport = all.find(
        (node) => node.kind === 'proto' && node.prototypeId === `${family}-select-viewport`
      );
      expect(viewport).toMatchObject({ surfaceStyle: { maxHeight: '220px', overflowY: 'auto' } });
    });

    it('keeps the current real Reset Button and its complete accessible text', () => {
      const button = nodes(hero.root).find((node) => 'ref' in node && node.ref === 'resetProduce')!;
      expect(button).toMatchObject({ kind: 'proto', prototypeId: `${family}-button` });
      expect(text(button)).toBe('Reset');
      if (button.kind !== 'proto') throw new Error('Expected real Button');
      expect(button).not.toHaveProperty('attrs');
      expect(button.props?.accessibleLabel).toBeUndefined();
      expect(nodes(button).some((node) => node.kind === 'box' && node.attrs?.['aria-hidden'])).toBe(
        false
      );
      expect(
        nodes(hero.root).find((node) => 'ref' in node && node.ref === 'fruitSelect')
      ).toMatchObject({
        kind: 'proto',
        prototypeId: `${family}-select-root`,
        props: { value: 'apple' },
      });
      expect(hero.setup).toBeTypeOf('function');
    });

    it('keeps all current examples and prevents hidden content or fixed-height substitutes', () => {
      for (const demo of examples)
        for (const node of nodes(demo.root))
          expect(
            tokens(node).some((token) =>
              /^(overflow(?:-[xy])?-(?:hidden|clip)|truncate|line-clamp-|h-)/.test(token)
            )
          ).toBe(false);
      expect(
        examples.map(
          (demo) =>
            nodes(demo.root).filter(
              (node) => node.kind === 'proto' && node.prototypeId === `${family}-select-root`
            ).length
        )
      ).toEqual([1, 2, 1, 1]);
      const disabledRoots = nodes(disabled.root).filter(
        (node) => node.kind === 'proto' && node.prototypeId === `${family}-select-root`
      );
      expect(
        disabledRoots.filter((node) => node.kind === 'proto' && node.props?.disabled === true)
      ).toHaveLength(1);
      const disabledItems = nodes(disabled.root).filter(
        (node) =>
          node.kind === 'proto' &&
          node.prototypeId === `${family}-select-item` &&
          node.props?.disabled === true
      );
      expect(disabledItems).toHaveLength(2);
    });
  });
}

it('binds the opt-in Select preview inset to all actual public example blocks', () => {
  for (const locale of ['en', 'zh-cn'])
    for (const family of ['bootstrap-2-3-2', 'liquid-glass']) {
      const page = readFileSync(
        `apps/www/src/content/docs/${locale}/ui-libraries/${family}/select.mdx`,
        'utf8'
      );
      expect(page).toContain('class="select-content-preview"');
      for (const suffix of ['', '-disabled', '-rtl', '-scrollable'])
        expect(page).toContain(`demoId="demo-${family}-select${suffix}"`);
    }
  const css = readFileSync('apps/www/src/styles/runtime-box.css', 'utf8');
  expect(css).toContain('.pui-runtime-box.select-content-preview');
  expect(css).toContain('--runtime-box-content-padding: 1.25rem 0;');
});

it('keeps four separately authored Liquid examples in their own declared static stages', () => {
  for (const [demo, stageRef, rootCount] of [
    [liquid, 'heroStage', 1],
    [liquidDisabled, 'disabledStage', 2],
    [liquidRtl, 'rtlStage', 1],
    [liquidScrollable, 'scrollStage', 1],
  ] as const) {
    const stages = nodes(demo.root).filter((node) => node.kind === 'box' && node.materialStage);
    expect(stages).toHaveLength(1);
    const stage = stages[0];
    if (stage.kind !== 'box' || !stage.materialStage) throw new Error('Missing stage');
    expect(stage.ref).toBe(stageRef);
    const descendants = nodes(stage);
    expect(
      descendants.filter(
        (node) => node.kind === 'proto' && node.prototypeId === 'liquid-glass-select-root'
      )
    ).toHaveLength(rootCount);
    const mount = descendants.find(
      (node) => 'ref' in node && node.ref === stage.materialStage!.mountRef
    );
    const overlay = descendants.find(
      (node) => 'ref' in node && node.ref === stage.materialStage!.overlayRef
    );
    expect(mount?.kind).toBe('box');
    expect(overlay).not.toBe(mount);
    expect(overlay).toMatchObject({ kind: 'box', children: [] });
    const refs = descendants.flatMap((node) => ('ref' in node && node.ref ? [node.ref] : []));
    expect(new Set(refs).size).toBe(refs.length);
  }
});
