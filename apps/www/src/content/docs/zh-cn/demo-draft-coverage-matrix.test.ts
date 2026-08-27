import { describe, expect, it } from 'vitest';
import type {
  DemoChild,
  DemoNode,
  DemoSpec,
} from '../../../components/PrototypePreviewer/demo-types';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import checkboxDefinition from './demo-brutalist-checkbox.demo';
import scrollAreaDefinition from './demo-shadcn-scroll-area.demo';
import tooltipDefinition from './demo-shadcn-tooltip.demo';

const checkboxDemo = checkboxDefinition as DemoSpec;
const scrollAreaDemo = scrollAreaDefinition as DemoSpec;
const tooltipDemo = tooltipDefinition as DemoSpec;
type PrototypeDemoNode = Extract<DemoNode, { kind: 'proto' }>;

const EXPECTED_PROTOTYPES = {
  'shadcn-scroll-area-root': 'shadcn-scroll-area-root',
  'shadcn-scroll-area-viewport': 'shadcn-scroll-area-viewport',
  'shadcn-scroll-area-scrollbar': 'shadcn-scroll-area-scrollbar',
  'shadcn-scroll-area-thumb': 'shadcn-scroll-area-thumb',
  'shadcn-tooltip-group': 'shadcn-tooltip-group',
  'shadcn-tooltip-root': 'shadcn-tooltip-root',
  'shadcn-tooltip-trigger': 'shadcn-tooltip-trigger',
  'shadcn-tooltip-content': 'shadcn-tooltip-content',
  'brutalist-checkbox-root': 'brutalist-checkbox-root',
  'brutalist-checkbox-indicator': 'brutalist-checkbox-indicator',
} as const;

function collectNodes(node: DemoChild, result: DemoNode[] = []): DemoNode[] {
  if (typeof node === 'string') return result;
  result.push(node);
  if (node.kind === 'text') return result;
  for (const child of node.children ?? []) collectNodes(child, result);
  return result;
}

function directPrototypes(node: DemoNode) {
  if (node.kind === 'text') return [];
  return (node.children ?? []).filter(
    (child): child is Extract<DemoNode, { kind: 'proto' }> =>
      typeof child !== 'string' && child.kind === 'proto'
  );
}

function textContent(node: DemoChild): string {
  if (typeof node === 'string') return node;
  if (node.kind === 'text') return node.text;
  return (node.children ?? []).map(textContent).join('');
}

function isPrototype(node: DemoNode, prototypeId: string): node is PrototypeDemoNode {
  return node.kind === 'proto' && node.prototypeId === prototypeId;
}

describe('draft coverage-matrix documentation demos', () => {
  it('composes Scroll Area as Root -> Viewport + oriented Scrollbar -> Thumb', () => {
    const nodes = collectNodes(scrollAreaDemo.root);
    const root = nodes.find(
      (node) => node.kind === 'proto' && node.prototypeId === 'shadcn-scroll-area-root'
    );
    expect(root).toBeDefined();
    if (!root || root.kind !== 'proto') throw new Error('Missing shadcn Scroll Area Root.');

    const rootChildren = directPrototypes(root);
    expect(rootChildren.map((node) => node.prototypeId)).toEqual([
      'shadcn-scroll-area-viewport',
      'shadcn-scroll-area-scrollbar',
      'shadcn-scroll-area-scrollbar',
    ]);
    expect(rootChildren[1]?.props).toEqual({ orientation: 'vertical' });
    expect(rootChildren[2]?.props).toEqual({ orientation: 'horizontal' });
    for (const scrollbar of rootChildren.slice(1)) {
      expect(directPrototypes(scrollbar).map((node) => node.prototypeId)).toEqual([
        'shadcn-scroll-area-thumb',
      ]);
    }

    const overflowSurface = nodes.find(
      (node) => node.kind === 'box' && node.className?.includes('w-[520px]')
    );
    expect(overflowSurface).toBeDefined();
    expect(nodes.filter((node) => node.kind === 'box').length).toBeGreaterThan(10);
  });

  it('keeps Tooltip delays at Group and each Root limited to Trigger + Content', () => {
    expect(tooltipDemo.root).toMatchObject({
      kind: 'proto',
      prototypeId: 'shadcn-tooltip-group',
      props: { openDelay: 500, closeDelay: 150, skipDelay: 700 },
    });

    const nodes = collectNodes(tooltipDemo.root);
    const roots = nodes.filter((node) => isPrototype(node, 'shadcn-tooltip-root'));
    expect(roots).toHaveLength(2);
    for (const root of roots) {
      expect(directPrototypes(root).map((node) => node.prototypeId)).toEqual([
        'shadcn-tooltip-trigger',
        'shadcn-tooltip-content',
      ]);
    }

    const contentNodes = nodes.filter((node) => isPrototype(node, 'shadcn-tooltip-content'));
    expect(contentNodes).toHaveLength(2);
    for (const content of contentNodes) {
      expect(content.props).toMatchObject({ side: 'top', align: 'center', sideOffset: 8 });
      expect(content.props).not.toHaveProperty('tabIndex');
      expect(directPrototypes(content)).toEqual([]);
    }
    expect(nodes.some((node) => node.kind === 'proto' && /arrow/i.test(node.prototypeId))).toBe(
      false
    );
  });

  it('covers unchecked, checked, mixed, disabled, focus-visible, and precedence Checkbox acceptance', () => {
    const roots = collectNodes(checkboxDemo.root).filter((node) =>
      isPrototype(node, 'brutalist-checkbox-root')
    );
    expect(roots).toHaveLength(6);
    expect(roots.map((root) => root.ref)).toEqual([
      'uncheckedCheckbox',
      'checkedCheckbox',
      'mixedCheckbox',
      'disabledCheckbox',
      'focusCheckbox',
      'checkedIndeterminateCheckbox',
    ]);
    expect(roots.map((root) => root.props)).toEqual([
      { defaultChecked: false },
      { defaultChecked: true },
      { defaultIndeterminate: true },
      { disabled: true, defaultChecked: true },
      { defaultChecked: false },
      { defaultChecked: true, defaultIndeterminate: true },
    ]);
    for (const root of roots) {
      const indicator = directPrototypes(root).find(
        (node) => node.prototypeId === 'brutalist-checkbox-indicator'
      );
      expect(indicator).toBeDefined();
      if (!indicator) throw new Error(`Missing Indicator for ${root.ref}.`);
      expect(indicator.children ?? []).toEqual([]);

      const accessibleLabel = root.children?.find(
        (child) =>
          typeof child !== 'string' &&
          child.kind === 'box' &&
          child.className?.split(/\s+/).includes('sr-only')
      );
      expect(accessibleLabel).toBeDefined();
      expect(textContent(accessibleLabel ?? '')).not.toBe('');
    }
  });

  it.each(Object.entries(EXPECTED_PROTOTYPES))(
    'loads %s through its public package-subpath loader',
    async (id, prototypeName) => {
      expect(prototypeModules).toHaveProperty(id);
      await expect(loadPrototype(id)).resolves.toBe(true);
      expect(getPrototype(id).name).toBe(prototypeName);
    }
  );
});
