/**
 * Internal allocation policy shared by every publisher of this Anatomy family.
 * A new allocator is only used by deterministic exhaustion tests, never per part.
 */
export function createHoverCardInteractionIdAllocator(lastId = 0): () => number {
  if (!Number.isSafeInteger(lastId) || lastId < 0) {
    throw new Error('[HoverCard] invalid interaction identity allocator seed');
  }
  return () => {
    if (lastId === Number.MAX_SAFE_INTEGER) {
      throw new Error('[HoverCard] interaction identity allocation exhausted');
    }
    return ++lastId;
  };
}

// Stronger than Root/part lifetime uniqueness: no publisher of this module's
// Context/Anatomy family reuses an identity, including across Root replacement.
export const allocateHoverCardInteractionId = createHoverCardInteractionIdAllocator();
