import { definePrototype, tw } from '@proto.ui/core';
import {
  BRUTALIST_CONTROL_TOKENS,
  BRUTALIST_HOVER_LIFT_TOKENS,
  BRUTALIST_PRESS_TOKENS,
} from '../../../../packages/prototypes/brutalist/src/style';
import { SITE_LINK_ICONS, type SiteLinkIcon } from './site-link-icons';

export type SiteLinkAppearance =
  | 'action'
  | 'icon'
  | 'nav'
  | 'text'
  | 'brand'
  | 'sidebar'
  | 'toc'
  | 'pagination';
export type SiteLinkEmphasis = 'primary' | 'secondary' | 'minimal' | 'link';
export type SiteLinkSurfaceProps = {
  family: 'shadcn' | 'brutalist';
  appearance: SiteLinkAppearance;
  emphasis: SiteLinkEmphasis;
  icon: SiteLinkIcon | 'none';
  hovered: boolean;
  focusVisible: boolean;
  pressed: boolean;
  current: boolean;
};

const SIZE_TOKENS: Record<SiteLinkAppearance, string> = {
  action: 'min-h-11 px-4 py-2 gap-2 text-sm whitespace-nowrap',
  icon: 'size-11 p-0 whitespace-nowrap',
  nav: 'min-h-11 px-0 py-2 text-sm whitespace-nowrap',
  // Text inherits normal document wrapping; do not add a competing nowrap
  // baseline or an unsupported whitespace-normal token.
  text: 'min-h-6 px-0 py-0 text-sm',
  brand: 'min-h-11 px-0 py-2 text-base font-semibold tracking-tight whitespace-nowrap',
  sidebar: 'flex w-full min-w-0 min-h-11 px-2 py-1.5 gap-2 justify-between text-sm',
  toc: 'flex w-full min-w-0 min-h-6 px-2 py-1 gap-2 justify-between text-sm',
  pagination: 'flex w-full min-w-0 min-h-9 px-3 py-1 gap-1.5 text-sm',
};

/** App-owned experimental visual composition, not an official Link protocol.
 * The containing native anchor alone owns semantics, focus and activation.
 * Host facts enter as controlled props; this surface has no interaction hooks,
 * event, state, method, role, tabindex or default-action owner. */
