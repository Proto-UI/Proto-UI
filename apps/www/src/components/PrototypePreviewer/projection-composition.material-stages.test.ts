import { describe, expect, it } from 'vitest';
import liquidSelect from '../../content/docs/demo-liquid-glass-select.demo';
import { planMaterialStages } from './demo-material-stages';
import type { DemoChild, DemoNode, DemoSpec } from './demo-types';
import {
  createProjectionComposition,
  type ProjectionCompositionControls,
  type ProjectionContentRecipe,
} from './projection-composition';
import type { RuntimeId } from './runtimes/ids';

const runtimes = ['wc', 'react', 'vue', 'vue2'] as const;
function compose(
  childDemo: DemoSpec,
  runtimeId: RuntimeId = 'wc',
  presentation: 'select' | 'tabs' = 'select',
  contentRecipe?: ProjectionContentRecipe
) {
  const controls: ProjectionCompositionControls = {
    runtime: {
      label: 'Runtime',
      presentation,
      options: runtimes.map((value) => ({ value, label: value })),
      onValueChange() {},
    },
    family: {
      label: 'Family',
      options: [{ value: 'liquid-glass', label: 'Liquid Glass' }],
      onValueChange() {},
    },
    component: {
      label: 'Component',
      options: [{ value: 'select', label: 'Select' }],
      onValueChange() {},
    },
  };
  return createProjectionComposition({
    ownerId: 'material-stage-regression',
    generation: 1,
    runtimeId,
    projectionFamilyId: 'liquid-glass',
    componentId: 'select',
    controls,
    controlIds: ['runtime'],
    childDemo,
    contentRecipe,
  }).demo;
}

// Native-only and dynamic-slot fixtures declare their actual narrow recipe;
// the real Liquid demo below still uses its complete public family recipe.
function composeFixture(childDemo: DemoSpec, dynamic = false) {
  return compose(childDemo, 'wc', 'select', {
    id: 'material-stage-fixture',
    prototypeIds: dynamic ? ['liquid-glass-select-item'] : [],
    rootPrototypeId: dynamic ? 'liquid-glass-select-item' : null,
  });
}

function nodes(root: DemoChild): DemoNode[] {
  if (typeof root === 'string') return [];
  if (root.kind === 'text') return [root];
  return [root, ...(root.children ?? []).flatMap(nodes)];
}
function byRef(root: DemoChild, ref: string) {
  const result = nodes(root).find((node) => node.kind !== 'text' && node.ref === ref);
  if (!result || result.kind !== 'box') throw new Error(`Missing box ${ref}`);
  return result;
}
function stage(): DemoNode {
  return {
    kind: 'box',
    ref: 'stage',
    materialStage: { mountRef: 'flow', overlayRef: 'overlay' },
    children: [
      { kind: 'box', ref: 'flow', children: ['Static content'] },
      { kind: 'box', ref: 'overlay' },
    ],
  };
}
function demo(children: DemoChild[]): DemoSpec {
  return { type: 'demo', root: { kind: 'box', ref: 'outer', children } };
}

describe('projection preserves static material-stage admission', () => {
  it('does not manufacture dynamicChildren on ordinary static boxes', () => {
    const input = demo([stage(), { kind: 'box', ref: 'ordinary', children: ['Text'] }]);
    const projected = composeFixture(input);
    for (const node of nodes(projected.root)) {
      if (node.kind === 'box') expect('dynamicChildren' in node).toBe(false);
    }
    expect(planMaterialStages(projected.root)).toEqual(planMaterialStages(input.root));
    expect(byRef(projected.root, 'ordinary')).not.toBe(byRef(input.root, 'ordinary'));
  });

  it('retains explicitly authored undefined presence and the conservative stage guard', () => {
    const input = demo([stage(), { kind: 'box', ref: 'explicit', dynamicChildren: undefined }]);
    const projected = composeFixture(input);
    expect(Object.hasOwn(byRef(projected.root, 'explicit'), 'dynamicChildren')).toBe(true);
    expect(() => planMaterialStages(input.root)).toThrow(/unique refs and static children/);
    expect(() => planMaterialStages(projected.root)).toThrow(/unique refs and static children/);
  });

  it('clones genuine dynamic declarations without making stage mode accept them', () => {
    const slot: DemoNode = {
      kind: 'box',
      ref: 'slot',
      dynamicChildren: { prototypeIds: ['liquid-glass-select-item'] },
      children: [],
    };
    const normal = composeFixture(demo([slot]), true);
    const projected = byRef(normal.root, 'slot');
    expect(projected.dynamicChildren).toEqual(slot.dynamicChildren);
    expect(projected.dynamicChildren).not.toBe(slot.dynamicChildren);
    expect(projected.dynamicChildren?.prototypeIds).not.toBe(slot.dynamicChildren?.prototypeIds);
    expect(planMaterialStages(normal.root)).toEqual([]);
    expect(() => planMaterialStages(composeFixture(demo([stage(), slot]), true).root)).toThrow(
      /unique refs and static children/
    );
  });

  it('preserves duplicate-ref rejection rather than masking it as a dynamic failure', () => {
    const input = demo([stage(), { kind: 'box', ref: 'flow' }]);
    const projected = composeFixture(input);
    expect(
      nodes(projected.root).filter((node) => node.kind !== 'text' && node.ref === 'flow')
    ).toHaveLength(2);
    expect(
      nodes(projected.root).some((node) => node.kind === 'box' && 'dynamicChildren' in node)
    ).toBe(false);
    expect(() => planMaterialStages(projected.root)).toThrow(/unique refs and static children/);
  });

  // These are real composition/admission checks before any host mount. They
  // do not claim native rendering, optical fidelity or four-host interaction.
  for (const presentation of ['select', 'tabs'] as const) {
    it.each(runtimes)(
      `admits all four real Liquid Select stages through ${presentation} controls for %s`,
      (runtimeId) => {
        const original = planMaterialStages(liquidSelect.root);
        expect(original.map((plan) => plan.scopeRef)).toEqual([
          'uncontrolledStage',
          'disabledStage',
          'controlledStage',
          'selectRtlLayout',
        ]);
        const projected = compose(liquidSelect, runtimeId, presentation);
        expect(planMaterialStages(projected.root)).toEqual(original);
        expect(
          nodes(projected.root).filter(
            (node) =>
              node.kind === 'proto' &&
              node.prototypeId === 'liquid-glass-select-root' &&
              ['uncontrolled', 'disabled', 'controlled', 'rtl'].includes(node.ref ?? '')
          )
        ).toHaveLength(4);
        expect(byRef(projected.root, 'selectRtlLayout').attrs?.dir).toBe('rtl');
        expect(
          nodes(projected.root).some(
            (node) =>
              node.kind === 'proto' &&
              node.ref === 'accept' &&
              node.prototypeId === 'liquid-glass-button'
          )
        ).toBe(true);
      }
    );
  }
});
