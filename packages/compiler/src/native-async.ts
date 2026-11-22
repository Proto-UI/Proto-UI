import type { ExpressionIR, GeneratedModule, Operation, ValueType } from './ir';
import {
  nativePresencePresentationArtifact,
  webPresenceArtifacts,
} from './native-support/web-presence';

export const nativeMetaArtifact: NonNullable<GeneratedModule['supportingFiles']>[number] = {
  path: '.proto-ui/meta/web-snapshot-v1.ts',
  kind: 'source',
  contents: `/** Sample native inputs without installing an observer or claiming rendering fidelity. */
export function readNativeWebMeta(doc: Document | undefined, key: string): unknown {
  const view = doc?.defaultView;
  const media = (query: string) => { try { return typeof view?.matchMedia === 'function' ? view.matchMedia(query).matches : false; } catch { return false; } };
  if (key === 'reducedMotion') return media('(prefers-reduced-motion: reduce)') ? 'reduce' : 'no-preference';
  if (key === 'colorScheme') {
    const root = doc?.documentElement, theme = root?.dataset.theme;
    if (theme === 'dark' || root?.classList.contains('dark')) return 'dark';
    if (theme === 'light' || root?.classList.contains('light')) return 'light';
    return media('(prefers-color-scheme: dark)') ? 'dark' : 'light';
  }
  const preferences: Record<string, readonly [string, readonly string[]]> = {
    'preference.reducedMotion': ['prefers-reduced-motion', ['no-preference', 'reduce']],
    'preference.reducedTransparency': ['prefers-reduced-transparency', ['no-preference', 'reduce']],
    'preference.contrast': ['prefers-contrast', ['no-preference', 'less', 'more', 'custom']],
    'preference.forcedColors': ['forced-colors', ['none', 'active']],
  };
  if (Object.hasOwn(preferences, key)) {
    const [feature, values] = preferences[key], matches = values.filter(value => media('(' + feature + ': ' + value + ')'));
    return matches.length === 1 ? matches[0] : 'unknown';
  }
  if (key === 'viewport.width') { const width = view?.innerWidth; return typeof width === 'number' && Number.isFinite(width) && width >= 0 ? width : 'unknown'; }
  if (key === 'styleSupport.alphaFill' || key === 'styleSupport.backdropBlur4px') {
    const css = view?.CSS;
    if (typeof css?.supports !== 'function') return 'unknown';
    try { return key === 'styleSupport.alphaFill'
      ? css.supports('background-color', 'color-mix(in oklab, rgb(44 44 46) 80%, transparent)') && css.supports('background-color', 'color-mix(in oklab, var(--pui-secondary) 80%, transparent)')
      : css.supports('backdrop-filter', 'blur(4px)'); } catch { return 'unknown'; }
  }
  return undefined;
}
`,
};

