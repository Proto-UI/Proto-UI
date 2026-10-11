/** Adapter-private visual sample from the existing input router. Never an
 * activation signal, pointer-capture request or prototype native-event escape. */
export type WebPointerContact = Readonly<{
  active: boolean;
  session: number;
  x: number;
  y: number;
  deltaX: number;
  deltaY: number;
  reason: 'down' | 'move' | 'up' | 'cancel' | 'lostcapture' | 'blur' | 'replaced' | 'unmount';
}>;
type ContactCell = {
  value: WebPointerContact | null;
  owner?: object;
  listeners: Set<(value: WebPointerContact) => void>;
};
const cells = new WeakMap<HTMLElement, ContactCell>();
function cell(host: HTMLElement): ContactCell {
  let value = cells.get(host);
  if (!value) {
    value = { value: null, listeners: new Set() };
    cells.set(host, value);
  }
  return value;
}
export function observeWebPointerContact(
  host: HTMLElement,
  callback: (value: WebPointerContact) => void
) {
  const state = cell(host);
  state.listeners.add(callback);
  return {
    current: () => state.value,
    dispose: () => {
      state.listeners.delete(callback);
    },
  };
}
/** Router-only writer; retiring an old router cannot erase its replacement. */
export function createWebPointerContactWriter(host: HTMLElement) {
  const state = cell(host),
    owner = {};
  state.owner = owner;
  const publish = (sample: WebPointerContact) => {
    if (state.owner !== owner) return;
    state.value = Object.freeze({ ...sample });
    for (const listener of state.listeners) {
      try {
        listener(state.value);
      } catch (error) {
        queueMicrotask(() => {
          throw error;
        });
      }
    }
  };
  if (state.value?.active) publish({ ...state.value, active: false, reason: 'replaced' });
  return { publish, nextSession: () => (state.value?.session ?? 0) + 1 };
}
