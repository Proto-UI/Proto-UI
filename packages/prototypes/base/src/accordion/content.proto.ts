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
  AccordionContentHandles,
} from './types';
import type { TransitionHandles } from '../transition/types';
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
  let presence: TransitionHandles | null = null;
  let syncRevision = 0;
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
    const revision = ++syncRevision;
    rejectAccordionDuplicatePart(run, 'content');
    open.set(run.context.read(ACCORDION_ITEM_CONTEXT).open, 'reason: accordion content open');
    if (revision !== syncRevision) return;
    const current = run.context.read(ACCORDION_ITEM_CONTEXT).open;
    hidden.set(presence ? !presence.isPresent.get() : !current, 'reason: accordion content hidden');
    if (revision !== syncRevision) return;
    role.set(run.props.get().region ? 'region' : '', 'reason: accordion optional region');
    if (presence) presence.retainClosedView(!!run.props.get().keepMounted);
    else
      run.lifecycle.setPresent(
        !!run.props.get().keepMounted || run.context.read(ACCORDION_ITEM_CONTEXT).open
      );
  };
  def.expose.method('bindPresence', (transition: TransitionHandles) => {
    hidden.setDefault(hidden.get());
    if (presence) {
      if (presence === transition) return;
      throw new Error('[asAccordionContent] presence is already bound.');
    }
    transition.bindOpenContext({ context: ACCORDION_ITEM_CONTEXT, field: 'open' });
    presence = transition;
    transition.isPresent.watch((_run, event) => {
      if (event.type !== 'next') return;
      hidden.set(!transition.isPresent.get(), 'reason: accordion perceptual content');
    });
  });
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
  AccordionContentAsHookContract,
  AccordionContentHandles
>({
  name: 'as-accordion-content',
  setup: setupAccordionContent,
  projectHandle(result) {
    const bindPresence = result.getMethod?.('bindPresence') as
      | AccordionContentHandles['bindPresence']
      | undefined;
    if (!bindPresence) throw new Error('[asAccordionContent] missing presence binding.');
    return { ...result, bindPresence };
  },
});
export default definePrototype({ name: 'base-accordion-content', setup: setupAccordionContent });
