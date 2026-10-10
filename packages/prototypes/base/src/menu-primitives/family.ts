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
  asBoundary,
  asCollection,
  asCollectionItem,
  asFocusable,
  asFocusRoving,
  asOverlay,
  asTrigger,
} from '@proto.ui/hooks';
import { asTransition } from '../tools';
import { useTypeaheadNavigation } from '../behaviors';
import type * as T from './types';
type Context = { id: string; value: string; current: string; disabled: boolean };
let nextId = 0;
export function createMenuFamily(slug: string, navigation: boolean) {
  const family = createAnatomyFamily('base-' + slug, {
    roles: {
      root: { cardinality: { min: 1, max: 1 } },
      trigger: { cardinality: { min: 1, max: '*' } },
      content: { cardinality: { min: 0, max: '*' } },
      item: { cardinality: { min: 0, max: '*' } },
    },
    relations: [
      { kind: 'contains', parent: 'root', child: 'trigger' },
      { kind: 'contains', parent: 'root', child: 'content' },
      { kind: 'contains', parent: 'content', child: 'item' },
    ],
  });
  const context = createContextKey<Context>('base-' + slug),
    contentContext = createContextKey<{ value: string; open: boolean }>(
      'base-' + slug + '-content'
    );
  const invoke = (run: RunHandle<any>, method: string, ...args: unknown[]): any => {
    try {
      const fn = run.anatomy.partsOf(family, 'root')[0]?.getExpose(method);
      return typeof fn === 'function' ? fn(...args) : false;
    } catch (e) {
      if (
        ['CONTEXT_DISCONNECTED', 'ANATOMY_CLAIM_INVALID'].includes(
          (e as { code?: string }).code ?? ''
        )
      )
        return false;
      throw e;
    }
  };
  const triggers = (run: RunHandle<any>) =>
    run.anatomy.order.partsOf(family, 'trigger').flatMap((part) => {
      const raw = part.getExpose('__collectionItem');
      const data = typeof raw === 'function' ? raw() : raw;
      return data && typeof data === 'object' && typeof (data as any).id === 'string'
        ? [{ part, data: data as { id: string; value: string; disabled: boolean } }]
        : [];
    });
  const contentId = (id: string, value: string) => id + '-content-' + encodeURIComponent(value);
  function rootSetup(def: DefHandle<T.MenuRootProps, T.MenuRootExposes>) {
    def.anatomy.claim(family, { role: 'root' });
    asCollection().configure({ family, itemRole: 'trigger' });
    const roving = asFocusRoving<T.MenuRootProps>();
    roving.configure({
      navigation: 'arrow',
      orientation: 'horizontal',
      loop: true,
      entry: 'first',
    });
    def.props.define({
      value: { type: 'string', empty: 'fallback' },
      defaultValue: { type: 'string', empty: 'fallback' },
      disabled: { type: 'boolean', empty: 'fallback' },
      loop: { type: 'boolean', empty: 'fallback' },
      a11yLabel: { type: 'string', empty: 'fallback' },
    });
    def.props.setDefaults({ defaultValue: '', disabled: false, loop: true, a11yLabel: '' });
    const value = def.state.string('value', ''),
      disabled = def.state.bool('disabled', false),
      label = def.state.string('label', '');
    def.expose.state('value', value);
    def.expose.event('valueChange', { payload: 'json' });
    const a11y = asAccessible();
    a11y.role(navigation ? 'navigation' : 'menubar');
    a11y.name(label);
    a11y.state('disabled', disabled);
    const id = 'pui-' + slug + '-' + ++nextId;
    let current = '';
    let runNow: RunHandle<T.MenuRootProps> | null = null;
    let published: Context = { id, value: '', current, disabled: false };
    def.context.provide(context, published);
    const publish = (run: RunHandle<T.MenuRootProps>) => {
      const enabled = triggers(run).filter((t) => !t.data.disabled);
      if (!enabled.some((t) => t.data.id === current))
        current =
          enabled.find((t) => t.data.value === value.get())?.data.id ?? enabled[0]?.data.id ?? '';
      const next = { id, value: value.get(), current, disabled: disabled.get() };
      if (JSON.stringify(next) === JSON.stringify(published)) return;
      published = next;
      run.context.update(context, next);
    };
    const request = (next: string, reason = 'programmatic') => {
      const run = runNow;
      if (!run || disabled.get() || next === value.get()) return false;
      const matches = triggers(run).filter((t) => t.data.value === next);
      if (next && (matches.length !== 1 || matches[0].data.disabled)) return false;
      if (!run.props.isProvided('value')) value.set(next, 'reason: menu active value request');
      publish(run);
      run.expose.emit('valueChange', { value: next, reason });
      return true;
    };
    def.expose.method('requestValue', request);
    def.expose.method('close', () => {
      request('', 'dismiss');
    });
    def.expose.method('__current', (id) => {
      if (runNow) {
        current = id;
        publish(runNow);
      }
    });
    def.expose.method('__refresh', () => {
      if (runNow) publish(runNow);
    });
    def.expose.method('__navigate', (direction) => {
      const run = runNow;
      if (!run || disabled.get()) return;
      const enabled = triggers(run).filter((t) => !t.data.disabled);
      if (!enabled.length) return;
      const index = enabled.findIndex((t) => t.data.value === value.get() || t.data.id === current);
      let i = index + direction;
      i =
        run.props.get().loop === false
          ? Math.max(0, Math.min(enabled.length - 1, i))
          : (i + enabled.length) % enabled.length;
      const next = enabled[i];
      const focus = next.part.getExpose('focusSelf');
      if (typeof focus === 'function') focus({ reason: 'keyboard' });
      current = next.data.id;
      publish(run);
      if (value.get()) request(next.data.value, 'horizontal-navigation');
    });
    const sync = (run: RunHandle<T.MenuRootProps>, initial = false) => {
      runNow = run;
      const p = run.props.get();
      if (initial || run.props.isProvided('value'))
        value.set(
          run.props.isProvided('value') ? (p.value ?? '') : (p.defaultValue ?? ''),
          'reason: menu root owner value'
        );
      disabled.set(!!p.disabled, 'reason: menu root disabled');
      label.set(p.a11yLabel ?? '', 'reason: menu root label');
      roving.setLoop(p.loop !== false);
      publish(run);
    };
    def.lifecycle.onCreated((run) => sync(run, true));
    def.lifecycle.onMounted((run) => sync(run));
    def.lifecycle.onUnmounted(() => {
      runNow = null;
    });
    def.props.watchAll((run) => sync(run));
    def.anatomy.subscribeParts(family, 'trigger', publish);
  }
  function triggerSetup(def: DefHandle<T.MenuTriggerProps, T.MenuTriggerExposes>) {
    const id = 'pui-' + slug + '-trigger-' + ++nextId;
    asCollectionItem().configure({
      family,
      role: 'trigger',
      getMeta: (run) => ({
        id,
        value: run.props.get().value,
        disabled: !!run.props.get().disabled,
      }),
    });
    asTrigger();
    def.props.define({
      value: { type: 'string', empty: 'fallback' },
      disabled: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ value: '', disabled: false });
    const focus = asFocusable<T.MenuTriggerProps>();
    focus.configure({ disabled: false });
    const expanded = def.state.bool('expanded', false),
      disabled = def.state.bool('disabled', false),
      controls = def.state.string('controls', ''),
      hasPopup = def.state.string('hasPopup', navigation ? 'true' : 'menu');
    const a11y = asAccessible();
    a11y.role(navigation ? 'button' : 'menuitem');
    a11y.nameFromContent();
    a11y.state('expanded', expanded);
    a11y.state('disabled', disabled);
    a11y.state('hasPopup', hasPopup);
    a11y.relation('controls', { target: controls });
    def.expose.state('expanded', expanded);
    def.expose.state('disabled', disabled);
    def.expose.state('focused', focus.focused);
    def.expose.state('focusVisible', focus.focusVisible);
    def.expose.method('focusSelf', (options) => {
      if (!disabled.get()) focus.focusSelf(options);
    });
    const sync = (run: RunHandle<T.MenuTriggerProps>, ctx: Context) => {
      disabled.set(ctx.disabled || !!run.props.get().disabled, 'reason: menu trigger disabled');
      expanded.set(
        ctx.value === run.props.get().value && !!ctx.value,
        'reason: menu trigger expanded'
      );
      controls.set(contentId(ctx.id, run.props.get().value), 'reason: menu trigger relationship');
      focus.setDisabled(disabled.get());
      focus.setNavParticipation(ctx.current === id && !disabled.get() ? 'auto' : 'none');
      focus.setRovingStatus({ active: ctx.current === id });
    };
    def.context.subscribe(context, sync);
    def.lifecycle.onMounted((run) => {
      sync(run, run.context.read(context));
      invoke(run, '__refresh');
    });
    def.props.watchAll((run) => {
      sync(run, run.context.read(context));
      invoke(run, '__refresh');
    });
    focus.focused.watch((run, event) => {
      if (event.type === 'next' && event.next && !disabled.get()) {
        invoke(run, '__current', id);
        const ctx = run.context.read(context);
        if (!navigation && ctx.value && ctx.value !== run.props.get().value)
          invoke(run, 'requestValue', run.props.get().value, 'focus-switch');
      }
    });
    const enterContent = (run: RunHandle<T.MenuTriggerProps>, last = false) => {
      invoke(run, 'requestValue', run.props.get().value, 'keyboard');
      const panels = run.anatomy.partsOf(family, 'content');
      const panel = panels.find((p) => {
        const state = p.getExpose('open') as { get?(): boolean } | undefined;
        return state?.get?.();
      });
      const fn = panel?.getExpose(last ? 'focusLast' : 'focusFirst');
      if (typeof fn === 'function') fn();
    };
    def.event.on('press.commit', (run) => {
      if (disabled.get()) return;
      const wasOpen = expanded.get();
      invoke(run, 'requestValue', wasOpen ? '' : run.props.get().value, 'trigger');
      if (!navigation && !wasOpen) enterContent(run);
    });
    def.event.on('pointer.enter', (run) => {
      const ctx = run.context.read(context);
      if (!disabled.get() && ctx.value)
        invoke(run, 'requestValue', run.props.get().value, 'pointer-switch');
    });
    def.event.onGlobal('key.down', (run, event) => {
      if (!focus.focused.get() || disabled.get()) return;
      if (event.key === ' ')
        event.control.requestDefaultActionPrevention({
          reason: slug + '.space',
          source: 'base-' + slug + '-trigger',
        });
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.control.requestDefaultActionPrevention({
          reason: slug + '.open-menu',
          source: 'base-' + slug + '-trigger',
        });
        enterContent(run, event.key === 'ArrowUp');
      }
    });
  }
  function contentSetup(def: DefHandle<T.MenuContentProps, T.MenuContentExposes>) {
    def.anatomy.claim(family, { role: 'content' });
    def.props.define({
      value: { type: 'string', empty: 'fallback' },
      sideOffset: { type: 'number', empty: 'fallback' },
      a11yLabel: { type: 'string', empty: 'fallback' },
    });
    def.props.setDefaults({ value: '', sideOffset: 4, a11yLabel: '' });
    const open = def.state.bool('open', false),
      id = def.state.string('id', ''),
      label = def.state.string('label', '');
    def.expose.state('open', open);
    const a11y = asAccessible();
    a11y.id(id);
    a11y.role(navigation ? 'region' : 'menu');
    a11y.name(label);
    def.context.provide(contentContext, { value: '', open: false });
    const roving = asFocusRoving<T.MenuContentProps>();
    roving.configure({
      navigation: navigation ? 'none' : 'arrow',
      orientation: 'vertical',
      entry: 'first',
      loop: true,
    });
    def.expose.method('focusFirst', () => roving.focusFirst({ defer: true }));
    def.expose.method('focusLast', () => roving.focusLast({ defer: true }));
    const overlay = asOverlay<T.MenuContentProps>();
    overlay.configure({
      closeOnEscape: true,
      closeOnOutsidePress: false,
      closeOnFocusOutside: false,
      restore: 'none',
      entry: 'manual',
      anchored: true,
      placement: 'bottom',
      align: 'start',
      sideOffset: 4,
      collisionPadding: 8,
      strategy: 'fixed',
      avoidCollisions: true,
      collisionBoundary: 'clippingAncestors',
      portal: true,
      modal: false,
      layerRole: slug + '-content',
    });
    const transition = asTransition();
    transition.configure({ enterDuration: 0, leaveDuration: 0 });
    overlay.bindPresence({
      enter: transition.controls.enter,
      leave: transition.controls.leave,
      present: transition.isPresent,
    });
    const boundary = asBoundary();
    boundary.observe('pointer.press');
    let runNow: RunHandle<T.MenuContentProps> | null = null;
    const focusTrigger = (run: RunHandle<T.MenuContentProps>) => {
      const trigger = triggers(run).find((t) => t.data.value === run.props.get().value)?.part;
      const fn = trigger?.getExpose('focusSelf');
      if (typeof fn === 'function') fn({ reason: 'keyboard' });
    };
    const entries = (run: RunHandle<T.MenuContentProps>) =>
      run.anatomy.order.partsOf(family, 'item').flatMap((part) => {
        const raw = part.getExpose('__menuItem');
        const meta = typeof raw === 'function' ? raw() : raw;
        return meta && typeof meta === 'object' && (meta as any).menuValue === run.props.get().value
          ? [{ part, meta: meta as { disabled: boolean; text: string } }]
          : [];
      });
    const isFocused = (part: { getExpose(key: string): unknown }) =>
      !!(part.getExpose('focused') as { get?(): boolean } | undefined)?.get?.();
    useTypeaheadNavigation({
      isEnabled: (run) => !navigation && open.get() && entries(run).some((e) => isFocused(e.part)),
      getEntries: (run) => entries(run).filter((e) => !e.meta.disabled),
      getCurrentIndex: (_run, all) => all.findIndex((e) => isFocused(e.part)),
      getText: (e) => e.meta.text,
      onMatch: (_run, e) => {
        const fn = e.part.getExpose('focusSelf');
        if (typeof fn === 'function') fn({ reason: 'keyboard' });
      },
    });
    const sync = (run: RunHandle<T.MenuContentProps>, ctx: Context) => {
      const next = !!ctx.value && ctx.value === run.props.get().value;
      id.set(contentId(ctx.id, run.props.get().value), 'reason: menu content id');
      label.set(run.props.get().a11yLabel || run.props.get().value, 'reason: menu panel name');
      open.set(next, 'reason: menu panel open');
      run.context.update(contentContext, { value: run.props.get().value, open: next });
      if (next) overlay.openOverlay('owner');
      else overlay.close('owner');
    };
    const anchor = (run: RunHandle<T.MenuContentProps>) => {
      const t = triggers(run).find((t) => t.data.value === run.props.get().value)?.part;
      if (t) overlay.registerAnchorPart(t);
      overlay.updatePosition({ sideOffset: run.props.get().sideOffset });
    };
    def.context.subscribe(context, sync);
    def.lifecycle.onCreated((run) => sync(run, run.context.read(context)));
    def.lifecycle.onMounted((run) => {
      runNow = run;
      anchor(run);
      sync(run, run.context.read(context));
    });
    def.lifecycle.onUnmounted(() => {
      runNow = null;
    });
    def.props.watch(['value', 'sideOffset', 'a11yLabel'], (run) => {
      anchor(run);
      sync(run, run.context.read(context));
    });
    overlay.open.watch((_run, event) => {
      const run = runNow;
      if (event.type !== 'next' || event.next || event.reason !== 'escape' || !run || !open.get())
        return;
      invoke(run, 'close');
      if (run.context.read(context).value === run.props.get().value)
        overlay.openOverlay('controlled.sync');
      else focusTrigger(run);
    });
    boundary.subscribeOutside(() => {
      if (runNow && open.get()) invoke(runNow, 'close');
    });
    def.event.onGlobal('key.down', (run, event) => {
      if (!open.get() || !entries(run).some((e) => isFocused(e.part))) return;
      if (!navigation && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.control.requestDefaultActionPrevention({
          reason: slug + '.adjacent-menu',
          source: 'base-' + slug + '-content',
        });
        invoke(run, '__navigate', event.key === 'ArrowLeft' ? -1 : 1);
      } else if (event.key === 'Tab' && !navigation) invoke(run, 'close');
    });
    def.rule({
      when: (w) => w.state(transition.isPresent).eq(false),
      intent: (i) => i.feedback.style.use(tw('hidden')),
    });
  }
  function itemSetup(def: DefHandle<T.MenuItemProps, T.MenuItemExposes>, link = false) {
    def.anatomy.claim(family, { role: 'item' });
    asTrigger();
    def.props.define({
      value: { type: 'string', empty: 'fallback' },
      textValue: { type: 'string', empty: 'fallback' },
      disabled: { type: 'boolean', empty: 'fallback' },
      closeOnSelect: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ value: '', textValue: '', disabled: false, closeOnSelect: true });
    const focus = asFocusable<T.MenuItemProps>();
    focus.configure({ disabled: false });
    const disabled = def.state.bool('disabled', false);
    const a11y = asAccessible();
    a11y.role(link ? 'link' : navigation ? 'button' : 'menuitem');
    a11y.nameFromContent();
    a11y.state('disabled', disabled);
    def.expose.state('disabled', disabled);
    def.expose.state('focused', focus.focused);
    def.expose.state('focusVisible', focus.focusVisible);
    def.expose.method('focusSelf', (options) => {
      if (!disabled.get()) focus.focusSelf(options);
    });
    def.expose.event('select', { payload: 'json' });
    let currentRun: RunHandle<T.MenuItemProps> | null = null;
    def.expose.method('__menuItem' as any, () => ({
      menuValue: currentRun?.context.read(contentContext).value ?? '',
      disabled: disabled.get(),
      text: currentRun?.props.get().textValue || currentRun?.props.get().value || '',
    }));
    const sync = (run: RunHandle<T.MenuItemProps>) => {
      currentRun = run;
      disabled.set(
        !!run.props.get().disabled || run.context.read(context).disabled,
        'reason: menu item disabled'
      );
      focus.setDisabled(disabled.get());
      focus.setNavParticipation(run.context.read(contentContext).open ? 'auto' : 'none');
    };
    def.context.subscribe(context, (run) => sync(run));
    def.context.subscribe(contentContext, (run) => sync(run));
    def.lifecycle.onMounted(sync);
    def.lifecycle.onUnmounted(() => {
      currentRun = null;
    });
    def.props.watchAll(sync);
    def.event.onGlobal('key.down', (_run, event) => {
      if (!link && event.key === ' ' && focus.focused.get() && !disabled.get())
        event.control.requestDefaultActionPrevention({
          reason: slug + '.item-space',
          source: 'base-' + slug + '-item',
        });
    });
    def.event.on('press.commit', (run, event) => {
      if (disabled.get() || !run.context.read(contentContext).open || (link && event.key === ' '))
        return;
      run.expose.emit('select', {
        value: run.props.get().value ?? '',
        menuValue: run.context.read(contentContext).value,
      });
      if (link) {
        const p = run.props.get() as T.MenuLinkProps;
        run.expose.emit('navigate', {
          href: p.href,
          target: p.target ?? '_self',
          modified: !!(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey),
        });
      }
      if (run.props.get().closeOnSelect !== false) invoke(run, 'close');
    });
  }
  function linkSetup(def: DefHandle<T.MenuLinkProps, T.MenuLinkExposes>) {
    itemSetup(def as any, true);
    def.props.define({
      href: { type: 'string', empty: 'fallback' },
      current: { type: 'boolean', empty: 'fallback' },
      target: { type: 'enum', empty: 'fallback', options: ['_self', '_blank'] },
    });
    def.props.setDefaults({ href: '', current: false, target: '_self' });
    const current = def.state.string('current', '');
    asAccessible().state('current', current);
    const sync = (run: RunHandle<T.MenuLinkProps>) =>
      current.set(run.props.get().current ? 'page' : '', 'reason: navigation current page');
    def.lifecycle.onCreated(sync);
    def.props.watch(['current'], sync);
    def.expose.event('navigate', { payload: 'json' });
  }
  const rootHook = defineAsHook<T.MenuRootProps, T.MenuRootExposes, T.MenuRootAsHookContract>({
    name: `as-${slug}-root`,
    setup: rootSetup,
  });
  const triggerHook = defineAsHook<
    T.MenuTriggerProps,
    T.MenuTriggerExposes,
    T.MenuTriggerAsHookContract
  >({ name: `as-${slug}-trigger`, setup: triggerSetup });
  const contentHook = defineAsHook<
    T.MenuContentProps,
    T.MenuContentExposes,
    T.MenuContentAsHookContract
  >({ name: `as-${slug}-content`, setup: contentSetup });
  const itemHook = defineAsHook<T.MenuItemProps, T.MenuItemExposes, T.MenuItemAsHookContract>({
    name: `as-${slug}-item`,
    setup: (def) => itemSetup(def),
  });
  const linkHook = defineAsHook<T.MenuLinkProps, T.MenuLinkExposes, T.MenuLinkAsHookContract>({
    name: `as-${slug}-link`,
    setup: linkSetup,
  });
  return {
    family,
    context,
    rootHook,
    triggerHook,
    contentHook,
    itemHook,
    linkHook,
    root: definePrototype({ name: `base-${slug}-root`, setup: rootSetup }),
    trigger: definePrototype({ name: `base-${slug}-trigger`, setup: triggerSetup }),
    content: definePrototype({ name: `base-${slug}-content`, setup: contentSetup }),
    item: definePrototype({
      name: `base-${slug}-item`,
      setup: (def: DefHandle<T.MenuItemProps, T.MenuItemExposes>) => itemSetup(def),
    }),
    link: definePrototype({ name: `base-${slug}-link`, setup: linkSetup }),
  };
}
