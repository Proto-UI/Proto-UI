import { tw, type DefHandle, type State } from '@proto.ui/core';
import { SHADCN_STYLE_IDS, setupShadcnStyleSelection, type ShadcnStyleProps } from '../style-scope';
import { setupInputShellContainment } from '../input-shell/context';
import { setupMenuOpenPaint } from '../dropdown/visual';

/** MIT shadcn-ui/ui@3d98900e9b73c45f035f8109e9d41ba6a51685e7,
 * .cn-combobox-* and .cn-input-group-* in each retained style-*.css;
 * independent new-york-v4/ui/combobox.tsx and input-group.tsx at that pin.
 * Autocomplete deliberately borrows vocabulary, not Combobox semantics: the
 * pinned upstream inventory has no official Autocomplete component.
 * Base's six-part popup has no separate List/InputGroup/ItemIndicator parts;
 * combined scroll containment and standalone editor/trigger paint are bounded
 * Proto compositions, not fabricated full upstream anatomy or icon parity.
 */
const PROFILES = {
  vega: {
    surface: 'rounded-md shadow-md ring-1 ring-foreground/10',
    item: 'gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm',
    input: 'h-9 px-2.5 py-1 text-base',
    shape: 'rounded-md border-input bg-transparent shadow-xs transition-[color,box-shadow]',
    focus: 'border-ring ring-3 ring-ring/50',
    trigger: 'rounded-[calc(var(--radius)-5px)] text-sm',
  },
  nova: {
    surface: 'rounded-lg shadow-md ring-1 ring-foreground/10',
    item: 'gap-2 rounded-md py-1 pr-8 pl-1.5 text-sm',
    input: 'h-8 px-2.5 py-1 text-base',
    shape: 'rounded-lg border-input bg-transparent transition-colors',
    focus: 'border-ring ring-3 ring-ring/50',
    trigger: 'rounded-[calc(var(--radius)-3px)] text-sm',
  },
  maia: {
    surface: 'rounded-[var(--pui-radius-2xl)] shadow-2xl ring-1 ring-foreground/5',
    item: 'gap-2.5 rounded-[var(--pui-radius-xl)] py-2 pr-8 pl-3 text-sm',
    input: 'h-9 px-3 py-1 text-base',
    shape: 'rounded-[var(--pui-radius-4xl)] border-input bg-input/30 transition-colors',
    focus: 'border-ring ring-3 ring-ring/50',
    trigger: 'rounded-[var(--pui-radius-4xl)] text-sm',
  },
  lyra: {
    surface: 'rounded-none shadow-md ring-1 ring-foreground/10',
    item: 'gap-2 rounded-none py-2 pr-8 pl-2 text-xs',
    input: 'h-8 px-2.5 py-1 text-xs',
    shape: 'rounded-none border-input bg-transparent transition-colors',
    focus: 'border-ring ring-1 ring-ring/50',
    trigger: 'rounded-none text-xs',
  },
  mira: {
    surface: 'rounded-lg shadow-md ring-1 ring-foreground/10',
    item: 'min-h-7 gap-2 rounded-md px-2 py-1 text-xs leading-relaxed',
    input: 'h-7 px-2 py-0.5 text-sm',
    shape: 'rounded-md border-input bg-input/20 transition-colors',
    focus: 'border-ring ring-2 ring-ring/30',
    trigger: 'rounded-md text-xs leading-relaxed',
  },
  luma: {
    surface: 'rounded-[var(--pui-radius-3xl)] shadow-lg ring-1 ring-foreground/5',
    item: 'gap-2.5 rounded-[var(--pui-radius-2xl)] py-2 pr-8 pl-3 text-sm font-medium',
    input: 'h-9 px-3 py-1 text-base',
    shape:
      'rounded-[var(--pui-radius-4xl)] border-transparent bg-input/50 transition-[color,box-shadow,background-color]',
    focus: 'border-ring ring-3 ring-ring/30',
    trigger: 'rounded-xl text-sm',
  },
  sera: {
    surface: 'rounded-none shadow-md ring-1 ring-foreground/10',
    item: 'gap-2.5 rounded-none py-2 pr-8 pl-3 text-sm',
    input: 'h-10 px-0 py-1 text-base',
    shape:
      'rounded-none border-transparent border-b-input bg-transparent transition-[color,border-color]',
    focus: 'border-b-ring',
    trigger: 'rounded-none text-xs',
  },
  rhea: {
    surface: 'rounded-[var(--pui-radius-2xl)] shadow-lg ring-1 ring-foreground/5',
    item: 'gap-2 min-h-7 rounded-[var(--pui-radius-xl)] py-1.5 pr-8 pl-2 text-sm',
    input: 'h-8 px-2.5 py-1 text-base',
    shape:
      'rounded-[var(--pui-radius-2xl)] border-transparent bg-input/50 transition-[color,box-shadow] duration-200',
    focus: 'border-ring ring-3 ring-ring/30',
    trigger: 'rounded-xl text-sm',
  },
  'new-york-v4': {
    surface: 'rounded-md shadow-md ring-1 ring-foreground/10',
    item: 'gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm',
    input: 'h-9 px-3 py-1 text-base',
    shape: 'rounded-md border-input bg-transparent shadow-xs transition-[color,box-shadow]',
    focus: 'border-ring ring-3 ring-ring/50',
    trigger: 'rounded-[calc(var(--radius)-5px)] text-sm',
  },
} as const;

export function setupSearchInputPaint<
  Props extends ShadcnStyleProps,
  Exposes = Record<string, unknown>,