export function nativeHostAtomPlan(operations: readonly Operation[], prefix: string) {
  const delay = operations.includes('scheduler.delay');
  const presentation = operations.includes('feedback.style.presence');
  const presence =
    presentation || operations.some((operation) => operation.startsWith('presence.'));
  const snapshot = presence || operations.includes('presentation.snapshotCompletion');
  const meta = operations.includes('meta.get');
  const files = [
    ...(delay ? [nativeDelayArtifact] : []),
    ...(snapshot ? [nativePresenceArtifact] : []),
    ...(presentation ? [...webPresenceArtifacts(), nativePresencePresentationArtifact] : []),
    ...(meta ? [nativeMetaArtifact] : []),
  ];
  return {
    delay,
    presence,
    presentation,
    snapshot,
    meta,
    files,
    names: { delay: `${prefix}Delay`, presence: `${prefix}Presence`, meta: `${prefix}Meta` },
    imports: [
      delay
        ? `import { createNativeDelay as ${prefix}CreateDelay, type NativeDelayTask as ${prefix}DelayTask } from './.proto-ui/async/delay-web-v1';`
        : '',
      snapshot
        ? `import { createNativePresence as ${prefix}CreatePresence, snapshotNativeCompletion as ${prefix}SnapshotCompletion, type NativePresenceOwner as ${prefix}PresenceOwner } from './.proto-ui/async/presence-owner-v1';`
        : '',
      presentation
        ? `import { createNativePresencePresentation as ${prefix}CreatePresencePresentation } from './.proto-ui/async/presence-presentation-v1';`
        : '',
      meta
        ? `import { readNativeWebMeta as ${prefix}ReadMeta } from './.proto-ui/meta/web-snapshot-v1';`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
    jsImports: [
      delay
        ? `import { createNativeDelay as ${prefix}CreateDelay } from './.proto-ui/async/delay-web-v1';\n/** @typedef {import('./.proto-ui/async/delay-web-v1').NativeDelayTask} ${prefix}DelayTask */`
        : '',
      snapshot
        ? `import { createNativePresence as ${prefix}CreatePresence, snapshotNativeCompletion as ${prefix}SnapshotCompletion } from './.proto-ui/async/presence-owner-v1';\n/** @template Run @typedef {import('./.proto-ui/async/presence-owner-v1').NativePresenceOwner<Run>} ${prefix}PresenceOwner */`
        : '',
      presentation
        ? `import { createNativePresencePresentation as ${prefix}CreatePresencePresentation } from './.proto-ui/async/presence-presentation-v1';`
        : '',
      meta
        ? `import { readNativeWebMeta as ${prefix}ReadMeta } from './.proto-ui/meta/web-snapshot-v1';`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
    typeName(type: ValueType, run: string): string | undefined {
      if (type === 'delay-task') return delay ? `${prefix}DelayTask` : 'unknown';
      if (type === 'presence-owner') return snapshot ? `${prefix}PresenceOwner<${run}>` : 'unknown';
      if (
        [
          'presentation-owner-ref',
          'presentation-owner-writer',
          'presentation-view-binding',
        ].includes(type as string)
      )
        return 'Readonly<object>';
      return undefined;
    },
    owner(options: {
      setup: string;
      runtime: string;
      alive: string;
      invoke: string;
      invokeRun: string;
      document: string;
      run: string;
      typed?: boolean;
      root?: string;
      tokens?: string;
      project?: string;
      watch?: string;
    }): string {
      const typed = options.typed !== false;
      return [
        delay
          ? `const ${prefix}Delay = ${prefix}CreateDelay({ runtime: () => { ${options.runtime}; }, alive: () => ${options.alive}, invoke: callback => { ${options.invoke}; }, report: error => console.error('[Delay] callback failed', error) });`
          : '',
        presentation
          ? `const ${prefix}Presence = ${prefix}CreatePresencePresentation${typed ? `<${options.run}>` : ''}({ setup: () => { ${options.setup}; }, runtime: () => { ${options.runtime}; }, alive: () => ${options.alive}, invoke: callback => { ${options.invokeRun}; }, root: () => ${options.root ?? 'null'}, tokens: () => ${options.tokens ?? '[]'}, project: tokens => { ${options.project ?? ''}; }, watch: (source, callback) => { ${options.watch ?? "throw new Error('[Presence] State subscription is not available');"} } });`
          : presence
            ? `const ${prefix}Presence = ${prefix}CreatePresence${typed ? `<${options.run}>` : ''}({ setup: () => { ${options.setup}; }, runtime: () => { ${options.runtime}; }, alive: () => ${options.alive}, invoke: callback => { ${options.invokeRun}; } });`
            : '',
        meta
          ? `const ${prefix}Meta = ${typed ? '(key: string)' : '/** @param {string} key */ (key)'} => ${prefix}ReadMeta(${options.document}, key);`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
    },
    detach: `${delay ? `${prefix}Delay.cancelView();` : ''}${presence ? `${prefix}Presence.detach();` : ''}`,
    dispose: `${delay ? `${prefix}Delay.dispose();` : ''}${presence ? `${prefix}Presence.dispose();` : ''}`,
  };
}

export type NativeHostAtomPlan = ReturnType<typeof nativeHostAtomPlan>;

/** Preserve receiver and argument evaluation, including optional receiver short circuit. */
export function emitNativeHostAtom(
  value: ExpressionIR,
  emit: (value: ExpressionIR) => string,
  prefix: string
): string | undefined {
  if (value.kind !== 'operation') return undefined;
  const args = () => value.arguments.map(emit).join(', ');
  let body: string | undefined;
  switch (value.operation) {
    case 'scheduler.delay':
      return `${prefix}Delay.schedule(${args()})`;
    case 'presentation.snapshotCompletion':
      return `${prefix}SnapshotCompletion(${args()})`;
    case 'presence.owner':
      body = `${prefix}Presence.owner()`;
      break;
    case 'feedback.style.presence':
      body = `${prefix}Presence.declare(${args()})`;
      break;
    case 'presence.publish':
      body = `${prefix}Presence.publish(${args()})`;
      break;
    case 'presence.settle':
      body = `${prefix}Presence.settle(${args()})`;
      break;
    case 'presence.isCurrent':
      body = `${prefix}Presence.isCurrent(${args()})`;
      break;
    case 'meta.get':
      body = `${prefix}Meta(${args()})`;
      break;
    default:
      return undefined;
  }
  const receiver = value.receiver ? emit(value.receiver) : '(void 0)';
  return value.optional
    ? `((${prefix}AtomReceiver) => ${prefix}AtomReceiver == null ? undefined : ${body})(${receiver})`
    : `(void (${receiver}), ${body})`;
}

/** Native scheduling and identity atoms. No transition state, event, or duration policy. */
export const nativeDelayArtifact: NonNullable<GeneratedModule['supportingFiles']>[number] = {
  path: '.proto-ui/async/delay-web-v1.ts',
  kind: 'source',
  contents: `export interface NativeDelayTask { cancel(): void }
export function createNativeDelay(options: {
  runtime(): void;
  alive(): boolean;
  invoke(callback: () => void): void;
  report(error: unknown): void;
}) {
  const pending = new Set<NativeDelayTask>();
  let disposed = false;
  return {
    schedule(durationMs: number, callback: () => void): NativeDelayTask {
      options.runtime();
      if (disposed || !options.alive()) throw new Error('[Delay] owner is disposed');
      if (!Number.isFinite(durationMs) || durationMs < 0) throw new Error('[Delay] durationMs must be non-negative and finite');
      if (typeof callback !== 'function') throw new TypeError('[Delay] callback must be a function');
      let active = true;
      let timer: ReturnType<typeof setTimeout>;
      const deadline = performance.now() + durationMs;
      const task: NativeDelayTask = Object.freeze({ cancel() {
        if (!active) return;
        active = false; pending.delete(task); clearTimeout(timer);
      } });
      // A zero duration still crosses the native host scheduling boundary.
      const ready = () => {
        if (!active) return;
        if (disposed || !options.alive()) { task.cancel(); return; }
        const remaining = deadline - performance.now();
        if (remaining > 0) { timer = setTimeout(ready, Math.min(remaining, 2147483647)); return; }
        active = false; pending.delete(task);
        try { options.invoke(callback); } catch (error) { options.report(error); }
      };
      timer = setTimeout(ready, Math.min(durationMs, 2147483647));
      pending.add(task);
      return task;
    },
    cancelView() { for (const task of [...pending]) task.cancel(); },
    dispose() { if (disposed) return; disposed = true; for (const task of [...pending]) task.cancel(); },
  };
}
`,
};

export const nativePresenceArtifact: NonNullable<GeneratedModule['supportingFiles']>[number] = {
  path: '.proto-ui/async/presence-owner-v1.ts',
  kind: 'source',
  contents: `export type NativePresentationRef = Readonly<object>;
export type NativePresentationWriter = Readonly<object>;
export type NativeCompletionConfig = 'timer' | Readonly<{ kind: 'presentation'; timeoutMs: number }>;
export type NativeAttempt = Readonly<{ ownerEpoch: number; phaseAttempt: number }>;
export interface NativePresentationFrame {
  readonly owner: NativePresentationRef;
  readonly revision: number;
  readonly phase: 'closed' | 'preparing' | 'entering' | 'entered' | 'leaving';
  readonly attempt: NativeAttempt | null;
  readonly completion: 'timer' | 'presentation';
  readonly durationMs: number;
  readonly timeoutMs: number | null;
}
export type NativePresentationOutcome = 'finished' | 'reduced-motion' | 'unknown-preference' | 'hidden' | 'missing-capability' | 'unsupported-endpoint' | 'unresolved-units' | 'unresolved-input' | 'projection-failed' | 'projection-ownership-lost' | 'deadline' | 'zero-duration' | 'invalid-policy' | 'scheduler-failed';
export interface NativePresentationReceipt {
  readonly owner: NativePresentationRef;
  readonly attempt: NativeAttempt;
  readonly viewBinding: object;
  readonly ownerRevision: number;
  readonly targetRevision: number;
  readonly channels: readonly ('opacity' | 'translate')[];
  readonly outcome: NativePresentationOutcome;
}
export interface NativePresenceOwner<Run> {
  readonly ref: NativePresentationRef;
  readonly writer: NativePresentationWriter;
  onCompletionRequest(callback: (run: Run, request: Readonly<{ receipt: NativePresentationReceipt }>) => void): void;
}
function ownFields(value: unknown, names: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('[Presence] expected a data record');
  const result: Record<string, unknown> = Object.create(null);
  const keys = Reflect.ownKeys(value);
  if (keys.length !== names.length || keys.some(key => typeof key !== 'string' || !names.includes(key))) throw new TypeError('[Presence] unexpected record shape');
  for (const name of names) {
    const field = Object.getOwnPropertyDescriptor(value, name);
    if (!field || !('value' in field)) throw new TypeError('[Presence] own data fields are required');
    result[name] = field.value;
  }
  return result;
}
function finite(value: unknown, positive = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || (positive ? value <= 0 : value < 0)) throw new TypeError('[Presence] invalid finite duration');
  return value;
}
function integer(value: unknown): number {
  const result = finite(value);
  if (!Number.isSafeInteger(result)) throw new TypeError('[Presence] invalid revision');
  return result;
}
export function snapshotNativeCompletion(value: NativeCompletionConfig): NativeCompletionConfig {
  if (value === 'timer') return value;
  const fields = ownFields(value, ['kind', 'timeoutMs']);
  if (fields.kind !== 'presentation') throw new TypeError('[Presence] invalid completion kind');
  return Object.freeze({ kind: 'presentation', timeoutMs: finite(fields.timeoutMs, true) });
}
function snapshotFrame(value: NativePresentationFrame): NativePresentationFrame {
  const fields = ownFields(value, ['owner', 'revision', 'phase', 'attempt', 'completion', 'durationMs', 'timeoutMs']);
  if (!fields.owner || typeof fields.owner !== 'object') throw new TypeError('[Presence] invalid owner');
  if (!['closed', 'preparing', 'entering', 'entered', 'leaving'].includes(fields.phase as string)) throw new TypeError('[Presence] invalid phase');
  if (fields.completion !== 'timer' && fields.completion !== 'presentation') throw new TypeError('[Presence] invalid completion');
  const timeoutMs = fields.timeoutMs === null ? null : finite(fields.timeoutMs, true);
  if ((fields.completion === 'timer') !== (timeoutMs === null)) throw new TypeError('[Presence] invalid timeout');
  let attempt: NativeAttempt | null = null;
  if (fields.attempt !== null) {
    const parts = ownFields(fields.attempt, ['ownerEpoch', 'phaseAttempt']);
    attempt = Object.freeze({ ownerEpoch: integer(parts.ownerEpoch), phaseAttempt: integer(parts.phaseAttempt) });
  }
  if ((fields.phase === 'entering' || fields.phase === 'leaving') !== (attempt !== null)) throw new TypeError('[Presence] phase and attempt disagree');
  return Object.freeze({ owner: fields.owner, revision: integer(fields.revision), phase: fields.phase as NativePresentationFrame['phase'], attempt,
    completion: fields.completion, durationMs: finite(fields.durationMs), timeoutMs });
}
export function createNativePresence<Run>(options: {
  setup(): void;
  runtime(): void;
  alive(): boolean;
  invoke(callback: (run: Run) => void): void;
}) {
  type Owner = { ref: object; writer: object; frame: NativePresentationFrame | null; binding: object | null;
    pending: NativePresentationReceipt | null; callback: ((run: Run, request: { receipt: NativePresentationReceipt }) => void) | null };
  const writers = new Map<object, Owner>();
  let disposed = false;
  function requireOwner(writer: object): Owner {
    const owner = writers.get(writer);
    if (disposed || !options.alive() || !owner) throw new Error('[Presence] foreign or disposed writer');
    return owner;
  }
  function isCurrent(writer: object, receipt: NativePresentationReceipt): boolean {
    const owner = writers.get(writer), frame = owner?.frame;
    return !disposed && options.alive() && !!owner && owner.pending === receipt && !!frame?.attempt
      && owner.ref === receipt.owner && owner.binding === receipt.viewBinding && frame.revision === receipt.ownerRevision
      && receipt.targetRevision === 0 && frame.attempt.ownerEpoch === receipt.attempt.ownerEpoch
      && frame.attempt.phaseAttempt === receipt.attempt.phaseAttempt;
  }
  return {
    owner(): NativePresenceOwner<Run> {
      options.setup();
      if (disposed) throw new Error('[Presence] disposed registry');
      const owner: Owner = { ref: Object.freeze({}), writer: Object.freeze({}), frame: null, binding: null, pending: null, callback: null };
      writers.set(owner.writer, owner);
      return Object.freeze({ ref: owner.ref, writer: owner.writer, onCompletionRequest(callback: NonNullable<Owner['callback']>) {
        options.setup(); requireOwner(owner.writer);
        if (owner.callback || typeof callback !== 'function') throw new TypeError('[Presence] exactly one completion receiver is required');
        owner.callback = callback;
      } });
    },
    publish(writer: object, value: NativePresentationFrame): void {
      options.runtime(); const owner = requireOwner(writer); const frame = snapshotFrame(value);
      if (frame.owner !== owner.ref || owner.frame && frame.revision <= owner.frame.revision) throw new Error('[Presence] foreign owner or nonmonotonic revision');
      owner.pending = null; owner.frame = frame;
    },
    isCurrent,
    settle(writer: object, outcome: NativePresentationOutcome): void {
      options.runtime(); const owner = requireOwner(writer), frame = owner.frame;
      if (!frame?.attempt || frame.completion !== 'presentation' || owner.pending && isCurrent(writer, owner.pending)) return;
      owner.binding ??= Object.freeze({});
      // No presentation sink is implicitly installed. The authored owner decides how
      // its current attempt completes after this explicit missing-capability outcome.
      const receipt: NativePresentationReceipt = Object.freeze({ owner: owner.ref, attempt: frame.attempt,
        viewBinding: owner.binding, ownerRevision: frame.revision, targetRevision: 0, channels: Object.freeze([]),
        outcome: outcome === 'finished' ? 'missing-capability' : outcome });
      owner.pending = receipt;
      options.invoke(run => { if (isCurrent(writer, receipt)) owner.callback?.(run, Object.freeze({ receipt })); });
    },
    detach() { for (const owner of writers.values()) { owner.binding = null; owner.pending = null; } },
    dispose() { if (disposed) return; disposed = true; writers.clear(); },
  };
}
`,
};
