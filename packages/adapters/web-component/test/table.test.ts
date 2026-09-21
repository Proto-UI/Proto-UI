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
  it('materializes one-based grid facts and identity-bearing labels', async () => {
    const root = element('base-table-root');
    const caption = element('base-table-caption');
    const row = element('base-table-row');
    const header = element('base-table-header-cell');
    const cell = element('base-table-cell');
    caption.textContent = 'Accounts';
    header.textContent = 'Name';
    cell.textContent = 'Ada';
    setElementProps(header, { headerKey: 'name', headerKind: 'column' });
    setElementProps(cell, { headers: ['name'] });
    row.append(header, cell);
    root.append(caption, row);
    document.body.append(root);

    try {
      await flush();
      expect(root.getAttribute('role')).toBe('table');
      expect(root.getAttribute('aria-rowcount')).toBe('1');
      expect(root.getAttribute('aria-colcount')).toBe('2');
      expect(root.getAttribute('aria-labelledby')).toBe(caption.id);
      expect(row.getAttribute('role')).toBe('row');
      expect(row.getAttribute('aria-rowindex')).toBe('1');
      expect(header.getAttribute('role')).toBe('columnheader');
      expect(header.getAttribute('aria-rowindex')).toBe('1');
      expect(header.getAttribute('aria-colindex')).toBe('1');
      expect(header.getAttribute('aria-rowspan')).toBe('1');
      expect(header.getAttribute('aria-colspan')).toBe('1');
      expect(cell.getAttribute('role')).toBe('cell');
      expect(cell.getAttribute('aria-rowindex')).toBe('1');
      expect(cell.getAttribute('aria-colindex')).toBe('2');
      expect(cell.id).not.toBe('');
      expect(cell.getAttribute('aria-labelledby')).toBe(`${header.id} ${cell.id}`);
    } finally {
      root.remove();
      await flush();
    }
  });
});
