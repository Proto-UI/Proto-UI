import {
  createAnatomyFamily,
  defineAsHook,
  definePrototype,
  type DefHandle,
  type RunHandle,
} from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { asScrollAreaRoot, asScrollAreaViewport } from '../scroll-area';
import { createWindowedCollection } from './model';
export * from './model';
export interface VirtualListRootProps {
  itemKeys?: readonly string[];
  overscanItems?: number;
  maxMaterializedItems?: number;
  a11yLabel?: string;
}
export const VIRTUAL_LIST_FAMILY = createAnatomyFamily('base-virtual-list', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    viewport: { cardinality: { min: 1, max: 1 } },
    content: { cardinality: { min: 1, max: 1 } },
  },
});
function setupRoot(def: DefHandle<VirtualListRootProps, any>) {
  asScrollAreaRoot();
  def.anatomy.claim(VIRTUAL_LIST_FAMILY, { role: 'root' });
  def.props.define({
    itemKeys: { type: 'object' },
    overscanItems: { type: 'number' },
    maxMaterializedItems: { type: 'number' },
    a11yLabel: { type: 'string' },
  });
  def.props.setDefaults({
    itemKeys: [],
    overscanItems: 2,
    maxMaterializedItems: 100,
    a11yLabel: 'Virtual list',
  });
  const a11y = asAccessible();
  const label = def.state.string('a11yLabel', 'Virtual list');
  a11y.role('region');
  a11y.name(label);
  const collection = createWindowedCollection(),
    count = def.state.numberDiscrete('logicalCount', 0);
  def.expose.state('logicalCount', count);
  def.expose.method('getCollection', () => collection);
  def.expose.method('getWindow', () => collection.snapshot());
  const sync = (run: RunHandle<VirtualListRootProps>) => {
    const p = run.props.get();
    label.set(p.a11yLabel ?? 'Virtual list', 'virtual list name');
    collection.configure({
      overscanItems: p.overscanItems,
      maxMaterializedItems: p.maxMaterializedItems,
    });
    collection.setItems(p.itemKeys ?? []);
    count.set(collection.snapshot().keys.length, 'logical collection count');
  };
  def.lifecycle.onCreated(sync);
  def.props.watchAll(sync);
  def.lifecycle.onUnmounted(() => collection.invalidate());
}
export const asVirtualListRoot = defineAsHook({ name: 'as-virtual-list-root', setup: setupRoot });
export const virtualListRoot = definePrototype({
  name: 'base-virtual-list-root',
  setup: setupRoot,
});
function setupViewport(def: DefHandle<Record<string, never>, any>) {
  asScrollAreaViewport();
  def.anatomy.claim(VIRTUAL_LIST_FAMILY, { role: 'viewport' });
}
export const asVirtualListViewport = defineAsHook({
  name: 'as-virtual-list-viewport',
  setup: setupViewport,
});
export const virtualListViewport = definePrototype({
  name: 'base-virtual-list-viewport',
  setup: setupViewport,
});
function setupContent(def: DefHandle<Record<string, never>, any>) {
  def.anatomy.claim(VIRTUAL_LIST_FAMILY, { role: 'content' });
  asAccessible().role('list');
}
export const asVirtualListContent = defineAsHook({
  name: 'as-virtual-list-content',
  setup: setupContent,
});
export const virtualListContent = definePrototype({
  name: 'base-virtual-list-content',
  setup: setupContent,
});
