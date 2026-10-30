import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHomepageShowcase } from '../Homepage/homepage-showcase';
import {
  createProjectionComposition,
  type ProjectionCompositionControls,
} from './projection-composition';
import { assertDemoSpec, type DemoChild, type DemoNode } from './demo-types';
import { resolveProjectionSelectParts } from './projection-families';

type DemoProtoNode = Extract<DemoNode, { kind: 'proto' }>;

function nodes(node: DemoChild): DemoNode[] {
  if (typeof node === 'string') return [];
  return [node, ...(node.kind === 'text' ? [] : (node.children ?? []).flatMap(nodes))];
}
function parts(root: DemoChild, id: string): DemoProtoNode[] {
  return nodes(root).filter(
    (node): node is DemoProtoNode => node.kind === 'proto' && node.prototypeId === id
  );
}
function verifyContent(content: DemoProtoNode) {
  expect(content.props?.position).toBeUndefined();
  expect(content.props?.align).toBeUndefined();
  expect(content.surfaceStyle ?? {}).toEqual({});
  const surface = content.children?.[0] as DemoProtoNode;
  expect(surface.prototypeId).toBe('shadcn-select-surface');
  const viewport = surface.children?.[0] as DemoProtoNode;
  expect(viewport.prototypeId).toBe('shadcn-select-viewport');
  expect(viewport.children?.length).toBeGreaterThan(0);
  for (const child of viewport.children ?? []) {
    const item = child as DemoProtoNode;
    expect(item.prototypeId).toBe('shadcn-select-item');
    const text = item.children?.[0] as DemoProtoNode;
    expect(text.prototypeId).toBe('shadcn-select-item-text');
    expect(text.children).toEqual([item.props?.textValue]);
  }
}
const controls: ProjectionCompositionControls = {
  runtime: {
    label: 'Runtime',
    options: [
      { value: 'wc', label: 'Web Components' },
      { value: 'react', label: 'React', disabled: true },
    ],
    onValueChange() {},
  },
  family: {
    label: 'Family',
    options: (['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'] as const).map((value) => ({
      value,
      label: value,
    })),
    onValueChange() {},
  },
  component: {
    label: 'Component',
    options: [{ value: 'button', label: 'Button' }],
    onValueChange() {},
  },
};

describe('website public Shadcn Select compositions', () => {
  it.each(['wc', 'react', 'vue', 'vue2'] as const)(
    'keeps homepage controlled recipe complete in %s',
    (runtime) => {
      const result = createHomepageShowcase('shadcn', runtime, 'en', () => true);
      assertDemoSpec(result.demo);
      const contents = parts(result.demo.root, 'shadcn-select-content');
      expect(contents.length).toBe(1);
      contents.forEach(verifyContent);
      expect(parts(result.demo.root, 'shadcn-select-root')[0]?.props?.value).toBe('list');
      for (const id of Object.values(resolveProjectionSelectParts('shadcn')))
        expect(result.recipe.prototypeIds).toContain(id);
    }
  );
  it('preserves controlled current value and disabled option with full generated parts', () => {
    const result = createProjectionComposition({
      ownerId: 'select-parts',
      runtimeId: 'wc',
      projectionFamilyId: 'shadcn',
      generation: 1,
      componentId: 'button',
      childDemo: {
        type: 'demo',
        root: { kind: 'proto', prototypeId: 'shadcn-button', children: ['Test'] },
      },
      controls,
    });
    assertDemoSpec(result.demo);
    const contents = parts(result.demo.root, 'shadcn-select-content');
    expect(contents.length).toBe(3);
    contents.forEach(verifyContent);
    expect(parts(result.demo.root, 'shadcn-select-root').map((n) => n.props?.value)).toEqual([
      'wc',
      'shadcn',
      'button',
    ]);
    expect(
      parts(result.demo.root, 'shadcn-select-item').find((n) => n.props?.value === 'react')?.props
        ?.disabled
    ).toBe(true);
    expect(
      parts(result.demo.root, 'shadcn-select-trigger').map(
        (trigger) => trigger.props?.accessibleLabel
      )
    ).toEqual([controls.runtime.label, controls.family.label, controls.component.label]);
    for (const trigger of parts(result.demo.root, 'shadcn-select-trigger')) {
      expect(trigger.surfaceStyle).not.toHaveProperty('minHeight');
      expect(trigger.surfaceStyle).not.toHaveProperty('paddingBlock');
      expect(trigger.props).not.toHaveProperty('aria-label');
    }
  });
  it.each(['brutalist', 'bootstrap-2-3-2', 'liquid-glass'] as const)(
    'does not invent new parts for %s',
    (family) => {
      const result = createProjectionComposition({
        ownerId: `parts-${family}`,
        runtimeId: 'wc',
        projectionFamilyId: family,
        generation: 1,
        componentId: 'button',
        childDemo: {
          type: 'demo',
          root: { kind: 'proto', prototypeId: `${family}-button`, children: ['Test'] },
        },
        controls,
      });
      expect(parts(result.demo.root, `${family}-select-content`)[0]?.props?.position).toBe(
        'popper'
      );
      expect(parts(result.demo.root, 'shadcn-select-surface')).toHaveLength(0);
      expect(resolveProjectionSelectParts(family).surface).toBeUndefined();
    }
  );
  it.each(['AdapterSelect', 'LanguageSelect'])(
    'declares complete static %s parts without a Shadcn positioning override',
    (name) => {
      const source = readFileSync(`apps/www/src/components/override/${name}.astro`, 'utf8');
      expect(source).toMatch(
        /family === 'shadcn' \? \(\s*<wc-shadcn-select-surface>\s*<wc-shadcn-select-viewport>/
      );
      expect(source).toMatch(/<SelectItem[^>]+>\s*<wc-shadcn-select-item-text>/);
      expect(source).toContain("data-position={family === 'brutalist' ? 'popper' : undefined}");
      expect(source).toContain('aria-labelledby={labelId}');
    }
  );
});
