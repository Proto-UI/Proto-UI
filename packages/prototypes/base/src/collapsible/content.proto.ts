import { defineAsHook, definePrototype, tw, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { COLLAPSIBLE_CONTEXT, COLLAPSIBLE_FAMILY, rejectDuplicateCollapsiblePart } from './shared';
import type {
  CollapsibleContentAsHookContract,
  CollapsibleContentExposes,
  CollapsibleContentProps,
} from './types';

function setupCollapsibleContent(
  def: DefHandle<CollapsibleContentProps, CollapsibleContentExposes>
): void {
  def.anatomy.claim(COLLAPSIBLE_FAMILY, { role: 'content' });
  def.props.define({ keepMounted: { type: 'boolean', empty: 'fallback' } });
  def.props.setDefaults({ keepMounted: false });
  const open = def.state.bool('open', false);
  const hidden = def.state.bool('hidden', true);
  def.expose.state('open', open);
  def.expose.state('hidden', hidden);
  const accessible = asAccessible();
  // P-BASE-COLLAPSIBLE-CONTENT-ROLE-NEUTRAL: no region, focus entry or tab stop.
  accessible.part(COLLAPSIBLE_FAMILY, { key: 'content' });
  accessible.state('hidden', hidden);

  const syncPresence = (run: RunHandle<CollapsibleContentProps>) => {
    rejectDuplicateCollapsiblePart(run, 'content');
    // Reentrant acceptance wins over an older request notification.
    const nextOpen = run.context.read(COLLAPSIBLE_CONTEXT).open;
    open.set(nextOpen, 'reason: collapsible canonical content');
    hidden.set(!nextOpen, 'reason: collapsible content hidden');
    // P-BASE-COLLAPSIBLE-CONTENT-L1: instance ownership stays with Runtime.
    run.lifecycle.setPresent(!!run.props.get().keepMounted || nextOpen);
  };
  def.context.subscribe(COLLAPSIBLE_CONTEXT, syncPresence);
  def.lifecycle.onCreated(syncPresence);
  def.lifecycle.onMounted(syncPresence);
  def.lifecycle.onUpdated(syncPresence);
  def.props.watch(['keepMounted'], syncPresence);
  // Reuse the existing Content hidden projection; no host escape or extra capability.
  def.rule({
    when: (when) => when.state(hidden).eq(true),
    intent: (intent) => intent.feedback.style.use(tw('hidden')),
  });
}

export const asCollapsibleContent = defineAsHook<
  CollapsibleContentProps,
  CollapsibleContentExposes,
  CollapsibleContentAsHookContract
>({ name: 'as-collapsible-content', setup: setupCollapsibleContent });

const collapsibleContent = definePrototype({
  name: 'base-collapsible-content',
  setup: setupCollapsibleContent,
});

export default collapsibleContent;
