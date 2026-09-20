type Point = { x: number; y: number };
type Contact = {
  kind: string;
  point: Point;
  horizontal: boolean;
  vertical: boolean;
};
const contact = (kind: string, point: Point): Contact => ({
  kind,
  point,
  horizontal: false,
  vertical: false,
});
const move = (entry: Contact | undefined, point: Point) => {
  if (!entry || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
  // Touch/pen pans content directly; a mouse drags native scrollbar chrome.
  const sign = entry.kind === 'touch' || entry.kind === 'pen' ? 1 : -1;
  const dx = point.x - entry.point.x;
  const dy = point.y - entry.point.y;
  if (dx !== 0) entry.horizontal = dx * sign > 0;
  if (dy !== 0) entry.vertical = dy * sign > 0;
  entry.point = point;
};

/** Host-local contact ownership and directional evidence. No clock or portable state. */
export function createReaderContactSession() {
  const pointers = new Map<number, Contact>();
  const touches = new Map<number, Contact>();
  let nativeHandoff = false;
  const active = () => pointers.size > 0 || touches.size > 0;
  const settle = () => {
    if (touches.size === 0) {
      nativeHandoff = false;
    }
  };
  return {
    get active() {
      return active();
    },
    get phase(): 'idle' | 'contact' | 'native-pan' {
      return !active() ? 'idle' : nativeHandoff ? 'native-pan' : 'contact';
    },
    hasDeparture(axis: 'horizontal' | 'vertical') {
      return [...pointers.values(), ...touches.values()].some((entry) => entry[axis]);
    },
    clearMovement() {
      for (const entry of [...pointers.values(), ...touches.values()]) {
        entry.horizontal = false;
        entry.vertical = false;
      }
    },
    startPointer(id: number, kind: string, point: Point = { x: 0, y: 0 }) {
      pointers.set(id, contact(kind, point));
    },
    startTouches(ids: readonly number[], points: readonly Point[] = []) {
      for (const [index, id] of ids.entries()) {
        touches.set(id, contact('touch', points[index] ?? { x: 0, y: 0 }));
      }
    },
    movePointer(id: number, point: Point) {
      move(pointers.get(id), point);
    },
    moveTouch(id: number, point: Point) {
      move(touches.get(id), point);
    },
    finishPointer(id: number, canceled: boolean) {
      const entry = pointers.get(id);
      if (!pointers.delete(id)) return false;
      // Pointer routing can end while the same native touch session continues.
      // Cancellation alone never creates a new session or an expiring token.
      if (canceled && entry?.kind === 'touch' && touches.size > 0) {
        nativeHandoff = true;
        // Pointer and touch IDs cannot be paired reliably. Surviving TouchEvents
        // carry their own movement; never lend a canceled pointer's evidence.
      }
      settle();
      return true;
    },
    finishTouches(ids: readonly number[], remainingIds: readonly number[]) {
      let released = false;
      for (const id of ids) released = touches.delete(id) || released;
      const remaining = new Set(remainingIds);
      for (const id of touches.keys()) {
        if (!remaining.has(id)) released = touches.delete(id) || released;
      }
      if (!released) return false;
      // TouchEvent and PointerEvent identifiers are separate namespaces. Final
      // owned TouchEvent completion closes its touch-pointer aliases as well,
      // regardless of which cancellation stream the browser delivers first.
      if (touches.size === 0) {
        for (const [id, entry] of pointers) if (entry.kind === 'touch') pointers.delete(id);
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
