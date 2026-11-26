/** Test-owned observation of a real Close click and the current public opener.
 * This code never focuses an element or changes projection/readiness state. */
export const SEARCH_CLOSE_FOCUS_BUDGET_MS = 1000;

type Coordinates = { owner: string; generation: string };
type FocusOwners = {
  openerCurrent: boolean;
  dialogCurrent: boolean;
  focused: boolean;
  deepActive: {
    tag: string;
    ref: string | null;
    owner: string | null;
    generation: string | null;
  } | null;
};

export type SearchCloseFocusReceipt = {
  timeOrigin: number;
  budgetMs: number;
  expected: { opener: Coordinates; dialog: Coordinates };
  clickedAt: number | null;
  clickObservedAt: number | null;
  clickedTrusted: boolean;
  clickOwners: FocusOwners | null;
  focusedAt: number | null;
  focusObservedAt: number | null;
  focusedTrusted: boolean;
  focusOwners: FocusOwners | null;
  readAt: number;
  readOwners: FocusOwners;
  disposed: boolean;
};

/** Serialized into the page with actual ElementHandles, before the unchanged
 * Playwright Close click. All helpers are local to this function. Opener and
 * Dialog generations belong to independent controllers; pin both identities. */
export function installSearchCloseFocusReceipt({
  trigger,
  close,
  panel,
  dialog,
}: {
  trigger: Element;
  close: Element;
  panel: Element;
  dialog: Coordinates;
}): { read(): Promise<SearchCloseFocusReceipt>; dispose(): void } {
  if (
    !(trigger instanceof HTMLElement) ||
    !(close instanceof HTMLElement) ||
    !(panel instanceof HTMLElement)
  )
    throw new Error('Search Close observation requires actual public HTML controls');
  const doc = trigger.ownerDocument;
  const view = doc.defaultView;
  const root = trigger.closest<HTMLElement>('site-search');
  const openerHost = trigger.closest<HTMLElement>('[data-projection-generation-host]');
  const dialogMount = root?.querySelector<HTMLElement>('[data-search-dialog-mount]');
  const activeDialogHosts = () =>
    [
      ...(dialogMount?.querySelectorAll<HTMLElement>('[data-projection-generation-host]') ?? []),
    ].filter((host) => host.dataset.projectionGenerationState === 'active');
  const initialDialogHosts = activeDialogHosts();
  const dialogHost = initialDialogHosts.length === 1 ? initialDialogHosts[0] : null;
  const opener = {
    owner: trigger.dataset.projectionOwner ?? '',
    generation: trigger.dataset.projectionGeneration ?? '',
  };
  if (
    !view ||
    !root ||
    !openerHost ||
    !dialogMount ||
    !dialogHost ||
    !opener.owner ||
    !opener.generation
  )
    throw new Error('Missing committed Search Close/opener owners');
  const sameCoordinates = (element: HTMLElement, expected: Coordinates) =>
    element.dataset.projectionOwner === expected.owner &&
    element.dataset.projectionGeneration === expected.generation;
  const deepActiveElement = (): Element | null => {
    let active = doc.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active;
  };
  const composedContains = (owner: Element, active: Element | null) => {
    for (let element = active; element; ) {
      if (element === owner) return true;
      const tree = element.getRootNode();
      element =
        element.assignedSlot ??
        element.parentElement ??
        (tree instanceof ShadowRoot ? tree.host : null);
    }
    return false;
  };
  const snapshot = (): FocusOwners => {
    const active = deepActiveElement();
    const currentDialogHosts = activeDialogHosts();
    const currentTriggers = root.querySelectorAll<HTMLElement>(
      '[data-projection-generation-state="active"] [data-open-modal]'
    );
    return {
      openerCurrent:
        root.isConnected &&
        trigger.isConnected &&
        trigger.ownerDocument === doc &&
        currentTriggers.length === 1 &&
        currentTriggers[0] === trigger &&
        trigger.closest('[data-projection-generation-host]') === openerHost &&
        openerHost.dataset.projectionGenerationState === 'active' &&
        openerHost.dataset.projectionOwnerHost === opener.owner &&
        openerHost.dataset.projectionGenerationHost === opener.generation &&
        root.dataset.searchGeneration === opener.generation &&
        sameCoordinates(trigger, opener),
      dialogCurrent:
        close.isConnected &&
        panel.isConnected &&
        close.ownerDocument === doc &&
        panel.ownerDocument === doc &&
        root.querySelector('[data-search-dialog-mount]') === dialogMount &&
        dialogMount.dataset.projectionOwner === dialog.owner &&
        currentDialogHosts.length === 1 &&
        currentDialogHosts[0] === dialogHost &&
        dialogHost.dataset.projectionOwnerHost === dialog.owner &&
        dialogHost.dataset.projectionGenerationHost === dialog.generation &&
        sameCoordinates(close, dialog) &&
        sameCoordinates(panel, dialog) &&
        close.dataset.demoRef === 'close' &&
        panel.dataset.demoRef === 'panel' &&
        composedContains(panel, close),
      focused: composedContains(trigger, active),
      deepActive: active
        ? {
            tag: active.localName,
            ref: active.getAttribute('data-demo-ref'),
            owner: active.getAttribute('data-projection-owner'),
            generation: active.getAttribute('data-projection-generation'),
          }
        : null,
    };
  };
  const initial = snapshot();
  if (!initial.openerCurrent || !initial.dialogCurrent)
    throw new Error('Search Close observation requires the exact current committed owners');

  // This literal is local because Playwright serializes the function. The
  // host verdict independently enforces the same original 1000 ms budget.
  const budgetMs = 1000;
  let clickedAt: number | null = null;
  let clickObservedAt: number | null = null;
  let clickOwners: FocusOwners | null = null;
  let focusedAt: number | null = null;
  let focusObservedAt: number | null = null;
  let focusOwners: FocusOwners | null = null;
  let clickedTrusted = false;
  let focusedTrusted = false;
  let disposed = false;
  let timer: number | undefined;
  let settle!: () => void;
  const settled = new Promise<void>((resolve) => {
    settle = resolve;
  });
  const click = (event: Event) => {
    if (clickedAt !== null || !event.isTrusted || !event.composedPath().includes(close)) return;
    clickedAt = event.timeStamp;
    clickObservedAt = view.performance.now();
    clickedTrusted = event.isTrusted;
    clickOwners = snapshot();
    if (!clickOwners.openerCurrent || !clickOwners.dialogCurrent) settle();
    timer = view.setTimeout(settle, Math.max(0, clickedAt + budgetMs - view.performance.now()));
  };
  const focus = (event: Event) => {
    if (
      clickedAt === null ||
      focusedAt !== null ||
      !event.isTrusted ||
      !event.composedPath().includes(trigger)
    )
      return;
    const owners = snapshot();
    // A focus event alone is insufficient: inspect the actual deep active
    // element and both still-current committed owners at this delivery.
    if (!owners.focused || !owners.openerCurrent || !owners.dialogCurrent) return;
    focusedAt = event.timeStamp;
    focusObservedAt = view.performance.now();
    focusedTrusted = event.isTrusted;
    focusOwners = owners;
    settle();
  };
  doc.addEventListener('click', click, true);
  doc.addEventListener('focusin', focus, true);
  return {
    async read() {
      if (clickedAt !== null && view.performance.now() < clickedAt + budgetMs) await settled;
      return {
        timeOrigin: view.performance.timeOrigin,
        budgetMs,
        expected: { opener, dialog },
        clickedAt,
        clickObservedAt,
        clickedTrusted,
        clickOwners,
        focusedAt,
        focusObservedAt,
        focusedTrusted,
        focusOwners,
        readAt: view.performance.now(),
        readOwners: snapshot(),
        disposed,
      };
    },
    dispose() {
      disposed = true;
      doc.removeEventListener('click', click, true);
      doc.removeEventListener('focusin', focus, true);
      if (timer !== undefined) view.clearTimeout(timer);
      settle();
    },
  };
}

