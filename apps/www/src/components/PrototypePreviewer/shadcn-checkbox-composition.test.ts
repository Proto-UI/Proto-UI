import { assertProjectionRecipeClosure } from './projection-composition';
import {
  PROJECTION_FAMILY_MANIFESTS,
  validateProjectionFamilyManifest,
} from './projection-families';
import { describe, expect, it } from 'vitest';
import { shadcnCheckboxLabelComposition as recipe } from '@proto.ui/prototypes-shadcn/checkbox';
import { shadcnCheckboxDemoChildren } from './shadcn-checkbox-composition';
import { assertDemoSpec, type DemoChild, type DemoNode, type DemoSpec } from './demo-types';
import { createDemoAssociationScope } from './demo-associations';
import demo from '../../content/docs/zh-cn/demo-shadcn-checkbox.demo';
import { createHomepageGalleryParts } from '../Homepage/homepage-gallery-parts';

function protos(children: DemoChild[]): Extract<DemoNode, { kind: 'proto' }>[] {
  return children.flatMap((node) =>
    typeof node === 'string' || node.kind === 'text'
      ? []
      : [...(node.kind === 'proto' ? [node] : []), ...protos(node.children ?? [])]
  );
}

describe('shared Shadcn Checkbox website composition projection', () => {
  it('registers the real demo closure with Label as auxiliary, without changing Checkbox anatomy', () => {
    const family = PROJECTION_FAMILY_MANIFESTS.shadcn;
    const manifest = family.families.checkbox;
    expect(() => validateProjectionFamilyManifest(family)).not.toThrow();
    expect(Object.keys(manifest.parts)).toEqual(['root', 'indicator']);
    expect([...new Set(protos([demo.root]).map((part) => part.prototypeId))].sort()).toEqual(
      [...manifest.recipePrototypeIds].sort()
    );
    expect(() =>
      assertProjectionRecipeClosure(demo.root, manifest.recipePrototypeIds, manifest.recipeId)
    ).not.toThrow();
    expect(() =>
      assertProjectionRecipeClosure(
        demo.root,
        manifest.recipePrototypeIds.filter((id) => id !== recipe.parts.label.name),
        manifest.recipeId
      )
    ).toThrow('undeclared Prototype(s): shadcn-label-root');
    expect(() =>
      assertProjectionRecipeClosure(
        demo.root,
        [...manifest.recipePrototypeIds, 'shadcn-input-root'],
        manifest.recipeId
      )
    ).toThrow('missing required Prototype(s): shadcn-input-root');
  });

  it('projects the public parts, topology and Label defaults without opaque data or a second name', () => {
    const rich: DemoChild[] = ['Accept ', { kind: 'box', tag: 'span', children: ['updates'] }];
    const nodes = shadcnCheckboxDemoChildren({
      associationKey: 'accept',
      label: rich,
      controlProps: { checked: false },
      controlRef: 'control',
    });
    const all = protos(nodes);
    expect(all.map((node) => node.prototypeId)).toEqual([
      recipe.parts.control.name,
      recipe.parts.indicator.name,
      recipe.parts.label.name,
    ]);
    expect(all[0].children).toHaveLength(1);
    expect(all[2].children).toBe(rich);
    expect(all[2].props).toEqual(recipe.labelProps);
    expect(all[0].props).toEqual({ checked: false });
    expect(all[0].ref).toBe('control');
    expect(all[0].associations).toEqual(all[2].associations);
    const spec: DemoSpec = { type: 'demo', root: { kind: 'box', children: nodes } };
    expect(() => assertDemoSpec(spec)).not.toThrow();
    expect(JSON.parse(JSON.stringify(spec))).toEqual(spec);
    const first = createDemoAssociationScope(),
      second = createDemoAssociationScope();
    expect(first.resolve(all[0].associations)).toBe(first.resolve(all[2].associations));
    expect(second.resolve(all[0].associations)).not.toBe(first.resolve(all[0].associations));
    first.dispose();
    second.dispose();
    expect(() => shadcnCheckboxDemoChildren({ associationKey: ' ', label: [] })).toThrow();
  });

  it('keeps homepage and docs on that public topology and preserves their business props', () => {
    const gallery = createHomepageGalleryParts(
      'shadcn',
      'wc',
      'en',
      () => true,
      () => true
    );
    const homepage = protos(gallery.columns({ kind: 'box', children: [] }));
    const docs = protos([demo.root]);
    for (const nodes of [homepage, docs]) {
      const controls = nodes.filter((node) => node.prototypeId === recipe.parts.control.name);
      expect(controls.length).toBeGreaterThan(0);
      for (const control of controls) {
        expect(protos(control.children ?? []).map((node) => node.prototypeId)).toEqual([
          recipe.parts.indicator.name,
        ]);
        const labels = nodes.filter(
          (node) =>
            node.prototypeId === recipe.parts.label.name &&
            node.associations?.controlLabel === control.associations?.controlLabel
        );
        expect(labels).toHaveLength(1);
        expect(labels[0].props).toEqual(recipe.labelProps);
      }
    }
    expect(
      docs
        .filter((node) => node.prototypeId === recipe.parts.control.name)
        .map((node) => node.props)
    ).toEqual([
      { defaultChecked: false },
      { defaultChecked: true },
      { defaultIndeterminate: true },
      { disabled: true, defaultChecked: true },
      { defaultChecked: false },
    ]);
    expect(homepage.find((node) => node.ref === 'gallery-checkbox')?.props).toEqual({
      defaultChecked: true,
    });
    expect(gallery.ids.has(recipe.parts.control.name)).toBe(true);
    expect(gallery.ids.has(recipe.parts.label.name)).toBe(true);
    expect(gallery.ids.has(recipe.parts.indicator.name)).toBe(true);
  });
});
