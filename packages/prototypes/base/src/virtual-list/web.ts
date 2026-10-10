import type { WindowedCollection } from './model';
/** Explicit Web host boundary. Pixel geometry, observers and nodes never become portable props or state. */
export function attachWebVirtualList(options: {
  viewport: HTMLElement;
  content: HTMLElement;
  collection: WindowedCollection;
  renderItem: (key: string) => HTMLElement;
  estimateSize?: number;
}): {
  refresh(): void;
  ensureVisible(key: string, align?: 'nearest' | 'start' | 'center' | 'end'): boolean;
  dispose(): void;
} {
  const { viewport, content, collection, renderItem } = options,
    estimate = options.estimateSize ?? 36;
  if (!Number.isFinite(estimate) || estimate <= 0)
    throw new Error('Virtual list host estimate must be positive');
  let disposed = false,
    refreshing = false,
    epoch = 0;
  const views = new Map<string, HTMLElement>(),
    measurements = new Map<string, number>();
  const leading = content.ownerDocument.createElement('div'),
    trailing = content.ownerDocument.createElement('div');
  leading.setAttribute('aria-hidden', 'true');
  trailing.setAttribute('aria-hidden', 'true');
  content.append(leading, trailing);
  const geometry = () => {
    const keys = collection.snapshot().keys,
      offsets = [0];
    for (const key of keys) offsets.push(offsets.at(-1)! + (measurements.get(key) ?? estimate));
    return { keys, offsets };
  };
  const refresh = () => {
    if (disposed || refreshing) return;
    refreshing = true;
    const currentEpoch = epoch;
    try {
      const { keys, offsets } = geometry(),
        top = Math.max(0, viewport.scrollTop),
        bottom = top + Math.max(1, viewport.clientHeight);
      let start = 0;
      while (start < keys.length && offsets[start + 1]! <= top) start++;
      let end = start;
      while (end < keys.length && offsets[end]! < bottom) end++;
      const request = collection.propose(start, end);
      if (!request) return;
      const wanted = new Set(request.keys);
      const staged: HTMLElement[] = [];
      try {
        for (const key of request.keys) {
          const existing = views.get(key),
            node = existing ?? renderItem(key);
          if (!(node instanceof content.ownerDocument.defaultView!.HTMLElement))
            throw new Error('Materializer must return a Web element');
          if (staged.includes(node) || (!existing && [...views.values()].includes(node)))
            throw new Error('Distinct logical keys need distinct views');
          staged.push(node);
        }
        if (disposed || currentEpoch !== epoch) {
          collection.reject(request);
          return;
        }
        for (const [key, node] of views) {
          if (!wanted.has(key)) {
            observer?.unobserve(node);
            node.remove();
            views.delete(key);
          }
        }
        request.keys.forEach((key, index) => {
          const node = staged[index]!;
          views.set(key, node);
          node.setAttribute('role', 'listitem');
          node.setAttribute('aria-posinset', String(request.start + index + 1));
          node.setAttribute('aria-setsize', String(keys.length));
          content.insertBefore(node, trailing);
          observer?.observe(node);
          const height = node.getBoundingClientRect().height;
          if (height > 0 && Number.isFinite(height)) measurements.set(key, height);
        });
        const measured = geometry().offsets;
        leading.style.height = `${measured[request.start] ?? 0}px`;
        trailing.style.height = `${Math.max(0, (measured.at(-1) ?? 0) - (measured[request.end] ?? 0))}px`;
        if (!collection.commit(request, request.keys)) collection.reject(request);
      } catch (error) {
        collection.reject(request);
        throw error;
      }
    } finally {
      refreshing = false;
    }
  };
  const observer =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          if (!disposed) refresh();
        });
  observer?.observe(viewport);
  viewport.addEventListener('scroll', refresh, { passive: true });
  const unsubscribe = collection.subscribe(() => {
    epoch++;
    const set = new Set(collection.snapshot().keys);
    for (const key of measurements.keys()) if (!set.has(key)) measurements.delete(key);
    refresh();
  });
  refresh();
  return {
    refresh,
    ensureVisible(key, align = 'nearest') {
      if (disposed) return false;
      const { keys, offsets } = geometry(),
        index = keys.indexOf(key);
      if (index < 0) return false;
      const start = offsets[index]!,
        end = offsets[index + 1]!,
        height = viewport.clientHeight;
      if (align === 'start') viewport.scrollTop = start;
      else if (align === 'end') viewport.scrollTop = end - height;
      else if (align === 'center') viewport.scrollTop = (start + end - height) / 2;
      else if (start < viewport.scrollTop) viewport.scrollTop = start;
      else if (end > viewport.scrollTop + height) viewport.scrollTop = end - height;
      refresh();
      return collection.snapshot().materializedKeys.includes(key);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      epoch++;
      unsubscribe();
      observer?.disconnect();
      viewport.removeEventListener('scroll', refresh);
      for (const node of views.values()) node.remove();
      views.clear();
      leading.remove();
      trailing.remove();
      collection.invalidate();
    },
  };
}
