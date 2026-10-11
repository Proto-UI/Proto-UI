/** Diagnostic driver only. Observed DOM order is a boundary hint, never a
 * replacement implementation of the browser's sequential focus algorithm. */
export interface HeaderKeyboardSnapshot {
  documentHasFocus: boolean;
  selectionRangeCount: number;
  focused: boolean;
  active: {
    nodeId: number;
    tag: string;
    inHeader: boolean;
    precedesHeader: boolean;
  } | null;
  target: {
    tabIndex: number;
    checkVisibility: boolean | null;
    disabled: boolean;
    blockedByClosedDetails: boolean;
    hiddenOrInert: boolean;
    rect: { width: number; height: number };
    css: { display: string; visibility: string; opacity: string };
  };
}

export async function acquireHeaderKeyboardFocus(
  read: () => Promise<HeaderKeyboardSnapshot>,
  pressTab: () => Promise<void>
): Promise<number> {
  const initial = await read();
  if (
    !initial.documentHasFocus ||
    initial.active?.tag !== 'body' ||
    initial.selectionRangeCount !== 0
  )
    throw new Error(
      'Keyboard setup requires a focused fresh document with body active and no Selection'
    );
  const target = initial.target;
  if (
    target.tabIndex < 0 ||
    target.checkVisibility === false ||
    target.disabled ||
    target.blockedByClosedDetails ||
    target.hiddenOrInert ||
    target.rect.width <= 0 ||
    target.rect.height <= 0 ||
    target.css.display === 'none' ||
    target.css.visibility !== 'visible' ||
    Number(target.css.opacity) === 0
  )
    throw new Error('The intended Header target lacks visible sequential-focus prerequisites');
  const seen = new Set([initial.active.nodeId]);
  // The shipped prefix is SkipLink, brand, three navigation anchors, summary.
  // Eight presses bound this short Header journey, not a whole-page search.
  // Stop sooner on repetition or after leaving that prefix; never expand the
  // search to hundreds of sidebar links or correct focus programmatically.
  for (let step = 1; step <= 8; step++) {
    await pressTab();
    const current = await read();
    if (!current.documentHasFocus)
      throw new Error('Native Tab left document focus during Header acquisition');
    if (current.focused) return step;
    const active = current.active;
    if (!active || seen.has(active.nodeId))
      throw new Error('Native Tab repeated a focus owner before reaching the Header target');
    if (!active.inHeader && !active.precedesHeader)
      throw new Error('Native Tab passed the Header prefix without reaching its target');
    seen.add(active.nodeId);
  }
  throw new Error('Native Tab did not reach the Header target within its eight-step prefix');
}
