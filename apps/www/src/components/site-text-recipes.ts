import type { TextRootProps } from '@proto.ui/prototypes-base/text';
import type { SiteLibraryFamily } from './site-library-family';

/** Content roles are application composition, never a Prototype API. */
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
  'notice-title',
  'caption',
  'overview-card-title',
  'overview-card-description',
  'reading-toc-title',
] as const;
export type SiteTypographyRole = (typeof SITE_TYPOGRAPHY_ROLES)[number];
export type SiteHeroViewport = 'small' | 'medium' | 'wide';

/** App composition roles preserve their authored native typography.
 * The document-heading role is (h1, document): its retained semantic owner is
 * the single responsive size/font source before and after enhancement. Public
 * Text inherits through the unstyled carrier; no second breakpoint table or
 * late heading-font swap is introduced. Component and Hero headings are not
 * document reading owners and keep their family recipes. */
export function siteTextSurfaceStyle(
  role: SiteTypographyRole,
  context: 'site' | 'document' = 'site'
): Record<string, string> {
  if (role === 'h1' && context === 'document')
    return {
      fontSize: 'inherit',
      lineHeight: 'inherit',
      fontFamily: 'inherit',
      fontWeight: 'inherit',
      letterSpacing: 'inherit',
    };
  if (role === 'reading-toc-title')
    return {
      fontSize: '0.75rem',
      lineHeight: '1rem',
      fontFamily: 'inherit',
      fontWeight: 'inherit',
      letterSpacing: 'inherit',
    };
  if (role === 'overview-card-title')
    return {
      fontSize: '1rem',
      lineHeight: '1.25rem',
      fontFamily: 'inherit',
      letterSpacing: 'inherit',
    };
  if (role === 'overview-card-description')
    return {
      fontSize: '0.76rem',
      lineHeight: '1.14rem',
      fontFamily: 'inherit',
      letterSpacing: 'inherit',
    };
  return {};
}

/** App transaction inputs, not a new Text/viewport Prototype API. */
export const SITE_TYPOGRAPHY_MEDIA_QUERIES = [
  '(max-width: 47.999rem)',
  '(min-width: 40rem)',
  '(min-width: 80rem)',
] as const;
export function siteTextRecipe(
  role: SiteTypographyRole,
  family: SiteLibraryFamily,
  compact = false,
  context: 'site' | 'document' = 'site',
  heroViewport: SiteHeroViewport = compact ? 'small' : 'medium'
): TextRootProps {
  if (role === 'reading-toc-title')
    return {
      size: 'xs',
      tone: 'inherit',
      weight: 'normal',
      font: 'body',
      leading: 'size',
      tracking: 'normal',
      emphasis: 'normal',
      decoration: 'none',
    };
  if (role === 'overview-card-title' || role === 'overview-card-description')
    return {
      size: role === 'overview-card-title' ? 'base' : 'xs',
      tone: role === 'overview-card-title' ? 'inherit' : 'muted',
      weight: role === 'overview-card-title' ? 'semibold' : 'normal',
      font: 'body',
      leading: 'size',
      tracking: role === 'overview-card-title' ? 'tight' : 'normal',
      emphasis: 'normal',
      decoration: 'none',
    };
  // These are existing public Text inputs, composed only for ordinary Shadcn
  // document reading. Homepage and notice/chrome owners keep their recipes.
  const reading = context === 'document' && family === 'shadcn';
  const shadcnHero = family === 'shadcn' && context === 'site';
  const heading = role === 'slogan' || /^h[1-6]$/.test(role);
  const size: TextRootProps['size'] =
    role === 'slogan'
      ? shadcnHero
        ? heroViewport === 'wide'
          ? '5xl'
          : '3xl'
        : compact
          ? '2xl'
          : '4xl'
      : role === 'tagline'
        ? shadcnHero
          ? heroViewport === 'small'
            ? 'base'
            : 'lg'
          : compact || reading
            ? 'base'
            : 'lg'
        : (
            {
              h1: reading ? '3xl' : '4xl',
              h2: '2xl',
              h3: 'xl',
              h4: 'lg',
              h5: 'lg',
              h6: 'base',
              body: 'base',
              label: 'sm',
              'notice-title': 'base',
              caption: 'sm',
            } as const
          )[role];
  return {
    size,
    tone:
      role === 'tagline' && shadcnHero
        ? 'default'
        : role === 'tagline' || role === 'caption'
          ? 'muted'
          : reading && role === 'body'
            ? 'inherit'
            : 'default',
    weight:
      role === 'notice-title'
        ? 'semibold'
        : heading
          ? family === 'brutalist'
            ? 'bold'
            : 'semibold'
          : family === 'brutalist' || role === 'label'
            ? 'medium'
            : 'normal',
    font: heading && family === 'brutalist' ? 'heading' : 'body',
    leading:
      shadcnHero && role === 'slogan'
        ? 'tighter'
        : shadcnHero && role === 'tagline'
          ? 'size'
          : role === 'slogan' || role === 'h1' || role === 'h2'
            ? 'tight'
            : role === 'h3' || role === 'h4' || role === 'h5'
              ? 'snug'
              : role === 'body' || role === 'tagline' || role === 'notice-title'
                ? 'relaxed'
                : 'normal',
    tracking:
      shadcnHero && role === 'slogan' && heroViewport === 'wide'
        ? 'tighter'
        : role === 'slogan' || role === 'h1' || role === 'h2'
          ? 'tight'
          : 'normal',
    emphasis: 'normal',
    decoration: 'none',
  };
}
