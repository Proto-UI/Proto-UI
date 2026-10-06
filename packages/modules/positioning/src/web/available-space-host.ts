import { observeRootSpace } from './root-space-observer';
import type { AvailableSpaceFrame, AvailableSpaceRect } from '@proto.ui/core';
import type { AvailableSpaceHost, AvailableSpaceHostConnection } from '../caps';

type Reader = (document: Document, probe: HTMLElement) => AvailableSpaceRect | null;
const properties = ['width', 'height', 'center-x', 'center-y'] as const;
const cssName = (name: string) => `--proto-ui-available-region-${name}`;
const finite = (value: number) => Number.isFinite(value);
function valid(rect: AvailableSpaceRect | null): rect is AvailableSpaceRect {
  return (
    !!rect &&
    [rect.x, rect.y, rect.width, rect.height].every(finite) &&
    rect.width >= 0 &&
    rect.height >= 0
  );
}

// Browser details stay in this Web realization. These are host logical CSS px,
// not Proto Props/State or a portable visualViewport/CSS-env data model.
const readWebRegion: Reader = (document, probe) => {
  const view = document.defaultView;
  if (!view) return null;
  const style = view.getComputedStyle(probe);
  const viewport = view.visualViewport;
  const width = viewport?.width ?? document.documentElement.clientWidth;
  const height = viewport?.height ?? document.documentElement.clientHeight;
  const x = viewport?.offsetLeft ?? 0;
  const y = viewport?.offsetTop ?? 0;
  if (![x, y, width, height].every(finite) || width <= 0 || height <= 0) return null;
  const [top, right, bottom, left] = [
    style.paddingTop,
    style.paddingRight,
    style.paddingBottom,
    style.paddingLeft,
  ].map(Number.parseFloat);
  if (![top, right, bottom, left].every((n) => finite(n) && n >= 0)) return null;
  // Conservative safe insets within the currently visible region. A keyboard's
  // visual-region shrink is observed without changing global keyboard policy.
  return {
    x: x + left,
    y: y + top,
    width: Math.max(0, width - left - right),
    height: Math.max(0, height - top - bottom),
  };
};

type Tracker = {
  document: Document;
  probe: HTMLElement;
  leases: Set<Lease>;
  update(): void;
  destroy(): void;
};
type Lease = {
  target: HTMLElement;
  connection: AvailableSpaceHostConnection;
  tracker: Tracker;
  disposed: boolean;
  revision: number;
  measurement: number;
  frame: AvailableSpaceFrame | null;
  original: Map<string, { value: string; priority: string }>;
  projected: Map<string, { value: string; priority: string }>;
  relinquished: Set<string>;
  dispose(): void;
  update(): void;
};
const owners = new WeakMap<HTMLElement, Lease>();
const trackers = new WeakMap<Document, Map<Reader, Tracker>>();
function trackerFor(document: Document, read: Reader): Tracker {
  let byReader = trackers.get(document);
  if (!byReader) {
    byReader = new Map();
    trackers.set(document, byReader);
  }
  const existing = byReader.get(read);
  if (existing) return existing;
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.setAttribute('data-pui-available-space-probe', '');
  probe.inert = true;
  probe.style.cssText =
    'all:initial!important;position:fixed!important;visibility:hidden!important;pointer-events:none!important;width:0!important;height:0!important;top:0!important;left:0!important;contain:strict!important;padding-top:env(safe-area-inset-top,0px)!important;padding-right:env(safe-area-inset-right,0px)!important;padding-bottom:env(safe-area-inset-bottom,0px)!important;padding-left:env(safe-area-inset-left,0px)!important;';
  (document.body ?? document.documentElement).append(probe);
  const view = document.defaultView;
  const viewport = view?.visualViewport;
  let stopRoot = () => {};
  const tracker: Tracker = {
    document,
    probe,
    leases: new Set(),
    update: () => {
      for (const lease of [...tracker.leases]) lease.update();
    },
    destroy: () => {
      view?.removeEventListener('resize', tracker.update);
      viewport?.removeEventListener('resize', tracker.update);
      viewport?.removeEventListener('scroll', tracker.update);
      stopRoot();
      probe.remove();
      byReader!.delete(read);
      if (!byReader!.size) trackers.delete(document);
    },
  };
  byReader.set(read, tracker);
  stopRoot = observeRootSpace(document, tracker.update);
  view?.addEventListener('resize', tracker.update);
  viewport?.addEventListener('resize', tracker.update);
  viewport?.addEventListener('scroll', tracker.update);
  return tracker;
}
function leaveTracker(lease: Lease) {
  lease.tracker.leases.delete(lease);
  if (!lease.tracker.leases.size) lease.tracker.destroy();
}
function restore(lease: Lease) {
  for (const [name, projected] of lease.projected) {
    if (
      lease.target.style.getPropertyValue(name) !== projected.value ||
      lease.target.style.getPropertyPriority(name) !== projected.priority
    ) {
      lease.relinquished.add(name);
      continue;
    }
    const original = lease.original.get(name)!;
    if (original.value) lease.target.style.setProperty(name, original.value, original.priority);
    else lease.target.style.removeProperty(name);
  }
  lease.projected.clear();
}

