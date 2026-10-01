import { describe, expect, it } from 'vitest';
import {
  tableCaption,
  tableCell,
  tableHeaderCell,
  tableRoot,
  tableRow,
} from '../../../prototypes/base/src/table';
import { AdaptToWebComponent, setElementProps } from '../src';

for (const prototype of [tableRoot, tableCaption, tableRow, tableHeaderCell, tableCell]) {
  AdaptToWebComponent(prototype);
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function element(tag: string): HTMLElement {
  return document.createElement(tag);
}

describe('web-component Table A11y projection', () => {
  it('materializes ordered one-based facts and clears invalid structure', async () => {
    const root = element('base-table-root');
    const caption = element('base-table-caption');
    const headerRow = element('base-table-row');
    const dataRow = element('base-table-row');
    const quarter = element('base-table-header-cell');
    const owner = element('base-table-header-cell');
    const cell = element('base-table-cell');
    caption.textContent = 'Accounts';
    quarter.textContent = 'Quarter';
    owner.textContent = 'Owner';
    cell.textContent = 'Ada';
    setElementProps(quarter, { headerKey: 'quarter', headerKind: 'column' });
    setElementProps(owner, { headerKey: 'owner', headerKind: 'row' });
    setElementProps(cell, { headers: ['owner', 'quarter'] });
    headerRow.append(quarter);
    dataRow.append(owner, cell);
    root.append(caption, headerRow, dataRow);
    document.body.append(root);

    try {
      await flush();
      expect(root.getAttribute('role')).toBe('table');
      expect(root.getAttribute('aria-rowcount')).toBe('2');
      expect(root.getAttribute('aria-colcount')).toBe('2');
      expect(root.getAttribute('aria-labelledby')).toBe(caption.id);
      expect(headerRow.getAttribute('role')).toBe('row');
      expect(headerRow.getAttribute('aria-rowindex')).toBe('1');
      expect(dataRow.getAttribute('role')).toBe('row');
      expect(dataRow.getAttribute('aria-rowindex')).toBe('2');
      expect(quarter.getAttribute('role')).toBe('columnheader');
      expect(quarter.getAttribute('aria-rowindex')).toBe('1');
      expect(quarter.getAttribute('aria-colindex')).toBe('1');
      expect(owner.getAttribute('role')).toBe('rowheader');
      expect(owner.getAttribute('aria-rowindex')).toBe('2');
      expect(owner.getAttribute('aria-colindex')).toBe('1');
      expect(cell.getAttribute('role')).toBe('cell');
      expect(cell.getAttribute('aria-rowindex')).toBe('2');
      expect(cell.getAttribute('aria-colindex')).toBe('2');
      expect(cell.getAttribute('aria-rowspan')).toBe('1');
      expect(cell.getAttribute('aria-colspan')).toBe('1');
      expect(cell.id).not.toBe('');
      expect(cell.getAttribute('aria-labelledby')).toBe(`${owner.id} ${quarter.id} ${cell.id}`);

      const orphan = element('base-table-cell');
      setElementProps(orphan, { headers: ['quarter'] });
      root.append(orphan);
      await flush();
      for (const part of [root, caption, headerRow, dataRow, quarter, owner, cell, orphan]) {
        expect(part.getAttribute('role')).toBeNull();
      }
      expect(root.hasAttribute('aria-rowcount')).toBe(false);
      expect(root.hasAttribute('aria-colcount')).toBe(false);
      expect(cell.hasAttribute('aria-rowindex')).toBe(false);
      expect(cell.hasAttribute('aria-colindex')).toBe(false);
      expect(cell.hasAttribute('aria-labelledby')).toBe(false);
    } finally {
      root.remove();
      await flush();
    }
  });
});
