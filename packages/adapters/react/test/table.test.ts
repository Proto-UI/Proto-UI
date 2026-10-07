import { describe, expect, it } from 'vitest';
import {
  tableCaption,
  tableCell,
  tableHeaderCell,
  tableRoot,
  tableRow,
} from '../../../prototypes/base/src/table';
import { createMountedReactAdapter, createMountedReactAdapterInto } from './utils/fake-react';

function appendHost(parent: HTMLElement): HTMLElement {
  const host = document.createElement('span');
  parent.appendChild(host);
  return host;
}

describe('adapter-react: Base Table A11y projection', () => {
  it('projects the current Table graph to Web semantics without exposing protocol keys as host IDs', async () => {
    const root = createMountedReactAdapter(tableRoot);
    const caption = createMountedReactAdapterInto(tableCaption, appendHost(root.root!), {});
    const headingRow = createMountedReactAdapterInto(tableRow, appendHost(root.root!), {});
    const quarter = createMountedReactAdapterInto(tableHeaderCell, appendHost(headingRow.root!), {
      headerKey: 'quarter',
      headerKind: 'column',
      columnSpan: 3,
    });
    const dataRow = createMountedReactAdapterInto(tableRow, appendHost(root.root!), {});
    const owner = createMountedReactAdapterInto(tableHeaderCell, appendHost(dataRow.root!), {
      headerKey: 'owner',
      headerKind: 'row',
    });
    const value = createMountedReactAdapterInto(tableCell, appendHost(dataRow.root!), {
      headers: ['owner', 'quarter'],
      columnSpan: 2,
    });
    caption.root?.append('Accounts');
    quarter.root?.append('Quarter');
    owner.root?.append('Owner');
    value.root?.append('Ada');
    let orphan: ReturnType<typeof createMountedReactAdapterInto> | undefined;

    await Promise.resolve();
    await Promise.resolve();

    try {
      expect(root.root?.getAttribute('role')).toBe('table');
      expect(root.root?.getAttribute('aria-rowcount')).toBe('2');
      expect(root.root?.getAttribute('aria-colcount')).toBe('3');
      expect(root.root?.getAttribute('aria-labelledby')).toBe(caption.root?.id);
      expect(headingRow.root?.getAttribute('role')).toBe('row');
      expect(headingRow.root?.getAttribute('aria-rowindex')).toBe('1');
      expect(dataRow.root?.getAttribute('aria-rowindex')).toBe('2');
      expect(quarter.root?.getAttribute('role')).toBe('columnheader');
      expect(quarter.root?.getAttribute('aria-rowindex')).toBe('1');
      expect(quarter.root?.getAttribute('aria-colindex')).toBe('1');
      expect(quarter.root?.getAttribute('aria-colspan')).toBe('3');
      expect(owner.root?.getAttribute('role')).toBe('rowheader');
      expect(owner.root?.getAttribute('aria-rowindex')).toBe('2');
      expect(owner.root?.getAttribute('aria-colindex')).toBe('1');
      expect(value.root?.getAttribute('role')).toBe('cell');
      expect(value.root?.getAttribute('aria-rowindex')).toBe('2');
      expect(value.root?.getAttribute('aria-colindex')).toBe('2');
      expect(value.root?.getAttribute('aria-rowspan')).toBe('1');
      expect(value.root?.getAttribute('aria-colspan')).toBe('2');
      expect(quarter.root?.id).not.toBe('quarter');
      expect(owner.root?.id).not.toBe('owner');
      expect(value.root?.getAttribute('aria-labelledby')).toBe(
        `${owner.root?.id} ${quarter.root?.id} ${value.root?.id}`
      );
      expect(value.root?.textContent).toBe('Ada');

      orphan = createMountedReactAdapterInto(tableCell, appendHost(dataRow.root!), {
        headers: ['missing'],
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(root.root?.hasAttribute('role')).toBe(false);
      expect(root.root?.hasAttribute('aria-rowcount')).toBe(false);
      expect(headingRow.root?.hasAttribute('role')).toBe(false);
      expect(quarter.root?.hasAttribute('role')).toBe(false);
      expect(value.root?.hasAttribute('role')).toBe(false);
      expect(value.root?.hasAttribute('aria-labelledby')).toBe(false);

      orphan.unmount();
      orphan = undefined;
      await Promise.resolve();
      await Promise.resolve();
      expect(root.root?.getAttribute('role')).toBe('table');
      expect(value.root?.getAttribute('aria-labelledby')).toBe(
        `${owner.root?.id} ${quarter.root?.id} ${value.root?.id}`
      );
    } finally {
      orphan?.unmount();
      value.unmount();
      owner.unmount();
      dataRow.unmount();
      quarter.unmount();
      headingRow.unmount();
      caption.unmount();
      root.unmount();
    }
  });
});
