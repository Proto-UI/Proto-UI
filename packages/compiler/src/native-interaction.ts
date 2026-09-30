import { isDataValueType, type CompilerDiagnostic, type ExpressionIR, type FunctionIR, type PrototypeIR, type StatementIR } from './ir';
import { isAssignable } from './data-types';
import { FOCUS_OPTIONS_TYPE } from './operations';

const interactionFile = '.proto-ui/interaction/native-v1.ts';
const semanticEvents = [
  'press.start', 'press.end', 'press.cancel', 'press.commit', 'key.down', 'key.up',
  'pointer.down', 'pointer.move', 'pointer.up', 'pointer.cancel', 'pointer.enter', 'pointer.leave',
  'nav.focus', 'nav.blur', 'text.focus', 'text.blur', 'input', 'change', 'context.menu',
];
const stateAttributes: Record<string, string> = {
  atomic: 'aria-atomic', busy: 'aria-busy', checked: 'aria-checked', disabled: 'aria-disabled',
  expanded: 'aria-expanded', hasPopup: 'aria-haspopup', invalid: 'aria-invalid', live: 'aria-live',
  orientation: 'aria-orientation', pressed: 'aria-pressed', rowCount: 'aria-rowcount',
  columnCount: 'aria-colcount', rowIndex: 'aria-rowindex', columnIndex: 'aria-colindex',
  rowSpan: 'aria-rowspan', columnSpan: 'aria-colspan', readOnly: 'aria-readonly',
  selected: 'aria-selected', modal: 'aria-modal', hidden: 'aria-hidden',
};

