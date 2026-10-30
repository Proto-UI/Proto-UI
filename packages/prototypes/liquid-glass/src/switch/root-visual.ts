import { COMMAND_FOCUS, COMMAND_HOVER, COMMAND_PRESS } from '../interactive-surface';
import { tw, type DefHandle, type State } from '@proto.ui/core';
import type { SwitchRootStateHandles } from '@proto.ui/prototypes-base/switch';
import type { LiquidGlassSwitchRootProps } from './types';

/**
 * Track paint and optical intent only. Checked, directional preview,
 * activation, focus and every Field fact retain their exact Base/Field owners;
 * the Field-composed entry calls this setup after its own asFieldSwitch hook.
 * `invalid` is the optional as-optional-field-control borrowed state so the
 * Field variant can surface the same readability marker as Field Control.
 */
export function setupLiquidSwitchRootVisual(
  def: DefHandle<LiquidGlassSwitchRootProps>,
  state: SwitchRootStateHandles,
  invalid?: State<boolean>
) {
  def.props.define({
    material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
  });
  def.props.setDefaults({ material: 'auto' });
  const { checked, disabled, hovered, pressed, focusVisible } = state;

  // Project-owned 3rem × 1.75rem capsule with a sliding thumb, guided by HIG's
  // on/off silhouette rather than an Apple pixel-size or native parity claim.
  // The Thumb paints the moving circle; this track owns its state colors.
  def.feedback.style.use(
    tw(
      'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-border bg-muted text-foreground px-0.5 outline-none select-none cursor-pointer'
    )
  );
  def.rule({
    when: (w) => w.state(checked).eq(true),
    intent: (i) => i.feedback.style.use(tw('border-primary bg-primary text-primary-foreground')),
  });
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
  def.feedback.material.declare({
    version: 2,
    shape: { kind: 'rounded-rect', geometry: 'style' },
    source: { kind: 'in-app-backdrop' },
    fallback: { fill: 'style', foreground: 'style' },
  });
  // Checked requests a style-fill tint so the on-state stays distinguishable
  // through glass and through the same-state opaque fallback.
  for (const selected of [false, true])
    for (const phase of [false, true])
      def.rule({
        when: (w) =>
          w.all(
            w.prop('material').eq('auto'),
            w.state(disabled).eq(false),
            w.state(checked).eq(selected),
            w.state(pressed).eq(phase)
          ),
        intent: (i) =>
          i.feedback.material.use({
            intent: 'liquid-glass',
            variant: 'regular',
            ...(selected ? { tint: 'style-fill' as const } : {}),
            deformation: { kind: 'press', phase: phase ? 'pressed' : 'rest', contact: 'pointer' },
          }),
      });
  def.rule({
    when: (w) => w.state(focusVisible).eq(true),
    intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
  });
  if (invalid) {
    // Field Control's invalid marker: a heavier foreground frame keeps the
    // failure readable without inventing a new invalid vocabulary.
    def.rule({
      when: (w) => w.state(invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-2 border-foreground')),
    });
  }
  def.rule({
    when: (w) => w.state(disabled).eq(true),
    // No host opacity: the declared fallback stays complete and readable.
    intent: (i) => i.feedback.style.use(tw('cursor-not-allowed shadow-none')),
  });
}
