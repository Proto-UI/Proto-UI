import { getSemanticGroupKeyV0 } from '../../core/src/spec/feedback/semantic-merge';
import { assertTwTokenV0 } from '../../core/src/spec/feedback/tokens';
import type { CompileResult, CompilerDiagnostic, SourceSpan } from './ir';

export type StyleScope = 'host' | 'surface' | 'boundary';
export type StyleValue = string | number | boolean;
/** The existing feedback StyleHandle, made readonly for portable plans. */
export interface StyleTokenHandle {
  kind: 'tw';
  tokens: readonly string[];
}
export interface StylePropertyHandle {
  kind: 'property';
  name: string;
  value: StyleValue;
}
export type StylePlanHandle = StyleTokenHandle | StylePropertyHandle;
export interface StyleIntent {
  kind: 'feedback.style.use' | 'feedback.style.patch' | 'feedback.style.suppress';
  handles: readonly StylePlanHandle[];
}
export interface StyleContribution {
  id: string;
  scope: StyleScope;
  layer: 'base' | 'rule' | 'patch';
  /** Higher priority wins within a layer; ties follow declaration/handle order. */
  priority?: number;
  enabled?: boolean;
  intents: readonly StyleIntent[];
  span?: SourceSpan;
}
export interface StylePlan {
  contributions: readonly StyleContribution[];
}
export type StyleTargetValue =
  | { kind: 'token'; name: string; value: true }
  | { kind: 'property'; name: string; value: StyleValue };
/** No implicit CSS translation. Native backends supply their own exact value table. */
export interface StyleTargetMapping {
  target: string;
  tokens: Readonly<Record<string, readonly StyleTargetValue[]>>;
  properties?: Readonly<
    Record<
      string,
      {
        name: string;
        values: readonly { input: StyleValue; output: StyleValue }[];
      }
    >
  >;
}
export type StyleTargetEntry = StyleTargetValue & { scope: StyleScope };
export type StyleProjectionEntry = StyleTargetEntry & {
  contributor: string;
  span?: SourceSpan;
};
export interface StyleProjection {
  target: string;
  entries: readonly StyleProjectionEntry[];
}

const syntheticSpan: SourceSpan = {
  file: '<style-plan>',
  start: 0,
  end: 0,
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 1,
};
const layerRank = { base: 0, rule: 1, patch: 2 } as const;
const keyOf = (entry: { scope: StyleScope; kind: string; name: string }): string =>
  JSON.stringify([entry.scope, entry.kind, entry.name]);
const scalar = (value: unknown): value is StyleValue =>
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value));
const nameValid = (name: string): boolean =>
  typeof name === 'string' && name.length > 0 && name.trim() === name && !/[\r\n\0]/.test(name);
const own = <T>(record: Readonly<Record<string, T>>, name: string): T | undefined =>
  Object.prototype.hasOwnProperty.call(record, name) ? record[name] : undefined;

interface ResolvedContribution {
  scope: StyleScope;
  group: string;
  kind: 'tw' | 'property';
  suppress: boolean;
  writes: readonly StyleTargetValue[];
  contributor: StyleContribution;
  rank: number;
  priority: number;
  order: number;
}

/**
 * Resolve every declared value before producing output, including disabled rules.
 * Evaluation is pure: withdrawal is represented by disabling/removing a contribution.
 * Suppression masks only compiler contributions, never the consumer's own layer.
 */
