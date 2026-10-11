import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { dataTableRoot, dataTablePrevious, dataTableNext } from '../src/data-table';
for (const p of [dataTableRoot, dataTablePrevious, dataTableNext])
  AdaptToWebComponent(p as any, { registerAs: `pager-disabled-${p.name}` });
const roots: HTMLElement[] = [];
const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const flush = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
const api = (element: any) => element.getExposes();
const node = (name: string, props: Record<string, unknown> = {}): any => {
  const el = document.createElement(`pager-disabled-base-${name}`);
  setElementProps(el, props);
  return el;
};
afterEach(async () => {
  roots.splice(0).forEach((root) => root.remove());
  await flush();
});
async function fixture(direction: 'previous' | 'next' = 'next', rootProps = {}, local = {}) {
  const root = node('data-table-root', {
    rows,
    pageSize: 1,
    defaultPage: direction === 'next' ? 0 : 2,
    ...rootProps,
  });
  const control = node(`data-table-${direction}`, local);
  const changes: number[] = [];
  root.addEventListener('pageChange', (event: any) => {
    if (event.target === root) changes.push(event.detail.page);
  });
  root.append(control);
  roots.push(root);
  document.body.append(root);
  await flush();
  return {
    root,
    control,
    changes,
    current: () =>
      api(root)
        .getRows()
        .map((row: any) => row.id),
  };
}
function expectDisabled(control: any, disabled: boolean) {
  expect(api(control).disabled.get()).toBe(disabled);
  expect(control.getAttribute('aria-disabled')).toBe(String(disabled));
  expect(control.tabIndex).toBe(disabled ? -1 : 0);
}
it.each(['previous', 'next'] as const)(
  'DataTable %s local disabled suppresses its own request dispatch',
  async (direction) => {
    const { control, changes, current } = await fixture(direction, {}, { disabled: true });
    const before = current();
    expectDisabled(control, true);
    control.click();
    await flush();
    expect(changes).toEqual([]);
    expect(current()).toEqual(before);
  }
);
it.each(['previous', 'next'] as const)(
  'DataTable %s dynamic disabled and removal retain one normal request',
  async (direction) => {
    const { control, changes, current } = await fixture(direction);
    const before = current();
    setElementProps(control, { disabled: true });
    await flush();
    expectDisabled(control, true);
    control.click();
    await flush();
    expect(changes).toEqual([]);
    expect(current()).toEqual(before);
    setElementProps(control, {});
    await flush();
    expectDisabled(control, false);
    control.click();
    await flush();
    expect(changes).toEqual([1]);
    expect(current()).toEqual(['b']);
  }
);
it.each(['previous', 'next'] as const)(
  'DataTable %s controlled owner rejects while local disable stops additional requests',
  async (direction) => {
    const { control, changes, current } = await fixture(direction, { page: 1 });
    control.click();
    await flush();
    expect(changes).toEqual([direction === 'next' ? 2 : 0]);
    expect(current()).toEqual(['b']);
    setElementProps(control, { disabled: true });
    await flush();
    control.click();
    await flush();
    expect(changes).toHaveLength(1);
    expect(current()).toEqual(['b']);
  }
);
it('DataTable checks local disabled changed synchronously by its Button outward click', async () => {
  const { control, changes, current } = await fixture();
  control.addEventListener('click', (event: Event) => {
    if (event instanceof CustomEvent) setElementProps(control, { disabled: true });
  });
  control.click();
  await flush();
  expectDisabled(control, true);
  expect(changes).toEqual([]);
  expect(current()).toEqual(['a']);
});
it.each(['previous', 'next'] as const)(
  'DataTable %s synchronously accepted owner update remains one request',
  async (direction) => {
    const { root, control, changes, current } = await fixture(direction, { page: 1 });
    root.addEventListener('pageChange', (event: any) =>
      setElementProps(root, { rows, pageSize: 1, page: event.detail.page })
    );
    control.click();
    await flush();
    expect(changes).toEqual([direction === 'next' ? 2 : 0]);
    expect(current()).toEqual([direction === 'next' ? 'c' : 'a']);
  }
);
it.each(['Enter', ' '] as const)(
  'DataTable keyboard %s has a positive route and honors local disabled',
  async (key) => {
    const { control, changes, current } = await fixture();
    api(control).focusSelf({ reason: 'keyboard' });
    await flush();
    expect(document.activeElement).toBe(control);
    const press = async () => {
      control.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      control.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
      await flush();
    };
    await press();
    expect(changes).toEqual([1]);
    setElementProps(control, { disabled: true });
    await flush();
    await press();
    expect(changes).toEqual([1]);
    expect(current()).toEqual(['b']);
  }
);
it('DataTable local control disabled does not become a second Root page policy owner', async () => {
  const { root, changes, current } = await fixture('next', {}, { disabled: true });
  expect(api(root).requestPage(1)).toBe(true);
  await flush();
  expect(changes).toEqual([1]);
  expect(current()).toEqual(['b']);
});
it('DataTable readOnly retains navigation while Root disabled still rejects it', async () => {
  const { root, control, changes, current } = await fixture('next', { readOnly: true });
  control.click();
  await flush();
  expect(changes).toEqual([1]);
  setElementProps(root, { rows, pageSize: 1, disabled: true });
  await flush();
  control.click();
  await flush();
  expect(changes).toEqual([1]);
  expect(current()).toEqual(['b']);
});
it('DataTable existing first and last page no-op requests remain no-ops without choosing focus policy', async () => {
  const previous = await fixture('previous', { page: 0 });
  previous.control.click();
  await flush();
  expect(previous.changes).toEqual([]);
  const next = await fixture('next', { page: 2 });
  next.control.click();
  await flush();
  expect(next.changes).toEqual([]);
});
it.each(['previous', 'next'] as const)(
  'DataTable %s initially projects Root disabled with its existing Button owner',
  async (direction) => {
    const { control, changes } = await fixture(direction, { disabled: true });
    expectDisabled(control, true);
    api(control).focusSelf({ reason: 'keyboard' });
    await flush();
    expect(document.activeElement).not.toBe(control);
    control.click();
    await flush();
    expect(changes).toEqual([]);
  }
);
it.each(['previous', 'next'] as const)(
  'DataTable %s merges Root and local changes without letting either re-enable the other',
  async (direction) => {
    const { root, control, changes, current } = await fixture(direction);
    setElementProps(root, { rows, pageSize: 1, disabled: true });
    await flush();
    expectDisabled(control, true);
    setElementProps(control, { disabled: false });
    await flush();
    expectDisabled(control, true);
    control.click();
    await flush();
    expect(changes).toEqual([]);
    setElementProps(control, { disabled: true });
    setElementProps(root, { rows, pageSize: 1 });
    await flush();
    expectDisabled(control, true);
    control.click();
    await flush();
    expect(changes).toEqual([]);
    setElementProps(control, {});
    await flush();
    expectDisabled(control, false);
    control.click();
    await flush();
    expect(changes).toEqual([1]);
    expect(current()).toEqual(['b']);
  }
);
it('DataTable Root disable clears transient Button facts on the same nested state owner', async () => {
  const { root, control, changes } = await fixture();
  control.dispatchEvent(new Event('pointerenter'));
  control.dispatchEvent(new Event('pointerdown'));
  await flush();
  expect(api(control).hovered.get()).toBe(true);
  expect(api(control).pressed.get()).toBe(true);
  setElementProps(root, { rows, pageSize: 1, disabled: true });
  await flush();
  expectDisabled(control, true);
  expect(api(control).hovered.get()).toBe(false);
  expect(api(control).pressed.get()).toBe(false);
  control.click();
  await flush();
  expect(changes).toEqual([]);
});
it('DataTable checks Root disabled changed synchronously by Button outward click', async () => {
  const { root, control, changes, current } = await fixture();
  control.addEventListener('click', (event: Event) => {
    if (event instanceof CustomEvent) setElementProps(root, { rows, pageSize: 1, disabled: true });
  });
  control.click();
  await flush();
  expectDisabled(control, true);
  expect(changes).toEqual([]);
  expect(current()).toEqual(['a']);
});
