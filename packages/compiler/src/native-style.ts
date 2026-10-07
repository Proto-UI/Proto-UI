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
  const states = new Map(value.states.map((state) => [state.id, state.value]));
  function condition(node: RuleCondition): string {
    if (node.type === 'true' || node.type === 'false') return node.type;
    if (node.type === 'eq') {
      const signal =
        node.left.type === 'prop'
          ? `${props}[${JSON.stringify(node.left.key)}]`
          : `${expression(states.get(node.left.id)!)}.get()`;
      return `(${signal} === ${JSON.stringify(node.right)})`;
    }
    if (node.type === 'not') return `!(${condition(node.expr)})`;
    if (!node.exprs.length) return node.type === 'all' ? 'true' : 'false';
    return `(${node.exprs.map(condition).join(node.type === 'all' ? ' && ' : ' || ')})`;
  }
  const handles = value.declaration.intent.ops.flatMap((operation) => operation.handles);
  return `${style}.rule(() => ${condition(value.declaration.when)}, [${handles.map((handle) => emitNativeStyleHandle(handle, typescript)).join(', ')}])`;
}

export const nativeStyleArtifact = {
  path: '.proto-ui/style/native-v1.ts',
  kind: 'source' as const,
  contents: `// Native style/Rule projection v1. No Proto-UI Runtime/Core/Adapter dependency.
export type NativeStyleHandle = { readonly kind: 'tw'; readonly tokens: readonly string[]; readonly groups: readonly string[] };
export type NativeRuleHandle = { readonly id: number; dispose(): void };
export interface NativeStyle {
  use(...handles: NativeStyleHandle[]): () => void;
  patch(...handles: NativeStyleHandle[]): void;
  suppress(...handles: NativeStyleHandle[]): void;
  clearPatch(): void;
  rule(test: () => boolean, handles: readonly NativeStyleHandle[]): NativeRuleHandle;
  refresh(): void;
  mount(): void;
  unmount(): void;
  tokens(): readonly string[];
  serverTokens(): readonly string[];
  dispose(): void;
}
type Chunk = { handles: readonly NativeStyleHandle[]; active: boolean };
type Rule = Chunk & { test(): boolean };
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
  project(tokens: readonly string[]): void;
}): NativeStyle {
  const chunks: Chunk[] = [], rules: Rule[] = [];
  const patches = new Map<string, Patch>();
  let mounted = false, disposed = false, nextRuleId = 1;
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
    rule(test: () => boolean, handles: readonly NativeStyleHandle[]): NativeRuleHandle {
      options.ensureSetup();
      const rule = { ...record(handles), test };
      rules.push(rule);
      return Object.freeze({ id: nextRuleId++, dispose() {
        options.ensureSetup();
        if (!rule.active) return;
        rule.active = false;
        refresh();
      } });
    },
    refresh,
    mount(): void { mounted = true; const next = snapshot(); options.project(next); projected = next; },
    unmount(): void { mounted = false; projected = []; },
    tokens(): readonly string[] { return snapshot(); },
    serverTokens(): readonly string[] {
      if (disposed || !options.isAlive()) throw new Error('[Style] owner is terminally disposed');
      return snapshot(true);
    },
    dispose(): void { disposed = true; mounted = false; chunks.length = 0; rules.length = 0; patches.clear(); projected = []; },
  };
  return style;
}
`,
};
