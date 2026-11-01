import { tw, type DefHandle, type State } from '@proto.ui/core';
import type { TextareaRootStateHandles } from '@proto.ui/prototypes-base/textarea';
import { setupShadcnStyleSelection, SHADCN_STYLE_IDS, type ShadcnStyleProps } from '../style-scope';

export const TEXTAREA_PROJECTED_STYLES = SHADCN_STYLE_IDS;
/** shadcn-ui/ui@3d98900e, .cn-textarea and independent New York ui/textarea.tsx. */
const TEXTAREA_SURFACE = {
  vega: 'rounded-md border-input bg-transparent px-2.5 py-2 text-base shadow-xs transition-[color,box-shadow]',
  nova: 'rounded-lg border-input bg-transparent px-2.5 py-2 text-base transition-colors',
  maia: 'resize-none rounded-xl border-input bg-input/30 px-3 py-3 text-base transition-colors',
  lyra: 'rounded-none border-input bg-transparent px-2.5 py-2 text-xs transition-colors',
  mira: 'resize-none rounded-md border-input bg-input/20 px-2 py-2 text-sm transition-colors',
  luma: 'resize-none rounded-[var(--pui-radius-2xl)] border-transparent bg-input/50 px-3 py-3 text-base transition-[color,box-shadow,background-color]',
  sera: 'resize-none rounded-none border-transparent border-b-input bg-transparent px-0 py-3 text-base transition-[color,border-color]',
  rhea: 'resize-none rounded-[var(--pui-radius-2xl)] border-transparent bg-input/50 px-2.5 py-2 text-base transition-[color,box-shadow] duration-200',
  'new-york-v4':
    'resize-y rounded-md border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow]',
} as const;
const TEXTAREA_FOCUS = {
  vega: 'border-ring ring-ring/50 ring-3',
  nova: 'border-ring ring-ring/50 ring-3',
  maia: 'border-ring ring-ring/50 ring-3',
  lyra: 'border-ring ring-ring/50 ring-1',
  mira: 'border-ring ring-ring/30 ring-2',
  luma: 'border-ring ring-ring/30 ring-3',
  sera: 'border-b-ring',
  rhea: 'border-ring ring-ring/30 ring-3',
  'new-york-v4': 'border-ring ring-ring/50 ring-3',
} as const;
const TEXTAREA_INVALID = {
  vega: 'border-destructive ring-destructive/20 ring-3',
  nova: 'border-destructive ring-destructive/20 ring-3',
  maia: 'border-destructive ring-destructive/20 ring-3',
  lyra: 'border-destructive ring-destructive/20 ring-1',
  mira: 'border-destructive ring-destructive/20 ring-2',
  luma: 'border-destructive ring-destructive/20 ring-3',
  sera: 'border-b-destructive',
  rhea: 'border-destructive ring-destructive/20 ring-3',
  'new-york-v4': 'border-destructive ring-destructive/20',
} as const;

/** Same Base editor and optional Field binding; no value/focus/validation ownership here. */
export function setupTextareaVisual<
  Props extends ShadcnStyleProps,
  Exposes = Record<string, unknown>,
>(def: DefHandle<Props, Exposes>, state: TextareaRootStateHandles, invalid?: State<boolean>) {
  const style = setupShadcnStyleSelection(def, 'new-york-v4');
  def.feedback.style.use(
    tw(
      'flex field-sizing-content min-h-16 w-full border text-foreground outline-none placeholder:text-muted-foreground'
    )
  );
  for (const profile of TEXTAREA_PROJECTED_STYLES) {
    def.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) => i.feedback.style.use(tw(TEXTAREA_SURFACE[profile])),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.meta('viewport.width').gte(768)),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            profile === 'lyra'
              ? 'text-xs'
              : profile === 'mira'
                ? 'text-xs leading-relaxed'
                : 'text-sm'
          )
        ),
    });
    def.rule({
      when: (w) =>
        invalid
          ? w.all(
              w.state(style).eq(profile),
              w.state(state.focusVisible).eq(true),
              w.state(invalid).eq(false)
            )
          : w.all(w.state(style).eq(profile), w.state(state.focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw(TEXTAREA_FOCUS[profile])),
    });
    if (invalid) {
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(invalid).eq(true)),
        intent: (i) => i.feedback.style.use(tw(TEXTAREA_INVALID[profile])),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(invalid).eq(true),
            w.meta('colorScheme').eq('dark')
          ),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'sera'
                ? 'border-b-destructive/50'
                : profile === 'new-york-v4'
                  ? 'ring-destructive/40'
                  : 'border-destructive/50 ring-destructive/40'
            )
          ),
      });
      if (profile === 'new-york-v4') {
        def.rule({
          when: (w) =>
            w.all(
              w.state(style).eq(profile),
              w.state(invalid).eq(true),
              w.state(state.focusVisible).eq(true)
            ),
          intent: (i) => i.feedback.style.use(tw('ring-3')),
        });
      }
    }
  }
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('cursor-not-allowed opacity-50')),
  });
  for (const profile of ['vega', 'nova', 'lyra', 'mira', 'new-york-v4'] as const) {
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.meta('colorScheme').eq('dark')),
      intent: (i) => i.feedback.style.use(tw('bg-input/30')),
    });
  }
  for (const profile of ['nova', 'lyra'] as const) {
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.state(state.disabled).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-input/50')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.state(state.disabled).eq(true),
          w.meta('colorScheme').eq('dark')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-input/80')),
    });
  }
  return style;
}
