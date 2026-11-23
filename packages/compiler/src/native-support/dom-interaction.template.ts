import { emitRecordedNotification } from '../notification-plan';
/** Compiler-owned native event, focus and accessibility host atoms. */
export function domInteractionTemplate(
  semanticEvents: readonly string[],
  stateAttributes: Readonly<Record<string, string>>
): string {
  return `// Native DOM interaction v1. No Proto package, interpreter or template rendering dependency.
import { createNativeControlLabel } from './control-label-v1';
import { observeDirectionalPointerDown, observeDirectionalPointerUp, suppressDirectionalClick } from '../host-web/move-click-arbitration-v1';
import { type NativeConfig, type NativeControlLabel, createNativeAdapterModules, noteNativeFocusRequest, type NativeAccessibleExtension, type NativeModuleCapabilities, type NativeAdapterModuleOptions, type NativeStateEvent, type NativeOwnedState, type NativeOwnedStateSpec } from './adapter-modules-v1';
export type { NativeModuleCapability, NativeAnatomy, NativeAnatomyFamily, NativeAnatomyPart, NativeAnatomyOrder, NativeAnatomy as NativeAnatomyChannel } from './adapter-modules-v1';
export type NativeState<T = unknown> = { get(): T };
export type NativeObservedState<T> = NativeState<T> & { watch<R>(callback: (run: R, event: NativeStateEvent<T>) => void): () => void; subscribe(callback: (event: { type: 'next'; prev: T; next: T; reason?: unknown }) => void): () => void };
export type NativeInput = Readonly<{ type: string; pointerType?: 'mouse' | 'touch' | 'pen' | 'unknown'; pointerButtons?: 'none' | 'active' | 'unknown'; key?: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean; repeat?: boolean; control: Readonly<{ requestDefaultActionPrevention(options?: { reason?: string; source?: string }): void }> }>;
export type NativeHostOptions = Readonly<{ capture?: boolean; once?: boolean; passive?: boolean }>;
// Catch only the individual host fact read, never callback/default-action failures.
function readPointerSampleField(native: unknown, field: 'pointerType' | 'buttons'): unknown {
  if (!native || (typeof native !== 'object' && typeof native !== 'function')) return undefined;
  try { return (native as Record<string, unknown>)[field]; }
  catch { return undefined; }
}
export type NativeFocusOptions = Readonly<{ reason?: 'programmatic' | 'keyboard' | 'pointer'; preventScroll?: boolean }>;
export type NativeFocus = {
  focused: NativeObservedState<boolean>; focusVisible: NativeObservedState<boolean>; focusable: NativeObservedState<boolean>;
  configure(patch: { scopeKey?: object; groupKey?: object; autoFocus?: boolean; disabled?: boolean; navParticipation?: 'auto' | 'none'; meta?: Readonly<Record<string, unknown>> }): void;
  setDisabled(disabled: boolean): void; focus(options?: NativeFocusOptions): void; focusSelf(options?: NativeFocusOptions): void;
  blur(): void; isFocused(): boolean; setNavParticipation(value: 'auto' | 'none'): void; setRovingStatus(status: { selected?: boolean; active?: boolean }): void;
};
export type NativeAccessible = {
  state(key: string, state: NativeState): void;
  action(key: string, spec?: { event?: string }): void;
  role(role: string | NativeState<string>): void;
} & NativeAccessibleExtension;
export type NativeListenerToken = { readonly id: string; readonly meta: { kind: 'root' | 'global'; type: string; options?: NativeHostOptions; label?: string }; desc(text: string): NativeListenerToken };
export type NativeEventChannel<Run> = {
  on<Type extends string>(type: Type, callback: (run: Run, event: Type extends \`host:\${string}\` ? Event : NativeInput) => void, options?: NativeHostOptions): NativeListenerToken;
  onGlobal<Type extends string>(type: Type, callback: (run: Run, event: Type extends \`host:\${string}\` ? Event : NativeInput) => void, options?: NativeHostOptions): NativeListenerToken;
};
export type NativeInteraction<Run = unknown> = {
  event: NativeEventChannel<Run>;
  asTrigger(): void; asFocusable(): NativeFocus; asAccessible(): NativeAccessible; asControlLabel(): NativeControlLabel<Run>;
  projectAttributes(): Readonly<Record<string, string | null>>;
  adoptAttributes(snapshot: Readonly<Record<string, string | null>>, baselines?: Readonly<Record<string, string | null>>): void;
  refresh(): void; mount(): void; unmount(): void; dispose(): void;
} & Omit<NativeModuleCapabilities<Run>, 'projectAttributes' | 'refresh' | 'mount' | 'unmount' | 'dispose' | 'setFocusDisabled' | 'canFocus' | 'adoptControlState' | 'hasAuthoredControlLabelName' | 'beginControlLabelName' | 'controlLabelAnatomyScope' | 'subscribeControlLabelAnatomy'>;
type Registration<Run> = { type: string; kind: 'root' | 'global'; callback: (run: Run, event: NativeInput | Event) => void; options?: NativeHostOptions };
const semanticEvents: Record<string, true> = ${JSON.stringify(Object.fromEntries(semanticEvents.map((type) => [type, true])))};
const stateAttributes: Record<string, string> = ${JSON.stringify(stateAttributes)};
// Canonical logical owners survive view epochs; native targets identify physical input.
type RootOwner = { identity: object; parent(): object | null; trigger(): boolean; target: HTMLElement };
const rootOwners = new WeakMap<HTMLElement, RootOwner>();
const logicalOwners = new Map<object, RootOwner>();
const exposeSignals = new WeakSet<Event>();
const defaultPreventedSamples = new WeakSet<Event>();
/** Mark ONLY an outward Expose signal before dispatching it on the host. */
export function markNativeExposeEvent<T extends Event>(event: T): T { exposeSignals.add(event); return event; }

/**
 * The emitter owns execution/lifetime: guards use its exact callback scopes, invoke enters
 * its owner scope, getRun/getResolvedProps return current stable runtime/resolved props,
 * and getRoot returns the active physical Root. getHost is the canonical owner
 * boundary when a custom element realizes a separate native control target.
 * Call mount after Root binding and before mounted callbacks; unmount before Root removal
 * and unmounted callbacks; dispose on terminal or failed setup. Call refresh synchronously
 * after owned-state and resolved-props transitions, not through run.update. subscribeState
 * is optional if those transitions always refresh. registerObservedState adapts readonly
 * focus facts to the emitter's Expose external-state boundary. No outward Expose dispatch
 * is routed back into Proto input; accessible.action is metadata, not an input handler.
 * isSetupComplete gates observer callbacks, independently of physical input readiness:
 * setup initializes facts silently; a live owner still publishes resets after view detach.
 */
export function createNativeInteraction<Run>(options: {
  ensureSetup(operation: string): void; ensureRuntime(operation: string): void; ensureEvent(operation: string): void;
  isAlive(): boolean; isSetupComplete(): boolean; isReady?(): boolean; invoke<T>(callback: () => T): T;
  getRun(): Run; getResolvedProps(): Readonly<Record<string, unknown>>; getRoot(): HTMLElement | null; getHost?(): HTMLElement | null;
  subscribeState?(state: NativeState, callback: () => void): () => void;
  registerObservedState?(state: NativeObservedState<boolean>): void;
  declarations?: readonly { id: string; config: Readonly<Record<string, unknown>> }[];
  identity?: object;
  getAssociations?(): unknown;
  getLogicalParent?(): object | null;
  tableFamily?: import('./adapter-modules-v1').NativeAnatomyFamily;
  getExposes?(): Readonly<Record<string, unknown>>;
  setPresent?(value: boolean): void;
  requestHostUpdate?(): void;
  emit?(key: string): void;
  createOwnedState?<T extends boolean | string | number>(name: string, initial: T, spec?: NativeOwnedStateSpec): NativeOwnedState<T>;
  watchState?<T>(state: { get(): T }, callback: (run: Run, event: NativeStateEvent<T>) => void): () => void;
  isPropProvided?(key: string): boolean;
  getMeta?(key: string): unknown;
  registerExpose?(key: string, value: unknown): void;
  registerGenericObservedState?<T extends boolean | string | number>(state: NativeObservedState<T>): void;
}): NativeInteraction<Run> {
  let disposed = false, root: HTMLElement | null = null, host: HTMLElement | null = null, generation = 0, trigger = false, focusDeclared = false;
  let disabled = false, autoFocus = false, navParticipation: 'auto' | 'none' = 'auto', keyboard = false;
  let pendingFocus: NativeFocusOptions | undefined, hasPendingFocus = false, didAutoFocus = false;
  let role: string | NativeState<string> | undefined;
  const identity = options.identity ?? {}, registrations: Registration<Run>[] = [], removals: (() => void)[] = [], subscriptions: (() => void)[] = [];
  const states = new Map<string, NativeState>(), actions = new Map<string, { event?: string }>();
  const attributes = new Map<string, { baseline: string | null; projected: string | null }>();
  let sequence = 0, suppressKeyboardClick = false, pressKey: string | null = null, pointer: number | null = null;
  let globalPressKey: string | null = null, globalPointer: number | null = null, suppressGlobalKeyboardClick = false;
  let keyboardClickVersion = 0, globalKeyboardClickVersion = 0;
  let pointerCancelled = false;
  function alive() { if (disposed || !options.isAlive()) throw new Error('[Interaction] invalid after terminal disposal.'); }
  function active(epoch = generation, target = root) { return !disposed && options.isAlive() && !!target && target === root && options.getRoot() === target && generation === epoch && rootOwners.get(target)?.identity === identity; }
  function deliverable(epoch = generation, target = root) { return active(epoch, target) && (options.isReady?.() ?? true); }
  const nativeNotifications: (() => void)[] = [];
  let nativeNotifying = false;
  function observed(initial: boolean): { handle: NativeObservedState<boolean>; set(next: boolean): void; clear(): void } {
    let value = initial;
    const callbacks = new Set<(event: { type: 'next'; prev: boolean; next: boolean; reason?: unknown }) => void>();
    const handle: NativeObservedState<boolean> = Object.freeze({
      get() { alive(); return value; },
      watch<R>(callback: (run: R, event: NativeStateEvent<boolean>) => void) { alive(); options.ensureSetup('state.watch'); const listener = (event: { type: 'next'; prev: boolean; next: boolean; reason?: unknown }) => callback(options.getRun() as unknown as R, event); callbacks.add(listener); return () => { callbacks.delete(listener); }; },
      subscribe(callback: (event: { type: 'next'; prev: boolean; next: boolean; reason?: unknown }) => void) { alive(); const registration = (event: { type: 'next'; prev: boolean; next: boolean; reason?: unknown }) => callback(event); callbacks.add(registration); return () => { callbacks.delete(registration); }; },
    });
    return { handle, set(next) {
      if (value === next) return;
      const prev = value; value = next;
      if (!options.isSetupComplete()) return;
      const event = { type: 'next' as const, prev, next, reason: 'native-focus' };
      ${emitRecordedNotification({ queue: 'nativeNotifications', draining: 'nativeNotifying', subscribers: 'callbacks', alive: '!disposed && options.isAlive()', deliver: 'options.invoke(() => subscriber(event))' })}
    }, clear() { callbacks.clear(); } };
  }
  const focused = observed(false), focusVisible = observed(false), focusable = observed(false);
  function project(name: string, value: string | null) {
    if (!root) return;
    let ownership = attributes.get(name);
    const current = root.getAttribute(name);
    if (!ownership) { ownership = { baseline: current, projected: current }; attributes.set(name, ownership); }
    else if (current !== ownership.projected) ownership.baseline = current;
    if (current !== value) { if (value === null) root.removeAttribute(name); else root.setAttribute(name, value); }
    ownership.projected = value;
  }
  function clearProjection(target: HTMLElement) {
    for (const [name, ownership] of attributes) {
      if (target.getAttribute(name) !== ownership.projected) continue;
      if (ownership.baseline === null) target.removeAttribute(name); else target.setAttribute(name, ownership.baseline);
    }
    attributes.clear();
  }
  function read<T>(value: T | NativeState<T>): T { return typeof value === 'object' && value !== null && 'get' in value ? (value as NativeState<T>).get() : value as T; }
  function scalar(key: string, value: unknown): string | null {
    if (key === 'autocomplete') return typeof value === 'string' && ['none', 'inline', 'list', 'both'].includes(value) ? value : null;
    if (key === 'sort') return typeof value === 'string' && ['none', 'ascending', 'descending', 'other'].includes(value) ? value : null;
    if (key === 'current') return typeof value === 'boolean' ? String(value) : typeof value === 'string' && ['false', 'true', 'page', 'step', 'location', 'date', 'time'].includes(value) ? value : null;
    if (value === null || value === undefined || value === '') return null;
    if (['valueMin', 'valueMax', 'valueNow'].includes(key) && typeof value === 'string' && /^-?(?:0|[1-9][0-9]*)(?:[.][0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(value) && Number.isFinite(Number(value))) return value;
    if (['valueMin', 'valueMax', 'valueNow'].includes(key)) return typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
    if (key === 'valueText') return typeof value === 'string' ? value : null;
    if (key === 'rowCount' || key === 'columnCount' || key === 'setSize') return typeof value === 'number' && Number.isSafeInteger(value) && (value === -1 || value > 0) ? String(value) : null;
    if (['rowIndex', 'columnIndex', 'rowSpan', 'columnSpan', 'level', 'posInSet'].includes(key)) return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? String(value) : null;
    return String(value);
  }
  function visitProjection(write: (name: string, value: string | null) => void): void {
    if (__nativeFeature('focus') && focusDeclared) write('tabindex', disabled || navParticipation === 'none' ? '-1' : '0');
    if (__nativeFeature('a11y')) {
    if (role !== undefined) write('role', read(role) || null);
    for (const [key, state] of states) {
      if (!Object.hasOwn(stateAttributes, key)) continue;
      const value = state.get();
      write(stateAttributes[key], scalar(key, value));
      if (key === 'hidden') write('hidden', value === true ? '' : null);
    }
    if (actions.size) write('data-pui-a11y-actions', [...actions.keys()].sort().join(' '));
    }
  }
  function projectAttributes(): Readonly<Record<string, string | null>> {
    alive();
    const result: Record<string, string | null> = Object.create(null);
    visitProjection((name, value) => { result[name] = value; });
    return result;
  }
  function adoptAttributes(snapshot: Readonly<Record<string, string | null>>, baselines?: Readonly<Record<string, string | null>>): void {
    alive();
    if (root || attributes.size) throw new Error('[Interaction] hydration attributes must be adopted before first projection.');
    const target = options.getRoot();
    if (!target) throw new Error('[Interaction] hydration requires the adopted current Root.');
    for (const name of Object.keys(snapshot)) {
      const value = snapshot[name];
      if (target.getAttribute(name) !== value) continue;
      const baseline = baselines && Object.hasOwn(baselines, name) ? baselines[name] : null;
      attributes.set(name, { baseline, projected: value });
    }
    modules.adoptControlState();
  }
  function refresh() {
    if (!active()) return;
    const next = combinedProjectAttributes();
    for (const [name, ownership] of attributes) if (!Object.hasOwn(next, name)) {
      if (root!.getAttribute(name) === ownership.projected) { if (ownership.baseline === null) root!.removeAttribute(name); else root!.setAttribute(name, ownership.baseline); }
      attributes.delete(name);
    }
    for (const [name, value] of Object.entries(next)) project(name, value);
  }
  function watch(state: NativeState) {
    if (options.subscribeState) subscriptions.push(options.subscribeState(state, refresh));
    else if ('subscribe' in state && typeof state.subscribe === 'function') subscriptions.push((state as NativeObservedState<unknown>).subscribe(refresh));
  }
  function register<Type extends string>(kind: 'root' | 'global', type: Type, callback: (run: Run, event: Type extends \`host:\${string}\` ? Event : NativeInput) => void, hostOptions?: NativeHostOptions): NativeListenerToken {
    options.ensureSetup('event.' + (kind === 'root' ? 'on' : 'onGlobal'));
    if (!Object.hasOwn(semanticEvents, type) && !(type.startsWith('host:') && type.length > 5)) throw new Error('[Event] invalid input type.');
    if (!type.startsWith('host:') && hostOptions !== undefined) throw new Error('[Event] options are host:* only.');
    const copied = hostOptions === undefined ? undefined : Object.freeze({ ...hostOptions });
    // Delivery below selects the exact recorded type before selecting raw host or portable data.
    const typedCallback = callback as unknown as (run: Run, event: NativeInput | Event) => void;
    registrations.push({ kind, type, callback: typedCallback, options: copied });
    const meta = { kind, type, options: copied, label: undefined as string | undefined };
    const token: NativeListenerToken = { id: 'ev_' + ++sequence, meta, desc(text) { options.ensureSetup('event.token.desc'); if (text.trim()) meta.label = text.trim(); return token; } };
    return token;
  }
  function emit(kind: 'root' | 'global', type: string, native: Event, epoch: number, target: HTMLElement) {
    for (const registration of registrations) {
      if (registration.kind !== kind || registration.type !== type || !deliverable(epoch, target)) continue;
      let deadline = true;
      const payload: { type: string; pointerType?: NativeInput['pointerType']; pointerButtons?: NativeInput['pointerButtons']; control: NativeInput['control']; key?: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean; repeat?: boolean } = { type, control: Object.freeze({
        requestDefaultActionPrevention(_request?: { reason?: string; source?: string }) {
          options.ensureEvent('event.control.requestDefaultActionPrevention');
          if (!deadline || !deliverable(epoch, target)) throw new Error('[Event] default-action control is outside its callback window.');
          if (!defaultPreventedSamples.has(native)) { native.preventDefault(); defaultPreventedSamples.add(native); }
        },
      }) };
      const source = native as unknown as Record<string, unknown>;
      if (['pointer.down','pointer.move','pointer.up','pointer.cancel','pointer.enter','pointer.leave'].includes(type)) {
        const kind = readPointerSampleField(native, 'pointerType'), buttons = readPointerSampleField(native, 'buttons');
        payload.pointerType = kind === 'mouse' || kind === 'touch' || kind === 'pen' ? kind : 'unknown';
        payload.pointerButtons = typeof buttons === 'number' && Number.isFinite(buttons) && Number.isInteger(buttons) && buttons >= 0
          ? buttons === 0 ? 'none' : 'active' : 'unknown';
      }
      if (typeof source.key === 'string') payload.key = source.key;
      for (const field of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey', 'repeat'] as const) if (typeof source[field] === 'boolean') payload[field] = source[field];
      try { options.invoke(() => registration.callback(options.getRun(), Object.freeze(payload))); }
      finally { deadline = false; }
    }
  }
  const focus: NativeFocus = {
    focused: focused.handle, focusVisible: focusVisible.handle, focusable: focusable.handle,
    configure(patch) {
      options.ensureSetup('focus.configure');
      if (patch.autoFocus !== undefined) autoFocus = patch.autoFocus;
      if (patch.disabled !== undefined) disabled = patch.disabled;
      if (patch.navParticipation !== undefined) navParticipation = patch.navParticipation;
      modules.configureFocusable(patch);
      focusable.set(!disabled); refresh();
    },
    setDisabled(next) {
      alive(); options.ensureRuntime('focus.setDisabled'); disabled = next; modules.setFocusDisabled(next); focusable.set(!next);
      if (next) { hasPendingFocus = false; if (root && root.ownerDocument.activeElement === root) root.blur(); focused.set(false); focusVisible.set(false); }
      refresh();
    },
    focusSelf(request) {
      alive(); options.ensureRuntime('focus.focusSelf');
      if (disabled || !modules.canFocus()) return;
      if (!noteNativeFocusRequest()) return;
      if (request?.reason === 'keyboard') keyboard = true;
      else if (request?.reason === 'pointer') keyboard = false;
      if (!deliverable() || !root!.isConnected || root!.closest('[hidden],[inert],[data-pui-view-detached]')) { pendingFocus = request; hasPendingFocus = true; return; }
      root!.focus({ preventScroll: request?.preventScroll });
    },
    focus(request) { modules.focus(request); },
    blur() { alive(); options.ensureRuntime('focus.blur'); hasPendingFocus = false; modules.blur(); focused.set(false); focusVisible.set(false); },
    isFocused() { alive(); return focused.handle.get(); },
    setNavParticipation(value) { modules.setNavParticipation(value); navParticipation = value; refresh(); },
    setRovingStatus(status) { modules.setRovingStatus(status); },
  };
  const accessibleBase: Omit<NativeAccessible, keyof NativeAccessibleExtension> = {
    state(key, state) { options.ensureSetup('accessible.state'); states.set(key, state); watch(state); refresh(); },
    action(key, spec = {}) { options.ensureSetup('accessible.action'); actions.set(key, { ...spec }); refresh(); },
    role(value) { options.ensureSetup('accessible.role'); role = value; if (typeof value !== 'string') watch(value); refresh(); },
  };
  function unmount() {
    // Invalidate first: even a retained callback or a failing physical removal is inert.
    generation++;
    const previous = root, previousHost = host; root = null; host = null;
    if (previous && rootOwners.get(previous)?.identity === identity) rootOwners.delete(previous);
    if (previousHost && rootOwners.get(previousHost)?.identity === identity) rootOwners.delete(previousHost);
    logicalOwners.delete(identity);
    let failure: unknown;
    for (const remove of removals.splice(0)) { try { remove(); } catch (error) { failure ??= error; } }
    if (previous) clearProjection(previous);
    if (__nativeFeature('event')) { pressKey = null; pointer = null; pointerCancelled = false; suppressKeyboardClick = false;
    globalPressKey = null; globalPointer = null; suppressGlobalKeyboardClick = false; }
    if (__nativeFeature('focus')) { focused.set(false); focusVisible.set(false); }
    if (failure) throw failure;
  }
  function mount() {
    alive();
    const candidate = options.getRoot();
    if (root === candidate && active()) { refresh(); return; }
    unmount();
    alive();
    if (!candidate) return;
    const target: HTMLElement = candidate;
    root = target; host = options.getHost?.() ?? target;
    const rootOwner = { identity, parent: options.getLogicalParent ?? (() => null), trigger: () => trigger, target };
    rootOwners.set(target, rootOwner); rootOwners.set(host, rootOwner); logicalOwners.set(identity, rootOwner);
    if (__nativeFeature('event')) {
    const epoch = generation, global = target.ownerDocument.defaultView ?? target.ownerDocument;
    const valid = () => deliverable(epoch, target);
    function listen<E extends Event>(where: EventTarget, name: string, callback: (event: E) => void, hostOptions?: NativeHostOptions) {
      let live = true;
      // DOM dispatch guarantees each built-in event's shape for its registered native name.
      const wrapped = (event: Event) => { if (live && valid() && !exposeSignals.has(event)) callback(event as E); };
      where.addEventListener(name, wrapped, hostOptions);
      removals.push(() => { live = false; where.removeEventListener(name, wrapped, hostOptions); });
    }
    function owns(native: Event): boolean {
      const path = typeof native.composedPath === 'function' ? native.composedPath() : [];
      let nearest: HTMLElement | undefined;
      for (const entry of path) {
        const owner = rootOwners.get(entry as HTMLElement);
        if (owner) { nearest = entry as HTMLElement; break; }
      }
      // Active-element fallback covers keyboard samples dispatched on window.
      if (!nearest && (native.target === global || native.target === target.ownerDocument)) {
        let node: Node | null = target.ownerDocument.activeElement;
        while (node) { if (rootOwners.has(node as HTMLElement)) { nearest = node as HTMLElement; break; } node = node.parentNode; }
      }
      if (nearest) {
        if (!trigger) return rootOwners.get(nearest)?.identity === identity;
        if (!rootOwners.get(nearest)?.trigger()) return false;
        // A trigger group exposes its deepest active surface only. An ancestor
        // surface hit is rejected rather than translated into a child action.
        const nearestOwner = rootOwners.get(nearest)!;
        for (const descendant of logicalOwners.values()) {
          if (descendant === nearestOwner || !descendant.trigger()) continue;
          const visited = new Set<object>();
          let current: RootOwner | undefined = descendant;
          while (current && !visited.has(current.identity)) { visited.add(current.identity); const parent = current.parent(); current = parent ? logicalOwners.get(parent) : undefined; if (current === nearestOwner) return false; if (current && !current.trigger()) break; }
        }
        if (nearestOwner.identity === identity) return true;
        let current: RootOwner | undefined = nearestOwner;
        const visited = new Set<object>();
        while (current && !visited.has(current.identity)) {
          visited.add(current.identity); const parent = current.parent(); current = parent ? logicalOwners.get(parent) : undefined;
          if (current) { if (!current.trigger()) return false; if (current.identity === identity) return true; }
        }
        return false;
      }
      const hit = native.target as Node | null;
      if (hit && target.contains(hit)) return true;
      const activeElement = target.ownerDocument.activeElement;
      return (native.target === global || native.target === target.ownerDocument) && !!activeElement && target.contains(activeElement);
    }
    const rootEmit = (type: string, native: Event) => emit('root', type, native, epoch, target);
    const globalEmit = (type: string, native: Event) => emit('global', type, native, epoch, target);
    try {
      for (const registration of registrations) {
        if (!registration.type.startsWith('host:')) continue;
        const hostType = registration.type.slice(5);
        const where = registration.kind === 'root' ? host! : global;
        // Only events delivered by the DOM host reach raw host:* callbacks. Portable
        // payloads and outward CustomEvent Expose signals are never fed to this route.
        listen(where, hostType, (native: Event) => options.invoke(() => registration.callback(options.getRun(), native)), registration.options);
      }
      if (!focusDeclared && !registrations.some((entry) => !entry.type.startsWith('host:'))) { refresh(); return; }
      for (const [nativeName, semanticName] of [['pointerdown','pointer.down'],['pointermove','pointer.move'],['pointerup','pointer.up'],['pointercancel','pointer.cancel'],['pointerenter','pointer.enter'],['pointerleave','pointer.leave']] as const) {
        listen(target, nativeName, (native: PointerEvent) => {
          if (!owns(native)) return;
          if (__nativeFeature('axis-input')) { if (nativeName === 'pointerdown') observeDirectionalPointerDown(target, native); else if (nativeName === 'pointerup') observeDirectionalPointerUp(target, native); }
          rootEmit(semanticName, native);
          if (!valid()) return;
          if (nativeName === 'pointerdown') { keyboard = false; suppressKeyboardClick = false; if (!disabled && native.button === 0 && pointer === null) { pointer = native.pointerId; pointerCancelled = false; rootEmit('press.start', native); } }
          else if ((nativeName === 'pointercancel' || nativeName === 'pointerleave') && pointer !== null) { pointerCancelled = true; rootEmit('press.cancel', native); pointer = null; }
          else if (nativeName === 'pointerup' && pointer === native.pointerId) { rootEmit('press.end', native); pointer = null; }
        });
      }
      // Release outside Root cancels a held pointer. Commit belongs to click, not
      // pointerup, so a real pointerup+click sequence cannot double-activate.
      listen(global, 'pointerup', (native: PointerEvent) => { if (pointer === native.pointerId && !owns(native)) { rootEmit('press.cancel', native); pointer = null; pointerCancelled = true; } });
      listen(global, 'pointercancel', (native: PointerEvent) => { if (pointer === native.pointerId) { rootEmit('pointer.cancel', native); rootEmit('press.cancel', native); pointer = null; pointerCancelled = true; } });
      const handledKeys = new WeakSet<Event>();
      // A marker belongs to one dispatch, even when a host reuses an Event object.
      // Capture runs before both the physical route and the Window fallback.
      for (const name of ['keydown', 'keyup']) {
        listen(global, name, native => { handledKeys.delete(native); }, { capture: true });
        listen(target, name, native => { handledKeys.delete(native); }, { capture: true });
      }
      const rootKeyDown = (native: KeyboardEvent) => {
        if (!valid() || !owns(native)) return;
        handledKeys.add(native); keyboard = true;
        rootEmit('key.down', native);
        if (native.key !== 'Enter' && native.key !== ' ') { suppressKeyboardClick = false; return; }
        if (disabled) return;
        if (pressKey === null) { pressKey = native.key; rootEmit('press.start', native); }
        // Match the admitted router: Enter/Space commit on keydown, including repeat.
        // The exact repeat flag reaches callbacks; authors may suppress repeat there.
        if (!disabled) { suppressKeyboardClick = true; ++keyboardClickVersion; rootEmit('press.commit', native); }
      };
      const rootKeyUp = (native: KeyboardEvent) => {
        if (!valid()) return;
        if (native.key === 'Enter' || native.key === ' ') {
          const released = keyboardClickVersion;
          queueMicrotask(() => { if (valid() && released === keyboardClickVersion) suppressKeyboardClick = false; });
        }
        handledKeys.add(native);
        if (owns(native)) rootEmit('key.up', native);
        if (pressKey === native.key) { rootEmit('press.end', native); pressKey = null; }
      };
      // Root input is delivered at its physical target, before a host composition
      // boundary can stop bubbling. Window remains the global/fallback route.
      listen(target, 'keydown', rootKeyDown);
      listen(target, 'keyup', rootKeyUp);
      listen(global, 'keydown', (native: KeyboardEvent) => {
        keyboard = true; globalEmit('key.down', native);
        if (native.key === 'Enter' || native.key === ' ') {
          if (globalPressKey === null) { globalPressKey = native.key; globalEmit('press.start', native); }
          suppressGlobalKeyboardClick = true; ++globalKeyboardClickVersion; globalEmit('press.commit', native);
        } else suppressGlobalKeyboardClick = false;
        if (!handledKeys.has(native)) rootKeyDown(native);
      });
      listen(global, 'keyup', (native: KeyboardEvent) => {
        if (native.key === 'Enter' || native.key === ' ') {
          const released = globalKeyboardClickVersion;
          queueMicrotask(() => { if (valid() && released === globalKeyboardClickVersion) suppressGlobalKeyboardClick = false; });
        }
        globalEmit('key.up', native);
        if (globalPressKey === native.key) { globalEmit('press.end', native); globalPressKey = null; }
        if (!handledKeys.has(native)) rootKeyUp(native);
      });
      listen(target, 'click', (native: MouseEvent) => {
        // Expose click is CustomEvent: only native mouse-shaped input activates.
        if (!owns(native) || typeof native.clientX !== 'number' || typeof native.button !== 'number' || typeof native.detail !== 'number') return;
        if (__nativeFeature('axis-input') && suppressDirectionalClick(target, native)) return;
        if (suppressKeyboardClick && native.detail === 0) { suppressKeyboardClick = false; return; }
        suppressKeyboardClick = false;
        if (pointerCancelled) { pointerCancelled = false; return; }
        if (!disabled && native.button === 0) rootEmit('press.commit', native);
      });
      for (const [name, semantic] of [['contextmenu','context.menu'],['input','input'],['change','change']] as const) listen(target, name, (native: Event) => { if (owns(native)) rootEmit(semantic, native); });
      listen(target, 'focus', (native: FocusEvent) => {
        if (__nativeFeature('focus') && focusDeclared && disabled) { target.blur(); return; }
        if (__nativeFeature('focus') && focusDeclared && !noteNativeFocusRequest()) return;
        if (__nativeFeature('focus') && focusDeclared) { focused.set(true); focusVisible.set(keyboard); }
        rootEmit('nav.focus', native);
      });
      listen(target, 'blur', (native: FocusEvent) => {
        if (__nativeFeature('focus')) { focused.set(false); focusVisible.set(false); }
        if (pressKey !== null) { rootEmit('press.cancel', native); pressKey = null; }
        rootEmit('nav.blur', native);
      });
      listen(global, 'blur', (native: Event) => {
        if (pressKey !== null || pointer !== null) rootEmit('press.cancel', native);
        if (globalPressKey !== null || globalPointer !== null) globalEmit('press.cancel', native);
        pressKey = null; pointer = null; globalPressKey = null; globalPointer = null;
      });
      // Global semantic registrations use real native events, independent of Root hit.
      for (const [name, semantic] of [['pointerdown','pointer.down'],['pointermove','pointer.move'],['pointerup','pointer.up'],['pointercancel','pointer.cancel'],['pointerenter','pointer.enter'],['pointerleave','pointer.leave'],['contextmenu','context.menu'],['input','input'],['change','change'],['focus','nav.focus'],['blur','nav.blur']] as const) {
        const globalPress = name.startsWith('pointer') && registrations.some((entry) => entry.kind === 'global' && entry.type.startsWith('press.'));
        if (globalPress || registrations.some((entry) => entry.kind === 'global' && entry.type === semantic)) listen(global, name, (native: Event) => {
          globalEmit(semantic, native);
          if (!globalPress) return;
          const event = native as PointerEvent;
          if (name === 'pointerdown' && event.button === 0 && globalPointer === null) { globalPointer = event.pointerId; globalEmit('press.start', native); }
          else if (name === 'pointerup' && globalPointer === event.pointerId) { globalPointer = null; globalEmit('press.end', native); }
          else if (name === 'pointercancel' && globalPointer === event.pointerId) { globalPointer = null; globalEmit('press.cancel', native); }
        }, { capture: name === 'pointerenter' || name === 'pointerleave' });
      }
      listen(global, 'click', (native: MouseEvent) => {
        if (typeof native.clientX !== 'number' || typeof native.button !== 'number' || typeof native.detail !== 'number' || native.button !== 0) return;
        if (__nativeFeature('axis-input') && suppressDirectionalClick(target, native)) return;
        if (suppressGlobalKeyboardClick && native.detail === 0) { suppressGlobalKeyboardClick = false; return; }
        suppressGlobalKeyboardClick = false; globalEmit('press.commit', native);
      });
      for (const [name, semantic] of [['focusin','text.focus'],['focusout','text.blur']] as const) {
        listen(target, name, (native: Event) => { if (owns(native)) rootEmit(semantic, native); });
        if (registrations.some((entry) => entry.kind === 'global' && entry.type === semantic)) listen(global, name, (native: Event) => globalEmit(semantic, native));
      }
      refresh();
      if (__nativeFeature('focus') && focusDeclared && !disabled && (!didAutoFocus && autoFocus || hasPendingFocus)) {
        didAutoFocus = true;
        if (deliverable(epoch, target)) { const request = hasPendingFocus ? pendingFocus : undefined; hasPendingFocus = false; options.invoke(() => focus.focusSelf(request)); }
        else hasPendingFocus = true;
      }
      if (__nativeFeature('focus') && focusDeclared) {
        const activeFocus = !disabled && target.ownerDocument.activeElement === target;
        focused.set(activeFocus);
        focusVisible.set(activeFocus && keyboard);
      }
    } catch (error) { try { unmount(); } catch {} throw error; }
    }
    refresh();
  }
  const modules: NativeModuleCapabilities<Run> = createNativeAdapterModules<Run>({
    ensureSetup: options.ensureSetup, ensureRuntime: options.ensureRuntime, ensureEvent: options.ensureEvent,
    isAlive: () => !disposed && options.isAlive(), isSetupComplete: options.isSetupComplete, isReady: options.isReady, invoke: options.invoke, getRun: options.getRun,
    getResolvedProps: options.getResolvedProps, getRoot: options.getRoot, getHost: options.getHost,
    declarations: options.declarations ?? [],
    identity,
    getLogicalParent: options.getLogicalParent ?? (() => null),
    tableFamily: options.tableFamily,
    registerObservedState: options.registerGenericObservedState,
    getExposes: options.getExposes,
    setPresent: options.setPresent,
    requestHostUpdate: options.requestHostUpdate,
    emit: options.emit,
    createOwnedState: options.createOwnedState,
    watchState: options.watchState,
    isPropProvided: options.isPropProvided,
    getMeta: options.getMeta,
    registerExpose: options.registerExpose,
    baseFocus: __nativeFeature('focus') ? () => focus : undefined,
    cancelPendingFocus() { if (__nativeFeature('focus')) { pendingFocus = undefined; hasPendingFocus = false; } },
    getAccessibleRole: __nativeFeature('a11y') ? () => role === undefined ? null : read(role) || null : undefined,
    requestAttributeRefresh: refresh,
    getAttributeBaseline: (name) => attributes.has(name) ? attributes.get(name)!.baseline : root?.getAttribute(name) ?? null,
    subscribeState: options.subscribeState,
  } satisfies NativeAdapterModuleOptions<Run>);
  function combinedProjectAttributes(): Readonly<Record<string, string | null>> {
    const base = projectAttributes();
    const extended = modules.projectAttributes();
    return Object.freeze({ ...base, ...extended });
  }
  const accessible: NativeAccessible = Object.freeze({ ...accessibleBase, ...modules.accessible });
  const controlLabel = __nativeFeature('control-label') ? createNativeControlLabel<Run>({
    identity, ensureSetup: options.ensureSetup, isAlive: () => !disposed && options.isAlive(), isSetupComplete: options.isSetupComplete, isReady: options.isReady,
    getRoot: options.getRoot, getAssociations: options.getAssociations ?? (() => undefined), getRun: options.getRun, invoke: options.invoke,
    hasAuthoredName: () => modules.hasAuthoredControlLabelName!(), beginNameProjection: () => modules.beginControlLabelName!(), resolveAnatomy: (pair, kind) => modules.controlLabelAnatomyScope!(pair, kind),
    subscribeAnatomy: callback => modules.subscribeControlLabelAnatomy!(callback),
  }) : null;
  return {
    event: { on: (type, callback, hostOptions) => register('root', type, callback, hostOptions), onGlobal: (type, callback, hostOptions) => register('global', type, callback, hostOptions) },
    asTrigger() { options.ensureSetup('hook.asTrigger'); trigger = true; },
    asFocusable() { options.ensureSetup('hook.asFocusable'); if (!focusDeclared) { focusDeclared = true; focusable.set(!disabled); const register = options.registerGenericObservedState ?? options.registerObservedState; register?.(focused.handle); register?.(focusVisible.handle); register?.(focusable.handle); } modules.configureFocusable({}); return focus; },
    asAccessible() { options.ensureSetup('hook.asAccessible'); return accessible; },
    asControlLabel() { options.ensureSetup('hook.asControlLabel'); if (!controlLabel) throw new Error('[ControlLabel] undeclared native association channel'); return controlLabel.facade; },
    anatomy: modules.anatomy, accessible: modules.accessible,
    positioning: modules.positioning,
    asFocusEntry: () => modules.asFocusEntry(), asFocusRoving: () => modules.asFocusRoving(), asFocusScope: () => modules.asFocusScope(),
    asCollection: () => modules.asCollection(), asCollectionItem: () => modules.asCollectionItem(),
    asBoundary: () => modules.asBoundary(), asHitParticipation: (config?: NativeConfig) => modules.asHitParticipation(config),
    asOverlay: () => modules.asOverlay(), asScrollSurface: () => modules.asScrollSurface(),
    asTextControl: () => modules.asTextControl(), asImageView: () => modules.asImageView(),
    asNativeLink: () => modules.asNativeLink(),
    asAxisInput: () => modules.asAxisInput(),
    asTableStructure: (partRole: string) => modules.asTableStructure(partRole),
    configureFocusable: (config) => modules.configureFocusable(config),
    setNavParticipation: (value) => modules.setNavParticipation(value),
    setRovingStatus: (status) => modules.setRovingStatus(status),
    focus: (request) => modules.focus(request), blur: () => modules.blur(),
    rootTag: () => modules.rootTag(), rootProperties: () => modules.rootProperties(), portalTarget: () => modules.portalTarget(),
    viewPolicy: () => modules.viewPolicy(),
    commitHost: () => modules.commitHost(),
    projectAttributes: combinedProjectAttributes, adoptAttributes,
    refresh() { modules.refresh(); refresh(); if (__nativeFeature('control-label')) controlLabel?.refresh(); if (__nativeFeature('focus') && hasPendingFocus && deliverable() && root!.isConnected && !disabled) { const request = pendingFocus; hasPendingFocus = false; options.invoke(() => focus.focusSelf(request)); } },
    mount() { mount(); modules.mount(); if (__nativeFeature('control-label')) controlLabel?.mount(); },
    unmount() {
      let failed = false, failure: unknown;
      const attempt = (cleanup: () => void) => { try { cleanup(); } catch (error) { if (!failed) { failed = true; failure = error; } } };
      if (__nativeFeature('control-label')) attempt(() => controlLabel?.unmount());
      attempt(() => modules.unmount()); attempt(unmount);
      if (failed) throw failure;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      let failed = false, failure: unknown;
      const attempt = (cleanup: () => void) => { try { cleanup(); } catch (error) { if (!failed) { failed = true; failure = error; } } };
      if (__nativeFeature('control-label')) attempt(() => controlLabel?.dispose());
      attempt(() => modules.unmount()); attempt(unmount); attempt(() => modules.dispose());
      for (const off of subscriptions.splice(0)) attempt(off);
      if (__nativeFeature('event')) registrations.length = 0;
      if (__nativeFeature('a11y')) { states.clear(); actions.clear(); }
      if (__nativeFeature('focus')) { nativeNotifications.length = 0; focused.clear(); focusVisible.clear(); focusable.clear(); hasPendingFocus = false; }
      if (failed) throw failure;
    },
  };
}
`;
}
