/**
 * Deterministic fake GPUI bridge for the feasibility spike (issue #466).
 *
 * Simulates the Rust side of the proposed TypeScript-hosted bridge:
 * - a retained element tree the adapter commits template output into,
 * - scripted input messages (pointer/key/focus) replayed into an EventTarget
 *   shim so required-profile module wiring can be exercised without DOM,
 * - inspectable queues for commit/cleanup assertions.
 *
 * Nothing here is normative. If maintainers rule for bind->lease Event caps
 * instead of an adapter-local shim, this file is the first thing to go.
 */

export type GpuiElementKind = 'div' | 'text';

export interface GpuiElement {
  id: string;
  kind: GpuiElementKind;
  text?: string;
  children: GpuiElement[];
}

export type GpuiInputMessage =
  | { type: 'pointer.down'; x: number; y: number; targetId: string }
  | { type: 'pointer.up'; x: number; y: number; targetId: string }
  | { type: 'pointer.move'; x: number; y: number; targetId: string }
  | { type: 'key.down'; key: string; code: string }
  | { type: 'focus.changed'; focusedId: string | null };

interface ShimListener {
  type: string;
  cb: (ev: unknown) => void;
}

/**
 * Minimal EventTarget-shaped shim fed by GPUI input messages. Implements only
 * what `packages/modules/event` binds through EVENT_*_TARGET_CAP getters:
 * addEventListener / removeEventListener / dispatchEvent.
 */
class GpuiEventTargetShim implements EventTarget {
  private readonly listeners = new Map<string, Set<ShimListener>>();

  addEventListener(type: string, cb: unknown): void {
    const set = this.listeners.get(type) ?? new Set<ShimListener>();
    set.add({ type, cb: cb as (ev: unknown) => void });
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, cb: unknown): void {
    this.listeners.get(type)?.delete({ type, cb: cb as (ev: unknown) => void });
  }

  dispatchEvent(ev: unknown): boolean {
    const type = (ev as { type?: string })?.type ?? '';
    for (const l of this.listeners.get(type) ?? []) l.cb(ev);
    return true;
  }

  listenerCount(type?: string): number {
    if (type) return this.listeners.get(type)?.size ?? 0;
    let n = 0;
    for (const s of this.listeners.values()) n += s.size;
    return n;
  }
}

export interface GpuiBridgeOptions {
  rootId?: string;
}

export class FakeGpuiBridge {
  readonly rootTarget: EventTarget;
  readonly globalTarget: EventTarget;

  private readonly elementsById = new Map<string, GpuiElement>();
  private root: GpuiElement;
  private commitCount = 0;
  private disposed = false;

  constructor(options: GpuiBridgeOptions = {}) {
    this.root = { id: options.rootId ?? 'gpui-root', kind: 'div', children: [] };
    this.elementsById.set(this.root.id, this.root);
    this.rootTarget = new GpuiEventTargetShim();
    this.globalTarget = new GpuiEventTargetShim();
  }

  /** Commit a full tree from adapter template projection. */
  commit(root: GpuiElement): void {
    if (this.disposed) throw new Error('bridge disposed');
    this.retain(root);
    this.root = root;
    this.commitCount += 1;
  }

  get committedRoot(): GpuiElement {
    return this.root;
  }

  get commitCalls(): number {
    return this.commitCount;
  }

  find(id: string): GpuiElement | undefined {
    return this.elementsById.get(id);
  }

  /**
   * Replay one GPUI input message into the shim targets, mirroring how the
   * real Rust side forwards window input into the TS bridge.
   */
  receive(message: GpuiInputMessage): void {
    if (this.disposed) throw new Error('bridge disposed');
    if (message.type === 'focus.changed') {
      (this.globalTarget as GpuiEventTargetShim).dispatchEvent({
        type: 'focus',
        target: message.focusedId ? this.elementsById.get(message.focusedId) : null,
      });
      return;
    }
    if (message.type === 'key.down') {
      (this.globalTarget as GpuiEventTargetShim).dispatchEvent({
        type: 'keydown',
        key: message.key,
        code: message.code,
      });
      return;
    }
    const nativeType =
      message.type === 'pointer.down' ? 'pointerdown' : message.type === 'pointer.up' ? 'pointerup' : 'pointermove';
    const ev = {
      type: nativeType,
      target: this.elementsById.get(message.targetId),
      x: message.x,
      y: message.y,
    };
    (this.rootTarget as GpuiEventTargetShim).dispatchEvent(ev);
  }

  dispose(): void {
    this.disposed = true;
    this.elementsById.clear();
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  private retain(el: GpuiElement): void {
    this.elementsById.set(el.id, el);
    for (const c of el.children) this.retain(c);
  }
}
