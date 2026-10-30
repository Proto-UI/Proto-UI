import { tw, type DefHandle, type RenderFn, type State } from '@proto.ui/core';
import type {
  SelectTriggerAsHookContract,
  SelectTriggerProps,
} from '@proto.ui/prototypes-base/select';
import {
  COMMAND_HOVER,
  COMMAND_PRESS,
  COMMAND_FOCUS,
  COMMAND_DISABLED,
} from '../interactive-surface';

/** Shared liquid-glass Select trigger projection; Base owns interaction, Field owns invalid. */
export function setupSelectTriggerVisual(
  def: DefHandle<SelectTriggerProps>,
  state: SelectTriggerAsHookContract['state'],
  invalid?: State<boolean>
): RenderFn {
  const { hovered, pressed, focusVisible, disabled, placeholder } = state;
  // Shared typed optical intent; host realization is independently evidenced.
  // Never substitute adaptive/native blur for an explicit liquid-glass request.
  def.feedback.material.declare({
    version: 2,
    shape: { kind: 'rounded-rect', geometry: 'style' },
    source: { kind: 'in-app-backdrop' },
    fallback: { fill: 'style', foreground: 'style' },
  });
  for (const isPressed of [false, true]) {
    def.rule({
      when: (w) => w.all(w.state(pressed).eq(isPressed), w.state(disabled).eq(false)),
      intent: (i) =>
        i.feedback.material.use({
          intent: 'liquid-glass',
          deformation: {
            kind: 'press',
            phase: isPressed ? 'pressed' : 'rest',
            contact: 'pointer',
          },
        }),
    });
  }

  def.feedback.style.use(
    tw(
      'inline-flex min-w-0 max-w-full items-center justify-between gap-2 rounded-xl border border-border bg-secondary text-secondary-foreground px-4 py-2 text-sm font-medium whitespace-normal text-start select-none cursor-pointer shadow-sm'
    )
  );
  def.rule({
    when: (w) =>
      w.all(
        w.state(hovered).eq(true),
        w.state(pressed).eq(false),
        w.state(disabled).eq(false),
        w.state(focusVisible).eq(false)
      ),
    intent: (i) => i.feedback.style.use(tw(COMMAND_HOVER)),
  });
  def.rule({
    when: (w) => w.all(w.state(pressed).eq(true), w.state(disabled).eq(false)),
    intent: (i) => i.feedback.style.use(tw(COMMAND_PRESS)),
  });
  def.rule({
    when: (w) => w.state(placeholder).eq(true),
    intent: (i) => i.feedback.style.use(tw('text-foreground')),
  });
  def.rule({
    when: (w) => w.state(focusVisible).eq(true),
    intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
  });
  def.rule({
    when: (w) => w.state(disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw(COMMAND_DISABLED)),
  });
  if (invalid) {
    def.rule({
      when: (w) => w.state(invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-2 border-foreground')),
    });
  }
  return (renderer) => [
    renderer.r.slot(),
    renderer.el(
      'span',
      { style: tw('pointer-events-none flex size-4 shrink-0 items-center justify-center') },
      renderer.svg.root(
        {
          viewBox: '0 0 24 24',
          width: 16,
          height: 16,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        renderer.svg.path({ d: 'm6 9 6 6 6-6' })
      )
    ),
  ];
}
