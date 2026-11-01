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
  // The viewport may hold items directly or inside a passive Group. The
  // Select spec keeps the Content-to-Item relation valid through Group
  // wrappers and allows mixed grouped and ungrouped items. A Group without a
  // Label has no accessible name; the relation fails closed rather than
  // raising, so the Label is optional.
  const items = (viewport.children ?? []).flatMap((child) => {
    const node = child as DemoProtoNode;
    if (node.prototypeId === 'shadcn-select-group') {
      const groupChildren = (node.children ?? []) as DemoProtoNode[];
      return groupChildren.filter((entry) => entry.prototypeId !== 'shadcn-select-label');
    }
    return [node];
  });
  expect(items.length).toBeGreaterThan(0);
  for (const item of items) {
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
      // The recipe declares exactly the Select parts the composition uses.
      // The homepage deliberately composes no Select Label and no Separator,
      // so the recipe must not declare them either.
      const selectParts = resolveProjectionSelectParts('shadcn');
      for (const id of Object.values(selectParts))
        if (id !== selectParts.label && id !== selectParts.separator)
          expect(result.recipe.prototypeIds).toContain(id);
      expect(result.recipe.prototypeIds).not.toContain(selectParts.label);
      expect(result.recipe.prototypeIds).not.toContain(selectParts.separator);
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
      const contents = parts(result.demo.root, `${family}-select-content`);
      const roots = parts(result.demo.root, `${family}-select-root`);
      // Every Select root owns exactly one content, so a missing or
      // misidentified content cannot satisfy the checks below vacuously.
      expect(contents).toHaveLength(roots.length);
      expect(contents.length).toBeGreaterThan(0);
      const ownSurface = parts(result.demo.root, `${family}-select-surface`);
      // A family that owns the Surface structural part projects it; a family
      // without one keeps the plain positioning prop on the content.
      if (ownSurface.length > 0) {
        expect(contents.every((entry) => entry.props?.position === undefined)).toBe(true);
        expect(ownSurface).toHaveLength(contents.length);
      } else {
        expect(contents.every((entry) => entry.props?.position === 'popper')).toBe(true);
      }
      expect(parts(result.demo.root, 'shadcn-select-surface')).toHaveLength(0);
      expect(resolveProjectionSelectParts(family).surface).toBe(
        ownSurface.length > 0 ? `${family}-select-surface` : undefined
      );
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
