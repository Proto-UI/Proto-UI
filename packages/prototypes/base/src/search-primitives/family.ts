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
  asOverlay,
  asTextControl,
  asTrigger,
} from '@proto.ui/hooks';
import { declareTextControl } from '@proto.ui/module-text-control';
import { asTransition } from '../tools';
import type * as T from './types';

type SearchContext = {
  id: string;
  value: string;
  query: string;
  open: boolean;
  disabled: boolean;
  readOnly: boolean;
  active: string;
  visible: string[];
  label: string;
};
type Item = { id: string; value: string; text: string; keywords: string; disabled: boolean };
let sequence = 0;
const fold = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
/** Shared collection algorithm; every consumer owns a distinct anatomy, context and prototype identity. */
export function createSearchFamily(slug: string, mode: 'autocomplete' | 'combobox' | 'command') {
  const inline = mode === 'command';
  const family = createAnatomyFamily(`base-${slug}`, {
    roles: {
      root: { cardinality: { min: 1, max: 1 } },
      input: { cardinality: { min: 1, max: 1 } },
      trigger: { cardinality: { min: 0, max: 1 } },
      content: { cardinality: { min: 1, max: 1 } },
      item: { cardinality: { min: 0, max: '*' } },
      empty: { cardinality: { min: 0, max: 1 } },
    },
    relations: [
      { kind: 'contains', parent: 'root', child: 'input' },
      { kind: 'contains', parent: 'root', child: 'trigger' },
      { kind: 'contains', parent: 'root', child: 'content' },
      { kind: 'contains', parent: 'content', child: 'item' },
      { kind: 'contains', parent: 'content', child: 'empty' },
    ],
  });
  const context = createContextKey<SearchContext>(`base-${slug}`);
  const invoke = (run: RunHandle<any>, method: string, ...args: unknown[]): any => {
    try {
      const fn = run.anatomy.partsOf(family, 'root')[0]?.getExpose(method);
      return typeof fn === 'function' ? fn(...args) : undefined;
    } catch (error) {
      if (
        ['CONTEXT_DISCONNECTED', 'ANATOMY_CLAIM_INVALID'].includes(
          (error as { code?: string }).code ?? ''
        )
      )
        return undefined;
      throw error;
    }
  };
  const itemsOf = (run: RunHandle<any>): Item[] =>
    run.anatomy.order.partsOf(family, 'item').flatMap((p) => {
      const raw = p.getExpose('__collectionItem');
      const item = typeof raw === 'function' ? raw() : raw;
      return item &&
        typeof item === 'object' &&
        typeof (item as Item).id === 'string' &&
        typeof (item as Item).value === 'string' &&
        typeof (item as Item).text === 'string'
        ? [item as Item]
        : [];
    });
  const inputFocus = (run: RunHandle<any>) => {
    const fn = run.anatomy.partsOf(family, 'input')[0]?.getExpose('focusSelf');
    if (typeof fn === 'function') fn({ reason: 'programmatic' });
  };
  function rootSetup(def: DefHandle<T.SearchRootProps, T.SearchRootExposes>) {
    def.anatomy.claim(family, { role: 'root' });
    asCollection().configure({ family, itemRole: 'item' });
    def.props.define({
      value: { type: 'string', empty: 'fallback' },
      defaultValue: { type: 'string', empty: 'fallback' },
      inputValue: { type: 'string', empty: 'fallback' },
      defaultInputValue: { type: 'string', empty: 'fallback' },
      open: { type: 'boolean', empty: 'fallback' },
      defaultOpen: { type: 'boolean', empty: 'fallback' },
      disabled: { type: 'boolean', empty: 'fallback' },
      readOnly: { type: 'boolean', empty: 'fallback' },
      filter: { type: 'boolean', empty: 'fallback' },
      loop: { type: 'boolean', empty: 'fallback' },
      a11yLabel: { type: 'string', empty: 'fallback' },
    });
    def.props.setDefaults({
      defaultValue: '',
      defaultInputValue: '',
      defaultOpen: inline,
      disabled: false,
      readOnly: false,
      filter: true,
      loop: true,
      a11yLabel: '',
    });
    const value = def.state.string('value', ''),
      query = def.state.string('inputValue', ''),
      open = def.state.bool('open', inline),
      count = def.state.numberDiscrete('visibleCount', 0);
    def.expose.state('value', value);
    def.expose.state('inputValue', query);
    def.expose.state('open', open);
    def.expose.state('visibleCount', count);
    for (const event of ['valueChange', 'inputValueChange', 'openChange', 'execute'] as const)
      def.expose.event(event, { payload: 'json' });
    const id = `pui-${slug}-${++sequence}`;
    let active = '';
    let queryEdited = false;
    let currentRun: RunHandle<T.SearchRootProps> | null = null;
    let published: SearchContext = {
      id,
      value: '',
      query: '',
      open: inline,
      disabled: false,
      readOnly: false,
      active: '',
      visible: [],
      label: '',
    };
    def.context.provide(context, published);
    const visibleItems = (run: RunHandle<T.SearchRootProps>) => {
      const q = fold(query.get().trim());
      return itemsOf(run).filter(
        (i) => !run.props.get().filter || !q || fold(i.text + ' ' + i.keywords).includes(q)
      );
    };
    const publish = (run: RunHandle<T.SearchRootProps>) => {
      if (
        !queryEdited &&
        !run.props.isProvided('inputValue') &&
        !run.props.isProvided('defaultInputValue') &&
        value.get()
      ) {
        const initial = itemsOf(run).find((i) => i.value === value.get());
        if (initial) query.set(initial.text, 'reason: search initial label');
      }
      const items = visibleItems(run);
      if (!items.some((i) => i.id === active && !i.disabled))
        active = inline ? (items.find((i) => !i.disabled)?.id ?? '') : '';
      count.set(items.length, 'reason: search filtered count');
      const next = {
        id,
        value: value.get(),
        query: query.get(),
        open: open.get(),
        disabled: !!run.props.get().disabled,
        readOnly: !!run.props.get().readOnly,
        active,
        visible: items.map((i) => i.id),
        label: run.props.get().a11yLabel ?? '',
      };
      if (JSON.stringify(next) === JSON.stringify(published)) return;
      published = next;
      run.context.update(context, next);
    };
    const requestOpen = (next: boolean, reason: string) => {
      const run = currentRun;
      if (
        !run ||
        inline ||
        run.props.get().disabled ||
        run.props.get().readOnly ||
        next === open.get()
      )
        return;
      if (!run.props.isProvided('open')) open.set(next, 'reason: search open request');
      if (!next) active = '';
      publish(run);
      run.expose.emit('openChange', { open: next, reason });
    };
    const requestQuery = (next: string, composing = false) => {
      const run = currentRun;
      if (!run || run.props.get().disabled || run.props.get().readOnly) return;
      queryEdited = true;
      if (!composing && !run.props.isProvided('inputValue'))
        query.set(next, 'reason: search query request');
      if (!composing) {
        active = '';
        publish(run);
        requestOpen(true, 'input');
      }
      run.expose.emit('inputValueChange', { value: next, composing });
    };
    const select = (selectedValue: string, reason = 'programmatic') => {
      const run = currentRun;
      if (!run || run.props.get().disabled || run.props.get().readOnly) return false;
      const matching = visibleItems(run).filter((i) => i.value === selectedValue);
      const candidate = matching.length === 1 && !matching[0].disabled ? matching[0] : null;
      const free = mode === 'autocomplete' && reason === 'free-text' && !!selectedValue;
      if (!candidate && !free) return false;
      const text = candidate?.text ?? selectedValue;
      const result = mode === 'autocomplete' ? text : selectedValue;
      if (mode !== 'command' && !run.props.isProvided('value'))
        value.set(result, 'reason: search accepted selection');
      if (mode !== 'command' && !run.props.isProvided('inputValue'))
        query.set(text, 'reason: search selected label');
      publish(run);
      const detail = { value: result, textValue: text, reason };
      run.expose.emit(mode === 'command' ? 'execute' : 'valueChange', detail);
      if (!inline) {
        requestOpen(false, 'select');
        inputFocus(run);
      }
      return true;
    };
    def.expose.method('select', select);
    def.expose.method('setInputValue', requestQuery);
    def.expose.method('openPopup', () => requestOpen(true, 'programmatic'));
    def.expose.method('close', () => requestOpen(false, 'dismiss'));
    def.expose.method('__refresh', () => {
      if (currentRun) publish(currentRun);
    });
    def.expose.method('__activate', (id) => {
      const run = currentRun;
      if (run && visibleItems(run).some((i) => i.id === id && !i.disabled)) {
        active = id;
        publish(run);
      }
    });
    def.expose.method('__navigate', (direction) => {
      const run = currentRun;
      if (!run || run.props.get().disabled || run.props.get().readOnly) return;
      const choices = visibleItems(run).filter((i) => !i.disabled);
      if (direction === 'commit') {
        const item = choices.find((i) => i.id === active);
        if (item) select(item.value, 'keyboard');
        else if (mode === 'autocomplete') select(query.get(), 'free-text');
        return;
      }
      if (direction === 'escape') {
        requestOpen(false, 'escape');
        return;
      }
      requestOpen(true, 'keyboard');
      if (!choices.length) return;
      const index = choices.findIndex((i) => i.id === active);
      const raw =
        direction === 'first'
          ? 0
          : direction === 'last'
            ? choices.length - 1
            : index < 0
              ? direction === 'prev'
                ? choices.length - 1
                : 0
              : index + (direction === 'prev' ? -1 : 1);
      const next =
        run.props.get().loop === false
          ? Math.max(0, Math.min(choices.length - 1, raw))
          : (raw + choices.length) % choices.length;
      active = choices[next].id;
      publish(run);
    });
    const sync = (run: RunHandle<T.SearchRootProps>, initial = false) => {
      currentRun = run;
      const p = run.props.get();
      if (initial || run.props.isProvided('value'))
        value.set(
          run.props.isProvided('value') ? (p.value ?? '') : (p.defaultValue ?? ''),
          'reason: search owner value'
        );
      if (initial || run.props.isProvided('inputValue'))
        query.set(
          run.props.isProvided('inputValue')
            ? (p.inputValue ?? '')
            : run.props.isProvided('defaultInputValue')
              ? (p.defaultInputValue ?? '')
              : mode === 'autocomplete'
                ? value.get()
                : '',
          'reason: search owner query'
        );
      if (initial || run.props.isProvided('open'))
        open.set(
          inline || (run.props.isProvided('open') ? !!p.open : !!p.defaultOpen),
          'reason: search owner open'
        );
      publish(run);
    };
    def.lifecycle.onCreated((run) => sync(run, true));
    def.lifecycle.onMounted((run) => sync(run));
    def.lifecycle.onUnmounted(() => {
      currentRun = null;
    });
    def.props.watchAll((run) => sync(run));
    def.anatomy.subscribeParts(family, 'item', (run) => publish(run));
  }
  function inputSetup(def: DefHandle<T.SearchInputProps, T.SearchInputExposes>) {
    def.anatomy.claim(family, { role: 'input' });
    def.props.define({
      placeholder: { type: 'string', empty: 'fallback' },
      a11yLabel: { type: 'string', empty: 'fallback' },
      name: { type: 'string', empty: 'fallback' },
    });
    def.props.setDefaults({ placeholder: '', a11yLabel: '', name: '' });
    const control = asTextControl<T.SearchInputProps, 'single'>(),
      focus = asFocusable<T.SearchInputProps>();
    focus.configure({ disabled: false });
    const disabled = def.state.bool('disabled', false),
      readOnly = def.state.bool('readOnly', false),
      composing = def.state.bool('composing', false),
      expanded = def.state.bool('expanded', inline),
      label = def.state.string('label', ''),
      controls = def.state.string('controls', ''),
      active = def.state.string('activeDescendant', ''),
      autocomplete = def.state.string('autocomplete', 'list');
    const a11y = asAccessible();
    a11y.role('combobox');
    a11y.name(label);
    a11y.state('disabled', disabled);
    a11y.state('readOnly', readOnly);
    a11y.state('expanded', expanded);
    a11y.state('autocomplete', autocomplete);
    a11y.relation('controls', { target: controls });
    a11y.relation('activeDescendant', { target: active });
    def.expose.state('disabled', disabled);
    def.expose.state('focused', focus.focused);
    def.expose.state('focusVisible', focus.focusVisible);
    def.expose.state('composing', composing);
    def.expose.method('focusSelf', (options) => {
      if (!disabled.get()) focus.focusSelf(options);
    });
    const sync = (run: RunHandle<T.SearchInputProps>, ctx: SearchContext) => {
      disabled.set(ctx.disabled, 'reason: search input disabled');
      readOnly.set(ctx.readOnly, 'reason: search input readonly');
      expanded.set(ctx.open, 'reason: search expanded');
      controls.set(ctx.id + '-content', 'reason: search controls');
      active.set(ctx.open ? ctx.active : '', 'reason: search active descendant');
      label.set(run.props.get().a11yLabel || ctx.label, 'reason: search input name');
      focus.setDisabled(ctx.disabled);
      control.sync({
        valueMode: 'controlled',
        value: ctx.query,
        disabled: ctx.disabled,
        readOnly: ctx.readOnly,
        placeholder: run.props.get().placeholder ?? '',
        name: run.props.get().name ?? '',
        autoComplete: 'off',
        inputMode: 'search',
      });
    };
    def.context.subscribe(context, sync);
    def.lifecycle.onCreated((run) => sync(run, run.context.read(context)));
    def.props.watchAll((run) => sync(run, run.context.read(context)));
    control.on('input', (run, event) => {
      composing.set(event.composing, 'reason: search input composition');
      invoke(run, 'setInputValue', event.value, event.composing);
    });
    control.on('compositionstart', () => composing.set(true, 'reason: search IME start'));
    control.on('compositionend', (run, event) => {
      composing.set(false, 'reason: search IME end');
      invoke(run, 'setInputValue', event.value, false);
    });
    def.event.onGlobal('key.down', (run, event) => {
      if (!focus.focused.get() || disabled.get() || readOnly.get() || composing.get()) return;
      const key = event.key;
      if (key === 'Tab') {
        if (!inline) invoke(run, 'close');
        return;
      }
      const direction =
        key === 'ArrowDown'
          ? 'next'
          : key === 'ArrowUp'
            ? 'prev'
            : key === 'Home' && expanded.get()
              ? 'first'
              : key === 'End' && expanded.get()
                ? 'last'
                : key === 'Enter'
                  ? 'commit'
                  : key === 'Escape' && expanded.get()
                    ? 'escape'
                    : '';
      if (!direction) return;
      event.control.requestDefaultActionPrevention({
        reason: slug + '.keyboard',
        source: 'base-' + slug + '-input',
      });
      invoke(run, '__navigate', direction);
    });
    return () => null;
  }
  function contentSetup(def: DefHandle<T.SearchContentProps, T.SearchContentExposes>) {
    def.anatomy.claim(family, { role: 'content' });
    const a11y = asAccessible();
    const id = def.state.string('id', ''),
      open = def.state.bool('open', inline),
      label = def.state.string('label', '');
    a11y.id(id);
    a11y.role('listbox');
    a11y.name(label);
    def.expose.state('open', open);
    def.props.define({
      side: { type: 'enum', empty: 'fallback', options: ['top', 'right', 'bottom', 'left'] },
      align: { type: 'enum', empty: 'fallback', options: ['start', 'center', 'end'] },
      sideOffset: { type: 'number', empty: 'fallback' },
      collisionPadding: { type: 'number', empty: 'fallback' },
    });
    def.props.setDefaults({ side: 'bottom', align: 'start', sideOffset: 4, collisionPadding: 8 });
    const transition = asTransition();
    transition.configure({ enterDuration: 0, leaveDuration: 0 });
    const overlay = inline ? null : asOverlay<T.SearchContentProps>();
    overlay?.configure({
      closeOnEscape: false,
      closeOnOutsidePress: false,
      closeOnFocusOutside: false,
      restore: 'none',
      entry: 'manual',
      anchored: true,
      strategy: 'fixed',
      placement: 'bottom',
      align: 'start',
      sideOffset: 4,
      collisionPadding: 8,
      avoidCollisions: true,
      collisionBoundary: 'clippingAncestors',
      portal: true,
      modal: false,
      layerRole: slug + '-content',
    });
    overlay?.bindPresence({
      enter: transition.controls.enter,
      leave: transition.controls.leave,
      present: transition.isPresent,
    });
    const boundary = asBoundary();
    if (!inline) boundary.observe('pointer.press');
    let runNow: RunHandle<T.SearchContentProps> | null = null;
    const sync = (run: RunHandle<T.SearchContentProps>, ctx: SearchContext) => {
      id.set(ctx.id + '-content', 'reason: search list id');
      label.set(ctx.label, 'reason: search list name');
      open.set(ctx.open, 'reason: search list open');
      if (inline) transition.controls.enter();
      else if (ctx.open) overlay?.openOverlay('owner');
      else overlay?.close('owner');
    };
    const position = (run: RunHandle<T.SearchContentProps>) => {
      const p = run.props.get();
      overlay?.updatePosition({
        placement: p.side,
        align: p.align,
        sideOffset: p.sideOffset,
        collisionPadding: p.collisionPadding,
      });
    };
    def.context.subscribe(context, sync);
    def.lifecycle.onCreated((run) => {
      position(run);
      sync(run, run.context.read(context));
    });
    def.lifecycle.onMounted((run) => {
      runNow = run;
      const input = run.anatomy.partsOf(family, 'input')[0];
      if (input) overlay?.registerAnchorPart(input);
      position(run);
      sync(run, run.context.read(context));
    });
    def.lifecycle.onUnmounted(() => {
      runNow = null;
    });
    def.props.watch(['side', 'align', 'sideOffset', 'collisionPadding'], position);
    boundary.subscribeOutside(() => {
      if (runNow && open.get()) invoke(runNow, 'close');
    });
    def.rule({
      when: (w) => w.state(transition.isPresent).eq(false),
      intent: (i) => i.feedback.style.use(tw('hidden')),
    });
  }
  function itemSetup(def: DefHandle<T.SearchItemProps, T.SearchItemExposes>) {
    const id = `pui-${slug}-option-${++sequence}`;
    asCollectionItem().configure({
      family,
      role: 'item',
      getMeta: (run) => ({
        id,
        value: run.props.get().value,
        text: run.props.get().textValue || run.props.get().value,
        keywords: run.props.get().keywords ?? '',
        disabled: !!run.props.get().disabled,
      }),
    });
    def.props.define({
      value: { type: 'string', empty: 'fallback' },
      textValue: { type: 'string', empty: 'fallback' },
      keywords: { type: 'string', empty: 'fallback' },
      disabled: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ value: '', textValue: '', keywords: '', disabled: false });
    asTrigger();
    const active = def.state.bool('active', false),
      selected = def.state.bool('selected', false),
      visible = def.state.bool('visible', true),
      hidden = def.state.bool('hidden', false),
      disabled = def.state.bool('disabled', false);
    const a11y = asAccessible();
    a11y.id(id);
    a11y.role('option');
    a11y.nameFromContent();
    a11y.state('selected', selected);
    a11y.state('disabled', disabled);
    a11y.tree({ hidden });
    for (const [key, state] of Object.entries({ active, selected, visible, disabled }))
      def.expose.state(key as 'active', state);
    def.expose.event('select', { payload: 'json' });
    const sync = (run: RunHandle<T.SearchItemProps>, ctx: SearchContext) => {
      const p = run.props.get();
      const shown = ctx.visible.includes(id);
      visible.set(shown, 'reason: search option visibility');
      hidden.set(!shown, 'reason: search option a11y visibility');
      disabled.set(ctx.disabled || !!p.disabled, 'reason: search option disabled');
      active.set(ctx.open && ctx.active === id && !disabled.get(), 'reason: search active option');
      selected.set(
        mode === 'command'
          ? active.get()
          : ctx.value === (mode === 'autocomplete' ? p.textValue || p.value : p.value),
        'reason: search selection'
      );
    };
    def.context.subscribe(context, sync);
    def.lifecycle.onMounted((run) => {
      sync(run, run.context.read(context));
      invoke(run, '__refresh');
    });
    def.props.watchAll((run) => {
      invoke(run, '__refresh');
      sync(run, run.context.read(context));
    });
    def.event.on('pointer.down', (_run, event) => {
      if (visible.get() && !disabled.get())
        event.control.requestDefaultActionPrevention({
          reason: slug + '.retain-input-focus',
          source: 'base-' + slug + '-item',
        });
    });
    def.event.on('pointer.enter', (run) => {
      if (visible.get() && !disabled.get()) invoke(run, '__activate', id);
    });
    def.event.on('press.commit', (run) => {
      if (
        visible.get() &&
        !disabled.get() &&
        invoke(run, 'select', run.props.get().value, 'pointer')
      )
        run.expose.emit('select', { value: run.props.get().value });
    });
    def.rule({
      when: (w) => w.state(visible).eq(false),
      intent: (i) => i.feedback.style.use(tw('hidden')),
    });
  }
  function emptySetup(def: DefHandle<T.SearchEmptyProps, T.SearchEmptyExposes>) {
    def.anatomy.claim(family, { role: 'empty' });
    const visible = def.state.bool('visible', true);
    def.expose.state('visible', visible);
    const sync = (_run: RunHandle<T.SearchEmptyProps>, ctx: SearchContext) =>
      visible.set(ctx.visible.length === 0, 'reason: search empty results');
    def.context.subscribe(context, sync);
    def.lifecycle.onCreated((run) => sync(run, run.context.read(context)));
    def.rule({
      when: (w) => w.state(visible).eq(false),
      intent: (i) => i.feedback.style.use(tw('hidden')),
    });
  }
  function triggerSetup(def: DefHandle<T.SearchTriggerProps, T.SearchTriggerExposes>) {
    def.anatomy.claim(family, { role: 'trigger' });
    def.props.define({ disabled: { type: 'boolean', empty: 'fallback' } });
    def.props.setDefaults({ disabled: false });
    asTrigger();
    const focus = asFocusable<T.SearchTriggerProps>();
    focus.configure({ disabled: false });
    const disabled = def.state.bool('disabled', false),
      expanded = def.state.bool('expanded', false);
    const a11y = asAccessible();
    a11y.role('button');
    a11y.nameFromContent();
    a11y.state('disabled', disabled);
    a11y.state('expanded', expanded);
    def.expose.state('disabled', disabled);
    def.expose.state('focused', focus.focused);
    def.expose.state('focusVisible', focus.focusVisible);
    const sync = (run: RunHandle<T.SearchTriggerProps>, ctx: SearchContext) => {
      disabled.set(
        ctx.disabled || ctx.readOnly || !!run.props.get().disabled,
        'reason: search trigger disabled'
      );
      expanded.set(ctx.open, 'reason: search trigger expanded');
      focus.setDisabled(disabled.get());
    };
    def.context.subscribe(context, sync);
    def.lifecycle.onCreated((run) => sync(run, run.context.read(context)));
    def.props.watchAll((run) => sync(run, run.context.read(context)));
    def.event.onGlobal('key.down', (_run, event) => {
      if (event.key === ' ' && focus.focused.get() && !disabled.get())
        event.control.requestDefaultActionPrevention({
          reason: slug + '.trigger-space',
          source: 'base-' + slug + '-trigger',
        });
    });
    def.event.on('press.commit', (run) => {
      if (disabled.get()) return;
      invoke(run, expanded.get() ? 'close' : 'openPopup');
      inputFocus(run);
    });
  }
  const rootHook = defineAsHook<T.SearchRootProps, T.SearchRootExposes, T.SearchRootAsHookContract>(
    { name: `as-${slug}-root`, setup: rootSetup }
  );
  const inputHook = defineAsHook<
    T.SearchInputProps,
    T.SearchInputExposes,
    T.SearchInputAsHookContract
  >({
    name: `as-${slug}-input`,
    modules: [declareTextControl({ content: 'plain-text', lineMode: 'single', engine: 'host' })],
    setup: inputSetup,
  });
  const contentHook = defineAsHook<
    T.SearchContentProps,
    T.SearchContentExposes,
    T.SearchContentAsHookContract
  >({ name: `as-${slug}-content`, setup: contentSetup });
  const itemHook = defineAsHook<T.SearchItemProps, T.SearchItemExposes, T.SearchItemAsHookContract>(
    { name: `as-${slug}-item`, setup: itemSetup }
  );
  const emptyHook = defineAsHook<
    T.SearchEmptyProps,
    T.SearchEmptyExposes,
    T.SearchEmptyAsHookContract
  >({ name: `as-${slug}-empty`, setup: emptySetup });
  const triggerHook = defineAsHook<
    T.SearchTriggerProps,
    T.SearchTriggerExposes,
    T.SearchTriggerAsHookContract
  >({ name: `as-${slug}-trigger`, setup: triggerSetup });
  return {
    family,
    context,
    rootHook,
    inputHook,
    contentHook,
    itemHook,
    emptyHook,
    triggerHook,
    root: definePrototype({ name: `base-${slug}-root`, setup: rootSetup }),
    input: definePrototype({
      name: `base-${slug}-input`,
      modules: inputHook.modules,
      setup: inputSetup,
    }),
    content: definePrototype({ name: `base-${slug}-content`, setup: contentSetup }),
    item: definePrototype({ name: `base-${slug}-item`, setup: itemSetup }),
    empty: definePrototype({ name: `base-${slug}-empty`, setup: emptySetup }),
    trigger: definePrototype({ name: `base-${slug}-trigger`, setup: triggerSetup }),
  };
}
