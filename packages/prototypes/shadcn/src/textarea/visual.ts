import { tw, type DefHandle, type State } from '@proto.ui/core';
import type { TextareaRootStateHandles } from '@proto.ui/prototypes-base/textarea';
import { setupShadcnStyleSelection, type ShadcnStyleProps } from '../style-scope';

export const TEXTAREA_PROJECTED_STYLES = Object.freeze(['new-york-v4', 'rhea'] as const);
/** Shared visual projection only; Base and optional Field own every editing/validation fact. */
export function setupTextareaVisual(
  def: DefHandle<ShadcnStyleProps>,
  state: TextareaRootStateHandles,
  invalid?: State<boolean>
) {
  const style = setupShadcnStyleSelection(def, 'new-york-v4', {
    supportedStyles: TEXTAREA_PROJECTED_STYLES,
  });
  def.feedback.style.use(
    tw(
      'flex field-sizing-content min-h-16 w-full border py-2 text-base text-foreground transition-[color,box-shadow] ease-in-out outline-none placeholder:text-muted-foreground'
    )
  );
  def.rule({
    when: (w) => w.state(style).eq('new-york-v4'),
    intent: (i) =>
      i.feedback.style.use(
        tw('resize-y rounded-md border-input bg-transparent px-3 shadow-xs duration-150')
      ),
  });
  def.rule({
    when: (w) => w.state(style).eq('rhea'),
    intent: (i) =>
      i.feedback.style.use(
        tw(
          'resize-none rounded-[var(--pui-radius-2xl)] border-transparent bg-input/50 px-2.5 duration-200'
        )
      ),
  });
  def.rule({
    when: (w) => w.meta('viewport.width').gte(768),
    intent: (i) => i.feedback.style.use(tw('text-sm')),
  });
  def.rule({
    when: (w) =>
      invalid
        ? w.all(
            w.state(style).eq('new-york-v4'),
            w.state(state.focusVisible).eq(true),
            w.state(invalid).eq(false)
          )
        : w.all(w.state(style).eq('new-york-v4'), w.state(state.focusVisible).eq(true)),
    intent: (i) => i.feedback.style.use(tw('border-ring ring-ring/50 ring-3')),
  });
  def.rule({
    when: (w) =>
      invalid
        ? w.all(
            w.state(style).eq('rhea'),
            w.state(state.focusVisible).eq(true),
            w.state(invalid).eq(false)
          )
        : w.all(w.state(style).eq('rhea'), w.state(state.focusVisible).eq(true)),
    intent: (i) => i.feedback.style.use(tw('border-ring ring-ring/30 ring-3')),
  });
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('cursor-not-allowed opacity-50')),
  });
  def.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.meta('colorScheme').eq('dark')),
    intent: (i) => i.feedback.style.use(tw('bg-input/30')),
  });
  if (invalid) {
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.state(invalid).eq(true),
          w.state(state.focusVisible).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('ring-3')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.any(w.state(style).eq('new-york-v4'), w.state(style).eq('rhea')),
          w.state(invalid).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('border-destructive ring-destructive/20')),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq('rhea'), w.state(invalid).eq(true)),
      intent: (i) => i.feedback.style.use(tw('ring-3')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.any(w.state(style).eq('new-york-v4'), w.state(style).eq('rhea')),
          w.state(invalid).eq(true),
          w.meta('colorScheme').eq('dark')
        ),
      intent: (i) => i.feedback.style.use(tw('ring-destructive/40')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('rhea'),
          w.state(invalid).eq(true),
          w.meta('colorScheme').eq('dark')
        ),
      intent: (i) => i.feedback.style.use(tw('border-destructive/50')),
    });
  }
  return style;
}
