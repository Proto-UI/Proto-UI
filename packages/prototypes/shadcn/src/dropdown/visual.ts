import { tw, type DefHandle, type State } from '@proto.ui/core';
import {
  SHADCN_STYLE_IDS,
  setupShadcnStyleScope,
  setupShadcnStyleSelection,
  type ShadcnStyleId,
  type ShadcnStyleProps,
} from '../style-scope';

/** MIT shadcn-ui/ui 3d98900e9b73c45f035f8109e9d41ba6a51685e7,
 * apps/v4/registry/styles/style-*.css, .cn-{dropdown-menu,context-menu,menubar}-*.
 * New York Item/Label retain the independently adopted 02cad611 recipe.
 * These are paint recipes, not a second menu/command interaction owner.
 */
// Flat profile/part keys preserve literal paint values in source collection as
// well as at runtime, following Switch's profile/size recipe convention.
type MenuPaintPart = 'surface' | 'item' | 'left' | 'right' | 'inset' | 'label' | 'separator' | 'width';
export const MENU_PROFILES = {
  'vega-surface': 'rounded-md p-1 shadow-md ring-1 ring-foreground/10',
  'vega-item': 'gap-2 rounded-sm py-1.5 text-sm',
  'vega-left': 'pl-2',
  'vega-right': 'pr-2',
  'vega-inset': 'pl-8',
  'vega-label': 'py-1.5 text-xs font-medium text-muted-foreground',
  'vega-separator': '-mx-1 my-1 bg-border',
  'vega-width': 'min-w-36',
  'nova-surface': 'rounded-lg p-1 shadow-md ring-1 ring-foreground/10',
  'nova-item': 'gap-1.5 rounded-md py-1 text-sm',
  'nova-left': 'pl-1.5',
  'nova-right': 'pr-1.5',
  'nova-inset': 'pl-7',
  'nova-label': 'py-1 text-xs font-medium text-muted-foreground',
  'nova-separator': '-mx-1 my-1 bg-border',
  'nova-width': 'min-w-36',
  'maia-surface': 'rounded-[var(--pui-radius-2xl)] p-1 shadow-2xl ring-1 ring-foreground/5',
  'maia-item': 'gap-2.5 rounded-[var(--pui-radius-xl)] py-2 text-sm',
  'maia-left': 'pl-3',
  'maia-right': 'pr-3',
  'maia-inset': 'pl-9.5',
  'maia-label': 'py-2.5 text-xs text-muted-foreground',
  'maia-separator': '-mx-1 my-1 bg-border/50',
  'maia-width': 'min-w-48',
  'lyra-surface': 'rounded-none shadow-md ring-1 ring-foreground/10',
  'lyra-item': 'gap-2 rounded-none py-2 text-xs',
  'lyra-left': 'pl-2',
  'lyra-right': 'pr-2',
  'lyra-inset': 'pl-7',
  'lyra-label': 'py-2 text-xs text-muted-foreground',
  'lyra-separator': '-mx-1 bg-border',
  'lyra-width': 'min-w-36',
  'mira-surface': 'rounded-lg p-1 shadow-md ring-1 ring-foreground/10',
  'mira-item': 'min-h-7 gap-2 rounded-md py-1 text-xs leading-relaxed',
  'mira-left': 'pl-2',
  'mira-right': 'pr-2',
  'mira-inset': 'pl-7.5',
  'mira-label': 'py-1.5 text-xs text-muted-foreground',
  'mira-separator': '-mx-1 my-1 bg-border/50',
  'mira-width': 'min-w-32',
  'luma-surface': 'rounded-[var(--pui-radius-3xl)] p-1.5 shadow-lg ring-1 ring-foreground/5',
  'luma-item': 'gap-2.5 rounded-[var(--pui-radius-2xl)] py-2 text-sm font-medium',
  'luma-left': 'pl-3',
  'luma-right': 'pr-3',
  'luma-inset': 'pl-9.5',
  'luma-label': 'py-2.5 text-xs text-muted-foreground',
  'luma-separator': '-mx-1.5 my-1.5 bg-border/50',
  'luma-width': 'min-w-48',
  'sera-surface': 'rounded-none p-1.5 shadow-md ring-1 ring-foreground/10',
  'sera-item': 'gap-2.5 rounded-none py-2 text-xs font-medium uppercase tracking-wider',
  'sera-left': 'pl-3',
  'sera-right': 'pr-3',
  'sera-inset': 'pl-9.5',
  'sera-label': 'py-2 text-xs uppercase tracking-wider font-semibold text-muted-foreground',
  'sera-separator': '-mx-1.5 my-1.5 bg-border/50',
  'sera-width': 'min-w-48',
  'rhea-surface': 'rounded-[var(--pui-radius-2xl)] p-1 shadow-lg ring-1 ring-foreground/5',
  'rhea-item': 'gap-2 min-h-7 rounded-[var(--pui-radius-xl)] py-1.5 text-sm',
  'rhea-left': 'pl-2',
  'rhea-right': 'pr-2',
  'rhea-inset': 'pl-7',
  'rhea-label': 'py-1 text-xs text-muted-foreground',
  'rhea-separator': '-mx-1 my-1 bg-border/50',
  'rhea-width': 'min-w-36',
  'new-york-v4-surface': 'rounded-md border border-border p-1 shadow-md',
  'new-york-v4-item': 'gap-2 rounded-sm py-1.5 text-sm',
  'new-york-v4-left': 'pl-2',
  'new-york-v4-right': 'pr-2',
  'new-york-v4-inset': 'pl-8',
  'new-york-v4-label': 'py-1.5 text-sm font-medium',
  'new-york-v4-separator': '-mx-1 my-1 bg-border',
  'new-york-v4-width': 'min-w-32',
} as const satisfies Record<`${ShadcnStyleId}-${MenuPaintPart}`, string>;

