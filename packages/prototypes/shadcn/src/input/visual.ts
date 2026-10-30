import { tw, type DefHandle, type State } from '@proto.ui/core';
import { setupShadcnStyleSelection, SHADCN_STYLE_IDS, type ShadcnStyleProps } from '../style-scope';

/** shadcn-ui/ui@3d98900e: styles/style-*.css .cn-input; New York ui/input.tsx. */
const INPUT_SURFACE = {
  vega: 'h-9 rounded-md border-input bg-transparent px-2.5 py-1 text-base shadow-xs transition-[color,box-shadow]',
  nova: 'h-8 rounded-lg border-input bg-transparent px-2.5 py-1 text-base transition-colors',
  maia: 'h-9 rounded-[var(--pui-radius-4xl)] border-input bg-input/30 px-3 py-1 text-base transition-colors',
  lyra: 'h-8 rounded-none border-input bg-transparent px-2.5 py-1 text-xs transition-colors',
  mira: 'h-7 rounded-md border-input bg-input/20 px-2 py-0.5 text-sm transition-colors',
  luma: 'h-9 rounded-[var(--pui-radius-3xl)] border-transparent bg-input/50 px-3 py-1 text-base transition-[color,box-shadow,background-color]',
  sera: 'h-10 rounded-none border-transparent border-b-input bg-transparent px-0 py-1 text-base transition-[color,border-color]',
  rhea: 'h-8 rounded-[var(--pui-radius-2xl)] border-transparent bg-input/50 px-2.5 py-1 text-base transition-[color,box-shadow] duration-200',
  'new-york-v4':
    'h-9 rounded-md border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow]',
} as const;
const INPUT_FOCUS = {
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
const INPUT_INVALID = {
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

/** Paint only: callers supply their one real Base editor and optional Field invalid fact. */
export function setupInputVisual(
  def: DefHandle<ShadcnStyleProps>,
  state: { disabled: State<boolean>; focusVisible: State<boolean> },
  invalid?: State<boolean>,
  fieldControl = false
) {
  // The pre-scope standalone and Field Control compatibility baseline is base-nova.
  const style = setupShadcnStyleSelection(def, 'nova');
  def.feedback.style.use(tw('w-full min-w-0 border text-foreground outline-none'));
  if (!fieldControl) {
    // Existing standalone selection paint is a Proto extension, not a Base editing API.
    def.feedback.style.use(tw('selection:bg-primary selection:text-primary-foreground'));
  }
  for (const profile of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) => i.feedback.style.use(tw(INPUT_SURFACE[profile])),
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
      intent: (i) => i.feedback.style.use(tw(INPUT_FOCUS[profile])),
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
    if (invalid) {
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(invalid).eq(true)),
        intent: (i) => i.feedback.style.use(tw(INPUT_INVALID[profile])),
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
    intent: (i) => i.feedback.style.use(tw('pointer-events-none cursor-not-allowed opacity-50')),
  });
  if (fieldControl) {
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('forced-colors-focus-outline')),
    });
  }
  // Modern base Input gained placeholder presentation; it never reads host attributes as state.
  def.feedback.style.use(tw('placeholder:text-muted-foreground'));
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
