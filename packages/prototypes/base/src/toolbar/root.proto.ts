import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible, asCollection, asFocusRoving } from '@proto.ui/hooks';
import { TOOLBAR_CONTEXT, TOOLBAR_FAMILY, type ToolbarContext } from './shared';
import type { ToolbarRootProps, ToolbarRootExposes, ToolbarRootAsHookContract } from './types';
function setup(def: DefHandle<ToolbarRootProps, ToolbarRootExposes>) {
  def.anatomy.claim(TOOLBAR_FAMILY, { role: 'root' });
  asCollection().configure({ family: TOOLBAR_FAMILY, itemRole: 'button' });
  def.props.define({
    disabled: { type: 'boolean', empty: 'fallback' },
    orientation: { type: 'enum', empty: 'fallback', options: ['horizontal', 'vertical'] },
    loop: { type: 'boolean', empty: 'fallback' },
    a11yLabel: { type: 'string', empty: 'fallback' },
  });
  def.props.setDefaults({ disabled: false, orientation: 'horizontal', loop: true, a11yLabel: '' });
  const disabled = def.state.bool('disabled', false),
    orientation = def.state.string('orientation', 'horizontal'),
    label = def.state.string('label', '');
  const a11y = asAccessible();
  a11y.role('toolbar');
  a11y.name(label);
  a11y.state('orientation', orientation);
  a11y.state('disabled', disabled);
  const roving = asFocusRoving<ToolbarRootProps>();
  roving.configure({ navigation: 'arrow', orientation: 'horizontal', loop: true, entry: 'first' });
  def.expose.state('disabled', disabled);
  def.expose.method('focusFirst', () => roving.focusFirst());
  def.expose.method('focusLast', () => roving.focusLast());
  let current = '';
  let currentRun: RunHandle<ToolbarRootProps> | null = null;
  let context: ToolbarContext = { disabled: false, current: '', orientation: 'horizontal' };
  def.context.provide(TOOLBAR_CONTEXT, context);
  const publish = (run: RunHandle<ToolbarRootProps>) => {
    const items = run.anatomy.order
      .partsOf(TOOLBAR_FAMILY, 'button')
      .flatMap((p) => {
        const f = p.getExpose('__collectionItem');
        const v = typeof f === 'function' ? f() : f;
        return v && typeof v === 'object' ? [v as { id: string; disabled: boolean }] : [];
      })
      .filter((v) => !v.disabled);
    if (!items.some((v) => v.id === current)) current = items[0]?.id ?? '';
    const next = {
      disabled: disabled.get(),
      current,
      orientation: run.props.get().orientation ?? 'horizontal',
    };
    if (JSON.stringify(context) === JSON.stringify(next)) return;
    context = next;
    run.context.update(TOOLBAR_CONTEXT, next);
  };
  def.expose.method('setCurrent', (id) => {
    current = id;
    if (currentRun) publish(currentRun);
  });
  const sync = (run: RunHandle<ToolbarRootProps>) => {
    currentRun = run;
    const p = run.props.get();
    disabled.set(!!p.disabled, 'reason: toolbar disabled');
    orientation.set(p.orientation ?? 'horizontal', 'reason: toolbar orientation');
    label.set(p.a11yLabel ?? '', 'reason: toolbar name');
    roving.setOrientation(p.orientation ?? 'horizontal');
    roving.setLoop(p.loop ?? true);
    publish(run);
  };
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted(sync);
  def.lifecycle.onUnmounted(() => {
    currentRun = null;
  });
  def.props.watchAll(sync);
  def.anatomy.subscribeParts(TOOLBAR_FAMILY, 'button', publish);
}
export const asToolbarRoot = defineAsHook<
  ToolbarRootProps,
  ToolbarRootExposes,
  ToolbarRootAsHookContract
>({ name: 'as-toolbar-root', setup });
export default definePrototype({ name: 'base-toolbar-root', setup });
