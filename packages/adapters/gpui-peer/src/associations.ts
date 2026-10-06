import { createControlLabelRef, type InstanceAssociations } from '@proto.ui/core';

/** Keys are local to one renderer process; empty/foreign JSON is never a ref. */
export function createAssociationLedger() {
  const keys = new Map<
    string,
    { ref: NonNullable<InstanceAssociations['controlLabel']>; users: number }
  >();
  const sessions = new Map<string, string>();
  const release = (sessionId: string) => {
    const key = sessions.get(sessionId);
    if (key === undefined) return;
    sessions.delete(sessionId);
    const entry = keys.get(key)!;
    if (--entry.users === 0) keys.delete(key);
  };
  return {
    apply(sessionId: string, input: unknown, commit: (value: InstanceAssociations) => void) {
      if (
        !input ||
        typeof input !== 'object' ||
        Array.isArray(input) ||
        Object.getPrototypeOf(input) !== Object.prototype ||
        Object.getOwnPropertySymbols(input).length
      )
        throw new TypeError('instance.associations requires a bounded record');
      for (const key of Object.keys(input))
        if (key !== 'controlLabel') throw new TypeError(`unknown instance association: ${key}`);
      const key = (input as { controlLabel?: unknown }).controlLabel;
      if (key != null && (typeof key !== 'string' || !/^[A-Za-z0-9:._-]{1,128}$/.test(key)))
        throw new TypeError('controlLabel requires a bounded renderer key');
      const next = key == null ? undefined : (key as string);
      const previous = sessions.get(sessionId);
      if (next === previous) {
        commit({ controlLabel: next === undefined ? null : keys.get(next)!.ref });
        return;
      }
      // Do not release the previous ref until Runtime accepts the replacement.
      // A rejected undeclared recipient cannot steal or leak a binding.
      const existing = next === undefined ? undefined : keys.get(next);
      const entry =
        next === undefined ? undefined : (existing ?? { ref: createControlLabelRef(), users: 0 });
      commit({ controlLabel: entry?.ref ?? null });
      release(sessionId);
      if (next !== undefined && entry) {
        entry.users += 1;
        keys.set(next, entry);
        sessions.set(sessionId, next);
      }
    },
    release,
    size: () => keys.size,
  };
}
