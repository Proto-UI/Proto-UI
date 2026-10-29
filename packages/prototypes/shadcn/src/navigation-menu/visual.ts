import { tw, type DefHandle, type State } from '@proto.ui/core';
import { SHADCN_STYLE_IDS } from '../style-scope';
import { setupMenuStyle } from '../dropdown/visual';

/** Source: 3d98900 apps/v4/registry/styles/style-*.css, navigation-menu
 * trigger/link/content/popup; independent new-york-v4/ui/navigation-menu.tsx.
 * Base's bounded single-popup Content is not the upstream animated Viewport. */
const PROFILES = {
  vega: {
    trigger: 'rounded-md px-4 py-2 text-sm',
    link: 'gap-1.5 rounded-md p-2 text-sm',
    content: 'p-2 pr-2.5 rounded-lg shadow ring-1 ring-foreground/10',
    focus: 'ring-3 ring-ring/50 outline-1',
  },
  nova: {
    trigger: 'rounded-lg px-2.5 py-1.5 text-sm',
    link: 'gap-2 rounded-lg p-2 text-sm',
    content: 'p-1 rounded-lg shadow ring-1 ring-foreground/10',
    focus: 'ring-3 ring-ring/50 outline-1',
  },
  maia: {
    trigger: 'rounded-[var(--pui-radius-2xl)] px-4.5 py-2.5 text-sm',
    link: 'gap-1.5 rounded-[var(--pui-radius-2xl)] p-3 text-sm',
    content: 'p-2.5 pr-3 rounded-[var(--pui-radius-2xl)] shadow ring-1 ring-foreground/5',
    focus: 'ring-3 ring-ring/50 outline-1',
  },
  lyra: {
    trigger: 'rounded-none px-2.5 py-1.5 text-xs',
    link: 'gap-2 rounded-none p-2 text-xs',
    content: 'p-1 rounded-none shadow ring-1 ring-foreground/10',
    focus: 'ring-1 ring-ring/50 outline-1',
  },
  mira: {
    trigger: 'rounded-lg px-2.5 py-1.5 text-xs leading-relaxed',
    link: 'gap-1.5 rounded-lg p-2 text-xs leading-relaxed',
    content: 'p-1.5 rounded-xl shadow ring-1 ring-foreground/10',
    focus: 'ring-2 ring-ring/30 outline-1',
  },
  luma: {
    trigger: 'rounded-[var(--pui-radius-3xl)] px-4.5 py-2.5 text-sm',
    link: 'gap-1.5 rounded-[var(--pui-radius-3xl)] p-3 text-sm',
    content: 'p-2.5 pr-3 rounded-[var(--pui-radius-3xl)] shadow-lg ring-1 ring-foreground/5',
    focus: 'ring-3 ring-ring/30 outline-1',
  },
  sera: {
    trigger: 'rounded-none px-4.5 py-2.5 text-sm',
    link: 'gap-1.5 rounded-none p-3 text-sm',
    content: 'p-2.5 pr-3 rounded-none shadow-md ring-1 ring-foreground/10',
    focus: 'ring-2 ring-ring/30 outline-1',
  },
  rhea: {
    trigger: 'rounded-[var(--pui-radius-2xl)] px-2.5 py-1.5 text-sm',
    link: 'gap-2 rounded-[var(--pui-radius-2xl)] px-2.5 py-1.5 text-sm font-medium',
    content: 'p-1.5 rounded-[var(--pui-radius-3xl)] shadow-lg ring-1 ring-foreground/5',
    focus: 'ring-3 ring-ring/30 outline-1',
  },
  'new-york-v4': {
    trigger: 'rounded-md bg-background px-4 py-2 text-sm',
    link: 'flex-col gap-1 rounded-sm p-2 text-sm',
    content: 'p-2 pr-2.5 rounded-md border border-border shadow',
    focus: 'ring-3 ring-ring/50 outline-1',
  },
} as const;

export function setupNavigationActionPaint(
  def: DefHandle<any>,
  states: {
    disabled: State<boolean>;
    focused: State<boolean>;
    focusVisible: State<boolean>;
    expanded?: State<boolean>;
  },
  trigger: boolean
) {
  const style = setupMenuStyle(def);
  def.feedback.style.use(
    tw(
      trigger
        ? 'inline-flex h-9 w-max min-w-0 items-center justify-center font-medium outline-none transition-all'
        : 'flex min-w-0 items-center outline-none transition-all'
    )
  );
  for (const id of SHADCN_STYLE_IDS) {
    const recipe = PROFILES[id];
    def.rule({
      when: (w) => w.state(style).eq(id),
      intent: (i) => i.feedback.style.use(tw(trigger ? recipe.trigger : recipe.link)),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq(id), w.state(states.focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw(recipe.focus)),
    });
  }
  def.rule({
    when: (w) => w.all(w.not(w.state(style).eq('new-york-v4')), w.state(states.focused).eq(true)),
    intent: (i) => i.feedback.style.use(tw('bg-muted')),
  });
  def.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(states.focused).eq(true)),
    intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
  });
  if (states.expanded) {
    const expanded = states.expanded;
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.state(style).eq('new-york-v4')),
          w.state(expanded).eq(true),
          w.state(states.focused).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted/50')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.state(expanded).eq(true),
          w.state(states.focused).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-accent/50 text-accent-foreground')),
    });
  } else {
    // current is the actual public Base native-link fact, not an ancestor selector.
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.state(style).eq('new-york-v4')),
          w.prop('current').eq(true),
          w.state(states.focused).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted/50')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.prop('current').eq(true),
          w.state(states.focused).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-accent/50 text-accent-foreground')),
    });
  }
  def.rule({
    when: (w) => w.state(states.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
  });
}

export function setupNavigationContentPaint(def: DefHandle<any>) {
  const style = setupMenuStyle(def);
  def.feedback.style.use(
    tw(
      'z-50 bg-popover text-popover-foreground outline-none max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto'
    )
  );
  for (const id of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.state(style).eq(id),
      intent: (i) => i.feedback.style.use(tw(PROFILES[id].content)),
    });
    if (id === 'luma' || id === 'rhea') {
      def.rule({
        when: (w) => w.all(w.state(style).eq(id), w.meta('colorScheme').eq('dark')),
        intent: (i) => i.feedback.style.use(tw('ring-foreground/10')),
      });
    }
  }
}
