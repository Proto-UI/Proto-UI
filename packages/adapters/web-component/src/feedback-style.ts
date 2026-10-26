import { mergeTwTokensV0 } from '@proto.ui/core';

const KEY = '__proto_ui_applied_style_tokens_v0__';
export const PUI_STYLE_ATTR = 'data-pui-style';
const SETUP_STYLE_SOURCE = Symbol('proto-ui.setup-style');
type HostTokenOwnership = {
  owners: Map<unknown, Set<string>>;
  external: Set<string>;
};
const ownedTokensByHost = new WeakMap<HTMLElement, HostTokenOwnership>();

/**
 * v0 compatibility helper: map style tokens onto the Proto UI style attribute.
 */
export function applyStyleTokensToHost(el: HTMLElement, tokens: string[]) {
  const merged = mergeTwTokensV0(tokens).tokens;
  (el as any)[KEY] = merged;
  applyOwnedStyleTokens(el, SETUP_STYLE_SOURCE, merged);
}

export function applyFeedbackStyleTokensToHost(el: HTMLElement, tokens: string[]): () => void {
  const source = Symbol('proto-ui.feedback-style');
  applyOwnedStyleTokens(el, source, tokens);

  return () => {
    clearOwnedStyleTokens(el, source);
  };
}

export type OwnedTokenApplier = {
  /**
   * Replace adapter-owned tokens on host element.
   * - does not touch non-owned classes
   * - stable, idempotent
   */
  apply(nextTokens: string[]): void;

  /** Remove all owned tokens from host */
  clear(): void;

  /** For tests / debugging */
  getOwned(): ReadonlySet<string>;
};

/**
 * Create an applier that manages adapter-owned Proto UI style tokens on host element.
 *
 * Contract:
 * - Only operates on owned tokens it previously applied
 * - Never removes user classes
 * - `apply([])` removes all previously owned tokens
 */
export function createOwnedTwTokenApplier(
  host: HTMLElement,
  hooks: { onChange?: () => void } = {}
): OwnedTokenApplier {
  const source = Symbol('proto-ui.owned-style');
  let owned = new Set<string>();

  const apply = (nextTokens: string[]) => {
    const nextList = normalizeTokens(nextTokens);
    const nextSet = new Set<string>(nextList);

    applyOwnedStyleTokens(host, source, nextList);
    owned = nextSet;
    hooks.onChange?.();
  };

  const clear = () => {
    clearOwnedStyleTokens(host, source);
    owned = new Set<string>();
    hooks.onChange?.();
  };

  const getOwned = () => owned;

  return { apply, clear, getOwned };
}

function normalizeTokens(tokens: readonly string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const normalized = (token ?? '').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function setStyleAttribute(el: HTMLElement, tokens: readonly string[]) {
  if (tokens.length > 0) {
    el.setAttribute(PUI_STYLE_ATTR, tokens.join(' '));
  } else {
    el.removeAttribute(PUI_STYLE_ATTR);
  }
}

function applyOwnedStyleTokens(el: HTMLElement, source: unknown, tokens: readonly string[]) {
  const ownership = ownedTokensByHost.get(el) ?? {
    owners: new Map<unknown, Set<string>>(),
    external: new Set<string>(),
  };
  const { owners } = ownership;
  const previouslyOwned = collectOwnedTokens(owners);
  const normalized = new Set(normalizeTokens(tokens));
  if (normalized.size > 0) owners.set(source, normalized);
  else owners.delete(source);
  ownedTokensByHost.set(el, ownership);
  rewriteStyleAttribute(el, ownership, previouslyOwned);
  if (owners.size === 0) ownedTokensByHost.delete(el);
}

function clearOwnedStyleTokens(el: HTMLElement, source: unknown) {
  const ownership = ownedTokensByHost.get(el);
  if (!ownership) return;
  const { owners } = ownership;
  const previouslyOwned = collectOwnedTokens(owners);
  owners.delete(source);
  rewriteStyleAttribute(el, ownership, previouslyOwned);
  if (owners.size === 0) ownedTokensByHost.delete(el);
}

function collectOwnedTokens(owners: Map<unknown, Set<string>>) {
  const out = new Set<string>();
  for (const tokens of owners.values()) {
    for (const token of tokens) out.add(token);
  }
  return out;
}

function rewriteStyleAttribute(
  el: HTMLElement,
  ownership: HostTokenOwnership,
  previouslyOwned: ReadonlySet<string>
) {
  const current = normalizeTokens((el.getAttribute(PUI_STYLE_ATTR) ?? '').split(/\s+/));
  const external = current.filter(
    (token) => !previouslyOwned.has(token) || ownership.external.has(token)
  );
  // An overlapping adapter contribution does not acquire an external token.
  // Reconcile against the current attribute so external removals stay removed.
  ownership.external.clear();
  for (const token of external) ownership.external.add(token);
  const next = [...external];
  const seen = new Set(next);

  for (const tokens of ownership.owners.values()) {
    for (const token of tokens) {
      if (seen.has(token)) continue;
      seen.add(token);
      next.push(token);
    }
  }

  setStyleAttribute(el, next);
}
