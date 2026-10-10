import { it, expect } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as f0c0 from '../../shadcn/src/tree';
import * as f0c1 from '../../shadcn/src/resizable';
import * as f0c2 from '../../shadcn/src/carousel';
import * as f0c3 from '../../shadcn/src/message-scroller';
import * as f0c4 from '../../shadcn/src/virtual-list';
import * as f0c5 from '../../shadcn/src/date-picker';
import * as f0c6 from '../../shadcn/src/data-table';
import * as f1c0 from '../../brutalist/src/tree';
import * as f1c1 from '../../brutalist/src/resizable';
import * as f1c2 from '../../brutalist/src/carousel';
import * as f1c3 from '../../brutalist/src/message-scroller';
import * as f1c4 from '../../brutalist/src/virtual-list';
import * as f1c5 from '../../brutalist/src/date-picker';
import * as f1c6 from '../../brutalist/src/data-table';
import * as f2c0 from '../../bootstrap-2-3-2/src/tree';
import * as f2c1 from '../../bootstrap-2-3-2/src/resizable';
import * as f2c2 from '../../bootstrap-2-3-2/src/carousel';
import * as f2c3 from '../../bootstrap-2-3-2/src/message-scroller';
import * as f2c4 from '../../bootstrap-2-3-2/src/virtual-list';
import * as f2c5 from '../../bootstrap-2-3-2/src/date-picker';
import * as f2c6 from '../../bootstrap-2-3-2/src/data-table';
import * as f3c0 from '../../liquid-glass/src/tree';
import * as f3c1 from '../../liquid-glass/src/resizable';
import * as f3c2 from '../../liquid-glass/src/carousel';
import * as f3c3 from '../../liquid-glass/src/message-scroller';
import * as f3c4 from '../../liquid-glass/src/virtual-list';
import * as f3c5 from '../../liquid-glass/src/date-picker';
import * as f3c6 from '../../liquid-glass/src/data-table';
const families = [
  {
    name: 'shadcn',
    tree: f0c0,
    resizable: f0c1,
    carousel: f0c2,
    message_scroller: f0c3,
    virtual_list: f0c4,
    date_picker: f0c5,
    data_table: f0c6,
  },
  {
    name: 'brutalist',
    tree: f1c0,
    resizable: f1c1,
    carousel: f1c2,
    message_scroller: f1c3,
    virtual_list: f1c4,
    date_picker: f1c5,
    data_table: f1c6,
  },
  {
    name: 'bootstrap-2-3-2',
    tree: f2c0,
    resizable: f2c1,
    carousel: f2c2,
    message_scroller: f2c3,
    virtual_list: f2c4,
    date_picker: f2c5,
    data_table: f2c6,
  },
  {
    name: 'liquid-glass',
    tree: f3c0,
    resizable: f3c1,
    carousel: f3c2,
    message_scroller: f3c3,
    virtual_list: f3c4,
    date_picker: f3c5,
    data_table: f3c6,
  },
];

const flush = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
const create = (p: any, props: Record<string, unknown> = {}) => {
  const tag = `projection-${p.name}`;
  if (!customElements.get(tag)) AdaptToWebComponent(p, { registerAs: tag });
  const node = document.createElement(tag) as any;
  setElementProps(node, props);
  return node;
};
for (const f of families) {
  it(`${f.name} Tree inherits expansion and selection`, async () => {
    const root = create(f.tree.treeRoot, { defaultExpandedKeys: ['a'] }),
      a = create(f.tree.treeItem, { nodeKey: 'a' }),
      b = create(f.tree.treeItem, { nodeKey: 'b', parentKey: 'a' });
    root.append(a, b);
    document.body.append(root);
    await flush();
    b.click();
    await flush();
    expect(root.getExposes().value.get()).toBe('b');
    expect(b.getAttribute('aria-level')).toBe('2');
    root.remove();
  });
  it(`${f.name} Resizable preserves ratio constraints`, async () => {
    const root = create(f.resizable.resizableRoot),
      panel = create(f.resizable.resizablePanel, { index: 1 }),
      handle = create(f.resizable.resizableHandle);
    root.append(panel, handle);
    document.body.append(root);
    await flush();
    root.getExposes().requestValue(65);
    await flush();
    expect(panel.getExposes().size.get()).toBe(35);
    root.remove();
  });
  it(`${f.name} Carousel changes actual slide visibility`, async () => {
    const root = create(f.carousel.carouselRoot),
      a = create(f.carousel.carouselSlide, { index: 0 }),
      b = create(f.carousel.carouselSlide, { index: 1 }),
      next = create(f.carousel.carouselNext);
    root.append(a, b, next);
    document.body.append(root);
    await flush();
    next.click();
    await flush();
    expect(a.getExposes().hidden.get()).toBe(true);
    expect(b.getExposes().hidden.get()).toBe(false);
    root.remove();
  });
  it(`${f.name} Message Scroller reuses end-follow surface`, async () => {
    const root = create(f.message_scroller.messageScrollerRoot, { newContentCount: 3 }),
      viewport = create(f.message_scroller.messageScrollerViewport),
      jump = create(f.message_scroller.messageScrollerJump);
    root.append(viewport, jump);
    document.body.append(root);
    await flush();
    expect(viewport.getExposes().following).toBeDefined();
    expect(jump.getExposes().newContentCount.get()).toBe(3);
    root.remove();
    await flush();
  });
  it(`${f.name} Virtual List preserves the complete logical set`, async () => {
    const root = create(f.virtual_list.virtualListRoot, { itemKeys: ['a', 'b', 'c'] }),
      viewport = create(f.virtual_list.virtualListViewport),
      content = create(f.virtual_list.virtualListContent);
    viewport.append(content);
    root.append(viewport);
    document.body.append(root);
    await flush();
    const c = root.getExposes().getCollection();
    expect(c.snapshot().keys).toEqual(['a', 'b', 'c']);
    expect(c.snapshot().committed).toBe(null);
    root.remove();
  });
  it(`${f.name} Date Picker renders Calendar value and closes Popover`, async () => {
    const root = create(f.date_picker.datePickerRoot, {
        defaultMonth: '2026-10',
        defaultOpen: true,
      }),
      day = create(f.date_picker.datePickerDay, { date: '2026-10-10' }),
      value = create(f.date_picker.datePickerValue);
    root.append(day, value);
    document.body.append(root);
    await flush();
    day.click();
    await flush();
    expect(root.getExposes().open.get()).toBe(false);
    expect(value.getExposes().displayValue.get()).toBe('2026-10-10');
    expect(value.textContent).toContain('2026-10-10');
    root.remove();
  });
  it(`${f.name} Data Table inherits sort and cell materialization`, async () => {
    const root = create(f.data_table.dataTableRoot, {
        rows: [
          { id: 'a', name: 'Zeta' },
          { id: 'b', name: 'Alpha' },
        ],
      }),
      row = create(f.data_table.dataTableRow, { index: 0 }),
      cell = create(f.data_table.dataTableCell, { columnKey: 'name', headers: ['name'] });
    row.append(cell);
    root.append(row);
    document.body.append(root);
    await flush();
    root.getExposes().requestSort('name');
    await flush();
    expect(cell.getExposes().displayValue.get()).toBe('Alpha');
    expect(cell.textContent).toContain('Alpha');
    root.remove();
  });
}
