import type { GeneratedModule } from './ir';

/**
 * Reached atomic host support for C-FEEDBACK-PRESENCE-PRESENTATION-0001.
 * No Transition protocol, authored state machine, Rule IR or framework runtime is copied here.
 * The authored owner publishes phases; this host can only return exact application receipts.
 */
export const nativePresencePresentationArtifact: NonNullable<
  GeneratedModule['supportingFiles']
>[number] = {
  path: '.proto-ui/presentation/presence-web-v1.ts',
  kind: 'source',
  contents: String.raw`export type NativePresentationRef = Readonly<object>;
export type NativePresentationWriter = Readonly<object>;
export type NativeAttempt = Readonly<{ ownerEpoch: number; phaseAttempt: number }>;
export type NativeCompletionConfig = 'timer' | Readonly<{kind: 'presentation'; timeoutMs: number}>;
export type NativePresentationOutcome = 'finished' | 'reduced-motion' | 'unknown-preference' | 'hidden' | 'missing-capability' | 'unsupported-endpoint' | 'unresolved-units' | 'unresolved-input' | 'projection-failed' | 'projection-ownership-lost' | 'deadline' | 'zero-duration' | 'invalid-policy' | 'scheduler-failed';
export type NativePresentationFrame = Readonly<{owner: object; revision: number; phase: 'closed' | 'preparing' | 'entering' | 'entered' | 'leaving'; attempt: NativeAttempt | null; completion: 'timer' | 'presentation'; durationMs: number; timeoutMs: number | null}>;
export type NativePresentationReceipt = Readonly<{owner: object; attempt: NativeAttempt; viewBinding: object; ownerRevision: number; targetRevision: number; channels: readonly ('translate' | 'opacity' | 'top' | 'blockSize')[]; outcome: NativePresentationOutcome}>;
export interface NativePresenceOwner<Run> {readonly ref: object; readonly writer: object; onCompletionRequest(callback: (run: Run, request: Readonly<{receipt: NativePresentationReceipt}>) => void): void}
type Axis = Readonly<{px: number; rootText: number; ownBox: number}>;
type Pair = readonly [Axis, Axis];
type Source = Readonly<{get(): string}>;
type Selection = Readonly<{source: Source; cases: Readonly<Record<string, Pair>>}>;
type Endpoint = Readonly<{translate?: Pair | Selection; opacity?: number}>;
type Recipe = Readonly<{owner: object; closed: Endpoint; entered: Endpoint; easing: readonly number[]}>;
type Vector = readonly [number, number, number];
type Write = {value: string; priority: string};
const fields = (value: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('[Presentation] expected own data record');
  const keys = Reflect.ownKeys(value), result: Record<string, unknown> = Object.create(null);
  if (keys.some(key => typeof key !== 'string' || !required.includes(key) && !optional.includes(key))) throw new TypeError('[Presentation] unknown field');
  for (const key of keys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) throw new TypeError('[Presentation] own data fields required');
    result[key] = descriptor.value;
  }
  if (required.some(key => !Object.hasOwn(result, key))) throw new TypeError('[Presentation] missing field');
  return result;
};
function finite(value: unknown, min = -Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) throw new TypeError('[Presentation] invalid finite number');
  return value;
}
function integer(value: unknown): number {
  const n = finite(value, 0); if (!Number.isSafeInteger(n)) throw new TypeError('[Presentation] invalid revision'); return n;
}
function dense(value: unknown, length: number): unknown[] {
  if (!Array.isArray(value) || value.length !== length || Reflect.ownKeys(value).some(key => key !== 'length' && (typeof key !== 'string' || !Array.from({length}, (_, i) => String(i)).includes(key)))) throw new TypeError('[Presentation] dense tuple required');
  return Array.from({length}, (_, i) => {const d = Object.getOwnPropertyDescriptor(value, String(i)); if (!d || !('value' in d)) throw new TypeError('[Presentation] tuple data required'); return d.value;});
}
function pair(value: unknown): Pair {
  const result = dense(value, 2).map(item => {const data = fields(item, ['px', 'rootText', 'ownBox']); return Object.freeze({px: finite(data.px), rootText: finite(data.rootText), ownBox: finite(data.ownBox)});});
  return Object.freeze(result) as unknown as Pair;
}
function endpoint(value: unknown, sources: WeakSet<object>): Endpoint {
  const data = fields(value, [], ['translate', 'opacity']);
  if (!Object.keys(data).length) throw new TypeError('[Presentation] empty endpoint');
  const result: {translate?: Pair | Selection; opacity?: number} = {};
  if (Object.hasOwn(data, 'opacity')) {result.opacity = finite(data.opacity, 0); if (result.opacity > 1) throw new TypeError('[Presentation] invalid opacity');}
  if (Object.hasOwn(data, 'translate')) {
    if (Array.isArray(data.translate)) result.translate = pair(data.translate);
    else {
      const selected = fields(data.translate, ['source', 'cases']);
      if (!selected.source || typeof selected.source !== 'object' || !sources.has(selected.source)) throw new TypeError('[Presentation] foreign selection State');
      if (!selected.cases || typeof selected.cases !== 'object' || Array.isArray(selected.cases)) throw new TypeError('[Presentation] invalid cases');
      const keys = Reflect.ownKeys(selected.cases), cases: Record<string, Pair> = Object.create(null);
      if (!keys.length || keys.some(key => typeof key !== 'string')) throw new TypeError('[Presentation] finite cases required');
      for (const key of keys as string[]) {const d = Object.getOwnPropertyDescriptor(selected.cases, key); if (!d || !('value' in d)) throw new TypeError('[Presentation] case data required'); cases[key] = pair(d.value);}
      result.translate = Object.freeze({source: selected.source as Source, cases: Object.freeze(cases)});
    }
  }
  return Object.freeze(result);
}
export function snapshotNativeCompletion(value: NativeCompletionConfig): NativeCompletionConfig {
  if (value === 'timer') return value;
  const data = fields(value, ['kind', 'timeoutMs']);
  const timeoutMs = finite(data.timeoutMs, 0);
  if (data.kind !== 'presentation' || timeoutMs === 0) throw new TypeError('[Presentation] invalid completion policy');
  return Object.freeze({kind: 'presentation', timeoutMs});
}
function snapshotFrame(value: NativePresentationFrame): NativePresentationFrame {
  const data = fields(value, ['owner', 'revision', 'phase', 'attempt', 'completion', 'durationMs', 'timeoutMs']);
  if (!data.owner || typeof data.owner !== 'object' || !['closed','preparing','entering','entered','leaving'].includes(data.phase as string) || !['timer','presentation'].includes(data.completion as string)) throw new TypeError('[Presentation] invalid owner frame');
  const timeoutMs = data.timeoutMs === null ? null : finite(data.timeoutMs, 0);
  if ((data.completion === 'timer') !== (timeoutMs === null) || timeoutMs === 0) throw new TypeError('[Presentation] invalid frame timeout');
  let attempt: NativeAttempt | null = null;
  if (data.attempt !== null) {const a = fields(data.attempt, ['ownerEpoch', 'phaseAttempt']); attempt = Object.freeze({ownerEpoch: integer(a.ownerEpoch), phaseAttempt: integer(a.phaseAttempt)});}
  if ((data.phase === 'entering' || data.phase === 'leaving') !== (attempt !== null)) throw new TypeError('[Presentation] invalid attempt');
  return Object.freeze({owner: data.owner, revision: integer(data.revision), phase: data.phase as NativePresentationFrame['phase'], attempt, completion: data.completion as 'timer' | 'presentation', durationMs: finite(data.durationMs, 0), timeoutMs});
}
const same = (a: readonly number[] | null, b: readonly number[]) => !!a && a.length === b.length && a.every((n, i) => n === b[i]);
const clamp = (n: number) => Math.max(0, Math.min(1, n));
function ease(progress: number, curve: readonly number[]): number {
  if (progress <= 0 || progress >= 1) return clamp(progress);
  const cubic = (t: number, a: number, b: number) => 3*(1-t)*(1-t)*t*a + 3*(1-t)*t*t*b + t*t*t;
  let low = 0, high = 1;
  for (let i = 0; i < 48; i++) {const t = (low + high)/2; if (cubic(t, curve[0], curve[2]) < progress) low = t; else high = t;}
  return cubic((low + high)/2, curve[1], curve[3]);
}
/** Native frame/lease implementation. Phase selection remains entirely in authored source. */
export function createNativePresence<Run>(options: {
  setup(): void; runtime(): void; alive(): boolean; invoke(callback: (run: Run) => void): void;
  root(): HTMLElement | null; prepare(): void;
}) {
  type Owner = {ref: object; writer: object; frame: NativePresentationFrame | null; callback: ((run: Run, request: Readonly<{receipt: NativePresentationReceipt}>) => void) | null; pending: NativePresentationReceipt | null; targetRevision: number; targetKey: string | null; binding: object | null; attemptKey: string | null; deadline: number | null};
  const writers = new Map<object, Owner>(), refs = new Map<object, Owner>(), sources = new WeakSet<object>();
  let recipe: Recipe | null = null, disposed = false, mounted = false, preparing = false, queuedRefresh = false;
  let view: HTMLElement | null = null, doc: Document | null = null, binding = Object.freeze({}), epoch = 0;
  let raf: number | null = null, timer: ReturnType<typeof setTimeout> | null = null, off: (() => void) | null = null;
  let display: Vector | null = null, target: Vector | null = null, from: Vector | null = null, reversingStart: Vector | null = null;
  let start = 0, duration = 0, factor = 1, active = false, cold = true, waiting = false, animationKey: string | null = null, settledKey: string | null = null, settledOutcome: NativePresentationOutcome | null = null;
  const baselines = new Map<string, Write>(), writes = new Map<string, Write>();
  const lost = new Set<string>();
  // Deadlines use one monotonic clock across Document rebinding.
  const now = () => performance.now();
  const requireOwner = (writer: object) => {const owner = writers.get(writer); if (disposed || !options.alive() || !owner) throw new Error('[Presence] foreign or disposed writer'); return owner;};
  const live = (token: number) => !disposed && mounted && options.alive() && epoch === token && !!view && options.root() === view && view.ownerDocument === doc;
  const owns = (key: string, value: Write) => view?.style.getPropertyValue(key) === value.value && view.style.getPropertyPriority(key) === value.priority;
  function cancel() {
    const ticket = raf, deadline = timer; raf = null; timer = null;
    if (ticket !== null) {try {doc?.defaultView?.cancelAnimationFrame(ticket);} catch {}}
    if (deadline !== null) clearTimeout(deadline);
    if (off) {const cleanup = off; off = null; try {cleanup();} catch {}}
  }
  function release() {
    for (const [key, value] of writes) if (owns(key, value)) {
      const baseline = baselines.get(key)!;
      if (baseline.value) view!.style.setProperty(key, baseline.value, baseline.priority); else view!.style.removeProperty(key);
    }
    writes.clear(); baselines.clear();
  }
  function retire() {
    epoch++; cancel();
    try {release();} finally {
      view = null; doc = null; binding = Object.freeze({}); lost.clear(); display = null; target = null; from = null; reversingStart = null;
      active = false; cold = true; waiting = false; animationKey = null; settledKey = null; settledOutcome = null; factor = 1;
      for (const owner of refs.values()) {owner.binding = null; owner.pending = null;}
    }
  }
  const isCurrent = (writer: object, receipt: NativePresentationReceipt): boolean => {
    const owner = writers.get(writer), frame = owner?.frame;
    return !disposed && options.alive() && !!owner && owner.pending === receipt && !!frame?.attempt && receipt.owner === owner.ref && receipt.ownerRevision === frame.revision && owner.binding === receipt.viewBinding && receipt.targetRevision === owner.targetRevision && receipt.attempt.ownerEpoch === frame.attempt.ownerEpoch && receipt.attempt.phaseAttempt === frame.attempt.phaseAttempt;
  };
  function complete(owner: Owner, reason: NativePresentationOutcome) {
    const frame = owner.frame;
    if (!frame?.attempt || frame.completion !== 'presentation' || owner.pending && isCurrent(owner.writer, owner.pending)) return;
    owner.binding ??= binding;
    const receipt: NativePresentationReceipt = Object.freeze({owner: owner.ref, attempt: frame.attempt, viewBinding: owner.binding, ownerRevision: frame.revision, targetRevision: owner.targetRevision, channels: Object.freeze(recipe?.owner === owner.ref ? [...(recipe.closed.translate ? ['translate' as const] : []), ...(recipe.closed.opacity === undefined ? [] : ['opacity' as const])] : []), outcome: reason});
    owner.pending = receipt;
    options.invoke(run => {if (isCurrent(owner.writer, receipt)) owner.callback?.(run, Object.freeze({receipt}));});
  }
  function settle(owner: Owner, reason: NativePresentationOutcome) {
    const frame = owner.frame, token = epoch;
    active = false; waiting = false; settledKey = owner.attemptKey; settledOutcome = reason; cancel();
    try {options.prepare();} catch {reason = 'projection-failed';}
    if (disposed || owner.frame !== frame || epoch !== token) return;
    try {release();} catch {reason = 'projection-failed';}
    if (!disposed && owner.frame === frame && epoch === token) {settledOutcome = reason; complete(owner, reason);}
  }
  function resolve(endpoint: Endpoint): {translate?: Pair; opacity?: number} | null {
    let translate: Pair | undefined;
    if (endpoint.translate) {
      if (Array.isArray(endpoint.translate)) translate = endpoint.translate as Pair;
      else {const selection = endpoint.translate as Selection, key = selection.source.get(); if (typeof key !== 'string' || !Object.hasOwn(selection.cases, key)) return null; translate = selection.cases[key];}
    }
    return {translate, opacity: endpoint.opacity};
  }
  function dimensions(element: HTMLElement) {
    const win = element.ownerDocument.defaultView, css = win?.getComputedStyle(element);
    const px = (value: string | undefined) => value && /^-?(?:\d+\.?\d*|\.\d+)px$/.test(value) ? Number.parseFloat(value) : null;
    function extent(axis: 'width' | 'height') {
      let value = px(css?.[axis]); if (value === null) return null;
      if (css?.boxSizing !== 'border-box') for (const field of axis === 'width' ? ['paddingLeft','paddingRight','borderLeftWidth','borderRightWidth'] as const : ['paddingTop','paddingBottom','borderTopWidth','borderBottomWidth'] as const) {const n = px(css?.[field]); if (n === null) return null; value += n;}
      return Number.isFinite(value) && value >= 0 ? value : null;
    }
    return {width: extent('width'), height: extent('height'), font: px(win?.getComputedStyle(element.ownerDocument.documentElement).fontSize)};
  }
  function vector(endpoint: {translate?: Pair; opacity?: number}, size: ReturnType<typeof dimensions>): Vector | null {
    const coordinates: number[] = [];
    for (let i = 0; i < 2; i++) {
      const axis = endpoint.translate?.[i], box = i === 0 ? size.width : size.height;
      if (!axis) {coordinates.push(0); continue;}
      if (axis.ownBox !== 0 && box === null || axis.rootText !== 0 && size.font === null) return null;
      const value = axis.px + axis.rootText*(size.font ?? 0) + axis.ownBox*(box ?? 0);
      if (!Number.isFinite(value)) return null; coordinates.push(value);
    }
    return [coordinates[0], coordinates[1], endpoint.opacity ?? 1];
  }
  function paint(sample: Vector, token: number): boolean {
    if (!recipe || !live(token)) return false;
    const keys = [...(recipe.closed.translate ? ['translate'] : []), ...(recipe.closed.opacity === undefined ? [] : ['opacity'])];
    for (const [key, value] of writes) if (!owns(key, value)) {lost.add(key); writes.delete(key); baselines.delete(key);}
    const css = doc!.defaultView?.getComputedStyle(view!);
    for (const key of keys) {
      if (lost.has(key)) return false;
      if (!writes.has(key)) {
        const inline = view!.style.getPropertyValue(key), computed = css?.getPropertyValue(key);
        if (key === 'opacity' ? inline && inline !== '1' || computed && computed !== '1' : inline && inline !== 'none' || computed && computed !== 'none') return false;
      }
    }
    if (!live(token)) return false;
    for (const key of keys) {
      if (!baselines.has(key)) baselines.set(key, {value: view!.style.getPropertyValue(key), priority: view!.style.getPropertyPriority(key)});
      view!.style.setProperty(key, key === 'opacity' ? String(clamp(sample[2])) : sample[0] + 'px ' + sample[1] + 'px');
      writes.set(key, {value: view!.style.getPropertyValue(key), priority: view!.style.getPropertyPriority(key)});
    }
    if (!live(token)) return false;
    display = Object.freeze([...sample]) as unknown as Vector; return true;
  }
  function schedule(owner: Owner) {
    if (raf !== null || !view || !active && !waiting) return;
    const token = epoch;
    try {
      const request = doc?.defaultView?.requestAnimationFrame;
      if (!request) {settle(owner, 'scheduler-failed'); return;}
      // Native RAF is asynchronous. A hostile synchronous scheduler is diagnosed rather than recursively sampled.
      let scheduled = false, premature = false;
      const ticket = request.call(doc!.defaultView, () => {
        if (!scheduled) {premature = true; return;}
        if (epoch !== token) return;
        raf = null;
        if (!live(token)) {if (!disposed && mounted) refresh(); return;}
        tick(owner, true);
      });
      scheduled = true;
      if (premature) {doc?.defaultView?.cancelAnimationFrame(ticket); settle(owner, 'scheduler-failed');}
      else if (live(token)) raf = ticket; else doc?.defaultView?.cancelAnimationFrame(ticket);
    } catch {settle(owner, 'scheduler-failed');}
  }
  function arm(owner: Owner) {
    if (!view || !doc) return;
    const capturedDoc = doc, win = doc.defaultView;
    if (!off) {
      const invalidated = () => {if (!disposed && mounted) refresh();};
      let media: MediaQueryList | null = null;
      try {media = win?.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;} catch {}
      media?.addEventListener?.('change', invalidated);
      capturedDoc.addEventListener('visibilitychange', invalidated);
      const resize = win?.ResizeObserver ? new win.ResizeObserver(invalidated) : null; resize?.observe(view);
      off = () => {media?.removeEventListener?.('change', invalidated); capturedDoc.removeEventListener('visibilitychange', invalidated); resize?.disconnect();};
    }
    if (timer === null && owner.deadline !== null) {
      const token = epoch, attempt = owner.attemptKey;
      const check = () => {
        timer = null;
        if (disposed || !mounted || epoch !== token || owner.attemptKey !== attempt) return;
        const remaining = (owner.deadline ?? now()) - now();
        if (remaining > 0) timer = setTimeout(check, Math.min(remaining, 2147483647));
        else settle(owner, 'deadline');
      };
      timer = setTimeout(check, Math.max(0, Math.min(owner.deadline - now(), 2147483647)));
    }
  }
  function retarget(next: Vector, time: number, durationMs: number) {
    if (!display) {display = next; target = next; reversingStart = next; return;}
    if (same(target, next)) return;
    let nextFactor = 1;
    if (active && from && target && reversingStart && same(reversingStart, next)) {
      let axis = 0; for (let i = 1; i < 3; i++) if (Math.abs(target[i]-from[i]) > Math.abs(target[axis]-from[axis])) axis = i;
      const distance = target[axis]-from[axis], progress = distance === 0 ? 1 : (display[axis]-from[axis])/distance;
      nextFactor = clamp(Math.abs(progress*factor + 1-factor)); reversingStart = target;
    } else reversingStart = display;
    from = display; target = next; factor = nextFactor; duration = durationMs*factor; start = time; active = duration > 0 && !same(from, target);
  }
  function tick(owner: Owner, delivered: boolean) {
    if (!recipe || recipe.owner !== owner.ref || !owner.frame || !view || !mounted || disposed) return;
    const frame = owner.frame, token = epoch;
    if (!live(token)) {refresh(); return;}
    for (const [key, value] of writes) if (!owns(key, value)) {
      lost.add(key); writes.delete(key); baselines.delete(key);
      settle(owner, 'projection-ownership-lost'); return;
    }
    let closed: ReturnType<typeof resolve>, entered: ReturnType<typeof resolve>;
    try {closed = resolve(recipe.closed); entered = resolve(recipe.entered);} catch {settle(owner, 'unresolved-input'); return;}
    if (!live(token) || frame !== owner.frame) return;
    if (!closed || !entered) {settle(owner, 'unresolved-input'); return;}
    const key = JSON.stringify([closed, entered, recipe.easing]);
    if (owner.targetKey !== key) {owner.targetKey = key; owner.targetRevision++; owner.pending = null;}
    owner.binding = binding;
    if (entered.opacity !== undefined && entered.opacity !== 1 || entered.translate?.some(axis => axis.px !== 0 || axis.rootText !== 0 || axis.ownBox !== 0)) {settle(owner, 'unsupported-endpoint'); return;}
    if (frame.completion === 'presentation' && frame.timeoutMs !== null && frame.durationMs >= frame.timeoutMs) {settle(owner, 'invalid-policy'); return;}
    const win = doc!.defaultView;
    let preference: NativePresentationOutcome | null = null;
    try {
      const reduce = win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const normal = win?.matchMedia?.('(prefers-reduced-motion: no-preference)').matches;
      preference = reduce === true && normal === false ? 'reduced-motion' : normal === true && reduce === false ? null : 'unknown-preference';
    } catch {preference = 'unknown-preference';}
    if (preference) {settle(owner, preference); return;}
    let hidden = !view.isConnected || doc!.visibilityState === 'hidden';
    for (let node: Element | null = view; node; ) {
      if (node.matches('[hidden],[data-pui-view-pending],[data-pui-view-detached]')) hidden = true;
      const root: Node = node.getRootNode(); node = node.parentElement ?? ('host' in root ? (root as ShadowRoot).host : null);
    }
    if (hidden) {settle(owner, 'hidden'); return;}
    if (closed.translate && !win?.CSS?.supports?.('translate', '1px')) {settle(owner, 'missing-capability'); return;}
    let size: ReturnType<typeof dimensions>;
    try {size = dimensions(view);} catch {settle(owner, 'unresolved-units'); return;}
    const initial = vector(closed, size), next = vector(frame.phase === 'closed' || frame.phase === 'leaving' ? closed : entered, size);
    if (!initial || !next) {settle(owner, 'unresolved-units'); return;}
    const animated = frame.completion === 'presentation' && !!frame.attempt;
    if (!animated) {active = false; waiting = false; display = next; target = next; from = next; reversingStart = next; factor = 1; cancel(); release(); return;}
    if (owner.pending && isCurrent(owner.writer, owner.pending)) return;
    if (settledKey === owner.attemptKey && settledOutcome) {complete(owner, settledOutcome); return;}
    if (frame.durationMs === 0) {settle(owner, 'zero-duration'); return;}
    if (owner.deadline !== null && now() >= owner.deadline) {settle(owner, 'deadline'); return;}
    const attempt = owner.attemptKey;
    if (animationKey !== attempt) {cancel(); animationKey = attempt; waiting = false;}
    arm(owner);
    const time = now();
    if (cold && frame.phase === 'entering') {
      if (!waiting) {if (!paint(initial, token)) {settle(owner, 'projection-ownership-lost'); return;} waiting = true; target = null; schedule(owner); return;}
      if (!delivered) {schedule(owner); return;}
      if (!paint(display ?? initial, token)) {settle(owner, 'projection-failed'); return;}
      waiting = false; cold = false; retarget(next, time, frame.durationMs);
      if (!active) {settle(owner, 'finished'); return;}
      schedule(owner); return;
    }
    cold = false;
    if (!display) display = next;
    retarget(next, time, frame.durationMs);
    if (!active) {
      if (delivered && !paint(next, token)) {settle(owner, 'projection-failed'); return;}
      if (!delivered) {active = true; from = next; target = next; duration = 0; start = time; schedule(owner); return;}
      settle(owner, 'finished'); return;
    }
    if (delivered) {
      const progress = duration === 0 ? 1 : clamp((time-start)/duration), amount = ease(progress, recipe.easing);
      const sample = target!.map((value, i) => from![i] + (value-from![i])*amount) as unknown as Vector;
      if (!paint(sample, token)) {settle(owner, 'projection-ownership-lost'); return;}
      if (progress === 1) {settle(owner, 'finished'); return;}
    }
    schedule(owner);
  }
  function refresh() {
    if (disposed || !mounted || !recipe) return;
    if (preparing) {queuedRefresh = true; return;}
    preparing = true;
    try {
      const element = options.root();
      if (element !== view || element?.ownerDocument !== doc) {retire(); view = element; doc = element?.ownerDocument ?? null; binding = Object.freeze({});}
      if (!view) return;
      const owner = refs.get(recipe.owner)!;
      // Semantic style must be current before dimensions or transient channel writes.
      const token = epoch, frame = owner.frame;
      options.prepare();
      if (live(token) && frame === owner.frame) tick(owner, false);
    } catch {const owner = recipe && refs.get(recipe.owner); if (owner) settle(owner, 'projection-failed');}
    finally {preparing = false; if (queuedRefresh) {queuedRefresh = false; queueMicrotask(() => {if (!disposed) refresh();});}}
  }
  return {
    owner(): NativePresenceOwner<Run> {
      options.setup(); if (disposed) throw new Error('[Presence] disposed registry');
      const owner: Owner = {ref: Object.freeze({}), writer: Object.freeze({}), frame: null, callback: null, pending: null, targetRevision: 0, targetKey: null, binding: null, attemptKey: null, deadline: null};
      writers.set(owner.writer, owner); refs.set(owner.ref, owner);
      return Object.freeze({ref: owner.ref, writer: owner.writer, onCompletionRequest(callback: NonNullable<Owner['callback']>) {options.setup(); requireOwner(owner.writer); if (owner.callback || typeof callback !== 'function') throw new TypeError('[Presence] exactly one completion receiver is required'); owner.callback = callback;}});
    },
    registerSource(source: object) {options.setup(); if (disposed) throw new Error('[Presence] disposed registry'); sources.add(source);},
    declare(value: Recipe): () => void {
      options.setup(); if (disposed || recipe) throw new Error('[Presentation] one live declaration per surface');
      const data = fields(value, ['owner','closed','entered','easing']);
      if (!data.owner || typeof data.owner !== 'object' || !refs.has(data.owner)) throw new TypeError('[Presentation] foreign owner');
      const closed = endpoint(data.closed, sources), entered = endpoint(data.entered, sources), easing = dense(data.easing, 4).map(value => finite(value));
      if (Object.keys(closed).length !== Object.keys(entered).length || Object.keys(closed).some(key => !Object.hasOwn(entered, key)) || easing[0] < 0 || easing[0] > 1 || easing[2] < 0 || easing[2] > 1) throw new TypeError('[Presentation] invalid channels or easing');
      const copy: Recipe = Object.freeze({owner: data.owner, closed, entered, easing: Object.freeze(easing)}); recipe = copy;
      return () => {options.setup(); if (recipe !== copy) return; recipe = null; retire();};
    },
    publish(writer: object, value: NativePresentationFrame) {
      options.runtime(); const owner = requireOwner(writer), frame = snapshotFrame(value);
      if (frame.owner !== owner.ref || owner.frame && frame.revision <= owner.frame.revision) throw new Error('[Presence] foreign owner or nonmonotonic revision');
      const key = frame.attempt ? frame.attempt.ownerEpoch + ':' + frame.attempt.phaseAttempt + ':' + frame.phase : null;
      if (key !== owner.attemptKey) {owner.attemptKey = key; owner.deadline = key && frame.completion === 'presentation' ? now() + frame.timeoutMs! : null; settledKey = null; settledOutcome = null;}
      owner.frame = frame; owner.pending = null;
      refresh();
    },
    settle(writer: object, reason: NativePresentationOutcome) {options.runtime(); const owner = requireOwner(writer); if (recipe?.owner === owner.ref) settle(owner, reason); else complete(owner, reason === 'finished' ? 'missing-capability' : reason);},
    isCurrent,
    refresh,
    mount() {if (disposed) return; mounted = true; refresh();},
    detach() {mounted = false; retire();},
    dispose() {if (disposed) return; disposed = true; mounted = false; recipe = null; try {retire();} finally {writers.clear(); refs.clear();}},
  };
}
`,
};
