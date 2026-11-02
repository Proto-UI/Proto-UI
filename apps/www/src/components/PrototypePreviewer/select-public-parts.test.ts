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

// Independent fixture contracts, not inferred from the composition's output
// or from the same resolver that creates it. See each family's Select Content
// and alignment-parts definitions; all remain draft, not stable guarantees.
const FAMILY_SELECT_CONTRACTS = [
  { family: 'brutalist', surface: undefined, position: 'popper' },
  { family: 'bootstrap-2-3-2', surface: 'bootstrap-2-3-2-select-surface', position: undefined },
  { family: 'liquid-glass', surface: 'liquid-glass-select-surface', position: undefined },
] as const;
type FamilySelectContract = (typeof FAMILY_SELECT_CONTRACTS)[number];
type ControlId = 'runtime' | 'family' | 'component';

function familyComposition(contract: FamilySelectContract, controlIds?: readonly ControlId[]) {
  return createProjectionComposition({
    ownerId: `parts-${contract.family}`,
    runtimeId: 'wc',
    projectionFamilyId: contract.family,
    generation: 1,
    componentId: 'button',
    controlIds,
    childDemo: {
      type: 'demo',
      root: { kind: 'proto', prototypeId: `${contract.family}-button`, children: ['Test'] },
    },
    controls,
  });
}

function verifyFamilyControls(root: DemoChild, contract: FamilySelectContract) {
  const { family, surface, position } = contract;
  const roots = parts(root, `${family}-select-root`);
  const contents = parts(root, `${family}-select-content`);
  const triggers = parts(root, `${family}-select-trigger`);
  expect(roots).toHaveLength(3);
  expect(contents).toHaveLength(3);
  expect(triggers).toHaveLength(3);
  expect(roots.map((entry) => entry.props?.value)).toEqual(['wc', family, 'button']);
  expect(triggers.map((entry) => entry.props?.accessibleLabel)).toEqual([
    'Runtime',
    'Family',
    'Component',
  ]);
  for (const entry of roots) {
    const owned = parts(entry, `${family}-select-content`);
    expect(owned).toHaveLength(1);
    expect(parts(entry, `${family}-select-trigger`)).toHaveLength(1);
    const content = owned[0]!;
    expect(content.props?.position).toBe(position);
    if (surface) {
      const surfaces = parts(content, surface);
      expect(surfaces).toHaveLength(1);
      expect(content.children?.[0]).toBe(surfaces[0]);
      const viewports = parts(surfaces[0]!, `${family}-select-viewport`);
      expect(viewports).toHaveLength(1);
      expect(surfaces[0]!.children?.[0]).toBe(viewports[0]);
    }
  }
  for (const candidate of ['brutalist', 'bootstrap-2-3-2', 'liquid-glass', 'shadcn']) {
    expect(parts(root, `${candidate}-select-surface`)).toHaveLength(
      surface === `${candidate}-select-surface` ? 3 : 0
    );
  }
}

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
      contentRecipe: {
        id: 'button',
        prototypeIds: ['shadcn-button'],
        rootPrototypeId: 'shadcn-button',
      },
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
  it.each(FAMILY_SELECT_CONTRACTS)(
    'pins all three controls and the independent Surface contract for $family',
    (contract) => {
      const result = familyComposition(contract);
      assertDemoSpec(result.demo);
      verifyFamilyControls(result.demo.root, contract);
      expect(resolveProjectionSelectParts(contract.family).surface).toBe(contract.surface);
    }
  );
  it.each(FAMILY_SELECT_CONTRACTS)(
    'rejects deletion of each independently required control for $family',
    (contract) => {
      verifyFamilyControls(familyComposition(contract).demo.root, contract);
      for (const omitted of ['runtime', 'family', 'component'] as const) {
        const controlIds = (['runtime', 'family', 'component'] as const).filter(
          (id) => id !== omitted
        );
        const result = familyComposition(contract, controlIds);
        expect(parts(result.demo.root, `${contract.family}-select-root`)).toHaveLength(2);
        expect(() => verifyFamilyControls(result.demo.root, contract)).toThrow();
      }
    }
  );
  it.each(FAMILY_SELECT_CONTRACTS.filter((contract) => contract.surface))(
    'rejects missing required Surfaces even with a self-consistent legacy shape for $family',
    (contract) => {
      const result = familyComposition(contract);
      verifyFamilyControls(result.demo.root, contract);
      for (const content of parts(result.demo.root, `${contract.family}-select-content`)) {
        const surface = content.children?.[0] as DemoProtoNode;
        content.children = surface.children;
        content.props = { ...content.props, position: 'popper' };
      }
      expect(parts(result.demo.root, contract.surface!)).toHaveLength(0);
      expect(() => verifyFamilyControls(result.demo.root, contract)).toThrow();
    }
  );
  it.each(FAMILY_SELECT_CONTRACTS.filter((contract) => contract.surface))(
    'rejects the right total Surface count under the wrong Content for $family',
    (contract) => {
      const result = familyComposition(contract);
      verifyFamilyControls(result.demo.root, contract);
      const contents = parts(result.demo.root, `${contract.family}-select-content`);
      const moved = contents[0]!.children!.shift()!;
      contents[1]!.children!.push(moved);
      expect(parts(result.demo.root, contract.surface!)).toHaveLength(3);
      expect(() => verifyFamilyControls(result.demo.root, contract)).toThrow();
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
