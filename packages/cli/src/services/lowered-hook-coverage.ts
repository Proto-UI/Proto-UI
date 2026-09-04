import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

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

type LocalStateBinding = { kind: 'localState'; declaredAs: string | null; exposedAs?: string };

type Binding =
  | { kind: 'hookResult'; hook: string }
  | { kind: 'handleBag'; hook: string }
  | { kind: 'handle'; hook: string; state: string }
  /** `def.state.bool(...)` — owned by the prototype, not borrowed from a hook. */
  | (LocalStateBinding & {
      /** Handles the name may still hold because a write may be skipped. */
      alternatives?: LocalStateBinding[];
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
    }
  /** A named import; only a relative one is something the extractor follows. */
  | { kind: 'tokenImport'; specifier: string; imported: string; from?: string }
  /** A parameter: it shadows an outer name and its origin is not recoverable. */
  | { kind: 'opaque' };

type Scope = {
  parent: Scope | null;
  bindings: Map<string, Binding>;
  /** The node that created this scope, used to resolve exposures lexically. */
  node: ts.Node | null;
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
function isConditionallyReached(node: ts.Node): boolean {
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
        operator === ts.SyntaxKind.QuestionQuestionToken;
      if (shortCircuits && child === parent.right) return true;
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
  fileName = 'source.proto.ts'
): RuleStateScan {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const usages: HookStateUsage[] = [];
  const unresolved: UnresolvedStateRead[] = [];
  const exposedLocals: ExposedLocalUsage[] = [];

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

  const exposedKeys = new Map<ts.Node, Map<string, string>>();
  type AliasEdge = {
    owner: ts.Node;
    name: string;
    target: string;
    at: number;
    conditional: boolean;
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
  type MemberEdge = { target: string; at: number; conditional: boolean };
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
    target: string,
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
  const memberTargetName = (
    initializer: ts.Node,
    key: string,
    chain: ts.Node[],
    at: number
  ): { target: string; at: number } | null => {
    const value = unwrap(initializer);
    if (ts.isObjectLiteralExpression(value)) {
      for (const property of value.properties) {
        if (ts.isShorthandPropertyAssignment(property) && property.name.text === key) {
          return { target: key, at };
        }
        if (
          ts.isPropertyAssignment(property) &&
          (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) &&
          property.name.text === key
        ) {
          const assigned = unwrap(property.initializer);
          return ts.isIdentifier(assigned) ? { target: assigned.text, at } : null;
        }
      }
      return null;
    }
    if (!ts.isIdentifier(value)) return null;
    const [container] = containerRoots(value.text, chain, at);
    for (const scope of chain) {
      const members = objectMembers.get(scope)?.get(container);
      if (!members) continue;
      const edges = members.get(key);
      if (!edges) return null;
      const visible = visibleEdges(edges, at);
      // A pattern binds one name, so several candidates leave it ambiguous.
      return visible.length === 1 ? { target: visible[0].target, at: visible[0].at } : null;
    }
    return null;
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
  ): Array<{ name: string; target: string; at: number }> => {
    const out: Array<{ name: string; target: string; at: number }> = [];
    if (ts.isObjectBindingPattern(name)) {
      for (const element of name.elements) {
        if (!ts.isIdentifier(element.name) || element.dotDotDotToken) continue;
        const property = element.propertyName ?? element.name;
        const key =
          ts.isIdentifier(property) || ts.isStringLiteralLike(property) ? property.text : null;
        if (!key) continue;
        const resolved = memberTargetName(initializer, key, chain, at);
        if (resolved) out.push({ name: element.name.text, ...resolved });
      }
      return out;
    }
    if (!ts.isArrayBindingPattern(name)) return out;
    const values = unwrap(initializer);
    if (!ts.isArrayLiteralExpression(values)) return out;
    name.elements.forEach((element, index) => {
      if (ts.isOmittedExpression(element)) return;
      if (!ts.isIdentifier(element.name) || element.dotDotDotToken) return;
      const value = values.elements[index] && unwrap(values.elements[index]);
      if (value && ts.isIdentifier(value)) {
        out.push({ name: element.name.text, target: value.text, at });
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
  ): Array<{ name: string; at: number }> => {
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
          out.push(...visibleEdges(edges, at).map((edge) => ({ name: edge.target, at: edge.at })));
        }
        break;
      }
    }
    return out;
  };
  const rawExposures: Array<{
    handles: Array<{ name: string; at: number }>;
    key: ts.Expression;
    chain: ts.Node[];
  }> = [];

  const memberNamed = (node: ts.Node, name: string): boolean => {
    const target = unwrap(node);
    if (ts.isPropertyAccessExpression(target)) return target.name.text === name;
    if (ts.isElementAccessExpression(target)) {
      const argument = target.argumentExpression;
      return Boolean(argument) && ts.isStringLiteralLike(argument) && argument.text === name;
    }
    return false;
  };

  const ownerOf = (node: ts.Node): ts.Node | null => {
    const target = unwrap(node);
    return ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)
      ? target.expression
      : null;
  };

  /** The member a `x.name` or `x['name']` write names, if it is static. */
  const memberNameOf = (node: ts.Node): string | null => {
    const target = unwrap(node);
    if (ts.isPropertyAccessExpression(target)) return target.name.text;
    if (ts.isElementAccessExpression(target)) {
      const argument = target.argumentExpression;
      return argument && ts.isStringLiteralLike(argument) ? argument.text : null;
    }
    return null;
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
          chain: [...nextChain, source],
          node,
        });
      }
    }
    // Writing through the container moves the handle the same way, so the
    // member the exposure reads is the one assigned last before it.
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left))
    ) {
      const base = unwrap(ownerOf(node.left) ?? node.left);
      const member = memberNameOf(node.left);
      if (ts.isIdentifier(base)) {
        const chain = [...nextChain, source];
        const at = node.getStart();
        const containers = containerRoots(base.text, chain, at);
        const declaring =
          chain.find((candidate) => declaredIn.get(candidate)?.has(containers[0])) ?? null;
        const conditional =
          isConditionallyReached(node) ||
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
            for (const target of aliasTargets(node.right)) {
              recordMember(memberOwnerScope, container, key, target, at, conditional);
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
  ): Array<{ name: string; chain: ts.Node[] }> => {
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
    return found.flatMap((edge) => aliasRoots(edge.target, edge.chain ?? chain, edge.at, next));
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
      { name: handle.name, chain },
      ...aliasRoots(handle.name, chain, handle.at),
    ]);
    const seen = new Set<string>();
    for (const entry of named) {
      const owner = declaringScope(entry.name, entry.chain);
      if (!owner) continue;
      const identity = `${entry.name}\u0000${owner.pos}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      const scoped = exposedKeys.get(owner) ?? new Map<string, string>();
      if (!scoped.has(entry.name)) scoped.set(entry.name, text);
      exposedKeys.set(owner, scoped);
    }
  }

  /** The exposure visible from a scope chain, nearest scope first. */
  const exposureFor = (name: string, scope: Scope): string | undefined => {
    for (let current: Scope | null = scope; current; current = current.parent) {
      if (!current.node) continue;
      const scoped = exposedKeys.get(current.node);
      const found = scoped?.get(name);
      if (found !== undefined) return found;
    }
    return undefined;
  };

  const hookOfCall = (node: ts.Node): string | null => {
    const call = unwrap(node);
    if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) return null;
    const name = call.expression.text;
    return name.startsWith('as') ? name : null;
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
      return binding?.kind === 'hookResult' ? binding.hook : null;
    }
    return hookOfCall(owner);
  };

  const declare = (scope: Scope, name: string, binding: Binding): void => {
    scope.bindings.set(name, binding);
  };

  /**
   * A write the source may skip leaves the name on either handle, and the
   * runtime lowers whichever it holds, so a conditional reassignment keeps the
   * binding it replaces as an alternative instead of discarding it.
   */
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
      isConditionallyReached(initializer.parent) ||
      isDeferredWrite(initializer, enclosingFunction(scope.node));
    if (!uncertain || !previous || !next) return;
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
    if (ts.isConditionalExpression(chosen) && ts.isIdentifier(name)) {
      // Each branch is bound into a throwaway scope so this reads exactly what
      // the same expression would name on its own.
      const branches = [chosen.whenTrue, chosen.whenFalse].map((branch) => {
        const probe: Scope = { parent: lookupScope, bindings: new Map(), node: lookupScope.node };
        declareValue(name, branch, probe, lookupScope);
        return probe.bindings.get(name.text);
      });
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
        declare(scope, name.text, {
          ...head,
          exposedAs: exposureFor(name.text, scope) ?? head.exposedAs,
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

    const hook = hookOfCall(initializer);
    if (hook && ts.isIdentifier(name)) {
      declare(scope, name.text, { kind: 'hookResult', hook });
      return;
    }

    // `let current = first` names the same handle `first` does, and production
    // resolves the alias, so a rule reading the alias is not a blind spot.
    if (ts.isIdentifier(value) && ts.isIdentifier(name)) {
      const aliased = lookup(lookupScope, value.text);
      if (aliased && aliased.kind !== 'token' && aliased.kind !== 'tokenImport') {
        declare(
          scope,
          name.text,
          aliased.kind === 'localState'
            ? { ...aliased, exposedAs: exposureFor(name.text, scope) ?? aliased.exposedAs }
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
      });
    }
  };

  const declareImports = (scope: Scope): void => {
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      if (!ts.isStringLiteralLike(statement.moduleSpecifier)) continue;
      const bindings = statement.importClause?.namedBindings;
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
    if (ts.isIdentifier(argument)) {
      const binding = lookup(scope, argument.text);
      if (binding?.kind === 'handle') return [{ hook: binding.hook, state: binding.state }];
      if (binding?.kind === 'localState') {
        const reads = [binding, ...(binding.alternatives ?? [])].map((candidate) =>
          localStateRead(candidate, argument.text)
        );
        return reads.some((read) => read === null) ? null : (reads as StateRead[]);
      }
      return null;
    }
    if (ts.isPropertyAccessExpression(argument) || ts.isElementAccessExpression(argument)) {
      if (ts.isPropertyAccessExpression(argument)) {
        const owner = bagHook(argument.expression, scope);
        if (owner) return [{ hook: owner, state: argument.name.text }];
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
    if (!owner || held?.kind !== 'token') return [];
    const initializer = unwrap(held.initializer);
    if (ts.isIdentifier(initializer) || ts.isConditionalExpression(initializer)) {
      const next = containerBindings(initializer, scope, new Set([...seen, value.text]));
      if (next.length > 0) return next;
    }
    return [{ scope: owner, name: value.text }];
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

  /**
   * The extractor's `resolveStateEqVariant` lowers exactly three right-hand
   * sides: the two boolean keywords, and a string literal whose text is a legal
   * data-attribute value. `null` means the extractor produces no variant, which
   * the scanner reports rather than reading as covered.
   */
  const comparisonOf = (node: ts.Expression | undefined): 'positive' | 'negative' | null => {
    if (!node) return null;
    if (node.kind === ts.SyntaxKind.TrueKeyword) return 'positive';
    if (node.kind === ts.SyntaxKind.FalseKeyword) return 'negative';
    if (ts.isStringLiteralLike(node) && /^[a-zA-Z0-9_-]+$/.test(node.text)) return 'positive';
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
    const scope: Scope = { parent: null, bindings: new Map(), node: null };
    // Insert before filling so a cycle of relative modules terminates.
    moduleScopes.set(module, scope);
    for (const statement of module.statements) {
      if (ts.isImportDeclaration(statement) && ts.isStringLiteralLike(statement.moduleSpecifier)) {
        const named = statement.importClause?.namedBindings;
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
      if (binding?.kind === 'token')
        return resolvableTokenArgument(binding.initializer, scope, next);
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
        !ts.isCallExpression(call) ||
        !ts.isIdentifier(call.expression) ||
        call.expression.text !== 'tw'
      ) {
        // A pre-bound handle gives `collectTwTokens` no call to read.
        return false;
      }
      return (
        call.arguments.length > 0 &&
        call.arguments.every((argument) => resolvableTokenArgument(argument, scope))
      );
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
              comparison: comparisonOf(node.arguments[0]),
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

  const visit = (node: ts.Node, scope: Scope): void => {
    const current = introducesScope(node)
      ? { parent: scope, bindings: new Map<string, Binding>(), node }
      : scope;

    // A parameter shadows whatever the enclosing scopes bound to that name. Its
    // own origin cannot be recovered from the source, so it resolves to nothing
    // rather than falling through to an outer handle of the same name.
    if (ts.isFunctionLike(node)) {
      for (const parameter of node.parameters) {
        if (ts.isIdentifier(parameter.name))
          declare(current, parameter.name.text, { kind: 'opaque' });
      }
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
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left))
    ) {
      const base = unwrap(ownerOf(node.left) ?? node.left);
      const member = memberNameOf(node.left);
      if (ts.isIdentifier(base) || ts.isConditionalExpression(base)) {
        // An alias of the container is the same object, so the write lands on
        // the binding that actually holds the literal — on each of them when
        // the base may be either of two objects.
        const targets = containerBindings(base, current);
        for (const target of targets) {
          const container = target.scope.bindings.get(target.name);
          if (container?.kind !== 'token') continue;
          // The declaring scope, not this one: inside a callback the write
          // would otherwise be compared against itself and always look ordered.
          const uncertain =
            isConditionallyReached(node) ||
            isDeferredWrite(node, enclosingFunction(target.scope.node)) ||
            targets.length > 1 ||
            member === null;
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
            members.set(key, [node.right, ...(uncertain ? previous : [])]);
          }
          declare(target.scope, target.name, { ...container, members });
        }
      }
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
        isConditionallyReached(node) || isDeferredWrite(node, enclosingFunction(owner.node));
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

    ts.forEachChild(node, (child) => visit(child, current));
  };

  const rootScope: Scope = { parent: null, bindings: new Map(), node: source };
  declareImports(rootScope);
  visit(source, rootScope);

  return { usages, unresolved, exposedLocals };
}
