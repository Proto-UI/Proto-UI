// Serialized by Playwright. Observe the failed native surface without changing focus.
export function collectCollapsibleFocusFailure(element: HTMLElement) {
  const doc = element.ownerDocument;
  const win = doc.defaultView!;
  const summarize = (target: Element | null) => {
    if (!target) return null;
    const style = win.getComputedStyle(target);
    const rect = target.getBoundingClientRect();
    return {
      tag: target.tagName,
      id: target.id,
      role: target.getAttribute('role'),
      tabIndex: target.getAttribute('tabindex'),
      text: target.textContent?.trim().slice(0, 120),
      connected: target.isConnected,
      hidden: target.hasAttribute('hidden'),
      inertAncestor: !!target.closest('[inert]'),
      pendingAncestor: !!target.closest('[data-pui-view-pending]'),
      detachedAncestor: !!target.closest('[data-pui-view-detached]'),
      generation: target
        .closest('[data-projection-generation-state]')
        ?.getAttribute('data-projection-generation-state'),
      display: style.display,
      visibility: style.visibility,
      pointerEvents: style.pointerEvents,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      materialQuality: target.getAttribute('data-material-quality'),
    };
  };
  const previewer = element.closest<HTMLElement>('[data-previewer-id]');
  const evidence = previewer as
    | (HTMLElement & {
        __puiCollapsibleEvidence?: unknown[];
        __puiCollapsibleLastPointerTarget?: Element | null;
      })
    | null;
  const input = evidence?.__puiCollapsibleEvidence;
  const pointerTarget = evidence?.__puiCollapsibleLastPointerTarget;
  return {
    focused: doc.activeElement === element,
    expected: summarize(element),
    active: summarize(doc.activeElement),
    pointerTargetIsExpected: pointerTarget ? pointerTarget === element : null,
    pointerTarget: summarize(pointerTarget ?? null),
    runtime: previewer?.dataset.projectionRuntime,
    projectionState: previewer?.dataset.projectionState,
    recentInput: input?.slice(-30) ?? [],
  };
}