/** Shared per-document observation exists only while at least one active view leases it. */
export function createWebAvailableSpaceHost(
  options: { readRegion?: Reader } = {}
): AvailableSpaceHost {
  const read = options.readRegion ?? readWebRegion;
  return {
    attach(connection) {
      const target = connection.target as HTMLElement | null;
      const ElementType = target?.ownerDocument?.defaultView?.HTMLElement;
      if (
        !ElementType ||
        !(target instanceof ElementType) ||
        connection.boundary !== 'root-content' ||
        !Number.isSafeInteger(connection.viewEpoch) ||
        connection.viewEpoch < 0
      ) {
        return { requestUpdate() {}, dispose() {}, getFrame: () => null };
      }
      owners.get(target)?.dispose();
      const original = new Map(
        properties.map((p) => {
          const name = cssName(p);
          return [
            name,
            {
              value: target.style.getPropertyValue(name),
              priority: target.style.getPropertyPriority(name),
            },
          ];
        })
      );
      const lease: Lease = {
        target,
        connection,
        original,
        projected: new Map(),
        relinquished: new Set(),
        dispose() {
          if (lease.disposed) return;
          lease.disposed = true;
          leaveTracker(lease);
          restore(lease);
          lease.frame = null;
          if (owners.get(target) === lease) owners.delete(target);
        },
        tracker: trackerFor(target.ownerDocument, read),
        disposed: false,
        revision: 0,
        measurement: 0,
        frame: null,
        update() {
          if (lease.disposed) return;
          const measurement = ++lease.measurement;
          if (target.ownerDocument !== lease.tracker.document) {
            leaveTracker(lease);
            restore(lease);
            lease.frame = null;
            lease.tracker = trackerFor(target.ownerDocument, read);
            lease.tracker.leases.add(lease);
          }
          let measured: AvailableSpaceRect | null = null;
          try {
            measured = read(lease.tracker.document, lease.tracker.probe);
          } catch {
            /* Unknown host facts revoke projection; they are never zero geometry. */
          }
          if (
            lease.disposed ||
            measurement !== lease.measurement ||
            owners.get(target) !== lease ||
            target.ownerDocument !== lease.tracker.document
          )
            return;
          const rect = valid(measured) ? Object.freeze({ ...measured }) : null;
          lease.frame = Object.freeze({
            rect,
            revision: ++lease.revision,
            viewEpoch: connection.viewEpoch,
          });
          if (!rect) {
            restore(lease);
            return;
          }
          const values = [
            rect.width,
            rect.height,
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          ];
          properties.forEach((p, index) => {
            const name = cssName(p),
              value = `${values[index]}px`;
            if (lease.relinquished.has(name)) return;
            const previous = lease.projected.get(name) ?? original.get(name)!;
            if (
              target.style.getPropertyValue(name) !== previous.value ||
              target.style.getPropertyPriority(name) !== previous.priority
            ) {
              lease.relinquished.add(name);
              lease.projected.delete(name);
              return;
            }
            if (
              target.style.getPropertyValue(name) !== value ||
              target.style.getPropertyPriority(name) !== original.get(name)!.priority
            )
              target.style.setProperty(name, value, original.get(name)!.priority);
            lease.projected.set(name, { value, priority: original.get(name)!.priority });
          });
        },
      };
      owners.set(target, lease);
      lease.tracker.leases.add(lease);
      lease.update();
      return {
        requestUpdate: () => lease.update(),
        getFrame: () => lease.frame,
        dispose: () => lease.dispose(),
      };
    },
  };
}
