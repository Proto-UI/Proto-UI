type Registration = { check(): void };

const bodyObservers = new WeakMap<
  HTMLElement,
  { observer: MutationObserver; registrations: Set<Registration> }
>();

export function observePreviewerRemoval(body: HTMLElement, check: () => void): () => void {
  let state = bodyObservers.get(body);
  if (!state) {
    const registrations = new Set<Registration>();
    const observer = new MutationObserver(() => {
      for (const registration of [...registrations]) {
        if (!registrations.has(registration)) continue;
        try {
          registration.check();
        } catch (error) {
          // Keep one failing owner's cleanup from interrupting the other owners.
          queueMicrotask(() => {
            throw error;
          });
        }
      }
    });
    observer.observe(body, { childList: true, subtree: true });
    state = { observer, registrations };
    bodyObservers.set(body, state);
  }
  const { observer, registrations } = state;
  const registration = { check };
  registrations.add(registration);
  return () => {
    if (!registrations.delete(registration) || registrations.size) return;
    observer.disconnect();
    bodyObservers.delete(body);
  };
}
