import { defineAsHook, definePrototype, tw, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { COLLAPSIBLE_CONTEXT, COLLAPSIBLE_FAMILY, rejectDuplicateCollapsiblePart } from './shared';
import type {
  CollapsibleContentAsHookContract,
  CollapsibleContentExposes,
  CollapsibleContentProps,
  CollapsibleContentHandles,
} from './types';
import type { TransitionHandles } from '../transition/types';

function setupCollapsibleContent(
  def: DefHandle<CollapsibleContentProps, CollapsibleContentExposes>
): void {
  def.anatomy.claim(COLLAPSIBLE_FAMILY, { role: 'content' });
  def.props.define({ keepMounted: { type: 'boolean', empty: 'fallback' } });
  def.props.setDefaults({ keepMounted: false });
  const open = def.state.bool('open', false);
  const hidden = def.state.bool('hidden', true);
  let presence: TransitionHandles | null = null;
  let syncRevision = 0;
  def.expose.state('open', open);
  def.expose.state('hidden', hidden);
  const accessible = asAccessible();
  // P-BASE-COLLAPSIBLE-CONTENT-ROLE-NEUTRAL: no region, focus entry or tab stop.
  accessible.part(COLLAPSIBLE_FAMILY, { key: 'content' });
  accessible.state('hidden', hidden);

  const syncPresence = (run: RunHandle<CollapsibleContentProps>) => {
    const revision = ++syncRevision;
    rejectDuplicateCollapsiblePart(run, 'content');
    // Reentrant acceptance wins over an older request notification.
    const nextOpen = run.context.read(COLLAPSIBLE_CONTEXT).open;
    open.set(nextOpen, 'reason: collapsible canonical content');
    if (revision !== syncRevision) return;
    const currentOpen = run.context.read(COLLAPSIBLE_CONTEXT).open;
    hidden.set(
      presence ? !presence.isPresent.get() : !currentOpen,
      'reason: collapsible content hidden'
    );
    if (revision !== syncRevision) return;
    // P-BASE-COLLAPSIBLE-CONTENT-L1: instance ownership stays with Runtime.
    if (presence) presence.retainClosedView(!!run.props.get().keepMounted);
    else run.lifecycle.setPresent(!!run.props.get().keepMounted || currentOpen);
  };
  def.expose.method('bindPresence', (transition: TransitionHandles) => {
    hidden.setDefault(hidden.get());
    if (presence) {
      if (presence === transition) return;
      throw new Error('[asCollapsibleContent] presence is already bound.');
    }
    transition.bindOpenContext({ context: COLLAPSIBLE_CONTEXT, field: 'open' });
    presence = transition;
    transition.isPresent.watch((_run, event) => {
      if (event.type !== 'next') return;
      hidden.set(!transition.isPresent.get(), 'reason: collapsible perceptual content');
    });
  });
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
  CollapsibleContentAsHookContract,
  CollapsibleContentHandles
>({
  name: 'as-collapsible-content',
  setup: setupCollapsibleContent,
  projectHandle(result) {
    const bindPresence = result.getMethod?.('bindPresence') as
      | CollapsibleContentHandles['bindPresence']
      | undefined;
    if (!bindPresence) throw new Error('[asCollapsibleContent] missing presence binding.');
    return { ...result, bindPresence };
  },
});

const collapsibleContent = definePrototype({
  name: 'base-collapsible-content',
  setup: setupCollapsibleContent,
});

export default collapsibleContent;
