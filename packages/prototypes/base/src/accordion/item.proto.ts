import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asCollectionItem } from '@proto.ui/hooks';
import {
  ACCORDION_CONTEXT,
  ACCORDION_FAMILY,
  ACCORDION_ITEM_CONTEXT,
  ACCORDION_ITEM_FAMILY,
  notifyAccordionItemsChanged,
  rejectAccordionDuplicatePart,
} from './shared';
import type {
  AccordionItemProps,
  AccordionItemExposes,
  AccordionItemAsHookContract,
} from './types';
function setupAccordionItem(def: DefHandle<AccordionItemProps, AccordionItemExposes>) {
  asCollectionItem().configure({
    family: ACCORDION_FAMILY,
    role: 'item',
    getMeta: (run) => ({ value: run.props.get().value, disabled: !!run.props.get().disabled }),
  });
  def.anatomy.claim(ACCORDION_ITEM_FAMILY, { role: 'root' });
  def.props.define({
    value: {
      type: 'string',
      empty: 'error',
      validator: (value) => typeof value === 'string' && value.length > 0,
    },
    disabled: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({ disabled: false });
  const value = def.state.string('value', '');
  const open = def.state.bool('open', false);
  const disabled = def.state.bool('disabled', false);
  def.expose.state('value', value);
  def.expose.state('open', open);
  def.expose.state('disabled', disabled);
  def.context.provide(ACCORDION_ITEM_CONTEXT, {
    value: '',
    open: false,
    disabled: false,
    collapseBlocked: false,
  });
  const sync = (run: RunHandle<AccordionItemProps>) => {
    const ownValue = run.props.get().value;
    if (!ownValue)
      throw Object.assign(new Error('Accordion Item requires a non-empty value.'), {
        code: 'ACCORDION_VALUE_REQUIRED',
      });
    value.set(ownValue, 'reason: accordion item identity');
    const group = run.context.read(ACCORDION_CONTEXT);
    const next = {
      value: ownValue,
      open: group.openItems.includes(ownValue),
      disabled: group.disabled || !!run.props.get().disabled,
      collapseBlocked:
        !group.allowEmpty && group.openItems.length === 1 && group.openItems.includes(ownValue),
    };
    const previous = run.context.read(ACCORDION_ITEM_CONTEXT);
    if (JSON.stringify(previous) !== JSON.stringify(next))
      run.context.update(ACCORDION_ITEM_CONTEXT, next);
    const canonical = run.context.read(ACCORDION_ITEM_CONTEXT);
    open.set(canonical.open, 'reason: accordion canonical item');
    disabled.set(
      run.context.read(ACCORDION_ITEM_CONTEXT).disabled,
      'reason: accordion item disabled'
    );
  };
  def.context.subscribe(ACCORDION_CONTEXT, sync);
  def.context.subscribe(ACCORDION_ITEM_CONTEXT, () => {});
  def.lifecycle.onCreated(sync);
  const refresh = (run: RunHandle<AccordionItemProps>) => {
    sync(run);
    notifyAccordionItemsChanged(run);
  };
  def.lifecycle.onMounted(refresh);
  def.lifecycle.onUpdated(refresh);
  def.props.watch(['value', 'disabled'], refresh);
  for (const role of ['heading', 'trigger', 'content'] as const)
    def.anatomy.subscribeParts(ACCORDION_ITEM_FAMILY, role, (run) => {
      rejectAccordionDuplicatePart(run, role);
    });
}
export const asAccordionItem = defineAsHook<
  AccordionItemProps,
  AccordionItemExposes,
  AccordionItemAsHookContract
>({ name: 'as-accordion-item', setup: setupAccordionItem });
export default definePrototype({ name: 'base-accordion-item', setup: setupAccordionItem });
