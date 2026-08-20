// Canonical source for lowered variant identity. Copied verbatim into
// packages/modules/rule-expose-state-web and packages/cli by
// scripts/styles/generate-lowered-variant-order.ts, because the runtime writes
// the class onto the host while the CLI writes the stylesheet ahead of time and
// `data-pui-style~="…"` matches whole words. Neither package can import the
// other: the module is published with the runtime, the CLI ships with only
// prompts and typescript.

const LOWERED_VARIANT_RANK = ['dark', 'hover', 'active', 'focus', 'focus-visible', 'disabled'];

export function compareLoweredVariants(a: string, b: string): number {
  const ai = LOWERED_VARIANT_RANK.indexOf(a);
  const bi = LOWERED_VARIANT_RANK.indexOf(b);
  if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  return a.localeCompare(b);
}

/**
 * One condition lowered twice, or two handles lowering to the same variant,
 * must not become two segments on one side and one on the other.
 */
export function canonicalizeLoweredVariants(variants: readonly string[]): string[] {
  return Array.from(new Set(variants)).sort(compareLoweredVariants);
}
