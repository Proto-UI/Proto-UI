import { describe, expect, it } from 'vitest';
import type {
  DemoChild,
  DemoNode,
  DemoSpec,
} from '../../../components/PrototypePreviewer/demo-types';
import radioGroupDemoDefinition from './demo-brutalist-radio-group.demo';

const radioGroupDemo = radioGroupDemoDefinition as DemoSpec;

function collectNodes(node: DemoChild, result: DemoNode[] = []): DemoNode[] {
  if (typeof node === 'string') return result;
  result.push(node);
  if (node.kind === 'text') return result;
  for (const child of node.children ?? []) collectNodes(child, result);
  return result;
}

function textContent(node: DemoChild): string {
  if (typeof node === 'string') return node;
  if (node.kind === 'text') return node.text;
  return (node.children ?? []).map(textContent).join('');
}

describe('Brutalist Radio Group demo contract', () => {
  it('keeps single Base selection with visible in-item captions', () => {
    const nodes = collectNodes(radioGroupDemo.root);
    const roots = nodes.filter(
      (node) => node.kind === 'proto' && node.prototypeId === 'brutalist-radio-group-root'
    );
    const items = nodes.filter(
      (node) => node.kind === 'proto' && node.prototypeId === 'brutalist-radio-group-item'
    );
    const indicators = nodes.filter(
      (node) => node.kind === 'proto' && node.prototypeId === 'brutalist-radio-group-indicator'
    );
    expect(roots).toHaveLength(2);
    expect(items).toHaveLength(5);
    expect(indicators).toHaveLength(5);

    // Exactly one group preselects a value; the other exercises zero checked.
    const defaults = roots.map((root) =>
      root.kind === 'proto' ? (root.props?.defaultValue as string | undefined) : null
    );
    expect(defaults).toContain('comfortable');
    expect(defaults).toContain('');

    for (const item of items) {
      if (item.kind !== 'proto') throw new Error('Expected Radio Item');
      // Visible caption text stays inside the item so Base nameFromContent
      // derives the accessible name; the sr-only copy is decorative backup.
      const visible = (item.children ?? []).find((child) =>
        (child as DemoNode).className?.includes('sr-only')
      );
      expect(visible).toBeTruthy();
      expect(textContent(item)).toContain(textContent(visible!));
      const itemIndicators = (item.children ?? []).filter(
        (child) =>
          (child as DemoNode).kind === 'proto' &&
          (child as DemoNode).prototypeId === 'brutalist-radio-group-indicator'
      );
      expect(itemIndicators).toHaveLength(1);
    }
  });
});