/** Native v1 has one active DOM Root. No focus scopes/roving groups, portals or semantic-object relations. */
export function validateNativeInteraction(ir: PrototypeIR, reached?: ReadonlySet<FunctionIR>): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];
  function reject(expression: ExpressionIR, message: string) {
    diagnostics.push({ code: 'PUI_NATIVE_INTERACTION_UNSUPPORTED', category: 'unsupported-input', message, span: expression.span });
  }
  function visitFunction(fn: FunctionIR, inherited = new Map<string, ExpressionIR>()) {
    if (reached && !reached.has(fn)) return;
    const bindings = new Map(inherited);
    const resolve = (value: ExpressionIR): ExpressionIR => {
      const seen = new Set<string>();
      while (value.kind === 'reference' && bindings.has(value.name) && !seen.has(value.name)) {
        seen.add(value.name); value = bindings.get(value.name)!;
      }
      return value;
    };
    function shape(value: ExpressionIR | undefined, fields: readonly string[], operation: ExpressionIR) {
      if (!value) return;
      const record = resolve(value);
      if (record.kind !== 'record') { reject(operation, 'Native interaction options require a statically known record shape.'); return; }
      for (const entry of record.entries) {
        if (!fields.includes(entry.key)) reject(entry.value, 'Native interaction v1 does not support option ' + entry.key + '.');
      }
    }
    function expression(value: ExpressionIR) {
      if (value.kind === 'operation') {
        const args = value.arguments;
        if (value.operation === 'event.on' || value.operation === 'event.onGlobal') {
          const type = args[0] && resolve(args[0]);
          if (!type || type.kind !== 'literal' || typeof type.value !== 'string' ||
            !(semanticEvents.includes(type.value) || type.value.startsWith('host:') && type.value.length > 5)) {
            reject(value, 'Native interaction requires a supported static Proto input type or nonempty host:* extension.');
          } else if (!type.value.startsWith('host:') && args[2]) {
            reject(value, 'Portable semantic listeners do not accept capture/once/passive options; only host:* does.');
          }
          shape(args[2], ['capture', 'once', 'passive'], value);
        }
        if (value.operation === 'focus.configure') {
          shape(args[0], ['autoFocus', 'disabled', 'navParticipation', 'meta'], value);
          const patch = args[0] && resolve(args[0]);
          if (patch?.kind === 'record') for (const entry of patch.entries) {
            const setting = resolve(entry.value);
            if (entry.key === 'navParticipation' && !(setting.kind === 'literal' && ['auto', 'none'].includes(String(setting.value))))
              reject(entry.value, 'Native focus navParticipation must be the static value auto or none.');
            if (['autoFocus', 'disabled'].includes(entry.key) && setting.type !== 'boolean')
              reject(entry.value, 'Native focus ' + entry.key + ' must be boolean.');
          }
        }
        if (value.operation === 'focus.focusSelf' && args[0] &&
          !(isDataValueType(args[0].type) && isAssignable(args[0].type, {kind:'union',members:[FOCUS_OPTIONS_TYPE,'void']}))) {
          shape(args[0], ['reason', 'preventScroll'], value);
          const options = args[0] && resolve(args[0]);
          if (options?.kind === 'record') for (const entry of options.entries) {
            const setting = resolve(entry.value);
            if (entry.key === 'reason' && !(setting.kind === 'literal' && ['programmatic', 'keyboard', 'pointer'].includes(String(setting.value))))
              reject(entry.value, 'Native focus reason must be programmatic, keyboard or pointer.');
            if (entry.key === 'preventScroll' && setting.type !== 'boolean') reject(entry.value, 'Native focus preventScroll must be boolean.');
          }
        }
        if (value.operation === 'accessible.action') {
          shape(args[1], ['event'], value);
          const spec = args[1] && resolve(args[1]);
          if (spec?.kind === 'record' && spec.entries.some((entry) => entry.value.type !== 'string'))
            reject(value, 'Accessible action event must be an outward Expose event name.');
        }
        if (value.operation === 'accessible.state') {
          const key = args[0] && resolve(args[0]);
          if (!key || key.kind !== 'literal' || typeof key.value !== 'string' || !Object.hasOwn(stateAttributes, key.value))
            reject(value, 'Native accessibility v1 supports only the declared DOM ARIA state vocabulary and hidden.');
        }
        if (value.receiver) expression(value.receiver);
        for (const arg of args) expression(arg);
      } else if (value.kind === 'function') visitFunction(value.function, bindings);
      else if (value.kind === 'member') expression(value.object);
      else if (value.kind === 'unary') expression(value.operand);
      else if (value.kind === 'binary') { expression(value.left); expression(value.right); }
      else if (value.kind === 'array') value.elements.forEach(expression);
      else if (value.kind === 'record') value.entries.forEach((entry) => expression(entry.value));
      else if (value.kind === 'helper-call') value.arguments.forEach(expression);
      else if (value.kind === 'rule') { expression(value.receiver); value.states.forEach((entry) => expression(entry.value)); }
    }
    function statements(body: readonly StatementIR[]) {
      for (const statement of body) {
        if (statement.kind === 'const') { expression(statement.value); bindings.set(statement.name, statement.value); }
        else if (statement.kind === 'effect') expression(statement.expression);
        else if (statement.kind === 'return') { if (statement.value) expression(statement.value); }
        else { expression(statement.condition); const saved = new Map(bindings); statements(statement.then); bindings.clear(); saved.forEach((v,k) => bindings.set(k,v)); statements(statement.otherwise); bindings.clear(); saved.forEach((v,k) => bindings.set(k,v)); }
      }
    }
    statements(fn.body);
  }
  visitFunction(ir.setup);
  ir.hooks.forEach((hook) => visitFunction(hook.setup));
  return diagnostics;
}

export const nativeInteractionArtifact = { path: interactionFile, kind: 'source' as const, contents: nativeInteractionSource() };

