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

export function getSemanticGroupKeyV0(token: string): string {
  if (
    token === 'flex' ||
    token === 'inline-flex' ||
    token === 'block' ||
    token === 'inline-block'
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
    token === 'border-4' ||
    token === 'border-8'
  ) {
    return 'border-width';
  }
  const directionalBorderWidth = token.match(/^border-([trblxy])(?:-(0|2|4|8))?$/);
  if (directionalBorderWidth) {
    return `border-${directionalBorderWidth[1]}-width`;
  }
  if (token.startsWith('border-')) {
    return 'border-color';
  }
  if (token.startsWith('bg-clip-')) return 'bg-clip-';
  if (token.startsWith('text-')) {
    const suffix = token.slice('text-'.length);
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
