/** Post-failure readonly DOM/owned-state facts. No reveal, focus, scroll or hook installation. */
export function collectAccordionPendingObservation(element: Element) {
  const ancestors = [];
  for (let node: Element | null = element; node; node = node.parentElement) {
    const style = getComputedStyle(node),
      rect = node.getBoundingClientRect();
    const vm = (node as Element & { __vue__?: any }).__vue__;
    const state = vm?.__pui;
    ancestors.push({
      tag: node.localName,
      ref: node.getAttribute('data-demo-ref'),
      pending: node.hasAttribute('data-pui-view-pending'),
      detached: node.hasAttribute('data-pui-view-detached'),
      connected: node.isConnected,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      contentVisibility: style.contentVisibility,
      ariaExpanded: node.getAttribute('aria-expanded'),
      ariaHidden: node.getAttribute('aria-hidden'),
      materialReason: node.getAttribute('data-material-reason'),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      vue2: state
        ? {
            viewReady: state.viewReady,
            pendingCommit: state.pendingCommit,
            hasPendingSignal: !!state.pendingSignal,
            viewDisposed: state.viewDisposed,
            terminalDisposed: state.terminalDisposed,
            hostActive: state.hostActive,
            shouldExist: vm.__puiShouldExist,
            rootMatches: vm.$el === node,
            lastInitRootMatches: state.lastInitRoot === node,
            boundRootMatches: state.boundRoot === node,
            ownerHasView: state.owner?.hasView,
          }
        : null,
    });
  }
  return { captureMeaning: 'Post-failure only; not within-deadline readiness evidence', ancestors };
}

/** Read exact revision/tree and dirty state without hiding untracked sources. */
export function readAccordionSourceBinding(git: (args: string[]) => string) {
  return {
    sourceSha: git(['rev-parse', 'HEAD']).trim(),
    sourceTree: git(['rev-parse', 'HEAD^{tree}']).trim(),
    sourceDirty: git(['status', '--porcelain']).trim().length > 0,
  };
}
