import { describe, expect, it } from 'vitest';
import {
  tableCaption,
  tableCell,
  tableHeaderCell,
  tableRoot,
  tableRow,
} from '../../../prototypes/base/src/table';
import { VueAny, flushVue } from './utils/vue';
import { createVueAdapter } from '../src/adapt';

describe('adapter-vue: Base Table A11y projection', () => {
  it('projects the current Table graph to Web semantics without exposing protocol keys as host IDs', async () => {
    const adapt = createVueAdapter(VueAny);
    const Table = adapt(tableRoot);
    const Caption = adapt(tableCaption);
    const Row = adapt(tableRow);
    const HeaderCell = adapt(tableHeaderCell);
    const Cell = adapt(tableCell);
    const refs: Record<string, any> = {};
    const host = document.createElement('div');
    document.body.appendChild(host);
    const includeInvalid = VueAny.ref(false);
    const app = VueAny.createApp({
      setup() {
        return () =>
          VueAny.h(Table, { ref: (el: any) => (refs.table = el) }, () => [
            VueAny.h(Caption, { ref: (el: any) => (refs.caption = el) }, () => 'Accounts'),
            VueAny.h(Row, { ref: (el: any) => (refs.headingRow = el) }, () => [
              VueAny.h(
                HeaderCell,
                {
                  headerKey: 'quarter',
                  headerKind: 'column',
                  columnSpan: 3,
                  ref: (el: any) => (refs.quarter = el),
                },
                () => 'Quarter'
              ),
            ]),
            VueAny.h(Row, { ref: (el: any) => (refs.dataRow = el) }, () => [
              VueAny.h(
                HeaderCell,
                { headerKey: 'owner', headerKind: 'row', ref: (el: any) => (refs.owner = el) },
                () => 'Owner'
              ),
              VueAny.h(
                Cell,
                {
                  headers: ['owner', 'quarter'],
                  columnSpan: 2,
                  ref: (el: any) => (refs.value = el),
                },
                () => 'Ada'
              ),
              ...(includeInvalid.value
                ? [VueAny.h(Cell, { headers: ['missing'], key: 'invalid' }, () => 'Invalid')]
                : []),
            ]),
          ]);
      },
    });
    app.mount(host);
    await flushVue();
    await flushVue();

    const table = refs.table?.$el as HTMLElement;
    const caption = refs.caption?.$el as HTMLElement;
    const headingRow = refs.headingRow?.$el as HTMLElement;
    const quarter = refs.quarter?.$el as HTMLElement;
    const dataRow = refs.dataRow?.$el as HTMLElement;
    const owner = refs.owner?.$el as HTMLElement;
    const value = refs.value?.$el as HTMLElement;
    try {
      expect(table.getAttribute('role')).toBe('table');
      expect(table.getAttribute('aria-rowcount')).toBe('2');
      expect(table.getAttribute('aria-colcount')).toBe('3');
      expect(table.getAttribute('aria-labelledby')).toBe(caption.id);
      expect(headingRow.getAttribute('role')).toBe('row');
      expect(headingRow.getAttribute('aria-rowindex')).toBe('1');
      expect(dataRow.getAttribute('aria-rowindex')).toBe('2');
      expect(quarter.getAttribute('role')).toBe('columnheader');
      expect(quarter.getAttribute('aria-rowindex')).toBe('1');
      expect(quarter.getAttribute('aria-colindex')).toBe('1');
      expect(quarter.getAttribute('aria-colspan')).toBe('3');
      expect(owner.getAttribute('role')).toBe('rowheader');
      expect(owner.getAttribute('aria-rowindex')).toBe('2');
      expect(owner.getAttribute('aria-colindex')).toBe('1');
      expect(value.getAttribute('role')).toBe('cell');
      expect(value.getAttribute('aria-rowindex')).toBe('2');
      expect(value.getAttribute('aria-colindex')).toBe('2');
      expect(value.getAttribute('aria-rowspan')).toBe('1');
      expect(value.getAttribute('aria-colspan')).toBe('2');
      expect(quarter.id).not.toBe('quarter');
      expect(owner.id).not.toBe('owner');
      expect(value.getAttribute('aria-labelledby')).toBe(`${owner.id} ${quarter.id} ${value.id}`);
      expect(value.textContent).toBe('Ada');

      includeInvalid.value = true;
      await flushVue();
      await flushVue();
      expect(table.hasAttribute('role')).toBe(false);
      expect(table.hasAttribute('aria-rowcount')).toBe(false);
      expect(headingRow.hasAttribute('role')).toBe(false);
      expect(quarter.hasAttribute('role')).toBe(false);
      expect(value.hasAttribute('role')).toBe(false);
      expect(value.hasAttribute('aria-labelledby')).toBe(false);

      includeInvalid.value = false;
      await flushVue();
      await flushVue();
      expect(table.getAttribute('role')).toBe('table');
      expect(value.getAttribute('aria-labelledby')).toBe(`${owner.id} ${quarter.id} ${value.id}`);
    } finally {
      app.unmount();
      host.remove();
    }
  });
});
