import { defineAsHook, definePrototype, tw, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import {
  ACCORDION_ITEM_CONTEXT,
  ACCORDION_ITEM_FAMILY,
  rejectAccordionDuplicatePart,
} from './shared';
import type {
  AccordionContentProps,
  AccordionContentExposes,
  AccordionContentAsHookContract,
} from './types';
function setupAccordionContent(def: DefHandle<AccordionContentProps, AccordionContentExposes>) {
  def.anatomy.claim(ACCORDION_ITEM_FAMILY, { role: 'content' });
  def.props.define({
    keepMounted: { type: 'boolean', empty: 'fallback' },
    region: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({ keepMounted: false, region: false });
  const open = def.state.bool('open', false),
    hidden = def.state.bool('hidden', true),
    role = def.state.string('role', '');
  def.expose.state('open', open);
  def.expose.state('hidden', hidden);
  const accessible = asAccessible();
  accessible.part(ACCORDION_ITEM_FAMILY, { key: 'panel' });
  accessible.role(role);
  accessible.state('hidden', hidden);
  accessible.relation('labelledBy', {
    target: { kind: 'part', family: ACCORDION_ITEM_FAMILY, role: 'trigger', key: 'panel' },
  });
  const sync = (run: RunHandle<AccordionContentProps>) => {
    rejectAccordionDuplicatePart(run, 'content');
    open.set(run.context.read(ACCORDION_ITEM_CONTEXT).open, 'reason: accordion content open');
    const current = run.context.read(ACCORDION_ITEM_CONTEXT).open;
    hidden.set(!current, 'reason: accordion content hidden');
    role.set(run.props.get().region ? 'region' : '', 'reason: accordion optional region');
    run.lifecycle.setPresent(
      !!run.props.get().keepMounted || run.context.read(ACCORDION_ITEM_CONTEXT).open
    );
  };
  def.context.subscribe(ACCORDION_ITEM_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted(sync);
  def.lifecycle.onUpdated(sync);
  def.props.watch(['keepMounted', 'region'], sync);
  def.rule({
    when: (w) => w.state(hidden).eq(true),
    intent: (i) => i.feedback.style.use(tw('hidden')),
  });
}
export const asAccordionContent = defineAsHook<
  AccordionContentProps,
  AccordionContentExposes,
  AccordionContentAsHookContract
>({ name: 'as-accordion-content', setup: setupAccordionContent });
export default definePrototype({ name: 'base-accordion-content', setup: setupAccordionContent });
