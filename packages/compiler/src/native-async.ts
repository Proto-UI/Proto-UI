import type { ExpressionIR, GeneratedModule, Operation, ValueType } from './ir';
import type { RuleMetaKey } from './rule-declarations';
import type {
  ShaderKernel,
  ShaderPresentationDeclaration,
} from '../../core/src/shader-presentation';
import { nativeShaderArtifacts } from './native-shader';
import { emitNativeShaderDeclaration, shaderPlanKey } from './shader-plan';
import { nativePresencePresentationArtifact } from './native-presence-presentation';

export const nativeMetaSubscriptionArtifact: NonNullable<
  GeneratedModule['supportingFiles']
>[number] = {
  path: '.proto-ui/meta/subscription-v1.ts',
  kind: 'source',
  contents: `/** Native invalidation registration; acquire/release always use one captured complete API pair. */
export function nativeMediaBinding(query: MediaQueryList | undefined, notify: () => void): { attach(): void; release(): void } | undefined {
  if (!query) return;
  const add = query.addEventListener, remove = query.removeEventListener;
  if (typeof add === 'function' && typeof remove === 'function') return {
    attach: () => add.call(query, 'change', notify), release: () => remove.call(query, 'change', notify),
  };
  const legacyAdd = query.addListener, legacyRemove = query.removeListener;
  if (typeof legacyAdd === 'function' && typeof legacyRemove === 'function') return {
    attach: () => legacyAdd.call(query, notify), release: () => legacyRemove.call(query, notify),
  };
}
export function releaseNativeMeta(releases: readonly (() => void)[]): void {
  const failures: unknown[] = [];
  for (const release of releases) { try { release(); } catch (error) { failures.push(error); } }
  if (failures.length === 1) throw failures[0];
  if (failures.length) throw new AggregateError(failures, 'Native Meta cleanup failed.');
}
`,
};

export const nativeRuleColorSchemeArtifact: NonNullable<
  GeneratedModule['supportingFiles']
>[number] = {
  path: '.proto-ui/meta/color-scheme-source-v1.ts',
  kind: 'source',
  contents: `import { readNativeWebMeta } from './web-snapshot-v1';
import { nativeMediaBinding, releaseNativeMeta } from './subscription-v1';
// C-RULE-COLOR-SCHEME-0001: one document invalidation source, no value bus or author callbacks.
type Service = { callbacks: Set<() => void>; stop(): void };
const services = new WeakMap<Document, Service>();
export function subscribeNativeColorScheme(doc: Document | undefined, notify: () => void): () => void {
  const view = doc?.defaultView;
  if (!doc?.documentElement || !view?.MutationObserver) return () => {};
  let service = services.get(doc);
  if (!service) {
    const callbacks = new Set<() => void>();
    let active = true, queued = false, previous = readNativeWebMeta(doc, 'colorScheme');
    const invalidate = () => {
      if (!active || queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false; if (!active) return;
        const next = readNativeWebMeta(doc, 'colorScheme');
        if (next === previous) return; previous = next;
        for (const callback of [...callbacks]) if (active && callbacks.has(callback)) callback();
      });
    };
    let query: MediaQueryList | undefined;
    try { query = view.matchMedia?.('(prefers-color-scheme: dark)'); } catch {}
    const observer = new view.MutationObserver(invalidate), binding = nativeMediaBinding(query, invalidate);
    const releases: (() => void)[] = [];
    service = { callbacks, stop() {
      if (!active) return; active = false;
      callbacks.clear(); if (services.get(doc) === service) services.delete(doc);
      releaseNativeMeta(releases);
    } };
    services.set(doc, service);
    try {
      releases.push(() => observer.disconnect());
      observer.observe(doc.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
      if (binding) { releases.push(binding.release); binding.attach(); }
    } catch (error) { releaseNativeMeta([() => { throw error; }, () => service!.stop()]); }
  }
  // A registration identity allows the same callback to hold independent leases.
  const callback = () => notify(); service.callbacks.add(callback);
  const current = service; let released = false;
  return () => { if (released) return; released = true; current.callbacks.delete(callback); if (!current.callbacks.size) current.stop(); };
}
`,
};

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

