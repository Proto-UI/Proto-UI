import { afterEach, describe, expect, it } from 'vitest';
import {
  tableCaption,
  tableCell,
  tableHeaderCell,
  tableRoot,
  tableRow,
} from '../../../prototypes/base/src/table';
import { AdaptToWebComponent, setElementProps } from '../src';

for (const prototype of [tableRoot, tableCaption, tableRow, tableHeaderCell, tableCell])
  AdaptToWebComponent(prototype);
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
async function fixture() {
  const node = (tag: string, props?: Record<string, unknown>) => {
    const element = document.createElement(tag);
    if (props) setElementProps(element, props);
    return element;
  };
  const root = node('base-table-root');
  const caption = node('base-table-caption');
  const heading = node('base-table-row');
  const h1 = node('base-table-header-cell', { headerKey: 'one', headerKind: 'column' });
  const h2 = node('base-table-header-cell', { headerKey: 'two', headerKind: 'column' });
  const row = node('base-table-row');
  const c1 = node('base-table-cell', { headers: ['one', 'two'] });
  const c2 = node('base-table-cell', { headers: ['one'] });
  const spareRow = node('base-table-row');
  const spareCell = node('base-table-cell', { headers: ['one'] });
  const parking = document.createElement('div');
  heading.append(h1, h2);
  row.append(c1, c2);
  spareRow.append(spareCell);
  root.append(caption, heading, row, spareRow);
  document.body.append(root, parking);
  await flush();
  expect(root.getAttribute('role')).toBe('table');
  return { root, caption, h1, h2, row, c1, c2, spareRow, spareCell, parking };
}
const expectCleared = (element: HTMLElement) => {
  expect(element.isConnected).toBe(true);
  for (const attribute of [
    'role',
    'aria-rowindex',
    'aria-colindex',
    'aria-rowspan',
    'aria-colspan',
    'aria-labelledby',
  ])
    expect(element.getAttribute(attribute), attribute).toBeNull();
};
describe('Table valid-to-valid retained membership', () => {
  it('releases a row and its cells moved outside the domain while still connected', async () => {
    const { root, spareRow, spareCell, parking } = await fixture();
    parking.append(spareRow);
    await flush();
    expect(root.getAttribute('role')).toBe('table');
    expect(root.getAttribute('aria-rowcount')).toBe('2');
    expectCleared(spareRow);
    expectCleared(spareCell);
  });
  it('releases a cell moved outside the domain while its old row remains valid', async () => {
    const { root, c2, parking } = await fixture();
    parking.append(c2);
    await flush();
    expect(root.getAttribute('role')).toBe('table');
    expectCleared(c2);
  });
  it('withdraws removed headers and captions without retaining old IDREFs', async () => {
    const { root, caption, h1, h2, c1, parking } = await fixture();
    const oldHeaderId = h2.id,
      oldCaptionId = caption.id;
    (c1 as HTMLElement & { setProps(props: unknown): void }).setProps({ headers: ['one'] });
    await flush();
    expect(c1.getAttribute('aria-labelledby')).toBe(`${h1.id} ${c1.id}`);
    expect(c1.getAttribute('aria-labelledby')).not.toContain(oldHeaderId);
    parking.append(h2, caption);
    await flush();
    expect(root.getAttribute('role')).toBe('table');
    expect(root.hasAttribute('aria-labelledby')).toBe(false);
    expect(root.getAttribute('aria-labelledby')).not.toBe(oldCaptionId);
    expectCleared(h2);
    expectCleared(caption);
  });
  it('rebinds a retained row to another valid Table and restores current facts when moved back', async () => {
    const left = await fixture();
    const right = await fixture();
    const cellId = left.spareCell.id;
    right.root.append(left.spareRow);
    await flush();
    expect(left.root.getAttribute('aria-rowcount')).toBe('2');
    expect(right.root.getAttribute('aria-rowcount')).toBe('4');
    expect(left.spareRow.getAttribute('role')).toBe('row');
    expect(left.spareRow.getAttribute('aria-rowindex')).toBe('4');
    expect(left.spareCell.getAttribute('role')).toBe('cell');
    expect(left.spareCell.getAttribute('aria-rowindex')).toBe('4');
    expect(left.spareCell.getAttribute('aria-labelledby')).toBe(`${right.h1.id} ${cellId}`);
    left.root.append(left.spareRow);
    await flush();
    expect(left.root.getAttribute('aria-rowcount')).toBe('3');
    expect(right.root.getAttribute('aria-rowcount')).toBe('3');
    expect(left.spareCell.getAttribute('aria-rowindex')).toBe('3');
    expect(left.spareCell.getAttribute('aria-labelledby')).toBe(`${left.h1.id} ${cellId}`);
  });
});