export function setupMenuStyle(
  def: DefHandle<ShadcnStyleProps>,
  fallback: ShadcnStyleId = 'new-york-v4',
  root = false
) {
  if (root) setupShadcnStyleScope(def);
  return setupShadcnStyleSelection(def, fallback);
}

type MenuKind = 'dropdown' | 'context-menu' | 'menubar';
export function setupMenuSurface(def: DefHandle<ShadcnStyleProps>, kind: MenuKind) {
  const style = setupMenuStyle(def, kind === 'dropdown' ? 'nova' : 'new-york-v4');
  def.feedback.style.use(
    tw(
      'z-50 bg-popover text-popover-foreground max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-x-hidden overflow-y-auto outline-none'
    )
  );
  for (const id of SHADCN_STYLE_IDS) {
    const width =
      kind === 'dropdown'
        ? ['maia', 'luma', 'sera'].includes(id)
          ? 'min-w-48'
          : 'min-w-32'
        : kind === 'menubar' && id === 'new-york-v4'
          ? 'min-w-48'
          : MENU_PROFILES[`${id}-width`];
    def.rule({
      when: (w) => w.state(style).eq(id),
      intent: (i) =>
        i.feedback.style.use(
          tw(MENU_PROFILES[`${id}-surface`], width, id === 'new-york-v4' ? '' : 'duration-100')
        ),
    });
    if (id === 'rhea' || id === 'luma' || (id === 'maia' && kind === 'dropdown')) {
      def.rule({
        when: (w) => w.all(w.state(style).eq(id), w.meta('colorScheme').eq('dark')),
        intent: (i) => i.feedback.style.use(tw('ring-foreground/10')),
      });
    }
  }
  return style;
}

/** Uses the inherited open fact. Collision-resolved side/transform-origin and
 * per-channel native trajectories remain separate Host/Adapter prerequisites. */
