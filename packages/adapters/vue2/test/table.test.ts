import { describe, expect, it } from 'vitest';
import {
  tableCaption,
  tableCell,
  tableHeaderCell,
  tableRoot,
  tableRow,
} from '../../../prototypes/base/src/table';
import { createVue2Adapter } from '../src/adapt';
import { flushVue2, Vue2Any, Vue2RuntimeAny } from './utils/vue2';

describe('adapter-vue2: Base Table A11y projection', () => {
  it('projects the current Table graph to Web semantics without exposing protocol keys as host IDs', async () => {
    const adapt = createVue2Adapter(Vue2RuntimeAny);
    const Table = adapt(tableRoot);
    const Caption = adapt(tableCaption);
    const Row = adapt(tableRow);
    const HeaderCell = adapt(tableHeaderCell);
    const Cell = adapt(tableCell);
    const App = Vue2Any.extend({
      data() {
        return { includeInvalid: false };
      },
      render(h: any) {
        return h(Table, { ref: 'table' }, [
          h(Caption, { ref: 'caption' }, ['Accounts']),
          h(Row, { ref: 'headingRow' }, [
            h(
              HeaderCell,
              {
                attrs: { headerKey: 'quarter', headerKind: 'column', columnSpan: 3 },
                ref: 'quarter',
              },
              ['Quarter']
            ),
          ]),
          h(Row, { ref: 'dataRow' }, [
            h(HeaderCell, { attrs: { headerKey: 'owner', headerKind: 'row' }, ref: 'owner' }, [
              'Owner',
            ]),
            h(Cell, { attrs: { headers: ['owner', 'quarter'], columnSpan: 2 }, ref: 'value' }, [
              'Ada',
            ]),
            ...(this.includeInvalid
              ? [h(Cell, { attrs: { headers: ['missing'] }, key: 'invalid' }, ['Invalid'])]
              : []),
          ]),
        ]);
      },
    });
    const vm = new App().$mount();
    const host = document.createElement('div');
    document.body.appendChild(host);
    host.appendChild(vm.$el);
    await flushVue2();
    await flushVue2();

    const refs = vm.$refs as Record<string, any>;
    const table = refs.table.$el as HTMLElement;
    const caption = refs.caption.$el as HTMLElement;
    const headingRow = refs.headingRow.$el as HTMLElement;
    const quarter = refs.quarter.$el as HTMLElement;
    const dataRow = refs.dataRow.$el as HTMLElement;
    const owner = refs.owner.$el as HTMLElement;
    const value = refs.value.$el as HTMLElement;
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

      vm.includeInvalid = true;
      await flushVue2();
      expect(table.hasAttribute('role')).toBe(false);
      expect(table.hasAttribute('aria-rowcount')).toBe(false);
      expect(headingRow.hasAttribute('role')).toBe(false);
      expect(quarter.hasAttribute('role')).toBe(false);
      expect(value.hasAttribute('role')).toBe(false);
      expect(value.hasAttribute('aria-labelledby')).toBe(false);

      vm.includeInvalid = false;
      await flushVue2();
      expect(table.getAttribute('role')).toBe('table');
      expect(value.getAttribute('aria-labelledby')).toBe(`${owner.id} ${quarter.id} ${value.id}`);
    } finally {
      vm.$destroy();
      host.remove();
    }
  });
});
