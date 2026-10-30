import {
  delay,
  tw,
  type DefHandle,
  type RenderFn,
  type RendererHandle,
  type RunHandle,
  type State,
} from '@proto.ui/core';
import type { SelectTriggerAsHookContract } from '@proto.ui/prototypes-base/select';
import type { ShadcnSelectTriggerProps } from './types';
import { setupSelectStyle } from './style';
import { SHADCN_STYLE_SCOPE, type ShadcnStyleId } from '../style-scope';
import {
  SELECT_TRANSLUCENT_STYLES,
  SELECT_TRIGGER_FOCUS,
  SELECT_TRIGGER_INVALID,
  SELECT_TRIGGER_SIZE,
  SELECT_TRIGGER_SM_RADIUS,
  SELECT_TRIGGER_SURFACE,
  SELECT_TRIGGER_SURFACE_BG,
} from './recipes';

/** New York keeps its size-4 opacity-50 chevron; modern profiles size the icon per recipe. */
function renderChevron(
  renderer: Pick<RendererHandle<ShadcnSelectTriggerProps>, 'svg' | 'el'>,
  style: ShadcnStyleId
) {
  const px = style === 'mira' || style === 'sera' ? 14 : 16;
  return renderer.el(
    'span',
    {
      style: tw(
        style === 'new-york-v4'
          ? 'pointer-events-none flex shrink-0 items-center text-muted-foreground opacity-50'
          : 'pointer-events-none flex shrink-0 items-center text-muted-foreground'
      ),
    },
    renderer.svg.root(
      {
        viewBox: '0 0 24 24',
        'aria-hidden': 'true',
        width: px,
        height: px,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      renderer.svg.path({ d: 'm6 9 6 6 6-6' })
    )
  );
}

export function setupSelectTriggerVisual(
  def: DefHandle<ShadcnSelectTriggerProps>,
  state: SelectTriggerAsHookContract['state'],
  invalid?: State<boolean>
) {
  // P-SHADCN-SELECT-TRIGGER-SIZE-PROP
  def.props.define({
    size: { type: 'enum', empty: 'fallback', options: ['sm', 'default'] },
    appearance: {
      type: 'enum',
      empty: 'fallback',
      options: ['default', 'ghost'],
    },
  });
  def.props.setDefaults({ size: 'default', appearance: 'default' });

  const style = setupSelectStyle(def);
  const { disabled, hovered, focusVisible, pressed, placeholder } = state;

  // P-SHADCN-SELECT-TRIGGER-CURRENT-VISUAL-SURFACE
  def.feedback.style.use(
    tw('flex w-fit items-center justify-between whitespace-nowrap outline-none select-none')
  );
  // P-SHADCN-SELECT-TRIGGER-APPEARANCE: visual delta only; Base owns behavior.
  def.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.prop('appearance').eq('default')),
    intent: (i) =>
      i.feedback.style.use(
        tw(
          'gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow]'
        )
      ),
  });
  def.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.prop('appearance').eq('ghost')),
    intent: (i) =>
      i.feedback.style.use(
        tw(
          'gap-2 rounded-md border border-transparent bg-transparent px-3 py-2 text-sm shadow-none transition-[color,box-shadow]'
        )
      ),
  });
  // P-SHADCN-SELECT-STYLE: pinned cn-select-trigger recipes for the seven
  // modern styles plus retained Rhea; ghost is rejected outside New York.
  for (const profile of SELECT_TRANSLUCENT_STYLES) {
    def.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) => i.feedback.style.use(tw(SELECT_TRIGGER_SURFACE[profile])),
    });
  }
  // P-SHADCN-SELECT-TRIGGER-STATE-DRIVEN-STYLES
  def.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.prop('size').eq('default')),
    intent: (i) => i.feedback.style.use(tw('h-9')),
  });
  def.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.prop('size').eq('sm')),
    intent: (i) => i.feedback.style.use(tw('h-8')),
  });
  for (const profile of SELECT_TRANSLUCENT_STYLES) {
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.prop('size').eq('default')),
      intent: (i) => i.feedback.style.use(tw(SELECT_TRIGGER_SIZE[profile].default)),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.prop('size').eq('sm')),
      intent: (i) => i.feedback.style.use(tw(SELECT_TRIGGER_SIZE[profile].sm)),
    });
    const smRadius = SELECT_TRIGGER_SM_RADIUS[profile];
    if (smRadius)
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.prop('size').eq('sm')),
        intent: (i) => i.feedback.style.use(tw(smRadius)),
      });
  }
  def.rule({
    when: (w) =>
      w.all(
        w.state(style).eq('new-york-v4'),
        w.all(
          w.state(placeholder).eq(true),
          w.any(
            w.prop('appearance').eq('default'),
            w.all(w.state(hovered).eq(false), w.state(pressed).eq(false))
          )
        )
      ),
    intent: (i) => i.feedback.style.use(tw('text-muted-foreground')),
  });
  // data-placeholder:text-muted-foreground is unconditional in modern recipes.
  for (const profile of SELECT_TRANSLUCENT_STYLES) {
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.state(placeholder).eq(true)),
      intent: (i) => i.feedback.style.use(tw('text-muted-foreground')),
    });
  }
  def.rule({
    when: (w) =>
      w.all(
        w.state(style).eq('new-york-v4'),
        w.all(w.prop('appearance').eq('default'), w.meta('colorScheme').eq('dark'))
      ),
    intent: (i) => i.feedback.style.use(tw('bg-input/30')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(style).eq('new-york-v4'),
        w.all(
          w.prop('appearance').eq('default'),
          w.meta('colorScheme').eq('dark'),
          w.state(hovered).eq(true)
        )
      ),
    intent: (i) => i.feedback.style.use(tw('bg-input/50')),
  });
  // Per-style input-surface backgrounds: several modern recipes apply the dark
  // fill unconditionally in dark mode plus a dark-only hover delta.
  for (const profile of SELECT_TRANSLUCENT_STYLES) {
    const { dark, darkHover } = SELECT_TRIGGER_SURFACE_BG[profile];
    if (dark)
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.meta('colorScheme').eq('dark')),
        intent: (i) => i.feedback.style.use(tw(dark)),
      });
    if (darkHover)
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.meta('colorScheme').eq('dark'),
            w.state(hovered).eq(true)
          ),
        intent: (i) => i.feedback.style.use(tw(darkHover)),
      });
  }
  def.rule({
    when: (w) =>
      w.all(
        w.state(style).eq('new-york-v4'),
        w.state(focusVisible).eq(true),
        ...(invalid ? [w.state(invalid).eq(false)] : [])
      ),
    intent: (i) => i.feedback.style.use(tw('border-ring ring-3 ring-ring/50')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(style).eq('new-york-v4'),
        w.all(
          w.prop('appearance').eq('ghost'),
          w.any(w.state(hovered).eq(true), w.state(pressed).eq(true))
        )
      ),
    intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
  });
  def.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(disabled).eq(true)),
    intent: (i) => i.feedback.style.use(tw('cursor-not-allowed opacity-50')),
  });

  // focus-visible per pinned recipe; Field invalid suppresses the focus ring.
  for (const profile of SELECT_TRANSLUCENT_STYLES) {
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.state(focusVisible).eq(true),
          ...(invalid ? [w.state(invalid).eq(false)] : [])
        ),
      intent: (i) => i.feedback.style.use(tw(SELECT_TRIGGER_FOCUS[profile])),
    });
  }
  // disabled:cursor-not-allowed disabled:opacity-50 from upstream select.tsx.
  for (const profile of SELECT_TRANSLUCENT_STYLES) {
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.state(disabled).eq(true)),
      intent: (i) => i.feedback.style.use(tw('cursor-not-allowed opacity-50')),
    });
  }
  if (invalid) {
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.state(invalid).eq(true),
          w.meta('colorScheme').eq('dark')
        ),
      intent: (i) => i.feedback.style.use(tw('border-destructive ring-destructive/40')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(invalid).eq(true),
          w.state(style).eq('new-york-v4'),
          w.not(w.meta('colorScheme').eq('dark'))
        ),
      intent: (i) => i.feedback.style.use(tw('border-destructive ring-destructive/20')),
    });
    // aria-invalid recipes are unconditional in every modern profile.
    for (const profile of SELECT_TRANSLUCENT_STYLES) {
      const recipe = SELECT_TRIGGER_INVALID[profile];
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(invalid).eq(true),
            w.not(w.meta('colorScheme').eq('dark'))
          ),
        intent: (i) => i.feedback.style.use(tw(recipe.light)),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(invalid).eq(true),
            w.meta('colorScheme').eq('dark')
          ),
        intent: (i) => i.feedback.style.use(tw(recipe.dark)),
      });
    }
    def.rule({
      when: (w) =>
        w.all(
          w.state(invalid).eq(true),
          w.state(style).eq('new-york-v4'),
          w.state(focusVisible).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('ring-3')),
    });
  }
  const validate = (run: RunHandle<ShadcnSelectTriggerProps>) => {
    if (style.get() !== 'new-york-v4' && run.props.get().appearance === 'ghost')
      throw new Error(`[shadcn-select-trigger] ${style.get()} does not define ghost appearance`);
  };
  def.props.watch(['appearance'], validate);
  def.lifecycle.onCreated(validate);
  def.lifecycle.onUpdated(validate);
  let task: { cancel(): void } | null = null;
  let renderedStyle = style.get();
  const scheduleGlyph = (run: RunHandle<ShadcnSelectTriggerProps>) => {
    validate(run);
    if (style.get() === renderedStyle) return;
    task?.cancel();
    task = delay(0, () => {
      task = null;
      run.update();
    });
  };
  def.context.trySubscribe(SHADCN_STYLE_SCOPE, scheduleGlyph);
  def.props.watchRaw(['styleProfile'], scheduleGlyph);
  def.lifecycle.onMounted(scheduleGlyph);
  def.lifecycle.onUpdated(scheduleGlyph);
  const cancel = () => {
    task?.cancel();
    task = null;
  };
  def.lifecycle.onUnmounted(cancel);
  def.lifecycle.onBeforeDispose(cancel);
  const render: RenderFn = (renderer) => {
    renderedStyle = style.get();
    return [renderer.r.slot(), renderChevron(renderer, renderedStyle)];
  };
  return render;
}
