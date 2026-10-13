import { acquireWebTranslation } from './translation-composition';
import type { AvailableLayoutFrame, AvailableSpaceRect } from '@proto.ui/core';
import { resolveAvailableExtent } from '../available-layout';

type Written = { value: string; priority: string };
/** Host-only realization of neutral layout intent. No component policy or measurements escape. */
export function createWebAvailableLayout(target: HTMLElement) {
  let translation: ReturnType<typeof acquireWebTranslation> | null = null;
  const original = new Map<string, Written>();
  const projected = new Map<string, Written>();
  const relinquished = new Set<string>();
  let disposed = false;
  let status = 'disabled';
  const read = (name: string): Written => ({
    value: target.style.getPropertyValue(name),
    priority: target.style.getPropertyPriority(name),
  });
  const equal = (a: Written, b: Written) => a.value === b.value && a.priority === b.priority;
  const write = (name: string, value: string) => {
    if (disposed || relinquished.has(name)) return;
    if (!original.has(name)) original.set(name, read(name));
    const before = projected.get(name) ?? original.get(name)!;
    if (!equal(read(name), before)) {
      relinquished.add(name);
      projected.delete(name);
      return;
    }
    const next = { value, priority: original.get(name)!.priority };
    if (!equal(read(name), next)) target.style.setProperty(name, value, next.priority);
    projected.set(name, read(name));
  };
  const restore = (only?: string) => {
    if (only === undefined || only === 'translate') {
      translation?.release();
      translation = null;
    }
    for (const [name, value] of projected) {
      if (only !== undefined && name !== only) continue;
      if (!equal(read(name), value)) {
        relinquished.add(name);
        projected.delete(name);
        continue;
      }
      const baseline = original.get(name)!;
      if (baseline.value) target.style.setProperty(name, baseline.value, baseline.priority);
      else target.style.removeProperty(name);
      projected.delete(name);
    }
  };
  const hide = (reason: string) => {
    write('display', 'none');
    status = relinquished.size ? 'ownership-lost' : reason;
  };
  function apply(frame: AvailableLayoutFrame | undefined, rect: AvailableSpaceRect | null) {
    if (disposed) return;
    if (!frame || frame.status === 'disabled') {
      restore();
      status = 'disabled';
      return;
    }
    if (frame.status !== 'ready') {
      hide('invalid');
      return;
    }
    if (!rect) {
      hide('unknown');
      return;
    }
    const value = frame.value;
    const view = target.ownerDocument.defaultView;
    if (!view) {
      hide('unknown');
      return;
    }
    const rootText = Number.parseFloat(
      view.getComputedStyle(target.ownerDocument.documentElement).fontSize
    );
    const horizontal = value.edge === 'left' || value.edge === 'right';
    const available = horizontal ? rect.width : rect.height;
    const cross = horizontal ? rect.height : rect.width;
    const bounds = resolveAvailableExtent(value, available, rootText, 0);
    if (!bounds) {
      hide('invalid');
      return;
    }
    const computed = view.getComputedStyle(target);
    // Only untransformed fixed-coordinate compositions are currently realized.
    let element: Element | null = target;
    while (element) {
      const style = view.getComputedStyle(element);
      const effect = (name: string) => {
        const token = style.getPropertyValue(name);
        return !!token && token !== 'none' && token !== 'normal';
      };
      const transformed =
        effect('transform') ||
        effect('rotate') ||
        (effect('scale') && style.getPropertyValue('scale') !== '1');
      const ancestorBlock =
        element !== target &&
        (effect('translate') ||
          effect('filter') ||
          effect('backdrop-filter') ||
          effect('perspective') ||
          /(?:layout|paint|strict|content)/.test(style.getPropertyValue('contain')) ||
          /(?:transform|translate|scale|rotate|filter|perspective)/.test(
            style.getPropertyValue('will-change')
          ));
      if (transformed || ancestorBlock) {
        hide('unsupported-transform');
        return;
      }
      const root = element.getRootNode();
      element =
        element.parentElement ?? (root && 'host' in root ? (root as ShadowRoot).host : null);
    }
    const metric = (name: string) => {
      const token = computed.getPropertyValue(name);
      return token ? Number.parseFloat(token) : 0;
    };
    const widthChrome = [
      'padding-left',
      'padding-right',
      'border-left-width',
      'border-right-width',
    ].reduce((n, key) => n + metric(key), 0);
    const heightChrome = [
      'padding-top',
      'padding-bottom',
      'border-top-width',
      'border-bottom-width',
    ].reduce((n, key) => n + metric(key), 0);
    const extent = value.extent === 'fraction' ? bounds.extent : bounds.cap;
    if (
      ![widthChrome, heightChrome, extent, cross].every(Number.isFinite) ||
      extent <= 0 ||
      cross <= 0 ||
      (horizontal ? widthChrome : heightChrome) > extent ||
      (horizontal ? heightChrome : widthChrome) > cross
    ) {
      hide('infeasible');
      return;
    }
    const px = (n: number) => `${n}px`;
    write('position', 'fixed');
    write('box-sizing', 'border-box');
    write('margin', '0px');
    write('right', 'auto');
    write('bottom', 'auto');
    write('left', px(value.edge === 'right' ? rect.x + rect.width : rect.x));
    write('top', px(value.edge === 'bottom' ? rect.y + rect.height : rect.y));
    write(horizontal ? 'height' : 'width', px(cross));
    write(horizontal ? 'max-height' : 'max-width', px(cross));
    write(horizontal ? 'min-height' : 'min-width', '0px');
    write(
      horizontal ? 'width' : 'height',
      value.extent === 'intrinsic' ? 'auto' : px(bounds.extent)
    );
    write(horizontal ? 'max-width' : 'max-height', px(bounds.cap));
    write(horizontal ? 'min-width' : 'min-height', px(bounds.minimum));
    const trailing = value.edge === 'bottom' || value.edge === 'right';
    const offset = (trailing ? value.displacement - 1 : -value.displacement) * 100;
    translation ??= acquireWebTranslation(target, 'layout');
    const zero = { px: 0, rootText: 0, ownBox: 0 };
    const shifted = { px: 0, rootText: 0, ownBox: offset / 100 };
    if (!translation.set(horizontal ? [shifted, zero] : [zero, shifted]))
      relinquished.add('translate');
    restore('display');
    status = relinquished.size ? 'ownership-lost' : 'ready';
  }
  return {
    apply,
    getStatus: () => status,
    dispose() {
      if (disposed) return;
      restore();
      disposed = true;
      status = 'disposed';
    },
  };
}
