import { describe, expect, it } from 'vitest';
import type {
  DemoChild,
  DemoNode,
  DemoSpec,
} from '../../../components/PrototypePreviewer/demo-types';
import tableDemoDefinition from './demo-brutalist-table.demo';

type DemoProtoNode = Extract<DemoNode, { kind: 'proto' }>;

const tableDemo = tableDemoDefinition as DemoSpec;

function collectNodes(node: DemoChild, result: DemoNode[] = []): DemoNode[] {
  if (typeof node === 'string') return result;
  result.push(node);
  if (node.kind === 'text') return result;
  for (const child of node.children ?? []) collectNodes(child, result);
  return result;
}

describe('Brutalist Table demo contract', () => {
  it('composes exactly the five native table parts with no data-table prototypes', () => {
    // T-BRUTALIST-TABLE-0001-CASE-4
    const nodes = collectNodes(tableDemo.root);
    const ids = nodes
      .filter((node) => node.kind === 'proto')
      .map((node) => node.prototypeId)
      .sort();
    expect(new Set(ids)).toEqual(
      new Set([
        'brutalist-table-root',
        'brutalist-table-caption',
        'brutalist-table-row',
        'brutalist-table-header-cell',
        'brutalist-table-cell',
      ])
    );
    expect(ids.filter((id) => id === 'brutalist-table-root')).toHaveLength(1);
    expect(ids.filter((id) => id === 'brutalist-table-caption')).toHaveLength(1);
    expect(ids.filter((id) => id === 'brutalist-table-row')).toHaveLength(4);
    expect(
      nodes.some((node) => node.kind === 'proto' && node.prototypeId.includes('data-table'))
    ).toBe(false);
  });

  it('declares headerKind on header cells and ordered headers keys on cells', () => {
    // T-BRUTALIST-TABLE-0001-CASE-4
    const nodes = collectNodes(tableDemo.root).filter(
      (node): node is DemoProtoNode => node.kind === 'proto'
    );
    for (const headerCell of nodes.filter(
      (node) => node.prototypeId === 'brutalist-table-header-cell'
    )) {
      expect(typeof headerCell.props?.headerKey).toBe('string');
      expect(['column', 'row']).toContain(headerCell.props?.headerKind);
      // Spans stay at their single-cell defaults; the demo claims no span.
      expect(headerCell.props?.rowSpan ?? 1).toBe(1);
      expect(headerCell.props?.columnSpan ?? 1).toBe(1);
    }
    for (const cell of nodes.filter((node) => node.prototypeId === 'brutalist-table-cell')) {
      expect(Array.isArray(cell.props?.headers)).toBe(true);
      expect(cell.props?.rowSpan ?? 1).toBe(1);
      expect(cell.props?.columnSpan ?? 1).toBe(1);
    }
  });

  it('marks every row with visual section and lastInSection paint facts', () => {
    // T-BRUTALIST-TABLE-0001-CASE-4: section inputs are presentation-only;
    // the demo supplies them for header, body and footer rows.
    const rows = collectNodes(tableDemo.root).filter(
      (node): node is DemoProtoNode =>
        node.kind === 'proto' && node.prototypeId === 'brutalist-table-row'
    );
    const sections = rows.map((row) => row.props?.section);
    expect(sections).toEqual(['header', 'body', 'body', 'footer']);
    const lastFlags = rows.map((row) => row.props?.lastInSection);
    expect(lastFlags).toEqual([false, false, true, true]);
  });
});
