import { afterEach, describe, expect, it } from 'vitest';
import {
  tableCaption,
  tableCell,
  tableHeaderCell,
  tableRoot,
  tableRow,
} from '../../../prototypes/base/src/table';
import { AdaptToWebComponent, setElementProps } from '../src';
import { definePrototype } from '@proto.ui/core';
import { asTableStructure } from '@proto.ui/hooks';

for (const prototype of [tableRoot, tableCaption, tableRow, tableHeaderCell, tableCell])
  AdaptToWebComponent(prototype);
// Add only a read-only test expose to the official Cell setup. It distinguishes
// Table's State withdrawal from an earlier Adapter target-rebinding callback.
AdaptToWebComponent(
  definePrototype({
    name: 'test-inspected-table-cell',
    setup(def) {
      const render = tableCell.setup(def as any);
      const table = asTableStructure('cell');
      def.expose.method('readTableRole', () => table.states.a11yRole.get());
      return render;
    },
  })
);
const flush = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
const attributes = [
  'role',
  'aria-rowcount',
  'aria-colcount',
  'aria-rowindex',
  'aria-colindex',
  'aria-rowspan',
  'aria-colspan',
  'aria-labelledby',
];
type ReactiveElement = HTMLElement & {
  changed: ((name: string, value: string | null) => void) | null;
  setProps(props: Record<string, unknown>): void;
};
function observed(tag: string) {
  const Base = customElements.get(
    tag === 'cell' ? 'test-inspected-table-cell' : `base-table-${tag}`
  )! as {
    new (): HTMLElement & {
      attributeChangedCallback?(name: string, before: string | null, after: string | null): void;
    };
    observedAttributes?: readonly string[];
  };
  class ReentrantPart extends Base {
    static get observedAttributes() {
      return [...(Base.observedAttributes ?? []), ...attributes];
    }
    changed: ReactiveElement['changed'] = null;
    attributeChangedCallback(name: string, before: string | null, after: string | null) {
      if (attributes.includes(name)) this.changed?.(name, after);
      else super.attributeChangedCallback?.(name, before, after);
    }
  }
  customElements.define(`test-reentrant-table-${tag}`, ReentrantPart);
}
observed('root');
observed('cell');
async function fixture() {
  const node = (tag: string, props?: Record<string, unknown>) => {
    const element = document.createElement(tag);
    if (props) setElementProps(element, props);
    return element;
  };
  const root = node('test-reentrant-table-root') as ReactiveElement;
  const caption = node('base-table-caption');
  const heading = node('base-table-row');
  const first = node('base-table-header-cell', { headerKey: 'first', headerKind: 'column' });
  const second = node('base-table-header-cell', { headerKey: 'second', headerKind: 'row' });
  const row = node('base-table-row');
  const cell = node('test-reentrant-table-cell', {
    headers: ['first', 'second'],
  }) as ReactiveElement;
  const peer = node('base-table-cell', { headers: ['first'] });
  const spareRow = node('base-table-row');
  const spare = node('base-table-cell', { headers: ['first'] });
  heading.append(first, second);
  row.append(cell, peer);
  spareRow.append(spare);
  root.append(caption, heading, row, spareRow);
  document.body.append(root);
  await flush();
  expect(root.getAttribute('role')).toBe('table');
  const configure = (span: number) =>
    cell.setProps({
      headers: span === 1 ? ['first', 'second'] : ['second', 'first'],
      columnSpan: span,
    });
  return { root, caption, first, second, row, cell, peer, spareRow, spare, configure };
}

