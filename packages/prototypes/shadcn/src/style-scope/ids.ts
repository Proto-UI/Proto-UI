/** P-SHADCN-STYLE-SCOPE: draft selection transport, not style parity. */
export const SHADCN_STYLE_IDS = [
  'vega',
  'nova',
  'maia',
  'lyra',
  'mira',
  'luma',
  'sera',
  'rhea',
  'new-york-v4',
] as const;
export type ShadcnStyleId = (typeof SHADCN_STYLE_IDS)[number];
