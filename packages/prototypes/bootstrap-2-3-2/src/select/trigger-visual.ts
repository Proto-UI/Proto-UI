import { tw, type DefHandle, type RenderFn, type State } from '@proto.ui/core';
import type { SelectTriggerAsHookContract } from '@proto.ui/prototypes-base/select';
import type { Bootstrap232SelectTriggerProps } from './types';
import { setupButtonVisual } from '../button/visual';

/**
 * One Bootstrap 2.3.2 button-dropdown trigger paint shared by the ordinary
 * Select Trigger and the optional FieldSelectTrigger composition. The custom
 * trigger extends the upstream `.btn` + `.dropdown-toggle` recipe with the
 * caret glyph; it is a design-language extension, not a native select parity
 * claim. Base owns combobox semantics; Field (when composed) owns invalid.
 */
export function setupSelectTriggerVisual(
  def: DefHandle<Bootstrap232SelectTriggerProps>,
  state: SelectTriggerAsHookContract['state'],
  invalid?: State<boolean>
): RenderFn {
  setupButtonVisual(def, state);
  // The custom Select keeps long labels readable; its historical .btn paint
  // and 2px caret spacing retain the pinned pixel units.
  def.feedback.style.use(
    tw('min-w-0 max-w-full justify-between gap-[2px] whitespace-normal text-start')
  );
  if (invalid) {
    def.rule({
      when: (w) => w.state(invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-destructive text-destructive')),
    });
  }
  return (renderer) => [
    renderer.r.slot(),
    renderer.el(
      'span',
      {
        style: tw(
          'pointer-events-none inline-flex w-[8px] h-[4px] shrink-0 items-center justify-center text-black'
        ),
      },
      renderer.svg.root(
        { viewBox: '0 0 8 4', 'aria-hidden': 'true', width: 8, height: 4, fill: 'currentColor' },
        renderer.svg.path({ d: 'M0 0h8L4 4z' })
      )
    ),
  ];
}
