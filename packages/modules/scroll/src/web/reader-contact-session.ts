/** Host-local contact ownership. No clock, grace period, or portable state. */
export function createReaderContactSession() {
  const pointers = new Map<number, string>();
  const touches = new Set<number>();
  let nativeHandoff = false;
  const active = () => pointers.size > 0 || touches.size > 0;
  const settle = () => {
    if (!active()) nativeHandoff = false;
  };
  return {
    get active() {
      return active();
    },
    get phase(): 'idle' | 'contact' | 'native-pan' {
      return !active() ? 'idle' : nativeHandoff ? 'native-pan' : 'contact';
    },
    startPointer(id: number, kind: string) {
      pointers.set(id, kind);
    },
    startTouches(ids: readonly number[]) {
      for (const id of ids) touches.add(id);
    },
    finishPointer(id: number, canceled: boolean) {
      const kind = pointers.get(id);
      if (!pointers.delete(id)) return false;
      // Pointer routing can end while the same native touch session continues.
      // Cancellation alone never creates a new session or an expiring token.
      if (canceled && kind === 'touch' && touches.size > 0) nativeHandoff = true;
      settle();
      return true;
    },
    finishTouches(ids: readonly number[], remainingIds: readonly number[]) {
      let released = false;
      for (const id of ids) released = touches.delete(id) || released;
      const remaining = new Set(remainingIds);
      for (const id of touches) {
        if (!remaining.has(id)) released = touches.delete(id) || released;
      }
      if (!released) return false;
      // TouchEvent and PointerEvent identifiers are separate namespaces. Final
      // owned TouchEvent completion closes its touch-pointer aliases as well,
      // regardless of which cancellation stream the browser delivers first.
      if (touches.size === 0) {
        for (const [id, kind] of pointers) if (kind === 'touch') pointers.delete(id);
      }
      settle();
      return true;
    },
    reset() {
      pointers.clear();
      touches.clear();
      nativeHandoff = false;
    },
  };
}