function nativeInteractionSource(): string {
  return `// Native DOM interaction v1. No Proto package, interpreter or template rendering dependency.
export type NativeState<T = unknown> = { get(): T };
export type NativeObservedState<T> = NativeState<T> & { subscribe(callback: (event: { type: 'next'; prev: T; next: T; reason?: unknown }) => void): () => void };
export type NativeInput = Readonly<{ type: string; key?: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean; repeat?: boolean; control: Readonly<{ requestDefaultActionPrevention(options?: { reason?: string; source?: string }): void }> }>;
export type NativeHostOptions = Readonly<{ capture?: boolean; once?: boolean; passive?: boolean }>;
export type NativeFocusOptions = Readonly<{ reason?: 'programmatic' | 'keyboard' | 'pointer'; preventScroll?: boolean }>;
export type NativeFocus = {
  focused: NativeObservedState<boolean>; focusVisible: NativeObservedState<boolean>; focusable: NativeObservedState<boolean>;
  configure(patch: { autoFocus?: boolean; disabled?: boolean; navParticipation?: 'auto' | 'none'; meta?: Readonly<Record<string, unknown>> }): void;
  setDisabled(disabled: boolean): void; focusSelf(options?: NativeFocusOptions): void;
};
export type NativeAccessible = {
  state(key: string, state: NativeState): void;
  action(key: string, spec?: { event?: string }): void;
  role(role: string | NativeState<string>): void;
  nameFromContent(): void;
};
export type NativeListenerToken = { readonly id: string; readonly meta: { kind: 'root' | 'global'; type: string; options?: NativeHostOptions; label?: string }; desc(text: string): NativeListenerToken };
export type NativeEventChannel<Run> = {
  on<Type extends string>(type: Type, callback: (run: Run, event: Type extends \`host:\${string}\` ? Event : NativeInput) => void, options?: NativeHostOptions): NativeListenerToken;
  onGlobal<Type extends string>(type: Type, callback: (run: Run, event: Type extends \`host:\${string}\` ? Event : NativeInput) => void, options?: NativeHostOptions): NativeListenerToken;
};
export type NativeInteraction<Run = unknown> = {
  event: NativeEventChannel<Run>;
  asTrigger(): void; asFocusable(): NativeFocus; asAccessible(): NativeAccessible;
  refresh(): void; mount(): void; unmount(): void; dispose(): void;
};
type Registration<Run> = { type: string; kind: 'root' | 'global'; callback: (run: Run, event: NativeInput | Event) => void; options?: NativeHostOptions };
const semanticEvents: Record<string, true> = ${JSON.stringify(Object.fromEntries(semanticEvents.map((type) => [type, true])))};
const stateAttributes: Record<string, string> = ${JSON.stringify(stateAttributes)};
// All emitted components import this same artifact. Native owner roots form the
// supported DOM containment topology (not arbitrary ProtoRef/portal composition).
type RootOwner = { identity: object; trigger(): boolean };
const rootOwners = new WeakMap<HTMLElement, RootOwner>();
const mountedRoots = new Set<HTMLElement>();
const exposeSignals = new WeakSet<Event>();
/** Mark ONLY an outward Expose signal before dispatching it on the host. */
export function markNativeExposeEvent<T extends Event>(event: T): T { exposeSignals.add(event); return event; }

/**
 * The emitter owns execution/lifetime: guards use its exact callback scopes, invoke enters
 * its owner scope, getRun/getResolvedProps return current stable runtime/resolved props,
 * and getRoot returns ONLY the active host Root (never a child template element).
 * Call mount after Root binding and before mounted callbacks; unmount before Root removal
 * and unmounted callbacks; dispose on terminal or failed setup. Call refresh synchronously
 * after owned-state and resolved-props transitions, not through run.update. subscribeState
 * is optional if those transitions always refresh. registerObservedState adapts readonly
 * focus facts to the emitter's Expose external-state boundary. No outward Expose dispatch
 * is routed back into Proto input; accessible.action is metadata, not an input handler.
 */
export function createNativeInteraction<Run>(options: {
  ensureSetup(operation: string): void; ensureRuntime(operation: string): void; ensureEvent(operation: string): void;
  isAlive(): boolean; isReady?(): boolean; invoke<T>(callback: () => T): T;
  getRun(): Run; getResolvedProps(): Readonly<Record<string, unknown>>; getRoot(): HTMLElement | null;
  subscribeState?(state: NativeState, callback: () => void): () => void;
  registerObservedState?(state: NativeObservedState<boolean>): void;
}): NativeInteraction<Run> {
  let disposed = false, root: HTMLElement | null = null, generation = 0, trigger = false, focusDeclared = false;
  let disabled = false, autoFocus = false, navParticipation: 'auto' | 'none' = 'auto', keyboard = false;
  let pendingFocus: NativeFocusOptions | undefined, hasPendingFocus = false;
  let role: string | NativeState<string> | undefined, contentName = false;
  const identity = {}, registrations: Registration<Run>[] = [], removals: (() => void)[] = [], subscriptions: (() => void)[] = [];
  const states = new Map<string, NativeState>(), actions = new Map<string, { event?: string }>();
  const attributes = new Map<string, { baseline: string | null; projected: string | null }>();
  let sequence = 0, suppressKeyboardClick = false, pressKey: string | null = null, pointer: number | null = null;
  let globalPressKey: string | null = null, globalPointer: number | null = null, suppressGlobalKeyboardClick = false;
  let pointerCancelled = false;
  function alive() { if (disposed || !options.isAlive()) throw new Error('[Interaction] invalid after terminal disposal.'); }
  function active(epoch = generation, target = root) { return !disposed && options.isAlive() && !!target && target === root && options.getRoot() === target && generation === epoch && rootOwners.get(target)?.identity === identity; }
  function observed(initial: boolean): { handle: NativeObservedState<boolean>; set(next: boolean): void; clear(): void } {
    let value = initial;
    const callbacks = new Set<(event: { type: 'next'; prev: boolean; next: boolean; reason?: unknown }) => void>();
    const handle: NativeObservedState<boolean> = Object.freeze({
      get() { alive(); return value; },
      subscribe(callback: (event: { type: 'next'; prev: boolean; next: boolean; reason?: unknown }) => void) { alive(); callbacks.add(callback); return () => { callbacks.delete(callback); }; },
    });
    return { handle, set(next) { if (value === next) return; const prev = value; value = next; if (!disposed && options.isAlive() && (options.isReady?.() ?? true)) for (const callback of [...callbacks]) options.invoke(() => callback({ type: 'next', prev, next, reason: 'native-focus' })); }, clear() { callbacks.clear(); } };
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
    if (value === null || value === undefined || value === '') return null;
    if (key === 'rowCount' || key === 'columnCount') return typeof value === 'number' && Number.isSafeInteger(value) && (value === -1 || value > 0) ? String(value) : null;
    if (['rowIndex', 'columnIndex', 'rowSpan', 'columnSpan'].includes(key)) return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? String(value) : null;
    return String(value);
  }
  function refresh() {
    if (!active()) return;
    if (focusDeclared) project('tabindex', disabled || navParticipation === 'none' ? '-1' : '0');
    if (role !== undefined) project('role', read(role) || null);
    if (contentName) project('aria-label', null);
    for (const [key, state] of states) {
      const value = state.get();
      project(stateAttributes[key], scalar(key, value));
      if (key === 'hidden') project('hidden', value === true ? '' : null);
    }
    if (actions.size) project('data-pui-a11y-actions', [...actions.keys()].sort().join(' '));
  }
  function watch(state: NativeState) {
    if (options.subscribeState) subscriptions.push(options.subscribeState(state, refresh));
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
      if (registration.kind !== kind || registration.type !== type || !active(epoch, target)) continue;
      let deadline = true;
      const payload: { type: string; control: NativeInput['control']; key?: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean; repeat?: boolean } = { type, control: Object.freeze({
        requestDefaultActionPrevention(_request?: { reason?: string; source?: string }) {
          options.ensureEvent('event.control.requestDefaultActionPrevention');
          if (!deadline || !active(epoch, target)) throw new Error('[Event] default-action control is outside its callback window.');
          native.preventDefault();
        },
      }) };
      const source = native as unknown as Record<string, unknown>;
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
      focusable.set(!disabled); refresh();
    },
    setDisabled(next) {
      options.ensureRuntime('focus.setDisabled'); disabled = next; focusable.set(!next);
      if (next) { hasPendingFocus = false; if (root && root.ownerDocument.activeElement === root) root.blur(); focused.set(false); focusVisible.set(false); }
      refresh();
    },
    focusSelf(request) {
      options.ensureRuntime('focus.focusSelf');
      if (disabled) return;
      if (request?.reason === 'keyboard') keyboard = true;
      else if (request?.reason === 'pointer') keyboard = false;
      if (!active()) { pendingFocus = request; hasPendingFocus = true; return; }
      root!.focus({ preventScroll: request?.preventScroll });
    },
  };
  const accessible: NativeAccessible = {
    state(key, state) { options.ensureSetup('accessible.state'); if (!Object.hasOwn(stateAttributes, key)) throw new Error('[A11y] unsupported state.'); states.set(key, state); watch(state); refresh(); },
    action(key, spec = {}) { options.ensureSetup('accessible.action'); actions.set(key, { ...spec }); refresh(); },
    role(value) { options.ensureSetup('accessible.role'); role = value; if (typeof value !== 'string') watch(value); refresh(); },
    nameFromContent() { options.ensureSetup('accessible.nameFromContent'); contentName = true; refresh(); },
  };
  function unmount() {
    // Invalidate first: even a retained callback or a failing physical removal is inert.
    generation++;
    const previous = root; root = null;
    if (previous && rootOwners.get(previous)?.identity === identity) { rootOwners.delete(previous); mountedRoots.delete(previous); }
    let failure: unknown;
    for (const remove of removals.splice(0)) { try { remove(); } catch (error) { failure ??= error; } }
    if (previous) clearProjection(previous);
    pressKey = null; pointer = null; pointerCancelled = false; suppressKeyboardClick = false;
    globalPressKey = null; globalPointer = null; suppressGlobalKeyboardClick = false;
    focused.set(false); focusVisible.set(false);
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
    root = target; rootOwners.set(target, { identity, trigger: () => trigger }); mountedRoots.add(target);
    const epoch = generation, global = target.ownerDocument.defaultView ?? target.ownerDocument;
    const valid = () => active(epoch, target);
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
        if (!trigger) return nearest === target;
        if (!rootOwners.get(nearest)?.trigger()) return false;
        // A trigger group exposes its deepest active surface only. An ancestor
        // surface hit is rejected rather than translated into a child action.
        for (const descendant of mountedRoots) {
          if (descendant === nearest || !nearest.contains(descendant) || !rootOwners.get(descendant)?.trigger()) continue;
          let node: Node | null = descendant.parentNode;
          while (node && node !== nearest) { if (rootOwners.has(node as HTMLElement) && !rootOwners.get(node as HTMLElement)!.trigger()) break; node = node.parentNode; }
          if (node === nearest) return false;
        }
        if (nearest === target) return true;
        let node: Node | null = nearest.parentNode;
        while (node) {
          const owner = rootOwners.get(node as HTMLElement);
          if (owner) { if (!owner.trigger()) return false; if (owner.identity === identity) return true; }
          node = node.parentNode;
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
        const where = registration.kind === 'root' ? target : global;
        // Only events delivered by the DOM host reach raw host:* callbacks. Portable
        // payloads and outward CustomEvent Expose signals are never fed to this route.
        listen(where, hostType, (native: Event) => options.invoke(() => registration.callback(options.getRun(), native)), registration.options);
      }
      if (!focusDeclared && !registrations.some((entry) => !entry.type.startsWith('host:'))) { refresh(); return; }
      for (const [nativeName, semanticName] of [['pointerdown','pointer.down'],['pointermove','pointer.move'],['pointerup','pointer.up'],['pointercancel','pointer.cancel'],['pointerenter','pointer.enter'],['pointerleave','pointer.leave']] as const) {
        listen(target, nativeName, (native: PointerEvent) => {
          if (!owns(native)) return;
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
      listen(global, 'keydown', (native: KeyboardEvent) => {
        keyboard = true; globalEmit('key.down', native);
        if (native.key === 'Enter' || native.key === ' ') {
          if (globalPressKey === null) { globalPressKey = native.key; globalEmit('press.start', native); }
          suppressGlobalKeyboardClick = true; globalEmit('press.commit', native);
        } else suppressGlobalKeyboardClick = false;
        if (!valid() || !owns(native)) return;
        rootEmit('key.down', native);
        if (native.key !== 'Enter' && native.key !== ' ') { suppressKeyboardClick = false; return; }
        if (disabled) return;
        if (pressKey === null) { pressKey = native.key; rootEmit('press.start', native); }
        // Match the admitted router: Enter/Space commit on keydown, including repeat.
        // The exact repeat flag reaches callbacks; authors may suppress repeat there.
        if (!disabled) { suppressKeyboardClick = true; rootEmit('press.commit', native); }
      });
      listen(global, 'keyup', (native: KeyboardEvent) => {
        globalEmit('key.up', native);
        if (globalPressKey === native.key) { globalEmit('press.end', native); globalPressKey = null; }
        if (owns(native)) rootEmit('key.up', native);
        if (pressKey === native.key) { rootEmit('press.end', native); pressKey = null; }
      });
      listen(target, 'click', (native: MouseEvent) => {
        // Expose click is CustomEvent: only native mouse-shaped input activates.
        if (!owns(native) || typeof native.clientX !== 'number' || typeof native.button !== 'number' || typeof native.detail !== 'number') return;
        if (suppressKeyboardClick && native.detail === 0) { suppressKeyboardClick = false; return; }
        suppressKeyboardClick = false;
        if (pointerCancelled) { pointerCancelled = false; return; }
        if (!disabled && native.button === 0) rootEmit('press.commit', native);
      });
      for (const [name, semantic] of [['contextmenu','context.menu'],['input','input'],['change','change']] as const) listen(target, name, (native: Event) => { if (owns(native)) rootEmit(semantic, native); });
      listen(target, 'focus', (native: FocusEvent) => {
        if (focusDeclared && disabled) { target.blur(); return; }
        if (focusDeclared) { focused.set(true); focusVisible.set(keyboard); }
        rootEmit('nav.focus', native);
      });
      listen(target, 'blur', (native: FocusEvent) => {
        focused.set(false); focusVisible.set(false);
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
        });
      }
      listen(global, 'click', (native: MouseEvent) => {
        if (typeof native.clientX !== 'number' || typeof native.button !== 'number' || typeof native.detail !== 'number' || native.button !== 0) return;
        if (suppressGlobalKeyboardClick && native.detail === 0) { suppressGlobalKeyboardClick = false; return; }
        suppressGlobalKeyboardClick = false; globalEmit('press.commit', native);
      });
      for (const [name, semantic] of [['focusin','text.focus'],['focusout','text.blur']] as const) {
        listen(target, name, (native: Event) => { if (owns(native)) rootEmit(semantic, native); });
        if (registrations.some((entry) => entry.kind === 'global' && entry.type === semantic)) listen(global, name, (native: Event) => globalEmit(semantic, native));
      }
      refresh();
      if (focusDeclared && !disabled && (autoFocus || hasPendingFocus)) { const request = hasPendingFocus ? pendingFocus : undefined; hasPendingFocus = false; if (request?.reason === 'keyboard') keyboard = true; target.focus({ preventScroll: request?.preventScroll }); }
      if (focusDeclared) {
        const activeFocus = !disabled && target.ownerDocument.activeElement === target;
        focused.set(activeFocus);
        focusVisible.set(activeFocus && keyboard);
      }
    } catch (error) { try { unmount(); } catch {} throw error; }
  }
  return {
    event: { on: (type, callback, hostOptions) => register('root', type, callback, hostOptions), onGlobal: (type, callback, hostOptions) => register('global', type, callback, hostOptions) },
    asTrigger() { options.ensureSetup('hook.asTrigger'); trigger = true; },
    asFocusable() { options.ensureSetup('hook.asFocusable'); if (!focusDeclared) { focusDeclared = true; focusable.set(!disabled); options.registerObservedState?.(focused.handle); options.registerObservedState?.(focusVisible.handle); options.registerObservedState?.(focusable.handle); } return focus; },
    asAccessible() { options.ensureSetup('hook.asAccessible'); return accessible; },
    refresh, mount, unmount,
    dispose() {
      if (disposed) return;
      let failure: unknown;
      try { unmount(); } catch (error) { failure = error; }
      disposed = true;
      for (const off of subscriptions.splice(0)) { try { off(); } catch (error) { failure ??= error; } }
      registrations.length = 0; states.clear(); actions.clear(); focused.clear(); focusVisible.clear(); focusable.clear(); hasPendingFocus = false;
      if (failure) throw failure;
    },
  };
}
`;
}
