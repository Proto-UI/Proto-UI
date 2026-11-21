import { describe, expect, it } from 'vitest';
import type { DemoChild, DemoNode } from '../../../components/PrototypePreviewer/demo-types';
import shadcnText from './demo-shadcn-text.demo';
import shadcnSurface from './demo-shadcn-surface.demo';
import liquidSelect from '../demo-liquid-glass-select.demo';

type ProtoNode = Extract<DemoNode, { kind: 'proto' }>;

function nodes(child: DemoChild): DemoNode[] {
  if (typeof child === 'string') return [];
  return [child, ...(child.kind === 'text' ? [] : (child.children ?? []).flatMap(nodes))];
}

function prototypes(child: DemoChild): ProtoNode[] {
  return nodes(child).filter((node): node is ProtoNode => node.kind === 'proto');
}

describe('native regression fixture ownership', () => {
  it.each([
    { atom: 'text', demo: shadcnText },
    { atom: 'surface', demo: shadcnSurface },
  ])(
    'Shadcn $atom keeps one style carrier around exactly four authored atoms',
    ({ atom, demo }) => {
      expect(demo.root).toMatchObject({
        kind: 'proto',
        prototypeId: 'shadcn-style-scope',
        className: 'contents',
        props: { styleProfile: 'rhea' },
      });
      expect(demo.root.children).toHaveLength(1);
      expect(prototypes(demo.root).map((node) => node.prototypeId)).toEqual([
        'shadcn-style-scope',
        `shadcn-${atom}-root`,
        `shadcn-${atom}-root`,
        `shadcn-${atom}-root`,
        `shadcn-${atom}-root`,
      ]);
      expect(prototypes(demo.root.children[0])).toHaveLength(4);
    }
  );

  it.each(['uncontrolled', 'disabled', 'controlled', 'rtl'])(
    'Liquid Select %s has one named paint Surface inside its own Content',
    (ref) => {
      const all = prototypes(liquidSelect.root);
      const contents = all.filter((node) => node.ref === `${ref}Content`);
      const surfaces = all.filter((node) => node.ref === `${ref}Surface`);
      const viewports = all.filter((node) => node.ref === `${ref}Viewport`);
      expect(contents).toHaveLength(1);
      expect(surfaces).toHaveLength(1);
      expect(viewports).toHaveLength(1);
      expect(contents[0].prototypeId).toBe('liquid-glass-select-content');
      expect(surfaces[0].prototypeId).toBe('liquid-glass-select-surface');
      expect(viewports[0].prototypeId).toBe('liquid-glass-select-viewport');
      expect(contents[0].children).toHaveLength(1);
      expect(contents[0].children?.[0]).toBe(surfaces[0]);
      expect(surfaces[0].children).toHaveLength(1);
      expect(surfaces[0].children?.[0]).toBe(viewports[0]);
      const sceneRef = ref === 'rtl' ? 'selectRtlLayout' : `${ref}Stage`;
      const scenes = nodes(liquidSelect.root).filter(
        (node) => node.kind === 'box' && node.ref === sceneRef
      );
      expect(scenes).toHaveLength(1);
      expect(prototypes(scenes[0])).toContain(contents[0]);
      expect(prototypes(scenes[0])).toContain(surfaces[0]);
    }
  );
});