>(
  def: DefHandle<Props, Exposes>,
  state: { disabled: State<boolean>; focusVisible: State<boolean> }
) {
  const style = setupShadcnStyleSelection(def, 'new-york-v4');
  const grouped = setupInputShellContainment(def);
  def.feedback.style.use(
    tw('min-w-0 w-full grow text-foreground outline-none placeholder:text-muted-foreground')
  );
  for (const id of SHADCN_STYLE_IDS) {
    const recipe = PROFILES[id];
    def.rule({
      when: (w) => w.state(style).eq(id),
      intent: (i) => i.feedback.style.use(tw(recipe.input)),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq(id), w.state(grouped).eq(false)),
      intent: (i) => i.feedback.style.use(tw('border', recipe.shape)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(id),
          w.state(grouped).eq(false),
          w.state(state.focusVisible).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw(recipe.focus)),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq(id), w.meta('viewport.width').gte(768)),
      intent: (i) =>
        i.feedback.style.use(
          tw(id === 'lyra' ? 'text-xs' : id === 'mira' ? 'text-xs leading-relaxed' : 'text-sm')
        ),
    });
  }
  def.rule({
    when: (w) => w.state(grouped).eq(true),
    intent: (i) =>
      i.feedback.style.use(tw('rounded-none border-0 bg-transparent shadow-none ring-0')),
  });
  for (const id of ['vega', 'nova', 'lyra', 'mira', 'new-york-v4'] as const) {
    def.rule({
      when: (w) =>
        w.all(w.state(style).eq(id), w.state(grouped).eq(false), w.meta('colorScheme').eq('dark')),
      intent: (i) => i.feedback.style.use(tw('bg-input/30')),
    });
  }
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('cursor-not-allowed opacity-50')),
  });
}

export function setupSearchTriggerPaint<
  Props extends ShadcnStyleProps,
  Exposes = Record<string, unknown>,
>(
  def: DefHandle<Props, Exposes>,
  state: { disabled: State<boolean>; focusVisible: State<boolean> }
) {
  const style = setupShadcnStyleSelection(def, 'new-york-v4');
  // Source-derived compact InputGroupButton paint, without calling asButton.
  // The actual Trigger still owns its own disabled, focus and toggle protocol.
  def.feedback.style.use(
    tw('inline-flex size-6 p-0 gap-2 items-center justify-center outline-none')
  );
  for (const id of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.state(style).eq(id),
      intent: (i) => i.feedback.style.use(tw(PROFILES[id].trigger)),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq(id), w.state(state.focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw(PROFILES[id].focus)),
    });
  }
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
  });
}

export function setupSearchContentPaint<
  Props extends ShadcnStyleProps,
  Exposes = Record<string, unknown>,
>(def: DefHandle<Props, Exposes>, open: State<boolean>) {
  const style = setupShadcnStyleSelection(def, 'new-york-v4');
  def.feedback.style.use(
    tw(
      'z-50 bg-popover text-popover-foreground w-[var(--proto-ui-anchor-width)] min-w-[calc(var(--proto-ui-anchor-width)+1.75rem)] max-w-[var(--proto-ui-available-width)] overflow-x-hidden overflow-y-auto outline-none duration-100'
    )
  );
  for (const id of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.state(style).eq(id),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            PROFILES[id].surface,
            id === 'new-york-v4'
              ? 'max-h-[min(24rem,var(--proto-ui-available-height))]'
              : 'max-h-[min(18rem,var(--proto-ui-available-height))]',
            id === 'lyra'
              ? 'scroll-py-1'
              : id === 'luma' || id === 'sera'
                ? 'p-1.5 scroll-py-1.5'
                : 'p-1 scroll-py-1'
          )
        ),
    });
    if (id === 'luma' || id === 'rhea') {
      def.rule({
        when: (w) => w.all(w.state(style).eq(id), w.meta('colorScheme').eq('dark')),
        intent: (i) => i.feedback.style.use(tw('ring-foreground/10')),
      });
    }
  }
  setupMenuOpenPaint(def, open, true);
}

export function setupSearchItemPaint<
  Props extends ShadcnStyleProps,
  Exposes = Record<string, unknown>,
>(def: DefHandle<Props, Exposes>, state: { disabled: State<boolean>; active: State<boolean> }) {
  const style = setupShadcnStyleSelection(def, 'new-york-v4');
  def.feedback.style.use(
    tw(
      'relative flex min-w-0 w-full cursor-default select-none items-center outline-none break-words'
    )
  );
  for (const id of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.state(style).eq(id),
      intent: (i) => i.feedback.style.use(tw(PROFILES[id].item)),
    });
  }
  def.rule({
    when: (w) => w.state(state.active).eq(true),
    intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
  });
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
  });
}

export function setupSearchEmptyPaint<
  Props extends ShadcnStyleProps,
  Exposes = Record<string, unknown>,
>(def: DefHandle<Props, Exposes>, visible: State<boolean>) {
  const style = setupShadcnStyleSelection(def, 'new-york-v4');
  def.feedback.style.use(tw('w-full justify-center py-2 text-center text-muted-foreground'));
  for (const id of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.state(style).eq(id),
      intent: (i) =>
        i.feedback.style.use(
          tw(id === 'lyra' ? 'text-xs' : id === 'mira' ? 'text-xs leading-relaxed' : 'text-sm')
        ),
    });
  }
  // Base, not a child selector or a local filter, owns the empty-result truth.
  def.rule({
    when: (w) => w.state(visible).eq(true),
    intent: (i) => i.feedback.style.use(tw('flex')),
  });
}