export function evaluateStylePlan(
  plan: StylePlan,
  mapping: StyleTargetMapping
): CompileResult<StyleProjection> {
  const diagnostics: CompilerDiagnostic[] = [];
  const resolved: ResolvedContribution[] = [];
  const ids = new Set<string>();
  let order = 0;
  const fail = (message: string, contribution?: StyleContribution, unsupported = false) => {
    diagnostics.push({
      code: unsupported ? 'PUI4202' : 'PUI4201',
      category: unsupported ? 'unsupported-input' : 'invalid-ir',
      message,
      span: contribution?.span ?? syntheticSpan,
    });
  };
  if (!nameValid(mapping.target)) fail('A style target mapping requires a target identity.');
  for (const contribution of plan.contributions) {
    if (!nameValid(contribution.id) || ids.has(contribution.id))
      fail(
        `Style contributor identity must be nonempty and unique: ${contribution.id}.`,
        contribution
      );
    ids.add(contribution.id);
    if (
      !(
        contribution.scope === 'host' ||
        contribution.scope === 'surface' ||
        contribution.scope === 'boundary'
      )
    )
      fail(`Unknown style scope: ${contribution.scope}.`, contribution);
    if (!Object.prototype.hasOwnProperty.call(layerRank, contribution.layer))
      fail(`Unknown style layer: ${contribution.layer}.`, contribution);
    if (!Number.isFinite(contribution.priority ?? 0))
      fail(`Style priority must be finite for ${contribution.id}.`, contribution);
    for (const intent of contribution.intents) {
      if (
        intent.kind !== 'feedback.style.use' &&
        intent.kind !== 'feedback.style.patch' &&
        intent.kind !== 'feedback.style.suppress'
      ) {
        fail(`Unsupported style intent: ${intent.kind}.`, contribution, true);
        continue;
      }
      const suppress = intent.kind === 'feedback.style.suppress';
      const rank = Math.max(
        layerRank[contribution.layer],
        intent.kind === 'feedback.style.use' ? 0 : 2
      );
      for (const handle of intent.handles) {
        if (handle.kind === 'tw') {
          for (const token of handle.tokens) {
            try {
              assertTwTokenV0(token, intent.kind);
            } catch (error) {
              fail(error instanceof Error ? error.message : String(error), contribution, true);
              continue;
            }
            if (token === 'data-pui-style') {
              fail(
                'Host style artifacts cannot be authored as feedback tokens.',
                contribution,
                true
              );
              continue;
            }
            const writes = own(mapping.tokens, token);
            if (!writes?.length) {
              fail(
                `Style token ${JSON.stringify(token)} has no mapping for ${mapping.target}.`,
                contribution,
                true
              );
              continue;
            }
            if (
              writes.some(
                (write) =>
                  !nameValid(write.name) ||
                  (write.kind !== 'token' && write.kind !== 'property') ||
                  (write.kind === 'token' ? write.value !== true : !scalar(write.value))
              )
            ) {
              fail(
                `Invalid mapped value for style token ${JSON.stringify(token)} on ${mapping.target}.`,
                contribution,
                true
              );
              continue;
            }
            resolved.push({
              scope: contribution.scope,
              kind: 'tw',
              group: getSemanticGroupKeyV0(token),
              suppress,
              writes,
              contributor: contribution,
              rank,
              priority: contribution.priority ?? 0,
              order: order++,
            });
          }
        } else if (handle.kind === 'property') {
          const property = mapping.properties && own(mapping.properties, handle.name);
          const value = property?.values.find((entry) => entry.input === handle.value);
          if (!nameValid(handle.name) || !scalar(handle.value)) {
            fail(`Invalid declared style property ${JSON.stringify(handle.name)}.`, contribution);
            continue;
          }
          if (!property || !nameValid(property.name) || !value || !scalar(value.output)) {
            fail(
              `Style property ${JSON.stringify(handle.name)} value ${JSON.stringify(handle.value)} has no supported mapping for ${mapping.target}.`,
              contribution,
              true
            );
            continue;
          }
          resolved.push({
            scope: contribution.scope,
            kind: 'property',
            group: handle.name,
            suppress,
            writes: [{ kind: 'property', name: property.name, value: value.output }],
            contributor: contribution,
            rank,
            priority: contribution.priority ?? 0,
            order: order++,
          });
        } else {
          fail('Unsupported style handle kind.', contribution, true);
        }
      }
    }
  }
  if (diagnostics.length) return { ok: false, diagnostics };
  const compare = (left: ResolvedContribution, right: ResolvedContribution) =>
    left.rank - right.rank || left.priority - right.priority || left.order - right.order;
  resolved.sort(compare);
  const groups = new Map<string, ResolvedContribution>();
  for (const atom of resolved) {
    if (atom.contributor.enabled === false) continue;
    const key = keyOf({ scope: atom.scope, kind: atom.kind, name: atom.group });
    if (atom.suppress) groups.delete(key);
    else groups.set(key, atom);
  }
  // Mapping can expand tokens and make distinct semantic groups collide on one
  // native property. Resolve these collisions by the winning declaration order,
  // not by Map insertion order (which belongs to the original semantic group).
  const entries = new Map<string, StyleProjectionEntry>();
  for (const atom of [...groups.values()].sort(compare)) {
    for (const write of atom.writes) {
      const entry: StyleProjectionEntry = {
        ...write,
        scope: atom.scope,
        contributor: atom.contributor.id,
        ...(atom.contributor.span ? { span: atom.contributor.span } : {}),
      };
      entries.set(keyOf(entry), entry);
    }
  }
  return { ok: true, value: { target: mapping.target, entries: [...entries.values()] } };
}