export const nativeRulePreferenceArtifact: NonNullable<GeneratedModule['supportingFiles']>[number] =
  {
    path: '.proto-ui/meta/preference-source-v1.ts',
    kind: 'source',
    contents: `import { nativeMediaBinding, releaseNativeMeta } from './subscription-v1';
// C-RULE-PREFERENCES-0001: only reached fixed-key MQLs, shared per document/key.
const definitions: Record<string, readonly [string, readonly string[]]> = {
  'preference.reducedMotion': ['prefers-reduced-motion', ['no-preference', 'reduce']],
  'preference.reducedTransparency': ['prefers-reduced-transparency', ['no-preference', 'reduce']],
  'preference.contrast': ['prefers-contrast', ['no-preference', 'less', 'more', 'custom']],
  'preference.forcedColors': ['forced-colors', ['none', 'active']],
};
type Source = { callbacks: Set<() => void>; read(): unknown; stop(): void };
const documents = new WeakMap<Document, Map<string, Source>>();
export function readNativeRulePreference(doc: Document | undefined, key: string): unknown {
  return doc ? documents.get(doc)?.get(key)?.read() ?? 'unknown' : 'unknown';
}
export function subscribeNativeRulePreferences(doc: Document | undefined, keys: readonly string[], notify: () => void): () => void {
  const view = doc?.defaultView;
  if (!doc || typeof view?.matchMedia !== 'function') return () => {};
  let active = true, queued = false;
  const changed = () => { if (!active || queued) return; queued = true; queueMicrotask(() => { queued = false; if (active) notify(); }); };
  const releases: (() => void)[] = [];
  let sources = documents.get(doc); if (!sources) { sources = new Map(); documents.set(doc, sources); }
  try { for (const key of keys) {
    if (!Object.hasOwn(definitions, key)) throw new Error('Unknown generated Rule preference.');
    let source = sources.get(key);
    if (!source) {
      const [feature, values] = definitions[key], getter = view.matchMedia; let queries: MediaQueryList[];
      try { queries = values.map(value => view.matchMedia('(' + feature + ': ' + value + ')')); } catch { continue; }
      const callbacks = new Set<() => void>(); let live = true, ready = false, pending = false;
      const read = () => {
        if (!live || !ready || doc.defaultView !== view || view.matchMedia !== getter) return 'unknown';
        try { const matches = values.filter((_value, index) => queries[index].matches); return matches.length === 1 ? matches[0] : 'unknown'; } catch { return 'unknown'; }
      };
      let previous = read();
      const invalidate = () => { if (!live || pending) return; pending = true; queueMicrotask(() => {
        pending = false; if (!live) return; const next = read();
        if (next === previous) return; previous = next;
        for (const callback of [...callbacks]) if (live && callbacks.has(callback)) callback();
      }); };
      let bindings: ReturnType<typeof nativeMediaBinding>[];
      try { bindings = queries.map(query => typeof query?.matches === 'boolean' ? nativeMediaBinding(query, invalidate) : undefined); } catch { continue; }
      if (bindings.some(binding => !binding)) continue;
      const attached: (() => void)[] = [];
      source = { callbacks, read, stop() { if (!live) return; live = false;
        callbacks.clear(); if (sources!.get(key) === source) sources!.delete(key);
        if (!sources!.size && documents.get(doc) === sources) documents.delete(doc);
        releaseNativeMeta(attached);
      } }; sources.set(key, source);
      try { for (const binding of bindings) { attached.push(binding!.release); binding!.attach(); } ready = true; previous = read(); }
      catch (error) { releaseNativeMeta([() => { throw error; }, () => source!.stop()]); }
    }
    source.callbacks.add(changed); const current = source;
    releases.push(() => { current.callbacks.delete(changed); if (!current.callbacks.size) current.stop(); });
  } } catch (error) { active = false; releaseNativeMeta([() => { throw error; }, ...releases]); }
  return () => { if (!active) return; active = false; releaseNativeMeta(releases); };
}
`,
  };

