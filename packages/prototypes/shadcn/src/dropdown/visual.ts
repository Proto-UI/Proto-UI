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
export const MENU_PROFILES = {
  vega: {
    surface: 'rounded-md p-1 shadow-md ring-1 ring-foreground/10',
    item: 'gap-2 rounded-sm py-1.5 text-sm',
    left: 'pl-2',
    right: 'pr-2',
    inset: 'pl-8',
    label: 'py-1.5 text-xs font-medium text-muted-foreground',
    separator: '-mx-1 my-1 bg-border',
    width: 'min-w-36',
  },
  nova: {
    surface: 'rounded-lg p-1 shadow-md ring-1 ring-foreground/10',
    item: 'gap-1.5 rounded-md py-1 text-sm',
    left: 'pl-1.5',
    right: 'pr-1.5',
    inset: 'pl-7',
    label: 'py-1 text-xs font-medium text-muted-foreground',
    separator: '-mx-1 my-1 bg-border',
    width: 'min-w-36',
  },
  maia: {
    surface: 'rounded-[var(--pui-radius-2xl)] p-1 shadow-2xl ring-1 ring-foreground/5',
    item: 'gap-2.5 rounded-[var(--pui-radius-xl)] py-2 text-sm',
    left: 'pl-3',
    right: 'pr-3',
    inset: 'pl-9.5',
    label: 'py-2.5 text-xs text-muted-foreground',
    separator: '-mx-1 my-1 bg-border/50',
    width: 'min-w-48',
  },
  lyra: {
    surface: 'rounded-none shadow-md ring-1 ring-foreground/10',
    item: 'gap-2 rounded-none py-2 text-xs',
    left: 'pl-2',
    right: 'pr-2',
    inset: 'pl-7',
    label: 'py-2 text-xs text-muted-foreground',
    separator: '-mx-1 bg-border',
    width: 'min-w-36',
  },
  mira: {
    surface: 'rounded-lg p-1 shadow-md ring-1 ring-foreground/10',
    item: 'min-h-7 gap-2 rounded-md py-1 text-xs leading-relaxed',
    left: 'pl-2',
    right: 'pr-2',
    inset: 'pl-7.5',
    label: 'py-1.5 text-xs text-muted-foreground',
    separator: '-mx-1 my-1 bg-border/50',
    width: 'min-w-32',
  },
  luma: {
    surface: 'rounded-[var(--pui-radius-3xl)] p-1.5 shadow-lg ring-1 ring-foreground/5',
    item: 'gap-2.5 rounded-[var(--pui-radius-2xl)] py-2 text-sm font-medium',
    left: 'pl-3',
    right: 'pr-3',
    inset: 'pl-9.5',
    label: 'py-2.5 text-xs text-muted-foreground',
    separator: '-mx-1.5 my-1.5 bg-border/50',
    width: 'min-w-48',
  },
  sera: {
    surface: 'rounded-none p-1.5 shadow-md ring-1 ring-foreground/10',
    item: 'gap-2.5 rounded-none py-2 text-xs font-medium uppercase tracking-wider',
    left: 'pl-3',
    right: 'pr-3',
    inset: 'pl-9.5',
    label: 'py-2 text-xs uppercase tracking-wider font-semibold text-muted-foreground',
    separator: '-mx-1.5 my-1.5 bg-border/50',
    width: 'min-w-48',
  },
  rhea: {
    surface: 'rounded-[var(--pui-radius-2xl)] p-1 shadow-lg ring-1 ring-foreground/5',
    item: 'gap-2 min-h-7 rounded-[var(--pui-radius-xl)] py-1.5 text-sm',
    left: 'pl-2',
    right: 'pr-2',
    inset: 'pl-7',
    label: 'py-1 text-xs text-muted-foreground',
    separator: '-mx-1 my-1 bg-border/50',
    width: 'min-w-36',
  },
  'new-york-v4': {
    surface: 'rounded-md border border-border p-1 shadow-md',
    item: 'gap-2 rounded-sm py-1.5 text-sm',
    left: 'pl-2',
    right: 'pr-2',
    inset: 'pl-8',
    label: 'py-1.5 text-sm font-medium',
    separator: '-mx-1 my-1 bg-border',
    width: 'min-w-32',
  },
} as const satisfies Record<ShadcnStyleId, object>;

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
    const profile = MENU_PROFILES[id];
    const width =
      kind === 'dropdown'
        ? ['maia', 'luma', 'sera'].includes(id)
          ? 'min-w-48'
          : 'min-w-32'
        : kind === 'menubar' && id === 'new-york-v4'
          ? 'min-w-48'
          : profile.width;
    def.rule({
      when: (w) => w.state(style).eq(id),
      intent: (i) =>
        i.feedback.style.use(
          tw(profile.surface, width, id === 'new-york-v4' ? '' : 'duration-100')
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
    const recipe = MENU_PROFILES[id];
    // Menubar Sera is text-sm without the Dropdown/Context uppercase recipe.
    const body =
      kind === 'menubar' && id === 'sera' ? 'gap-2.5 rounded-none py-2 text-sm' : recipe.item;
    const inset = kind === 'menubar' && id === 'lyra' ? 'pl-8' : recipe.inset;
    def.rule({
      when: (w) => w.state(style).eq(id),
      intent: (i) => i.feedback.style.use(tw(body, recipe.right)),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq(id), w.prop('inset').eq(false)),
      intent: (i) => i.feedback.style.use(tw(recipe.left)),
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
