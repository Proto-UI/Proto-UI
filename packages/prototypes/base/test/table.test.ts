import { describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { tableCaption, tableCell, tableHeaderCell, tableRoot, tableRow } from '../src/table';
import type { TableStructureSnapshot } from '@proto.ui/module-table-structure';

for (const prototype of [tableRoot, tableCaption, tableRow, tableHeaderCell, tableCell]) {
  AdaptToWebComponent(prototype);
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

type TableElement = HTMLElement & { getExposes(): Record<string, unknown> };

function element(tag: string): TableElement {
  return document.createElement(tag) as TableElement;
}

function getStructure(root: TableElement): TableStructureSnapshot {
  const method = root.getExposes().getStructure;
  if (typeof method !== 'function') throw new Error('Table root did not expose getStructure.');
  return method() as TableStructureSnapshot;
}

describe('prototypes/base: Table Structure', () => {
  it('projects ordered spans and opaque multiple-header relationships', async () => {
    const root = element('base-table-root');
    const caption = element('base-table-caption');
    const headerRow = element('base-table-row');
    const dataRow = element('base-table-row');
    const quarter = element('base-table-header-cell');
    const owner = element('base-table-header-cell');
    const value = element('base-table-cell');
    setElementProps(quarter, { headerKey: 'quarter', headerKind: 'column', columnSpan: 2 });
    setElementProps(owner, { headerKey: 'owner', headerKind: 'row' });
    setElementProps(value, { headers: ['owner', 'quarter'] });
    headerRow.append(quarter);
    dataRow.append(owner, value);
    root.append(caption, headerRow, dataRow);
    document.body.append(root);

    try {
      await flush();
      const snapshot = getStructure(root);
      expect(snapshot).toMatchObject({ valid: true, rowCount: 2, columnCount: 2 });
      expect(snapshot.rows[1].cells[1]).toMatchObject({ row: 1, column: 1 });
      expect(snapshot.rows[1].cells[1].columnHeaders).toEqual([snapshot.rows[0].cells[0].ref]);
      expect(snapshot.rows[1].cells[1].rowHeaders).toEqual([snapshot.rows[1].cells[0].ref]);
      expect(snapshot.rows[1].cells[1].orderedHeaders).toEqual([
        snapshot.rows[1].cells[0].ref,
        snapshot.rows[0].cells[0].ref,
      ]);
      expect(snapshot.caption).toBeDefined();
      expect(snapshot.rows[1].cells[1].columnHeaders).not.toContain('quarter');
      setElementProps(value, { headers: ['quarter'] });
      await flush();
      expect(getStructure(root).rows[1].cells[1].rowHeaders).toEqual([]);
      setElementProps(value, { headers: ['quarter', 'owner'] });
      await flush();
      expect(getStructure(root).rows[1].cells[1].rowHeaders).toEqual([
        getStructure(root).rows[1].cells[0].ref,
      ]);
      expect(getStructure(root).rows[1].cells[1].orderedHeaders).toEqual([
        getStructure(root).rows[0].cells[0].ref,
        getStructure(root).rows[1].cells[0].ref,
      ]);
    } finally {
      root.remove();
      await flush();
    }
  });

  it('recomputes insert remove and authored order', async () => {
    const root = element('base-table-root');
    const row = element('base-table-row');
    const header = element('base-table-header-cell');
    const first = element('base-table-cell');
    const second = element('base-table-cell');
    setElementProps(header, { headerKey: 'h', headerKind: 'column' });
    setElementProps(first, { headers: ['h'] });
    setElementProps(second, { headers: ['h'], columnSpan: 2 });
    row.append(header, first);
    root.append(row);
    document.body.append(root);

    try {
      await flush();
      expect(getStructure(root)).toMatchObject({ valid: true, columnCount: 2 });
      row.insertBefore(second, first);
      await flush();
      expect(
        getStructure(root).rows[0].cells.map((cell: { column: number }) => cell.column)
      ).toEqual([0, 1, 3]);
      second.remove();
      await flush();
      expect(getStructure(root)).toMatchObject({ valid: true, columnCount: 2 });
    } finally {
      root.remove();
      await flush();
    }
  });

  it('keeps sibling and nested Table header keys isolated', async () => {
    const createTable = (key: string, reference: string) => {
      const root = element('base-table-root');
      const row = element('base-table-row');
      const header = element('base-table-header-cell');
      const cell = element('base-table-cell');
      setElementProps(header, { headerKey: key, headerKind: 'column' });
      setElementProps(cell, { headers: [reference] });
      row.append(header, cell);
      root.append(row);
      return root;
    };
    const valid = createTable('shared', 'shared');
    const missing = createTable('local', 'shared');
    valid.append(missing);
    document.body.append(valid);
    try {
      await flush();
      expect(getStructure(valid).valid).toBe(true);
      expect(getStructure(missing).valid).toBe(false);
      expect(
        getStructure(missing).diagnostics.map((item: { code: string }) => item.code)
      ).toContain('missing-header-target');
    } finally {
      valid.remove();
      await flush();
    }
  });

  it('rejects a Cell placed directly under Table after a valid Row', async () => {
    const root = element('base-table-root');
    const row = element('base-table-row');
    const header = element('base-table-header-cell');
    const cell = element('base-table-cell');
    const orphan = element('base-table-cell');
    setElementProps(header, { headerKey: 'name', headerKind: 'column' });
    setElementProps(cell, { headers: ['name'] });
    setElementProps(orphan, { headers: ['name'] });
    row.append(header, cell);
    root.append(row);
    document.body.append(root);

    try {
      await flush();
      expect(root.getAttribute('role')).toBe('table');
      expect(row.getAttribute('role')).toBe('row');
      expect(cell.getAttribute('role')).toBe('cell');
      root.append(orphan);
      await flush();
      expect(getStructure(root).valid).toBe(false);
      expect(getStructure(root).diagnostics.map((item) => item.code)).toContain(
        'missing-row-parent'
      );
      expect(root.getAttribute('role')).toBeNull();
      expect(row.getAttribute('role')).toBeNull();
      expect(header.getAttribute('role')).toBeNull();
      expect(cell.getAttribute('role')).toBeNull();
      expect(orphan.getAttribute('role')).toBeNull();
    } finally {
      root.remove();
      await flush();
    }
  });

  it('requires HeaderCell authors to choose row or column semantics', async () => {
    const root = element('base-table-root');
    const row = element('base-table-row');
    const header = element('base-table-header-cell');
    const cell = element('base-table-cell');
    setElementProps(header, { headerKey: 'name' });
    setElementProps(cell, { headers: ['name'] });
    row.append(header, cell);
    root.append(row);
    document.body.append(root);

    try {
      await flush();
      expect(header.getAttribute('role')).toBeNull();
      expect(getStructure(root).valid).toBe(false);
      expect(getStructure(root).diagnostics.map((item) => item.code)).toContain(
        'missing-header-kind'
      );
    } finally {
      root.remove();
      await flush();
    }
  });
});
