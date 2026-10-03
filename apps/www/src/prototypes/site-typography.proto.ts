import { definePrototype, tw } from '@proto.ui/core';

export const SITE_TYPOGRAPHY_ROLES = [
  'slogan',
  'tagline',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'body',
  'label',
  'caption',
] as const;
export type SiteTypographyRole = (typeof SITE_TYPOGRAPHY_ROLES)[number];
export type SiteTypographyProps = {
  family: 'shadcn' | 'brutalist';
  role: SiteTypographyRole;
  compact: boolean;
};
const sizes: Record<SiteTypographyRole, string> = {
  slogan: 'text-5xl leading-tight tracking-tight',
  tagline: 'text-lg leading-relaxed text-muted-foreground',
  h1: 'text-4xl leading-tight tracking-tight',
  h2: 'text-3xl leading-tight tracking-tight',
  h3: 'text-2xl leading-snug',
  h4: 'text-xl leading-snug',
  h5: 'text-lg leading-snug',
  h6: 'text-base leading-normal',
  body: 'text-base leading-relaxed',
  label: 'text-sm leading-normal',
  caption: 'text-sm leading-normal text-muted-foreground',
};

/** App-private experimental visual owner, not a stable Base Typography API.
 * Native h1–h6/p/label/legend/a retain semantics, IDs, links and focus. This
 * passive slot has no event/state/expose/role/tabindex or pointer interception.
 * The consumer supplies viewport/theme/font resources, never text paint CSS. */
export const SiteTypography = definePrototype<SiteTypographyProps>({
  name: 'site-typography',
  setup(def) {
    def.props.define({
      family: { type: 'enum', empty: 'fallback', options: ['shadcn', 'brutalist'] },
      role: { type: 'enum', empty: 'fallback', options: [...SITE_TYPOGRAPHY_ROLES] },
      compact: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ family: 'shadcn', role: 'body', compact: false });
    for (const role of SITE_TYPOGRAPHY_ROLES) {
      const heading = role === 'slogan' || /^h[1-6]$/.test(role);
      def.rule({
        when: (w) =>
          role === 'slogan' || role === 'tagline'
            ? w.all(w.prop('role').eq(role), w.prop('compact').eq(false))
            : w.prop('role').eq(role),
        intent: (i) => i.feedback.style.use(tw(sizes[role])),
      });
      if (role !== 'label' && role !== 'caption')
        def.rule({
          when: (w) => w.prop('role').eq(role),
          intent: (i) => i.feedback.style.use(tw('block')),
        });
      def.rule({
        when: (w) => w.prop('role').eq(role),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              role === 'tagline' || role === 'caption' ? 'text-muted-foreground' : 'text-foreground'
            )
          ),
      });
      for (const family of ['shadcn', 'brutalist'] as const)
        def.rule({
          when: (w) => w.all(w.prop('family').eq(family), w.prop('role').eq(role)),
          intent: (i) =>
            i.feedback.style.use(
              tw(
                heading
                  ? family === 'brutalist'
                    ? 'font-heading font-bold'
                    : 'font-sans font-semibold'
                  : family === 'brutalist' || role === 'label'
                    ? 'font-sans font-medium'
                    : 'font-sans font-normal'
              )
            ),
        });
    }
    def.rule({
      when: (w) => w.all(w.prop('compact').eq(true), w.prop('role').eq('slogan')),
      intent: (i) => i.feedback.style.use(tw('text-3xl leading-tight')),
    });
    def.rule({
      when: (w) => w.all(w.prop('compact').eq(true), w.prop('role').eq('tagline')),
      intent: (i) => i.feedback.style.use(tw('text-base leading-relaxed')),
    });
    return (renderer) => renderer.r.slot();
  },
});
export default SiteTypography;
