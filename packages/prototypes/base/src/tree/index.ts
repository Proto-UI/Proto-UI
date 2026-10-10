import {
  createAnatomyFamily,
  createContextKey,
  defineAsHook,
  definePrototype,
  tw,
  type DefHandle,
  type RunHandle,
} from '@proto.ui/core';
import {
  asAccessible,
  asCollection,
  asCollectionItem,
  asFocusable,
  asTrigger,
} from '@proto.ui/hooks';
import { asButton } from '../button';
import { callOwner, readPartState } from '../collection-controls/shared';
import { treeEntries, type TreeNode, type TreeEntry } from './model';
export * from './model';
export interface TreeRootProps {
  value?: string;
  defaultValue?: string;
  expandedKeys?: readonly string[];
  defaultExpandedKeys?: readonly string[];
  disabled?: boolean;
  readOnly?: boolean;
  a11yLabel?: string;
}
export interface TreeItemProps {
  nodeKey?: string;
  parentKey?: string;
  textValue?: string;
  disabled?: boolean;
}
export interface TreeGroupProps {
  nodeKey?: string;
}
export const TREE_FAMILY = createAnatomyFamily('base-tree', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    item: { cardinality: { min: 0, max: '*' } },
    group: { cardinality: { min: 0, max: '*' } },
    toggle: { cardinality: { min: 0, max: '*' } },
  },
});
type TreeContext = {
  value: string;
  expandedKeys: string[];
  disabled: boolean;
  readOnly: boolean;
  active: string;
  revision: number;
};
export const TREE_CONTEXT = createContextKey<TreeContext>('base-tree');
const initial: TreeContext = {
  value: '',
  expandedKeys: [],
  disabled: false,
  readOnly: false,
  active: '',
  revision: 0,
};
function nodes(run: RunHandle<any>): TreeNode[] {
  return run.anatomy.order.partsOf(TREE_FAMILY, 'item').flatMap((part) => {
    const fn = part.getExpose('getNode');
    return typeof fn === 'function' ? [fn() as TreeNode] : [];
  });
}
function setupRoot(def: DefHandle<TreeRootProps, any>) {
  def.anatomy.claim(TREE_FAMILY, { role: 'root' });
  asCollection().configure({ family: TREE_FAMILY, itemRole: 'item' });
  def.props.define({
    value: { type: 'string' },
    defaultValue: { type: 'string' },
    expandedKeys: { type: 'object' },
    defaultExpandedKeys: { type: 'object' },
    disabled: { type: 'boolean' },
    readOnly: { type: 'boolean' },
    a11yLabel: { type: 'string' },
  });
  def.props.setDefaults({
    defaultValue: '',
    defaultExpandedKeys: [],
    disabled: false,
    readOnly: false,
    a11yLabel: 'Tree',
  });
  def.context.provide(TREE_CONTEXT, initial);
  def.context.subscribe(TREE_CONTEXT);
  const value = def.state.string('value', ''),
    invalid = def.state.bool('invalid', false),
    label = def.state.string('a11yLabel', 'Tree');
  const a = asAccessible();
  a.role('tree');
  a.name(label);
  a.state('invalid', invalid);
  def.expose.state('value', value);
  def.expose.state('invalid', invalid);
  def.expose.event('valueChange', { payload: 'json' });
  def.expose.event('expandedChange', { payload: 'json' });
  let expanded: string[] = [],
    owner: RunHandle<TreeRootProps> | null = null,
    snapshot: TreeEntry[] = [];
  const publish = (run: RunHandle<TreeRootProps>) => {
    const p = run.props.get(),
      old = run.context.read(TREE_CONTEXT);
    try {
      snapshot = treeEntries(nodes(run), expanded);
      invalid.set(false, 'tree valid graph');
    } catch {
      snapshot = [];
      invalid.set(true, 'tree invalid graph');
    }
    const enabled = snapshot.filter((n) => n.visible && !n.disabled);
    const active = enabled.some((n) => n.key === old.active)
      ? old.active
      : (enabled.find((n) => n.key === value.get())?.key ?? enabled[0]?.key ?? '');
    run.context.update(TREE_CONTEXT, {
      value: value.get(),
      expandedKeys: expanded,
      disabled: !!p.disabled,
      readOnly: !!p.readOnly,
      active,
      revision: old.revision + 1,
    });
  };
  def.expose.method('getTree', () => snapshot.map((n) => ({ ...n })));
  def.expose.method('getExpandedKeys', () => [...expanded]);
  def.expose.method('refresh', () => {
    if (owner) publish(owner);
  });
  def.expose.method('requestValue', (key: string) => {
    if (
      !owner ||
      owner.props.get().disabled ||
      owner.props.get().readOnly ||
      invalid.get() ||
      !snapshot.some((n) => n.key === key && n.visible && !n.disabled) ||
      key === value.get()
    )
      return false;
    if (!owner.props.isProvided('value')) value.set(key, 'tree selection request');
    publish(owner);
    owner.expose.emit('valueChange', { value: key });
    return true;
  });
  def.expose.method('requestExpanded', (key: string, open: boolean) => {
    if (
      !owner ||
      owner.props.get().disabled ||
      invalid.get() ||
      !snapshot.some((n) => n.key === key && n.branch && !n.disabled)
    )
      return false;
    const next = open ? [...new Set([...expanded, key])] : expanded.filter((k) => k !== key);
    if (JSON.stringify(next) === JSON.stringify(expanded)) return false;
    if (!owner.props.isProvided('expandedKeys')) expanded = next;
    publish(owner);
    owner.expose.emit('expandedChange', { expandedKeys: next });
    return true;
  });
  const sync = (run: RunHandle<TreeRootProps>, created = false) => {
    owner = run;
    const p = run.props.get();
    if (created || run.props.isProvided('value'))
      value.set(
        (run.props.isProvided('value') ? p.value : p.defaultValue) ?? '',
        'tree owner value'
      );
    if (created || run.props.isProvided('expandedKeys'))
      expanded = [
        ...((run.props.isProvided('expandedKeys') ? p.expandedKeys : p.defaultExpandedKeys) ?? []),
      ];
    label.set(p.a11yLabel ?? 'Tree', 'tree name');
    publish(run);
  };
  def.lifecycle.onCreated((run) => sync(run, true));
  def.lifecycle.onMounted((run) => sync(run));
  def.props.watchAll((run) => sync(run));
  def.anatomy.subscribeParts(TREE_FAMILY, 'item', (run) => {
    if (owner) publish(run);
  });
  def.lifecycle.onUnmounted(() => {
    owner = null;
  });
}
export const asTreeRoot = defineAsHook({ name: 'as-tree-root', setup: setupRoot });
export const treeRoot = definePrototype({ name: 'base-tree-root', setup: setupRoot });
function setupItem(def: DefHandle<TreeItemProps, any>) {
  def.props.define({
    nodeKey: { type: 'string' },
    parentKey: { type: 'string' },
    textValue: { type: 'string' },
    disabled: { type: 'boolean' },
  });
  def.props.setDefaults({ nodeKey: '', parentKey: '', textValue: '', disabled: false });
  asCollectionItem().configure({
    family: TREE_FAMILY,
    role: 'item',
    getMeta: (run) => ({
      value: run.props.get().nodeKey ?? '',
      disabled: !!run.props.get().disabled,
    }),
  });
  const selected = def.state.bool('selected', false),
    expanded = def.state.bool('expanded', false),
    hidden = def.state.bool('hidden', true),
    disabled = def.state.bool('disabled', false),
    level = def.state.numberDiscrete('level', 1),
    position = def.state.numberDiscrete('position', 1),
    setSize = def.state.numberDiscrete('setSize', 1),
    branch = def.state.bool('branch', false),
    expandedText = def.state.string('expandedText', '');
  const focus = asFocusable<TreeItemProps>();
  focus.configure({ disabled: false, navParticipation: 'none' });
  asTrigger();
  const a = asAccessible();
  a.role('treeitem');
  a.nameFromContent();
  a.state('selected', selected);
  a.state('expanded', expandedText);
  a.state('disabled', disabled);
  a.state('hidden', hidden);
  a.state('level', level);
  a.state('posInSet', position);
  a.state('setSize', setSize);
  for (const [key, state] of Object.entries({
    selected,
    expanded,
    hidden,
    disabled,
    level,
    position,
    setSize,
    branch,
    focused: focus.focused,
    focusVisible: focus.focusVisible,
  }))
    def.expose.state(key, state);
  let owner: RunHandle<TreeItemProps> | null = null;
  def.expose.method('getNode', () => ({
    key: owner?.props.get().nodeKey ?? '',
    parentKey: owner?.props.get().parentKey ?? '',
    textValue: owner?.props.get().textValue ?? '',
    disabled: !!owner?.props.get().disabled,
  }));
  def.expose.method('focusSelf', (options: any) => {
    if (!disabled.get() && !hidden.get()) focus.focusSelf(options);
  });
  const sync = (run: RunHandle<TreeItemProps>) => {
    owner = run;
    const c = run.context.read(TREE_CONTEXT),
      key = run.props.get().nodeKey;
    const entries = callOwner(run, TREE_FAMILY, 'getTree') as TreeEntry[] | false;
    const entry = entries ? entries.find((n) => n.key === key) : undefined;
    hidden.set(!entry?.visible, 'tree visibility');
    selected.set(c.value === key, 'tree selection');
    expanded.set(c.expandedKeys.includes(key ?? ''), 'tree expansion');
    branch.set(!!entry?.branch, 'tree branch');
    expandedText.set(entry?.branch ? String(expanded.get()) : '', 'tree branch expansion');
    disabled.set(c.disabled || !!run.props.get().disabled, 'tree disabled');
    level.set(entry?.level ?? 1, 'tree level');
    position.set(entry?.position ?? 1, 'tree position');
    setSize.set(entry?.setSize ?? 1, 'tree siblings');
    focus.setDisabled(disabled.get() || hidden.get());
    focus.setNavParticipation(!hidden.get() && c.active === key ? 'auto' : 'none');
  };
  def.context.subscribe(TREE_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted((run) => {
    sync(run);
    callOwner(run, TREE_FAMILY, 'refresh');
  });
  def.props.watchAll((run) => {
    sync(run);
    callOwner(run, TREE_FAMILY, 'refresh');
  });
  def.lifecycle.onUnmounted(() => {
    owner = null;
  });
  def.rule({
    when: (w) => w.state(hidden).eq(true),
    intent: (i) => i.feedback.style.use(tw('hidden')),
  });
  focus.focused.watch((run, event) => {
    if (event.type !== 'next' || !event.next || hidden.get() || disabled.get()) return;
    const c = run.context.read(TREE_CONTEXT),
      key = run.props.get().nodeKey ?? '';
    if (c.active !== key) run.context.update(TREE_CONTEXT, { ...c, active: key });
  });
  def.event.on('press.commit', (run) => {
    if (!disabled.get() && !hidden.get())
      callOwner(run, TREE_FAMILY, 'requestValue', run.props.get().nodeKey);
  });
  def.event.on('key.down', (run, e) => {
    if (
      !focus.focused.get() ||
      disabled.get() ||
      hidden.get() ||
      e.altKey ||
      e.ctrlKey ||
      e.metaKey
    )
      return;
    const list = (callOwner(run, TREE_FAMILY, 'getTree') as TreeEntry[]).filter(
        (n) => n.visible && !n.disabled
      ),
      key = run.props.get().nodeKey ?? '',
      index = list.findIndex((n) => n.key === key),
      entry = list[index];
    if (!entry) return;
    let target: string | undefined;
    if (e.key === 'ArrowDown') target = list[index + 1]?.key;
    if (e.key === 'ArrowUp') target = list[index - 1]?.key;
    if (e.key === 'Home') target = list[0]?.key;
    if (e.key === 'End') target = list.at(-1)?.key;
    if (e.key === 'ArrowRight') {
      if (entry.branch && !expanded.get())
        callOwner(run, TREE_FAMILY, 'requestExpanded', key, true);
      else target = list.find((n) => n.parentKey === key)?.key;
    }
    if (e.key === 'ArrowLeft') {
      if (entry.branch && expanded.get())
        callOwner(run, TREE_FAMILY, 'requestExpanded', key, false);
      else target = entry.parentKey;
    }
    if (e.key?.length === 1 && e.key !== ' ') {
      const rotated = [...list.slice(index + 1), ...list.slice(0, index + 1)];
      target = rotated.find((n) =>
        (n.textValue ?? n.key).toLowerCase().startsWith((e.key ?? '').toLowerCase())
      )?.key;
    }
    if (!target && !['ArrowLeft', 'ArrowRight'].includes(e.key ?? '')) return;
    e.control.requestDefaultActionPrevention({
      reason: 'tree.navigation',
      source: 'base-tree-item',
    });
    if (target) {
      const c = run.context.read(TREE_CONTEXT);
      run.context.update(TREE_CONTEXT, { ...c, active: target });
      const part = run.anatomy.partsOf(TREE_FAMILY, 'item').find((p) => {
        const fn = p.getExpose('getNode');
        return typeof fn === 'function' && fn().key === target;
      });
      const fn = part?.getExpose('focusSelf');
      if (typeof fn === 'function') fn({ reason: 'keyboard' });
    }
  });
}
export type TreeItemContract = {
  state: {
    selected: import('@proto.ui/core').State<boolean>;
    expanded: import('@proto.ui/core').State<boolean>;
    hidden: import('@proto.ui/core').State<boolean>;
    disabled: import('@proto.ui/core').State<boolean>;
    focusVisible: import('@proto.ui/core').State<boolean>;
  };
};
export const asTreeItem = defineAsHook<TreeItemProps, any, TreeItemContract>({
  name: 'as-tree-item',
  setup: setupItem,
});
export const treeItem = definePrototype({ name: 'base-tree-item', setup: setupItem });
function setupGroup(def: DefHandle<TreeGroupProps, any>) {
  def.anatomy.claim(TREE_FAMILY, { role: 'group' });
  asAccessible().role('group');
}
export const asTreeGroup = defineAsHook({ name: 'as-tree-group', setup: setupGroup });
export const treeGroup = definePrototype({ name: 'base-tree-group', setup: setupGroup });
function setupToggle(def: DefHandle<TreeGroupProps, any>) {
  asButton();
  def.anatomy.claim(TREE_FAMILY, { role: 'toggle' });
  def.props.define({ nodeKey: { type: 'string' } });
  def.context.subscribe(TREE_CONTEXT);
  def.event.on('press.commit', (run) => {
    const key = run.props.get().nodeKey ?? '';
    callOwner(
      run,
      TREE_FAMILY,
      'requestExpanded',
      key,
      !run.context.read(TREE_CONTEXT).expandedKeys.includes(key)
    );
  });
}
export const asTreeToggle = defineAsHook({ name: 'as-tree-toggle', setup: setupToggle });
export const treeToggle = definePrototype({ name: 'base-tree-toggle', setup: setupToggle });
