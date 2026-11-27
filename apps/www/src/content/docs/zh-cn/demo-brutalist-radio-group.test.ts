import { describe, expect, it } from 'vitest';
import type {
  DemoChild,
  DemoNode,
  DemoSpec,
} from '../../../components/PrototypePreviewer/demo-types';
import { createDynamicChildrenModel } from '../../../components/PrototypePreviewer/demo-dynamic-children';
import radioGroupDemoDefinition from './demo-brutalist-radio-group.demo';

type DemoBoxNode = Extract<DemoNode, { kind: 'box' }>;
type DemoProtoNode = Extract<DemoNode, { kind: 'proto' }>;

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
  it('admits the authored hero group in the renderer', () => {
    const model = createDynamicChildrenModel(radioGroupDemo);
    model.dispose();
  });

  it('keeps single Base selection with matching visible and accessible captions', () => {
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
    expect(roots).toHaveLength(1);
    expect(items).toHaveLength(3);
    expect(indicators).toHaveLength(3);

    // The public hero preselects its middle display-density option.
    const defaults = roots.map((root) =>
      root.kind === 'proto' ? (root.props?.defaultValue as string | undefined) : null
    );
    expect(defaults).toEqual(['comfortable']);
    expect(items.map((item) => item.kind === 'proto' && item.props?.value)).toEqual([
      'default',
      'comfortable',
      'compact',
    ]);

    for (const item of items) {
      if (item.kind !== 'proto') throw new Error('Expected Radio Item');
      // Base derives the name from the hidden in-item text. Its visible
      // sibling must carry exactly the same caption.
      const visible = (item.children ?? []).find(
        (child): child is DemoBoxNode =>
          typeof child !== 'string' &&
          child.kind === 'box' &&
          child.className?.includes('sr-only') === true
      );
      expect(visible).toBeTruthy();
      expect(textContent(item)).toBe(textContent(visible!));
      const row = nodes.find((node) => node.kind === 'box' && node.children?.includes(item));
      const captions =
        row?.kind === 'box'
          ? (row.children ?? []).filter(
              (child) =>
                typeof child !== 'string' &&
                child.kind === 'box' &&
                !child.className?.includes('sr-only')
            )
          : [];
      expect(captions).toHaveLength(1);
      expect(textContent(captions[0]!)).toBe(textContent(visible!));
      const itemIndicators = (item.children ?? []).filter(
        (child): child is DemoProtoNode =>
          typeof child !== 'string' &&
          child.kind === 'proto' &&
          child.prototypeId === 'brutalist-radio-group-indicator'
      );
      expect(itemIndicators).toHaveLength(1);
    }
  });
});