export function setupMenuOpenPaint(
  def: DefHandle<ShadcnStyleProps & { side?: 'top' | 'right' | 'bottom' | 'left' }>,
  open: State<boolean>,
  hasSide: boolean
) {
  def.rule({
    when: (w) => w.state(open).eq(true),
    intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0 zoom-in-95')),
  });
  def.rule({
    when: (w) => w.state(open).eq(false),
    intent: (i) => i.feedback.style.use(tw('animate-out fade-out-0 zoom-out-95')),
  });
  if (hasSide) {
    for (const [side, token] of [
      ['bottom', 'slide-in-from-top-2'],
      ['top', 'slide-in-from-bottom-2'],
      ['left', 'slide-in-from-right-2'],
      ['right', 'slide-in-from-left-2'],
    ] as const) {
      def.rule({
        when: (w) => w.all(w.state(open).eq(true), w.prop('side').eq(side)),
        intent: (i) => i.feedback.style.use(tw(token)),
      });
    }
  }
}

type MenuItemStates = {
  disabled: State<boolean>;
  focused: State<boolean>;
  focusVisible: State<boolean>;
  active?: State<boolean>;
  hovered?: State<boolean>;
  pressed?: State<boolean>;
};
export function setupMenuItemPaint(
  def: DefHandle<ShadcnStyleProps & { inset?: boolean; variant?: 'default' | 'destructive' }>,
  states: MenuItemStates,
  kind: MenuKind
) {
  const style = setupMenuStyle(def);
  def.props.define({
    inset: { type: 'boolean', empty: 'fallback' },
    variant: { type: 'enum', options: ['default', 'destructive'], empty: 'fallback' },
  });
  def.props.setDefaults({ inset: false, variant: 'default' });
  def.feedback.style.use(
    tw('relative flex min-w-0 cursor-default select-none items-center outline-none break-words')
  );
  for (const id of SHADCN_STYLE_IDS) {
    // Menubar Sera is text-sm without the Dropdown/Context uppercase recipe.
    const body =
      kind === 'menubar' && id === 'sera'
        ? 'gap-2.5 rounded-none py-2 text-sm'
        : MENU_PROFILES[`${id}-item`];
    const inset = kind === 'menubar' && id === 'lyra' ? 'pl-8' : MENU_PROFILES[`${id}-inset`];
    def.rule({
      when: (w) => w.state(style).eq(id),
      intent: (i) => i.feedback.style.use(tw(body, MENU_PROFILES[`${id}-right`])),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq(id), w.prop('inset').eq(false)),
      intent: (i) => i.feedback.style.use(tw(MENU_PROFILES[`${id}-left`])),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq(id), w.prop('inset').eq(true)),
      intent: (i) => i.feedback.style.use(tw(inset)),
    });
  }
  def.rule({
    when: (w) =>
      w.all(
        w.prop('variant').eq('default'),
        w.any(w.state(states.focused).eq(true), w.state(states.focusVisible).eq(true))
      ),
    intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
  });
  def.rule({
    when: (w) => w.prop('variant').eq('destructive'),
    intent: (i) => i.feedback.style.use(tw('text-destructive')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.prop('variant').eq('destructive'),
        w.any(w.state(states.focused).eq(true), w.state(states.focusVisible).eq(true))
      ),
    intent: (i) => i.feedback.style.use(tw('bg-destructive/10 text-destructive')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.prop('variant').eq('destructive'),
        w.any(w.state(states.focused).eq(true), w.state(states.focusVisible).eq(true)),
        w.meta('colorScheme').eq('dark')
      ),
    intent: (i) => i.feedback.style.use(tw('bg-destructive/20')),
  });
  // The already cataloged Dropdown New York active/hover/press extension is not
  // silently promoted into every modern profile's source focus-only surface.
  if (kind === 'dropdown' && states.active && states.hovered && states.pressed) {
    const { active, hovered, pressed } = states;
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.prop('variant').eq('default'),
          w.any(w.state(active).eq(true), w.state(hovered).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.prop('variant').eq('default'),
          w.state(pressed).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-accent/80')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.prop('variant').eq('destructive'),
          w.any(w.state(active).eq(true), w.state(hovered).eq(true), w.state(pressed).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/10 text-destructive')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.prop('variant').eq('destructive'),
          w.meta('colorScheme').eq('dark'),
          w.any(w.state(active).eq(true), w.state(hovered).eq(true), w.state(pressed).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/20')),
    });
  }
  def.rule({
    when: (w) => w.state(states.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
  });
  return style;
}
