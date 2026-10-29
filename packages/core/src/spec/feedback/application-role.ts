import { isPlaceholderColorTokenV0 } from './placeholder';
/**
 * Core-owned Root role vocabulary. Internal effects resolve it before lowering;
 * author StyleHandle syntax and Template style remain token-only.
 */
export type TwTokenApplicationRole =
  | 'surface'
  | 'placement'
  | 'composite'
  | 'root-geometry'
  | 'root-participation'
  | 'hit-testing'
  | 'unresolved';

export type TwTokenApplicationRoleSource = 'canonical' | 'fallback' | 'unresolved';

export type TwTokenApplicationRoleResolution = Readonly<{
  token: string;
  role: TwTokenApplicationRole;
  roleSource: TwTokenApplicationRoleSource;
}>;

const COMPOSITE_DISPLAY_TOKENS = new Set([
  'block',
  'flex',
  'flow-root',
  'grid',
  'inline',
  'inline-block',
  'inline-flex',
  'inline-grid',
  'table',
  'table-row',
  'table-cell',
  'table-caption',
]);

// D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001-L: exact H1 admission, not a
// family-wide transform promise. Physical recipe support is checked separately.
const ROOT_GEOMETRY_TOKENS = new Set([
  'translate-y-px',
  'translate-x-0',
  // D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001-RESIDENT-SPACING: exact 1.25rem only.
  'translate-x-5',
  'translate-x-0.25',
  'translate-x-[calc(100%_-_2px)]',
  'translate-x-[calc(100%_+_2px)]',
  'translate-x-[calc(100%_-_8px)]',
  'scale-[0.98]',
  'will-change-transform',
  // K1 exact additions retain the independent Root geometry domain.
  '-translate-x-1/2',
  '-translate-y-1/2',
]);

const UNRESOLVED_EXACT_TOKENS = new Set([
  'collapse',
  'hidden',
  'invisible',
  'relative',
  'transform',
  'transform-gpu',
  'transform-none',
  'visible',
]);

const UNRESOLVED_PREFIXES = [
  'origin-',
  'overflow-',
  'overscroll-',
  'pointer-events-',
  'rotate-',
  'scale-',
  'skew-',
  'translate-',
  'will-change-',
] as const;

const PLACEMENT_EXACT_TOKENS = new Set([
  'absolute',
  'fixed',
  'grow',
  'shrink',
  'static',
  'sticky',
  'isolate',
  'float-right',
  'align-top',
  'align-middle',
  'align-bottom',
]);

const PLACEMENT_PREFIXES = [
  'aspect-',
  'basis-',
  'bottom-',
  'end-',
  'grow-',
  'h-',
  'inset-',
  'inset-x-',
  'inset-y-',
  'left-',
  'm-',
  'max-h-',
  'max-w-',
  'mb-',
  'me-',
  'min-h-',
  'min-w-',
  'ml-',
  'mr-',
  'ms-',
  'mt-',
  'mx-',
  'my-',
  'order-',
  'right-',
  'self-',
  'shrink-',
  'size-',
  'start-',
  'top-',
  'w-',
  'z-',
] as const;

const SURFACE_EXACT_TOKENS = new Set([
  'border',
  'capitalize',
  'lowercase',
  'normal-case',
  'outline',
  'peer',
  'rounded',
  'shadow',
  'underline',
  'uppercase',
]);

const SURFACE_PREFIXES = [
  'animate-',
  'backdrop-',
  'bg-',
  'border-',
  'content-',
  'cursor-',
  'decoration-',
  'delay-',
  'duration-',
  'ease-',
  'fade-',
  'flex-col',
  'flex-row',
  'flex-wrap',
  'font-',
  'gap-',
  'gap-x-',
  'gap-y-',
  'grid-cols-',
  'grid-flow-',
  'grid-rows-',
  'group/',
  'items-',
  'justify-',
  'leading-',
  'opacity-',
  'outline-',
  'p-',
  'pb-',
  'pe-',
  'pl-',
  'place-content-',
  'place-items-',
  'pr-',
  'ps-',
  'pt-',
  'px-',
  'py-',
  'ring-',
  'rounded-',
  'resize-',
  'select-',
  'shadow-',
  'slide-in-',
  'slide-out-',
  'space-x-',
  'space-y-',
  'text-',
  'touch-',
  'tracking-',
  'transition-',
  'underline-offset-',
  'whitespace-',
  'zoom-',
] as const;

function withoutNegativePrefix(token: string): string {
  return token.startsWith('-') ? token.slice(1) : token;
}

function startsWithAny(token: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => token.startsWith(prefix));
}

function isPlacementFlexItemToken(token: string): boolean {
  return /^flex-(?:1|auto|initial|none|\[)/.test(token);
}

function resolution(
  token: string,
  role: TwTokenApplicationRole,
  roleSource: TwTokenApplicationRoleSource
): TwTokenApplicationRoleResolution {
  return Object.freeze({ token, role, roleSource });
}

/**
 * Classify one already-valid author-side tw token without changing it.
 *
 * Unknown tokens intentionally fall back to surface while carrying fallback
 * provenance. Known ambiguous families remain unresolved until a later
 * semantic decision supplies enough evidence to classify them.
 */
export function classifyTwTokenApplicationRoleV0(token: string): TwTokenApplicationRoleResolution {
  if (token === 'scroll-my-1' || token === 'scroll-my-1.5')
    return resolution(token, 'placement', 'canonical');
  if (isPlaceholderColorTokenV0(token)) return resolution(token, 'surface', 'canonical');
  // I1 exact admission precedes negative normalization; no visibility family widening.
  if (token === 'hidden') return resolution(token, 'root-participation', 'canonical');
  if (token === 'relative') return resolution(token, 'root-geometry', 'canonical');
  // Check exact author tokens before normalizing negative prefixes; H1 does
  // not automatically admit negative, arbitrary, axis or other family variants.
  if (ROOT_GEOMETRY_TOKENS.has(token)) return resolution(token, 'root-geometry', 'canonical');
  if (token === 'pointer-events-none') return resolution(token, 'hit-testing', 'canonical');
  if (token === 'field-sizing-content' || token === 'field-sizing-fixed') {
    return resolution(token, 'surface', 'canonical');
  }
  const comparable = withoutNegativePrefix(token);

  if (UNRESOLVED_EXACT_TOKENS.has(comparable) || startsWithAny(comparable, UNRESOLVED_PREFIXES)) {
    return resolution(token, 'unresolved', 'unresolved');
  }

  if (COMPOSITE_DISPLAY_TOKENS.has(comparable)) {
    return resolution(token, 'composite', 'canonical');
  }

  if (
    PLACEMENT_EXACT_TOKENS.has(comparable) ||
    startsWithAny(comparable, PLACEMENT_PREFIXES) ||
    isPlacementFlexItemToken(comparable)
  ) {
    return resolution(token, 'placement', 'canonical');
  }

  if (SURFACE_EXACT_TOKENS.has(comparable) || startsWithAny(comparable, SURFACE_PREFIXES)) {
    return resolution(token, 'surface', 'canonical');
  }

  return resolution(token, 'surface', 'fallback');
}
