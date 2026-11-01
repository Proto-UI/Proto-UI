// Throwaway diagnostic test support, not imported by the public application.
// Native getter/method results are returned unchanged. Observation can perturb
// timing; always retain an uninstrumented control and never call this a fix.
export function installHeaderSizeReadProbe() {
  const metrics = [
    'offsetWidth',
    'offsetHeight',
    'clientWidth',
    'clientHeight',
    'scrollWidth',
    'scrollHeight',
  ] as const;
  const writes = new Set([
    'width',
    'height',
    'inline-size',
    'block-size',
    'box-sizing',
    'min-width',
    'display',
    'position',
  ]);
  const rows: Record<string, unknown>[] = [];
  const probeErrors: string[] = [];
  const observeSafely = (observe: () => void) => {
    try {
      observe();
    } catch (error) {
      // Do not coerce a foreign thrown value: its toString may itself throw.
      if (probeErrors.length < 100) probeErrors.push('probe observation failed');
    }
  };
  const restores: Array<() => boolean> = [];
  const styleOwners = new WeakMap<CSSStyleDeclaration, HTMLElement>();
  let phase = 'installed',
    overflow = false,
    stopped = false,
    sequence = 0;
  const native = new Map<string, { holder: object; descriptor: PropertyDescriptor }>();
  const lookup = (name: string) => {
    let holder: object | null = HTMLElement.prototype;
    while (holder) {
      const descriptor = Object.getOwnPropertyDescriptor(holder, name);
      if (descriptor) return { holder, descriptor };
      holder = Object.getPrototypeOf(holder);
    }
    throw new Error(`Missing native descriptor: ${name}`);
  };
  for (const name of [...metrics, 'style']) {
    const entry = lookup(name);
    if (!entry.descriptor.configurable || !entry.descriptor.get)
      throw new Error(`Unsafe/unavailable native descriptor: ${name}`);
    native.set(name, entry);
  }
  const relevant = (node: unknown): node is HTMLElement =>
    node instanceof HTMLElement &&
    node.getAttribute('data-projection-owner') === 'homepage-home-preferences' &&
    /^shadcn-select-(item|trigger|content|surface|viewport)$/.test(
      node.getAttribute('data-projection-prototype') ?? ''
    );
  const identity = (node: HTMLElement) => ({
    tag: node.localName,
    id: node.id,
    part: node.getAttribute('data-projection-prototype'),
    // Projection generation is not a geometry-lease generation.
    projectionGeneration: node.getAttribute('data-projection-generation'),
    connected: node.isConnected,
    tokens: node.getAttribute('data-pui-style'),
    inlineStyle: node.getAttribute('style'),
    detached: !!node.closest('[data-pui-view-detached]'),
    transition:
      node.closest('[data-transition-state]')?.getAttribute('data-transition-state') ?? null,
    alignment:
      node.closest('[data-alignment-diagnostic]')?.getAttribute('data-alignment-diagnostic') ??
      null,
  });
  const record = (row: Record<string, unknown>) => {
    if (stopped) return;
    if (rows.length === 12000) {
      overflow = true;
      return;
    }
    rows.push({ sequence: ++sequence, phase, ...row });
  };
  const caller = () => {
    const stack = new Error().stack ?? '';
    return stack
      .split('\n')
      .filter((line) => /border-box-size-lease|target-alignment-host/.test(line))
      .map((line) => line.replace(/https?:\/\/[^/]+/g, '<test-origin>'))
      .slice(0, 4);
  };
  const facts = (node: HTMLElement) => {
    const values: Record<string, number> = {};
    for (const name of metrics)
      values[name] = Reflect.apply(native.get(name)!.descriptor.get!, node, []);
    const css = getComputedStyle(node);
    return {
      ...identity(node),
      values,
      css: {
        display: css.display,
        boxSizing: css.boxSizing,
        width: css.width,
        height: css.height,
        minWidth: css.minWidth,
        maxWidth: css.maxWidth,
        minHeight: css.minHeight,
        maxHeight: css.maxHeight,
        overflowX: css.overflowX,
        overflowY: css.overflowY,
        whiteSpace: css.whiteSpace,
        flexShrink: css.flexShrink,
        transform: css.transform,
      },
    };
  };
  const replaceGetter = (name: string, observe: (node: HTMLElement, value: unknown) => void) => {
    const entry = native.get(name)!;
    const original = entry.descriptor.get!;
    const wrapped = function (this: HTMLElement) {
      const value = Reflect.apply(original, this, []);
      observeSafely(() => {
        if (relevant(this)) observe(this, value);
      });
      return value;
    };
    Object.defineProperty(entry.holder, name, { ...entry.descriptor, get: wrapped });
    restores.push(() => {
      if (Object.getOwnPropertyDescriptor(entry.holder, name)?.get !== wrapped) return false;
      Object.defineProperty(entry.holder, name, entry.descriptor);
      return true;
    });
  };
  replaceGetter('style', (node, value) => styleOwners.set(value as CSSStyleDeclaration, node));
  for (const name of metrics)
    replaceGetter(name, (node, value) => {
      // Only geometry-owner reads are traced, avoiding Playwright's own box queries.
      const source = caller();
      if (source.length)
        record({ kind: 'native-read', name, returned: value, source, ...facts(node) });
    });
  const holder = CSSStyleDeclaration.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(holder, 'setProperty');
  if (!descriptor?.configurable || typeof descriptor.value !== 'function') {
    for (const restore of restores.reverse()) restore();
    throw new Error('Unsafe/unavailable native setProperty descriptor');
  }
  const original = descriptor.value;
  const wrapped = function (
    this: CSSStyleDeclaration,
    ...args: Parameters<CSSStyleDeclaration['setProperty']>
  ) {
    const result = Reflect.apply(original, this, args);
    observeSafely(() => {
      const owner = styleOwners.get(this);
      if (owner && relevant(owner) && writes.has(args[0])) {
        const source = caller();
        // No layout reads after writes: the product retains its own read ordering.
        if (source.length)
          record({
            kind: 'native-write',
            name: args[0],
            value: args[1],
            priority: args[2] ?? '',
            source,
            ...identity(owner),
          });
      }
    });
    return result;
  };
  Object.defineProperty(holder, 'setProperty', { ...descriptor, value: wrapped });
  restores.push(() => {
    if (Object.getOwnPropertyDescriptor(holder, 'setProperty')?.value !== wrapped) return false;
    Object.defineProperty(holder, 'setProperty', descriptor);
    return true;
  });
  const probe = {
    phase(next: string) {
      phase = next;
    },
    finish() {
      const final: Record<string, unknown>[] = [];
      const restored: boolean[] = [];
      try {
        observeSafely(() => {
          for (const node of document.querySelectorAll<HTMLElement>(
            '[data-projection-owner="homepage-home-preferences"]'
          ))
            if (relevant(node))
              observeSafely(() => {
                final.push(facts(node));
              });
        });
      } finally {
        stopped = true;
        for (const restore of restores.reverse()) {
          let didRestore = false;
          observeSafely(() => {
            didRestore = restore();
          });
          restored.push(didRestore);
        }
      }
      return {
        rows,
        final,
        overflow,
        restored,
        probeErrors,
        diagnosticOnly: true,
        syntheticLeaseId: false,
      };
    },
  };
  window.__headerSizeReadProbe = probe;
  return probe;
}
