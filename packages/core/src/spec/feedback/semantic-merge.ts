import { isPlaceholderColorTokenV0 } from './placeholder';
// packages/core/src/spec/feedback/semantic-merge.ts

const PREFIXES_V0 = [
  // Color
  'bg-',

  // Spacing
  'p-',
  'px-',
  'py-',
  'pt-',
  'pr-',
  'pb-',
  'pl-',
  'm-',
  'mx-',
  'my-',
  'mt-',
  'mr-',
  'mb-',
  'ml-',

  // Sizing
  'w-',
  'h-',
  'min-w-',
  'min-h-',
  'max-w-',
  'max-h-',

  // Layout
  'justify-',
  'items-',
  'content-',

  // Effects
  'opacity-',
  'shadow-',
  'tracking-',
  'transition-',
  'rounded',
] as const;

const TEXT_SIZE_TOKENS = new Set([
  'xs',
  'sm',
  'base',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
  '6xl',
  '7xl',
  '8xl',
  '9xl',
]);

const TEXT_ALIGN_TOKENS = new Set(['left', 'right', 'center', 'justify', 'start', 'end']);

export function getSemanticGroupKeyV0(token: string): string {
  if (token === '-mx-4') return 'mx-';
  if (token === '-mb-4') return 'mb-';
  if (token === 'ease-linear' || token === 'ease-in-out') return 'transition timing';
  if (token === 'box-border' || token === 'box-content') return 'box sizing';
  if (token === 'float-left' || token === 'float-right') return 'float placement';
  if (token === 'text-balance') return 'text wrapping';
  if (/^font-(normal|medium|semibold|bold|black|\[100\])$/.test(token)) return 'font weight';
  if (token === 'border-collapse' || token === 'border-separate') return 'table border model';
  if (token === 'border-spacing-0') return 'table border spacing';
  if (token === 'caption-bottom') return 'table caption side';
  if (token === 'align-top' || token === 'align-middle' || token === 'align-bottom')
    return 'vertical alignment';
  const roundedSide = token.match(/^rounded-([trbl])-/);
  if (roundedSide) return `rounded-${roundedSide[1]}-`;
  if (token === 'scroll-py-1' || token === 'scroll-py-1.5') return 'finite scroll padding block';
  if (token === 'scroll-my-1' || token === 'scroll-my-1.5') return 'finite scroll margin block';
  if (isPlaceholderColorTokenV0(token)) return 'placeholder:text-color';
  if (/^(?:-z-(?:1|10)|z-(?:10|40|50|\[(?:2|1000|1051)\]))$/.test(token)) return 'finite z index';
  if (token === 'backdrop-blur-xs' || token === 'backdrop-filter-[blur(40px)_saturate(1.5)]')
    return 'complete backdrop filter';
  // Keep allowlisted selector targets isolated from the element's ordinary
  // style groups, while still resolving conflicts within the target by the
  // underlying utility (for example selection:bg-* is last-wins separately
  // from both selection:text-* and bg-*).
  const selectionPrefix = 'selection:';
  if (token.startsWith(selectionPrefix)) {
    return `${selectionPrefix}${getSemanticGroupKeyV0(token.slice(selectionPrefix.length))}`;
  }

  if (token === 'resize-y' || token === 'resize-none') return 'field resize affordance';
  if (token === 'field-sizing-content' || token === 'field-sizing-fixed') {
    return 'field intrinsic sizing';
  }

  const translateAxis = token.match(/^-?translate-([xy])-/);
  if (translateAxis) return `translate-${translateAxis[1]}-`;

  // One content-selection affordance per subject. This is independent of
  // selection:* paint and never owns a selection range or control state.
  if (token === 'select-auto' || token === 'select-text' || token === 'select-none') {
    // Whitespace cannot occur in an admitted token, so an unknown token can
    // never collide with this internal group (for example `user-select`).
    return 'content-selection affordance';
  }

  if (
    token === 'flex' ||
    token === 'inline-flex' ||
    token === 'block' ||
    token === 'inline-block' ||
    token === 'table' ||
    token === 'table-row' ||
    token === 'table-cell' ||
    token === 'table-caption'
  ) {
    return 'display';
  }
  if (
    token === 'flex-row' ||
    token === 'flex-row-reverse' ||
    token === 'flex-col' ||
    token === 'flex-col-reverse'
  ) {
    return 'flex-direction';
  }
  if (
    token === 'border' ||
    token === 'border-0' ||
    token === 'border-2' ||
    token === 'border-[3px]' ||
    token === 'border-4' ||
    token === 'border-8'
  ) {
    return 'border-width';
  }
  const directionalBorderWidth = token.match(/^border-([trblxy])(?:-(0|2|4|8))?$/);
  if (directionalBorderWidth) {
    return `border-${directionalBorderWidth[1]}-width`;
  }
  if (token.startsWith('border-b-')) return 'border-b-color';
  if (token.startsWith('border-')) {
    return 'border-color';
  }
  if (token.startsWith('bg-clip-')) return 'bg-clip-';
  if (token.startsWith('text-')) {
    const suffix = token.slice('text-'.length);
    if (TEXT_ALIGN_TOKENS.has(suffix)) return 'text-align';
    if (/^\[#[0-9a-fA-F]+\]$/.test(suffix)) return 'text-color';
    if (TEXT_SIZE_TOKENS.has(suffix) || suffix.startsWith('[')) return 'text-size';
    return 'text-color';
  }
  for (const p of PREFIXES_V0) {
    if (token.startsWith(p)) return p;
  }
  // fallback grouping: token itself
  return token;
}

/**
 * Semantic merge for tw tokens (v0).
 *
 * - group by prefix matching (conservative list)
 * - last-wins within group
 * - output order by first occurrence of each group
 */
export function mergeTwTokensV0(tokens: string[]): { tokens: string[] } {
  const groupOrder: string[] = [];
  const seen = new Set<string>();
  const lastByGroup = new Map<string, string>();

  for (const t of tokens) {
    const g = getSemanticGroupKeyV0(t);

    if (!seen.has(g)) {
      seen.add(g);
      groupOrder.push(g);
    }
    // last-wins
    lastByGroup.set(g, t);
  }

  const out: string[] = [];
  for (const g of groupOrder) {
    const v = lastByGroup.get(g);
    if (v) out.push(v);
  }

  return { tokens: out };
}
