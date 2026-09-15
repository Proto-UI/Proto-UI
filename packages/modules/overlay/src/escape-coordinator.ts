/** Overlay policy owns arbitration; Event contributes only opaque input identity. */
const scopes = new WeakMap<object, Set<object>>();
const selections = new WeakMap<object, Map<object, { owner: object | null; delivered: boolean }>>();

export function joinEscapeScope(scope: object, owner: object): () => void {
  let owners = scopes.get(scope);
  if (!owners) {
    owners = new Set();
    scopes.set(scope, owners);
  }
  owners.add(owner);
  return () => {
    owners.delete(owner);
  };
}

export function ownsEscapeSample(scope: object, sample: object, owner: object): boolean {
  let byScope = selections.get(sample);
  if (!byScope) {
    byScope = new Map();
    selections.set(sample, byScope);
  }
  if (!byScope.has(scope)) {
    byScope.set(scope, {
      owner: Array.from(scopes.get(scope) ?? []).at(-1) ?? null,
      delivered: false,
    });
  }
  const selection = byScope.get(scope)!;
  if (selection.delivered || selection.owner !== owner) return false;
  selection.delivered = true;
  return true;
}
