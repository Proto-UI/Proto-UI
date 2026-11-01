import { readPointerSampleField, type PointerSampleFieldRead } from '../events/pointer-sample';

/**
 * Adapter-private correlation between an accepted directional contact and its
 * trailing semantic click. No new DOM listener or author-visible flag is used.
 * Weak per-target, per-pointer records are bounded by native contact lifetimes;
 * a same-pointer down or the end of its release task retires each record. Keyboard/AT detail=0 activation never consumes the record.
 */
type Contact = {
  pointerId: number;
  pointerType: string;
  released: boolean;
  legacyRelease: PointerEvent | null;
  legacyTimer: ReturnType<typeof setTimeout> | null;
};
const contacts = new WeakMap<HTMLElement, Map<number, Contact>>();
const consumed = new WeakMap<Event, HTMLElement>();

function retire(target: HTMLElement, pointerId: number) {
  const records = contacts.get(target);
  const current = records?.get(pointerId);
  if (current?.legacyTimer !== null && current?.legacyTimer !== undefined)
    clearTimeout(current.legacyTimer);
  records?.delete(pointerId);
  if (records?.size === 0) contacts.delete(target);
}

function pointerType(value: unknown): string {
  return value === 'mouse' || value === 'touch' || value === 'pen' ? value : 'unknown';
}
function retireSuperseded(
  target: HTMLElement,
  event: PointerEvent,
  sample: PointerSampleFieldRead = readPointerSampleField(event, 'pointerType')
) {
  const kind = pointerType(sample.value);
  for (const current of contacts.get(target)?.values() ?? []) {
    // Only one primary contact exists per native pointer type. This also bounds
    // records when a terminal event was lost outside the document: at most one
    // mouse, touch, pen and unknown record can remain on a live target.
    if (
      current.pointerId === event.pointerId ||
      (sample.readable &&
        event.isPrimary !== false &&
        event.button === 0 &&
        current.pointerType === kind)
    )
      retire(target, current.pointerId);
  }
}

export function beginDirectionalClickContact(target: HTMLElement, event: PointerEvent): void {
  const sample = readPointerSampleField(event, 'pointerType');
  retireSuperseded(target, event, sample);
  if (!sample.readable) return;
  let records = contacts.get(target);
  if (!records) contacts.set(target, (records = new Map()));
  records.set(event.pointerId, {
    pointerId: event.pointerId,
    pointerType: pointerType(sample.value),
    released: false,
    legacyRelease: null,
    legacyTimer: null,
  });
}

export function observeDirectionalPointerDown(target: HTMLElement, event: PointerEvent): void {
  retireSuperseded(target, event);
}

export function observeDirectionalPointerUp(target: HTMLElement, event: PointerEvent): void {
  const current = contacts.get(target)?.get(event.pointerId);
  if (!current || current.released) return;
  current.released = true;
  current.legacyRelease = event;
  // Native click is part of the release sequence. Nothing here is permission
  // to swallow a later click after that task, even if a pointer ID is reused.
  current.legacyTimer = setTimeout(() => retire(target, event.pointerId), 0);
}

export function suppressDirectionalClick(target: HTMLElement, event: MouseEvent): boolean {
  if (event.detail === 0) return false;
  if (consumed.get(event) === target) return true;
  const records = contacts.get(target);
  if (!records) return false;
  const pointer = event as PointerEvent;
  const hasPointerIdentity = typeof pointer.pointerId === 'number' && pointer.pointerId >= 0;
  const candidates = hasPointerIdentity
    ? [records.get(pointer.pointerId)].filter((c): c is Contact => !!c)
    : [...records.values()].filter((c) => c.released && c.legacyRelease);
  // A legacy MouseEvent cannot distinguish simultaneous released contacts.
  if (candidates.length !== 1) return false;
  const current = candidates[0];
  if (!current.released) return false;
  const release = current.legacyRelease;
  const sample = hasPointerIdentity ? readPointerSampleField(pointer, 'pointerType') : undefined;
  // A failed read is not the legitimate missing kind of a legacy click.
  if (sample && !sample.readable) return false;
  const rawKind = sample?.value;
  const matches = hasPointerIdentity
    ? pointer.pointerId === current.pointerId &&
      (!rawKind || pointerType(rawKind) === current.pointerType)
    : !!release &&
      event.button === release.button &&
      event.clientX === release.clientX &&
      event.clientY === release.clientY;
  if (!matches) return false;
  consumed.set(event, target);
  retire(target, current.pointerId);
  return true;
}