export function judgeSearchCloseFocus(receipt: SearchCloseFocusReceipt | null): {
  ok: boolean;
  reason: string;
  restoredInMs: number | null;
} {
  const fail = (reason: string, restoredInMs: number | null = null) => ({
    ok: false,
    reason,
    restoredInMs,
  });
  if (!receipt) return fail('receipt-unavailable');
  if (receipt.disposed) return fail('observer-disposed');
  if (receipt.budgetMs !== SEARCH_CLOSE_FOCUS_BUDGET_MS) return fail('wrong-budget');
  if (!receipt.clickedTrusted || receipt.clickedAt === null) return fail('missing-trusted-close');
  if (!receipt.clickOwners?.openerCurrent || !receipt.clickOwners.dialogCurrent)
    return fail('stale-close-owner');
  if (!receipt.focusedTrusted || receipt.focusedAt === null) return fail('missing-trusted-focus');
  if (
    ![
      receipt.clickedAt,
      receipt.focusedAt,
      receipt.clickObservedAt,
      receipt.focusObservedAt,
      receipt.readAt,
    ].every((value) => typeof value === 'number' && Number.isFinite(value))
  )
    return fail('invalid-page-clock');
  const restoredInMs = receipt.focusedAt - receipt.clickedAt;
  if (
    restoredInMs < 0 ||
    receipt.clickObservedAt! < receipt.clickedAt ||
    receipt.focusObservedAt! < receipt.focusedAt ||
    receipt.readAt < receipt.focusObservedAt!
  )
    return fail('invalid-page-clock', restoredInMs);
  if (restoredInMs > SEARCH_CLOSE_FOCUS_BUDGET_MS) return fail('late-focus', restoredInMs);
  if (
    !receipt.focusOwners?.openerCurrent ||
    !receipt.focusOwners.dialogCurrent ||
    !receipt.focusOwners.focused
  )
    return fail('wrong-focus-owner', restoredInMs);
  if (
    !receipt.readOwners.openerCurrent ||
    !receipt.readOwners.dialogCurrent ||
    !receipt.readOwners.focused
  )
    return fail('current-owner-not-focused', restoredInMs);
  return { ok: true, reason: 'restored', restoredInMs };
}
