type InlineStyleValue = { value: string; priority: string };

/** Value ownership for one motion surface; each caller retains its own lifetime. */
export function createWebMotionStyleOwnership(el: HTMLElement, onLoss?: (name: string) => void) {
  const baseline = new Map<string, InlineStyleValue>();
  const writes = new Map<string, InlineStyleValue>();
  const lost = new Set<string>();
  const read = (name: string): InlineStyleValue => ({
    value: el.style.getPropertyValue(name),
    priority: el.style.getPropertyPriority(name),
  });
  const restore = (name: string) => {
    const before = baseline.get(name)!;
    if (before.value) el.style.setProperty(name, before.value, before.priority);
    else el.style.removeProperty(name);
  };
  const owned = (name: string, value: InlineStyleValue) =>
    el.style.getPropertyValue(name) === value.value &&
    el.style.getPropertyPriority(name) === value.priority;
  const detectLoss = () => {
    for (const [name, value] of writes)
      if (!owned(name, value)) {
        lost.add(name);
        writes.delete(name);
        baseline.delete(name);
        onLoss?.(name);
      }
  };
  const clear = () => {
    for (const [name, value] of writes) if (owned(name, value)) restore(name);
    writes.clear();
    baseline.clear();
  };
  const write = (name: string, value: string | undefined): boolean => {
    detectLoss();
    if (lost.has(name)) return false;
    if (value === undefined) {
      const old = writes.get(name);
      if (old !== undefined && owned(name, old)) restore(name);
      writes.delete(name);
      baseline.delete(name);
      return true;
    }
    if (!baseline.has(name)) baseline.set(name, read(name));
    el.style.setProperty(name, value);
    writes.set(name, read(name));
    return true;
  };
  return { writes, lost, owned, detectLoss, clear, write };
}

/** Fresh physical ancestry for one Motion host read; no cached nodes or document lease. */
export function webMotionAncestors(el: HTMLElement): HTMLElement[] {
  const result: HTMLElement[] = [];
  let node: HTMLElement | null = el;
  while (node) {
    result.push(node);
    const root: Node = node.getRootNode();
    node =
      node.parentElement ?? ('host' in root ? ((root as ShadowRoot).host as HTMLElement) : null);
  }
  return result;
}
