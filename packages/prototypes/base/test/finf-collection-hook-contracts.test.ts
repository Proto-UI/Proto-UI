import type { ProtoAdapterExposes } from '@proto.ui/adapter-base';
import { afterEach, expect, it } from 'vitest';
import { definePrototype, type AsHookResult } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as tree from '../src/tree';
import * as message from '../src/message-scroller';
import * as virtual from '../src/virtual-list';
import * as table from '../src/data-table';

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
let serial = 0;
function consumer(
  name: string,
  use: () => AsHookResult<any, any>,
  props: Record<string, unknown> = {}
) {
  let handle: AsHookResult<any, any> | undefined;
  const tag = `contract-${name}-${serial++}`;
  const proto = definePrototype({
    name: tag,
    setup() {
      handle = use();
      return handle.render;
    },
  });
  AdaptToWebComponent(proto, { registerAs: tag });
  const element = document.createElement(tag);
  setElementProps(element, props);
  return {
    element,
    get handle() {
      if (!handle) throw new Error(`${name}: setup did not run`);
      return handle;
    },
  };
}
it('inspects real authored hook frames and nested child handles', async () => {
  const tr = consumer('tree-root', tree.asTreeRoot),
    ti = consumer('tree-item', tree.asTreeItem, { nodeKey: 'a' }),
    tg = consumer('tree-group', tree.asTreeGroup),
    tt = consumer('tree-toggle', tree.asTreeToggle, { nodeKey: 'a' });
  tr.element.append(ti.element, tg.element, tt.element);
  const mr = consumer('message-root', message.asMessageScrollerRoot),
    mv = consumer('message-viewport', message.asMessageScrollerViewport),
    mj = consumer('message-jump', message.asMessageScrollerJump);
  mr.element.append(mv.element, mj.element);
  const vr = consumer('virtual-root', virtual.asVirtualListRoot),
    vv = consumer('virtual-viewport', virtual.asVirtualListViewport),
    vc = consumer('virtual-content', virtual.asVirtualListContent);
  vv.element.append(vc.element);
  vr.element.append(vv.element);
  const dr = consumer('table-root', table.asDataTableRoot, { rows: [{ id: 'a', name: 'A' }] }),
    dw = consumer('table-row', table.asDataTableRow),
    dc = consumer('table-cell', table.asDataTableCell, { columnKey: 'name' }),
    dh = consumer('table-header', table.asDataTableHeader, { headerKey: 'name' }),
    dcap = consumer('table-caption', table.asDataTableCaption),
    dp = consumer('table-previous', table.asDataTablePrevious),
    dn = consumer('table-next', table.asDataTableNext);
  dw.element.append(dc.element);
  dr.element.append(dh.element, dw.element, dcap.element, dp.element, dn.element);
  document.body.append(tr.element, mr.element, vr.element, dr.element);
  await flush();
  type Domains<H extends AsHookResult<any, any>> = {
    [K in keyof NonNullable<H['stateHandles']>]: NonNullable<H['stateHandles']>[K] extends {
      get(): infer V;
    }
      ? V extends boolean
        ? 'boolean'
        : V extends number
          ? 'number'
          : V extends string
            ? 'string'
            : never
      : never;
  };
  // Exhaustive at compile time against each public contract; exact at runtime against each real frame.
  const expected = {
    tr: {
      a11yLabel: 'string',
      collectionCount: 'number',
      invalid: 'boolean',
      value: 'string',
    } satisfies Domains<ReturnType<typeof tree.asTreeRoot>>,
    ti: {
      branch: 'boolean',
      collectionFirst: 'boolean',
      collectionIndex: 'number',
      collectionLast: 'boolean',
      collectionTotal: 'number',
      disabled: 'boolean',
      expanded: 'boolean',
      expandedText: 'string',
      focusVisible: 'boolean',
      focused: 'boolean',
      hidden: 'boolean',
      level: 'number',
      position: 'number',
      selected: 'boolean',
      setSize: 'number',
    } satisfies Domains<ReturnType<typeof tree.asTreeItem>>,
    tg: {} satisfies Domains<ReturnType<typeof tree.asTreeGroup>>,
    tt: {} satisfies Domains<ReturnType<typeof tree.asTreeToggle>>,
    mr: {} satisfies Domains<ReturnType<typeof message.asMessageScrollerRoot>>,
    mv: {
      '@scroll/endFollowRequestStatus': 'string',
      '@scroll/endFollowState': 'string',
      '@scroll/verticalAtEnd': 'boolean',
      a11yLabel: 'string',
    } satisfies Domains<ReturnType<typeof message.asMessageScrollerViewport>>,
    mj: { atEnd: 'boolean', newContentCount: 'number' } satisfies Domains<
      ReturnType<typeof message.asMessageScrollerJump>
    >,
    vr: { a11yLabel: 'string', logicalCount: 'number' } satisfies Domains<
      ReturnType<typeof virtual.asVirtualListRoot>
    >,
    vv: {} satisfies Domains<ReturnType<typeof virtual.asVirtualListViewport>>,
    vc: {} satisfies Domains<ReturnType<typeof virtual.asVirtualListContent>>,
    dr: { collectionCount: 'number', filteredCount: 'number' } satisfies Domains<
      ReturnType<typeof table.asDataTableRoot>
    >,
    dw: {
      collectionFirst: 'boolean',
      collectionIndex: 'number',
      collectionLast: 'boolean',
      collectionTotal: 'number',
      focusVisible: 'boolean',
      focused: 'boolean',
      hidden: 'boolean',
      rowKey: 'string',
      selected: 'boolean',
    } satisfies Domains<ReturnType<typeof table.asDataTableRow>>,
    dc: { displayValue: 'string' } satisfies Domains<ReturnType<typeof table.asDataTableCell>>,
    dh: { sort: 'string' } satisfies Domains<ReturnType<typeof table.asDataTableHeader>>,
    dcap: {} satisfies Domains<ReturnType<typeof table.asDataTableCaption>>,
    dp: {} satisfies Domains<ReturnType<typeof table.asDataTablePrevious>>,
    dn: {} satisfies Domains<ReturnType<typeof table.asDataTableNext>>,
  };
  const exposeKeys = {
    tr: {
      count: true,
      getCollectionItems: true,
      getCollectionCount: true,
      value: true,
      invalid: true,
      getTree: true,
      getExpandedKeys: true,
      refresh: true,
      requestValue: true,
      requestExpanded: true,
    } satisfies Record<keyof ProtoAdapterExposes<typeof tree.treeRoot>, true>,
    ti: {
      collectionIndex: true,
      collectionTotal: true,
      collectionFirst: true,
      collectionLast: true,
      getCollectionItem: true,
      selected: true,
      expanded: true,
      hidden: true,
      disabled: true,
      level: true,
      position: true,
      setSize: true,
      branch: true,
      focused: true,
      focusVisible: true,
      getNode: true,
      focusSelf: true,
    } satisfies Record<keyof ProtoAdapterExposes<typeof tree.treeItem>, true>,
    tg: {} satisfies Record<keyof ProtoAdapterExposes<typeof tree.treeGroup>, true>,
    tt: {
      disabled: true,
      hovered: true,
      focused: true,
      focusVisible: true,
      pressed: true,
      focusSelf: true,
    } satisfies Record<keyof ProtoAdapterExposes<typeof tree.treeToggle>, true>,
    mr: {} satisfies Record<keyof ProtoAdapterExposes<typeof message.messageScrollerRoot>, true>,
    mv: {
      focused: true,
      focusVisible: true,
      scrollAxes: true,
      scrolling: true,
      scrollProjection: true,
      scrollXPosition: true,
      scrollXVisibleRatio: true,
      canScrollLeft: true,
      canScrollRight: true,
      scrollYPosition: true,
      scrollYVisibleRatio: true,
      canScrollUp: true,
      canScrollDown: true,
      atEnd: true,
      following: true,
      requestStatus: true,
      jumpToEnd: true,
    } satisfies Record<keyof ProtoAdapterExposes<typeof message.messageScrollerViewport>, true>,
    mj: {
      disabled: true,
      hovered: true,
      focused: true,
      focusVisible: true,
      pressed: true,
      focusSelf: true,
      atEnd: true,
      newContentCount: true,
    } satisfies Record<keyof ProtoAdapterExposes<typeof message.messageScrollerJump>, true>,
    vr: { logicalCount: true, getCollection: true, getWindow: true } satisfies Record<
      keyof ProtoAdapterExposes<typeof virtual.virtualListRoot>,
      true
    >,
    vv: {
      focused: true,
      focusVisible: true,
      scrollAxes: true,
      scrolling: true,
      scrollProjection: true,
      scrollXPosition: true,
      scrollXVisibleRatio: true,
      canScrollLeft: true,
      canScrollRight: true,
      scrollYPosition: true,
      scrollYVisibleRatio: true,
      canScrollUp: true,
      canScrollDown: true,
    } satisfies Record<keyof ProtoAdapterExposes<typeof virtual.virtualListViewport>, true>,
    vc: {} satisfies Record<keyof ProtoAdapterExposes<typeof virtual.virtualListContent>, true>,
    dr: {
      getStructure: true,
      count: true,
      getCollectionItems: true,
      getCollectionCount: true,
      filteredCount: true,
      getRows: true,
      getRecord: true,
      requestSort: true,
      requestPage: true,
      requestSelection: true,
    } satisfies Record<keyof ProtoAdapterExposes<typeof table.dataTableRoot>, true>,
    dw: {
      collectionIndex: true,
      collectionTotal: true,
      collectionFirst: true,
      collectionLast: true,
      getCollectionItem: true,
      rowKey: true,
      selected: true,
      focused: true,
      focusVisible: true,
    } satisfies Record<keyof ProtoAdapterExposes<typeof table.dataTableRow>, true>,
    dc: { displayValue: true } satisfies Record<
      keyof ProtoAdapterExposes<typeof table.dataTableCell>,
      true
    >,
    dh: { sort: true } satisfies Record<
      keyof ProtoAdapterExposes<typeof table.dataTableHeader>,
      true
    >,
    dcap: {} satisfies Record<keyof ProtoAdapterExposes<typeof table.dataTableCaption>, true>,
    dp: {
      disabled: true,
      hovered: true,
      focused: true,
      focusVisible: true,
      pressed: true,
      focusSelf: true,
    } satisfies Record<keyof ProtoAdapterExposes<typeof table.dataTablePrevious>, true>,
    dn: {
      disabled: true,
      hovered: true,
      focused: true,
      focusVisible: true,
      pressed: true,
      focusSelf: true,
    } satisfies Record<keyof ProtoAdapterExposes<typeof table.dataTableNext>, true>,
  };
  const consumers = { tr, ti, tg, tt, mr, mv, mj, vr, vv, vc, dr, dw, dc, dh, dcap, dp, dn };
  for (const name of Object.keys(consumers) as (keyof typeof consumers)[]) {
    const c = consumers[name],
      states = c.handle.stateHandles ?? {};
    const exposed = (
      c.element as unknown as { getExposes(): Record<string, unknown> }
    ).getExposes();
    expect(Object.keys(exposed).sort(), `${name} public exposes`).toEqual(
      Object.keys(exposeKeys[name]).sort()
    );
    expect(Object.keys(states).sort(), name).toEqual(Object.keys(expected[name]).sort());
    for (const [key, domain] of Object.entries(expected[name])) {
      const state = (states as Record<string, { get(): unknown }>)[key];
      expect(typeof state.get(), `${name}.${key}`).toBe(domain);
    }
  }
  for (const command of [tt, mj, dp, dn]) {
    const button = command.handle.getAsHookHandle?.('as-button') as
      | ReturnType<typeof import('../src/button').asButton>
      | undefined;
    expect(button?.stateHandles?.focusVisible.get()).toBe(false);
    expect(button?.stateHandles?.disabled.get()).toBe(false);
    expect(command.handle.stateHandles ?? {}).not.toHaveProperty('focusVisible');
  }
  for (const viewport of [mv, vv]) {
    const scroll = viewport.handle.getAsHookHandle?.('as-scroll-area-viewport') as
      | ReturnType<typeof import('../src/scroll-area').asScrollAreaViewport>
      | undefined;
    expect(scroll?.stateHandles?.focused.get()).toBe(false);
    expect(scroll?.stateHandles?.focusVisible.get()).toBe(false);
    expect(viewport.handle.stateHandles ?? {}).not.toHaveProperty('focusVisible');
  }
});
