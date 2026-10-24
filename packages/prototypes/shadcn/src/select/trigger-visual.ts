import {
  delay,
  tw,
  type DefHandle,
  type RendererHandle,
  type RunHandle,
  type State,
} from '@proto.ui/core';
import type { SelectTriggerAsHookContract } from '@proto.ui/prototypes-base/select';
import type { ShadcnSelectTriggerProps } from './types';
import { setupSelectStyle } from './style';
import { SHADCN_STYLE_SCOPE } from '../style-scope';
function renderChevron(renderer: Pick<RendererHandle<any>, 'svg' | 'el'>, rhea: boolean) {
  return renderer.el(
    'span',
    {
      style: rhea
        ? tw('pointer-events-none flex shrink-0 items-center text-muted-foreground')
        : tw('pointer-events-none flex shrink-0 items-center text-muted-foreground opacity-50'),
    },
    renderer.svg.root(
      {
        viewBox: '0 0 24 24',
        'aria-hidden': 'true',
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
    tw(
      'flex w-fit items-center justify-between border px-3 py-2 text-sm whitespace-nowrap transition-[color,box-shadow] outline-none select-none'
    )
  );
  // P-SHADCN-SELECT-TRIGGER-APPEARANCE: visual delta only; Base owns behavior.
  def.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.prop('appearance').eq('default')),
    intent: (i) =>
      i.feedback.style.use(tw('gap-2 rounded-md bg-transparent border-input shadow-xs')),
  });
  def.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.prop('appearance').eq('ghost')),
    intent: (i) =>
      i.feedback.style.use(tw('gap-2 rounded-md bg-transparent border-transparent shadow-none')),
  });
  // P-SHADCN-SELECT-TRIGGER-STATE-DRIVEN-STYLES
  def.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.prop('size').eq('default')),
    intent: (i) => i.feedback.style.use(tw('h-9')),
  });
  def.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.prop('size').eq('sm')),
    intent: (i) => i.feedback.style.use(tw('h-8')),
  });
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

  def.rule({
    when: (w) => w.state(style).eq('rhea'),
    intent: (i) =>
      i.feedback.style.use(
        tw('gap-1.5 rounded-[var(--pui-radius-2xl)] border-transparent bg-input/50 duration-200')
      ),
  });
  for (const [size, token] of [
    ['default', tw('h-8')],
    ['sm', tw('h-7')],
  ] as const)
    def.rule({
      when: (w) => w.all(w.state(style).eq('rhea'), w.prop('size').eq(size)),
      intent: (i) => i.feedback.style.use(token),
    });
  def.rule({
    when: (w) => w.all(w.state(style).eq('rhea'), w.state(placeholder).eq(true)),
    intent: (i) => i.feedback.style.use(tw('text-muted-foreground')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(style).eq('rhea'),
        w.state(focusVisible).eq(true),
        ...(invalid ? [w.state(invalid).eq(false)] : [])
      ),
    intent: (i) => i.feedback.style.use(tw('border-ring ring-ring/30 ring-3')),
  });
  def.rule({
    when: (w) => w.all(w.state(style).eq('rhea'), w.state(disabled).eq(true)),
    intent: (i) => i.feedback.style.use(tw('cursor-not-allowed opacity-50')),
  });
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
      when: (w) => w.all(w.state(invalid).eq(true), w.not(w.meta('colorScheme').eq('dark'))),
      intent: (i) => i.feedback.style.use(tw('border-destructive ring-destructive/20')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('rhea'),
          w.state(invalid).eq(true),
          w.meta('colorScheme').eq('dark')
        ),
      intent: (i) => i.feedback.style.use(tw('border-destructive/50 ring-destructive/40')),
    });
    def.rule({
      when: (w) => w.all(w.state(invalid).eq(true), w.state(style).eq('rhea')),
      intent: (i) => i.feedback.style.use(tw('ring-3')),
    });
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
    if (style.get() === 'rhea' && run.props.get().appearance === 'ghost')
      throw new Error('[shadcn-select-trigger] Rhea does not define ghost appearance');
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
  return (renderer: RendererHandle<any>) => {
    renderedStyle = style.get();
    return [renderer.r.slot(), renderChevron(renderer, renderedStyle === 'rhea')];
  };
}
