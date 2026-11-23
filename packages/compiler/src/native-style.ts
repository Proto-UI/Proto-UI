import { getSemanticGroupKeyV0 } from '../../core/src/spec/feedback/semantic-merge';
import type { ExpressionIR } from './ir';
import type { RuleCondition } from './rule-declarations';
import type { StyleTokenHandle } from './style-plan';

/** Groups are resolved by the existing portable grammar at compile time, never a host grammar. */
export function emitNativeStyleHandle(handle: StyleTokenHandle, typescript = true): string {
  const value = JSON.stringify({
    kind: 'tw',
    tokens: handle.tokens,
    groups: handle.tokens.map(getSemanticGroupKeyV0),
  });
  return typescript ? `(${value} as const)` : value;
}

/** Emit an ordinary checked predicate, not a serialized Rule tree or interpreter. */
export function emitNativeRule(
  value: Extract<ExpressionIR, { kind: 'rule' }>,
  expression: (value: ExpressionIR) => string,
  style: string,
  props: string,
  typescript = true
): string {
  let prefix = '__puiRule';
  const sourceNames = JSON.stringify(value);
  while (sourceNames.includes(prefix)) prefix += '_';
  const captures = [
    ...value.states.map((state, index) => ({ ...state, name: `${prefix}State${index}` })),
    ...(value.styles ?? []).map((style, index) => ({ ...style, name: `${prefix}Style${index}` })),
    ...(value.targets ?? []).map((target, index) => ({
      ...target,
      name: `${prefix}Target${index}`,
    })),
  ];
  const states = new Map(
    captures.slice(0, value.states.length).map((state) => [state.id, state.name])
  );
  const styles = new Map(
    captures
      .slice(value.states.length, value.states.length + (value.styles?.length ?? 0))
      .map((handle) => [handle.id, handle.name])
  );
  const targets = new Map(
    captures
      .slice(value.states.length + (value.styles?.length ?? 0))
      .map((target) => [target.id, target.name])
  );
  function condition(node: RuleCondition): string {
    if (node.type === 'true' || node.type === 'false') return node.type;
    if (node.type === 'eq' || node.type === 'gte') {
      const signal =
        node.left.type === 'prop'
          ? `${props}[${JSON.stringify(node.left.key)}]`
          : node.left.type === 'meta'
            ? `${style}.meta(${JSON.stringify(node.left.key)})`
            : `${states.get(node.left.id)!}.get()`;
      if (node.type === 'gte')
        return `((${typescript ? 'value: unknown' : 'value'}) => typeof value === 'number' && Number.isFinite(value) && value >= ${node.right})(${signal})`;
      return `(${signal} === ${JSON.stringify(node.right)})`;
    }
    if (node.type === 'not') return `!(${condition(node.expr)})`;
    if (!node.exprs.length) return node.type === 'all' ? 'true' : 'false';
    return `(${node.exprs.map(condition).join(node.type === 'all' ? ' && ' : ' || ')})`;
  }
  const metaKeys = value.declaration.deps.flatMap((dependency) =>
    dependency.kind === 'meta' ? [dependency.key] : []
  );
  const groups = new Map<
    string | undefined,
    (typeof value.declaration.intent.ops)[number]['handles']
  >();
  for (const operation of value.declaration.intent.ops) {
    const target = operation.target?.id;
    const handles = groups.get(target) ?? [];
    handles.push(...operation.handles);
    groups.set(target, handles);
  }
  const rules = [...groups].map(
    ([target, handles]) =>
      `${style}.rule(() => ${condition(value.declaration.when)}, [${handles.map((handle) => (handle.kind === 'reference' ? styles.get(handle.id)! : emitNativeStyleHandle(handle, typescript))).join(', ')}]${metaKeys.length || target ? `, ${JSON.stringify(metaKeys)}` : ''}${target ? `, ${targets.get(target)!}` : ''})`
  );
  const declaration =
    rules.length === 1
      ? rules[0]
      : `(() => { const ${prefix}Rules = [${rules.join(', ')}]; return Object.freeze({ id: ${prefix}Rules[0]?.id ?? 0, dispose() { for (const rule of ${prefix}Rules) rule.dispose(); } }); })()`;
  return captures.length
    ? `(() => { ${captures.map((capture) => `const ${capture.name} = ${expression(capture.value)};`).join(' ')} return ${declaration}; })()`
    : declaration;
}