export function nativeHostAtomPlan(
  operations: readonly Operation[],
  prefix: string,
  ruleMetaKeys: readonly RuleMetaKey[] = [],
  shaderKernels: readonly ShaderKernel[] = []
) {
  const delay = operations.includes('scheduler.delay');
  const presentation = operations.includes('feedback.style.presence');
  const shader = operations.includes('feedback.material.shader');
  const presence =
    presentation || operations.some((operation) => operation.startsWith('presence.'));
  const snapshot = presence || operations.includes('presentation.snapshotCompletion');
  const ruleColorScheme = ruleMetaKeys.includes('colorScheme');
  const rulePreferences = ruleMetaKeys.filter((key) => key.startsWith('preference.'));
  const ruleMeta = ruleColorScheme || rulePreferences.length > 0;
  const meta = operations.includes('meta.get') || ruleMeta;
  const presenceFile = presentation ? nativePresencePresentationArtifact : nativePresenceArtifact;
  const presenceImport = './' + presenceFile.path.replace(/\.ts$/, '');
  const files = [
    ...(delay ? [nativeDelayArtifact] : []),
    ...(shader ? nativeShaderArtifacts(shaderKernels) : []),
    ...(snapshot ? [presenceFile] : []),
    ...(meta ? [nativeMetaArtifact] : []),
    ...(ruleMeta ? [nativeMetaSubscriptionArtifact] : []),
    ...(ruleColorScheme ? [nativeRuleColorSchemeArtifact] : []),
    ...(rulePreferences.length ? [nativeRulePreferenceArtifact] : []),
  ];
  return {
    delay,
    presence,
    presentation,
    shader,
    physicalPresentation: presentation || shader,
    snapshot,
    meta,
    files,
    names: { delay: `${prefix}Delay`, presence: `${prefix}Presence`, meta: `${prefix}Meta` },
    ruleMeta(document: string, typed = true): string {
      const leases = [
        ruleColorScheme ? `${prefix}SubscribeColorScheme(${document}, notify)` : '',
        rulePreferences.length
          ? `${prefix}SubscribePreferences(${document}, ${JSON.stringify(rulePreferences)}, notify)`
          : '',
      ].filter(Boolean);
      const read = rulePreferences.length
        ? `key.startsWith('preference.') ? ${prefix}ReadPreference(${document}, key) : ${prefix}ReadMeta(${document}, key)`
        : `${prefix}ReadMeta(${document}, key)`;
      const subscribe = leases.map((lease) => `leases.push(${lease});`).join(' ');
      return ruleMeta
        ? `getMeta: ${typed ? '(key: string)' : '/** @param {string} key */ (key)'} => ${read}, subscribeMeta: ${typed ? '(notify: () => void)' : '/** @param {() => void} notify */ (notify)'} => { ${typed ? 'const leases: (() => void)[] = [];' : '/** @type {(() => void)[]} */ const leases = [];'} try { ${subscribe} } catch (error) { ${prefix}ReleaseMeta([() => { throw error; }, ...leases]); } return () => ${prefix}ReleaseMeta(leases); },`
        : '';
    },
    imports: [
      ruleMeta
        ? `import { releaseNativeMeta as ${prefix}ReleaseMeta } from './.proto-ui/meta/subscription-v1';`
        : '',
      shader
        ? `import {createNativeShader as ${prefix}CreateShader} from './.proto-ui/shader/owner-web-v1';`
        : '',
      delay
        ? `import { createNativeDelay as ${prefix}CreateDelay, type NativeDelayTask as ${prefix}DelayTask } from './.proto-ui/async/delay-web-v1';`
        : '',
      snapshot
        ? `import { createNativePresence as ${prefix}CreatePresence, snapshotNativeCompletion as ${prefix}SnapshotCompletion, type NativePresenceOwner as ${prefix}PresenceOwner } from '${presenceImport}';`
        : '',
      meta
        ? `import { readNativeWebMeta as ${prefix}ReadMeta } from './.proto-ui/meta/web-snapshot-v1';`
        : '',
      ruleColorScheme
        ? `import { subscribeNativeColorScheme as ${prefix}SubscribeColorScheme } from './.proto-ui/meta/color-scheme-source-v1';`
        : '',
      rulePreferences.length
        ? `import { subscribeNativeRulePreferences as ${prefix}SubscribePreferences, readNativeRulePreference as ${prefix}ReadPreference } from './.proto-ui/meta/preference-source-v1';`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
    jsImports: [
      ruleMeta
        ? `import { releaseNativeMeta as ${prefix}ReleaseMeta } from './.proto-ui/meta/subscription-v1';`
        : '',
      shader
        ? `import {createNativeShader as ${prefix}CreateShader} from './.proto-ui/shader/owner-web-v1';`
        : '',
      delay
        ? `import { createNativeDelay as ${prefix}CreateDelay } from './.proto-ui/async/delay-web-v1';\n/** @typedef {import('./.proto-ui/async/delay-web-v1').NativeDelayTask} ${prefix}DelayTask */`
        : '',
      snapshot
        ? `import { createNativePresence as ${prefix}CreatePresence, snapshotNativeCompletion as ${prefix}SnapshotCompletion } from '${presenceImport}';\n/** @template Run @typedef {import('${presenceImport}').NativePresenceOwner<Run>} ${prefix}PresenceOwner */`
        : '',
      meta
        ? `import { readNativeWebMeta as ${prefix}ReadMeta } from './.proto-ui/meta/web-snapshot-v1';`
        : '',
      ruleColorScheme
        ? `import { subscribeNativeColorScheme as ${prefix}SubscribeColorScheme } from './.proto-ui/meta/color-scheme-source-v1';`
        : '',
      rulePreferences.length
        ? `import { subscribeNativeRulePreferences as ${prefix}SubscribePreferences, readNativeRulePreference as ${prefix}ReadPreference } from './.proto-ui/meta/preference-source-v1';`
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
      root?: string;
      prepare?: string;
      typed?: boolean;
    }): string {
      const typed = options.typed !== false;
      return [
        shader
          ? `const ${prefix}Shader = ${prefix}CreateShader({setup: () => { ${options.setup}; }, alive: () => ${options.alive}, root: () => ${options.root ?? 'null'}, prepare: () => { ${options.prepare ?? ''} }});`
          : '',
        delay
          ? `const ${prefix}Delay = ${prefix}CreateDelay({ runtime: () => { ${options.runtime}; }, alive: () => ${options.alive}, invoke: callback => { ${options.invoke}; }, report: error => console.error('[Delay] callback failed', error) });`
          : '',
        presence
          ? `const ${prefix}Presence = ${prefix}CreatePresence${typed ? `<${options.run}>` : ''}({ setup: () => { ${options.setup}; }, runtime: () => { ${options.runtime}; }, alive: () => ${options.alive}, invoke: callback => { ${options.invokeRun}; }${presentation ? `, root: () => ${options.root ?? 'null'}, prepare: () => { ${options.prepare ?? ''} }` : ''} });`
          : '',
        meta
          ? `const ${prefix}Meta = ${typed ? '(key: string)' : '/** @param {string} key */ (key)'} => ${prefix}ReadMeta(${options.document}, key);`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
    },
    detach: `${delay ? `${prefix}Delay.cancelView();` : ''}${presence ? `${prefix}Presence.detach();` : ''}${shader ? `${prefix}Shader.detach();` : ''}`,
    mount: `${presentation ? `${prefix}Presence.mount();` : ''}${shader ? `${prefix}Shader.mount();` : ''}`,
    refresh: `${presentation ? `${prefix}Presence.refresh();` : ''}${shader ? `${prefix}Shader.refresh();` : ''}`,
    registerSource(source: string): string {
      return presentation ? `${prefix}Presence.registerSource(${source});` : '';
    },
    dispose: `${delay ? `${prefix}Delay.dispose();` : ''}${presence ? `${prefix}Presence.dispose();` : ''}${shader ? `${prefix}Shader.dispose();` : ''}`,
  };
}

export type NativeHostAtomPlan = ReturnType<typeof nativeHostAtomPlan>;

/** Preserve receiver and argument evaluation, including optional receiver short circuit. */
export function emitNativeHostAtom(
  value: ExpressionIR,
  emit: (value: ExpressionIR) => string,
  prefix: string,
  shaderPlans?: ReadonlyMap<string, ShaderPresentationDeclaration>
): string | undefined {
  if (value.kind !== 'operation') return undefined;
  const args = () => value.arguments.map(emit).join(', ');
  let body: string | undefined;
  switch (value.operation) {
    case 'feedback.material.shader': {
      const plan = shaderPlans?.get(shaderPlanKey(value.arguments[0]));
      // The demand walk can prove the statement unreachable after an abrupt
      // factory invocation. Such a site must not allocate an unused shader host
      // or attempt to specialize data that can never be constructed.
      if (shaderPlans && !plan) return '(void 0)';
      body = emitNativeShaderDeclaration(value.arguments[0], prefix, plan);
      break;
    }
    case 'feedback.style.presence':
      body = `${prefix}Presence.declare(${args()})`;
      break;
    case 'scheduler.delay':
      return `${prefix}Delay.schedule(${args()})`;
    case 'presentation.snapshotCompletion':
      return `${prefix}SnapshotCompletion(${args()})`;
    case 'presence.owner':
      body = `${prefix}Presence.owner()`;
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
