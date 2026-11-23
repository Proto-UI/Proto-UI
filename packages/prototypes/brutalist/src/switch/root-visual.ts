import { tw, type DefHandle, type ObservedStateHandle } from '@proto.ui/core';
import type { SwitchRootStateHandles } from '@proto.ui/prototypes-base/switch';
import { BRUTALIST_DISABLED_TOKENS, BRUTALIST_FOCUS_TOKENS } from '../style';
import type { BrutalistSwitchRootProps, BrutalistSwitchRootExposes } from './types';
// Source: neobrutalism-components switch.tsx@3306a802, default 24x48 capsule.
// The private visual Thumb remains the only checked-motion source.
const ROOT_BASE_TOKENS = [
  'peer',
  'inline-flex',
  'relative',
  'h-6',
  'w-12',
  'shrink-0',
  'items-center',
  'rounded-full',
  'border-2',
  'border-black',
  'bg-secondary-background',
  'p-0',
  'outline-none',
  'select-none',
  'font-sans',
  'font-medium',
  'transition-colors',
  'duration-150',
].join(' ');

export function setupSwitchRootVisual(
  def: DefHandle<BrutalistSwitchRootProps, BrutalistSwitchRootExposes>,
  switchState: SwitchRootStateHandles,
  invalid?: ObservedStateHandle<boolean, any>
) {
  // P-BRUTALIST-SWITCH-DRAG-DEFERRED: the pinned Thumb's 1.25rem travel
  // is not the zero-padding Root content interval. Reject this extension
  // until one declared range can drive both input and direct presentation.
  def.props.define({
    draggable: { type: 'boolean', empty: 'fallback', validator: (value) => value === false },
  });
  const { checked, disabled, focusVisible } = switchState;

  def.feedback.style.use(tw(ROOT_BASE_TOKENS));

  // P-BRUTALIST-SWITCH-CHECKED-PAIR-INVARIANT — checked swaps fill only, never padding
  def.rule({
    when: (w) => w.state(checked).eq(true),
    intent: (i) => i.feedback.style.use(tw('bg-main')),
  });
  // P-BRUTALIST-SWITCH-INTERACTION — focus-visible
  def.rule({
    when: (w) => w.state(focusVisible).eq(true),
    intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
  });
  // P-BRUTALIST-SWITCH-INTERACTION — disabled
  def.rule({
    when: (w) => w.state(disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw(BRUTALIST_DISABLED_TOKENS)),
  });
  if (invalid)
    def.rule({
      when: (w) => w.state(invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-destructive')),
    });
}
