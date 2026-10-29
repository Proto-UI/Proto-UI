import { createContextKey, tw, type DefHandle, type RunHandle, type State } from '@proto.ui/core';
import { SHADCN_STYLE_IDS, type ShadcnStyleProps } from '../style-scope';
import { setupMenuStyle } from '../dropdown/visual';
import type { NavigationMenuContentProps } from './types';

type ActionPaintProps = ShadcnStyleProps & { current?: boolean };

export const NAVIGATION_CONTENT_PAINT = createContextKey<{ content: boolean }>(
  'shadcn-navigation-content-paint'
);
const CONTENT_LINK = {
  vega: 'gap-1.5 rounded-sm p-2 text-sm',
  nova: 'gap-2 rounded-md p-2 text-sm',
  maia: 'gap-1.5 rounded-[var(--pui-radius-xl)] p-3 text-sm',
  lyra: 'gap-2 rounded-none p-2 text-xs',
  mira: 'gap-1.5 rounded-md p-2 text-xs leading-relaxed',
  luma: 'gap-1.5 rounded-[var(--pui-radius-2xl)] p-3 text-sm',
  sera: 'gap-1.5 rounded-none p-3 text-sm',
  rhea: 'gap-2 rounded-[var(--pui-radius-xl)] p-2 text-sm font-normal w-full',
  'new-york-v4': 'flex-col gap-1 rounded-sm p-2 text-sm',
} as const;

function setupNavigationContentMode(def: DefHandle<ActionPaintProps>) {
  const content = def.state.bool('navigationContentPaint', false);
  const sync = (run: RunHandle<ActionPaintProps>) =>
    content.set(
      run.context.tryRead(NAVIGATION_CONTENT_PAINT)?.content === true,
      'reason: owned Navigation Content boundary'
    );
  def.context.trySubscribe(NAVIGATION_CONTENT_PAINT, sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted(sync);
  def.lifecycle.onUpdated(sync);
  return content;
}

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
  def: DefHandle<ActionPaintProps>,
  states: {
    disabled: State<boolean>;
    focused: State<boolean>;
    focusVisible: State<boolean>;
    expanded?: State<boolean>;
  },
  kind: 'trigger' | 'link' | 'item'
) {
  const trigger = kind === 'trigger';
  const style = setupMenuStyle(def);
  const content = setupNavigationContentMode(def);
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
      when: (w) =>
        trigger ? w.state(style).eq(id) : w.all(w.state(style).eq(id), w.state(content).eq(false)),
      intent: (i) => i.feedback.style.use(tw(trigger ? recipe.trigger : recipe.link)),
    });
    if (!trigger)
      def.rule({
        when: (w) => w.all(w.state(style).eq(id), w.state(content).eq(true)),
        intent: (i) => i.feedback.style.use(tw(CONTENT_LINK[id])),
      });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(id),
          w.state(states.focusVisible).eq(true),
          w.state(content).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(recipe.focus)),
    });
  }
  if (!trigger)
    def.rule({
      when: (w) => w.all(w.state(content).eq(true), w.state(states.focused).eq(true)),
      intent: (i) => i.feedback.style.use(tw('ring-0 outline-none')),
    });
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
  } else if (kind === 'link') {
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

export function setupNavigationContentPaint(def: DefHandle<NavigationMenuContentProps>) {
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
