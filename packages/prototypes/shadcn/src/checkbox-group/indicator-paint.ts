import {
  delay,
  tw,
  type DelayTask,
  type DefHandle,
  type BorrowedStateHandle,
  type RendererHandle,
  type State,
  type RunHandle,
} from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import type {
  CheckboxGroupItemProps,
  CheckboxGroupItemExposes,
} from '@proto.ui/prototypes-base/checkbox-group';
import { SHADCN_STYLE_SCOPE, type ShadcnStyleId } from '../style-scope';
import type { ShadcnCheckboxGroupItemProps } from './types';

type GroupVisualProps = ShadcnCheckboxGroupItemProps;
// The passive checkbox box uses the real `.cn-checkbox` recipe, not a second
// Checkbox protocol. Group Root/Item/All remain the only value and input owners.
const BOX_SHAPE: Readonly<Record<ShadcnStyleId, string>> = {
  'new-york-v4': 'size-4 rounded-[4px]',
  vega: 'size-4 rounded-[4px] shadow-xs transition-shadow',
  nova: 'size-4 rounded-[4px] transition-colors',
  maia: 'size-4 rounded-[6px] transition-shadow',
  lyra: 'size-4 rounded-none transition-colors',
  mira: 'size-4 rounded-[4px] transition-shadow',
  luma: 'size-4 rounded-[5px] transition-shadow',
  sera: 'size-4.5 rounded-none transition-shadow',
  rhea: 'size-4 rounded-[5px] transition-shadow',
};
const BOX_UNCHECKED: Readonly<Record<ShadcnStyleId, string>> = {
  'new-york-v4': 'border-input bg-transparent text-foreground',
  vega: 'border-input bg-transparent text-foreground',
  nova: 'border-input bg-transparent text-foreground',
  maia: 'border-input bg-transparent text-foreground',
  lyra: 'border-input bg-transparent text-foreground',
  mira: 'border-input bg-transparent text-foreground',
  luma: 'border-transparent bg-input/90 text-foreground',
  sera: 'border-input bg-transparent text-foreground',
  rhea: 'border-transparent bg-input/90 text-foreground',
};
const ROW_FOCUS: Readonly<Record<ShadcnStyleId, string>> = {
  'new-york-v4': 'forced-colors-focus-outline ring-ring/50 ring-3',
  vega: 'forced-colors-focus-outline ring-ring/50 ring-3',
  nova: 'forced-colors-focus-outline ring-ring/50 ring-3',
  maia: 'forced-colors-focus-outline ring-ring/50 ring-[3px]',
  lyra: 'forced-colors-focus-outline ring-ring/50 ring-1',
  mira: 'forced-colors-focus-outline ring-ring/30 ring-2',
  luma: 'forced-colors-focus-outline ring-ring/30 ring-3',
  sera: 'forced-colors-focus-outline ring-ring/30 ring-2',
  rhea: 'forced-colors-focus-outline ring-ring/30 ring-3',
};

// Passive glyph grammar from ../checkbox/indicator.proto.ts. No interaction,
// Context command, focus or value owner is installed for this Template span.
export function checkboxGroupGlyph(
  def: DefHandle<GroupVisualProps, CheckboxGroupItemExposes>,
  state: {
    checked: BorrowedStateHandle<boolean, CheckboxGroupItemProps>;
    indeterminate: BorrowedStateHandle<boolean, CheckboxGroupItemProps>;
    focusVisible: State<boolean>;
  },
  style: State<ShadcnStyleId>
) {
  // Retain the admitted ordinary-row focus owner. Exact glyph-target focus
  // geometry and wrapped-card label ring clearing remain separate gaps.
  for (const profile of Object.keys(ROW_FOCUS) as ShadcnStyleId[]) {
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.state(state.focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw(ROW_FOCUS[profile])),
    });
  }
  // Every profile shares the same forced-colors outline; project it on the
  // web-exposed focus fact so forced-colors media keeps a painted row signal.
  def.rule({
    when: (w) => w.state(state.focusVisible).eq(true),
    intent: (i) => i.feedback.style.use(tw('forced-colors-focus-outline')),
  });
  let refresh: DelayTask | null = null;
  const request = (run: { update(): void }) => {
    refresh?.cancel();
    refresh = delay(0, () => {
      refresh = null;
      run.update();
    });
  };
  const update = (run: { update(): void }, event: { type: string }) => {
    if (event.type === 'next') request(run);
  };
  state.checked.watch(update);
  state.indeterminate.watch(update);
  let renderedStyle = style.get();
  const syncStyle = (run: RunHandle<GroupVisualProps>) => {
    if (style.get() !== renderedStyle) request(run);
  };
  // Register after setupShadcnStyleSelection: the shared resolver remains the
  // only explicit/inherit/compatibility precedence algorithm, including raw removal.
  def.context.trySubscribe(SHADCN_STYLE_SCOPE, syncStyle);
  def.props.watchRaw(['styleProfile'], syncStyle);
  def.lifecycle.onMounted(syncStyle);
  def.lifecycle.onUpdated(syncStyle);
  const cancel = () => {
    refresh?.cancel();
    refresh = null;
  };
  def.lifecycle.onUnmounted(cancel);
  def.lifecycle.onBeforeDispose(cancel);
  return <P extends PropsBaseType>(r: RendererHandle<P>) => {
    renderedStyle = style.get();
    const path = state.indeterminate.get()
      ? 'M5 12h14'
      : state.checked.get()
        ? 'm20 6-11 11-5-5'
        : null;
    const glyphSize = renderedStyle === 'new-york-v4' ? 16 : 14;
    return r.el(
      'span',
      {
        style: tw(
          'pointer-events-none inline-flex shrink-0 items-center justify-center border',
          BOX_SHAPE[renderedStyle],
          path ? 'border-primary bg-primary text-primary-foreground' : BOX_UNCHECKED[renderedStyle]
        ),
      },
      r.svg.root(
        {
          viewBox: '0 0 24 24',
          width: glyphSize,
          height: glyphSize,
          'aria-hidden': 'true',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        path ? r.svg.path({ d: path }) : null
      )
    );
  };
}
