/** Snapshot only the first committed view, never the framework's pending mount. */
export async function captureTemplateOwnership(
  entries: ReadonlyArray<{ host: HTMLElement }>,
  settle: () => Promise<void>
) {
  await settle();
  const originalRoots = entries.map(({ host }) => host.querySelector('[data-pui-root]'));
  const originalSlots = entries.map(({ host }) => host.querySelector('[data-caller-slot]'));
  if (originalRoots.some((root) => !root) || originalSlots.some((slot) => !slot)) {
    throw new Error('Template fixture must commit every root and caller slot before ready.');
  }
  const originalRootCarriers = originalRoots.map((root) => root!.getAttribute('data-pui-style'));
  return { originalRoots, originalSlots, originalRootCarriers };
}
