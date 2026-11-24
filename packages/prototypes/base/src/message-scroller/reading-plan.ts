/** Host measurements and opaque identities; no DOM or application message model. */
export type MessageReadingEntry = {
  key: string;
  start: number;
  end: number;
  primary: boolean;
};

export type MessageReadingFrame = {
  epoch: number;
  scrollOffset: number;
  viewportSize: number;
  entries: MessageReadingEntry[];
};

export type MessageReadingAnchor = {
  key: string;
  previousKey: string;
  index: number;
  offset: number;
  scrollOffset: number;
};

export type MessageReadingCapture = 'first-crossing' | 'visible-preferred';
export type MessageReadingPolicy = {
  capture: MessageReadingCapture;
  inset: number;
  predecessor: boolean;
};

export type MessageReadingResolvedAnchor = { key: string; index: number };
export type MessageReadingRestorePlan = {
  kind: 'none' | 'by';
  match: 'none' | 'exact' | 'previous' | 'offset';
  delta: number;
};

export type MessageReadingSelection = {
  key: string;
  start: number;
  end: number;
  prefixHash: string;
};

export type MessageReadingSelectionFacts = {
  epoch: number;
  record: MessageReadingSelection | null;
  currentKey: string;
  textLength: number;
  prefixMatches: boolean;
  selectionAvailable: boolean;
  collapsed: boolean;
  endpointsAvailable: boolean;
};

export type MessageReadingInput = {
  kind: 'wheel' | 'key' | 'pointer' | 'focus' | 'selection' | 'backfill';
  interactive: boolean;
  inside: boolean;
  active: boolean;
  selection: MessageReadingSelection | null;
};

/**
 * An ordered visible primary wins over a visible fallback. First-crossing
 * mode deliberately has no viewport-bottom cutoff: a short/empty entry may
 * be followed by the next readable row just below the current viewport.
 */
export function captureMessageReadingAnchor(
  frame: MessageReadingFrame,
  policy: MessageReadingPolicy
): MessageReadingAnchor {
  let selected = -1;
  for (let index = 0; index < frame.entries.length; index += 1) {
    const entry = frame.entries[index];
    if (entry && entry.key && entry.end > policy.inset) {
      if (policy.capture === 'first-crossing') {
        if (selected < 0) selected = index;
      } else if (frame.viewportSize > 0 && entry.end > 0 && entry.start < frame.viewportSize) {
        if (selected < 0 || (!frame.entries[selected]?.primary && entry.primary)) selected = index;
      }
    }
  }
  const entry = frame.entries[selected];
  if (!entry) {
    return { key: '', previousKey: '', index: -1, offset: 0, scrollOffset: frame.scrollOffset };
  }
  return {
    key: entry.key,
    previousKey: selected > 0 ? (frame.entries[selected - 1]?.key ?? '') : '',
    index: selected,
    offset: entry.start,
    scrollOffset: frame.scrollOffset,
  };
}

/** Resolve identities only; an index never invents a replacement identity. */
export function resolveMessageReadingAnchor(
  anchor: MessageReadingAnchor | null,
  keys: string[],
  predecessor: boolean
): MessageReadingResolvedAnchor | null {
  if (!anchor) return null;
  let exact = -1;
  let previous = -1;
  for (let index = 0; index < keys.length; index += 1) {
    if (exact < 0 && keys[index] === anchor.key) exact = index;
    if (previous < 0 && keys[index] === anchor.previousKey) previous = index;
  }
  if (anchor.key && exact >= 0) return { key: anchor.key, index: exact };
  if (predecessor && anchor.previousKey && previous >= 0)
    return { key: anchor.previousKey, index: previous };
  return null;
}

/** Position commands are relative; the shared host owns clamping and timing. */
export function planMessageReadingRestore(
  anchor: MessageReadingAnchor | null,
  frame: MessageReadingFrame,
  predecessor: boolean
): MessageReadingRestorePlan {
  if (!anchor) return { kind: 'none', match: 'none', delta: 0 };
  const keys = frame.entries.map((entry) => entry.key);
  const target = resolveMessageReadingAnchor(anchor, keys, predecessor);
  if (target) {
    const entry = frame.entries[target.index];
    if (entry)
      return {
        kind: 'by',
        match: target.key === anchor.key ? 'exact' : 'previous',
        delta: entry.start - anchor.offset,
      };
  }
  return { kind: 'by', match: 'offset', delta: anchor.scrollOffset - frame.scrollOffset };
}

export function sameMessageReadingSelection(
  left: MessageReadingSelection | null,
  right: MessageReadingSelection | null
): boolean {
  return (
    left !== null &&
    right !== null &&
    left.key === right.key &&
    left.start === right.start &&
    left.end === right.end &&
    left.prefixHash === right.prefixHash
  );
}

/** The host supplies a fingerprint comparison, never an invented text match. */
export function messageSelectionRestoreEligible(facts: MessageReadingSelectionFacts): boolean {
  const record = facts.record;
  return (
    record !== null &&
    record.key.length > 0 &&
    record.key === facts.currentKey &&
    record.start >= 0 &&
    record.end > record.start &&
    facts.textLength >= record.end &&
    facts.prefixMatches &&
    facts.selectionAvailable &&
    facts.collapsed &&
    facts.endpointsAvailable
  );
}
