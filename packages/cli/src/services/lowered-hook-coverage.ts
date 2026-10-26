import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import {
  createHookSourceSummaryContext,
  createSourceGraphVersionTracker,
  hookSourceCallMutation,
  mutateSourceGraph,
  sourceMembersOneProducer,
  sourceMembersProven,
  type HookSourceState,
  type HookSourceSummaryContext,
  type HookSourceValue,
  type SourceGraphVersionTracker,
} from './hook-source-summary.js';
import { loweredHookStates } from './prototype-style-tokens.js';

/**
 * Mirrors `OFFICIAL_EXPOSED_STATE_NAMES` in `@proto.ui/module-expose-state-web`,
 * which the Web projection maps before it normalizes anything.
 */
const OFFICIAL_EXPOSED_STATE_NAMES: Readonly<Record<string, string>> = Object.freeze({
  '@interaction/disabled': 'disabled',
  '@interaction/hovered': 'hovered',
  '@interaction/pressed': 'pressed',
  '@interaction/focused': 'focused',
  '@focus/focused': 'focused',
  '@interaction/focusVisible': 'focus-visible',
  '@focus/focusVisible': 'focus-visible',
  '@accessibility/expanded': 'expanded',
  '@accessibility/invalid': 'invalid',
  '@accessibility/selected': 'selected',
  '@accessibility/checked': 'checked',
  '@accessibility/current': 'current',
});

export type HookStateUsage = {
  hook: string;
  state: string;
  /** Non-enumerable source identity attached by the scanner for bounded gates. */
  provenance?: HookSourceState;
};

export type UnresolvedStateRead = {
  /** Source text of the part the scanner could not resolve. */
  expression: string;
  /**
   * `subject` — the `w.state(...)` argument did not trace to a hook handle.
   * `comparison` — the right-hand side is not a form the extractor lowers.
   * `intent` — the intent carries no `tw(...)` the extractor can read, so the
   *   rule has no token for a variant to prefix.
   * `spec` — the rule was not given as an object literal, or its `when` and
   *   `intent` were not plain property assignments, which neither analyzer reads.
   * `condition` — the condition is shaped in a way the extractor's selector
   *   analysis does not recognize, such as an aliased builder call.
   */
  reason: 'subject' | 'comparison' | 'intent' | 'spec' | 'condition';
};

export type ExposedLocalUsage = {
  /** The name the prototype declared the state under. */
  state: string;
  /** The public key it is exposed as. */
  exposedAs: string;
  /**
   * The attribute the Web runtime will use. `ExposeStateWebModuleImpl` maps the
   * declared name — the state's `__stateSemantic` — before it falls back to the
   * expose key, so this is derived from the declaration, not the key.
   */
  attribute: string;
};

export type RuleStateScan = {
  /** Reads traced to a hook and state the extractor must be able to resolve. */
  usages: HookStateUsage[];
  /**
   * Reads inside a lowerable rule that the scanner could not trace. These fail
   * the gate rather than disappearing. A read is only counted here when it is
   * neither a hook handle nor a state the prototype declares itself, so it
   * means the scanner has met a shape it does not understand — exactly when the
   * static extractor is most likely to be silently missing the same rule.
   */
  unresolved: UnresolvedStateRead[];
  /**
   * Reads of a prototype-owned state that is exposed, and therefore lowered by
   * the Web runtime to a `data-` attribute. These are not hook pairs, so they
   * are reported separately rather than pretending they came from an `asHook`.
   */
  exposedLocals: ExposedLocalUsage[];
};

type LocalStateBinding = {
  kind: 'localState';
  declaredAs: string | null;
  exposedAs?: string | null;
};

type Binding =
  | {
      kind: 'hookResult';
      hook: string;
      sourceValue?: HookSourceValue;
      sourceAlternatives?: HookSourceValue[];
      sourceAlternativeHooks?: string[];
      sourceAuthority?: boolean;
      bindingNode?: ts.Node;
    }
  /** A callable result member, such as `result.getState`, kept as an alias. */
  | {
      kind: 'callable';
      hook: string;
      sourceValue?: HookSourceValue;
      sourceAlternatives?: HookSourceValue[];
      sourceAlternativeHooks?: string[];
      sourceAuthority?: boolean;
      bindingNode?: ts.Node;
    }
  | {
      kind: 'handleBag';
      hook: string;
      sourceValue?: HookSourceValue;
      sourceAlternatives?: HookSourceValue[];
      sourceAlternativeHooks?: string[];
      sourceAuthority?: boolean;
      bindingNode?: ts.Node;
    }
  | {
      kind: 'handle';
      hook: string;
      state: string;
      sourceState?: HookSourceState;
      sourceAlternatives?: HookSourceState[];
      sourceAlternativeHooks?: string[];
      sourceAuthority?: boolean;
      bindingNode?: ts.Node;
    }
  /** `def.state.bool(...)` — owned by the prototype, not borrowed from a hook. */
  | (LocalStateBinding & {
      /** Handles the name may still hold because a write may be skipped. */
      alternatives?: LocalStateBinding[];
      bindingNode?: ts.Node;
    })
  /** A value a `tw(...)` argument may name, resolved where it was declared. */
  | {
      kind: 'token';
      initializer: ts.Expression;
      /** Members written after the declaration, latest candidates first. */
      members?: Map<string, ts.Expression[]>;
      /** Containers the name may still hold because a write may be skipped. */
      alternates?: ts.Expression[];
      /**
       * Some branch of this container's value is not a form the scanner can
       * resolve, so its member set is known to be incomplete.
       */
      opaque?: boolean;
      bindingNode?: ts.Node;
    }
  /** A named import; only a relative one is something the extractor follows. */
  | {
      kind: 'tokenImport';
      specifier: string;
      imported: string;
      from?: string;
      bindingNode?: ts.Node;
    }
  /**
   * A default import. The imported value is the module's default export, so
   * the local name stands for whatever that export holds and its spelling
   * proves no built-in hook.
   */
  | {
      kind: 'defaultImport';
      specifier: string;
      from?: string;
      bindingNode?: ts.Node;
    }
  /** A parameter: it shadows an outer name and its origin is not recoverable. */
  | { kind: 'opaque'; sourceAuthority?: boolean; bindingNode?: ts.Node };

type Scope = {
  parent: Scope | null;
  bindings: Map<string, Binding>;
  /** The node that created this scope, used to resolve exposures lexically. */
  node: ts.Node | null;
  sourceSummary: HookSourceSummaryContext;
  /**
   * The versions of the containers this scope's owner holds. A scope chain
   * shares one tracker, so a helper inside an owner shares its owner's
   * containers, while an authored setup - its own owner - starts a new one.
   */
  versions: SourceGraphVersionTracker;
};

function lookup(scope: Scope | null, name: string): Binding | null {
  for (let current = scope; current; current = current.parent) {
    const binding = current.bindings.get(name);
    if (binding) return binding;
  }
  return null;
}

/**
 * Whether a write may be skipped at runtime. A branch the source decides
 * statically executes exactly as written; anything else has to keep whatever
 * the name held before it.
 */
function isConditionallyReached(
  node: ts.Node,
  definitelyReachedLogicalAssignments?: WeakSet<ts.Node>
): boolean {
  for (
    let child: ts.Node = node, parent = node.parent;
    parent;
    child = parent, parent = parent.parent
  ) {
    if (ts.isFunctionLike(parent)) return false;
    if (ts.isIfStatement(parent)) {
      if (child === parent.expression) continue;
      if (child === parent.thenStatement && parent.expression.kind === ts.SyntaxKind.TrueKeyword) {
        continue;
      }
      if (child === parent.elseStatement && parent.expression.kind === ts.SyntaxKind.FalseKeyword) {
        continue;
      }
      return true;
    }
    if (ts.isConditionalExpression(parent)) {
      if (child !== parent.condition) return true;
      continue;
    }
    if (
      ts.isSwitchStatement(parent) ||
      ts.isCaseBlock(parent) ||
      ts.isCaseClause(parent) ||
      ts.isDefaultClause(parent) ||
      ts.isTryStatement(parent) ||
      ts.isCatchClause(parent)
    ) {
      return true;
    }
    if (
      ts.isForStatement(parent) ||
      ts.isForOfStatement(parent) ||
      ts.isForInStatement(parent) ||
      ts.isWhileStatement(parent)
    ) {
      if (child === parent.statement) return true;
      continue;
    }
    if (ts.isBinaryExpression(parent)) {
      const operator = parent.operatorToken.kind;
      const shortCircuits =
        operator === ts.SyntaxKind.AmpersandAmpersandToken ||
        operator === ts.SyntaxKind.BarBarToken ||
        operator === ts.SyntaxKind.QuestionQuestionToken ||
        operator === ts.SyntaxKind.AmpersandAmpersandEqualsToken ||
        operator === ts.SyntaxKind.BarBarEqualsToken ||
        operator === ts.SyntaxKind.QuestionQuestionEqualsToken;
      if (
        shortCircuits &&
        child === parent.right &&
        !definitelyReachedLogicalAssignments?.has(parent)
      )
        return true;
    }
  }
  return false;
}

/**
 * Every edge at the latest position at or before `at`, plus everything an
 * earlier position still contributes because the later write may be skipped.
 */
function visibleEdges<T extends { at: number; conditional?: boolean }>(
  edges: T[],
  at: number
): T[] {
  const candidates = edges.filter((edge) => edge.at <= at);
  if (candidates.length === 0) return [];
  const positions = [...new Set(candidates.map((edge) => edge.at))].sort((a, b) => b - a);
  const selected: T[] = [];
  for (const position of positions) {
    const group = candidates.filter((edge) => edge.at === position);
    selected.push(...group);
    if (!group.every((edge) => edge.conditional)) break;
  }
  return selected;
}

function enclosingFunction(node: ts.Node | null): ts.Node | null {
  return node ? (ts.findAncestor(node, (candidate) => ts.isFunctionLike(candidate)) ?? null) : null;
}

/**
 * `(() => { … })()` runs where it is written, so its writes are ordered. An
 * async function may suspend before the write and a generator does not run its
 * body on the call at all, so neither is ordered however it is invoked.
 */
function runsInPlace(fn: ts.Node): boolean {
  const declaration = fn as ts.FunctionLikeDeclaration;
  if (declaration.asteriskToken) return false;
  if (declaration.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)) {
    return false;
  }
  let node: ts.Node = fn;
  while (node.parent && ts.isParenthesizedExpression(node.parent)) node = node.parent;
  return Boolean(
    node.parent && ts.isCallExpression(node.parent) && node.parent.expression === node
  );
}

/**
 * A write inside a callback has not run when a later `def.rule` registers, so
 * the name may still hold what it held before.
 */
/**
 * Whether a statement may hand control somewhere else before finishing. Nested
 * functions are skipped: their `return` belongs to them, not to this sequence.
 */
