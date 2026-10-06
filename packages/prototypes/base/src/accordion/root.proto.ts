import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asCollection } from '@proto.ui/hooks';
import {
  ACCORDION_CONTEXT,
  ACCORDION_FAMILY,
  accordionItems,
  type AccordionContext,
} from './shared';
import type {
  AccordionRootProps,
  AccordionRootExposes,
  AccordionRootAsHookContract,
  AccordionReason,
} from './types';

function normalize(values: readonly string[] | undefined, single: boolean): string[] {
  const result = [...new Set(values ?? [])];
  return single ? result.slice(0, 1) : result;
}
function setupAccordionRoot(def: DefHandle<AccordionRootProps, AccordionRootExposes>) {
  // P-BASE-ACCORDION-OWNER: protocol-neutral collection, never another Base protocol hook.
  def.anatomy.claim(ACCORDION_FAMILY, { role: 'root' });
  asCollection().configure({ family: ACCORDION_FAMILY, itemRole: 'item' });
  const stringArray = (value: unknown) =>
    Array.isArray(value) && value.every((v) => typeof v === 'string' && v.length > 0);
  def.props.define({
    mode: { type: 'enum', options: ['single', 'multiple'], empty: 'fallback' },
    openItems: { type: 'object', validator: stringArray, empty: 'fallback' },
    defaultOpenItems: { type: 'object', validator: stringArray, empty: 'fallback' },
    allowEmpty: { type: 'boolean', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
    orientation: { type: 'enum', options: ['vertical', 'horizontal'], empty: 'fallback' },
    direction: { type: 'enum', options: ['ltr', 'rtl'], empty: 'fallback' },
    loop: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({
    mode: 'single',
    defaultOpenItems: [],
    allowEmpty: true,
    disabled: false,
    orientation: 'vertical',
    direction: 'ltr',
    loop: true,
  });
  const openCount = def.state.numberDiscrete('openCount', 0);
  def.expose.state('openCount', openCount);
  def.expose.event('openChange', { payload: 'json' });
  let values: string[] = [];
  let currentRun: RunHandle<AccordionRootProps> | undefined;
  let initialized = false;
  const knownValues = new Set<string>();
  const initial: AccordionContext = {
    openItems: [],
    disabled: false,
    allowEmpty: true,
    orientation: 'vertical',
    direction: 'ltr',
    loop: true,
    validationVersion: 0,
  };
  def.context.provide(ACCORDION_CONTEXT, initial);
  let validationVersion = 0;
  def.context.subscribe(ACCORDION_CONTEXT, (run, next) => {
    if (validationVersion !== next.validationVersion) {
      validationVersion = next.validationVersion;
      sync(run, true);
    }
  });

  const sync = (run: RunHandle<AccordionRootProps>, structural = false) => {
    if (!initialized) return;
    const props = run.props.get();
    const controlled = run.props.isProvided('openItems');
    values = normalize(controlled ? props.openItems : values, props.mode !== 'multiple');
    const items = accordionItems(run);
    if (!controlled && structural) {
      values = values.filter(
        (value) => !knownValues.has(value) || items.some((item) => item.value === value)
      );
      if (!props.disabled && !props.allowEmpty && values.length === 0) {
        const fallback = items.find((item) => !item.disabled)?.value;
        if (fallback) values = [fallback];
      }
    }
    // Track only selected identities that have actually registered, never unbounded item history.
    for (const known of knownValues) if (!values.includes(known)) knownValues.delete(known);
    for (const item of items) if (values.includes(item.value)) knownValues.add(item.value);
    const next: AccordionContext = {
      openItems: [...values],
      disabled: !!props.disabled,
      allowEmpty: props.allowEmpty !== false,
      orientation: props.orientation ?? 'vertical',
      direction: props.direction ?? 'ltr',
      loop: props.loop !== false,
      validationVersion: run.context.read(ACCORDION_CONTEXT).validationVersion,
    };
    const previous = run.context.read(ACCORDION_CONTEXT);
    if (JSON.stringify(previous) !== JSON.stringify(next))
      run.context.update(ACCORDION_CONTEXT, next);
    // Reentrant owner acceptance wins over the older publication.
    openCount.set(
      run.context.read(ACCORDION_CONTEXT).openItems.length,
      'reason: accordion canonical count'
    );
  };
  const request = (value: string, open: boolean, reason: AccordionReason = 'programmatic') => {
    if (!currentRun) return false;
    const run = currentRun;
    const props = run.props.get();
    const items = accordionItems(run);
    const target = items.find((item) => item.value === value);
    const current = run.context.read(ACCORDION_CONTEXT).openItems;
    if (props.disabled || !target || target.disabled || current.includes(value) === open)
      return false;
    const next = open
      ? props.mode === 'multiple'
        ? [...current, value]
        : [value]
      : current.filter((item) => item !== value);
    if (!props.allowEmpty && next.length === 0) return false;
    if (!run.props.isProvided('openItems')) values = next;
    sync(run);
    run.expose.emit('openChange', {
      openItems: [...next],
      value,
      open,
      reason: reason === 'pointer' || reason === 'keyboard' ? reason : 'programmatic',
    });
    return true;
  };
  def.expose.method('getOpenItems', () => [
    ...(currentRun?.context.read(ACCORDION_CONTEXT).openItems ?? values),
  ]);
  def.expose.method('requestOpen', request);
  def.lifecycle.onCreated((run) => {
    currentRun = run;
    values = normalize(
      run.props.isProvided('openItems')
        ? run.props.get().openItems
        : run.props.get().defaultOpenItems,
      run.props.get().mode !== 'multiple'
    );
    initialized = true;
    sync(run);
  });
  def.lifecycle.onMounted((run) => {
    currentRun = run;
    sync(run, true);
  });
  def.lifecycle.onUpdated((run) => {
    currentRun = run;
    sync(run, true);
  });
  def.lifecycle.onBeforeDispose(() => {
    currentRun = undefined;
  });
  def.anatomy.subscribeParts(ACCORDION_FAMILY, 'item', (run) => sync(run, true));
  def.props.watch(
    ['openItems', 'mode', 'allowEmpty', 'disabled', 'orientation', 'direction', 'loop'],
    (run) => sync(run, true)
  );
}
export const asAccordionRoot = defineAsHook<
  AccordionRootProps,
  AccordionRootExposes,
  AccordionRootAsHookContract
>({ name: 'as-accordion-root', setup: setupAccordionRoot });
export default definePrototype({ name: 'base-accordion-root', setup: setupAccordionRoot });