export const nativeStyleArtifact = {
  path: '.proto-ui/style/native-v1.ts',
  kind: 'source' as const,
  contents: `// Native style/Rule projection v1. No Proto-UI Runtime/Core/Adapter dependency.
export type NativeStyleHandle = { readonly kind: 'tw'; readonly tokens: readonly string[]; readonly groups: readonly string[] };
export type NativeRuleHandle = { readonly id: number; dispose(): void };
export type NativeDecorationTarget = Readonly<object>;
export type NativeDecorationBinding = { target: NativeDecorationTarget; sink(value: Readonly<{ kind: 'tw'; tokens: readonly string[] }>): void };
export interface NativeStyle {
  meta(key: string): unknown;
  use(...handles: NativeStyleHandle[]): () => void;
  patch(...handles: NativeStyleHandle[]): void;
  suppress(...handles: NativeStyleHandle[]): void;
  clearPatch(): void;
  declareDecoration(): NativeDecorationTarget;
  to(target: NativeDecorationTarget): Pick<NativeStyle, 'use'>;
  validateDecorations(targets: readonly NativeDecorationTarget[]): void;
  bindDecorations(bindings: readonly NativeDecorationBinding[]): void;
  releaseDecorations(): void;
  rule(test: () => boolean, handles: readonly NativeStyleHandle[], metaKeys?: readonly string[], target?: NativeDecorationTarget): NativeRuleHandle;
  refresh(): void;
  mount(): void;
  unmount(): void;
  tokens(): readonly string[];
  serverTokens(): readonly string[];
  readMeta(key: string): unknown;
  dispose(): void;
}
type Chunk = { handles: readonly NativeStyleHandle[]; active: boolean };
type Rule = Chunk & { test(): boolean; metaKeys: readonly string[] };
type Patch = { token?: string };
function validate(handle: NativeStyleHandle): void {
  if (!handle || handle.kind !== 'tw' || !Array.isArray(handle.tokens) || !Array.isArray(handle.groups)
    || handle.tokens.length !== handle.groups.length)
    throw new TypeError('[Style] expected a checked single tw handle');
}
export function templateStyleTokens(handle: NativeStyleHandle): string {
  validate(handle);
  return handle.tokens.join(' ');
}
export function createNativeStyle(options: {
  ensureSetup(): void;
  ensureRuntime(): void;
  isAlive(): boolean;
  getMeta?(key: string): unknown;
  subscribeMeta?(notify: () => void): () => void;
  project(tokens: readonly string[]): void;
  /** Present only when authored rules reach supported host-meta dependencies. */
  meta?: { read(key: string): unknown; subscribe(invalidate: () => void, keys: readonly string[]): () => void };
}): NativeStyle {
  const chunks: Chunk[] = [], rules: Rule[] = [];
  const patches = new Map<string, Patch>();
  const decorations = new Map<NativeDecorationTarget, { style: NativeStyle; sink: NativeDecorationBinding['sink'] | null }>();
  let decorationsBound = false;
  let mounted = false, disposed = false, nextRuleId = 1;
  let metaGeneration = 0;
  let releaseMeta: (() => void) | undefined;
  let projected: readonly string[] = [];
  function snapshot(includeRules = mounted): string[] {
    const merged = new Map<string, string>();
    function append(handles: readonly NativeStyleHandle[]): void {
      for (const handle of handles) {
        for (let index = 0; index < handle.tokens.length; ++index)
          merged.set(handle.groups[index], handle.tokens[index]);
      }
    }
    for (const chunk of chunks) if (chunk.active) append(chunk.handles);
    if (includeRules) for (const rule of rules) if (rule.active && rule.test()) append(rule.handles);
    for (const group of patches.keys()) merged.delete(group);
    for (const [group, patch] of patches) if (patch.token !== undefined) merged.set(group, patch.token);
    return [...merged.values()];
  }
  function refresh(): void {
    if (!mounted || disposed || !options.isAlive()) return;
    for (const target of decorations.values()) target.style.refresh();
    const next = snapshot();
    if (next.length === projected.length && next.every((token, index) => token === projected[index])) return;
    projected = next;
    options.project(next);
  }
  function runtime(): void {
    if (disposed || !options.isAlive()) throw new Error('[Style] owner is terminally disposed');
    options.ensureRuntime();
  }
  function record(handles: readonly NativeStyleHandle[]): Chunk {
    for (const handle of handles) validate(handle);
    return { handles, active: true };
  }
  const style = {
    meta(key: string): unknown { return key.startsWith('preference.') && !mounted ? 'unknown' : options.getMeta?.(key) ?? (mounted && !disposed ? options.meta?.read(key) : undefined); },
    use(...handles: NativeStyleHandle[]): () => void {
      options.ensureSetup();
      const chunk = record(handles);
      chunks.push(chunk);
      return () => {
        options.ensureSetup();
        if (!chunk.active) return;
        chunk.active = false;
        refresh();
      };
    },
    patch(...handles: NativeStyleHandle[]): void {
      runtime();
      for (const handle of handles) {
        validate(handle);
        for (let index = 0; index < handle.tokens.length; ++index)
          patches.set(handle.groups[index], { token: handle.tokens[index] });
      }
      refresh();
    },
    suppress(...handles: NativeStyleHandle[]): void {
      runtime();
      for (const handle of handles) {
        validate(handle);
        for (const group of handle.groups) patches.set(group, {});
      }
      refresh();
    },
    clearPatch(): void { runtime(); patches.clear(); refresh(); },
    declareDecoration(): NativeDecorationTarget {
      options.ensureSetup();
      if (disposed || mounted || decorationsBound) throw new Error('[Style] decoration declaration lifetime ended');
      const identity = Object.freeze({});
      const target = { style: null as unknown as NativeStyle, sink: null as NativeDecorationBinding['sink'] | null };
      target.style = createNativeStyle({ ...options, project(tokens) { target.sink?.({ kind: 'tw', tokens }); } });
      decorations.set(identity, target);
      return identity;
    },
    to(identity: NativeDecorationTarget): Pick<NativeStyle, 'use'> {
      options.ensureSetup();
      const target = decorations.get(identity);
      if (disposed || !target) throw new Error('[Style] foreign or disposed decoration target');
      return Object.freeze({ use: target.style.use });
    },
    validateDecorations(targets: readonly NativeDecorationTarget[]): void {
      if (disposed || !options.isAlive()) throw new Error('[Style] owner is terminally disposed');
      if (new Set(targets).size !== targets.length || targets.length !== decorations.size || targets.some(target => !decorations.has(target)))
        throw new Error('[Style] decorations require the complete unique owned target set');
    },
    bindDecorations(bindings: readonly NativeDecorationBinding[]): void {
      if (decorationsBound) throw new Error('[Style] decoration physical view already bound');
      style.validateDecorations(bindings.map(binding => binding.target));
      if (bindings.some(binding => typeof binding.sink !== 'function')) throw new Error('[Style] invalid decoration sink');
      decorationsBound = true;
      try {
        for (const binding of bindings) decorations.get(binding.target)!.sink = binding.sink;
        if (mounted) for (const target of decorations.values()) target.style.mount();
      } catch (error) { style.releaseDecorations(); throw error; }
    },
    releaseDecorations(): void {
      decorationsBound = false;
      for (const target of decorations.values()) { target.style.unmount(); target.sink = null; }
    },
    rule(test: () => boolean, handles: readonly NativeStyleHandle[], metaKeys: readonly string[] = [], target?: NativeDecorationTarget): NativeRuleHandle {
      options.ensureSetup();
      if (target !== undefined) {
        const child = decorations.get(target);
        if (disposed || !child) throw new Error('[Style] foreign or disposed decoration target');
        return child.style.rule(test, handles, metaKeys);
      }
      const rule = { ...record(handles), test, metaKeys };
      rules.push(rule);
      return Object.freeze({ id: nextRuleId++, dispose() {
        options.ensureSetup();
        if (!rule.active) return;
        rule.active = false;
        refresh();
      } });
    },
    refresh,
    mount(): void {
      if (disposed || !options.isAlive()) return;
      if (!mounted) { mounted = true; ++metaGeneration; }
      const generation = metaGeneration;
      if (!releaseMeta && (options.subscribeMeta || options.meta)) {
        const releases: (() => void)[] = [];
        const release = () => { let failed = false, first: unknown; for (const off of releases.splice(0)) { try { off(); } catch (error) { if (!failed) { failed = true; first = error; } } } if (failed) throw first; };
        const notify = () => { if (mounted && generation === metaGeneration) refresh(); };
        try {
          if (options.subscribeMeta) releases.push(options.subscribeMeta(notify));
          if (options.meta) releases.push(options.meta.subscribe(notify, [...new Set(rules.filter(rule => rule.active).flatMap(rule => rule.metaKeys))]));
        } catch (error) { if (generation === metaGeneration) { mounted = false; ++metaGeneration; } try { release(); } catch {} throw error; }
        if (!mounted || disposed || generation !== metaGeneration) { release(); return; }
        releaseMeta = release;
      }
      const next = snapshot(); options.project(next); projected = next;
      if (decorationsBound) for (const target of decorations.values()) target.style.mount();
    },
    unmount(): void { mounted = false; ++metaGeneration; const release = releaseMeta; releaseMeta = undefined; projected = []; try { release?.(); } finally { style.releaseDecorations(); } },
    tokens(): readonly string[] { return snapshot(); },
    readMeta(key: string): unknown { return mounted && !disposed ? options.meta?.read(key) : undefined; },
    serverTokens(): readonly string[] {
      if (disposed || !options.isAlive()) throw new Error('[Style] owner is terminally disposed');
      return snapshot(true);
    },
    dispose(): void { disposed = true; mounted = false; ++metaGeneration; const release = releaseMeta; releaseMeta = undefined; chunks.length = 0; rules.length = 0; patches.clear(); projected = []; try { release?.(); } finally { for (const target of decorations.values()) target.style.dispose(); decorations.clear(); } },
  };
  return style;
}
`,
};