export const SiteLinkSurface = definePrototype<SiteLinkSurfaceProps>({
  name: 'site-link-surface',
  setup(def) {
    def.props.define({
      family: { type: 'enum', empty: 'fallback', options: ['shadcn', 'brutalist'] },
      appearance: {
        type: 'enum',
        empty: 'fallback',
        options: ['action', 'icon', 'nav', 'text', 'brand', 'sidebar', 'toc', 'pagination'],
      },
      emphasis: {
        type: 'enum',
        empty: 'fallback',
        options: ['primary', 'secondary', 'minimal', 'link'],
      },
      icon: {
        type: 'enum',
        empty: 'fallback',
        options: ['none', 'github', 'discord', 'x', 'bluesky'],
      },
      hovered: { type: 'boolean', empty: 'fallback' },
      focusVisible: { type: 'boolean', empty: 'fallback' },
      pressed: { type: 'boolean', empty: 'fallback' },
      current: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({
      family: 'shadcn',
      appearance: 'action',
      emphasis: 'secondary',
      icon: 'none',
      hovered: false,
      focusVisible: false,
      pressed: false,
      current: false,
    });
    def.feedback.style.use(
      tw(
        // Native anchors own pointer hit testing as well as activation. A
        // visual-only WC update may rebuild decoration; it must not replace
        // the browser's in-flight pointer/click target inside the anchor.
        'pointer-events-none inline-flex shrink-0 items-center justify-center border border-transparent bg-transparent text-foreground font-medium outline-none'
      )
    );
    // The native anchor must contain the moving painted body at every endpoint.
    // Reserve the same physical right/down flow extent as the family motion;
    // this is not shadow hit testing and never makes the passive child an owner.
    def.rule({
      when: (w) =>
        w.all(
          w.prop('family').eq('brutalist'),
          w.any(w.prop('emphasis').eq('primary'), w.prop('emphasis').eq('secondary')),
          w.any(
            w.prop('appearance').eq('icon'),
            w.prop('appearance').eq('action'),
            w.prop('appearance').eq('pagination')
          )
        ),
      intent: (i) => i.feedback.style.use(tw('mr-1 mb-1')),
    });
    def.rule({
      when: (w) =>
        w.any(
          w.prop('family').eq('shadcn'),
          w.prop('emphasis').eq('minimal'),
          w.prop('emphasis').eq('link'),
          w.prop('appearance').eq('nav'),
          w.prop('appearance').eq('text'),
          w.prop('appearance').eq('brand'),
          w.prop('appearance').eq('sidebar'),
          w.prop('appearance').eq('toc')
        ),
      intent: (i) => i.feedback.style.use(tw('mb-px')),
    });
    // Theme variables alone do not select a font for unframed navigation.
    // Later appearance/current rules retain their intentional weight emphasis.
    def.rule({
      when: (w) => w.prop('family').eq('brutalist'),
      intent: (i) => i.feedback.style.use(tw('font-sans font-medium')),
    });
    for (const appearance of Object.keys(SIZE_TOKENS) as SiteLinkAppearance[]) {
      def.rule({
        when: (w) => w.prop('appearance').eq(appearance),
        intent: (i) => i.feedback.style.use(tw(SIZE_TOKENS[appearance])),
      });
    }
    def.rule({
      when: (w) =>
        w.all(
          w.prop('family').eq('shadcn'),
          w.any(w.prop('appearance').eq('sidebar'), w.prop('appearance').eq('toc'))
        ),
      intent: (i) => i.feedback.style.use(tw('rounded-md')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('family').eq('brutalist'),
          w.any(w.prop('appearance').eq('sidebar'), w.prop('appearance').eq('toc'))
        ),
      intent: (i) => i.feedback.style.use(tw('rounded-base')),
    });
    def.rule({
      when: (w) => w.prop('appearance').eq('toc'),
      intent: (i) => i.feedback.style.use(tw('text-muted-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('family').eq('shadcn'),
          w.any(w.prop('appearance').eq('sidebar'), w.prop('appearance').eq('toc')),
          w.prop('hovered').eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('family').eq('shadcn'),
          w.any(w.prop('appearance').eq('sidebar'), w.prop('appearance').eq('toc')),
          w.prop('current').eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('family').eq('brutalist'),
          w.any(w.prop('appearance').eq('sidebar'), w.prop('appearance').eq('toc')),
          w.any(w.prop('hovered').eq(true), w.prop('current').eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground border-black')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('family').eq('shadcn'),
          w.any(
            w.prop('appearance').eq('icon'),
            w.prop('appearance').eq('action'),
            w.prop('appearance').eq('pagination')
          )
        ),
      intent: (i) => i.feedback.style.use(tw('rounded-lg')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('family').eq('shadcn'),
          w.prop('appearance').eq('action'),
          w.prop('emphasis').eq('primary')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('family').eq('shadcn'),
          w.any(
            w.all(w.prop('appearance').eq('action'), w.prop('emphasis').eq('secondary')),
            w.prop('appearance').eq('pagination')
          )
        ),
      intent: (i) => i.feedback.style.use(tw('border-border bg-background text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('family').eq('brutalist'),
          w.any(w.prop('emphasis').eq('primary'), w.prop('emphasis').eq('secondary')),
          w.any(
            w.prop('appearance').eq('icon'),
            w.prop('appearance').eq('action'),
            w.prop('appearance').eq('pagination')
          )
        ),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_CONTROL_TOKENS)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('family').eq('brutalist'),
          w.prop('appearance').eq('action'),
          w.prop('emphasis').eq('primary')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('hovered').eq(true),
          w.prop('family').eq('shadcn'),
          w.any(
            w.prop('appearance').eq('icon'),
            w.prop('appearance').eq('pagination'),
            w.all(w.prop('appearance').eq('action'), w.prop('emphasis').eq('secondary'))
          )
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('hovered').eq(true),
          w.prop('family').eq('shadcn'),
          w.prop('appearance').eq('action'),
          w.prop('emphasis').eq('primary')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-primary/80')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('hovered').eq(true),
          w.prop('family').eq('brutalist'),
          w.any(w.prop('emphasis').eq('primary'), w.prop('emphasis').eq('secondary')),
          w.any(
            w.prop('appearance').eq('icon'),
            w.prop('appearance').eq('action'),
            w.prop('appearance').eq('pagination')
          )
        ),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_HOVER_LIFT_TOKENS)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.any(w.prop('hovered').eq(true), w.prop('current').eq(true)),
          w.any(w.prop('appearance').eq('nav'), w.prop('appearance').eq('text'))
        ),
      intent: (i) => i.feedback.style.use(tw('underline underline-offset-4')),
    });
    def.rule({
      when: (w) => w.prop('current').eq(true),
      intent: (i) => i.feedback.style.use(tw('font-semibold')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('pressed').eq(true),
          w.any(
            w.prop('family').eq('shadcn'),
            w.prop('emphasis').eq('minimal'),
            w.prop('emphasis').eq('link'),
            w.prop('appearance').eq('nav'),
            w.prop('appearance').eq('text'),
            w.prop('appearance').eq('brand'),
            w.prop('appearance').eq('sidebar'),
            w.prop('appearance').eq('toc')
          )
        ),
      intent: (i) => i.feedback.style.use(tw('translate-y-px shadow-none')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('pressed').eq(true),
          w.prop('family').eq('brutalist'),
          w.any(w.prop('emphasis').eq('primary'), w.prop('emphasis').eq('secondary')),
          w.any(
            w.prop('appearance').eq('icon'),
            w.prop('appearance').eq('action'),
            w.prop('appearance').eq('pagination')
          )
        ),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_PRESS_TOKENS)),
    });
    def.rule({
      when: (w) => w.prop('focusVisible').eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2 ring-offset-background')),
    });
    return (renderer) => {
      const icon = renderer.read.props.get().icon;
      if (icon === 'none') return renderer.r.slot();
      const glyph = SITE_LINK_ICONS[icon];
      return renderer.svg.root(
        {
          viewBox: glyph.viewBox,
          width: 18,
          height: 18,
          'aria-hidden': 'true',
          fill: 'currentColor',
        },
        renderer.svg.path({ d: glyph.path })
      );
    };
  },
});
export default SiteLinkSurface;
