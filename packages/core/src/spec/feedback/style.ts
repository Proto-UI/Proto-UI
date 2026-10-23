// packages/core/src/spec/feedback/style.ts

/**
 * Style handle (v0)
 * - Only supports Tailwind-flavored tokens
 * - Keep as IR; adapters decide how to realize it.
 */
export type StyleHandle = { kind: 'tw'; tokens: string[] };

export type TemplateStyleHandle = StyleHandle;

/**
 * Create a Tailwind-style handle.
 *
 * Supported forms:
 * - tw("a b c")
 * - tw("a", "b", "c")
 */
export function tw(tokens: string, ...more: string[]): StyleHandle {
  const all = [tokens, ...more].join(' ').trim();
  const list = all ? all.split(/\s+/g) : [];
  return { kind: 'tw', tokens: list };
}

export function isTemplateStyleHandle(v: any): v is StyleHandle {
  return (
    v &&
    typeof v === 'object' &&
    v.kind === 'tw' &&
    Array.isArray(v.tokens) &&
    v.tokens.every((x: any) => typeof x === 'string')
  );
}

/** Draft owned-decoration identity. Only the declaring instance can bind/use it. */
declare const ownedDecorationBrand: unique symbol;
export type OwnedDecorationTarget = { readonly [ownedDecorationBrand]: true };
export type DecorationStyleFrame = Readonly<{
  target: OwnedDecorationTarget;
  handles: readonly StyleHandle[];
}>;
