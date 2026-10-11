import {
  createControlLabelRef,
  type AnatomyFamily,
  type ControlLabelAnatomyPair,
  type ControlLabelRef,
} from '@proto.ui/core';
/** Module-private identities. Domain lifetime is reference counted, never exposed through Context. */
const families = new WeakMap<
  AnatomyFamily,
  Map<unknown, Map<string, { ref: ControlLabelRef; count: number }>>
>();
export function acquireAnatomyControlLabelPair(
  pair: ControlLabelAnatomyPair,
  scope: unknown
): { ref: ControlLabelRef; dispose(): void } {
  let domains = families.get(pair.family);
  if (!domains) families.set(pair.family, (domains = new Map()));
  let entries = domains.get(scope);
  if (!entries) domains.set(scope, (entries = new Map()));
  const key = JSON.stringify([pair.labelRole, pair.targetRole]);
  let entry = entries.get(key);
  if (!entry) entries.set(key, (entry = { ref: createControlLabelRef(), count: 0 }));
  entry.count++;
  let active = true;
  return {
    ref: entry.ref,
    dispose() {
      if (!active) return;
      active = false;
      entry!.count--;
      if (!entry!.count && entries!.get(key) === entry) {
        entries!.delete(key);
        if (!entries!.size) domains!.delete(scope);
      }
    },
  };
}
export function validateAnatomyControlLabelPair(pair: ControlLabelAnatomyPair): void {
  if (
    !pair ||
    typeof pair !== 'object' ||
    Object.keys(pair).some((key) => !['family', 'labelRole', 'targetRole'].includes(key)) ||
    pair.family?.__brand !== 'AnatomyFamily' ||
    !pair.family.decl?.roles ||
    typeof pair.labelRole !== 'string' ||
    typeof pair.targetRole !== 'string' ||
    pair.labelRole === pair.targetRole ||
    !Object.hasOwn(pair.family.decl.roles, pair.labelRole) ||
    !Object.hasOwn(pair.family.decl.roles, pair.targetRole)
  )
    throw new TypeError(
      '[ControlLabel] anatomy pair requires one declared family and distinct declared label/target roles'
    );
}