function mayCompleteAbruptly(node: ts.Node): boolean {
  let found = false;
  const visit = (current: ts.Node): void => {
    if (found || ts.isFunctionLike(current)) return;
    if (
      ts.isReturnStatement(current) ||
      ts.isThrowStatement(current) ||
      ts.isBreakStatement(current) ||
      ts.isContinueStatement(current)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

/**
 * Whether a write is guaranteed to have run by the time `boundary` returns.
 * Being called synchronously proves the function starts, not that this write is
 * reached.
 */
function reachedInPlace(node: ts.Node, boundary: ts.Node): boolean {
  let child: ts.Node = node;
  for (let parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (ts.isBlock(parent) || ts.isCaseClause(parent) || ts.isDefaultClause(parent)) {
      for (const statement of parent.statements) {
        if (statement === child) break;
        if (mayCompleteAbruptly(statement)) return false;
      }
    }
    if (parent === boundary) break;
  }
  return true;
}

function isDeferredWrite(node: ts.Node, readFunction: ts.Node | null): boolean {
  const writing = enclosingFunction(node);
  if (writing === readFunction) return false;
  if (!writing || !runsInPlace(writing)) return true;
  return !reachedInPlace(node, writing);
}

/** Every runtime branch of a conditional, whether or not this recognizes it. */
function conditionalLeafCount(node: ts.Node): number {
  const value =
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isNonNullExpression(node)
      ? conditionalLeafCount(node.expression)
      : null;
  if (value !== null) return value;
  if (!ts.isConditionalExpression(node)) return 1;
  return conditionalLeafCount(node.whenTrue) + conditionalLeafCount(node.whenFalse);
}

/** `var` binds to the function however deeply the declaration is nested. */
function functionScope(scope: Scope): Scope {
  for (let current: Scope | null = scope; current; current = current.parent) {
    const node = current.node;
    if (!node || !current.parent) return current;
    if (ts.isSourceFile(node) || ts.isFunctionLike(node)) return current;
    if (node.parent && ts.isFunctionLike(node.parent)) return current;
  }
  return scope;
}

function isVarList(list: ts.Node): boolean {
  return (
    ts.isVariableDeclarationList(list) && !(list.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const))
  );
}

function isLoopStatement(node: ts.Node): boolean {
  return ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node);
}

/** The scope a name is already bound in, so an assignment does not shadow it. */
function scopeBinding(scope: Scope, name: string): Scope | null {
  for (let current: Scope | null = scope; current; current = current.parent) {
    if (current.bindings.has(name)) return current;
  }
  return null;
}

function introducesScope(node: ts.Node): boolean {
  return (
    ts.isSourceFile(node) ||
    ts.isBlock(node) ||
    ts.isModuleBlock(node) ||
    ts.isCaseBlock(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isCatchClause(node) ||
    ts.isFunctionLike(node)
  );
}

/**
 * Traces every `w.state(x)` a rule condition reads back to the `asHook()` whose
 * state handles produced it, for rules the runtime actually lowers.
 *
 * Bindings resolve through a lexical scope chain rather than one flat table, so
 * a nested or sibling declaration that reuses a name cannot change the hook
 * identity of a usage in an enclosing scope.
 *
 * A rule is skipped when the runtime would keep it on the runtime plan anyway,
 * because a pair the runtime never lowers needs no static entry:
 *   - any dependency the runtime's `isStateMetaDeps` refuses, which is every
 *     kind but `state` and `meta` — `prop` and `ctx` alike;
 *   - an `any(...)` condition, which the runtime does not decompose;
 *   - a condition whose variants are all negative, which both sides skip.
 *
 * A comparison the extractor does not lower is not one of those: the scanner
 * cannot tell whether the rule wanted a static entry, so it reports the leaf
 * rather than deciding for itself.
 */
export function scanRuleStateReads(
  sourceText: string,
  fileName = 'source.proto.ts',
  suppliedSummary?: HookSourceSummaryContext
): RuleStateScan {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const sourceSummary = suppliedSummary ?? createHookSourceSummaryContext();
  sourceSummary.registerSource(source);

  const usages: HookStateUsage[] = [];
  const unresolved: UnresolvedStateRead[] = [];
  const exposedLocals: ExposedLocalUsage[] = [];
  let hasObjectPrototypeEscape = false;

  /**
   * `def.expose.state('hidden', hidden)` by handle name. The Web runtime turns
   * the exposed key into a `data-` attribute and lowers rules on that state, so
   * an exposed local is not the same as a purely internal one.
   */
  /** The same normalization `createExposeStateWebNameMap` applies. */
  const exposedDataAttributeName = (key: string): string =>
    // The table inherits `Object.prototype`, so `constructor` is not an entry.
    (Object.hasOwn(OFFICIAL_EXPOSED_STATE_NAMES, key)
      ? OFFICIAL_EXPOSED_STATE_NAMES[key]
      : undefined) ??
    key
      .trim()
      .replace(/\s+/g, '-')
      .replace(/\./g, '-')
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();

  const unwrap = (node: ts.Node): ts.Node =>
    ts.isNonNullExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node)
      ? unwrap(node.expression)
      : node;

  const inspectPrototype = (node: ts.Node): void => {
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === 'prototype' &&
      (() => {
        const owner = unwrap(node.expression);
        if (!ts.isIdentifier(owner)) return false;
        return owner.text === 'Object';
      })()
    ) {
      hasObjectPrototypeEscape = true;
      return;
    }
    ts.forEachChild(node, inspectPrototype);
  };
  inspectPrototype(source);

  const sourceEnvironment = (scope: Scope): Map<string, HookSourceValue> => {
    const environment = new Map<string, HookSourceValue>();
    for (let current: Scope | null = scope; current; current = current.parent) {
      for (const [name, binding] of current.bindings) {
        if (environment.has(name)) continue;
        // An imported producer/factory is resolved by the source summary's
        // module graph. Marking it as an unknown local would shadow that
        // admitted source identity before `resolve` can follow the import.
        // Nearest authored locals still enter as unknown and therefore retain
        // lexical-shadow protection.
        if (binding.kind === 'tokenImport' || binding.kind === 'defaultImport') continue;
        if (binding.kind === 'handle' && binding.sourceState) {
          environment.set(name, { kind: 'state', state: binding.sourceState });
        } else if ('sourceValue' in binding && binding.sourceValue) {
          environment.set(name, binding.sourceValue);
        } else {
          // A nearest local/parameter that is not source-backed still shadows
          // an outer producer. Omitting it would let summary resolution reach a
          // stale same-name source value from an enclosing scope.
          environment.set(name, { kind: 'unknown', reason: 'lexically shadowed' });
        }
      }
    }
    return environment;
  };

  const sourceValueHasProvenance = (value: HookSourceValue): boolean => {
    if (value.kind === 'unknown') return false;
    if (value.kind === 'state' || value.kind === 'result' || value.kind === 'callable') return true;
    for (const member of value.members.values()) {
      if (sourceValueHasProvenance(member)) return true;
    }
    return false;
  };

  const sourcePathHasProvenance = (
    node: ts.Node,
    scope: Scope,
    resolved: { matched: boolean; value: HookSourceValue },
    seen = new Set<ts.Node>()
  ): boolean => {
    if (sourceValueHasProvenance(resolved.value)) return true;
    const expression = unwrap(node);
    // Authority comes from the producer/path, not from whether this bucket
    // currently contains a nonempty set of state handles.
    if (ts.isIdentifier(expression)) {
      const binding = lookup(scope, expression.text);
      if (binding && 'sourceAuthority' in binding && binding.sourceAuthority === true) return true;
    }
    if (
      ts.isCallExpression(expression) &&
      scope.sourceSummary.isAuthoredProducerCall(expression, expression.getSourceFile())
    )
      return true;
    if (seen.has(node)) return false;
    seen.add(node);
    const owner = ownerOf(node);
    if (!owner) return false;
    const parent = sourceResolve(owner, scope);
    return parent.matched && sourcePathHasProvenance(owner, scope, parent, seen);
  };

  /**
   * The producer call whose member the node reads, and the member it names.
   *
   * A producer hands the same container to every call, so the member a call
   * reads is the member the container holds now.
   */
  function producerMemberRead(node: ts.Node): { owner: ts.CallExpression; key: string } | null {
    const value = unwrap(node);
    if (!ts.isPropertyAccessExpression(value) && !ts.isElementAccessExpression(value)) {
      return null;
    }
    const owner = unwrap(value.expression);
    if (!ts.isCallExpression(owner)) return null;
    const key = memberNameOf(value);
    if (key === null) return null;
    return { owner, key };
  }

  /**
   * The values a producer call's member holds, one per graph the container
   * may hold now.
   *
   * The container may hold several graphs: a write that may not have run left
   * the graph it replaced in place. The member is proven only when every
   * graph proves it, so a graph whose member is unknown makes the member
   * unknown - the newest graph alone is not the answer.
   */
  const producerMemberValues = (node: ts.Node, scope: Scope): HookSourceValue[] | null => {
    const read = producerMemberRead(node);
    if (!read) return null;
    const container = sourceResolve(read.owner, scope);
    if (!container.matched || container.value.kind !== 'object') return null;
    const versions = scope.versions.versions(container.value);
    const graphs = versions.length > 0 ? versions : [container.value];
    // The values are the member's values, one per graph the container may
    // hold, and not the graphs themselves: the member is what the read is
    // about, and the other members of a graph say nothing about it.
    const seen = new Set<HookSourceValue>();
    const values: HookSourceValue[] = [];
    for (const graph of graphs) {
      // A graph that is not an object holds no members, so it contributes no
      // member: the member is unknown, and the unknown alternative is kept.
      const member = graph.kind === 'object' ? graph.members.get(read.key) : undefined;
      if (!member) {
        // A member no graph carries is an alternative of its own, so it is not
        // deduped away.
        const missing: HookSourceValue = { kind: 'unknown', reason: 'unknown member' };
        values.push(missing);
        continue;
      }
      // The same member in two graphs is one member: the graphs differ in
      // other members, not in this one.
      if (seen.has(member)) continue;
      seen.add(member);
      values.push(member);
    }
    return values;
  };

  const sourceResolve = (
    node: ts.Node,
    scope: Scope
  ): { matched: boolean; value: HookSourceValue } => {
    const value = unwrap(node);
    if (ts.isCallExpression(value)) {
      const callee = unwrap(value.expression);
      const calleeIdentifier = ts.isIdentifier(callee) ? callee : null;
      if (calleeIdentifier) {
        const name = calleeIdentifier.text;
        const binding = lookup(scope, name);
        // A local callable alias (for example `const lookup = facts.getState!`)
        // is resolved through the source environment. It is not a producer call,
        // so the producer-binding identity fence must not reject it as a shadow.
        if (
          binding &&
          binding.kind !== 'tokenImport' &&
          binding.kind !== 'defaultImport' &&
          binding.kind !== 'callable'
        ) {
          const bindingNode = binding.bindingNode;
          const sourceIdentity = scope.sourceSummary as HookSourceSummaryContext & {
            isSameSourceBinding?: (
              node: ts.CallExpression,
              source: ts.SourceFile,
              bindingNode: ts.Node
            ) => boolean;
          };
          const sameBinding =
            bindingNode && typeof sourceIdentity.isSameSourceBinding === 'function'
              ? sourceIdentity.isSameSourceBinding(value, node.getSourceFile(), bindingNode)
              : false;
          if (!sameBinding) {
            return {
              matched: true,
              value: { kind: 'unknown', reason: 'lexically shadowed' } as const,
            };
          }
        }
      }
    }
    // A member of a producer call reads the container the producer handed
    // out, and the container holds its current graph: the member a write
    // replaced is the member the call reads. The declared projection is not
    // what the container holds now.
    const members = producerMemberValues(value, scope);
    if (members) {
      // A scalar consumer captures one value, not a live member expression.
      // Only a single proven identity can be captured as a definite value;
      // an unresolved alternative must remain unresolved after later writes.
      if (members.length === 1) return { matched: true, value: members[0] };
      return {
        matched: true,
        value: { kind: 'unknown', reason: 'ambiguous captured member' },
      };
    }
    const resolved = scope.sourceSummary.resolve(node, source, sourceEnvironment(scope));
    // A producer hands the same container to every call, so a copy that wrote
    // to it is visible to a later resolution of that producer: the resolution
    // advances to the version the container holds now.
    if (resolved.value.kind === 'object') {
      return { matched: resolved.matched, value: scope.versions.latest(resolved.value) };
    }
    return resolved;
  };

  const sourceResolveCandidates = (node: ts.Node, scope: Scope) => {
    const primary = sourceResolve(node, scope);
    if (primary.value.kind === 'unknown' && primary.value.reason === 'lexically shadowed') {
      return [primary];
    }
    // A producer call's member is read from every graph the container may
    // hold now, so the conditional alternative is carried too: the member is
    // proven only when every graph proves it.
    const members = producerMemberValues(node, scope);
    if (members) return members.map((value) => ({ matched: true, value }));
    const base = sourceEnvironment(scope);
    const referenced = new Set<string>();
    const collectReferenced = (current: ts.Node): void => {
      if (ts.isIdentifier(current)) {
        const parent = current.parent;
        // A property name is not a lexical lookup. The receiver is the
        // identifier whose source alternatives can affect this expression.
        if (!(ts.isPropertyAccessExpression(parent) && parent.name === current)) {
          referenced.add(current.text);
        }
      }
      ts.forEachChild(current, collectReferenced);
    };
    collectReferenced(node);
    let environments = [base];
    const seen = new Set<string>();
    for (let current: Scope | null = scope; current; current = current.parent) {
      for (const [name, binding] of current.bindings) {
        if (seen.has(name)) continue;
        seen.add(name);
        if (!referenced.has(name)) continue;
        const candidates =
          binding.kind === 'handle' && binding.sourceState
            ? [
                { kind: 'state', state: binding.sourceState } as HookSourceValue,
                ...(binding.sourceAlternatives ?? []).map(
                  (state) => ({ kind: 'state', state }) as HookSourceValue
                ),
              ]
            : sourceBindingValues(binding);
        if (candidates.length <= 1) continue;
        environments = environments.flatMap((environment) =>
          candidates.map((candidate) => {
            const next = new Map(environment);
            next.set(name, candidate);
            return next;
          })
        );
      }
    }
    const resolved = environments.map((environment) =>
      scope.sourceSummary.resolve(node, source, environment)
    );
    // A container may hold several graphs: a write that may not have run left
    // the graph it replaced in place, and a producer hands the same container
    // to every call. Fan out over the versions the container may hold, before
    // a newest-version normalization drops one of them.
    const candidates: { matched: boolean; value: HookSourceValue }[] = [];
    const byValue = new Map<HookSourceValue, { matched: boolean; value: HookSourceValue }>();
    for (const candidate of resolved) {
      if (candidate.value.kind !== 'object') {
        candidates.push(candidate);
        continue;
      }
      for (const version of scope.versions.versions(candidate.value)) {
        // The same container is reached through several names, so the version
        // is counted once.
        const existing = byValue.get(version);
        if (existing) {
          if (candidate.matched) existing.matched = true;
          continue;
        }
        const entry = { matched: candidate.matched, value: version };
        byValue.set(version, entry);
        candidates.push(entry);
      }
    }
    return candidates;
  };

  /**
   * The source-backed containers an expression may denote. A container is an
   * object graph the source summary proved, so it carries the members a
   * handle bag holds.
   */
  const sourceContainerValues = (expression: ts.Node, scope: Scope): HookSourceValue[] => {
    const value = unwrap(expression);
    if (ts.isConditionalExpression(value)) {
      return [
        ...sourceContainerValues(value.whenTrue, scope),
        ...sourceContainerValues(value.whenFalse, scope),
      ];
    }
    if (ts.isObjectLiteralExpression(value) || ts.isArrayLiteralExpression(value)) {
      // A literal holds its containers inside; the literal itself denotes no
      // container. Resolving it would expand the scope for every property,
      // so the nested values are read instead.
      const values: HookSourceValue[] = [];
      const visit = (node: ts.Node): void => {
        if (ts.isPropertyAssignment(node)) {
          visit(node.initializer);
          return;
        }
        if (ts.isShorthandPropertyAssignment(node)) {
          visit(node.name);
          return;
        }
        if (ts.isSpreadAssignment(node)) {
          visit(node.expression);
          return;
        }
        if (ts.isArrayLiteralExpression(node)) {
          for (const element of node.elements) {
            if (!ts.isOmittedExpression(element)) visit(element);
          }
          return;
        }
        if (
          ts.isIdentifier(node) ||
          ts.isPropertyAccessExpression(node) ||
          ts.isElementAccessExpression(node)
        ) {
          values.push(...sourceContainerValues(node, scope));
          return;
        }
        ts.forEachChild(node, visit);
      };
      visit(value);
      return [...new Set(values)];
    }
    if (ts.isIdentifier(value)) {
      // A name answers from its binding: the source-backed graph it holds, or
      // nothing. Resolving the expression instead would expand the scope into
      // one environment per candidate, for every call argument.
      const binding = lookup(scope, value.text) ?? undefined;
      return sourceBindingValues(binding).filter((candidate) => candidate.kind === 'object');
    }
    const owner = ownerOf(value);
    const ownerName = owner ? unwrap(owner) : null;
    if (ownerName && ts.isIdentifier(ownerName)) {
      const binding = lookup(scope, ownerName.text) ?? undefined;
      const candidates = sourceBindingValues(binding);
      // A name that holds no proven source value cannot have a source-backed
      // member either.
      if (candidates.length === 0) return [];
      // A member of a proven object graph is read from that graph, so the
      // scope does not have to be expanded into one environment per candidate.
      const key = memberNameOf(value);
      if (key !== null && candidates.every((candidate) => candidate.kind === 'object')) {
        const members = candidates.map((candidate) =>
          candidate.kind === 'object' ? candidate.members.get(key) : undefined
        );
        return [...new Set(members.filter((member) => member !== undefined))];
      }
    }
    return [
      ...new Set(
        sourceResolveCandidates(value, scope)
          .filter((candidate) => candidate.matched && candidate.value.kind === 'object')
          .map((candidate) => candidate.value)
      ),
    ];
  };

  /**
   * The source-backed containers a call's receiver denotes.
   *
   * A method call may write to the object it is called on, so the receiver is
   * a container the call may mutate even when the call takes no argument at
   * all. A call whose callee is a bare name has no receiver: nothing is
   * handed to it but its arguments.
   */
  const receiverContainerValues = (node: ts.CallExpression, scope: Scope): HookSourceValue[] => {
    const callee = unwrap(node.expression);
    if (!ts.isPropertyAccessExpression(callee) && !ts.isElementAccessExpression(callee)) return [];
    return sourceContainerValues(callee.expression, scope);
  };

  /**
   * The source graph a copy reads from, when the expression denotes exactly
   * one proven graph. A source with an unproved alternative denotes no single
   * graph, so nothing about the copy is proven.
   */
  const sourceCopyValue = (expression: ts.Node, scope: Scope): HookSourceValue | undefined => {
    const resolved = sourceResolveCandidates(expression, scope);
    const matched = resolved.filter((candidate) => candidate.matched);
    if (matched.length !== 1 || matched.length !== resolved.length) return undefined;
    const value = matched[0].value;
    return value.kind === 'object' ? value : undefined;
  };

  const sourceHookLabel = (node: ts.Node, scope?: Scope): string | null => {
    let label: string | null = null;
    const visit = (current: ts.Node): void => {
      if (label) return;
      const value = unwrap(current);
      if (scope && ts.isIdentifier(value)) {
        const binding = lookup(scope, value.text);
        if (binding && 'hook' in binding) {
          label = binding.hook;
          return;
        }
        // An imported hook reached through a local alias still reports the
        // imported producer identity.
        if (binding?.kind === 'tokenImport' && loweredHookStates(binding.imported)) {
          label = binding.imported;
          return;
        }
      }
      if (ts.isCallExpression(value)) {
        const callee = unwrap(value.expression);
        const calleeIdentifier = ts.isIdentifier(callee) ? callee : null;
        if (!calleeIdentifier) {
          ts.forEachChild(current, visit);
          return;
        }
        const name = calleeIdentifier.text;
        const resolved = scope
          ? scope.sourceSummary.resolve(value, source, sourceEnvironment(scope))
          : null;
        if (resolved?.matched && resolved.value.kind !== 'unknown') {
          // A same-name once call can return a child installed by an earlier
          // producer. Its cached value belongs to that winning producer, not
          // to the syntactic caller whose setup was skipped.
          if (resolved.hook) {
            label = resolved.hook;
            return;
          }
          // Report the declared producer binding, so a local alias of an
          // exported hook keeps the identity callers already key on.
          const binding = scope ? lookup(scope, name) : null;
          if (binding && 'hook' in binding) {
            label = binding.hook;
            return;
          }
          // `const parentAlias = asParent` is stored as a token whose
          // initializer is the imported identifier. Follow that one hop so the
          // label is the imported producer rather than the local spelling. The
          // built-in hook table is deliberately not consulted: this call has
          // already resolved to a proven producer, which may be authored and
          // therefore absent from that table. A locally defined producer has no
          // imported initializer and keeps its own name through the fallback.
          const initializer =
            binding?.kind === 'token' && binding.initializer ? unwrap(binding.initializer) : null;
          // The TypeScript node guards are not null-safe, so test the node
          // before calling them.
          const imported =
            scope && initializer && ts.isIdentifier(initializer)
              ? lookup(scope, initializer.text)
              : null;
          label = imported?.kind === 'tokenImport' ? imported.imported : name;
          return;
        }
      }
      ts.forEachChild(current, visit);
    };
    visit(node);
    return label;
  };

  /**
   * A call argument as it was while that argument was evaluated. The call
   * receives those objects, so a later argument that rebinds a name does not
   * move the mutation onto the container the name holds afterwards.
   */
  type CapturedArgument = {
    argument: ts.Expression;
    /** The containers the argument may denote. */
    values: HookSourceValue[];
    /** The single source graph the argument denotes, for a known copy. */
    source?: HookSourceValue;
    /** The producer the argument's value came from, for a known copy. */
    label?: string | null;
  };

  const captureArgument = (
    argument: ts.Expression,
    scope: Scope,
    copySource: boolean
  ): CapturedArgument => {
    const inner = unwrap(argument);
    // An assignment expression stands for the value it assigned.
    const assigned =
      ts.isBinaryExpression(inner) && inner.operatorToken.kind === ts.SyntaxKind.EqualsToken
        ? inner.right
        : inner;
    const values = sourceContainerValues(assigned, scope);
    if (!copySource) return { argument, values };
    return {
      argument,
      values,
      source: sourceCopyValue(assigned, scope),
      label: sourceHookLabel(assigned, scope),
    };
  };

  const sourceUsage = (
    hook: string,
    state: string,
    provenance: HookSourceState
  ): HookStateUsage => {
    const usage: HookStateUsage = { hook, state };
    Object.defineProperty(usage, 'provenance', {
      value: provenance,
      enumerable: false,
      configurable: true,
    });
    return usage;
  };

  // A member write can move a state handle from another producer into a bag.
  // Keep the producer identity with the source state, not only with the bag.
  const sourceStateHooks = new WeakMap<HookSourceState, string>();
  const rememberSourceStateHooks = (node: ts.Node, scope: Scope): void => {
    const hook = sourceHookLabel(node, scope);
    if (!hook) return;
    const candidates = sourceResolveCandidates(node, scope);
    if (candidates.length === 0) return;
    let owner: HookSourceState['owner'] | undefined;
    for (const candidate of candidates) {
      if (!candidate.matched || candidate.value.kind !== 'state') return;
      const next = candidate.value.state.owner;
      if (owner && (owner.file !== next.file || owner.start !== next.start)) return;
      owner = next;
    }
    for (const candidate of candidates) {
      if (candidate.value.kind === 'state') sourceStateHooks.set(candidate.value.state, hook);
    }
  };

  const exposedKeys = new Map<ts.Node, Map<string, string | null>>();
  type AliasEdge = {
    owner: ts.Node;
    name: string;
    target: string;
    at: number;
    conditional: boolean;
    opaque?: boolean;
    chain: ts.Node[];
    node: ts.Node;
  };
  const aliasEdges: AliasEdge[] = [];
  const declaredIn = new Map<ts.Node, Set<string>>();

  /** A statically known string, following one hop through a local constant. */
  const constantStringValue = (node: ts.Node, scope: Scope): string | null => {
    const value = unwrap(node);
    if (ts.isStringLiteralLike(value) || ts.isNoSubstitutionTemplateLiteral(value)) {
      return value.text;
    }
    if (ts.isIdentifier(value)) {
      const binding = lookup(scope, value.text);
      if (binding?.kind === 'token') return constantStringValue(binding.initializer, scope);
    }
    return null;
  };
  // Members carry positions for the same reason aliases do: a write through the
  // container retargets the member from there on.
  type MemberEdge = { target: string | null; at: number; conditional: boolean };
  const objectMembers = new Map<ts.Node, Map<string, Map<string, MemberEdge[]>>>();

  /**
   * Every object literal an initializer may yield. A conditional selects one at
   * runtime, so both are recorded for the same reason `aliasTargets` fans out.
   */
  const objectLiteralTargets = (node: ts.Node): ts.ObjectLiteralExpression[] => {
    const value = unwrap(node);
    if (ts.isObjectLiteralExpression(value)) return [value];
    if (ts.isConditionalExpression(value)) {
      return [...objectLiteralTargets(value.whenTrue), ...objectLiteralTargets(value.whenFalse)];
    }
    return [];
  };

  /** Every member an object literal names, at the position it was written. */
  const recordObjectLiteral = (
    owner: ts.Node,
    base: string,
    literal: ts.ObjectLiteralExpression,
    at: number,
    conditional: boolean
  ): void => {
    for (const property of literal.properties) {
      if (ts.isShorthandPropertyAssignment(property)) {
        recordMember(owner, base, property.name.text, property.name.text, at, conditional);
      } else if (
        ts.isPropertyAssignment(property) &&
        (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name))
      ) {
        for (const target of aliasTargets(property.initializer)) {
          recordMember(owner, base, property.name.text, target, at, conditional);
        }
      }
    }
  };

  /**
   * `const alias = controls` names one object, so a member written through
   * either name lands on the same table. A base that may be two different
   * objects is left as itself: there is no single table to move.
   */
  const containerRoots = (
    name: string,
    chain: ts.Node[],
    at: number,
    seen = new Set<string>()
  ): string[] => {
    if (seen.has(name)) return [name];
    for (const owner of chain) {
      const candidates = aliasEdges.filter((edge) => edge.owner === owner && edge.name === name);
      if (candidates.length === 0) continue;
      const visible = visibleEdges(candidates, at);
      if (visible.length === 0) return [name];
      const next = new Set([...seen, name]);
      // A base that may be either of two objects writes to both tables, and
      // reads consult both; recording under the alias would reach neither. If
      // every edge out of the name may not have been taken, the name's own
      // table stays a candidate — a literal branch was recorded under it.
      const roots = visible.flatMap((edge) =>
        containerRoots(edge.target, edge.chain ?? chain, edge.at, next)
      );
      return [...new Set(visible.every((edge) => edge.conditional) ? [name, ...roots] : roots)];
    }
    return [name];
  };

  const recordMember = (
    owner: ts.Node,
    base: string,
    key: string,
    target: string | null,
    at: number,
    conditional: boolean
  ): void => {
    const scoped = objectMembers.get(owner) ?? new Map<string, Map<string, MemberEdge[]>>();
    const members = scoped.get(base) ?? new Map<string, MemberEdge[]>();
    members.set(key, [...(members.get(key) ?? []), { target, at, conditional }]);
    scoped.set(base, members);
    objectMembers.set(owner, scoped);
  };

  /** Every handle an initializer may name; a conditional contributes both. */
  const aliasTargets = (node: ts.Node): string[] => {
    const value = unwrap(node);
    if (ts.isIdentifier(value)) return [value.text];
    if (ts.isConditionalExpression(value)) {
      return [...aliasTargets(value.whenTrue), ...aliasTargets(value.whenFalse)];
    }
    return [];
  };

  /** The identifier member `key` of an initializer names, if it names one. */
  const memberTargetNames = (
    initializer: ts.Node,
    key: string,
    chain: ts.Node[],
    at: number
  ): { targets: Array<{ target: string; at: number }>; opaque: boolean } => {
    const value = unwrap(initializer);
    if (ts.isObjectLiteralExpression(value)) {
      for (const property of value.properties) {
        if (ts.isShorthandPropertyAssignment(property) && property.name.text === key) {
          return { targets: [{ target: key, at }], opaque: false };
        }
        if (
          ts.isPropertyAssignment(property) &&
          (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) &&
          property.name.text === key
        ) {
          const assigned = unwrap(property.initializer);
          return ts.isIdentifier(assigned)
            ? { targets: [{ target: assigned.text, at }], opaque: false }
            : { targets: [], opaque: false };
        }
      }
      return { targets: [], opaque: false };
    }
    if (ts.isArrayLiteralExpression(value)) {
      const index = Number(key);
      const element =
        Number.isInteger(index) && index >= 0 && String(index) === key
          ? value.elements[index]
          : undefined;
      const target = element && !ts.isOmittedExpression(element) ? unwrap(element) : null;
      return target && ts.isIdentifier(target)
        ? { targets: [{ target: target.text, at }], opaque: false }
        : { targets: [], opaque: false };
    }
    if (!ts.isIdentifier(value)) return { targets: [], opaque: false };
    const [container] = containerRoots(value.text, chain, at);
    for (const scope of chain) {
      const members = objectMembers.get(scope)?.get(container);
      if (!members) continue;
      const edges = members.get(key);
      if (!edges) return { targets: [], opaque: false };
      const visible = visibleEdges(edges, at);
      const opaque = visible.some((edge) => edge.target === null);
      return {
        targets: visible.flatMap((edge) =>
          edge.target === null ? [] : [{ target: edge.target, at: edge.at }]
        ),
        opaque,
      };
    }
    return { targets: [], opaque: false };
  };

  /**
   * The handle each name in a binding pattern ends up on. A pattern aliases the
   * same state object a plain `const publicFlag = flag` does.
   */
  const patternTargets = (
    name: ts.BindingName,
    initializer: ts.Node,
    chain: ts.Node[],
    at: number
  ): Array<{ name: string; target: string; at: number; opaque?: boolean }> => {
    const out: Array<{ name: string; target: string; at: number; opaque?: boolean }> = [];
    if (ts.isObjectBindingPattern(name)) {
      for (const element of name.elements) {
        if (!ts.isIdentifier(element.name) || element.dotDotDotToken) continue;
        const property = element.propertyName ?? element.name;
        const key =
          ts.isIdentifier(property) || ts.isStringLiteralLike(property) ? property.text : null;
        if (!key) continue;
        const resolved = memberTargetNames(initializer, key, chain, at);
        if (resolved.targets.length > 0) {
          for (const target of resolved.targets) {
            out.push({
              name: element.name.text,
              ...target,
              ...(resolved.opaque ? { opaque: true } : {}),
            });
          }
        } else if (resolved.opaque) {
          // Keep an opaque alias edge even when no concrete handle survived.
          out.push({ name: element.name.text, target: element.name.text, at, opaque: true });
        }
      }
      return out;
    }
    if (!ts.isArrayBindingPattern(name)) return out;
    name.elements.forEach((element, index) => {
      if (ts.isOmittedExpression(element)) return;
      if (!ts.isIdentifier(element.name) || element.dotDotDotToken) return;
      const resolved = memberTargetNames(initializer, String(index), chain, at);
      if (resolved.targets.length > 0) {
        for (const target of resolved.targets) {
          out.push({
            name: element.name.text,
            ...target,
            ...(resolved.opaque ? { opaque: true } : {}),
          });
        }
      } else if (resolved.opaque) {
        out.push({ name: element.name.text, target: element.name.text, at, opaque: true });
      }
    });
    return out;
  };

  /**
   * The handles an expose argument may name, each with the position its own
   * edge was written at: a member captured whatever its target named then.
   */
  const resolveHandleNames = (
    node: ts.Node,
    chain: ts.Node[],
    at: number
  ): Array<{ name: string; at: number; opaque?: boolean }> => {
    const value = unwrap(node);
    if (ts.isIdentifier(value)) return [{ name: value.text, at }];
    const owner = ownerOf(value);
    if (!owner) return [];
    const base = unwrap(owner);
    if (!ts.isIdentifier(base)) return [];
    const out: Array<{ name: string; at: number }> = [];
    for (const container of containerRoots(base.text, chain, at)) {
      for (const scope of chain) {
        const members = objectMembers.get(scope)?.get(container);
        if (!members) continue;
        for (const [key, edges] of members) {
          if (!memberNamed(value, key)) continue;
          const visible = visibleEdges(edges, at);
          // Keep possible old/RHS handles, but carry the opaque write so a
          // local exposure cannot be mistaken for an internal state.
          const opaque = visible.some((edge) => edge.target === null);
          for (const edge of visible) {
            if (edge.target !== null)
              out.push({ name: edge.target, at: edge.at, ...(opaque ? { opaque: true } : {}) });
          }
        }
        break;
      }
    }
    return out;
  };
  const rawExposures: Array<{
    handles: Array<{ name: string; at: number; opaque?: boolean }>;
    key: ts.Expression;
    chain: ts.Node[];
  }> = [];

  /** A statically-known property key; dynamic indexes must invalidate all candidates. */
  const memberNameOf = (node: ts.Node): string | null => {
    const target = unwrap(node);
    if (ts.isPropertyAccessExpression(target)) return target.name.text;
    if (ts.isElementAccessExpression(target)) {
      const argument = target.argumentExpression;
      return argument && (ts.isStringLiteralLike(argument) || ts.isNumericLiteral(argument))
        ? argument.text
        : null;
    }
    return null;
  };

  const memberNamed = (node: ts.Node, name: string): boolean => memberNameOf(node) === name;

  const ownerOf = (node: ts.Node): ts.Node | null => {
    const target = unwrap(node);
    return ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)
      ? target.expression
      : null;
  };

  const collectExposedKeys = (node: ts.Node, chain: ts.Node[]): void => {
    const nextChain = introducesScope(node) ? [node, ...chain] : chain;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      // `var` binds to the enclosing function however deeply it is nested.
      const isVar =
        ts.isVariableDeclarationList(node.parent) &&
        !(node.parent.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const));
      const enclosingFunction = isVar
        ? ts.findAncestor(node, (candidate): candidate is ts.FunctionLikeDeclaration =>
            ts.isFunctionLike(candidate)
          )
        : undefined;
      const enclosingBody = enclosingFunction?.body;
      const owner =
        (enclosingBody && nextChain.includes(enclosingBody) ? enclosingBody : nextChain[0]) ??
        source;
      const names = declaredIn.get(owner) ?? new Set<string>();
      names.add(node.name.text);
      declaredIn.set(owner, names);
      if (node.initializer) {
        const conditional = isConditionallyReached(node);
        const literals = objectLiteralTargets(node.initializer);
        for (const literal of literals) {
          recordObjectLiteral(
            owner,
            node.name.text,
            literal,
            node.getStart(),
            conditional || literals.length > 1
          );
        }
        for (const target of aliasTargets(node.initializer)) {
          aliasEdges.push({
            owner,
            name: node.name.text,
            target,
            at: node.getStart(),
            conditional,
            chain: [...nextChain, source],
            node,
          });
        }
      }
    }
    if (
      ts.isVariableDeclaration(node) &&
      !ts.isIdentifier(node.name) &&
      node.initializer &&
      nextChain.length > 0
    ) {
      const patternOwner = nextChain[0] ?? source;
      const at = node.getStart();
      const conditional = isConditionallyReached(node);
      for (const alias of patternTargets(node.name, node.initializer, nextChain, at)) {
        const names = declaredIn.get(patternOwner) ?? new Set<string>();
        names.add(alias.name);
        declaredIn.set(patternOwner, names);
        aliasEdges.push({
          owner: patternOwner,
          name: alias.name,
          target: alias.target,
          at: alias.at,
          conditional,
          ...(alias.opaque ? { opaque: true } : {}),
          chain: [...nextChain, source],
          node,
        });
      }
    }
    // Writing through the container moves the handle the same way, so the
    // member the exposure reads is the one assigned last before it.
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left))
    ) {
      const operator = node.operatorToken.kind;
      const logicalAssignment =
        operator === ts.SyntaxKind.AmpersandAmpersandEqualsToken ||
        operator === ts.SyntaxKind.BarBarEqualsToken ||
        operator === ts.SyntaxKind.QuestionQuestionEqualsToken;
      const base = unwrap(ownerOf(node.left) ?? node.left);
      const member = memberNameOf(node.left);
      if (ts.isIdentifier(base)) {
        const chain = [...nextChain, source];
        // Non-plain writes complete after their RHS, so later source positions
        // must not see a nested RHS member write as the final value.
        const at = operator === ts.SyntaxKind.EqualsToken ? node.getStart() : node.getEnd();
        const containers = containerRoots(base.text, chain, node.getStart());
        const declaring =
          chain.find((candidate) => declaredIn.get(candidate)?.has(containers[0])) ?? null;
        const conditional =
          isConditionallyReached(node) ||
          logicalAssignment ||
          isDeferredWrite(node, enclosingFunction(declaring)) ||
          containers.length > 1 ||
          member === null;
        for (const container of containers) {
          const memberOwnerScope =
            chain.find((candidate) => declaredIn.get(candidate)?.has(container)) ??
            nextChain[0] ??
            source;
          const keys =
            member === null
              ? [...(objectMembers.get(memberOwnerScope)?.get(container)?.keys() ?? [])]
              : [member];
          for (const key of keys) {
            if (operator === ts.SyntaxKind.EqualsToken) {
              for (const target of aliasTargets(node.right)) {
                recordMember(memberOwnerScope, container, key, target, at, conditional);
              }
            } else {
              // This prepass runs before readState exists. Mark a non-plain
              // write opaque rather than attributing the RHS to the member.
              recordMember(memberOwnerScope, container, key, null, at, conditional);
              if (logicalAssignment) {
                for (const target of aliasTargets(node.right)) {
                  recordMember(memberOwnerScope, container, key, target, at, conditional);
                }
              }
            }
          }
        }
      }
    }
    // A plain reassignment moves the handle just as a declaration does.
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      // An assignment does not declare, so it belongs to whichever scope owns
      // the binding; otherwise a reassignment inside a nested block would be
      // invisible to an exposure written outside it.
      const left = node.left.text;
      const assignOwner =
        [...nextChain, source].find((candidate) => declaredIn.get(candidate)?.has(left)) ??
        nextChain[0] ??
        source;
      const conditional = isConditionallyReached(node);
      const replacements = objectLiteralTargets(node.right);
      // A conditional may mix a literal with a name; when it can yield more
      // than one value neither outcome is certain.
      // Every branch counts, not only the ones this recognizes.
      const valueCount = conditionalLeafCount(node.right);
      for (const replacement of replacements) {
        recordObjectLiteral(
          assignOwner,
          left,
          replacement,
          node.getStart(),
          // Either literal may be the one the runtime took, and the name may
          // still hold the container it replaced.
          conditional || valueCount > 1
        );
      }
      for (const target of aliasTargets(node.right)) {
        aliasEdges.push({
          owner: assignOwner,
          name: left,
          target,
          at: node.getStart(),
          conditional: conditional || valueCount > 1,
          chain: [...nextChain, source],
          node,
        });
      }
    }
    if (ts.isCallExpression(node)) {
      const callee = unwrap(node.expression);
      const owner = ownerOf(callee);
      const exposesState = memberNamed(callee, 'state') && owner && memberNamed(owner, 'expose');
      // `def.expose('ready', state)` wraps a state handle too.
      const exposesDirectly = memberNamed(callee, 'expose');
      if (exposesState || exposesDirectly) {
        const [nameArg, handleArg] = node.arguments;
        const handles = handleArg
          ? resolveHandleNames(handleArg, [...nextChain, source], node.getStart())
          : [];
        if (nameArg && handles.length > 0) {
          rawExposures.push({ handles, key: nameArg, chain: [...nextChain, source] });
        }
      }
    }
    ts.forEachChild(node, (child) => collectExposedKeys(child, nextChain));
  };
  collectExposedKeys(source, []);

  // Fans out rather than picking one edge, so a conditional alias gives every
  // candidate handle its variant.
  const aliasRoots = (
    name: string,
    chain: ts.Node[],
    at: number,
    seen = new Set<string>()
  ): Array<{ name: string; chain: ts.Node[]; opaque?: boolean }> => {
    if (seen.has(name)) return [{ name, chain }];
    // A write in another function is unordered against this read, so it adds a
    // candidate rather than replacing one.
    const readFunction = enclosingFunction(chain[0] ?? null);
    const ordered = (edge: AliasEdge): AliasEdge =>
      edge.conditional || !edge.node || !isDeferredWrite(edge.node, readFunction)
        ? edge
        : { ...edge, conditional: true };
    let found: AliasEdge[] = [];
    for (const owner of chain) {
      const candidates = aliasEdges
        .filter((edge) => edge.owner === owner && edge.name === name)
        .map(ordered);
      if (candidates.length === 0) continue;
      found = visibleEdges(candidates, at);
      break;
    }
    if (found.length === 0) return [{ name, chain }];
    const next = new Set([...seen, name]);
    // An alias captured its target where the alias was written, so a name the
    // exposure site shadows must not answer for it.
    return found.flatMap((edge) =>
      aliasRoots(edge.target, edge.chain ?? chain, edge.at, next).map((entry) => ({
        ...entry,
        ...(edge.opaque ? { opaque: true } : {}),
      }))
    );
  };

  // An exposure names a binding, and a binding lives in one scope. Writing it
  // across the whole chain would let a sibling prototype reusing the same local
  // name inherit an exposure its own runtime never registers.
  const declaringScope = (name: string, chain: ts.Node[]): ts.Node | undefined =>
    chain.find((candidate) => declaredIn.get(candidate)?.has(name)) ?? chain[chain.length - 1];

  for (const { handles, key, chain } of rawExposures) {
    // A key the scanner cannot read still means the state is exposed, and the
    // attribute comes from the declared name anyway.
    const text = ts.isStringLiteralLike(key) ? key.text : '';
    const named = handles.flatMap((handle) => [
      { name: handle.name, chain, opaque: handle.opaque },
      ...aliasRoots(handle.name, chain, handle.at).map((entry) => ({
        ...entry,
        opaque: Boolean(handle.opaque || entry.opaque),
      })),
    ]);
    const seen = new Set<string>();
    for (const entry of named) {
      const owner = declaringScope(entry.name, entry.chain);
      if (!owner) continue;
      const identity = `${entry.name}\u0000${owner.pos}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      const scoped = exposedKeys.get(owner) ?? new Map<string, string | null>();
      if (entry.opaque) scoped.set(entry.name, null);
      else if (!scoped.has(entry.name)) scoped.set(entry.name, text);
      exposedKeys.set(owner, scoped);
    }
  }

  /** The exposure visible from a scope chain, nearest scope first. */
  const exposureFor = (name: string, scope: Scope): string | null | undefined => {
    for (let current: Scope | null = scope; current; current = current.parent) {
      if (!current.node) continue;
      const scoped = exposedKeys.get(current.node);
      const found = scoped?.get(name);
      if (found !== undefined) return found;
    }
    return undefined;
  };

  const hookOfCall = (node: ts.Node, scope?: Scope): string | null => {
    const call = unwrap(node);
    if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) return null;
    const name = call.expression.text;
    const binding = scope ? lookup(scope, name) : null;
    // A bound name that is not a named import cannot be answered for by the
    // built-in hook table. A default import in particular names the module's
    // default export, which need not be a hook at all.
    if (binding && binding.kind !== 'tokenImport') return null;
    if (loweredHookStates(name)) return name;
    // A local alias of an imported hook is the same producer, so report the
    // imported name the extractor keys on rather than the local spelling.
    if (binding?.kind === 'tokenImport' && loweredHookStates(binding.imported)) {
      return binding.imported;
    }
    return null;
  };

  /** Resolves an expression to the hook whose state-handle bag it denotes. */
  const bagHook = (node: ts.Node, scope: Scope): string | null => {
    const expression = unwrap(node);
    if (ts.isIdentifier(expression)) {
      const binding = lookup(scope, expression.text);
      return binding?.kind === 'handleBag' ? binding.hook : null;
    }
    if (!ts.isPropertyAccessExpression(expression)) return null;
    if (expression.name.text !== 'stateHandles') return null;
    const owner = unwrap(expression.expression);
    if (ts.isIdentifier(owner)) {
      const binding = lookup(scope, owner.text);
      if (binding?.kind !== 'hookResult') return null;
      if (binding.sourceValue?.kind === 'result' && binding.sourceValue.stateHandles.size === 0)
        return null;
      return binding.hook;
    }
    return hookOfCall(owner, scope);
  };

  const declare = (scope: Scope, name: string, binding: Binding): void => {
    scope.bindings.set(name, binding);
  };

  const sourceBindingValues = (binding: Binding | undefined): HookSourceValue[] => {
    if (!binding || !('sourceValue' in binding) || !binding.sourceValue) return [];
    return [binding.sourceValue, ...(binding.sourceAlternatives ?? [])];
  };

  const sourceBindingStates = (binding: Binding | undefined): HookSourceState[] => {
    if (!binding || binding.kind !== 'handle' || !binding.sourceState) return [];
    return [binding.sourceState, ...(binding.sourceAlternatives ?? [])];
  };

  const sourceBindingHooks = (binding: Binding | undefined): string[] => {
    if (!binding || !('hook' in binding)) return [];
    return [binding.hook, ...(binding.sourceAlternativeHooks ?? [])];
  };

  const containsSourceReference = (
    value: HookSourceValue,
    target: HookSourceValue,
    seen = new Set<HookSourceValue>()
  ): boolean => {
    if (value === target) return true;
    if (seen.has(value)) return false;
    seen.add(value);
    if (value.kind === 'object') {
      for (const member of value.members.values()) {
        if (containsSourceReference(member, target, seen)) return true;
      }
    } else if (value.kind === 'result') {
      if (value.handle && containsSourceReference(value.handle, target, seen)) return true;
      for (const child of value.children.values()) {
        if (containsSourceReference(child, target, seen)) return true;
      }
    } else if (value.kind === 'callable') {
      return containsSourceReference(value.result, target, seen);
    }
    return false;
  };

  const sourceOwnerScope = (scope: Scope, target: HookSourceValue): Scope | null => {
    let owning: Scope | null = null;
    for (let owner: Scope | null = scope; owner; owner = owner.parent) {
      for (const binding of owner.bindings.values()) {
        if (sourceBindingValues(binding).some((value) => containsSourceReference(value, target))) {
          owning = owner;
          break;
        }
      }
    }
    return owning;
  };

  const sourceBinding = (
    binding: Binding | undefined
  ): binding is Extract<Binding, { kind: 'handle' | 'handleBag' | 'hookResult' | 'callable' }> =>
    binding?.kind === 'handle' ||
    binding?.kind === 'handleBag' ||
    binding?.kind === 'hookResult' ||
    binding?.kind === 'callable';

  /**
   * The newest version of a captured graph. A member write replaces the graph
   * a container holds without replacing the container, so a mutation that was
   * captured before that write lands on the version the container holds now.
   */
  const latestSourceVersion = (scope: Scope, value: HookSourceValue): HookSourceValue =>
    scope.versions.latest(value);

  /**
   * Copy-on-write a source summary without mutating the cached producer graph.
   *
   * Source values are immutable summaries, but aliases can share any object
   * inside the graph (including through a result handle or child). A visited
   * set is not sufficient here: when the same ancestor is reached through a
   * second path it would return the original node and leave that path stale.
   * Memoizing the rewritten node preserves the DAG sharing while making every
   * containing path observe the replacement.
   */
  const replaceSourceGraph = (
    value: HookSourceValue,
    target: HookSourceValue,
    replacement: HookSourceValue,
    memo: Map<HookSourceValue, HookSourceValue>,
    replacements?: ReadonlyMap<HookSourceValue, HookSourceValue>
  ): HookSourceValue => {
    const direct = replacements?.get(value) ?? (value === target ? replacement : undefined);
    if (direct !== undefined) return direct;
    const cached = memo.get(value);
    if (cached) return cached;

    if (value.kind === 'state' || value.kind === 'unknown') {
      memo.set(value, value);
      return value;
    }

    if (value.kind === 'object') {
      const members = new Map<string, HookSourceValue>();
      // Install the provisional clone before walking children so a cyclic
      // authored projection cannot recurse forever. If no child changes, the
      // memo entry is replaced with the original below.
      const clone: Extract<HookSourceValue, { kind: 'object' }> = { ...value, members };
      memo.set(value, clone);
      let changed = false;
      for (const [key, member] of value.members) {
        const next = replaceSourceGraph(member, target, replacement, memo, replacements);
        members.set(key, next);
        changed ||= next !== member;
      }
      if (!changed) {
        memo.set(value, value);
        return value;
      }
      return clone;
    }

    if (value.kind === 'result') {
      const children = new Map<string, HookSourceValue>();
      const clone: Extract<HookSourceValue, { kind: 'result' }> = { ...value, children };
      memo.set(value, clone);
      let changed = false;
      if (value.handle) {
        const handle = replaceSourceGraph(value.handle, target, replacement, memo, replacements);
        clone.handle = handle;
        changed ||= handle !== value.handle;
      }
      for (const [key, child] of value.children) {
        const next = replaceSourceGraph(child, target, replacement, memo, replacements);
        children.set(key, next);
        changed ||= next !== child;
      }
      if (!changed) {
        memo.set(value, value);
        return value;
      }
      return clone;
    }

    // The admitted callable is an immutable capture, not a containment edge
    // into the container it reads: the runtime freezes the projected
    // state-handle map and closes the accessor over that map, and the summary
    // reads only the state handles it captured. A write to the container
    // therefore does not change the callable, and the callable keeps its
    // identity when the container is written.
    memo.set(value, value);
    return value;
  };

  /** Publish one atomic object-replacement batch to all source-backed bindings. */
  const publishSourceGraph = (
    scope: Scope,
    target: HookSourceValue,
    replacement: HookSourceValue,
    uncertain: boolean,
    replacements?: ReadonlyMap<HookSourceValue, HookSourceValue>
  ): void => {
    // One memo spans all bindings and candidates, so shared ancestors remain
    // shared instead of being cloned independently for each visible alias.
    const memo = new Map<HookSourceValue, HookSourceValue>();
    // Pass 1: the lineage. The memo holds the graphs the write rewrote, and
    // the tracker learns them before the names are written, because the
    // second pass reads the graphs the container may hold from the tracker.
    const rewritten: {
      owner: Scope;
      name: string;
      binding: Binding;
      sourceValue: HookSourceValue;
    }[] = [];
    for (let owner: Scope | null = scope; owner; owner = owner.parent) {
      for (const [name, binding] of owner.bindings) {
        if (!sourceBinding(binding) || !('sourceValue' in binding) || !binding.sourceValue)
          continue;
        // The name holds the graph it holds now and the graphs it may hold
        // instead. The same graph is not held twice.
        const candidates = [
          ...new Set([binding.sourceValue, ...(binding.sourceAlternatives ?? [])]),
        ];
        const replaced = candidates.map((candidate) =>
          replaceSourceGraph(candidate, target, replacement, memo, replacements)
        );
        const changed = replaced.some((candidate, index) => candidate !== candidates[index]);
        if (!changed) continue;
        // The graph the name holds now is captured here, where the guard above
        // has already established that the name holds one.
        rewritten.push({ owner, name, binding, sourceValue: binding.sourceValue });
      }
    }
    for (const [before, after] of memo) {
      if (before === after) continue;
      // A write to a nested object rewrites the ancestors that hold it, so the
      // graph a container holds is a newer version of the graph it replaced.
      // Recording the ancestors keeps a later resolution of one of them - a
      // producer call that hands the same container out again - from reaching
      // the graph that was written to.
      scope.versions.record(before, after, uncertain);
    }
    if (replacements) {
      for (const [before, after] of replacements) scope.versions.record(before, after, uncertain);
    } else {
      scope.versions.record(target, replacement, uncertain);
    }
    // Pass 2: the names. A name holds the graph the write produced and the
    // graphs it may hold instead. The list is the container's graphs, not the
    // history of the graphs the container passed through: keeping the history
    // would let the environment fan-out grow with every write, even though
    // the tracker holds one graph per distinct content.
    for (const { owner, name, binding, sourceValue } of rewritten) {
      const held = new Set<HookSourceValue>();
      for (const candidate of sourceBindingValues(binding)) {
        for (const version of scope.versions.versions(candidate)) held.add(version);
      }
      if (held.size === 0) continue;
      const latest = scope.versions.latest(sourceValue);
      const next = [latest, ...[...held].filter((version) => version !== latest)];
      declare(owner, name, {
        ...binding,
        sourceValue: next[0],
        sourceAlternatives: next.slice(1),
      } as Binding);
    }
  };

  /**
   * A write the source may skip leaves the name on either handle, and the
   * runtime lowers whichever it holds, so a conditional reassignment keeps the
   * binding it replaces as an alternative instead of discarding it.
   */
  const definitelyReachedLogicalAssignments = new WeakSet<ts.Node>();

  const declareConditionally = (
    scope: Scope,
    name: string,
    node: ts.Node,
    lookupScope: Scope,
    initializer: ts.Expression
  ): void => {
    const previous = scope.bindings.get(name);
    declareValue(node as ts.BindingName, initializer, scope, lookupScope);
    const next = scope.bindings.get(name);
    const uncertain =
      isConditionallyReached(initializer.parent, definitelyReachedLogicalAssignments) ||
      isDeferredWrite(initializer, enclosingFunction(scope.node));
    if (!uncertain || !previous || !next) return;
    if (sourceBinding(next) && sourceBinding(previous)) {
      const sourceAuthority = next.sourceAuthority === true || previous.sourceAuthority === true;
      if (sourceAuthority && next.sourceAuthority !== true) {
        declare(scope, name, { ...next, sourceAuthority: true } as Binding);
      }
      if (next.kind === 'handle' && previous.kind === 'handle') {
        const states = [
          ...new Set([...sourceBindingStates(next), ...sourceBindingStates(previous)]),
        ];
        const hooks = [...new Set([...sourceBindingHooks(next), ...sourceBindingHooks(previous)])];
        if (states.length > 1)
          declare(scope, name, {
            ...next,
            sourceState: states[0],
            sourceAlternatives: states.slice(1),
            sourceAlternativeHooks: hooks.slice(1),
            sourceAuthority,
          });
      } else {
        const values = [
          ...new Set([...sourceBindingValues(next), ...sourceBindingValues(previous)]),
        ];
        const hooks = [...new Set([...sourceBindingHooks(next), ...sourceBindingHooks(previous)])];
        if (values.length > 1)
          declare(scope, name, {
            ...next,
            sourceValue: values[0],
            sourceAlternatives: values.slice(1),
            sourceAlternativeHooks: hooks.slice(1),
            sourceAuthority,
          } as Binding);
      }
      return;
    }
    if (next.kind !== 'localState' || previous.kind !== 'localState') return;
    // Alternatives are flat: a candidate carries no candidates of its own.
    const bare = (binding: LocalStateBinding): LocalStateBinding => ({
      kind: 'localState',
      declaredAs: binding.declaredAs,
      exposedAs: binding.exposedAs,
    });
    const kept = [bare(previous), ...(previous.alternatives ?? [])].filter(
      (candidate) => candidate.declaredAs !== next.declaredAs
    );
    if (kept.length > 0) {
      declare(scope, name, { ...next, alternatives: [...(next.alternatives ?? []), ...kept] });
    }
  };

  /**
   * Binds `name` to whatever `initializer` names. A declaration and a plain
   * reassignment reach the same runtime handle, so both come through here; the
   * assignment declares in the scope that already owns the name while still
   * resolving its right-hand side where it was written.
   */
  const declareValue = (
    name: ts.BindingName,
    initializer: ts.Expression,
    scope: Scope,
    lookupScope: Scope = scope
  ): void => {
    // `sourceBinding` at module scope is the kind predicate; this local used to
    // shadow it and then get called as one.
    const resolved = sourceResolve(initializer, lookupScope);
    const sourceHook = sourceHookLabel(initializer, lookupScope);
    const sourceNode = unwrap(initializer);
    // Summary evaluation recognizes every ordinary object/array literal. Keep
    // those in the established token/container path unless this is a proven
    // non-literal source expression, so local maps are not replaced by a blank
    // source bag.
    const sourceCanIntercept =
      resolved.matched &&
      sourcePathHasProvenance(initializer, lookupScope, resolved) &&
      !ts.isObjectLiteralExpression(sourceNode) &&
      !ts.isArrayLiteralExpression(sourceNode) &&
      !ts.isConditionalExpression(sourceNode);
    if (sourceCanIntercept) {
      const sourceValue = resolved.value;
      if (ts.isObjectBindingPattern(name)) {
        if (sourceValue.kind !== 'object') {
          for (const element of name.elements) {
            if (ts.isIdentifier(element.name))
              declare(scope, element.name.text, { kind: 'opaque', sourceAuthority: true });
          }
          return;
        }
        for (const element of name.elements) {
          if (!ts.isIdentifier(element.name) || element.dotDotDotToken) continue;
          const property = element.propertyName ?? element.name;
          const key =
            ts.isIdentifier(property) || ts.isStringLiteralLike(property) ? property.text : null;
          const held = key ? sourceValue.members.get(key) : undefined;
          if (held?.kind === 'state') {
            declare(scope, element.name.text, {
              kind: 'handle',
              hook: sourceHook ?? '<source-hook>',
              state: held.state.declaredName,
              sourceState: held.state,
              sourceAuthority: true,
            });
          } else {
            declare(scope, element.name.text, { kind: 'opaque', sourceAuthority: true });
          }
        }
        return;
      }
      if (ts.isArrayBindingPattern(name)) {
        if (sourceValue.kind !== 'object') {
          for (const element of name.elements) {
            if (ts.isBindingElement(element) && ts.isIdentifier(element.name))
              declare(scope, element.name.text, { kind: 'opaque', sourceAuthority: true });
          }
          return;
        }
        name.elements.forEach((element, index) => {
          if (!ts.isBindingElement(element)) return;
          if (!ts.isIdentifier(element.name) || element.dotDotDotToken) return;
          const held = sourceValue.members.get(String(index));
          if (held?.kind === 'state')
            declare(scope, element.name.text, {
              kind: 'handle',
              hook: sourceHook ?? '<source-hook>',
              state: held.state.declaredName,
              sourceState: held.state,
              sourceAuthority: true,
            });
          else declare(scope, element.name.text, { kind: 'opaque', sourceAuthority: true });
        });
        return;
      }
      if (ts.isIdentifier(name)) {
        if (sourceValue.kind === 'state') {
          declare(scope, name.text, {
            kind: 'handle',
            hook: sourceHook ?? '<source-hook>',
            state: sourceValue.state.declaredName,
            sourceState: sourceValue.state,
            sourceAuthority: true,
          });
        } else if (sourceValue.kind === 'unknown') {
          declare(scope, name.text, { kind: 'opaque', sourceAuthority: true });
        } else if (
          sourceValue.kind === 'object' ||
          sourceValue.kind === 'result' ||
          sourceValue.kind === 'callable'
        ) {
          declare(scope, name.text, {
            kind:
              sourceValue.kind === 'object'
                ? 'handleBag'
                : sourceValue.kind === 'result'
                  ? 'hookResult'
                  : 'callable',
            hook: sourceHook ?? '<source-hook>',
            sourceValue,
            sourceAuthority: true,
          });
        }
        return;
      }
    }

    const bag = bagHook(initializer, lookupScope);

    if (bag) {
      if (ts.isObjectBindingPattern(name)) {
        for (const element of name.elements) {
          const property = element.propertyName ?? element.name;
          if (ts.isIdentifier(element.name) && ts.isIdentifier(property)) {
            declare(scope, element.name.text, {
              kind: 'handle',
              hook: bag,
              state: property.text,
            });
          }
        }
      } else if (ts.isIdentifier(name)) {
        declare(scope, name.text, { kind: 'handleBag', hook: bag });
      }
      return;
    }

    // `const current = enabled ? first : second` — the runtime keeps one branch
    // and it carries its own declared name, so both candidates are retained.
    const chosen = unwrap(initializer);
    if (
      ts.isConditionalExpression(chosen) &&
      !ts.isIdentifier(name) &&
      (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name))
    ) {
      const branches = [chosen.whenTrue, chosen.whenFalse].map((branch) =>
        sourceResolve(branch, lookupScope)
      );
      const provenObjects = branches.every(
        (branch) =>
          branch.matched &&
          sourcePathHasProvenance(
            branch === branches[0] ? chosen.whenTrue : chosen.whenFalse,
            lookupScope,
            branch
          ) &&
          branch.value.kind === 'object'
      );
      if (provenObjects) {
        const hooks = [
          sourceHookLabel(chosen.whenTrue, lookupScope),
          sourceHookLabel(chosen.whenFalse, lookupScope),
        ];
        const bind = (target: ts.Identifier, key: string): void => {
          const held = branches.map((branch) =>
            branch.value.kind === 'object' ? branch.value.members.get(key) : undefined
          );
          if (
            held.every(
              (value): value is HookSourceValue & { kind: 'state' } => value?.kind === 'state'
            )
          ) {
            const states = [
              ...new Map(
                held.map((state) => [
                  `${state.state.declaration.file}\u0000${state.state.declaration.start}`,
                  state,
                ])
              ).values(),
            ];
            const labels = [...new Set(hooks.filter((hook): hook is string => Boolean(hook)))];
            declare(scope, target.text, {
              kind: 'handle',
              hook: labels[0] ?? '<source-hook>',
              state: states[0].state.declaredName,
              sourceState: states[0].state,
              sourceAlternatives: states.slice(1).map((state) => state.state),
              sourceAlternativeHooks: labels.slice(1),
            });
          } else {
            declare(scope, target.text, { kind: 'opaque' });
          }
        };
        if (ts.isObjectBindingPattern(name)) {
          for (const element of name.elements) {
            if (!ts.isIdentifier(element.name) || element.dotDotDotToken) continue;
            const property = element.propertyName ?? element.name;
            const key =
              ts.isIdentifier(property) || ts.isStringLiteralLike(property) ? property.text : null;
            if (key) bind(element.name, key);
          }
        } else {
          name.elements.forEach((element, index) => {
            if (ts.isOmittedExpression(element) || !ts.isIdentifier(element.name)) return;
            bind(element.name, String(index));
          });
        }
        return;
      }
    }
    if (ts.isConditionalExpression(chosen) && ts.isIdentifier(name)) {
      // Each branch is bound into a throwaway scope so this reads exactly what
      // the same expression would name on its own.
      const branches = [chosen.whenTrue, chosen.whenFalse].map((branch) => {
        const probe: Scope = {
          parent: lookupScope,
          bindings: new Map(),
          node: lookupScope.node,
          sourceSummary: lookupScope.sourceSummary,
          versions: lookupScope.versions,
        };
        declareValue(name, branch, probe, lookupScope);
        return probe.bindings.get(name.text);
      });
      // `sourceBinding` is a type predicate, not a callable runtime test, so it
      // cannot be handed to `filter`. Narrowing happens in the loop instead.
      const sourceBranches: Binding[] = [];
      for (const branch of branches) {
        if (sourceBinding(branch)) sourceBranches.push(branch);
      }
      if (sourceBranches.length === branches.length && sourceBranches.length > 0) {
        const head = sourceBranches[0];
        const sourceAuthority = sourceBranches.some(
          (branch) => 'sourceAuthority' in branch && branch.sourceAuthority === true
        );
        if (head.kind === 'handle' && sourceBranches.every((branch) => branch.kind === 'handle')) {
          const states = [...new Set(sourceBranches.flatMap(sourceBindingStates))];
          const hooks = [...new Set(sourceBranches.flatMap(sourceBindingHooks))];
          declare(scope, name.text, {
            ...head,
            sourceState: states[0],
            sourceAlternatives: states.slice(1),
            sourceAlternativeHooks: hooks.slice(1),
            sourceAuthority,
          });
        } else {
          const values = [...new Set(sourceBranches.flatMap(sourceBindingValues))];
          const hooks = [...new Set(sourceBranches.flatMap(sourceBindingHooks))];
          declare(scope, name.text, {
            ...head,
            sourceValue: values[0],
            sourceAlternatives: values.slice(1),
            sourceAlternativeHooks: hooks.slice(1),
            sourceAuthority,
          } as Binding);
        }
        return;
      }
      const locals = branches.filter(
        (binding): binding is Binding & { kind: 'localState' } => binding?.kind === 'localState'
      );
      if (locals.length === branches.length && locals.length > 0) {
        const [head, ...rest] = locals;
        const bare = (binding: LocalStateBinding): LocalStateBinding => ({
          kind: 'localState',
          declaredAs: binding.declaredAs,
          exposedAs: binding.exposedAs,
        });
        // A branch may itself be a conditional, so its own alternatives are
        // lifted here; `head.alternatives` would otherwise be overwritten by
        // this key and `bare` would strip the rest's.
        const seen = new Set([head.declaredAs]);
        const alternatives: LocalStateBinding[] = [];
        for (const candidate of [
          ...(head.alternatives ?? []),
          ...rest.flatMap((branch) => [bare(branch), ...(branch.alternatives ?? [])]),
        ]) {
          if (seen.has(candidate.declaredAs)) continue;
          seen.add(candidate.declaredAs);
          alternatives.push(bare(candidate));
        }
        const exposedAs = exposureFor(name.text, scope);
        declare(scope, name.text, {
          ...head,
          exposedAs: exposedAs === undefined ? head.exposedAs : exposedAs,
          alternatives,
        });
        return;
      }
    }

    // `const { ready: publicFlag } = { ready: flag }` and `const [publicFlag] =
    // [flag]` name the same handle a plain alias does.
    if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
      const bound: Array<{ target: ts.Identifier; key: string }> = [];
      if (ts.isObjectBindingPattern(name)) {
        for (const element of name.elements) {
          if (!ts.isIdentifier(element.name) || element.dotDotDotToken) continue;
          const property = element.propertyName ?? element.name;
          if (!ts.isIdentifier(property) && !ts.isStringLiteralLike(property)) continue;
          bound.push({ target: element.name, key: property.text });
        }
      } else {
        name.elements.forEach((element, index) => {
          if (ts.isOmittedExpression(element)) return;
          if (!ts.isIdentifier(element.name) || element.dotDotDotToken) return;
          bound.push({ target: element.name, key: String(index) });
        });
      }
      for (const { target, key } of bound) {
        const held = containerMembers(initializer, key, lookupScope);
        // A pattern binds one name, so several candidates leave it ambiguous.
        if (held.length === 1) declareValue(target, held[0], scope, lookupScope);
      }
      return;
    }

    // `const checked = asHook().stateHandles.checked` and `= bag.checked`
    const value = unwrap(initializer);
    if (ts.isPropertyAccessExpression(value) && ts.isIdentifier(name)) {
      const owner = bagHook(value.expression, lookupScope);
      if (owner) {
        declare(scope, name.text, {
          kind: 'handle',
          hook: owner,
          state: value.name.text,
        });
        return;
      }
    }

    // `const hidden = def.state.bool('hidden', true)` — a prototype-owned state.
    // Production reads the member name statically, so `def.state['bool'](…)`
    // reaches the same declaration and must not be reported unresolved.
    const stateOwner = ts.isCallExpression(value) ? ownerOf(unwrap(value.expression)) : null;
    if (
      ts.isCallExpression(value) &&
      stateOwner &&
      memberNamed(stateOwner, 'state') &&
      ts.isIdentifier(name)
    ) {
      const declaredArgument = value.arguments[0];
      declare(scope, name.text, {
        kind: 'localState',
        // `null` means the declaration exists but its runtime name cannot be
        // read here, which is not the same as having no declaration at all.
        // A constant the extractor resolves has to resolve here too, or the
        // gate reports a blind spot production does not have.
        declaredAs: declaredArgument ? constantStringValue(declaredArgument, lookupScope) : null,
        exposedAs: exposureFor(name.text, scope),
      });
      return;
    }

    const hook = hookOfCall(initializer, lookupScope);
    if (hook && ts.isIdentifier(name)) {
      declare(scope, name.text, { kind: 'hookResult', hook });
      return;
    }

    // `let current = first` names the same handle `first` does, and production
    // resolves the alias, so a rule reading the alias is not a blind spot.
    if (ts.isIdentifier(value) && ts.isIdentifier(name)) {
      const aliased = lookup(lookupScope, value.text);
      if (aliased?.kind === 'tokenImport' && loweredHookStates(aliased.imported)) {
        // A local alias of an imported hook is the same producer, so carry the
        // imported identity instead of the local spelling.
        declare(scope, name.text, { kind: 'hookResult', hook: aliased.imported });
        return;
      }
      if (
        aliased &&
        aliased.kind !== 'token' &&
        aliased.kind !== 'tokenImport' &&
        aliased.kind !== 'defaultImport'
      ) {
        const exposedAs = exposureFor(name.text, scope);
        declare(
          scope,
          name.text,
          aliased.kind === 'localState'
            ? { ...aliased, exposedAs: exposedAs === undefined ? aliased.exposedAs : exposedAs }
            : aliased
        );
        return;
      }
    }

    // Anything else a name can hold is a candidate token value. Keeping it in
    // the same scope chain means two blocks may each declare `TOKENS` without
    // either becoming ambiguous, which is what the extractor's scopes do.
    if (ts.isIdentifier(name)) {
      // A conditional whose branches are only partly recognized would otherwise
      // read as if the recognized ones were all of them.
      const recognized =
        objectLiteralTargets(initializer).length + aliasTargets(initializer).length;
      const partial = recognized > 0 && recognized < conditionalLeafCount(initializer);
      declare(scope, name.text, {
        kind: 'token',
        initializer,
        ...(partial ? { opaque: true } : {}),
        bindingNode:
          ts.isVariableDeclaration(name.parent) && name.parent.name === name ? name.parent : name,
      });
    }
  };

  const declareImports = (scope: Scope): void => {
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      if (!ts.isStringLiteralLike(statement.moduleSpecifier)) continue;
      const clause = statement.importClause;
      if (!clause) continue;
      // A default import binds the module's default export. The name is bound,
      // so the built-in hook table must not answer for it by spelling: only a
      // proven authored producer may, and the source summary resolves that.
      if (clause.name) {
        declare(scope, clause.name.text, {
          kind: 'defaultImport',
          specifier: statement.moduleSpecifier.text,
          from: fileName,
        });
      }
      const bindings = clause.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) continue;
      for (const element of bindings.elements) {
        declare(scope, element.name.text, {
          kind: 'tokenImport',
          specifier: statement.moduleSpecifier.text,
          imported: (element.propertyName ?? element.name).text,
        });
      }
    }
  };

  /**
   * Resolves the argument of a `w.state(...)` read. `null` means untraceable;
   * `'local'` means traced to a prototype-owned state, which needs no hook
   * entry and must not be reported either way.
   */
  type StateRead = HookStateUsage | { exposedLocal: ExposedLocalUsage } | 'local';

  const localStateRead = (binding: LocalStateBinding, state: string): StateRead | null => {
    if (binding.exposedAs === undefined) return 'local';
    if (binding.exposedAs === null) return null;
    // The runtime attribute comes from the declared name. If that name is not
    // statically readable the extractor emits nothing, so substituting the
    // expose key here would certify a selector that never exists.
    if (binding.declaredAs === null) return null;
    return {
      exposedLocal: {
        state,
        exposedAs: binding.exposedAs,
        attribute: exposedDataAttributeName(binding.declaredAs),
      },
    };
  };

  /**
   * Every state a `w.state(...)` read may reach. `null` means untraceable; a
   * name whose write may be skipped reaches more than one, and production emits
   * a selector for each.
   */
  const readState = (node: ts.Node, scope: Scope): StateRead[] | null => {
    const argument = unwrap(node);
    const resolvedCandidates = sourceResolveCandidates(argument, scope);
    const sourceStates = resolvedCandidates
      .filter((candidate) => candidate.matched)
      .map((candidate) => candidate.value);
    if (
      sourceStates.length === resolvedCandidates.length &&
      sourceStates.length > 0 &&
      sourceStates.every((candidate) => candidate.kind === 'state')
    ) {
      const hook = sourceHookLabel(argument, scope);
      const hooks = sourceStates.map((candidate) => sourceStateHooks.get(candidate.state) ?? hook);
      if (
        hooks.length > 0 &&
        hooks.every((candidate): candidate is string => typeof candidate === 'string')
      ) {
        return sourceStates.map((candidate, index) =>
          sourceUsage(hooks[index], candidate.state.declaredName, candidate.state)
        );
      }
      if (!hook && !ts.isIdentifier(argument)) return null;
      if (!hook) {
        // A local identifier is handled below so its authored alias retains
        // the caller spelling in the public result.
      } else {
        return sourceStates.map((candidate) => {
          return sourceUsage(hook, candidate.state.declaredName, candidate.state);
        });
      }
    }
    if (ts.isIdentifier(argument)) {
      const binding = lookup(scope, argument.text);
      if (binding?.kind === 'handle') {
        const states = sourceBindingStates(binding);
        const hooks = sourceBindingHooks(binding);
        return states.length > 0
          ? states.map((state, index) =>
              sourceUsage(hooks[index] ?? binding.hook, binding.state, state)
            )
          : [{ hook: binding.hook, state: binding.state }];
      }
      if (binding?.kind === 'localState') {
        const reads = [binding, ...(binding.alternatives ?? [])].map((candidate) =>
          localStateRead(candidate, argument.text)
        );
        return reads.some((read) => read === null) ? null : (reads as StateRead[]);
      }
      return null;
    }
    if (ts.isPropertyAccessExpression(argument) || ts.isElementAccessExpression(argument)) {
      const member = memberNameOf(argument);
      const ownerExpression = ownerOf(argument);
      if (member !== null && ownerExpression) {
        const ownerCandidates = sourceResolveCandidates(ownerExpression, scope);
        const ownerIdentifier = unwrap(ownerExpression);
        const ownerBinding = ts.isIdentifier(ownerIdentifier)
          ? lookup(scope, ownerIdentifier.text)
          : null;
        const authoritative =
          ownerCandidates.some(
            (candidate) =>
              candidate.matched && sourcePathHasProvenance(ownerExpression, scope, candidate)
          ) ||
          (ownerBinding !== null &&
            'sourceAuthority' in ownerBinding &&
            ownerBinding.sourceAuthority === true);
        // The complete source-state proof above already handled known members.
        // Missing or unknown source paths cannot regain proof from a legacy
        // hook-name table or an internal result bucket with a matching name.
        if (authoritative) return null;
      }
      if (ts.isPropertyAccessExpression(argument)) {
        const owner = bagHook(argument.expression, scope);
        if (owner) {
          return [{ hook: owner, state: argument.name.text }];
        }
      }
      // `const controls = { ready: flag }` — production reads the container the
      // same way it reads an `asHook` bag, so this is not a blind spot.
      // A container with an unresolvable branch is: certifying the members it
      // does show would vouch for a set the runtime can step outside of.
      const owner = ownerOf(argument);
      if (owner && containerIsOpaque(owner, scope)) return null;
      const held = memberOfHandleObject(argument, scope);
      if (held.length === 0) return null;
      const reads = held.map((expression) => readState(expression, scope));
      return reads.some((read) => read === null) ? null : (reads.flat() as StateRead[]);
    }
    return null;
  };

  /**
   * The expression a statically known container holds under `key`. An array
   * index is its position, which is what a positional pattern binds. Following
   * a name is bounded so a self-referential constant cannot loop.
   */
  const containerMembers = (
    node: ts.Node,
    key: string,
    scope: Scope,
    seen = new Set<string>()
  ): ts.Expression[] => {
    const value = unwrap(node);
    if (ts.isObjectLiteralExpression(value)) {
      for (const property of value.properties) {
        if (ts.isShorthandPropertyAssignment(property) && property.name.text === key) {
          return [property.name];
        }
        if (
          ts.isPropertyAssignment(property) &&
          (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) &&
          property.name.text === key
        ) {
          return [property.initializer];
        }
      }
      return [];
    }
    if (ts.isArrayLiteralExpression(value)) {
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0) return [];
      const element = value.elements[index];
      return element && !ts.isOmittedExpression(element) ? [element] : [];
    }
    if (ts.isConditionalExpression(value)) {
      // Either object may be the one written through, so both answer.
      return [
        ...containerMembers(value.whenTrue, key, scope, seen),
        ...containerMembers(value.whenFalse, key, scope, seen),
      ];
    }
    if (ts.isIdentifier(value) && !seen.has(value.text)) {
      const binding = lookup(scope, value.text);
      if (binding?.kind === 'token') {
        // A write through the container replaces what the declaration named.
        const written = binding.members?.get(key);
        if (written && written.length > 0) return written;
        const next = new Set([...seen, value.text]);
        // A container that replaced another conditionally still answers for it.
        return [binding.initializer, ...(binding.alternates ?? [])].flatMap((held) =>
          containerMembers(held, key, scope, next)
        );
      }
    }
    return [];
  };

  /** The members a container's declaration names, for an unreadable write key. */
  const containerKeys = (node: ts.Node, scope: Scope, seen = new Set<string>()): string[] => {
    const value = unwrap(node);
    if (ts.isObjectLiteralExpression(value)) {
      return value.properties.flatMap((property) =>
        ts.isShorthandPropertyAssignment(property) ||
        (ts.isPropertyAssignment(property) &&
          (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)))
          ? [(property.name as ts.Identifier | ts.StringLiteral).text]
          : []
      );
    }
    if (ts.isArrayLiteralExpression(value)) return value.elements.map((_, index) => String(index));
    if (ts.isIdentifier(value) && !seen.has(value.text)) {
      const binding = lookup(scope, value.text);
      if (binding?.kind === 'token') {
        return containerKeys(binding.initializer, scope, new Set([...seen, value.text]));
      }
    }
    return [];
  };

  const declareLoopTokenBindings = (
    node: ts.ForOfStatement,
    scope: Scope,
    row?: ts.Expression
  ): void => {
    const initializer = node.initializer;
    const iterable = unwrap(node.expression);
    if (!ts.isVariableDeclarationList(initializer) || !ts.isArrayLiteralExpression(iterable))
      return;
    const elements = row
      ? [row]
      : iterable.elements.filter((element) => !ts.isOmittedExpression(element));
    const assign = (name: ts.BindingName, expressions: ts.Expression[]): void => {
      if (!ts.isIdentifier(name) || expressions.length === 0) return;
      declare(scope, name.text, {
        kind: 'token',
        initializer: expressions[0],
        ...(expressions.length > 1 ? { alternates: expressions.slice(1) } : {}),
        bindingNode: initializer,
      });
    };
    const members = (key: string): ts.Expression[] =>
      elements.flatMap((element) => containerMembers(element, key, scope));
    for (const declaration of initializer.declarations) {
      if (ts.isIdentifier(declaration.name)) {
        assign(declaration.name, elements);
      } else if (ts.isArrayBindingPattern(declaration.name)) {
        declaration.name.elements.forEach((element, index) => {
          if (ts.isOmittedExpression(element) || !ts.isIdentifier(element.name)) return;
          assign(element.name, members(String(index)));
        });
      } else if (ts.isObjectBindingPattern(declaration.name)) {
        for (const element of declaration.name.elements) {
          if (!ts.isBindingElement(element) || !ts.isIdentifier(element.name)) continue;
          const property = element.propertyName ?? element.name;
          const key =
            ts.isIdentifier(property) || ts.isStringLiteralLike(property) ? property.text : null;
          if (key !== null) assign(element.name, members(key));
        }
      }
    }
  };

  /** Every binding a base expression may name, following a conditional. */
  const containerBindings = (
    node: ts.Node,
    scope: Scope,
    seen = new Set<string>()
  ): Array<{ scope: Scope; name: string }> => {
    const value = unwrap(node);
    if (ts.isConditionalExpression(value)) {
      return [
        ...containerBindings(value.whenTrue, scope, seen),
        ...containerBindings(value.whenFalse, scope, seen),
      ];
    }
    if (!ts.isIdentifier(value) || seen.has(value.text)) return [];
    const owner = scopeBinding(scope, value.text);
    const held = owner?.bindings.get(value.text);
    if (!owner || !held) return [];
    if (held.kind === 'handleBag' && held.sourceValue?.kind === 'object') {
      return [{ scope: owner, name: value.text }];
    }
    if (held.kind !== 'token') return [];
    const initializer = unwrap(held.initializer);
    if (ts.isIdentifier(initializer) || ts.isConditionalExpression(initializer)) {
      const next = containerBindings(initializer, scope, new Set([...seen, value.text]));
      if (next.length > 0) return next;
    }
    return [{ scope: owner, name: value.text }];
  };

  /** Token bindings that resolve to the same pre-RHS container receiver. */
  const tokenAliases = (
    target: { scope: Scope; name: string },
    scope: Scope
  ): Array<{ scope: Scope; name: string; initializer: ts.Expression; bindingNode?: ts.Node }> => {
    const aliases: Array<{
      scope: Scope;
      name: string;
      initializer: ts.Expression;
      bindingNode?: ts.Node;
    }> = [];
    for (let owner: Scope | null = scope; owner; owner = owner.parent) {
      for (const [name, binding] of owner.bindings) {
        if (binding.kind !== 'token') continue;
        const declaration = binding.bindingNode;
        const reference =
          declaration && ts.isVariableDeclaration(declaration) ? declaration.name : declaration;
        if (!reference || !ts.isIdentifier(reference)) continue;
        if (
          containerBindings(reference, owner).some(
            (candidate) => candidate.scope === target.scope && candidate.name === target.name
          )
        ) {
          aliases.push({
            scope: owner,
            name,
            initializer: binding.initializer,
            bindingNode: binding.bindingNode,
          });
        }
      }
    }
    return aliases;
  };

  /** Whether any container this base may name has an unresolvable branch. */
  const containerIsOpaque = (node: ts.Node, scope: Scope, seen = new Set<string>()): boolean => {
    const value = unwrap(node);
    if (ts.isConditionalExpression(value)) {
      return (
        containerIsOpaque(value.whenTrue, scope, seen) ||
        containerIsOpaque(value.whenFalse, scope, seen)
      );
    }
    if (!ts.isIdentifier(value) || seen.has(value.text)) return false;
    const binding = lookup(scope, value.text);
    if (binding?.kind !== 'token') return false;
    if (binding.opaque) return true;
    const next = new Set([...seen, value.text]);
    return [binding.initializer, ...(binding.alternates ?? [])].some((held) =>
      containerIsOpaque(held, scope, next)
    );
  };

  const memberOfHandleObject = (node: ts.Node, scope: Scope): ts.Expression[] => {
    const owner = ownerOf(node);
    const key = memberNameOf(node);
    return owner && key !== null ? containerMembers(owner, key, scope) : [];
  };

  const sourceMemberPresence = (node: ts.Node, scope: Scope): boolean | null => {
    const value = unwrap(node);
    if (!ts.isPropertyAccessExpression(value) && !ts.isElementAccessExpression(value)) return null;
    const key = memberNameOf(value);
    const owner = ownerOf(value);
    if (key === null || !owner || hasObjectPrototypeEscape || key in Object.prototype) return null;
    const resolvedCandidates = sourceResolveCandidates(owner, scope);
    const resolved = resolvedCandidates.find((candidate) => candidate.matched);
    if (!resolved || resolvedCandidates.some((candidate) => !candidate.matched)) return null;
    const ownerIdentifier = unwrap(owner);
    const ownerBinding = ts.isIdentifier(ownerIdentifier)
      ? lookup(scope, ownerIdentifier.text)
      : null;
    const candidates =
      ownerBinding && 'sourceValue' in ownerBinding && ownerBinding.sourceValue
        ? [ownerBinding.sourceValue, ...(ownerBinding.sourceAlternatives ?? [])]
        : resolvedCandidates.map((candidate) => candidate.value);
    const objects = candidates.filter(
      (candidate): candidate is Extract<HookSourceValue, { kind: 'object' }> =>
        candidate.kind === 'object'
    );
    if (objects.length !== candidates.length) return null;
    if (objects.every((candidate) => !candidate.members.has(key) && candidate.closed === true))
      return false;
    return null;
  };

  const sourceConditionOutcome = (node: ts.Node, scope: Scope): boolean | null => {
    const value = unwrap(node);
    if (ts.isPrefixUnaryExpression(value) && value.operator === ts.SyntaxKind.ExclamationToken) {
      const presence = sourceMemberPresence(value.operand, scope);
      return presence === null ? null : !presence;
    }
    return sourceMemberPresence(value, scope);
  };

  /**
   * The extractor's `resolveStateEqVariant` lowers exactly three right-hand
   * sides: the two boolean keywords, and a string literal whose text is a legal
   * data-attribute value. `null` means the extractor produces no variant, which
   * the scanner reports rather than reading as covered.
   */
  const comparisonOf = (
    node: ts.Expression | undefined,
    scope: Scope
  ): 'positive' | 'negative' | null => {
    if (!node) return null;
    if (node.kind === ts.SyntaxKind.TrueKeyword) return 'positive';
    if (node.kind === ts.SyntaxKind.FalseKeyword) return 'negative';
    if (ts.isStringLiteralLike(node) && /^[a-zA-Z0-9_-]+$/.test(node.text)) return 'positive';
    if (ts.isIdentifier(node)) {
      const binding = lookup(scope, node.text);
      if (binding?.kind === 'token') {
        const candidates = [binding.initializer, ...(binding.alternates ?? [])].map((candidate) =>
          unwrap(candidate)
        );
        if (
          candidates.length > 0 &&
          candidates.every(
            (candidate): candidate is ts.StringLiteralLike =>
              ts.isStringLiteralLike(candidate) && /^[a-zA-Z0-9_-]+$/.test(candidate.text)
          )
        )
          return 'positive';
      }
    }
    // `number.discrete` bindings lower by stringifying the literal, and `-1`
    // parses as a prefix unary expression rather than a numeric literal.
    if (ts.isNumericLiteral(node)) return 'positive';
    if (
      ts.isPrefixUnaryExpression(node) &&
      (node.operator === ts.SyntaxKind.MinusToken || node.operator === ts.SyntaxKind.PlusToken) &&
      ts.isNumericLiteral(node.operand)
    ) {
      return 'positive';
    }
    return null;
  };

  /** Matches `getPropertyName` in the extractor, which accepts a quoted key. */
  const propertyName = (name: ts.PropertyName): string | null =>
    ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : null;

  /**
   * Reads a relative module the way `resolveModuleFile` does, so an imported
   * token constant is judged by its own initializer rather than by the fact
   * that the import was relative. A module this cannot read fails closed.
   */
  const moduleCache = new Map<string, ts.SourceFile | null>();

  const loadRelativeModule = (specifier: string, from = fileName): ts.SourceFile | null => {
    if (!specifier.startsWith('.')) return null;
    const base = path.resolve(path.dirname(from), specifier);
    const cached = moduleCache.get(base);
    if (cached !== undefined) return cached;
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.mts`,
      `${base}.js`,
      `${base}.mjs`,
      path.join(base, 'index.ts'),
      path.join(base, 'index.tsx'),
      path.join(base, 'index.js'),
    ];
    for (const candidate of candidates) {
      try {
        if (!statSync(candidate).isFile()) continue;
      } catch {
        continue;
      }
      const loaded = ts.createSourceFile(
        candidate,
        readFileSync(candidate, 'utf8'),
        ts.ScriptTarget.Latest,
        true
      );
      moduleCache.set(base, loaded);
      return loaded;
    }
    moduleCache.set(base, null);
    return null;
  };

  const moduleScopes = new Map<ts.SourceFile, Scope>();

  const moduleRootScope = (module: ts.SourceFile): Scope => {
    const cached = moduleScopes.get(module);
    if (cached) return cached;
    const scope: Scope = {
      parent: null,
      bindings: new Map(),
      node: null,
      sourceSummary,
      versions: createSourceGraphVersionTracker(),
    };
    // Insert before filling so a cycle of relative modules terminates.
    moduleScopes.set(module, scope);
    for (const statement of module.statements) {
      if (ts.isImportDeclaration(statement) && ts.isStringLiteralLike(statement.moduleSpecifier)) {
        const clause = statement.importClause;
        if (clause?.name) {
          scope.bindings.set(clause.name.text, {
            kind: 'defaultImport',
            specifier: statement.moduleSpecifier.text,
            from: module.fileName,
          });
        }
        const named = clause?.namedBindings;
        if (named && ts.isNamedImports(named)) {
          for (const element of named.elements) {
            scope.bindings.set(element.name.text, {
              kind: 'tokenImport',
              specifier: statement.moduleSpecifier.text,
              imported: (element.propertyName ?? element.name).text,
              from: module.fileName,
            });
          }
        }
        continue;
      }
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
        scope.bindings.set(declaration.name.text, {
          kind: 'token',
          initializer: declaration.initializer,
        });
      }
    }
    return scope;
  };

  const exportedInitializer = (module: ts.SourceFile, name: string): ts.Expression | null => {
    for (const statement of module.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name) continue;
        return declaration.initializer ?? null;
      }
    }
    return null;
  };

  /**
   * Argument shapes `resolveExpression` turns into tokens. A `tw(...)` argument
   * the extractor cannot resolve — an arbitrary call, or a name whose value it
   * cannot reach — names a real token set at runtime and yields nothing to the
   * closure, so the rendered variant would have no CSS.
   */
  const resolvableTokenArgument = (
    node: ts.Expression,
    scope: Scope,
    seen = new Set<string>()
  ): boolean => {
    const inner = unwrap(node) as ts.Expression;
    if (ts.isStringLiteralLike(inner) || ts.isNoSubstitutionTemplateLiteral(inner)) return true;
    // `resolveExpression` requires each substitution to carry a single value;
    // a conditional resolves to several strings and the template is dropped,
    // while the runtime receives one concrete token.
    if (ts.isTemplateExpression(inner))
      return inner.templateSpans.every(
        (span) =>
          singleValuedTokenArgument(span.expression, scope) &&
          resolvableTokenArgument(span.expression, scope, seen)
      );
    if (ts.isArrayLiteralExpression(inner))
      return inner.elements.every((element) => resolvableTokenArgument(element, scope, seen));
    if (ts.isObjectLiteralExpression(inner))
      return inner.properties.every((property) => {
        // A property holding a state handle is not token data. Production reads
        // the container for handles and tokens at once and takes strings only
        // where they exist, so such a property does not stop the read.
        if (ts.isShorthandPropertyAssignment(property)) {
          return (
            readState(property.name, scope) !== null ||
            resolvableTokenArgument(property.name, scope, seen)
          );
        }
        if (!ts.isPropertyAssignment(property)) return false;
        if (readState(property.initializer, scope) !== null) return true;
        return resolvableTokenArgument(property.initializer, scope, seen);
      });
    if (ts.isConditionalExpression(inner))
      return (
        resolvableTokenArgument(inner.whenTrue, scope, seen) &&
        resolvableTokenArgument(inner.whenFalse, scope, seen)
      );
    if (ts.isCallExpression(inner) && ts.isIdentifier(inner.expression)) {
      if (inner.expression.text !== 'tw' || inner.arguments.length === 0) return false;
      return inner.arguments.every((argument) => resolvableTokenArgument(argument, scope, seen));
    }
    // `[...].join(' ')` is the one call form the extractor resolves, and
    // `resolveJoinCall` reads only a literal separator — anything else falls
    // back to `,` there while the runtime joins on the real value.
    if (
      ts.isCallExpression(inner) &&
      ts.isPropertyAccessExpression(inner.expression) &&
      inner.expression.name.text === 'join'
    ) {
      const separator = inner.arguments[0];
      const readableSeparator =
        separator === undefined ||
        ts.isStringLiteralLike(separator) ||
        ts.isNoSubstitutionTemplateLiteral(separator);
      if (!readableSeparator) return false;
      return resolvableTokenArgument(inner.expression.expression, scope, seen);
    }
    if (ts.isIdentifier(inner)) {
      if (seen.has(inner.text)) return false;
      const binding = lookup(scope, inner.text);
      const next = new Set([...seen, inner.text]);
      if (binding?.kind === 'token') {
        return [binding.initializer, ...(binding.alternates ?? [])].every((candidate) =>
          resolvableTokenArgument(candidate, scope, next)
        );
      }
      if (binding?.kind === 'tokenImport') {
        const module = loadRelativeModule(binding.specifier, binding.from ?? fileName);
        if (!module) return false;
        const initializer = exportedInitializer(module, binding.imported);
        if (!initializer) return false;
        // `loadModuleBindings` applies the module's own relative imports before
        // resolving its exports, so a token re-exported through a chain of
        // relative modules is extractable and must not read as opaque here.
        return resolvableTokenArgument(initializer, moduleRootScope(module), next);
      }
      return false;
    }
    if (ts.isElementAccessExpression(inner)) {
      // A member is only reachable if its owner is. Element access is the form
      // `resolveExpression` reads a token map through.
      return resolvableTokenArgument(inner.expression, scope, seen);
    }
    // Dot access resolves through `semanticMap` only, which holds hook state
    // handles rather than tokens. An ordinary token object is a `map`, so
    // `tw(TOKENS.active)` yields nothing while the runtime lowers the real one.
    return false;
  };

  /** Shapes `resolveExpression` gives a single value rather than a set. */
  const singleValuedTokenArgument = (node: ts.Expression, scope: Scope): boolean => {
    const inner = unwrap(node) as ts.Expression;
    if (ts.isStringLiteralLike(inner) || ts.isNoSubstitutionTemplateLiteral(inner)) return true;
    if (ts.isTemplateExpression(inner)) return true;
    if (ts.isIdentifier(inner)) {
      const binding = lookup(scope, inner.text);
      if (binding?.kind === 'token') return singleValuedTokenArgument(binding.initializer, scope);
      return binding?.kind === 'tokenImport';
    }
    return false;
  };

  /**
   * Every `tw(...)` in the intent, and every argument of each, has to be
   * extractable. `tw` is variadic and `collectTwTokens` reads all of them, so
   * one resolvable argument cannot vouch for the rest.
   */
  const yieldsExtractableTokens = (
    node: ts.Node,
    scope: Scope,
    intentParameter: string | null
  ): boolean => {
    // Only the handles actually handed to `feedback.style.use` carry tokens the
    // variant prefixes. A `tw(...)` sitting elsewhere in the intent is read by
    // the extractor's own walk and would otherwise vouch for a handle it has
    // nothing to do with.
    const handles: ts.Expression[] = [];
    const collect = (current: ts.Node): void => {
      if (
        ts.isCallExpression(current) &&
        intentParameter !== null &&
        chainBase(current) === intentParameter &&
        memberChain(current).join('.') === 'feedback.style.use'
      ) {
        handles.push(...current.arguments);
      }
      ts.forEachChild(current, collect);
    };
    collect(node);
    if (handles.length === 0) return false;

    return handles.every((handle) => {
      const call = unwrap(handle);
      if (
        ts.isCallExpression(call) &&
        ts.isIdentifier(call.expression) &&
        call.expression.text === 'tw'
      ) {
        return (
          call.arguments.length > 0 &&
          call.arguments.every((argument) => resolvableTokenArgument(argument, scope))
        );
      }
      // The style collector resolves a finite pre-bound tw handle through its
      // lexical binding; require that same token proof here instead of
      // rejecting every non-inline handle.
      return resolvableTokenArgument(call as ts.Expression, scope);
    });
  };

  /** The identifier a member chain bottoms out at, if it is one. */
  const chainBase = (node: ts.Node): string | null => {
    let current = unwrap(node);
    while (ts.isPropertyAccessExpression(current) || ts.isCallExpression(current)) {
      current = unwrap(ts.isCallExpression(current) ? current.expression : current.expression);
    }
    return ts.isIdentifier(current) ? current.text : null;
  };

  /** The member chain of a call, e.g. `feedback.style.use`. */
  const memberChain = (node: ts.CallExpression): string[] => {
    const parts: string[] = [];
    let current: ts.Node = unwrap(node.expression);
    while (ts.isPropertyAccessExpression(current)) {
      parts.unshift(current.name.text);
      current = unwrap(current.expression);
    }
    return parts;
  };

  const parameterName = (node: ts.Node): string | null => {
    const fn = unwrap(node);
    if (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn)) return null;
    const first = fn.parameters[0];
    return first && ts.isIdentifier(first.name) ? first.name.text : null;
  };

  type Leaf = {
    usages: StateRead[] | null;
    /** The `w.state(...)` argument. */
    subject: string;
    /** The whole `w.state(...).eq(...)` leaf. */
    text: string;
    comparison: 'positive' | 'negative' | null;
  };

  const analyzeRule = (config: ts.ObjectLiteralExpression, scope: Scope): void => {
    // `{ when, intent }` and `{ when() {} }` are valid specs the runtime calls
    // normally, while both `collectRuleVariantTokens` and this scanner read
    // plain property assignments only. Skipping them would leave no trace.
    const shorthand = config.properties.find(
      (property) =>
        (ts.isShorthandPropertyAssignment(property) || ts.isMethodDeclaration(property)) &&
        (propertyName(property.name) === 'when' || propertyName(property.name) === 'intent')
    );
    if (shorthand) {
      unresolved.push({ expression: config.getText(source), reason: 'spec' });
      return;
    }

    const when = config.properties.find(
      (property) => ts.isPropertyAssignment(property) && propertyName(property.name) === 'when'
    );
    if (!when || !ts.isPropertyAssignment(when)) return;

    const leaves: Leaf[] = [];
    let hasForeignDep = false;
    let hasAny = false;
    let hasMeta = false;
    let aliasedBuilder = false;
    let branchedCondition = false;
    let helperCondition = false;
    const builderParameter = parameterName(when.initializer);
    // `({ state }) => state(x).eq(true)` gives the builder no name to anchor on,
    // and `analyzeWhenVariants` reads a property access, so it emits no selector.
    if (builderParameter === null) aliasedBuilder = true;

    /**
     * Everything the two lowering paths understand. `isStateMetaDeps` accepts
     * only `state` and `meta` dependencies and `extractConditions` only `eq`
     * and `all`, so anything else keeps the rule on the runtime plan. Naming
     * what is understood rather than what is refused means a builder method
     * added later defaults to not lowerable instead of being silently assumed
     * static.
     */
    const LOWERABLE_MEMBERS = new Set(['all', 'any', 'eq', 'state', 'meta']);

    const visitCondition = (node: ts.Node): void => {
      // Only one branch reaches the returned expression at runtime, so the
      // runtime lowers one condition while a walk over the source sees both and
      // the extractor combines them into a selector nothing matches.
      const CONTROL_FLOW_OPERATORS = new Set<ts.SyntaxKind>([
        ts.SyntaxKind.CommaToken,
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ]);
      if (
        ts.isConditionalExpression(node) ||
        (ts.isBinaryExpression(node) && CONTROL_FLOW_OPERATORS.has(node.operatorToken.kind))
      ) {
        branchedCondition = true;
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const member = node.expression.name.text;
        // The runtime's dependency set holds the builder operations actually
        // invoked, so an unrelated call in a block-bodied callback is not a
        // dependency and must not make the rule look dynamic.
        const onBuilder = builderParameter !== null && chainBase(node) === builderParameter;
        // `w.all(w.state(a).eq(true), other(w))` — the runtime executes the
        // helper and lowers whatever it returns, while a source walk sees only
        // what is written here. The extractor has the same limit, so a helper
        // in a condition position is a blind spot rather than a leaf.
        if (onBuilder && (member === 'all' || member === 'any')) {
          for (const argument of node.arguments) {
            const inner = unwrap(argument);
            if (ts.isCallExpression(inner) && ts.isIdentifier(inner.expression)) {
              helperCondition = true;
            }
          }
        }
        if (onBuilder && !LOWERABLE_MEMBERS.has(member)) hasForeignDep = true;
        if (onBuilder && member === 'any') hasAny = true;

        if (onBuilder && member === 'eq') {
          const receiver = unwrap(node.expression.expression);
          // `when: ({ state }) => state(x).eq(true)` calls an aliased builder
          // member. `analyzeWhenVariants` reads a property access, so it emits
          // no selector while the runtime records the dependency normally.
          if (ts.isCallExpression(receiver) && ts.isIdentifier(receiver.expression)) {
            aliasedBuilder = true;
          }

          // `extractConditions` lowers exactly one meta comparison: colorScheme
          // against `dark`. Any other meta pair keeps the rule on the runtime
          // plan, so treating every meta dependency as lowerable would demand a
          // mapping the CLI never needs.
          if (
            ts.isCallExpression(receiver) &&
            ts.isPropertyAccessExpression(receiver.expression) &&
            receiver.expression.name.text === 'meta'
          ) {
            const key = receiver.arguments[0];
            const value = node.arguments[0];
            if (
              key &&
              value &&
              ts.isStringLiteralLike(key) &&
              ts.isStringLiteralLike(value) &&
              key.text === 'colorScheme' &&
              value.text === 'dark'
            ) {
              hasMeta = true;
            } else {
              hasForeignDep = true;
            }
          }
          if (
            ts.isCallExpression(receiver) &&
            ts.isPropertyAccessExpression(receiver.expression) &&
            receiver.expression.name.text === 'state' &&
            receiver.arguments.length === 1
          ) {
            leaves.push({
              usages: readState(receiver.arguments[0], scope),
              subject: receiver.arguments[0].getText(source),
              text: node.getText(source),
              comparison: comparisonOf(node.arguments[0], scope),
            });
          }
        }
      }
      ts.forEachChild(node, visitCondition);
    };
    visitCondition(when.initializer);

    // An unlowerable comparison counts here too: only an all-negative condition
    // is provably skipped by both sides.
    // A callback whose whole body is a helper call is the same blind spot.
    const bodyIsHelperCall = (() => {
      const fn = unwrap(when.initializer);
      if (!ts.isArrowFunction(fn) || ts.isBlock(fn.body)) return false;
      const body = unwrap(fn.body);
      return ts.isCallExpression(body) && ts.isIdentifier(body.expression);
    })();

    if (aliasedBuilder || branchedCondition || helperCondition || bodyIsHelperCall) {
      unresolved.push({ expression: when.initializer.getText(source), reason: 'condition' });
      return;
    }

    const lowerable =
      !hasForeignDep &&
      !hasAny &&
      (hasMeta || leaves.some((leaf) => leaf.comparison !== 'negative'));
    if (!lowerable) return;

    // The variant is a prefix on the tokens the intent yields. `collectTwTokens`
    // reads a `tw(...)` call, so an intent that passes a pre-bound handle gives
    // the closure nothing to prefix and the rendered variant has no CSS.
    const intent = config.properties.find(
      (property) => ts.isPropertyAssignment(property) && propertyName(property.name) === 'intent'
    );
    if (intent && ts.isPropertyAssignment(intent)) {
      // The runtime abandons a candidate as soon as an intent op is not
      // `feedback.style.use`, so a mixed intent stays on the runtime plan and
      // needs no static mapping. Demanding one would fail a valid prototype.
      const intentParameter = parameterName(intent.initializer);
      let nonStyleOperation = false;
      const inspectIntent = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          intentParameter !== null &&
          chainBase(node) === intentParameter &&
          memberChain(node).join('.') !== 'feedback.style.use'
        ) {
          nonStyleOperation = true;
        }
        ts.forEachChild(node, inspectIntent);
      };
      inspectIntent(intent.initializer);
      if (nonStyleOperation) return;

      if (!yieldsExtractableTokens(intent.initializer, scope, intentParameter)) {
        unresolved.push({ expression: intent.getText(source), reason: 'intent' });
        return;
      }
    }

    for (const leaf of leaves) {
      if (!leaf.comparison) {
        unresolved.push({ expression: leaf.text, reason: 'comparison' });
        continue;
      }
      if (!leaf.usages) {
        unresolved.push({ expression: leaf.subject, reason: 'subject' });
        continue;
      }
      for (const read of leaf.usages) {
        if (read === 'local') continue;
        if ('exposedLocal' in read) {
          exposedLocals.push(read.exposedLocal);
          continue;
        }
        usages.push(read);
      }
    }
  };

  const shadowBindingPattern = (scope: Scope, name: ts.BindingName): void => {
    if (ts.isIdentifier(name)) {
      declare(scope, name.text, { kind: 'opaque' });
      return;
    }
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) shadowBindingPattern(scope, element.name);
    }
  };

  /**
   * Whether a call's callee denotes a proven read-only accessor.
   *
   * A proven accessor reads the result it is called on and never writes to
   * it, so the call does not withdraw the proof the receiver's members
   * carry. The proof is the callee itself, not the value the call returns: a
   * state read with a dynamic key returns a value the summary cannot name,
   * while the accessor still reads. A method whose name merely looks
   * read-only proves nothing about what it does to its receiver, so nothing
   * is exempt by its spelling, and a callable that is not an admitted
   * accessor proves nothing either.
   *
   * The member is read from the graph the receiver holds now, not from the
   * projection the producer declared. A member write replaces the member in
   * the graph the container holds, and a producer hands the same container to
   * every call, so a later call reaches the member the container holds then.
   * Reading the declared projection instead would certify a receiver whose
   * member a write may already have replaced.
   *
   * Every graph the receiver may denote must carry such an accessor. The
   * receiver may be one of several values - a name that holds one object on
   * one branch and another on the other - and the runtime picks the branch it
   * takes, so a callee that may be a mutator on one of them writes to the
   * receiver on that branch. Reading only the primary resolution would
   * certify a receiver the runtime may have written to.
   *
   * The receiver is captured before the arguments are evaluated, so the proof
   * is the one the receiver carried when the call was reached: a later
   * argument that rebinds a name cannot change what the callee denoted.
   *
   * Every version the receiver may hold is read, not only the newest one. A
   * write that may not have run leaves the graph it replaced in place, so
   * the container may still hold a member the newest version replaced.
   */
  const provenAccessorCallee = (
    node: ts.CallExpression,
    scope: Scope,
    receiver: HookSourceValue[]
  ): boolean => {
    const callee = unwrap(node.expression);
    if (!ts.isPropertyAccessExpression(callee) && !ts.isElementAccessExpression(callee))
      return false;
    const key = memberNameOf(callee);
    if (key === null || receiver.length === 0) return false;
    // Every version the receiver may hold is required, and the versions of
    // several candidates are the same container, so they are counted once.
    const versions = new Set<HookSourceValue>();
    for (const held of receiver) {
      for (const version of scope.versions.versions(held)) versions.add(version);
    }
    if (versions.size === 0) return false;
    return [...versions].every((current) => {
      if (current.kind !== 'object') return false;
      const member = current.members.get(key);
      if (!member || member.kind !== 'callable') return false;
      return member.operation === 'getState';
    });
  };

  /**
   * A call may write to the containers it receives, so the cached provenance
   * of a source-backed container is only sound while no member it holds has
   * been replaced.
   *
   * A known mutating call is tracked when every member it copies is proven.
   * Any other call keeps no proof of the members the containers it received
   * hold, or of mutable containers reachable through them, because it may have
   * replaced any of them.
   *
   * `captured` holds the containers each argument denoted while that argument
   * was evaluated. The call receives those objects, so a later argument that
   * rebinds a name does not move the mutation onto the container the name
   * holds afterwards.
   *
   * `receiver` holds the containers the receiver denoted while it was
   * evaluated. A method call may write to the object it is called on, so the
   * receiver is a container the call may mutate even when it takes no
   * argument.
   *
   * `readsOnly` says the callee is a proven read-only accessor, so the call
   * does not write to the receiver it is called on.
   */
  const applyCallMutation = (
    node: ts.CallExpression,
    scope: Scope,
    captured: CapturedArgument[],
    receiver: HookSourceValue[],
    readsOnly: boolean
  ): void => {
    if (captured.length === 0 && receiver.length === 0) return;
    // An authored asHook producer never receives the arguments of its call:
    // the runtime evaluates them for their effects and then invokes the
    // producer's setup with the definition handle alone
    // (packages/core/src/prototype.ts, `proto.setup(def)` for the asHook
    // kind), and the summary only recognizes `defineAsHook` declarations as
    // producers. The producer therefore cannot write to a container it was
    // passed, so the call does not withdraw it here.
    if (scope.sourceSummary.isAuthoredProducerCall(node, source)) return;
    const mutation = hookSourceCallMutation(node);
    const callWriteUncertain = (value: HookSourceValue, ambiguous: boolean): boolean => {
      const owning = sourceOwnerScope(scope, value);
      return (
        ambiguous ||
        isConditionallyReached(node, definitelyReachedLogicalAssignments) ||
        isDeferredWrite(node, enclosingFunction(owning?.node ?? null))
      );
    };
    const publish = (value: HookSourceValue, next: HookSourceValue, ambiguous = false): void => {
      publishSourceGraph(scope, value, next, callWriteUncertain(value, ambiguous));
    };
    /**
     * An unknown call can reach a nested object through the container it was
     * handed. Walk object identities, not structural equality, so shared
     * children are written once and distinct twins stay distinct. State
     * handles are leaves, and a callable's result is an immutable capture,
     * not an edge into objects the call received. Publish reachable objects as
     * one batch so conditional writes retain no intermediate parent graphs.
     */
    const invalidateUnknownCallGraphs = (
      requests: ReadonlyArray<{ value: HookSourceValue; uncertain: boolean }>
    ): void => {
      const collect = (
        uncertain: boolean,
        seen: Set<HookSourceValue>,
        skip?: ReadonlySet<HookSourceValue>
      ): Map<HookSourceValue, HookSourceValue> => {
        const replacements = new Map<HookSourceValue, HookSourceValue>();
        const visit = (current: HookSourceValue): void => {
          if (current.kind !== 'object' && current.kind !== 'result') return;
          if (seen.has(current) || skip?.has(current)) return;
          seen.add(current);
          const versions = scope.versions.versions(current);
          for (const version of versions) seen.add(version);
          if (current.kind === 'result') {
            for (const version of versions) {
              if (version.kind !== 'result' || skip?.has(version)) continue;
              if (version.handle) visit(version.handle);
              for (const child of version.children.values()) visit(child);
            }
            return;
          }
          // A retired reference still needs its own replacement, but its old
          // members are detached. Only live versions describe reachable edges.
          if (!replacements.has(current)) {
            replacements.set(current, mutateSourceGraph(current, null));
          }
          for (const version of versions) {
            if (version.kind !== 'object' || skip?.has(version)) continue;
            if (!replacements.has(version)) {
              replacements.set(version, mutateSourceGraph(version, null));
            }
            for (const member of version.members.values()) visit(member);
          }
        };
        for (const request of requests) {
          if (request.uncertain === uncertain) visit(request.value);
        }
        return replacements;
      };
      // A container reached through a definite request is definitely written,
      // even when a conditional candidate can also reach it. Collect both maps
      // before publishing either so every replacement uses the pre-call graph.
      const definiteSeen = new Set<HookSourceValue>();
      const definite = collect(false, definiteSeen);
      const conditional = collect(true, new Set<HookSourceValue>(), definiteSeen);
      const publishBatch = (
        replacements: Map<HookSourceValue, HookSourceValue>,
        uncertain: boolean
      ): void => {
        const first = replacements.entries().next();
        if (first.done) return;
        publishSourceGraph(scope, first.value[0], first.value[1], uncertain, replacements);
      };
      // Definite writes must advance every graph retained by a possible write,
      // while the unknown alternative from that possible write remains.
      publishBatch(conditional, true);
      publishBatch(definite, false);
    };
    const unknownCallValues: { value: HookSourceValue; uncertain: boolean }[] = [];
    // The receiver is evaluated before the arguments, so the container it
    // denoted is the one the call wrote to before it looked at an argument.
    // Every version a container the call received may hold is read before
    // any of them is written: a write can leave the container holding a new
    // graph, and the versions the call wrote to are the ones the call found.
    // Reading them per container as the call goes would let the write to one
    // container add versions to the container the next lookup reads, and the
    // call would write to graphs the call never received.
    const capturedBatch = captured.map((entry) => {
      const live = new Set<HookSourceValue>();
      for (const candidate of entry.values) {
        for (const version of scope.versions.versions(candidate)) live.add(version);
      }
      const first = entry.values[0];
      const oneContainer =
        first !== undefined &&
        entry.values.every((candidate) => scope.versions.sameContainer(candidate, first));
      return { live, oneContainer };
    });
    if (receiver.length > 0 && !readsOnly) {
      // Every version the receiver may hold is withdrawn, because a write that
      // may not have run leaves the graph it replaced in place. The versions
      // of one container are that container, so the call wrote to all of them;
      // the candidates of different containers are written one at a time, so
      // the others keep the members they held.
      const live = new Set<HookSourceValue>();
      for (const candidate of receiver) {
        for (const version of scope.versions.versions(candidate)) live.add(version);
      }
      const first = receiver[0];
      const oneContainer =
        first !== undefined &&
        receiver.every((candidate) => scope.versions.sameContainer(candidate, first));
      for (const value of live) {
        if (value.kind !== 'object') continue;
        if (mutation.kind === 'unknown') {
          unknownCallValues.push({
            value,
            uncertain: callWriteUncertain(value, !oneContainer),
          });
        } else {
          publish(value, mutateSourceGraph(value, null), !oneContainer);
        }
      }
    }
    if (mutation.kind === 'copy') {
      const target = captured[mutation.target];
      if (!target) return;
      const targets = target.values.map((value) => latestSourceVersion(scope, value));
      if (targets.length === 0) return;
      const sources = mutation.sources.map((index) => captured[index]).filter(Boolean);
      // A copy with no source changes nothing, so the container keeps its proof.
      if (sources.length === 0) return;
      const copied: HookSourceValue[] = [];
      const labels: string[] = [];
      let proven = true;
      for (const argument of sources) {
        // The source is read when the call runs, so it advances to the version
        // it holds then and not to the snapshot taken while it was evaluated.
        const value = argument.source ? scope.versions.latest(argument.source) : undefined;
        const label = argument.label;
        // A source with an unproved alternative copies a different member set
        // on the other branch, and members that come from more than one
        // producer name no single producer, so the copy is not proven.
        if (!value || !label || !sourceMembersProven(value) || !sourceMembersOneProducer(value)) {
          proven = false;
          break;
        }
        copied.push(value);
        labels.push(label);
      }
      for (const value of targets) {
        publish(
          value,
          proven ? mutateSourceGraph(value, copied) : mutateSourceGraph(value, null),
          // Only one of several targets is written, so the others keep the
          // members they held.
          targets.length > 1
        );
      }
      if (!proven) return;
      // The copied states keep the producer that owns them, so a read after
      // the call names the producer the copy came from rather than the one
      // that produced the container it was written to. A state that already
      // carries its producer keeps it: a later copy through another container
      // does not change who owns the state.
      copied.forEach((source, index) => {
        if (source.kind !== 'object') return;
        for (const member of source.members.values()) {
          if (member.kind === 'state' && !sourceStateHooks.has(member.state)) {
            sourceStateHooks.set(member.state, labels[index]);
          }
        }
      });
      return;
    }
    // An unknown call may replace any member of every container it receives.
    for (const { live, oneContainer } of capturedBatch) {
      // Every version a received container may hold is withdrawn, because a
      // write that may not have run leaves the graph it replaced in place. The
      // versions of one container are that container, so the call wrote to all
      // of them; the candidates of different containers are written one at a
      // time, so the others keep the members they held.
      for (const value of live) {
        // The call received one of several containers, so the others keep the
        // members they held.
        if (value.kind !== 'object') continue;
        unknownCallValues.push({
          value,
          uncertain: callWriteUncertain(value, !oneContainer),
        });
      }
    }
    invalidateUnknownCallGraphs(unknownCallValues);
  };

  const visit = (node: ts.Node, scope: Scope): void => {
    const current = introducesScope(node)
      ? {
          parent: scope,
          bindings: new Map<string, Binding>(),
          node,
          sourceSummary: scope.sourceSummary,
          // An authored setup is its own owner: it holds its own containers of
          // the producers it reads, so it does not share the versions of the
          // owner around it.
          versions: scope.sourceSummary.isAuthoredSetup(node, source)
            ? createSourceGraphVersionTracker()
            : scope.versions,
        }
      : scope;

    if (ts.isForOfStatement(node)) {
      const iterable = unwrap(node.expression);
      if (ts.isArrayLiteralExpression(iterable)) {
        visit(node.expression, current);
        for (const row of iterable.elements) {
          if (ts.isOmittedExpression(row)) continue;
          const rowScope: Scope = {
            parent: current,
            bindings: new Map(),
            node: null,
            sourceSummary: current.sourceSummary,
            versions: current.versions,
          };
          declareLoopTokenBindings(node, rowScope, row);
          visit(node.statement, rowScope);
        }
        return;
      }
    }

    if (ts.isIfStatement(node)) {
      const outcome = sourceConditionOutcome(node.expression, current);
      visit(node.expression, current);
      if (outcome === false) {
        if (node.elseStatement) visit(node.elseStatement, current);
        return;
      }
      if (outcome === true) {
        visit(node.thenStatement, current);
        return;
      }
      visit(node.thenStatement, current);
      if (node.elseStatement) visit(node.elseStatement, current);
      return;
    }

    // A parameter shadows whatever the enclosing scopes bound to that name. Its
    // own origin cannot be recovered from the source, so it resolves to nothing
    // rather than falling through to an outer handle of the same name.
    if (ts.isFunctionLike(node)) {
      for (const parameter of node.parameters) shadowBindingPattern(current, parameter.name);
    }
    if (ts.isCatchClause(node) && node.variableDeclaration) {
      shadowBindingPattern(current, node.variableDeclaration.name);
    }

    // A statement, or a loop initializer, which production registers in the
    // loop's own scope. A catch binding still reaches neither.
    if (
      ts.isVariableDeclaration(node) &&
      node.parent &&
      ts.isVariableDeclarationList(node.parent) &&
      node.parent.parent &&
      (ts.isVariableStatement(node.parent.parent) || isLoopStatement(node.parent.parent))
    ) {
      // `var` is one function-scoped binding however deeply it is nested, which
      // is where production registers it too.
      const owner = isVarList(node.parent) ? functionScope(current) : current;
      if (node.initializer) declareValue(node.name, node.initializer, owner, current);
    }

    // Writing through the container moves the member for every read after it.
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      // A cast or a pair of parentheses names the same member, so the write
      // reaches the same container.
      (ts.isPropertyAccessExpression(unwrap(node.left)) ||
        ts.isElementAccessExpression(unwrap(node.left)))
    ) {
      const operator = node.operatorToken.kind;
      const plainAssignment = operator === ts.SyntaxKind.EqualsToken;
      const logicalAssignment =
        operator === ts.SyntaxKind.AmpersandAmpersandEqualsToken ||
        operator === ts.SyntaxKind.BarBarEqualsToken ||
        operator === ts.SyntaxKind.QuestionQuestionEqualsToken;
      // Evaluate LHS receiver/key effects before reading its old value or
      // proving logical assignment short-circuit behavior.
      visit(node.left, current);
      const base = unwrap(ownerOf(node.left) ?? node.left);
      const member = memberNameOf(node.left);
      const previousState = logicalAssignment ? readState(node.left, current) : null;
      // Legacy coverage can name a read before its table proves that member
      // exists. Only actual local/source handles or table members are truthy.
      const knownStateHandle =
        previousState !== null &&
        previousState.length > 0 &&
        previousState.every(
          (state) =>
            state === 'local' ||
            'exposedLocal' in state ||
            state.provenance !== undefined ||
            loweredHookStates(state.hook)?.has(state.state) === true
        );
      if (
        knownStateHandle &&
        (operator === ts.SyntaxKind.BarBarEqualsToken ||
          operator === ts.SyntaxKind.QuestionQuestionEqualsToken)
      ) {
        // A state handle is truthy and non-nullish, so neither operator runs
        // its RHS or changes the member.
        return;
      }
      const writesRight =
        plainAssignment ||
        (operator === ts.SyntaxKind.AmpersandAmpersandEqualsToken && knownStateHandle);
      const targets =
        ts.isIdentifier(base) || ts.isConditionalExpression(base)
          ? containerBindings(base, current)
          : [];
      const receivers = targets.map((target) => {
        const receiver = target.scope.bindings.get(target.name);
        return {
          target,
          receiver,
          aliases: receiver?.kind === 'token' ? tokenAliases(target, current) : [],
        };
      });
      // A nested receiver is an object inside a binding's source graph, not a
      // new binding named after the member expression. Capture it before RHS
      // writes can rebind the root or replace that nested object.
      const sourceReceiverValues = (expression: ts.Node): HookSourceValue[] => {
        const value = unwrap(expression);
        if (ts.isConditionalExpression(value)) {
          return [
            ...sourceReceiverValues(value.whenTrue),
            ...sourceReceiverValues(value.whenFalse),
          ];
        }
        return sourceResolveCandidates(value, current)
          .filter((candidate) => candidate.matched && candidate.value.kind === 'object')
          .map((candidate) => candidate.value);
      };
      const sourceReceivers = [...new Set(sourceReceiverValues(base))];
      const definitelyRunsRight =
        operator === ts.SyntaxKind.AmpersandAmpersandEqualsToken && knownStateHandle;
      if (definitelyRunsRight) definitelyReachedLogicalAssignments.add(node);
      try {
        visit(node.right, current);
      } finally {
        if (definitelyRunsRight) definitelyReachedLogicalAssignments.delete(node);
      }
      if (writesRight) rememberSourceStateHooks(node.right, current);
      // The write lands on the container, and the versions of one container
      // are that container, so the write reaches every version the container
      // may hold now. The set of versions is taken before any of them is
      // written: a version written twice would be published twice, and the
      // second publication would add another graph the container may hold -
      // the same write would then grow the container it was applied to.
      const held = new Set<HookSourceValue>();
      const owners = new Map<HookSourceValue, Scope | null>();
      for (const receiver of sourceReceivers) {
        const owning = sourceOwnerScope(current, receiver);
        for (const version of current.versions.versions(receiver)) {
          if (held.has(version)) continue;
          held.add(version);
          owners.set(version, owning);
        }
      }
      // The candidates of one container are that container, so the write
      // reaches all of them together. Only candidates of different
      // containers are written one at a time, so the others keep the members
      // they held.
      const first = sourceReceivers[0];
      const oneContainer =
        first !== undefined &&
        sourceReceivers.every((receiver) => current.versions.sameContainer(receiver, first));
      const right = writesRight ? sourceResolve(node.right, current) : null;
      const replacement: HookSourceValue = right?.matched
        ? right.value
        : { kind: 'unknown', reason: 'unresolved member write' };
      for (const value of held) {
        if (value.kind !== 'object') continue;
        const owning = owners.get(value) ?? null;
        const uncertain =
          isConditionallyReached(node, definitelyReachedLogicalAssignments) ||
          isDeferredWrite(node, enclosingFunction(owning?.node ?? null)) ||
          // Only one of several containers is written, so the others keep the
          // members they held.
          !oneContainer ||
          (logicalAssignment && !knownStateHandle) ||
          member === null;
        const members = new Map(value.members);
        const keys = member === null ? [...members.keys()] : [member];
        // A write that leaves the member as it is does not give the container
        // a new graph: the container holds the graph it held. Two writes to
        // the same member with the same value therefore leave one graph
        // between them, and the graphs the container may hold stay as many as
        // the distinct graphs it may hold.
        if (keys.every((key) => members.get(key) === replacement)) continue;
        for (const key of keys) members.set(key, replacement);
        // The graph the write replaced is kept as it is, so a write that may
        // not have run leaves the container holding a version the tracker
        // knows. A copy of it would be a graph nothing else can reach.
        publishSourceGraph(current, value, { ...value, members }, uncertain);
      }
      if (receivers.length > 0) {
        // An alias of the container is the same object, so the write lands on
        // the binding that actually holds the literal — on each of them when
        // the base may be either of two objects.
        for (const { target, receiver, aliases } of receivers) {
          if (!receiver) continue;
          // The declaring scope, not this one: inside a callback the write
          // would otherwise be compared against itself and always look ordered.
          const uncertain =
            isConditionallyReached(node, definitelyReachedLogicalAssignments) ||
            isDeferredWrite(node, enclosingFunction(target.scope.node)) ||
            targets.length > 1 ||
            (logicalAssignment && !knownStateHandle) ||
            member === null;
          if (receiver.kind === 'handleBag' && receiver.sourceValue?.kind === 'object') {
            // Already published through the captured source receivers above.
            continue;
          }
          const currentContainer = target.scope.bindings.get(target.name);
          if (
            receiver.kind === 'token' &&
            (!currentContainer ||
              currentContainer.kind !== 'token' ||
              currentContainer.initializer !== receiver.initializer)
          ) {
            // The evaluated token container was rebound during the RHS. Do not
            // apply its result to the new receiver; invalidate the member on
            // still-live aliases whose origin cannot be followed exactly.
            for (const alias of aliases) {
              const held = alias.scope.bindings.get(alias.name);
              if (
                held?.kind !== 'token' ||
                held.initializer !== alias.initializer ||
                held.bindingNode !== alias.bindingNode
              )
                continue;
              const keys =
                member === null
                  ? [
                      ...new Set([
                        ...(held.members?.keys() ?? []),
                        ...containerKeys(held.initializer, alias.scope),
                      ]),
                    ]
                  : [member];
              const members = new Map(held.members ?? []);
              for (const key of keys) {
                const previous =
                  held.members?.get(key) ?? containerMembers(held.initializer, key, alias.scope);
                members.set(key, [node, ...(uncertain ? previous : [])]);
              }
              declare(alias.scope, alias.name, { ...held, members });
            }
            continue;
          }
          const container =
            receiver.kind === 'token' && currentContainer?.kind === 'token'
              ? currentContainer
              : receiver;
          if (container.kind !== 'token') continue;
          const keys =
            member === null
              ? [
                  ...new Set([
                    ...(container.members?.keys() ?? []),
                    ...containerKeys(container.initializer, current),
                  ]),
                ]
              : [member];
          const members = new Map(container.members ?? []);
          for (const key of keys) {
            // Before the first write the member still lives in the declaration —
            // or in a container this one replaced but may not have.
            const previous =
              container.members?.get(key) ??
              [container.initializer, ...(container.alternates ?? [])].flatMap((held) =>
                containerMembers(held, key, current)
              );
            members.set(key, [writesRight ? node.right : node, ...(uncertain ? previous : [])]);
          }
          declare(target.scope, target.name, { ...container, members });
        }
      }
      return;
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      (ts.isObjectLiteralExpression(unwrap(node.left)) ||
        ts.isArrayLiteralExpression(unwrap(node.left)))
    ) {
      visit(node.right, current);
      const invalidatePattern = (target: ts.Node): void => {
        const value = unwrap(target);
        if (ts.isObjectLiteralExpression(value)) {
          for (const property of value.properties) {
            if (ts.isPropertyAssignment(property)) invalidatePattern(property.initializer);
            else if (ts.isShorthandPropertyAssignment(property)) invalidatePattern(property.name);
            else if (ts.isSpreadAssignment(property)) invalidatePattern(property.expression);
          }
        } else if (ts.isArrayLiteralExpression(value)) {
          for (const element of value.elements) invalidatePattern(element);
        } else if (ts.isSpreadElement(value)) invalidatePattern(value.expression);
        else if (
          ts.isBinaryExpression(value) &&
          value.operatorToken.kind === ts.SyntaxKind.EqualsToken
        )
          invalidatePattern(value.left);
        else if (ts.isIdentifier(value)) {
          const owner = scopeBinding(current, value.text) ?? current;
          declare(owner, value.text, { kind: 'opaque', sourceAuthority: true });
        } else if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) {
          visit(value, current);
          const key = memberNameOf(value);
          const owner = ownerOf(value);
          if (!owner) return;
          for (const candidate of sourceResolveCandidates(owner, current)) {
            if (candidate.value.kind !== 'object') continue;
            const members = new Map(candidate.value.members);
            for (const member of key === null ? [...members.keys()] : [key])
              members.set(member, { kind: 'unknown', reason: 'destructured member write' });
            publishSourceGraph(current, candidate.value, { ...candidate.value, members }, false);
          }
        }
      };
      invalidatePattern(node.left);
      return;
    }

    if (
      ts.isBinaryExpression(node) &&
      ts.isIdentifier(node.left) &&
      (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandEqualsToken ||
        node.operatorToken.kind === ts.SyntaxKind.BarBarEqualsToken ||
        node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionEqualsToken)
    ) {
      const states = readState(node.left, current);
      const knownHandle =
        states !== null &&
        states.length > 0 &&
        states.every(
          (state) =>
            state === 'local' ||
            'exposedLocal' in state ||
            state.provenance !== undefined ||
            loweredHookStates(state.hook)?.has(state.state) === true
        );
      if (knownHandle && node.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandEqualsToken)
        return;
      const owner = scopeBinding(current, node.left.text) ?? current;
      if (knownHandle) definitelyReachedLogicalAssignments.add(node);
      try {
        visit(node.right, current);
        if (knownHandle)
          declareConditionally(owner, node.left.text, node.left, current, node.right);
        else declare(owner, node.left.text, { kind: 'opaque', sourceAuthority: true });
      } finally {
        if (knownHandle) definitelyReachedLogicalAssignments.delete(node);
      }
      return;
    }

    // A reassignment moves the handle for every read that follows it.
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      const name = node.left.text;
      const owner = scopeBinding(current, name) ?? current;
      const replaced = owner.bindings.get(name);
      declareConditionally(owner, name, node.left, current, node.right);
      const next = owner.bindings.get(name);
      const uncertain =
        isConditionallyReached(node, definitelyReachedLogicalAssignments) ||
        isDeferredWrite(node, enclosingFunction(owner.node));
      if (uncertain && replaced?.kind === 'token' && next?.kind === 'token') {
        // Members written into the replaced container are candidates too; its
        // initializer alone does not carry them.
        const members = new Map(next.members ?? []);
        for (const [key, held] of replaced.members ?? []) {
          const kept = members.get(key) ?? containerMembers(next.initializer, key, current);
          members.set(key, [...kept, ...held]);
        }
        declare(owner, name, {
          ...next,
          ...(members.size > 0 ? { members } : {}),
          alternates: [
            ...(next.alternates ?? []),
            replaced.initializer,
            ...(replaced.alternates ?? []),
          ],
        });
      }
    }

    if (
      ts.isCallExpression(node) &&
      ((ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'rule') ||
        (ts.isElementAccessExpression(node.expression) &&
          node.expression.argumentExpression &&
          ts.isStringLiteralLike(node.expression.argumentExpression) &&
          node.expression.argumentExpression.text === 'rule')) &&
      node.arguments.length >= 1
    ) {
      const spec = unwrap(node.arguments[0]);
      // The production walk matches a property access only, so `def['rule'](…)`
      // reaches the same runtime API and emits no variant. It is a blind spot
      // whatever the argument looks like.
      const viaElementAccess = ts.isElementAccessExpression(node.expression);
      if (!viaElementAccess && ts.isObjectLiteralExpression(spec)) analyzeRule(spec, current);
      // The extractor reads an object literal only. A rule handed a binding is
      // lowered by the runtime and dropped by the extractor, so it is a blind
      // spot rather than something to skip.
      else unresolved.push({ expression: node.getText(source), reason: 'spec' });
    }

    if (ts.isCallExpression(node)) {
      // The callee and the arguments are evaluated in order, and the call
      // receives the objects its arguments denoted while they were evaluated.
      visit(node.expression, current);
      const mutation = hookSourceCallMutation(node);
      // The receiver is evaluated before the arguments, so the container it
      // denotes is captured before they are visited: a later argument that
      // rebinds the name does not move the mutation onto the container the
      // name holds afterwards.
      const receiver = receiverContainerValues(node, current);
      // The callee is evaluated before the arguments as well, so the proof
      // that it reads the receiver it is called on is captured before they
      // are visited: a later argument that rebinds a name cannot change what
      // the callee denoted. The proof reads the member from the graph the
      // receiver holds now, so a member a write replaced is not exempt.
      const readsOnly = provenAccessorCallee(node, current, receiver);
      const captured: CapturedArgument[] = [];
      for (const argument of node.arguments) {
        captured.push(
          captureArgument(
            argument,
            current,
            mutation.kind === 'copy' && mutation.sources.includes(captured.length)
          )
        );
        visit(argument, current);
      }
      applyCallMutation(node, current, captured, receiver, readsOnly);
      return;
    }

    ts.forEachChild(node, (child) => visit(child, current));
  };

  const rootScope: Scope = {
    parent: null,
    bindings: new Map(),
    node: source,
    sourceSummary,
    versions: createSourceGraphVersionTracker(),
  };
  declareImports(rootScope);
  visit(source, rootScope);

  return { usages, unresolved, exposedLocals };
}