export interface StyleOwnedEntry {
  entry: StyleTargetEntry;
  /** The consumer value displaced at acquisition or observed while owning. */
  restore?: StyleValue;
}
export interface StyleProjectionState {
  target: string;
  owned: readonly StyleOwnedEntry[];
}
export type StyleProjectionChange =
  | { kind: 'set'; entry: StyleTargetEntry }
  | { kind: 'remove'; scope: StyleScope; channel: 'token' | 'property'; name: string };
export interface StyleProjectionDiff {
  changes: readonly StyleProjectionChange[];
  state: StyleProjectionState;
}

/**
 * Diff against an observed host snapshot; do not pass only compiler-owned values.
 * Keep returned state between calls. Release restores the displaced consumer
 * value, unless the consumer changed it since our last projection. A snapshot
 * cannot distinguish an app write identical to our own last value.
 * Scopes remain distinct; a backend must resolve physical target identity itself.
 */
export function diffStyleProjection(
  previous: StyleProjectionState | undefined,
  next: StyleProjection,
  current: readonly StyleTargetEntry[]
): StyleProjectionDiff {
  if (previous && previous.target !== next.target)
    throw new Error(
      'Cannot diff style projections for different targets; release the old target first.'
    );
  const observed = new Map(current.map((entry) => [keyOf(entry), entry]));
  const desired = new Map(next.entries.map((entry) => [keyOf(entry), entry]));
  const old = new Map(previous?.owned.map((owned) => [keyOf(owned.entry), owned]) ?? []);
  const changes: StyleProjectionChange[] = [];
  const owned: StyleOwnedEntry[] = [];
  for (const [key, ownership] of old) {
    if (desired.has(key)) continue;
    const actual = observed.get(key);
    // Missing or externally replaced values no longer belong to us.
    if (!actual || actual.value !== ownership.entry.value) continue;
    if (ownership.restore === undefined) {
      changes.push({
        kind: 'remove',
        scope: actual.scope,
        channel: actual.kind,
        name: actual.name,
      });
    } else if (actual.value !== ownership.restore) {
      changes.push({ kind: 'set', entry: targetEntry(actual, ownership.restore) });
    }
  }
  for (const [key, entry] of desired) {
    const actual = observed.get(key);
    const ownership = old.get(key);
    const restore =
      ownership && actual?.value === ownership.entry.value ? ownership.restore : actual?.value;
    const target = targetEntry(entry, entry.value);
    if (!actual || actual.value !== entry.value) changes.push({ kind: 'set', entry: target });
    owned.push({ entry: target, ...(restore !== undefined ? { restore } : {}) });
  }
  return { changes, state: { target: next.target, owned } };
}

function targetEntry(entry: StyleTargetEntry, value: StyleValue): StyleTargetEntry {
  if (entry.kind === 'token') {
    if (value !== true) throw new Error('A projected token can only represent presence.');
    return { kind: 'token', scope: entry.scope, name: entry.name, value: true };
  }
  return { kind: 'property', scope: entry.scope, name: entry.name, value };
}
