import type { ProjectionFamilyId } from '../PrototypePreviewer/projection-families';

/**
 * The public intent a homepage control expresses, independent of how each
 * family names its own Button variants. Every family declares a different
 * finite variant vocabulary, so a name that one family accepts is invalid for
 * another and silently falls back to that family's declared default.
 *
 * - Shadcn: `default` / `outline` / `destructive`
 * - Brutalist: `solid` / `surface` / `destructive`
 * - Bootstrap 2.3.2: `default` / `primary` / `danger` and the other hue names
 * - Liquid Glass: `regular` / `prominent`
 */
export type HomepageButtonIntent = 'primary' | 'secondary' | 'danger';

const VARIANT_BY_FAMILY: Readonly<
  Record<ProjectionFamilyId, Readonly<Record<HomepageButtonIntent, string>>>
> = {
  shadcn: { primary: 'default', secondary: 'outline', danger: 'destructive' },
  brutalist: { primary: 'solid', secondary: 'surface', danger: 'destructive' },
  'bootstrap-2-3-2': { primary: 'primary', secondary: 'default', danger: 'danger' },
  'liquid-glass': { primary: 'prominent', secondary: 'regular', danger: 'regular' },
};

/** The variant name this family actually declares for the requested intent. */
export function homepageButtonVariant(
  family: ProjectionFamilyId,
  intent: HomepageButtonIntent
): string {
  return VARIANT_BY_FAMILY[family][intent];
}