describe('Table synchronous host projection reentry', () => {
  it.each(['role', 'aria-rowcount', 'aria-colcount'])(
    'keeps newest topology after root %s callback',
    async (attribute) => {
      const f = await fixture();
      let called = false;
      f.root.changed = (name, value) => {
        if (
          called ||
          name !== attribute ||
          value === null ||
          (attribute === 'aria-colcount' && f.root.getAttribute('aria-colcount') !== '3')
        )
          return;
        called = true;
        f.configure(1);
      };
      f.configure(2);
      await flush();
      expect(called).toBe(true);
      expect(f.root.getAttribute('aria-colcount')).toBe('2');
      expect(f.cell.getAttribute('aria-colspan')).toBe('1');
      expect(f.peer.getAttribute('aria-colindex')).toBe('2');
      expect(f.cell.getAttribute('aria-labelledby')).toBe(
        `${f.first.id} ${f.second.id} ${f.cell.id}`
      );
    }
  );
  it.each([
    'role',
    'aria-rowindex',
    'aria-colindex',
    'aria-rowspan',
    'aria-colspan',
    'aria-labelledby',
  ])('keeps newest topology after cell %s callback', async (attribute) => {
    const f = await fixture();
    let called = false;
    f.cell.changed = (name, value) => {
      if (
        called ||
        name !== attribute ||
        value === null ||
        f.root.getAttribute('aria-colcount') !== '3'
      )
        return;
      called = true;
      f.configure(1);
    };
    f.configure(2);
    await flush();
    expect(called).toBe(true);
    expect(f.root.getAttribute('aria-colcount')).toBe('2');
    expect(f.cell.getAttribute('aria-colspan')).toBe('1');
    expect(f.peer.getAttribute('aria-colindex')).toBe('2');
    expect(f.cell.getAttribute('aria-labelledby')).toBe(
      `${f.first.id} ${f.second.id} ${f.cell.id}`
    );
  });
  it('does not resume a superseded destination after its root callback moves the row back', async () => {
    const source = await fixture(),
      destination = await fixture();
    let called = false;
    destination.root.changed = (name, value) => {
      if (called || name !== 'aria-rowcount' || value !== '4') return;
      called = true;
      source.root.append(source.spareRow);
    };
    destination.root.append(source.spareRow);
    await flush();
    expect(called).toBe(true);
    expect(source.spareRow.parentNode).toBe(source.root);
    expect(source.spareRow.isConnected).toBe(true);
    expect(source.root.getAttribute('aria-rowcount')).toBe('3');
    expect(destination.root.getAttribute('aria-rowcount')).toBe('3');
    expect(source.spareRow.getAttribute('aria-rowindex')).toBe('3');
    expect(source.spare.getAttribute('aria-rowindex')).toBe('3');
    expect(source.spare.getAttribute('aria-labelledby')).toBe(
      `${source.first.id} ${source.spare.id}`
    );
  });
  it('withdraws a newly published caption when its root IDREF callback removes it', async () => {
    const f = await fixture();
    f.caption.remove();
    await flush();
    let called = false;
    f.root.changed = (name, value) => {
      if (called || name !== 'aria-labelledby' || !value) return;
      called = true;
      f.caption.remove();
    };
    f.root.prepend(f.caption);
    await flush();
    expect(called).toBe(true);
    expect(f.root.getAttribute('role')).toBe('table');
    expect(f.root.hasAttribute('aria-labelledby')).toBe(false);
    expect(f.caption.hasAttribute('role')).toBe(false);
  });
  it('does not restore a terminally removed cell after its attribute callback', async () => {
    const f = await fixture();
    let called = false;
    f.cell.changed = (name, value) => {
      if (called || name !== 'aria-colspan' || value !== '2') return;
      called = true;
      f.cell.remove();
    };
    f.configure(2);
    await flush();
    expect(called).toBe(true);
    expect(f.cell.isConnected).toBe(false);
    expect(f.root.getAttribute('role')).toBe('table');
    for (const attribute of [
      'role',
      'aria-rowindex',
      'aria-colindex',
      'aria-rowspan',
      'aria-colspan',
      'aria-labelledby',
      'id',
    ])
      expect(f.cell.getAttribute(attribute), attribute).toBeNull();
  });
  it('does not let departure cleanup overwrite a synchronous destination rebind', async () => {
    const left = await fixture(),
      right = await fixture();
    const parking = document.createElement('div');
    document.body.append(parking);
    let called = false;
    left.cell.changed = (name, value) => {
      if (
        called ||
        name !== 'role' ||
        value !== null ||
        (left.cell as any).getExposes().readTableRole() !== ''
      )
        return;
      called = true;
      right.row.append(left.cell);
    };
    parking.append(left.cell);
    await flush();
    expect(called).toBe(true);
    expect(left.cell.parentNode).toBe(right.row);
    expect(left.cell.getAttribute('role')).toBe('cell');
    expect(left.cell.getAttribute('aria-colindex')).toBe('3');
    expect(left.cell.getAttribute('aria-labelledby')).toBe(
      `${right.first.id} ${right.second.id} ${left.cell.id}`
    );
    expect(left.root.getAttribute('role')).toBe('table');
    expect(right.root.getAttribute('role')).toBe('table');
  });
});
