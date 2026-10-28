import ts from 'typescript';
import {
  createHookSourceModuleContext,
  type HookSourceModule as Module,
  type HookSourceSymbol as SymbolRef,
} from './hook-source-module.js';

/** The source identity of an authored declaration. */
export type HookSourceRef = { file: string; start: number };

/** A state declaration is kept distinct from the public member which reached it. */
export type HookSourceState = {
  owner: HookSourceRef;
  declaration: HookSourceRef;
  declaredName: string;
  variant: string | null;
  /** Runtime State semantic, when a provider source proves it separately. */
  semantic?: string;
};

export type HookSourceValue =
  | { kind: 'state'; state: HookSourceState }
  | {
      kind: 'object';
      members: ReadonlyMap<string, HookSourceValue>;
      uncertainKeys?: boolean;
      arrayLength?: number;
      closed?: boolean;
    }
  | {
      kind: 'result';
      producer: HookSourceRef;
      name: string | null;
      stateHandles: ReadonlyMap<string, HookSourceState>;
      children: ReadonlyMap<string, HookSourceValue>;
      handle?: HookSourceValue;
      stateHandlesClosed?: boolean;
    }
  | {
      kind: 'callable';
      operation: 'getState';
      result: Extract<HookSourceValue, { kind: 'result' }>;
    }
  | { kind: 'unknown'; reason: string };

export type HookSourceResolution = {
  /** True when the expression was an imported/local authored producer or its member. */
  matched: boolean;
  value: HookSourceValue;
  /** Winning producer binding when a named cache replaces the syntactic caller. */
  hook?: string;
};

export type HookSourceSummaryContext = {
  /** Register an already-read source, preserving caller-provided text exactly. */
  registerSource(source: ts.SourceFile): void;
  /** Resolve a source expression without executing it. */
  resolve(
    node: ts.Node,
    source: ts.SourceFile,
    environment?: ReadonlyMap<string, HookSourceValue>
  ): HookSourceResolution;
  /** Resolve an authored producer call and its captured result. */
  resolveCall(node: ts.CallExpression, source: ts.SourceFile): HookSourceResolution;
  /** Recognize the authored producer independently of its capture/projection proof. */
  isAuthoredProducerCall(node: ts.CallExpression, source: ts.SourceFile): boolean;
  /**
   * Prove that a function is an authored setup: the `setup` member of a
   * configuration object literal that a canonical Core factory receives.
   *
   * The factory is admitted through the module context, so a factory imported
   * under another name still counts and a local name that merely spells it
   * does not.
   */
  isAuthoredSetup(node: ts.Node, source: ts.SourceFile): boolean;
  /** Verify the actual lexical producer declaration, not a same-named shadow. */
  isSameSourceBinding(
    node: ts.CallExpression,
    source: ts.SourceFile,
    bindingNode: ts.Node
  ): boolean;
};

type Producer = {
  ref: HookSourceRef;
  module: Module;
  declaration: ts.Node;
  call: ts.CallExpression;
  config: ts.ObjectLiteralExpression;
};

type ProviderStateProof = {
  owner: HookSourceRef;
  declaredName: string;
  semantic: string;
  declaration: HookSourceRef;
};

type SetupLiteral = string | boolean | number;

/**
 * The lexical environment of a projector body. A `var` declaration belongs to
 * the function, so it survives every nested block, while `let` and `const`
 * belong to the block that declares them and shadow an outer name only inside
 * that block.
 */
type ProjectorScope = {
  /** The bindings visible at this point, by name. */
  visible: Map<string, HookSourceValue>;
  /**
   * The block scopes open at this point, outermost first. Each one records the
   * names it shadows, mapped to the binding each name had before it. A name
   * that was not bound before the block is recorded as `undefined`.
   */
  readonly blocks: Map<string, HookSourceValue | undefined>[];
};

/**
 * A branch of a conditional starts from the bindings visible before it, so a
 * name it declares cannot reach the other branch.
 */
const forkProjectorScope = (scope: ProjectorScope): ProjectorScope => ({
  visible: new Map(scope.visible),
  blocks: scope.blocks.map((frame) => new Map(frame)),
});

/**
 * The bindings a surviving branch leaves behind replace the ones before it. A
 * `var` update in the branch is the function-scoped binding the code after the
 * branch reads.
 */
const adoptProjectorScope = (scope: ProjectorScope, branch: ProjectorScope): void => {
  scope.visible.clear();
  for (const [name, value] of branch.visible) scope.visible.set(name, value);
};

function shadowProjectorName(scope: ProjectorScope, name: string, value: HookSourceValue): void {
  const frame = scope.blocks[scope.blocks.length - 1];
  if (frame && !frame.has(name)) frame.set(name, scope.visible.get(name));
  scope.visible.set(name, value);
}

function predeclareProjectorBinding(
  scope: ProjectorScope,
  name: ts.BindingName,
  value: HookSourceValue
): void {
  if (ts.isIdentifier(name)) {
    shadowProjectorName(scope, name.text, value);
    return;
  }
  for (const element of name.elements) {
    if (!ts.isOmittedExpression(element)) predeclareProjectorBinding(scope, element.name, value);
  }
}

const UNKNOWN = (reason: string): HookSourceValue => ({ kind: 'unknown', reason });

function unwrap(node: ts.Node): ts.Node {
  return ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isSatisfiesExpression(node)
    ? unwrap(node.expression)
    : node;
}

/**
 * How a call may change the source-backed containers it is handed.
 *
 * `copy` — `Object.assign(target, ...sources)` copies the sources' own
 *   enumerable members onto the target, so the members it writes are known.
 * `unknown` — every other call may write to the containers it receives.
 */
export type HookSourceCallMutation =
  | { kind: 'copy'; target: number; sources: number[] }
  | { kind: 'unknown' };

const globalObjectShadow = new WeakMap<ts.SourceFile, boolean>();

/**
 * Whether the source file binds `Object` itself, which would make
 * `Object.assign` an ordinary local call rather than the builtin.
 *
 * Every binding in the file counts, not only the top-level ones: a parameter
 * or a block-scoped `const Object` shadows the builtin for the calls inside
 * that scope, and the file-wide reading fails closed rather than trusting a
 * name heuristic that only looks at one scope.
 */
function shadowsGlobalObject(source: ts.SourceFile): boolean {
  const cached = globalObjectShadow.get(source);
  if (cached !== undefined) return cached;
  let shadowed = false;
  const bindsObject = (name: ts.BindingName): boolean => {
    if (ts.isIdentifier(name)) return name.text === 'Object';
    if (ts.isObjectBindingPattern(name))
      return name.elements.some((element) => bindsObject(element.name));
    return name.elements.some(
      (element) => !ts.isOmittedExpression(element) && bindsObject(element.name)
    );
  };
  const visit = (node: ts.Node): void => {
    if (shadowed) return;
    if (ts.isVariableDeclaration(node) && bindsObject(node.name)) {
      shadowed = true;
      return;
    }
    if (ts.isParameter(node) && bindsObject(node.name)) {
      shadowed = true;
      return;
    }
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'Object') {
      shadowed = true;
      return;
    }
    if (ts.isClassDeclaration(node) && node.name?.text === 'Object') {
      shadowed = true;
      return;
    }
    if (ts.isEnumDeclaration(node) && node.name.text === 'Object') {
      shadowed = true;
      return;
    }
    if (ts.isModuleDeclaration(node) && node.name.text === 'Object') {
      shadowed = true;
      return;
    }
    if (ts.isImportClause(node) && node.name?.text === 'Object') {
      shadowed = true;
      return;
    }
    if (ts.isImportSpecifier(node) && node.name.text === 'Object') {
      shadowed = true;
      return;
    }
    if (ts.isNamespaceImport(node) && node.name.text === 'Object') {
      shadowed = true;
      return;
    }
    if (
      ts.isCatchClause(node) &&
      node.variableDeclaration &&
      bindsObject(node.variableDeclaration.name)
    ) {
      shadowed = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  globalObjectShadow.set(source, shadowed);
  return shadowed;
}

/**
 * The mutation a call may perform on the containers it receives.
 *
 * Only `Object.assign` is a known mutator: it copies the sources' own
 * enumerable members onto the target, so the members it writes are known.
 * Every other call may write anything it is handed, so a container it
 * receives keeps no proof of the members it holds.
 */
export function hookSourceCallMutation(node: ts.CallExpression): HookSourceCallMutation {
  const callee = unwrap(node.expression);
  if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'assign') {
    const owner = unwrap(callee.expression);
    if (
      ts.isIdentifier(owner) &&
      owner.text === 'Object' &&
      !shadowsGlobalObject(node.getSourceFile())
    ) {
      return {
        kind: 'copy',
        target: 0,
        sources: node.arguments.slice(1).map((_, index) => index + 1),
      };
    }
  }
  return { kind: 'unknown' };
}

/**
 * The graph a container holds after a call wrote to it.
 *
 * `copied` — the graphs whose members a known mutating call copied onto the
   container. The container keeps the members the copies do not name.
 * `null` — the write could not be proven, so every member the call could have
   replaced becomes unproven.
 */
export function mutateSourceGraph(
  target: HookSourceValue,
  copied: ReadonlyArray<HookSourceValue> | null
): HookSourceValue {
  if (target.kind !== 'object') return target;
  const members = new Map<string, HookSourceValue>();
  if (copied === null) {
    for (const key of target.members.keys()) {
      members.set(key, UNKNOWN('member possibly replaced by a call'));
    }
    return { kind: 'object', members };
  }
  for (const [key, member] of target.members) members.set(key, member);
  for (const source of copied) {
    if (source.kind !== 'object') continue;
    for (const [key, member] of source.members) members.set(key, member);
  }
  return { kind: 'object', members };
}

/**
 * The newer versions of the containers one owner holds.
 *
 * The tracker is mutable and belongs to the scan that owns those containers.
 * Two owners that read the same producer declaration each run their own setup
 * and therefore hold their own containers, so a replacement one owner made is
 * not visible to the other. The immutable definitions stay in the summary
 * context; only the versions move.
 */
export type SourceGraphVersionTracker = {
  /** Records that a container's graph was replaced by a newer version. */
  record: (before: HookSourceValue, after: HookSourceValue, uncertain: boolean) => void;
  /** The newest version of a captured container graph. */
  latest: (value: HookSourceValue) => HookSourceValue;
  /**
   * Every version the container may hold now.
   *
   * A write that may not have run leaves the graph it replaced in place, so
   * that graph stays one of the versions the container holds, and so does
   * every graph an earlier skipped write left behind. The newest version
   * alone would drop them, and a proof read from the newest version alone
   * would certify a container the runtime may not have written to.
   */
  versions: (value: HookSourceValue) => HookSourceValue[];
  /**
   * Whether two graphs belong to the same container.
   *
   * The container a graph belongs to does not change when the graph is
   * replaced: a retired representation still answers for the container it
   * belonged to. So the question is answered by the container, not by whether
   * a graph is among the ones the container holds now.
   */
  sameContainer: (left: HookSourceValue, right: HookSourceValue) => boolean;
};

/**
 * The lineage of one container.
 *
 * Every graph the container's lineage passed through maps to the same cell,
 * so a later write cannot disconnect the graphs an earlier one replaced: the
 * cell answers for the container no matter which of its graphs a caller
 * captured.
 */
type SourceGraphCell = {
  /** Every graph the container may hold now. */
  current: Set<HookSourceValue>;
  /** Every graph that maps to this cell, so a merge can re-point them. */
  members: Set<HookSourceValue>;
};

export function createSourceGraphVersionTracker(): SourceGraphVersionTracker {
  const cells = new WeakMap<HookSourceValue, SourceGraphCell>();
  const cellFor = (value: HookSourceValue): SourceGraphCell => {
    const existing = cells.get(value);
    if (existing) return existing;
    const cell: SourceGraphCell = { current: new Set([value]), members: new Set([value]) };
    cells.set(value, cell);
    return cell;
  };
  const merge = (target: SourceGraphCell, other: SourceGraphCell): void => {
    for (const version of other.current) target.current.add(version);
    for (const member of other.members) {
      target.members.add(member);
      cells.set(member, target);
    }
  };
  /**
   * Whether two source graphs are the same graph.
   *
   * The members are compared by identity and the comparison does not descend
   * into them, so a nested container keeps its own identity: two separately
   * allocated children with the same shape are two containers, and a write to
   * one of them does not reach the other. An unknown member holds no object, so
   * two unknown members with the same reason are the same member for every
   * proof read from the graph. A callable is an immutable capture, so its
   * identity is its own and it compares like any other member.
   *
   * The array length is part of the comparison: a spread array computes the
   * offsets of the members that follow it, and a positional array is read by
   * its position, so two graphs that differ only in their length are not the
   * same graph for either.
   */
  const sameGraph = (left: HookSourceValue, right: HookSourceValue): boolean => {
    if (left === right) return true;
    if (left.kind !== right.kind) return false;
    if (left.kind === 'object' && right.kind === 'object') {
      if (left.members.size !== right.members.size) return false;
      if (left.uncertainKeys !== right.uncertainKeys) return false;
      if (left.closed !== right.closed) return false;
      if (left.arrayLength !== right.arrayLength) return false;
      for (const [key, member] of left.members) {
        const other = right.members.get(key);
        if (other === undefined) return false;
        if (member === other) continue;
        if (
          member.kind === 'unknown' &&
          other.kind === 'unknown' &&
          member.reason === other.reason
        ) {
          continue;
        }
        return false;
      }
      return true;
    }
    return false;
  };
  /**
   * The graph the container holds now that is the same graph as `value`.
   *
   * Only the graphs of this container are compared, so a graph of another
   * container is never taken for one of them. A write that rebuilt a graph
   * the container may already hold did not give the container a new graph to
   * hold, and without this the graphs the container may hold grow with every
   * write that rebuilt one of them, so every proof read from the container
   * pays for the copies.
   */
  const canonicalVersion = (cell: SourceGraphCell, value: HookSourceValue): HookSourceValue => {
    for (const version of cell.current) {
      if (version !== value && sameGraph(version, value)) return version;
    }
    return value;
  };
  return {
    record: (before, after, uncertain) => {
      if (before === after) return;
      const cell = cellFor(before);
      const canonical = canonicalVersion(cell, after);
      // The new graph joins the cell the replaced graph belongs to, so the
      // whole lineage keeps answering for the same container.
      const other = cells.get(after);
      if (other && other !== cell) merge(cell, other);
      cells.set(after, cell);
      cell.members.add(after);
      // A write to a graph the container may not hold cannot add a version to
      // it: the container holds the graph the write was written to, and this
      // graph is not one of them. The lineage is still recorded, so a caller
      // that captured this graph reaches the same cell.
      if (!cell.current.has(before)) return;
      if (!uncertain) {
        // The write replaced the graph it wrote to, and left every other
        // version the container may hold alone.
        cell.current.delete(before);
      }
      // A write that may not have run left the graph it replaced in place,
      // so the container may still hold it. The graph the container holds
      // now is the newest one, so a graph that was already among them moves
      // to the end of the order.
      cell.current.delete(canonical);
      cell.current.add(canonical);
    },
    latest: (value) => {
      const cell = cellFor(value);
      let newest = value;
      // The set keeps the order the versions were recorded in, so the last
      // one is the newest.
      for (const version of cell.current) newest = version;
      return newest;
    },
    versions: (value) => {
      return [...cellFor(value).current];
    },
    sameContainer: (left, right) => {
      if (left === right) return true;
      const leftCell = cells.get(left);
      const rightCell = cells.get(right);
      return leftCell !== undefined && leftCell === rightCell;
    },
  };
}

/**
 * Whether every member a graph holds is proven, so copying them is proven.
 *
 * A graph whose member set is uncertain, or which holds an unproven member,
 * stands for an alternative that did not carry that member. Copying it copies
 * nothing there, so the copy is only proven when no alternative differs.
 */
export function sourceMembersProven(value: HookSourceValue): boolean {
  if (value.kind !== 'object') return false;
  if (value.uncertainKeys) return false;
  for (const member of value.members.values()) {
    if (member.kind === 'unknown') return false;
  }
  return true;
}

/**
 * Whether a copy source's states all belong to one producer.
 *
 * The owner of a state is the producer that declared it, so a source that
 * gathers states from several producers copies a different member set on each
 * branch. The copied members cannot be attributed to one producer then, and
 * the copy is not proven.
 */
export function sourceMembersOneProducer(value: HookSourceValue): boolean {
  if (value.kind !== 'object') return false;
  let owner: string | null = null;
  for (const member of value.members.values()) {
    if (member.kind !== 'state') continue;
    const key = `${member.state.owner.file}\u0000${member.state.owner.start}`;
    if (owner === null) owner = key;
    else if (owner !== key) return false;
  }
  return true;
}

function propertyName(name: ts.PropertyName | ts.BindingName | undefined): string | null {
  if (!name) return null;
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)
    ? name.text
    : null;
}

function memberName(node: ts.Node): string | null {
  const value = unwrap(node);
  if (ts.isPropertyAccessExpression(value)) return value.name.text;
  if (ts.isElementAccessExpression(value)) {
    const argument = value.argumentExpression;
    return argument && (ts.isStringLiteralLike(argument) || ts.isNumericLiteral(argument))
      ? argument.text
      : null;
  }
  return null;
}

function memberOwner(node: ts.Node): ts.Node | null {
  const value = unwrap(node);
  return ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)
    ? value.expression
    : null;
}

function sourceRef(node: ts.Node, file = node.getSourceFile().fileName): HookSourceRef {
  return { file, start: node.getStart(node.getSourceFile()) };
}

function isFunctionLike(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return ts.isFunctionLike(node);
}

/**
 * `def.expose.state(key, handle)`. The runtime's named-state collection reads
 * these views from the same capture frame as the raw `def.state` entries, so a
 * read through an exposed state is a genuine named state handle at runtime.
 */
function isExposeStateCall(owner: ts.Expression, defName: string): boolean {
  if (!ts.isPropertyAccessExpression(owner) || owner.name.text !== 'expose') return false;
  const target = unwrap(owner.expression);
  if (!ts.isIdentifier(target) || target.text !== defName) return false;
  return true;
}

function isStringValue(
  node: ts.Node
): node is ts.StringLiteralLike | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

/**
 * The source summary deliberately has no global AST/program cache. A caller
 * gets one context per bounded operation, while parsed modules and producer
 * summaries are shared only inside that operation.
 */
export function createHookSourceSummaryContext(): HookSourceSummaryContext {
  const moduleContext = createHookSourceModuleContext();
  const registeredSources = new Map<string, ts.SourceFile>();
  const producerCache = new Map<string, Producer | null>();
  const summaryCache = new Map<string, HookSourceValue>();
  const summaryStack = new Set<string>();
  const providerStateCache = new Map<string, ReadonlyMap<string, ProviderStateProof> | null>();
  const canonicalFocusableCache = new Map<string, SymbolRef | null>();
  const moduleForSource = (source: ts.SourceFile): Module => {
    const module = moduleContext.moduleForSource(source);
    const previous = registeredSources.get(module.file);
    if (previous && previous !== source) {
      producerCache.clear();
      summaryCache.clear();
      summaryStack.clear();
      providerStateCache.clear();
      canonicalFocusableCache.clear();
    }
    registeredSources.set(module.file, source);
    return module;
  };

  const registerSource = (source: ts.SourceFile): void => {
    moduleForSource(source);
  };

  const resolveSymbol = (module: Module, name: string): SymbolRef | null =>
    moduleContext.resolveLocal(module, name);

  const symbolKey = (symbol: SymbolRef): string =>
    `${symbol.module.file}:${symbol.declaration.getStart(symbol.module.source)}:${symbol.declaration.kind}`;

  // Binding writes are source facts, not properties of a helper invocation.
  const bindingWriteFacts = new WeakMap<
    ts.Node,
    { source: ts.SourceFile; target: ts.Node; written: boolean }
  >();

  /** A source alias is usable only while its exact binding still holds its initializer. */
  const hasBindingWrite = (bindingNode: ts.Node, module: Module): boolean => {
    if (!ts.isIdentifier(bindingNode)) return true;
    const target = moduleContext.resolveReference(bindingNode, module);
    if (!target) return true;
    const cached = bindingWriteFacts.get(bindingNode);
    if (cached?.source === module.source && cached.target === target.declaration)
      return cached.written;
    const targetKey = symbolKey(target);
    const parameter = ts.isParameter(target.declaration)
      ? target.declaration
      : ts.isIdentifier(target.declaration) && ts.isParameter(target.declaration.parent)
        ? target.declaration.parent
        : null;
    const writesBinding = (node: ts.Node, varRedeclaration = false): boolean => {
      const value = unwrap(node);
      if (ts.isIdentifier(value)) {
        if (value.text !== bindingNode.text) return false;
        if (varRedeclaration) return true;
        const written = moduleContext.resolveReference(value, module);
        return written !== null && symbolKey(written) === targetKey;
      }
      if (ts.isVariableDeclarationList(value)) {
        const redeclaresParameter =
          parameter !== null &&
          (value.flags & ts.NodeFlags.BlockScoped) === 0 &&
          ts.findAncestor(value, ts.isFunctionLike) === parameter.parent;
        return value.declarations.some((declaration) =>
          writesBinding(declaration.name, redeclaresParameter)
        );
      }
      if (ts.isBindingElement(value)) return writesBinding(value.name, varRedeclaration);
      if (ts.isArrayBindingPattern(value) || ts.isObjectBindingPattern(value))
        return value.elements.some((element) => writesBinding(element, varRedeclaration));
      if (ts.isArrayLiteralExpression(value))
        return value.elements.some((element) => writesBinding(element, varRedeclaration));
      if (ts.isObjectLiteralExpression(value))
        return value.properties.some((property) =>
          ts.isPropertyAssignment(property)
            ? writesBinding(property.initializer, varRedeclaration)
            : ts.isShorthandPropertyAssignment(property)
              ? writesBinding(property.name, varRedeclaration)
              : ts.isSpreadAssignment(property) &&
                writesBinding(property.expression, varRedeclaration)
        );
      if (ts.isSpreadElement(value)) return writesBinding(value.expression, varRedeclaration);
      return (
        ts.isBinaryExpression(value) &&
        value.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        writesBinding(value.left, varRedeclaration)
      );
    };
    let changed = false;
    const visit = (node: ts.Node): void => {
      if (changed || node === bindingNode) return;
      if (ts.isBinaryExpression(node)) {
        const operator = node.operatorToken.kind;
        const assignment =
          operator >= ts.SyntaxKind.FirstAssignment && operator <= ts.SyntaxKind.LastAssignment;
        if (assignment) changed = writesBinding(node.left);
      }
      if (ts.isForOfStatement(node) || ts.isForInStatement(node)) {
        changed = writesBinding(node.initializer);
      }
      if (
        parameter &&
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        ts.isVariableDeclarationList(node.parent) &&
        (node.parent.flags & ts.NodeFlags.BlockScoped) === 0 &&
        ts.findAncestor(node, ts.isFunctionLike) === parameter.parent
      )
        changed = writesBinding(node.name, true);
      if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
        if (
          node.operator === ts.SyntaxKind.PlusPlusToken ||
          node.operator === ts.SyntaxKind.MinusMinusToken
        )
          changed = writesBinding(node.operand);
      }
      ts.forEachChild(node, visit);
    };
    visit(module.source);
    bindingWriteFacts.set(bindingNode, {
      source: module.source,
      target: target.declaration,
      written: changed,
    });
    return changed;
  };

  const hasIdentifierWrite = (declaration: ts.VariableDeclaration, module: Module): boolean =>
    !ts.isIdentifier(declaration.name) || hasBindingWrite(declaration.name, module);

  const stableVariable = (declaration: ts.VariableDeclaration, module: Module): boolean => {
    const list = declaration.parent;
    return (
      ts.isVariableDeclarationList(list) &&
      (list.flags & ts.NodeFlags.Const) !== 0 &&
      !hasIdentifierWrite(declaration, module)
    );
  };

  const isDefineAsHookCall = (call: ts.CallExpression, module: Module): boolean =>
    moduleContext.isDefineAsHookReference(unwrap(call.expression), module);

  const producerForSymbol = (symbol: SymbolRef, stack = new Set<string>()): Producer | null => {
    const key = `${symbol.module.file}:${symbol.declaration.getStart(symbol.module.source)}`;
    const cached = producerCache.get(key);
    if (cached !== undefined) return cached;
    if (stack.has(key)) return null;
    const nextStack = new Set(stack).add(key);
    let declaration = symbol.declaration;
    if (ts.isVariableDeclaration(declaration)) {
      if (!stableVariable(declaration, symbol.module)) {
        producerCache.set(key, null);
        return null;
      }
      const initializer = declaration.initializer ? unwrap(declaration.initializer) : null;
      if (
        initializer &&
        (ts.isIdentifier(initializer) ||
          ts.isPropertyAccessExpression(initializer) ||
          ts.isElementAccessExpression(initializer))
      ) {
        const alias = moduleContext.resolveReference(initializer, symbol.module);
        if (alias) {
          const found = producerForSymbol(alias, nextStack);
          producerCache.set(key, found);
          return found;
        }
      }
      if (
        initializer &&
        ts.isCallExpression(initializer) &&
        isDefineAsHookCall(initializer, symbol.module)
      ) {
        const config = initializer.arguments[0] ? unwrap(initializer.arguments[0]) : null;
        if (config && ts.isObjectLiteralExpression(config)) {
          const found = {
            ref: sourceRef(declaration, symbol.module.file),
            module: symbol.module,
            declaration,
            call: initializer,
            config,
          };
          producerCache.set(key, found);
          return found;
        }
      }
    }
    if (ts.isCallExpression(declaration) && isDefineAsHookCall(declaration, symbol.module)) {
      const config = declaration.arguments[0] ? unwrap(declaration.arguments[0]) : null;
      if (config && ts.isObjectLiteralExpression(config)) {
        const found = {
          ref: sourceRef(declaration, symbol.module.file),
          module: symbol.module,
          declaration,
          call: declaration,
          config,
        };
        producerCache.set(key, found);
        return found;
      }
    }
    // A declaration may be an exported alias whose symbol points at a source
    // declaration, but never interpret arbitrary functions as producers.
    producerCache.set(key, null);
    return null;
  };

  const producerForCall = (call: ts.CallExpression, source: ts.SourceFile): Producer | null => {
    const callee = unwrap(call.expression);
    const module = moduleForSource(source);
    const symbol = moduleContext.resolveReference(callee, module);
    return symbol ? producerForSymbol(symbol) : null;
  };

  const authoredSetups = new WeakMap<ts.SourceFile, Set<ts.Node>>();
  const isAuthoredSetup = (node: ts.Node, source: ts.SourceFile): boolean => {
    if (!isFunctionLike(node)) return false;
    let setups = authoredSetups.get(source);
    if (!setups) {
      setups = new Set();
      const module = moduleForSource(source);
      const visit = (candidate: ts.Node): void => {
        if (ts.isCallExpression(candidate) && candidate.arguments[0]) {
          const config = unwrap(candidate.arguments[0]);
          if (
            ts.isObjectLiteralExpression(config) &&
            (moduleContext.isDefineAsHookReference(candidate.expression, module) ||
              moduleContext.isDefinePrototypeReference(candidate.expression, module) ||
              moduleContext.isDefineHookReference(candidate.expression, module))
          ) {
            const property = configProperty(config, 'setup');
            const setup = property ? functionFor(propertyExpression(property), module) : null;
            if (setup) setups!.add(setup.fn);
          }
        }
        ts.forEachChild(candidate, visit);
      };
      visit(source);
      authoredSetups.set(source, setups);
    }
    return setups.has(node);
  };

  const isSameSourceBinding = (
    call: ts.CallExpression,
    source: ts.SourceFile,
    bindingNode: ts.Node
  ): boolean => {
    const module = moduleForSource(source);
    const symbol = moduleContext.resolveReference(unwrap(call.expression), module);
    const producer = symbol ? producerForSymbol(symbol) : null;
    if (!symbol || !producer) return false;
    const held = moduleContext.moduleForSource(bindingNode.getSourceFile());
    if (
      held.file === symbol.module.file &&
      bindingNode.getStart(bindingNode.getSourceFile()) ===
        symbol.declaration.getStart(symbol.module.source)
    )
      return true;

    // A local constant alias is a distinct lexical binding, but it still
    // denotes the same authored producer when its initializer resolves to the
    // producer declaration. Compare the resolved producer rather than the
    // alias node's source position; a same-named shadow with no producer proof
    // remains rejected.
    const binding =
      ts.isVariableDeclaration(bindingNode) && ts.isIdentifier(bindingNode.name)
        ? moduleContext.resolveReference(bindingNode.name, held)
        : ts.isIdentifier(bindingNode)
          ? moduleContext.resolveReference(bindingNode, held)
          : null;
    const aliased = binding ? producerForSymbol(binding) : null;
    return (
      !!aliased &&
      aliased.module.file === producer.module.file &&
      aliased.declaration.getStart(aliased.module.source) ===
        producer.declaration.getStart(producer.module.source)
    );
  };

  const importedHookBinding = (
    module: Module,
    name: string
  ): { local: string; imported: string; specifier: string } | null => {
    for (const statement of module.source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier))
        continue;
      const bindings = statement.importClause?.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) continue;
      for (const element of bindings.elements) {
        if (element.name.text !== name) continue;
        const imported = (element.propertyName ?? element.name).text;
        if (
          statement.moduleSpecifier.text === '@proto.ui/core' &&
          (imported === 'tw' || imported === 'defineAsHook')
        )
          continue;
        return { local: name, imported, specifier: statement.moduleSpecifier.text };
      }
    }
    return null;
  };

  /** null proves absence; undefined preserves a possible overwrite or unproved value. */
  const configProperty = (
    config: ts.ObjectLiteralExpression,
    name: string
  ):
    | ts.PropertyAssignment
    | ts.MethodDeclaration
    | ts.ShorthandPropertyAssignment
    | null
    | undefined => {
    let found:
      | ts.PropertyAssignment
      | ts.MethodDeclaration
      | ts.ShorthandPropertyAssignment
      | null
      | undefined = null;
    for (const property of config.properties) {
      if (ts.isSpreadAssignment(property) || ts.isComputedPropertyName(property.name)) {
        // A spread or computed key can overwrite an earlier property. A later
        // explicit property is safe because it is ordered after that overwrite.
        found = undefined;
        continue;
      }
      if (propertyName(property.name) !== name) continue;
      found =
        ts.isPropertyAssignment(property) ||
        ts.isMethodDeclaration(property) ||
        ts.isShorthandPropertyAssignment(property)
          ? property
          : undefined;
    }
    return found;
  };

  const functionFor = (
    node: ts.Node | undefined,
    module: Module,
    seen = new Set<string>()
  ): { fn: ts.FunctionLikeDeclaration; module: Module } | null => {
    const value = node ? unwrap(node) : null;
    if (!value) return null;
    if (isFunctionLike(value)) return value.body ? { fn: value, module } : null;
    if (ts.isShorthandPropertyAssignment(value)) {
      return functionFor(value.name, module, seen);
    }
    if (ts.isCallExpression(value)) {
      const factory = functionFor(value.expression, module, seen);
      return factory ? returnedFunction(factory.fn, factory.module) : null;
    }
    const symbol = moduleContext.resolveReference(value, module);
    if (!symbol) return null;
    const seenKey = `${symbol.module.file}:${symbol.declaration.getStart(symbol.module.source)}`;
    if (seen.has(seenKey)) return null;
    const nextSeen = new Set(seen).add(seenKey);
    if (isFunctionLike(symbol.declaration)) {
      if (
        !symbol.declaration.body ||
        (symbol.declaration.name && hasBindingWrite(symbol.declaration.name, symbol.module))
      )
        return null;
      if (
        symbol.declaration.asteriskToken ||
        symbol.declaration.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword
        )
      )
        return null;
      return { fn: symbol.declaration, module: symbol.module };
    }
    if (
      ts.isVariableDeclaration(symbol.declaration) &&
      symbol.declaration.initializer &&
      stableVariable(symbol.declaration, symbol.module)
    ) {
      return functionFor(symbol.declaration.initializer, symbol.module, nextSeen);
    }
    return null;
  };

  const returnedFunction = (
    fn: ts.FunctionLikeDeclaration,
    module: Module
  ): { fn: ts.FunctionLikeDeclaration; module: Module } | null => {
    if (
      fn.asteriskToken ||
      fn.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)
    )
      return null;
    if (!fn.body) return null;
    const expression = ts.isBlock(fn.body)
      ? fn.body.statements.length === 1 && ts.isReturnStatement(fn.body.statements[0])
        ? fn.body.statements[0].expression
        : undefined
      : fn.body;
    const value = expression ? unwrap(expression) : null;
    if (!value || !isFunctionLike(value)) return null;
    if (
      value.asteriskToken ||
      value.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)
    )
      return null;
    return { fn: value, module };
  };

  const propertyExpression = (property: ts.ObjectLiteralElementLike): ts.Node | undefined =>
    ts.isPropertyAssignment(property)
      ? property.initializer
      : ts.isShorthandPropertyAssignment(property)
        ? property.name
        : ts.isMethodDeclaration(property)
          ? property
          : undefined;

  const directReturnExpression = (
    fn: ts.FunctionLikeDeclaration,
    module: Module
  ): { expression: ts.Expression; module: Module } | null => {
    if (!fn.body) return null;
    if (!ts.isBlock(fn.body)) {
      const expression = unwrap(fn.body);
      return { expression: expression as ts.Expression, module };
    }
    let found: { expression: ts.Expression; module: Module } | null = null;
    let invalid = false;
    const visit = (node: ts.Node): void => {
      if (invalid || (node !== fn && isFunctionLike(node))) return;
      if (ts.isReturnStatement(node)) {
        const expression = node.expression ? unwrap(node.expression) : null;
        if (!expression || found) {
          invalid = true;
          return;
        }
        found = { expression: expression as ts.Expression, module };
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(fn.body);
    return invalid ? null : found;
  };

  const directReturnCall = (
    fn: ts.FunctionLikeDeclaration,
    module: Module
  ): { call: ts.CallExpression; module: Module } | null => {
    const returned = directReturnExpression(fn, module);
    if (!returned || !ts.isCallExpression(returned.expression)) return null;
    return { call: returned.expression, module: returned.module };
  };

  const thisMember = (node: ts.Node): string | null => {
    const value = unwrap(node);
    if (!ts.isPropertyAccessExpression(value)) return null;
    return value.expression.kind === ts.SyntaxKind.ThisKeyword ? value.name.text : null;
  };

  const assignmentValue = (
    body: ts.Block,
    owner: string,
    member: string
  ): { value: ts.Node; assignment: ts.BinaryExpression } | null => {
    let found: { value: ts.Node; assignment: ts.BinaryExpression } | null = null;
    const visit = (node: ts.Node): void => {
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const left = unwrap(node.left);
        if (
          ts.isPropertyAccessExpression(left) &&
          (owner === 'this'
            ? unwrap(left.expression).kind === ts.SyntaxKind.ThisKeyword
            : thisMember(left.expression) === owner) &&
          left.name.text === member
        ) {
          found = { value: node.right, assignment: node };
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(body);
    return found;
  };

  const stateNameAssignment = (body: ts.Block, owned: string): string | null => {
    let found: string | null = null;
    const visit = (node: ts.Node): void => {
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const left = unwrap(node.left);
        const owner = memberOwner(left);
        if (owner && memberName(left) === '__stateName' && thisMember(owner) === owned) {
          const value = unwrap(node.right);
          if (isStringValue(value)) found = value.text;
          else found = null;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(body);
    return found;
  };

  const focusProviderStates = (
    symbol: SymbolRef,
    seen = new Set<string>()
  ): ReadonlyMap<string, ProviderStateProof> | null => {
    const cacheKey = symbolKey(symbol);
    const cached = providerStateCache.get(cacheKey);
    if (cached !== undefined) return cached;
    if (seen.has(cacheKey)) {
      providerStateCache.set(cacheKey, null);
      return null;
    }
    const nextSeen = new Set(seen).add(cacheKey);
    if (
      ts.isVariableDeclaration(symbol.declaration) &&
      symbol.declaration.initializer &&
      stableVariable(symbol.declaration, symbol.module)
    ) {
      const initializer = unwrap(symbol.declaration.initializer);
      if (ts.isIdentifier(initializer)) {
        const alias = moduleContext.resolveReference(initializer, symbol.module);
        const result = alias ? focusProviderStates(alias, nextSeen) : null;
        providerStateCache.set(cacheKey, result);
        return result;
      }
    }

    const fail = (): null => {
      providerStateCache.set(cacheKey, null);
      return null;
    };
    const declaration = symbol.declaration;
    if (
      !ts.isFunctionDeclaration(declaration) ||
      declaration.name?.text !== 'asFocusable' ||
      !declaration.body
    )
      return fail();

    const forwarding = directReturnCall(declaration, symbol.module);
    if (!forwarding) return fail();
    const factory = moduleContext.resolveReference(forwarding.call.expression, forwarding.module);
    if (
      !factory ||
      !ts.isVariableDeclaration(factory.declaration) ||
      !factory.declaration.initializer ||
      !stableVariable(factory.declaration, factory.module)
    )
      return fail();
    const factoryCall = unwrap(factory.declaration.initializer);
    if (!ts.isCallExpression(factoryCall)) return fail();
    const factorySymbol = moduleContext.resolveReference(factoryCall.expression, factory.module);
    if (
      !factorySymbol ||
      !ts.isFunctionDeclaration(factorySymbol.declaration) ||
      factorySymbol.declaration.name?.text !== 'definePrivilegedAsHook'
    )
      return fail();
    const config = factoryCall.arguments[0] ? unwrap(factoryCall.arguments[0]) : null;
    if (!config || !ts.isObjectLiteralExpression(config)) return fail();
    const configuredName = configProperty(config, 'name');
    if (
      !configuredName ||
      !ts.isPropertyAssignment(configuredName) ||
      literalString(configuredName.initializer, factory.module, new Map()) !== 'asFocusable'
    )
      return fail();
    const setupProperty = configProperty(config, 'setup');
    if (!setupProperty) return fail();
    const setup = functionFor(propertyExpression(setupProperty), factory.module);
    if (!setup) return fail();

    let facadeName: string | null = null;
    let facadeKey: string | null = null;
    let forwardsGetFocusable = false;
    const inspectSetup = (node: ts.Node): void => {
      if (node !== setup.fn && isFunctionLike(node)) return;
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const initializer = unwrap(node.initializer);
        if (ts.isPropertyAccessExpression(initializer)) {
          const owner = unwrap(initializer.expression);
          if (ts.isIdentifier(owner) && owner.text === 'facades') {
            facadeName = node.name.text;
            facadeKey = initializer.name.text;
          }
        }
      }
      if (ts.isReturnStatement(node) && node.expression) {
        const expression = unwrap(node.expression);
        if (
          ts.isCallExpression(expression) &&
          memberName(expression.expression) === 'getFocusable'
        ) {
          const owner = memberOwner(expression.expression);
          const ownerValue = owner ? unwrap(owner) : null;
          if (ownerValue && ts.isIdentifier(ownerValue) && ownerValue.text === facadeName)
            forwardsGetFocusable = true;
        }
      }
      ts.forEachChild(node, inspectSetup);
    };
    if (setup.fn.body) inspectSetup(setup.fn.body);
    if (!facadeName || !facadeKey || !forwardsGetFocusable) return fail();

    // The facade key is connected to the actually installed Runtime descriptor,
    // not a package/name table. Read the registry's descriptor array and follow
    // the concrete factory/build/facade path to the provider implementation.
    const runtime = moduleContext.resolveModule(symbol.module.file, '@proto.ui/runtime');
    if (!runtime) return fail();
    const runtimeEntry = moduleContext.resolveExport(runtime, 'createRuntimeInstance');
    const runtimeDeclaration =
      runtimeEntry && ts.isFunctionDeclaration(runtimeEntry.declaration)
        ? runtimeEntry.declaration
        : null;
    if (!runtimeEntry || !runtimeDeclaration || !runtimeDeclaration.body) return fail();
    const findRegistry = (node: ts.Node): ts.ArrayLiteralExpression | undefined => {
      if (node !== runtimeDeclaration && isFunctionLike(node)) return;
      if (ts.isNewExpression(node)) {
        const expression = unwrap(node.expression);
        if (ts.isIdentifier(expression) && expression.text === 'RuntimeModuleOrchestrator') {
          const array = node.arguments?.find((argument): argument is ts.ArrayLiteralExpression =>
            ts.isArrayLiteralExpression(argument)
          );
          if (array) return array;
        }
      }
      return ts.forEachChild(node, findRegistry);
    };
    const registry = findRegistry(runtimeDeclaration.body);
    if (!registry) return fail();

    let descriptorConfig: ts.ObjectLiteralExpression | null = null;
    let createExpression: ts.Node | undefined;
    for (const element of registry.elements) {
      if (ts.isSpreadElement(element)) return fail();
      const candidate = moduleContext.resolveReference(unwrap(element), runtimeEntry.module);
      if (
        !candidate ||
        !ts.isVariableDeclaration(candidate.declaration) ||
        !candidate.declaration.initializer ||
        !stableVariable(candidate.declaration, candidate.module)
      )
        continue;
      const initializer = unwrap(candidate.declaration.initializer);
      if (!ts.isCallExpression(initializer)) continue;
      const defineModule = moduleContext.resolveReference(initializer.expression, candidate.module);
      if (
        !defineModule ||
        !ts.isFunctionDeclaration(defineModule.declaration) ||
        defineModule.declaration.name?.text !== 'defineModule'
      )
        continue;
      const candidateConfig = initializer.arguments[0] ? unwrap(initializer.arguments[0]) : null;
      if (!candidateConfig || !ts.isObjectLiteralExpression(candidateConfig)) continue;
      const nameProperty = configProperty(candidateConfig, 'name');
      const name =
        nameProperty && ts.isPropertyAssignment(nameProperty)
          ? literalString(nameProperty.initializer, candidate.module, new Map())
          : null;
      if (name !== facadeKey) continue;
      descriptorConfig = candidateConfig;
      const createProperty = configProperty(candidateConfig, 'create');
      createExpression = createProperty ? propertyExpression(createProperty) : undefined;
      break;
    }
    if (!descriptorConfig || !createExpression) return fail();
    const createFactory = functionFor(createExpression, runtimeEntry.module);
    if (!createFactory) return fail();
    const createReturn = directReturnCall(createFactory.fn, createFactory.module);
    if (!createReturn) return fail();
    const createModuleConfig = createReturn.call.arguments[0]
      ? unwrap(createReturn.call.arguments[0])
      : null;
    if (!createModuleConfig || !ts.isObjectLiteralExpression(createModuleConfig)) return fail();
    const buildProperty = configProperty(createModuleConfig, 'build');
    const build = buildProperty
      ? functionFor(propertyExpression(buildProperty), createFactory.module)
      : null;
    if (!build || !build.fn.body || !ts.isBlock(build.fn.body)) return fail();

    let stateFacadeName: string | null = null;
    const implementation: { symbol: SymbolRef | null } = { symbol: null };
    let implementationName: string | null = null;
    let stateFacadeArgumentIndex: number | null = null;
    const inspectBuild = (node: ts.Node): void => {
      if (node !== build.fn && isFunctionLike(node)) return;
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const initializer = unwrap(node.initializer);
        if (
          ts.isCallExpression(initializer) &&
          memberName(initializer.expression) === 'requireFacade'
        ) {
          const key = literalString(initializer.arguments[0], build.module, new Map());
          if (key === 'state') stateFacadeName = node.name.text;
        }
        if (ts.isNewExpression(initializer) && ts.isIdentifier(unwrap(initializer.expression))) {
          const args = initializer.arguments;
          if (args) {
            const lastArgument = args.length > 0 ? args[args.length - 1] : undefined;
            const last = lastArgument ? unwrap(lastArgument) : null;
            if (stateFacadeName && last && ts.isIdentifier(last) && last.text === stateFacadeName) {
              implementation.symbol = moduleContext.resolveReference(
                initializer.expression,
                build.module
              );
              implementationName = node.name.text;
              stateFacadeArgumentIndex = args.length - 1;
            }
          }
        }
      }
      ts.forEachChild(node, inspectBuild);
    };
    inspectBuild(build.fn.body);
    const implementationSymbol = implementation.symbol;
    if (
      !stateFacadeName ||
      !implementationSymbol ||
      !implementationName ||
      !ts.isClassDeclaration(implementationSymbol.declaration)
    )
      return fail();

    const buildReturn = directReturnExpression(build.fn, build.module);
    const buildOutput = buildReturn?.expression;
    const facadeProperty =
      buildOutput && ts.isObjectLiteralExpression(buildOutput)
        ? configProperty(buildOutput, 'facade')
        : null;
    const facadeObject = facadeProperty ? propertyExpression(facadeProperty) : undefined;
    if (!facadeObject || !ts.isObjectLiteralExpression(facadeObject)) return fail();
    const getFocusableProperty = configProperty(facadeObject, 'getFocusable');
    const getFocusable = getFocusableProperty
      ? functionFor(propertyExpression(getFocusableProperty), createFactory.module)
      : null;
    if (!getFocusable) return fail();
    const getFocusableReturn = directReturnCall(getFocusable.fn, getFocusable.module);
    if (!getFocusableReturn) return fail();
    const getFocusableOwner = memberOwner(getFocusableReturn.call.expression);
    const getFocusableOwnerValue = getFocusableOwner ? unwrap(getFocusableOwner) : null;
    if (
      !getFocusableOwnerValue ||
      !ts.isIdentifier(getFocusableOwnerValue) ||
      getFocusableOwnerValue.text !== implementationName ||
      memberName(getFocusableReturn.call.expression) !== 'getFocusable'
    )
      return fail();

    const classDeclaration = implementationSymbol.declaration;
    const constructor = classDeclaration.members.find(ts.isConstructorDeclaration);
    const getFocusableMethod = classDeclaration.members.find(
      (member): member is ts.MethodDeclaration =>
        ts.isMethodDeclaration(member) && propertyName(member.name) === 'getFocusable'
    );
    if (!constructor || !constructor.body || !getFocusableMethod) return fail();
    const methodReturn = directReturnExpression(getFocusableMethod, implementationSymbol.module);
    if (!methodReturn) return fail();
    const methodMember = memberName(methodReturn.expression);
    const methodOwner = memberOwner(methodReturn.expression);
    if (
      methodMember !== 'focusableHandle' ||
      !methodOwner ||
      unwrap(methodOwner).kind !== ts.SyntaxKind.ThisKeyword
    )
      return fail();
    const handleAssignment = assignmentValue(constructor.body, 'this', 'focusableHandle');
    if (!handleAssignment || !ts.isObjectLiteralExpression(unwrap(handleAssignment.value)))
      return fail();
    const handleObject = unwrap(handleAssignment.value) as ts.ObjectLiteralExpression;

    if (stateFacadeArgumentIndex === null) return fail();
    const stateFacadeParam = constructor.parameters[stateFacadeArgumentIndex];
    const statePortParam = constructor.parameters[stateFacadeArgumentIndex - 1];
    if (
      !stateFacadeParam ||
      !ts.isIdentifier(stateFacadeParam.name) ||
      !statePortParam ||
      !ts.isIdentifier(statePortParam.name)
    )
      return fail();
    const stateFacadeIdentifier = stateFacadeParam.name;
    const statePortIdentifier = statePortParam.name;

    const proofs = new Map<string, ProviderStateProof>();
    let uncertainMember = false;
    for (const property of handleObject.properties) {
      if (ts.isSpreadAssignment(property)) {
        uncertainMember = true;
        continue;
      }
      if (!ts.isPropertyAssignment(property)) continue;
      const name = propertyName(property.name);
      const target = name ? thisMember(property.initializer) : null;
      if (!name || !target) continue;
      const observed = assignmentValue(constructor.body, 'this', target);
      if (!observed) continue;
      const observedCall = unwrap(observed.value);
      if (
        !ts.isCallExpression(observedCall) ||
        memberName(observedCall.expression) !== 'createObservedHandle'
      )
        continue;
      const observedOwner = memberOwner(observedCall.expression);
      const observedOwnerValue = observedOwner ? unwrap(observedOwner) : null;
      if (
        !observedOwnerValue ||
        !ts.isIdentifier(observedOwnerValue) ||
        observedOwnerValue.text !== statePortIdentifier.text ||
        observedCall.arguments.length !== 1
      )
        continue;
      const owned = thisMember(observedCall.arguments[0]);
      if (!owned) continue;
      const ownedAssignment = assignmentValue(constructor.body, 'this', owned);
      if (!ownedAssignment) continue;
      const ownedCall = unwrap(ownedAssignment.value);
      if (!ts.isCallExpression(ownedCall) || memberName(ownedCall.expression) !== 'bool') continue;
      const ownedOwner = memberOwner(ownedCall.expression);
      const ownedOwnerValue = ownedOwner ? unwrap(ownedOwner) : null;
      if (
        !ownedOwnerValue ||
        !ts.isIdentifier(ownedOwnerValue) ||
        ownedOwnerValue.text !== stateFacadeIdentifier.text
      )
        continue;
      const semantic = literalString(
        ownedCall.arguments[0],
        implementationSymbol.module,
        new Map()
      );
      const declaredName = stateNameAssignment(constructor.body, owned);
      if (!semantic || !declaredName) continue;
      proofs.set(name, {
        owner: sourceRef(declaration, symbol.module.file),
        declaredName,
        semantic,
        declaration: sourceRef(ownedCall),
      });
    }
    if (uncertainMember && proofs.size === 0) return fail();
    if (proofs.size === 0) return fail();
    providerStateCache.set(cacheKey, proofs);
    return proofs;
  };

  const canonicalFocusableStates = (
    call: ts.CallExpression,
    module: Module
  ): ReadonlyMap<string, ProviderStateProof> | null => {
    if (call.arguments.length !== 0) return null;
    let symbol = moduleContext.resolveReference(unwrap(call.expression), module);
    if (!symbol) return null;
    const seen = new Set<string>();
    while (
      ts.isVariableDeclaration(symbol.declaration) &&
      symbol.declaration.initializer &&
      stableVariable(symbol.declaration, symbol.module) &&
      ts.isIdentifier(unwrap(symbol.declaration.initializer))
    ) {
      const key = symbolKey(symbol);
      if (seen.has(key)) return null;
      seen.add(key);
      const alias = moduleContext.resolveReference(
        unwrap(symbol.declaration.initializer),
        symbol.module
      );
      if (!alias) return null;
      symbol = alias;
    }
    let canonical = canonicalFocusableCache.get(module.file);
    if (canonical === undefined) {
      const hooks = moduleContext.resolveModule(module.file, '@proto.ui/hooks');
      canonical = hooks ? moduleContext.resolveExport(hooks, 'asFocusable') : null;
      canonicalFocusableCache.set(module.file, canonical);
    }
    if (!canonical || symbolKey(canonical) !== symbolKey(symbol)) return null;
    return focusProviderStates(symbol);
  };

  const canonicalAccessibleCall = (call: ts.CallExpression, module: Module): boolean => {
    if (call.arguments.length !== 0) return false;
    let symbol = moduleContext.resolveReference(unwrap(call.expression), module);
    if (!symbol) return false;
    const seen = new Set<string>();
    while (
      ts.isVariableDeclaration(symbol.declaration) &&
      symbol.declaration.initializer &&
      stableVariable(symbol.declaration, symbol.module) &&
      ts.isIdentifier(unwrap(symbol.declaration.initializer))
    ) {
      const key = symbolKey(symbol);
      if (seen.has(key)) return false;
      seen.add(key);
      const alias = moduleContext.resolveReference(
        unwrap(symbol.declaration.initializer),
        symbol.module
      );
      if (!alias) return false;
      symbol = alias;
    }
    const hooks = moduleContext.resolveModule(symbol.module.file, '@proto.ui/hooks');
    const canonical = hooks ? moduleContext.resolveExport(hooks, 'asAccessible') : null;
    return !!canonical && symbolKey(canonical) === symbolKey(symbol);
  };

  // These existing source-identity proofs admit Core-owned privileged hook
  // boundaries, not ordinary authored helpers. Their factory wrapper closes
  // over privileged runtime context which an empty helper environment cannot
  // reconstruct. This does not grant native provenance to their return values.
  const canonicalPrivilegedCall = (call: ts.CallExpression, module: Module): boolean =>
    canonicalAccessibleCall(call, module) || canonicalFocusableStates(call, module) !== null;

  const literalString = (
    node: ts.Node | undefined,
    module: Module,
    local: ReadonlyMap<string, string>,
    stack = new Set<string>()
  ): string | null => {
    if (!node) return null;
    const value = unwrap(node);
    if (isStringValue(value)) return value.text;
    if (!ts.isIdentifier(value)) return null;
    const symbol = moduleContext.resolveReference(value, module);
    if (!symbol) return null;
    const key = symbolKey(symbol);
    if (local.has(key)) return local.get(key) ?? null;
    if (
      !ts.isVariableDeclaration(symbol.declaration) ||
      !symbol.declaration.initializer ||
      !stableVariable(symbol.declaration, symbol.module)
    )
      return null;
    if (stack.has(key)) return null;
    return literalString(
      symbol.declaration.initializer,
      symbol.module,
      local,
      new Set(stack).add(key)
    );
  };

  const memberValue = (value: HookSourceValue, name: string): HookSourceResolution => {
    if (value.kind === 'object') {
      const member = value.members.get(name);
      return member
        ? { matched: true, value: member }
        : { matched: true, value: UNKNOWN(`missing member ${name}`) };
    }
    if (value.kind === 'result') {
      if (name === 'stateHandles') {
        const members = new Map<string, HookSourceValue>();
        for (const [key, state] of value.stateHandles) members.set(key, { kind: 'state', state });
        return {
          matched: true,
          value: {
            kind: 'object',
            members,
            ...(value.stateHandlesClosed ? { closed: true } : {}),
          },
        };
      }
      if (name === 'getState') {
        return {
          matched: true,
          value: { kind: 'callable', operation: 'getState', result: value },
        };
      }
      // Runtime stores an ordered entry array here, not the contract's type map.
      // Named lookup is modeled below; an unproved physical entry index is not.
      if (name === 'asHooks')
        return { matched: true, value: UNKNOWN('unproven child entry index') };
      if (name === 'getAsHook' || name === 'getAsHookHandle') return { matched: true, value };
      return { matched: true, value: UNKNOWN(`missing result member ${name}`) };
    }
    return { matched: true, value: UNKNOWN(`not an object member ${name}`) };
  };

  const joinValues = (first: HookSourceValue, second: HookSourceValue): HookSourceValue => {
    if (first === second) return first;
    if (first.kind === 'state' && second.kind === 'state') {
      const left = first.state;
      const right = second.state;
      return left.declaredName === right.declaredName &&
        left.variant === right.variant &&
        left.semantic === right.semantic &&
        left.owner.file === right.owner.file &&
        left.owner.start === right.owner.start &&
        left.declaration.file === right.declaration.file &&
        left.declaration.start === right.declaration.start
        ? first
        : UNKNOWN('different reachable state declarations');
    }
    if (first.kind === 'object' && second.kind === 'object') {
      const members = new Map<string, HookSourceValue>();
      const keys = new Set([...first.members.keys(), ...second.members.keys()]);
      for (const key of keys) {
        const value = first.members.get(key);
        const other = second.members.get(key);
        if (value && other) members.set(key, joinValues(value, other));
        else members.set(key, UNKNOWN('missing reachable member'));
      }
      return {
        kind: 'object',
        members,
        uncertainKeys: first.uncertainKeys || second.uncertainKeys,
        ...(first.closed && second.closed ? { closed: true } : {}),
        ...(first.arrayLength === second.arrayLength ? { arrayLength: first.arrayLength } : {}),
      };
    }
    if (first.kind === 'callable' && second.kind === 'callable') {
      return first.operation === second.operation && first.result === second.result
        ? first
        : UNKNOWN('different callable owners');
    }
    return UNKNOWN('unproved reachable alternative');
  };

  const producerIdentity = (producer: Producer): string =>
    `${producer.module.file}:${producer.declaration.getStart(producer.module.source)}`;
  const producerName = (producer: Producer): string | null => {
    const property = configProperty(producer.config, 'name');
    return property
      ? literalString(propertyExpression(property), producer.module, new Map())
      : null;
  };
  const sameProducer = (left: Producer, right: Producer): boolean =>
    producerIdentity(left) === producerIdentity(right);

  type RegistrationEntry = {
    producer: Producer;
    certain: boolean;
    owners: Set<string>;
    opaqueBefore: boolean;
    initializing: boolean;
    /** The name was installed inside another producer's setup or helper. */
    nested: boolean;
    result?: HookSourceValue;
    methods?: Map<string, { fn: ts.FunctionLikeDeclaration; module: Module; certain: boolean }[]>;
  };

  const unknownRegistrationLiteral = Symbol('unproved registration literal');
  type UnprovedRegistrationLiteral = typeof unknownRegistrationLiteral;
  type RegistrationLiteral =
    | SetupLiteral
    | null
    | undefined
    | UnprovedRegistrationLiteral
    | { members: Map<string, RegistrationLiteral>; epoch: number; array?: true };
  const registrationLiteral = (
    node: ts.Node
  ): SetupLiteral | null | UnprovedRegistrationLiteral => {
    const value = unwrap(node);
    if (isStringValue(value)) return value.text;
    if (ts.isNumericLiteral(value)) return Number(value.text);
    if (value.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (value.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (value.kind === ts.SyntaxKind.NullKeyword) return null;
    return unknownRegistrationLiteral;
  };
  const registrationRightReachability = (
    operator: ts.SyntaxKind,
    value: RegistrationLiteral
  ): boolean | null => {
    if (value === unknownRegistrationLiteral) return null;
    if (
      operator === ts.SyntaxKind.QuestionQuestionToken ||
      operator === ts.SyntaxKind.QuestionQuestionEqualsToken
    )
      return value === null || value === undefined;
    if (
      operator === ts.SyntaxKind.AmpersandAmpersandToken ||
      operator === ts.SyntaxKind.AmpersandAmpersandEqualsToken
    )
      return Boolean(value);
    return !value;
  };

  /** Registration effects are replayed separately from own-state capture. */
  const createRegistrationReplay = (
    capture: (producer: Producer, children: ReadonlyMap<string, HookSourceValue>) => HookSourceValue
  ) => {
    const entries = new Map<string, RegistrationEntry>();
    const activeHelpers = new Set<ts.Node>();
    // A raw result is a Core container, not proof that its authored methods
    // (or arbitrary extension members) are native capabilities.
    type CapabilityOrigin = 'native' | 'native-result' | 'authored' | 'unknown';
    const capabilityEnvironments = new WeakMap<Environment, Map<ts.Node, CapabilityOrigin>>();
    const methodFrames: Map<
      string,
      {
        fn: ts.FunctionLikeDeclaration;
        module: Module;
        certain: boolean;
      }[]
    >[] = [];
    const resultBindings = new Map<ts.Node, RegistrationEntry>();
    const callableBindings = new Map<
      ts.Node,
      {
        fn: ts.FunctionLikeDeclaration;
        module: Module;
        certain: boolean;
      }[]
    >();
    let opaque = false;
    // All replay frames share aggregate lifetimes, including captured module cells.
    let aggregateEpoch = 0;
    let aggregateAbsenceUnproved = false;
    const unknownLiteral: UnprovedRegistrationLiteral = unknownRegistrationLiteral;
    type Literal = RegistrationLiteral;
    type Environment = Map<ts.Node, Literal>;
    const activeEnvironments = new Set<Environment>();
    const withdrawCapturedBinding = (key: ts.Node, env: Environment): void => {
      for (const frame of activeEnvironments) {
        if (frame === env || !frame.has(key)) continue;
        frame.set(key, unknownLiteral);
        capabilities(frame).set(key, 'unknown');
      }
    };
    const capabilities = (env: Environment): Map<ts.Node, CapabilityOrigin> => {
      let facts = capabilityEnvironments.get(env);
      if (!facts) {
        facts = new Map();
        capabilityEnvironments.set(env, facts);
      }
      return facts;
    };
    const forkEnvironment = (env: Environment): Environment => {
      const fork = new Map(env);
      capabilityEnvironments.set(fork, new Map(capabilities(env)));
      return fork;
    };
    const joinCapabilities = (env: Environment, branches: readonly Environment[]): void => {
      if (branches.length === 0) return;
      const joined = capabilities(env);
      const keys = new Set(joined.keys());
      for (const branch of branches) for (const key of capabilities(branch).keys()) keys.add(key);
      for (const key of keys) {
        const first = capabilities(branches[0]).get(key) ?? 'unknown';
        joined.set(
          key,
          branches.every((branch) => (capabilities(branch).get(key) ?? 'unknown') === first)
            ? first
            : 'unknown'
        );
      }
    };
    const binding = (node: ts.Node, module: Module): ts.Node | undefined =>
      moduleContext.resolveReference(unwrap(node), module)?.declaration;
    const nativeValue = (node: ts.Node, module: Module, env: Environment): boolean => {
      const value = unwrap(node);
      if (ts.isIdentifier(value)) {
        const key = binding(value, module);
        const origin = key ? capabilities(env).get(key) : undefined;
        return origin === 'native' || origin === 'native-result';
      }
      if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) {
        if (capabilityOrigin(value.expression, module, env) === 'native-result') {
          const name = memberName(value);
          return name === 'stateHandles' || name === 'state' || name === 'getState';
        }
        return nativeValue(value.expression, module, env);
      }
      if (ts.isObjectLiteralExpression(value))
        return value.properties.every(
          (property) =>
            ts.isPropertyAssignment(property) && nativeValue(property.initializer, module, env)
        );
      if (ts.isCallExpression(value)) {
        const producer = producerForCall(value, module.source);
        if (producer) {
          const name = producerName(producer);
          const entry = name === null ? undefined : entries.get(name);
          return entry?.result?.kind === 'result' && !entry.result.handle;
        }
        // Receiver ownership does not prove ownership of an arbitrary return
        // value: getMethod/getAsHookHandle may return authored capabilities.
        const owner = memberOwner(value.expression);
        if (!owner) return false;
        if (memberName(value.expression) === 'getState') return nativeValue(owner, module, env);
        const container = memberOwner(owner);
        return (
          memberName(owner) === 'state' && container !== null && nativeValue(container, module, env)
        );
      }
      return false;
    };
    const capabilityOrigin = (
      node: ts.Node,
      module: Module,
      env: Environment
    ): CapabilityOrigin => {
      const value = unwrap(node);
      if (ts.isIdentifier(value)) {
        const key = binding(value, module);
        return key ? (capabilities(env).get(key) ?? 'unknown') : 'unknown';
      }
      if (
        ts.isCallExpression(value) &&
        producerForCall(value, module.source) &&
        nativeValue(value, module, env)
      )
        return 'native-result';
      if (nativeValue(value, module, env)) return 'native';
      if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value))
        return capabilityOrigin(value.expression, module, env) === 'authored'
          ? 'authored'
          : 'unknown';
      return ts.isObjectLiteralExpression(value) ||
        isFunctionLike(value) ||
        registrationLiteral(value) !== unknownLiteral
        ? 'authored'
        : 'unknown';
    };
    const nativeObjectEnumeration = (
      node: ts.CallExpression,
      module: Module,
      env: Environment
    ): boolean => {
      const callee = unwrap(node.expression);
      return (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === 'Object' &&
        !binding(callee.expression, module) &&
        (callee.name.text === 'keys' ||
          callee.name.text === 'values' ||
          callee.name.text === 'entries') &&
        node.arguments.length === 1 &&
        nativeValue(node.arguments[0], module, env)
      );
    };
    const literal = (node: ts.Node | undefined, module: Module, env: Environment): Literal => {
      if (!node) return undefined;
      const value = unwrap(node);
      const constant = registrationLiteral(value);
      if (constant !== unknownLiteral) return constant;
      if (ts.isIdentifier(value) && value.text === 'undefined' && !binding(value, module))
        return undefined;
      const key = ts.isIdentifier(value) ? binding(value, module) : undefined;
      // The walk has already replayed expression effects. Re-reading a whole
      // aggregate afterwards cannot recover earlier member values if a later
      // member changed their cells; retain no snapshot in that case.
      if (ts.isObjectLiteralExpression(value) || ts.isArrayLiteralExpression(value)) {
        const hasEffect = (node: ts.Node): boolean => {
          if (isFunctionLike(node))
            return node.name && ts.isComputedPropertyName(node.name)
              ? hasEffect(node.name.expression)
              : false;
          if (
            ts.isCallExpression(node) ||
            ts.isNewExpression(node) ||
            ts.isDeleteExpression(node) ||
            ts.isPostfixUnaryExpression(node) ||
            (ts.isPrefixUnaryExpression(node) &&
              (node.operator === ts.SyntaxKind.PlusPlusToken ||
                node.operator === ts.SyntaxKind.MinusMinusToken)) ||
            (ts.isBinaryExpression(node) &&
              node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
              node.operatorToken.kind <= ts.SyntaxKind.LastAssignment)
          )
            return true;
          return ts.forEachChild(node, hasEffect) === true;
        };
        if (hasEffect(value)) return unknownLiteral;
      }
      if (ts.isObjectLiteralExpression(value)) {
        const members = new Map<string, Literal>();
        for (const property of value.properties) {
          if (ts.isPropertyAssignment(property)) {
            const name = ts.isComputedPropertyName(property.name)
              ? literal(property.name.expression, module, env)
              : property.name.text;
            if (typeof name !== 'string' && typeof name !== 'number') return unknownLiteral;
            // The noncomputed spelling sets the prototype, not an own member.
            if (name === '__proto__' && !ts.isComputedPropertyName(property.name))
              return unknownLiteral;
            members.set(String(name), literal(property.initializer, module, env));
          } else if (
            ts.isShorthandPropertyAssignment(property) &&
            !property.objectAssignmentInitializer
          ) {
            members.set(property.name.text, literal(property.name, module, env));
          } else return unknownLiteral;
        }
        return { members, epoch: aggregateEpoch };
      }
      if (ts.isArrayLiteralExpression(value)) {
        const members = new Map<string, Literal>();
        members.set('length', value.elements.length);
        for (let index = 0; index < value.elements.length; index++) {
          const element = value.elements[index];
          if (ts.isSpreadElement(element)) return unknownLiteral;
          if (!ts.isOmittedExpression(element))
            members.set(String(index), literal(element, module, env));
        }
        return { members, epoch: aggregateEpoch, array: true };
      }
      return key && env.has(key) ? env.get(key)! : unknownLiteral;
    };
    const invalidateAggregates = (): void => {
      aggregateEpoch++;
      // An unmodeled member write can affect a prototype, including aggregates
      // created later. Own members remain usable on fresh snapshots.
      aggregateAbsenceUnproved = true;
    };
    const hasMemberTarget = (node: ts.Node): boolean => {
      const target = unwrap(node);
      if (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target))
        return true;
      return ts.forEachChild(target, hasMemberTarget) === true;
    };
    const inheritedMemberNames: Readonly<Record<string, boolean>> = {
      constructor: true,
      ['__proto__']: true,
      __defineGetter__: true,
      __defineSetter__: true,
      __lookupGetter__: true,
      __lookupSetter__: true,
      hasOwnProperty: true,
      isPrototypeOf: true,
      propertyIsEnumerable: true,
      toLocaleString: true,
      toString: true,
      valueOf: true,
    };
    const runFunction = (
      fn: ts.FunctionLikeDeclaration,
      module: Module,
      env: Environment,
      certain: boolean,
      children: Map<string, HookSourceValue>,
      nested: boolean
    ): void => {
      if (fn.asteriskToken) return;
      if (activeHelpers.has(fn)) {
        opaque = true;
        return;
      }
      activeHelpers.add(fn);
      activeEnvironments.add(env);
      try {
        if (fn.body) walk(fn.body, module, env, certain, children, nested);
      } finally {
        activeEnvironments.delete(env);
        activeHelpers.delete(fn);
      }
    };
    const invoke = (
      producer: Producer,
      certain: boolean,
      nested: boolean
    ): RegistrationEntry | null => {
      const name = producerName(producer);
      if (name === null) {
        opaque = true;
        return null;
      }
      const installed = entries.get(name);
      // The runtime keeps the first registration of a configured name.
      if (installed?.certain || installed?.initializing) return installed;
      if (installed) installed.owners.add(producerIdentity(producer));
      const entry: RegistrationEntry = {
        producer,
        certain: certain && !opaque && !installed,
        initializing: true,
        nested,
        owners: new Set([producerIdentity(producer)]),
        opaqueBefore: opaque,
      };
      if (!installed) entries.set(name, entry);
      const property = configProperty(producer.config, 'setup');
      const setup = property ? functionFor(propertyExpression(property), producer.module) : null;
      const children = new Map<string, HookSourceValue>();
      entry.methods = new Map();
      methodFrames.push(entry.methods);
      try {
        if (setup) {
          const parameter = setup.fn.parameters[0];
          const key =
            parameter && ts.isIdentifier(parameter.name)
              ? binding(parameter.name, setup.module)
              : undefined;
          const setupEnv: Environment = new Map();
          if (key) capabilities(setupEnv).set(key, 'native');
          runFunction(setup.fn, setup.module, setupEnv, certain && !installed, children, true);
        } else entry.certain = false;
      } finally {
        methodFrames.pop();
      }
      const projectProperty = configProperty(producer.config, 'projectHandle');
      const project = projectProperty
        ? functionFor(propertyExpression(projectProperty), producer.module)
        : null;
      if (project) {
        const parameter = project.fn.parameters[0];
        const key =
          parameter && ts.isIdentifier(parameter.name)
            ? binding(parameter.name, project.module)
            : undefined;
        const projectEnv: Environment = new Map();
        if (key) capabilities(projectEnv).set(key, 'native-result');
        runFunction(project.fn, project.module, projectEnv, certain && !installed, new Map(), true);
      }
      entry.result = capture(producer, children);
      entry.initializing = false;
      return installed ?? entry;
    };
    type Completion = boolean | null | 'throw';
    let catchDepth = 0;
    const walk = (
      node: ts.Node,
      module: Module,
      env: Environment,
      certain: boolean,
      children: Map<string, HookSourceValue>,
      nested: boolean
    ): Completion => {
      // Forks and parameter initializers are live frames too, even before a
      // function body starts. Retire only the membership this visit installed.
      const alreadyActive = activeEnvironments.has(env);
      activeEnvironments.add(env);
      try {
        return walkNode(node, module, env, certain, children, nested);
      } finally {
        if (!alreadyActive) activeEnvironments.delete(env);
      }
    };
    const walkBranch = (
      node: ts.Node,
      module: Module,
      env: Environment,
      children: Map<string, HookSourceValue>,
      nested: boolean
    ): Completion => {
      const beforeOpaque = opaque;
      const beforeEntries = new Map(
        [...entries].map(([name, entry]) => [
          name,
          {
            entry,
            snapshot: { ...entry, owners: new Set(entry.owners) },
          },
        ])
      );
      const completion = walk(node, module, env, false, children, nested);
      if (completion === 'throw' && catchDepth === 0) {
        // This alternative cannot reach the caller's next registration. Returns
        // can, as can throws intercepted by an enclosing catch: retain those.
        opaque = beforeOpaque;
        entries.clear();
        for (const [name, { entry, snapshot }] of beforeEntries) {
          Object.assign(entry, snapshot);
          entries.set(name, entry);
        }
      }
      return completion;
    };
    const walkNode = (
      node: ts.Node,
      module: Module,
      env: Environment,
      certain: boolean,
      children: Map<string, HookSourceValue>,
      nested: boolean
    ): Completion => {
      if (ts.isTypeNode(node)) return true;
      if (isFunctionLike(node)) {
        if (node.name && ts.isComputedPropertyName(node.name))
          walk(node.name, module, env, certain, children, nested);
        return true;
      }
      if (ts.isComputedPropertyName(node)) {
        walk(node.expression, module, env, certain, children, nested);
        const key = literal(node.expression, module, env);
        if (key === unknownLiteral || (typeof key === 'object' && key !== null)) {
          invalidateAggregates();
          opaque = true;
        }
        return true;
      }
      if (ts.isExpressionStatement(node))
        return walk(node.expression, module, env, certain, children, nested);
      if (ts.isAwaitExpression(node) || ts.isYieldExpression(node)) {
        if (node.expression) walk(node.expression, module, env, certain, children, nested);
        opaque = true;
        return false;
      }
      if (ts.isDeleteExpression(node)) {
        walk(node.expression, module, env, certain, children, nested);
        invalidateAggregates();
        return true;
      }
      if (
        (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
        (node.operator === ts.SyntaxKind.PlusPlusToken ||
          node.operator === ts.SyntaxKind.MinusMinusToken)
      ) {
        walk(node.operand, module, env, certain, children, nested);
        const operand = unwrap(node.operand);
        if (ts.isPropertyAccessExpression(operand) || ts.isElementAccessExpression(operand))
          invalidateAggregates();
        const previous = literal(node.operand, module, env);
        const key = binding(node.operand, module);
        if (key) {
          withdrawCapturedBinding(key, env);
          callableBindings.delete(key);
          env.set(
            key,
            certain && typeof previous === 'number'
              ? previous + (node.operator === ts.SyntaxKind.PlusPlusToken ? 1 : -1)
              : unknownLiteral
          );
          capabilities(env).set(key, 'unknown');
        }
        return true;
      }
      if (ts.isBlock(node)) {
        let continuationCertain = certain;
        let conditionalCompletion = false;
        for (const statement of node.statements) {
          const completion = walk(statement, module, env, continuationCertain, children, nested);
          if (completion === false || completion === 'throw') {
            // A previous conditional may already have returned to the caller.
            // A later throw terminates only its surviving alternative, not that
            // earlier return's effects. Keep the mixed completion conservative.
            return conditionalCompletion ? null : completion;
          }
          if (completion === null) {
            continuationCertain = false;
            conditionalCompletion = true;
          }
        }
        return conditionalCompletion ? null : true;
      }
      if (ts.isReturnStatement(node) || ts.isThrowStatement(node)) {
        if (node.expression) walk(node.expression, module, env, certain, children, nested);
        return ts.isThrowStatement(node) ? 'throw' : false;
      }
      if (ts.isTryStatement(node)) {
        if (node.catchClause) catchDepth++;
        let completion: Completion;
        try {
          completion = walk(node.tryBlock, module, env, certain, children, nested);
        } finally {
          if (node.catchClause) catchDepth--;
        }
        if (node.catchClause && (completion === 'throw' || completion === null))
          completion = walk(node.catchClause.block, module, env, false, children, nested);
        if (node.finallyBlock) {
          const final = walk(node.finallyBlock, module, env, certain, children, nested);
          if (final === false || final === 'throw') return final;
        }
        return completion;
      }
      if (ts.isVariableDeclaration(node)) {
        if (node.initializer) walk(node.initializer, module, env, certain, children, nested);
        if (ts.isIdentifier(node.name)) {
          const key = binding(node.name, module);
          if (key) {
            const reused = env.has(key) || capabilities(env).has(key);
            const previous = capabilities(env).get(key) ?? 'unknown';
            // Fresh cells have their initializer's ownership even when reaching
            // the declaration is uncertain. A possible write to an existing
            // function-scoped var must also preserve its skipped alternative.
            if (node.initializer || !reused) {
              callableBindings.delete(key);
              const next = node.initializer
                ? capabilityOrigin(node.initializer, module, env)
                : 'authored';
              const value = literal(node.initializer, module, env);
              env.set(key, certain || !reused ? value : unknownLiteral);
              capabilities(env).set(
                key,
                !reused || certain || previous === next ? next : 'unknown'
              );
            }
            const initializer = node.initializer ? unwrap(node.initializer) : null;
            if (initializer && ts.isCallExpression(initializer)) {
              const producer = producerForCall(initializer, module.source);
              const name = producer ? producerName(producer) : null;
              const entry = name === null ? undefined : entries.get(name);
              if (entry) resultBindings.set(key, entry);
            }
            if (
              initializer &&
              ts.isCallExpression(initializer) &&
              memberName(initializer.expression) === 'getMethod'
            ) {
              const method = literal(initializer.arguments[0], module, env);
              const owner = memberOwner(initializer.expression);
              const ownerBinding = owner ? binding(owner, module) : undefined;
              const result = ownerBinding ? resultBindings.get(ownerBinding) : undefined;
              const callable =
                typeof method === 'string' ? result?.methods?.get(method) : undefined;
              if (callable && (!reused || certain)) callableBindings.set(key, callable);
            }
          }
        }
        return true;
      }
      if (ts.isBinaryExpression(node)) {
        const operator = node.operatorToken.kind;
        const and =
          operator === ts.SyntaxKind.AmpersandAmpersandToken ||
          operator === ts.SyntaxKind.AmpersandAmpersandEqualsToken;
        const or =
          operator === ts.SyntaxKind.BarBarToken || operator === ts.SyntaxKind.BarBarEqualsToken;
        const nullish =
          operator === ts.SyntaxKind.QuestionQuestionToken ||
          operator === ts.SyntaxKind.QuestionQuestionEqualsToken;
        walk(node.left, module, env, certain, children, nested);
        const left = literal(node.left, module, env);
        const runs = and || or || nullish ? registrationRightReachability(operator, left) : true;
        if (runs !== false)
          walk(node.right, module, env, certain && runs === true, children, nested);
        if (operator >= ts.SyntaxKind.FirstAssignment && operator <= ts.SyntaxKind.LastAssignment) {
          const target = unwrap(node.left);
          if (
            runs !== false &&
            (ts.isObjectLiteralExpression(target) || ts.isArrayLiteralExpression(target))
          ) {
            const source = literal(node.right, module, env);
            const provenData =
              typeof source === 'object' &&
              source !== null &&
              source.epoch === aggregateEpoch &&
              (ts.isObjectLiteralExpression(target) || (source.array && !aggregateAbsenceUnproved));
            const ownReads =
              provenData &&
              (ts.isObjectLiteralExpression(target)
                ? target.properties.every((property) => {
                    const name = ts.isShorthandPropertyAssignment(property)
                      ? property.name.text
                      : ts.isPropertyAssignment(property) &&
                          !ts.isComputedPropertyName(property.name)
                        ? property.name.text
                        : null;
                    return name !== null && source.members.has(name);
                  })
                : target.elements.every(
                    (element, index) =>
                      ts.isOmittedExpression(element) || source.members.has(String(index))
                  ));
            if (!ownReads) {
              invalidateAggregates();
              opaque = true;
            }
          }
          if (runs !== false && hasMemberTarget(target)) {
            invalidateAggregates();
          }
          const key = binding(node.left, module);
          if (!key && runs !== false) {
            const withdrawTarget = (target: ts.Node): void => {
              const value = unwrap(target);
              if (ts.isIdentifier(value)) {
                const assigned = binding(value, module);
                if (assigned) {
                  withdrawCapturedBinding(assigned, env);
                  env.set(assigned, unknownLiteral);
                  capabilities(env).set(assigned, 'unknown');
                  callableBindings.delete(assigned);
                }
              } else if (ts.isPropertyAssignment(value)) withdrawTarget(value.initializer);
              else if (ts.isShorthandPropertyAssignment(value)) withdrawTarget(value.name);
              else if (ts.isBinaryExpression(value)) withdrawTarget(value.left);
              else if (
                !ts.isPropertyAccessExpression(value) &&
                !ts.isElementAccessExpression(value)
              )
                ts.forEachChild(value, withdrawTarget);
            };
            withdrawTarget(target);
          }
          if (key && runs !== false) {
            withdrawCapturedBinding(key, env);
            // The saved callable describes the old value, not this write's
            // replacement. A possible write also invalidates exact dispatch.
            callableBindings.delete(key);
            const right = literal(node.right, module, env);
            let assigned: Literal = right;
            if (!(and || or || nullish) && operator !== ts.SyntaxKind.EqualsToken) {
              assigned = unknownLiteral;
              if (typeof left === 'number' && typeof right === 'number') {
                switch (operator) {
                  case ts.SyntaxKind.MinusEqualsToken:
                    assigned = left - right;
                    break;
                  case ts.SyntaxKind.PlusEqualsToken:
                    assigned = left + right;
                    break;
                  case ts.SyntaxKind.AsteriskEqualsToken:
                    assigned = left * right;
                    break;
                  case ts.SyntaxKind.SlashEqualsToken:
                    assigned = left / right;
                    break;
                  case ts.SyntaxKind.PercentEqualsToken:
                    assigned = left % right;
                    break;
                }
              }
            }
            env.set(key, certain && runs === true ? assigned : unknownLiteral);
            const previous = capabilities(env).get(key) ?? 'unknown';
            const next =
              operator === ts.SyntaxKind.EqualsToken || and || or || nullish
                ? capabilityOrigin(node.right, module, env)
                : 'unknown';
            capabilities(env).set(
              key,
              certain && runs === true ? next : previous === next ? previous : 'unknown'
            );
          }
        }
        return true;
      }
      if (ts.isIfStatement(node)) {
        walk(node.expression, module, env, certain, children, nested);
        const condition = literal(node.expression, module, env);
        if (condition !== unknownLiteral)
          return condition
            ? walk(node.thenStatement, module, env, certain, children, nested)
            : node.elseStatement
              ? walk(node.elseStatement, module, env, certain, children, nested)
              : true;
        const thenEnv = forkEnvironment(env);
        const elseEnv = forkEnvironment(env);
        const first = walkBranch(node.thenStatement, module, thenEnv, children, nested);
        const second = node.elseStatement
          ? walkBranch(node.elseStatement, module, elseEnv, children, nested)
          : true;
        joinCapabilities(env, [
          ...(first !== false && first !== 'throw' ? [thenEnv] : []),
          ...(second !== false && second !== 'throw' ? [elseEnv] : []),
        ]);
        for (const key of env.keys()) env.set(key, unknownLiteral);
        return first === 'throw' && second === 'throw'
          ? 'throw'
          : (first === false || first === 'throw') && (second === false || second === 'throw')
            ? false
            : first !== true || second !== true
              ? null
              : true;
      }
      if (ts.isConditionalExpression(node)) {
        walk(node.condition, module, env, certain, children, nested);
        const condition = literal(node.condition, module, env);
        if (condition !== unknownLiteral)
          walk(condition ? node.whenTrue : node.whenFalse, module, env, certain, children, nested);
        else {
          const thenEnv = forkEnvironment(env);
          const elseEnv = forkEnvironment(env);
          const first = walk(node.whenTrue, module, thenEnv, false, children, nested);
          const second = walk(node.whenFalse, module, elseEnv, false, children, nested);
          joinCapabilities(env, [
            ...(first !== false ? [thenEnv] : []),
            ...(second !== false ? [elseEnv] : []),
          ]);
          for (const key of env.keys()) env.set(key, unknownLiteral);
        }
        return true;
      }
      if (ts.isForOfStatement(node)) {
        walk(node.expression, module, env, certain, children, nested);
        const loopEnv = forkEnvironment(env);
        const expression = unwrap(node.expression);
        if (
          ts.isCallExpression(expression) &&
          nativeObjectEnumeration(expression, module, env) &&
          ts.isVariableDeclarationList(node.initializer)
        ) {
          for (const declaration of node.initializer.declarations) {
            if (!ts.isIdentifier(declaration.name)) continue;
            const key = binding(declaration.name, module);
            if (key) capabilities(loopEnv).set(key, 'native');
          }
        }
        walk(node.statement, module, loopEnv, false, children, nested);
        joinCapabilities(env, [forkEnvironment(env), loopEnv]);
        for (const key of env.keys()) env.set(key, unknownLiteral);
        return true;
      }
      if (ts.isNewExpression(node)) {
        walk(node.expression, module, env, certain, children, nested);
        for (const argument of node.arguments ?? [])
          walk(argument, module, env, certain, children, nested);
        // Constructors are not replayed as ordinary helpers. Their unproved
        // effects can both mutate escaped aggregates and install earlier names.
        invalidateAggregates();
        opaque = true;
        return true;
      }
      if (ts.isCallExpression(node)) {
        walk(node.expression, module, env, certain, children, nested);
        const argumentValues: Literal[] = [];
        const argumentOrigins: CapabilityOrigin[] = [];
        const firstSpread = node.arguments.findIndex(ts.isSpreadElement);
        for (const argument of node.arguments) {
          walk(argument, module, env, certain, children, nested);
          if (ts.isSpreadElement(argument)) {
            const spread = unwrap(argument.expression);
            // Only a source-local plain array with an unchanged iterator
            // environment proves consumption has no hidden registration effects.
            if (
              aggregateAbsenceUnproved ||
              !ts.isArrayLiteralExpression(spread) ||
              spread.elements.some(ts.isSpreadElement)
            ) {
              invalidateAggregates();
              opaque = true;
            }
          }
          argumentValues.push(literal(argument, module, env));
          argumentOrigins.push(capabilityOrigin(argument, module, env));
        }
        if (memberName(node.expression) === 'method') {
          const owner = memberOwner(node.expression);
          const method = literal(node.arguments[0], module, env);
          const callable = node.arguments[1] ? functionFor(node.arguments[1], module) : null;
          if (owner && nativeValue(owner, module, env) && typeof method === 'string' && callable) {
            const frame = methodFrames[methodFrames.length - 1];
            if (frame) {
              const alternative = { ...callable, certain };
              if (certain) frame.set(method, [alternative]);
              else frame.set(method, [...(frame.get(method) ?? []), alternative]);
            }
          }
        }
        const producer = producerForCall(node, module.source);
        if (producer) {
          const entry = invoke(producer, certain, nested);
          const name = producerName(producer);
          if (entry && name !== null) {
            const result = entry.initializing
              ? UNKNOWN('initializing registration')
              : !entry.certain
                ? UNKNOWN('possible registration winner')
                : entry.result!;
            children.set(name, {
              kind: 'object',
              members: new Map([
                ['result', result],
                ['handle', result.kind === 'result' ? (result.handle ?? result) : result],
              ]),
            });
          }
          return true;
        }
        if (canonicalPrivilegedCall(node, module)) return true;
        const calleeBinding = binding(node.expression, module);
        const resolvedHelper = functionFor(node.expression, module);
        const helpers =
          (calleeBinding ? callableBindings.get(calleeBinding) : undefined) ??
          (resolvedHelper ? [{ ...resolvedHelper, certain: true }] : []);
        if (helpers.length > 0) {
          for (const helper of helpers) {
            if (helper.fn.asteriskToken) continue;
            const helperCertain = certain && helper.certain && helpers.length === 1;
            const helperEnv = forkEnvironment(env);
            const bindParameter = (
              name: ts.BindingName,
              incoming: Literal,
              incomingOrigin: CapabilityOrigin,
              initializer?: ts.Expression
            ): void => {
              let value = incoming;
              let origin = incomingOrigin;
              if (value === undefined && initializer) {
                walk(initializer, helper.module, helperEnv, helperCertain, children, nested);
                value = literal(initializer, helper.module, helperEnv);
                origin = capabilityOrigin(initializer, helper.module, helperEnv);
              } else if (value === unknownLiteral && initializer) {
                // Unknown is not proof of a supplied non-undefined value.
                walk(initializer, helper.module, helperEnv, false, children, nested);
                const fallback = capabilityOrigin(initializer, helper.module, helperEnv);
                if (fallback !== origin) origin = 'unknown';
              }
              if (!ts.isIdentifier(name)) {
                if (
                  typeof value !== 'object' ||
                  value === null ||
                  value.epoch !== aggregateEpoch ||
                  (ts.isArrayBindingPattern(name) && (!value.array || aggregateAbsenceUnproved))
                ) {
                  // Destructuring itself can invoke getters or an iterator,
                  // before any later parameter/default registration runs.
                  invalidateAggregates();
                  opaque = true;
                  value = unknownLiteral;
                }
                let index = 0;
                for (const element of name.elements) {
                  if (ts.isOmittedExpression(element)) {
                    index++;
                    continue;
                  }
                  let member: string | null = null;
                  if (ts.isArrayBindingPattern(name)) member = String(index++);
                  else if (element.propertyName) {
                    if (ts.isComputedPropertyName(element.propertyName)) {
                      walk(
                        element.propertyName.expression,
                        helper.module,
                        helperEnv,
                        helperCertain,
                        children,
                        nested
                      );
                      const key = literal(
                        element.propertyName.expression,
                        helper.module,
                        helperEnv
                      );
                      if (typeof key === 'string' || typeof key === 'number') member = String(key);
                    } else member = element.propertyName.text;
                  } else if (ts.isIdentifier(element.name)) member = element.name.text;
                  const ownMember =
                    member !== null &&
                    typeof value === 'object' &&
                    value !== null &&
                    value.epoch === aggregateEpoch &&
                    value.members.has(member);
                  const selected =
                    !element.dotDotDotToken &&
                    member !== null &&
                    typeof value === 'object' &&
                    value !== null &&
                    value.epoch === aggregateEpoch
                      ? value.members.has(member)
                        ? value.members.get(member)
                        : aggregateAbsenceUnproved ||
                            Object.hasOwn(inheritedMemberNames, member) ||
                            (value.members.has('length') && !/^(0|[1-9][0-9]*)$/.test(member))
                          ? unknownLiteral
                          : undefined
                      : unknownLiteral;
                  if (!ownMember && selected === unknownLiteral) {
                    invalidateAggregates();
                    opaque = true;
                  }
                  bindParameter(
                    element.name,
                    selected,
                    origin === 'authored' ? origin : 'unknown',
                    element.initializer
                  );
                }
                return;
              }
              const key = binding(name, helper.module);
              if (!key) return;
              helperEnv.set(key, value);
              capabilities(helperEnv).set(key, origin);
            };
            helper.fn.parameters.forEach((parameter, index) => {
              const uncertainPosition = firstSpread !== -1 && index >= firstSpread;
              bindParameter(
                parameter.name,
                parameter.dotDotDotToken || uncertainPosition
                  ? unknownLiteral
                  : index < argumentValues.length
                    ? argumentValues[index]
                    : undefined,
                uncertainPosition ? 'unknown' : (argumentOrigins[index] ?? 'authored'),
                parameter.initializer
              );
            });
            runFunction(helper.fn, helper.module, helperEnv, helperCertain, children, nested);
            for (const key of env.keys())
              if (helperEnv.has(key)) {
                env.set(key, helperEnv.get(key)!);
                const previous = capabilities(env).get(key) ?? 'unknown';
                const next = capabilities(helperEnv).get(key) ?? 'unknown';
                capabilities(env).set(
                  key,
                  helperCertain ? next : previous === next ? previous : 'unknown'
                );
              }
          }
        } else {
          let owner = unwrap(node.expression);
          while (ts.isPropertyAccessExpression(owner) || ts.isElementAccessExpression(owner))
            owner = unwrap(owner.expression);
          const key = ts.isIdentifier(owner) ? binding(owner, module) : undefined;
          // Calls through an admitted native setup/result parameter are owned
          // by Core. Other opaque calls may install names through active context.
          const origin = key ? capabilities(env).get(key) : undefined;
          const method =
            memberName(node.expression) === 'getMethod'
              ? literal(node.arguments[0], module, env)
              : undefined;
          const receiver = memberOwner(node.expression);
          const receiverBinding = receiver ? binding(receiver, module) : undefined;
          // A registered getMethod lookup only retrieves the authored callable.
          // Its later invocation is replayed through callableBindings; unlike
          // raw methods-map reads, this lookup has an exact source-backed target.
          const knownMethodLookup =
            origin === 'native-result' &&
            receiverBinding !== undefined &&
            typeof method === 'string' &&
            resultBindings.get(receiverBinding)?.methods?.has(method) === true;
          const admitted =
            origin === 'native' ||
            knownMethodLookup ||
            (origin === 'native-result' &&
              memberOwner(node.expression) !== null &&
              nativeValue(node.expression, module, env));
          if (!admitted && !nativeObjectEnumeration(node, module, env)) {
            invalidateAggregates();
            opaque = true;
          }
        }
        return true;
      }
      const control =
        ts.isIterationStatement(node, false) ||
        ts.isSwitchStatement(node) ||
        ts.isTryStatement(node);
      ts.forEachChild(node, (child) => {
        walk(child, module, env, certain && !control, children, nested);
      });
      return true;
    };
    return {
      entries,
      invoke,
      replayHelper: (node: ts.CallExpression, source: ts.SourceFile, certain: boolean) => {
        const module = moduleForSource(source);
        if (canonicalPrivilegedCall(node, module)) return;
        if (functionFor(node.expression, module))
          walk(node, module, new Map(), certain, new Map(), false);
      },
    };
  };

  /**
   * Each runtime setup chain caches the first `once` hook by configured name.
   * Resolve calls against only their lexical function/source unit: a separate
   * setup body or source file gets an independent runtime cache. If a distinct
   * same-name producer may have run first, its exact execution order is not
   * proved here, so the later call must not inherit its own producer summary.
   * Ordered setup effects share one name cache across the owner prefix and
   * source-known helpers. A definite nested winner supplies its contextual
   * cached handle; an unproved registration withholds the later producer's proof.
   *
   * Only a call that can run before the target counts as such a registration.
   * The runtime evaluates a statement in source order, so a later declarator,
   * a later argument or a later operand cannot have registered before the
   * target call. A call's own callee and arguments are evaluated before that
   * call runs, so a producer call nested in them is an earlier registration,
   * while a call that holds the target in its callee or arguments runs after
   * the target and is not one.
   *
   * That source order only holds for a declaration whose initializer is the
   * target call. A switch clause, a destructuring default, an assignment or
   * any other control flow does not establish the runtime order of the calls
   * it holds, so the whole statement is scanned there and any same-name
   * registration in it is refused.
   */
  const ownerRegistrationResults = new WeakMap<
    ts.Node,
    Map<
      string,
      {
        children: ReadonlyMap<string, HookSourceValue>;
        result: HookSourceValue;
      }[]
    >
  >();
  const replayPriorSameNameRegistration = (
    call: ts.CallExpression,
    producer: Producer,
    source: ts.SourceFile
  ): { value: HookSourceValue; hook?: string } | null => {
    const name = producerName(producer);
    if (name === null) return null;

    let boundary: ts.Node = source;
    for (
      let current: ts.Node | undefined = call.parent;
      current && !ts.isSourceFile(current);
      current = current.parent
    ) {
      if (isFunctionLike(current)) {
        boundary = current;
        break;
      }
    }

    const statements = ts.isSourceFile(boundary)
      ? boundary.statements
      : isFunctionLike(boundary) && boundary.body && ts.isBlock(boundary.body)
        ? boundary.body.statements
        : null;
    const targetStatement = statements?.find(
      (statement) =>
        statement.getStart(source) <= call.getStart(source) && statement.getEnd() >= call.getEnd()
    );
    const scanRoot = ts.isSourceFile(boundary)
      ? boundary
      : isFunctionLike(boundary) && boundary.body
        ? boundary.body
        : boundary;
    let conflict: { value: HookSourceValue; hook?: string } | null = null;
    let reachedTarget = false;
    // Rule predicates close over the owner's handles; invoking one does not
    // create a new once-registration instance. Keep lexical collision scanning
    // separate from the runtime owner used for canonical object identity.
    let identityOwner = boundary;
    if (isFunctionLike(boundary)) {
      let holder: ts.Node = boundary;
      while (holder.parent && !ts.isSourceFile(holder.parent) && !isFunctionLike(holder.parent)) {
        holder = holder.parent;
        if (ts.isCallExpression(holder) && memberName(holder.expression) === 'rule') {
          identityOwner = source;
          for (let outer: ts.Node | undefined = holder.parent; outer; outer = outer.parent) {
            if (isFunctionLike(outer)) {
              identityOwner = outer;
              break;
            }
          }
          break;
        }
      }
    }
    const ownerResults =
      ownerRegistrationResults.get(identityOwner) ??
      new Map<
        string,
        {
          children: ReadonlyMap<string, HookSourceValue>;
          result: HookSourceValue;
        }[]
      >();
    ownerRegistrationResults.set(identityOwner, ownerResults);
    const replay = createRegistrationReplay((installedProducer, children) => {
      const identity = producerIdentity(installedProducer);
      const candidates = ownerResults.get(identity) ?? [];
      const sameChildren = (previous: ReadonlyMap<string, HookSourceValue>): boolean => {
        if (previous.size !== children.size) return false;
        for (const [name, child] of children) {
          const other = previous.get(name);
          if (child === other) continue;
          if (
            child.kind !== 'object' ||
            other?.kind !== 'object' ||
            child.members.get('result') !== other.members.get('result') ||
            child.members.get('handle') !== other.members.get('handle')
          )
            return false;
        }
        return true;
      };
      const existing = candidates.find((candidate) => sameChildren(candidate.children));
      if (existing) return existing.result;
      const result = summarize(installedProducer, children).value;
      candidates.push({ children: new Map(children), result });
      ownerResults.set(identity, candidates);
      return result;
    });
    const priorRegistration = (
      node: ts.CallExpression,
      executesBefore: boolean,
      pathCertain: boolean
    ): { value: HookSourceValue; hook?: string } | null => {
      const earlier = producerForCall(node, source);
      if (!earlier) {
        if (executesBefore) replay.replayHelper(node, source, pathCertain);
        return null;
      }
      const earlierName = producerName(earlier);
      if ((earlierName === name || earlierName === null) && !sameProducer(earlier, producer))
        return { value: UNKNOWN('same-name producer may have registered first') };
      // Only an effect that ran before the target can supply a definite
      // winner. Later calls in the same statement are possible effects, not
      // proof of absence; their installs stay uncertain.
      if (!executesBefore) {
        replay.invoke(earlier, false, false);
        const possible = replay.entries.get(name);
        if (possible && !sameProducer(possible.producer, producer))
          return { value: UNKNOWN('same-name nested producer registration is unproved') };
        return null;
      }
      const earlierStatement = statements?.find(
        (statement) =>
          statement.getStart(source) <= node.getStart(source) && statement.getEnd() >= node.getEnd()
      );
      const definitelyExecuted =
        earlierStatement !== undefined &&
        ((ts.isExpressionStatement(earlierStatement) &&
          unwrap(earlierStatement.expression) === node) ||
          (ts.isVariableStatement(earlierStatement) &&
            earlierStatement.declarationList.declarations.some(
              (declaration) =>
                declaration.initializer !== undefined && unwrap(declaration.initializer) === node
            )));
      replay.invoke(earlier, pathCertain && definitelyExecuted && !reachedTarget, false);
      const installed = replay.entries.get(name);
      if (!installed) return null;
      if (
        installed.initializing ||
        !installed.result ||
        (!installed.certain &&
          (installed.opaqueBefore ||
            installed.owners.size !== 1 ||
            !sameProducer(installed.producer, producer)))
      )
        return { value: UNKNOWN('same-name nested producer registration is unproved') };
      const result = installed.result;
      const declaration = installed.producer.declaration;
      const hook =
        ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name)
          ? declaration.name.text
          : undefined;
      return {
        value: result.kind === 'result' ? (result.handle ?? result) : result,
        ...(hook ? { hook } : {}),
      };
    };

    /**
     * Whether the scan may stop at the target.
     *
     * The source order of a statement is the runtime order of its
     * declarations only when the target is the direct initializer of an
     * identifier-named declaration. Then a later declarator, a later
     * argument or a later operand cannot have registered before the target,
     * so the scan stops there and the rest of the statement is not read as
     * an earlier registration.
     *
     * Every other shape of statement does not establish that order, so the
     * whole statement is scanned and any same-name registration in it is
     * refused.
     */
    const cutoffAllowed =
      targetStatement !== undefined &&
      ts.isVariableStatement(targetStatement) &&
      targetStatement.declarationList.declarations.some(
        (declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.initializer !== undefined &&
          unwrap(declaration.initializer) === call
      );

    const visit = (node: ts.Node, pathCertain = true): void => {
      if (conflict) return;
      if (cutoffAllowed && reachedTarget) return;
      if (node !== call && isFunctionLike(node)) return;
      if (
        ts.isBinaryExpression(node) &&
        (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
          node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
          node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
          node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandEqualsToken ||
          node.operatorToken.kind === ts.SyntaxKind.BarBarEqualsToken ||
          node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionEqualsToken)
      ) {
        visit(node.left, pathCertain);
        const runs = registrationRightReachability(
          node.operatorToken.kind,
          registrationLiteral(node.left)
        );
        if (runs !== false) visit(node.right, pathCertain && runs === true);
        return;
      }
      if (ts.isConditionalExpression(node)) {
        visit(node.condition, pathCertain);
        const condition = registrationLiteral(node.condition);
        if (condition === unknownRegistrationLiteral) {
          visit(node.whenTrue, false);
          visit(node.whenFalse, false);
        } else visit(condition ? node.whenTrue : node.whenFalse, pathCertain);
        return;
      }
      if (ts.isIfStatement(node)) {
        visit(node.expression, pathCertain);
        const condition = unwrap(node.expression);
        if (condition.kind === ts.SyntaxKind.TrueKeyword) visit(node.thenStatement, pathCertain);
        else if (condition.kind === ts.SyntaxKind.FalseKeyword) {
          if (node.elseStatement) visit(node.elseStatement, pathCertain);
        } else {
          visit(node.thenStatement, false);
          if (node.elseStatement) visit(node.elseStatement, false);
        }
        return;
      }
      if (ts.isCallExpression(node)) {
        const reachedBefore = reachedTarget;
        // A call's callee and arguments are evaluated before the call itself
        // runs, so a producer call among them registered earlier.
        visit(node.expression, pathCertain);
        for (const argument of node.arguments) visit(argument, pathCertain);
        if (node === call) {
          reachedTarget = true;
          return;
        }
        // Only the bounded initializer scan can prove this enclosing call
        // runs later. Repeated control flow keeps whole-statement collisions.
        if (cutoffAllowed && reachedTarget && !reachedBefore) return;
        // A call registers after its own callee and arguments were evaluated.
        // It therefore runs before the target only when the target was not
        // reached while visiting this call's own subtree.
        const prior = priorRegistration(node, !reachedTarget, pathCertain);
        if (prior) conflict = prior;
        return;
      }
      const conditional =
        ts.isIterationStatement(node, false) ||
        ts.isSwitchStatement(node) ||
        ts.isTryStatement(node) ||
        ts.isConditionalExpression(node);
      ts.forEachChild(node, (child) => visit(child, pathCertain && !conditional));
    };

    if (statements && targetStatement) {
      for (const statement of statements) {
        visit(statement);
        if (statement === targetStatement || conflict) break;
      }
    } else {
      visit(scanRoot);
    }
    if (conflict) return conflict;
    // Initial calls and replayed calls enter the same owner-context capture
    // interner. No declaration-only/leaf fallback can split their graphs.
    const installed = replay.invoke(producer, true, false);
    if (
      !installed ||
      installed.initializing ||
      !installed.result ||
      (!installed.certain &&
        (installed.opaqueBefore ||
          installed.owners.size !== 1 ||
          !sameProducer(installed.producer, producer)))
    )
      return { value: UNKNOWN('unproved registration result') };
    const result = installed.result;
    return { value: result.kind === 'result' ? (result.handle ?? result) : result };
  };

  const activeRegistrationQueries = new Set<string>();
  const priorSameNameRegistration = (
    call: ts.CallExpression,
    producer: Producer,
    source: ts.SourceFile
  ): { value: HookSourceValue; hook?: string } | null => {
    // A producer's projection can evaluate another producer call while this
    // query is being answered. Re-entering the same query is unproved rather
    // than evidence that the name is free.
    const queryKey = producerIdentity(producer);
    if (activeRegistrationQueries.has(queryKey))
      return { value: UNKNOWN('producer registration cycle') };
    activeRegistrationQueries.add(queryKey);
    try {
      return replayPriorSameNameRegistration(call, producer, source);
    } finally {
      activeRegistrationQueries.delete(queryKey);
    }
  };

  const evaluate = (
    node: ts.Node,
    source: ts.SourceFile,
    environment: ReadonlyMap<string, HookSourceValue> = new Map()
  ): HookSourceResolution => {
    const value = unwrap(node);
    if (ts.isIdentifier(value)) {
      const held = environment.get(value.text);
      return held ? { matched: true, value: held } : { matched: false, value: UNKNOWN('unbound') };
    }
    if (ts.isObjectLiteralExpression(value)) {
      const members = new Map<string, HookSourceValue>();
      let matched = false;
      let uncertainKeys = false;
      const invalidateMembers = () => {
        uncertainKeys = true;
        for (const key of members.keys()) members.set(key, UNKNOWN('possibly overwritten member'));
      };
      for (const property of value.properties) {
        if (ts.isSpreadAssignment(property)) {
          const held = evaluate(property.expression, source, environment);
          matched ||= held.matched;
          if (held.value.kind !== 'object') invalidateMembers();
          else {
            if (held.value.uncertainKeys) invalidateMembers();
            for (const [key, member] of held.value.members) members.set(key, member);
          }
        } else if (ts.isShorthandPropertyAssignment(property)) {
          const held = evaluate(property.name, source, environment);
          matched ||= held.matched;
          members.set(property.name.text, held.value);
        } else if (ts.isPropertyAssignment(property)) {
          const key = ts.isComputedPropertyName(property.name)
            ? literalString(property.name.expression, moduleForSource(source), new Map())
            : propertyName(property.name);
          const held = evaluate(property.initializer, source, environment);
          matched ||= held.matched;
          if (key === null) {
            invalidateMembers();
            continue;
          }
          members.set(key, held.value);
        } else if (
          ts.isGetAccessorDeclaration(property) ||
          ts.isSetAccessorDeclaration(property) ||
          ts.isMethodDeclaration(property)
        ) {
          // Accessor and method members are not evaluated by this interpreter.
          // Do not silently omit them and certify an incomplete member set.
          invalidateMembers();
        }
      }
      return {
        matched,
        value: {
          kind: 'object',
          members,
          uncertainKeys,
        },
      };
    }
    if (ts.isConditionalExpression(value)) {
      const condition = unwrap(value.condition);
      if (condition.kind === ts.SyntaxKind.TrueKeyword)
        return evaluate(value.whenTrue, source, environment);
      if (condition.kind === ts.SyntaxKind.FalseKeyword)
        return evaluate(value.whenFalse, source, environment);
      const first = evaluate(value.whenTrue, source, environment);
      const second = evaluate(value.whenFalse, source, environment);
      return {
        matched: first.matched || second.matched,
        value: joinValues(first.value, second.value),
      };
    }
    if (ts.isCallExpression(value)) {
      const property = memberName(value.expression);
      const owner = memberOwner(value.expression);
      const callee = evaluate(value.expression, source, environment);
      if (callee.value.kind === 'callable' && callee.value.operation === 'getState') {
        const key = literalString(value.arguments[0], moduleForSource(source), new Map());
        if (key !== null && callee.value.result.stateHandles.has(key)) {
          return {
            matched: callee.matched,
            value: { kind: 'state', state: callee.value.result.stateHandles.get(key)! },
          };
        }
        return {
          matched: callee.matched,
          value: UNKNOWN(key === null ? 'dynamic state key' : `missing state ${key}`),
        };
      }
      if ((property === 'getAsHook' || property === 'getAsHookHandle') && owner) {
        const base = evaluate(owner, source, environment);
        const key = literalString(value.arguments[0], moduleForSource(source), new Map());
        if (base.value.kind === 'result' && key !== null && base.value.children.has(key)) {
          const entry = base.value.children.get(key)!;
          return property === 'getAsHook'
            ? { matched: base.matched, value: entry }
            : memberValue(entry, 'handle');
        }
        return {
          matched: base.matched,
          value: UNKNOWN(key === null ? 'dynamic child key' : `missing child ${key}`),
        };
      }
      const providerStates = canonicalFocusableStates(value, moduleForSource(source));
      if (providerStates) {
        const members = new Map<string, HookSourceValue>();
        for (const [name, proof] of providerStates) {
          members.set(name, {
            kind: 'state',
            state: {
              owner: proof.owner,
              declaration: proof.declaration,
              declaredName: proof.declaredName,
              variant: proof.declaredName,
              semantic: proof.semantic,
            },
          });
        }
        return { matched: true, value: { kind: 'object', members } };
      }
      const producer = producerForCall(value, source);
      if (producer) {
        const prior = priorSameNameRegistration(value, producer, source);
        if (prior)
          return {
            matched: true,
            ...prior,
          };
        const captured = summarize(producer);
        return captured.value.kind === 'result'
          ? { matched: true, value: captured.value.handle ?? captured.value }
          : captured;
      }
      if (callee.matched && callee.value.kind === 'unknown') return callee;
      const calleeValue = unwrap(value.expression);
      const imported = ts.isIdentifier(calleeValue)
        ? importedHookBinding(moduleForSource(source), calleeValue.text)
        : null;
      if (imported)
        return { matched: true, value: UNKNOWN(`unresolved imported hook ${imported.local}`) };
      return { matched: false, value: UNKNOWN('unresolved call') };
    }
    if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) {
      const owner = memberOwner(value);
      const name = memberName(value);
      if (!owner || name === null) return { matched: false, value: UNKNOWN('dynamic member') };
      const base = evaluate(owner, source, environment);
      if (!base.matched) return base;
      return memberValue(base.value, name);
    }
    if (ts.isArrayLiteralExpression(value)) {
      const members = new Map<string, HookSourceValue>();
      let index: number | null = 0;
      let matched = false;
      for (const element of value.elements) {
        if (ts.isOmittedExpression(element)) {
          if (index !== null) index++;
          continue;
        }
        const held = evaluate(
          ts.isSpreadElement(element) ? element.expression : element,
          source,
          environment
        );
        matched ||= held.matched;
        if (ts.isSpreadElement(element)) {
          if (
            index === null ||
            held.value.kind !== 'object' ||
            held.value.arrayLength === undefined
          ) {
            index = null;
            continue;
          }
          for (let offset = 0; offset < held.value.arrayLength; offset++) {
            const member = held.value.members.get(String(offset));
            if (member) members.set(String(index + offset), member);
          }
          index += held.value.arrayLength;
        } else if (index !== null) members.set(String(index++), held.value);
      }
      return {
        matched,
        value: {
          kind: 'object',
          members,
          ...(index === null ? { uncertainKeys: true } : { arrayLength: index }),
        },
      };
    }
    return { matched: false, value: UNKNOWN('unsupported expression') };
  };

  const summarize = (
    producer: Producer,
    replayedChildren?: ReadonlyMap<string, HookSourceValue>
  ): HookSourceResolution => {
    const key = `${producer.module.file}:${producer.declaration.getStart(producer.module.source)}`;
    const cached = replayedChildren === undefined ? summaryCache.get(key) : undefined;
    if (cached) return { matched: true, value: cached };
    if (summaryStack.has(key)) return { matched: true, value: UNKNOWN('producer cycle') };
    summaryStack.add(key);
    const nameProperty = configProperty(producer.config, 'name');
    const name = nameProperty
      ? literalString(propertyExpression(nameProperty), producer.module, new Map())
      : null;
    const setupProperty = configProperty(producer.config, 'setup');
    const setupExpression = setupProperty ? propertyExpression(setupProperty) : undefined;
    const setup = functionFor(setupExpression, producer.module);
    const stateHandles = new Map<string, HookSourceState>();
    const ambiguousStateHandles = new Set<string>();
    let stateFacadeProofInvalidated = false;
    const recordStateHandle = (state: HookSourceState): void => {
      const name = state.declaredName;
      if (ambiguousStateHandles.has(name)) return;
      const previous = stateHandles.get(name);
      if (
        previous &&
        (previous.variant !== state.variant || previous.semantic !== state.semantic)
      ) {
        stateHandles.delete(name);
        ambiguousStateHandles.add(name);
      } else if (!previous) {
        stateHandles.set(name, state);
      }
    };
    const children = new Map<string, HookSourceValue>();
    const childProducersByName = new Map<string, string>();
    const ambiguousChildNames = new Set<string>();
    let childNamesUncertain = false;
    const activeSetupFunctions = new Set<string>();
    let setupComplete = true;
    const markSetupUncertain = (): void => {
      setupComplete = false;
    };
    const registerChild = (
      childName: string | null,
      childProducer: Producer,
      childValue: HookSourceValue
    ): void => {
      if (childName === null) {
        childNamesUncertain = true;
        children.clear();
        markSetupUncertain();
        return;
      }
      if (childNamesUncertain || ambiguousChildNames.has(childName)) return;
      const identity = producerIdentity(childProducer);
      const previous = childProducersByName.get(childName);
      if (previous === undefined) {
        childProducersByName.set(childName, identity);
        children.set(childName, childValue);
      } else if (previous !== identity) {
        children.delete(childName);
        ambiguousChildNames.add(childName);
        markSetupUncertain();
      }
    };

    const collectSetup = (
      fn: ts.FunctionLikeDeclaration,
      module: Module,
      active: Set<string>,
      incomingConstants: ReadonlyMap<string, SetupLiteral> = new Map()
    ): void => {
      const functionKey = `${module.file}:${fn.getStart(module.source)}:${[...active]
        .sort()
        .join(',')}`;
      if (activeSetupFunctions.has(functionKey)) {
        markSetupUncertain();
        return;
      }
      activeSetupFunctions.add(functionKey);
      const strings = new Map<string, string>();
      let constants = new Map<string, SetupLiteral>();
      for (const parameter of fn.parameters) {
        if (!ts.isIdentifier(parameter.name)) continue;
        const binding = moduleContext.resolveReference(parameter.name, module);
        if (!binding) continue;
        const key = symbolKey(binding);
        const known = incomingConstants.get(key);
        if (known !== undefined && !hasBindingWrite(parameter.name, module))
          constants.set(key, known);
      }
      const localStates = new Map<string, HookSourceState>();
      const localStateBindings = new Map<string, HookSourceState>();
      const privilegedHandles = new Map<string, ReadonlyMap<string, ProviderStateProof>>();
      const invalidatedProviderMembers = new Map<
        ReadonlyMap<string, ProviderStateProof>,
        Set<string> | null
      >();
      const activeSubfacades = new Set<string>();
      const activeStateFacades = new Set<string>();
      const privilegedAccessible = new Set<string>();
      const stateFromProof = (proof: ProviderStateProof): HookSourceState => ({
        owner: producer.ref,
        declaration: proof.declaration,
        declaredName: proof.declaredName,
        variant: proof.declaredName,
        semantic: proof.semantic,
      });
      const privilegedState = (expression: ts.Expression): HookSourceState | undefined => {
        const value = unwrap(expression);
        if (!ts.isPropertyAccessExpression(value) && !ts.isElementAccessExpression(value))
          return undefined;
        const owner = unwrap(value.expression);
        if (!ts.isIdentifier(owner)) return undefined;
        const binding = moduleContext.resolveReference(owner, module);
        const states = binding && privilegedHandles.get(symbolKey(binding));
        const member = memberName(value);
        if (member === null || !states) return undefined;
        const proof = states.get(member);
        if (!proof) return undefined;
        const invalidated = invalidatedProviderMembers.get(states);
        if (invalidated === null || invalidated?.has(member)) return undefined;
        return stateFromProof(proof);
      };
      const providerMemberIsValid = (
        states: ReadonlyMap<string, ProviderStateProof>,
        member: string | null
      ): boolean => {
        if (member === null) return false;
        const invalidated = invalidatedProviderMembers.get(states);
        return invalidated === undefined || (invalidated !== null && !invalidated.has(member));
      };
      const providerAccess = (
        expression: ts.Node
      ): { states: ReadonlyMap<string, ProviderStateProof>; member: string | null } | null => {
        let value = unwrap(expression);
        while (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) {
          const owner = unwrap(value.expression);
          if (ts.isIdentifier(owner)) {
            const binding = moduleContext.resolveReference(owner, module);
            const states = binding ? privilegedHandles.get(symbolKey(binding)) : undefined;
            return states ? { states, member: memberName(value) } : null;
          }
          value = owner;
        }
        return null;
      };
      const invalidateProviderMember = (
        states: ReadonlyMap<string, ProviderStateProof>,
        member: string | null
      ): void => {
        const previous = invalidatedProviderMembers.get(states);
        if (previous === null) return;
        if (member === null) {
          invalidatedProviderMembers.set(states, null);
          return;
        }
        const invalidated = previous ?? new Set<string>();
        invalidated.add(member);
        invalidatedProviderMembers.set(states, invalidated);
      };
      const invalidateProviderAccess = (expression: ts.Node): void => {
        const access = providerAccess(expression);
        if (access) invalidateProviderMember(access.states, access.member);
      };
      const invalidateProviderWrite = (target: ts.Node): void => {
        const access = providerAccess(target);
        if (access) {
          invalidateProviderMember(access.states, access.member);
          return;
        }
        ts.forEachChild(target, invalidateProviderWrite);
      };
      const inspectEscapedProviderValue = (
        argument: ts.Node,
        valueModule: Module = module,
        seen = new Set<string>()
      ): 'found' | 'safe' | 'unknown' => {
        const value = unwrap(ts.isSpreadElement(argument) ? argument.expression : argument);
        if (ts.isIdentifier(value)) {
          const binding = moduleContext.resolveReference(value, valueModule);
          const states = binding ? privilegedHandles.get(symbolKey(binding)) : undefined;
          if (states) {
            invalidateProviderMember(states, null);
            return 'found';
          }
          if (
            !binding ||
            !ts.isVariableDeclaration(binding.declaration) ||
            !binding.declaration.initializer
          )
            return 'safe';
          const key = symbolKey(binding);
          if (seen.has(key)) return 'unknown';
          if (!stableVariable(binding.declaration, binding.module)) return 'unknown';
          return inspectEscapedProviderValue(
            binding.declaration.initializer,
            binding.module,
            new Set(seen).add(key)
          );
        }
        if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value))
          return 'safe';
        if (ts.isObjectLiteralExpression(value)) {
          let result: 'found' | 'safe' | 'unknown' = 'safe';
          for (const property of value.properties) {
            let current: 'found' | 'safe' | 'unknown' = 'safe';
            if (ts.isSpreadAssignment(property)) {
              current = inspectEscapedProviderValue(property.expression, valueModule, seen);
            } else if (ts.isShorthandPropertyAssignment(property)) {
              current = inspectEscapedProviderValue(property.name, valueModule, seen);
            } else if (ts.isPropertyAssignment(property)) {
              current = inspectEscapedProviderValue(property.initializer, valueModule, seen);
            } else if (
              ts.isMethodDeclaration(property) ||
              ts.isGetAccessorDeclaration(property) ||
              ts.isSetAccessorDeclaration(property)
            ) {
              current = 'safe';
            }
            if (current === 'found') result = 'found';
            else if (current === 'unknown' && result !== 'found') result = 'unknown';
          }
          return result;
        }
        if (ts.isArrayLiteralExpression(value)) {
          let result: 'found' | 'safe' | 'unknown' = 'safe';
          for (const element of value.elements) {
            if (ts.isOmittedExpression(element)) continue;
            const current = inspectEscapedProviderValue(element, valueModule, seen);
            if (current === 'found') result = 'found';
            else if (current === 'unknown' && result !== 'found') result = 'unknown';
          }
          return result;
        }
        if (ts.isConditionalExpression(value)) {
          const first = inspectEscapedProviderValue(value.whenTrue, valueModule, seen);
          const second = inspectEscapedProviderValue(value.whenFalse, valueModule, seen);
          if (first === 'found' || second === 'found') return 'found';
          if (first === 'unknown' || second === 'unknown') return 'unknown';
        }
        return 'safe';
      };
      const invalidateEscapedProviderArgument = (argument: ts.Node): void => {
        if (inspectEscapedProviderValue(argument) === 'unknown') markSetupUncertain();
      };
      const literalValue = (expression: ts.Node | undefined): SetupLiteral | null => {
        if (!expression) return null;
        const value = unwrap(expression);
        if (isStringValue(value)) return value.text;
        if (ts.isNumericLiteral(value)) return Number(value.text);
        if (value.kind === ts.SyntaxKind.TrueKeyword) return true;
        if (value.kind === ts.SyntaxKind.FalseKeyword) return false;
        if (ts.isIdentifier(value)) {
          const binding = moduleContext.resolveReference(value, module);
          const known = binding ? constants.get(symbolKey(binding)) : undefined;
          if (known !== undefined) return known;
          return literalString(value, module, strings);
        }
        return null;
      };
      const conditionValue = (expression: ts.Node): boolean | null => {
        const value = unwrap(expression);
        if (!ts.isBinaryExpression(value)) return null;
        const left = literalValue(value.left);
        const right = literalValue(value.right);
        if (left === null || right === null) return null;
        switch (value.operatorToken.kind) {
          case ts.SyntaxKind.EqualsEqualsToken:
            if (typeof left !== typeof right) return null;
            return left === right;
          case ts.SyntaxKind.EqualsEqualsEqualsToken:
            return left === right;
          case ts.SyntaxKind.ExclamationEqualsToken:
            if (typeof left !== typeof right) return null;
            return left !== right;
          case ts.SyntaxKind.ExclamationEqualsEqualsToken:
            return left !== right;
          default:
            return null;
        }
      };
      const providerStatesFor = (
        expression: ts.Expression
      ): ReadonlyMap<string, ProviderStateProof> | null => {
        const value = unwrap(expression);
        if (ts.isCallExpression(value)) return canonicalFocusableStates(value, module);
        if (ts.isConditionalExpression(value)) {
          const condition = conditionValue(value.condition);
          if (condition === true) return providerStatesFor(value.whenTrue);
          if (condition === false) return providerStatesFor(value.whenFalse);
        }
        return null;
      };
      const stateFromHandle = (expression: ts.Node): HookSourceState | undefined => {
        const value = unwrap(expression);
        if (ts.isIdentifier(value)) {
          const binding = moduleContext.resolveReference(value, module);
          return binding ? localStateBindings.get(symbolKey(binding)) : undefined;
        }
        return ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)
          ? privilegedState(value)
          : undefined;
      };
      const finiteExposureLoop = (node: ts.ForOfStatement): boolean => {
        const initializer = node.initializer;
        if (!ts.isVariableDeclarationList(initializer) || initializer.declarations.length !== 1)
          return false;
        const declaration = initializer.declarations[0];
        if (!ts.isArrayBindingPattern(declaration.name) || declaration.name.elements.length !== 2)
          return false;
        const keyElement = declaration.name.elements[0];
        const stateElement = declaration.name.elements[1];
        if (
          !ts.isBindingElement(keyElement) ||
          !ts.isBindingElement(stateElement) ||
          !ts.isIdentifier(keyElement.name) ||
          !ts.isIdentifier(stateElement.name)
        )
          return false;
        const keyName = keyElement.name;
        const stateName = stateElement.name;
        const expression = unwrap(node.expression);
        if (
          !ts.isCallExpression(expression) ||
          !ts.isPropertyAccessExpression(expression.expression)
        )
          return false;
        if (
          expression.expression.name.text !== 'entries' ||
          !ts.isIdentifier(unwrap(expression.expression.expression))
        )
          return false;
        const object = expression.arguments[0] ? unwrap(expression.arguments[0]) : null;
        if (!object || !ts.isObjectLiteralExpression(object)) return false;
        const entries = new Map<string, HookSourceState>();
        for (const property of object.properties) {
          if (ts.isSpreadAssignment(property)) return false;
          const key = propertyName(
            ts.isPropertyAssignment(property) ||
              ts.isMethodDeclaration(property) ||
              ts.isGetAccessorDeclaration(property) ||
              ts.isSetAccessorDeclaration(property)
              ? property.name
              : ts.isShorthandPropertyAssignment(property)
                ? property.name
                : undefined
          );
          if (key === null) return false;
          const value = ts.isShorthandPropertyAssignment(property)
            ? property.name
            : ts.isPropertyAssignment(property)
              ? property.initializer
              : null;
          const state = value && privilegedState(value);
          const localValue = value ? unwrap(value) : null;
          const local =
            localValue && ts.isIdentifier(localValue)
              ? localStates.get(localValue.text)
              : undefined;
          if (!state && !local) return false;
          entries.set(key, state ?? local!);
        }
        let captured = false;
        const visit = (current: ts.Node): void => {
          if (current !== node.statement && isFunctionLike(current)) return;
          if (ts.isCallExpression(current)) {
            const callExpression = unwrap(current.expression);
            const owner = memberOwner(callExpression);
            const container = owner ? memberOwner(owner) : null;
            const containerValue = container ? unwrap(container) : null;
            const ownerValue =
              owner && (ts.isPropertyAccessExpression(owner) || ts.isElementAccessExpression(owner))
                ? owner
                : null;
            const binding =
              containerValue && ts.isIdentifier(containerValue)
                ? moduleContext.resolveReference(containerValue, module)
                : null;
            if (
              ownerValue &&
              containerValue &&
              ts.isIdentifier(containerValue) &&
              binding &&
              activeBindings.has(symbolKey(binding)) &&
              memberName(callExpression) === 'state' &&
              isExposeStateCall(ownerValue, containerValue.text) &&
              current.arguments.length > 1
            ) {
              const key = unwrap(current.arguments[0]);
              const value = unwrap(current.arguments[1]);
              if (
                ts.isIdentifier(key) &&
                key.text === keyName.text &&
                ts.isIdentifier(value) &&
                value.text === stateName.text
              ) {
                for (const state of entries.values()) recordStateHandle(state);
                captured = true;
              }
            }
          }
          ts.forEachChild(current, visit);
        };
        visit(node.statement);
        return captured;
      };
      const finiteNonStateLoop = (node: ts.ForOfStatement): boolean => {
        const expression = unwrap(node.expression);
        if (!ts.isArrayLiteralExpression(expression)) return false;
        if (!expression.elements.every((element) => ts.isStringLiteralLike(element))) return false;
        let uncertain = false;
        const visit = (current: ts.Node): void => {
          if (uncertain || (current !== node.statement && isFunctionLike(current))) return;
          if (ts.isCallExpression(current)) {
            const call = unwrap(current.expression);
            const owner = memberOwner(call);
            const container = owner ? memberOwner(owner) : null;
            const containerValue = container ? unwrap(container) : null;
            const binding =
              containerValue && ts.isIdentifier(containerValue)
                ? moduleContext.resolveReference(containerValue, module)
                : null;
            const method = memberName(call);
            if (binding && activeBindings.has(symbolKey(binding)) && method === 'state')
              uncertain = true;
            if (current.arguments.length > 0) {
              for (const argument of current.arguments) {
                const value = unwrap(argument);
                const argumentBinding = ts.isIdentifier(value)
                  ? moduleContext.resolveReference(value, module)
                  : null;
                if (argumentBinding && activeBindings.has(symbolKey(argumentBinding)))
                  uncertain = true;
              }
            }
          }
          ts.forEachChild(current, visit);
        };
        visit(node.statement);
        return !uncertain;
      };
      const activeBindings = new Set<string>();
      const provedDefinitionArguments = new WeakSet<ts.Node>();
      for (const parameter of fn.parameters) {
        if (!ts.isIdentifier(parameter.name) || !active.has(parameter.name.text)) continue;
        const binding = moduleContext.resolveReference(parameter.name, module);
        if (binding && !hasBindingWrite(parameter.name, module))
          activeBindings.add(symbolKey(binding));
      }
      const isValueIdentifier = (node: ts.Node): node is ts.Identifier => {
        if (!ts.isIdentifier(node)) return false;
        const parent = node.parent;
        if (!parent) return true;
        if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
        if (ts.isBindingElement(parent) && parent.propertyName === node) return false;
        if (
          (ts.isVariableDeclaration(parent) ||
            ts.isParameter(parent) ||
            ts.isBindingElement(parent) ||
            ts.isPropertyAssignment(parent) ||
            ts.isPropertyDeclaration(parent) ||
            ts.isMethodDeclaration(parent) ||
            ts.isFunctionDeclaration(parent) ||
            ts.isClassDeclaration(parent) ||
            ts.isGetAccessorDeclaration(parent) ||
            ts.isSetAccessorDeclaration(parent)) &&
          parent.name === node
        )
          return false;
        if (
          (ts.isLabeledStatement(parent) ||
            ts.isBreakStatement(parent) ||
            ts.isContinueStatement(parent)) &&
          parent.label === node
        )
          return false;
        // A shorthand property is a value read, unlike an ordinary static key.
        return true;
      };
      const isActiveStateFacadeExpression = (expression: ts.Node): boolean => {
        const value = unwrap(expression);
        if (ts.isIdentifier(value)) {
          if (activeStateFacades.size === 0) return false;
          if (!isValueIdentifier(value)) return false;
          const binding = moduleContext.resolveReference(value, module);
          return !!binding && activeStateFacades.has(symbolKey(binding));
        }
        if (
          (!ts.isPropertyAccessExpression(value) && !ts.isElementAccessExpression(value)) ||
          memberName(value) !== 'state'
        )
          return false;
        const owner = unwrap(value.expression);
        if (!ts.isIdentifier(owner)) return false;
        const binding = moduleContext.resolveReference(owner, module);
        return !!binding && activeBindings.has(symbolKey(binding));
      };
      const isFacadeAliasInitializer = (node: ts.Node): boolean => {
        let parent = node.parent;
        while (
          parent &&
          (ts.isParenthesizedExpression(parent) ||
            ts.isAsExpression(parent) ||
            ts.isTypeAssertionExpression(parent) ||
            ts.isNonNullExpression(parent))
        )
          parent = parent.parent;
        return !!(
          parent &&
          ts.isVariableDeclaration(parent) &&
          parent.initializer &&
          unwrap(parent.initializer) === unwrap(node) &&
          ts.isIdentifier(parent.name) &&
          stableVariable(parent, module)
        );
      };
      const isFacadeMemberOwner = (node: ts.Node): boolean => {
        let parent = node.parent;
        while (
          parent &&
          (ts.isParenthesizedExpression(parent) ||
            ts.isAsExpression(parent) ||
            ts.isTypeAssertionExpression(parent) ||
            ts.isNonNullExpression(parent))
        )
          parent = parent.parent;
        return !!(
          parent &&
          (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
          unwrap(parent.expression) === unwrap(node)
        );
      };
      const isStateFacadeMemberWrite = (target: ts.Node): boolean => {
        let value = unwrap(target);
        while (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) {
          const owner = memberOwner(value);
          if (owner && isActiveStateFacadeExpression(owner)) return true;
          if (memberName(value) === 'state' && owner && ts.isIdentifier(unwrap(owner))) {
            const binding = moduleContext.resolveReference(unwrap(owner), module);
            if (binding && activeBindings.has(symbolKey(binding))) return true;
          }
          if (!owner) break;
          value = unwrap(owner);
        }
        return false;
      };
      const invalidateStateFacadeWrite = (target: ts.Node): void => {
        if (isStateFacadeMemberWrite(target)) {
          stateFacadeProofInvalidated = true;
          markSetupUncertain();
          return;
        }
        ts.forEachChild(target, (child) => invalidateStateFacadeWrite(child));
      };
      const capturesActive = (candidate: ts.FunctionLikeDeclaration): boolean => {
        let captured = false;
        const visit = (current: ts.Node): void => {
          if (
            captured ||
            ts.isTypeNode(current) ||
            (current !== candidate && isFunctionLike(current))
          )
            return;
          if (isValueIdentifier(current)) {
            const binding = moduleContext.resolveReference(current, module);
            if (
              binding &&
              (activeBindings.has(symbolKey(binding)) ||
                activeSubfacades.has(symbolKey(binding)) ||
                activeStateFacades.has(symbolKey(binding)))
            ) {
              stateFacadeProofInvalidated = true;
              captured = true;
              return;
            }
          }
          ts.forEachChild(current, visit);
        };
        if (candidate.body) visit(candidate.body);
        return captured;
      };
      const providerValueEscapes = (expression: ts.Node): boolean => {
        const value = unwrap(ts.isSpreadElement(expression) ? expression.expression : expression);
        if (ts.isIdentifier(value)) {
          const binding = moduleContext.resolveReference(value, module);
          return !!binding && privilegedHandles.has(symbolKey(binding));
        }
        return !!providerAccess(value);
      };
      const providerWriteTarget = (target: ts.Node): boolean => {
        if (providerAccess(target)) return true;
        let found = false;
        ts.forEachChild(target, (child) => {
          if (!found && providerWriteTarget(child)) found = true;
        });
        return found;
      };
      const capturesProviderMutationOrEscape = (candidate: ts.FunctionLikeDeclaration): boolean => {
        let captured = false;
        const visit = (current: ts.Node): void => {
          if (captured || (current !== candidate && isFunctionLike(current))) return;
          if (
            ts.isBinaryExpression(current) &&
            current.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
            current.operatorToken.kind <= ts.SyntaxKind.LastAssignment
          ) {
            captured = providerWriteTarget(current.left);
          } else if (
            (ts.isPrefixUnaryExpression(current) || ts.isPostfixUnaryExpression(current)) &&
            (current.operator === ts.SyntaxKind.PlusPlusToken ||
              current.operator === ts.SyntaxKind.MinusMinusToken)
          ) {
            captured = providerWriteTarget(current.operand);
          } else if (ts.isDeleteExpression(current)) {
            captured = providerWriteTarget(current.expression);
          } else if (
            (ts.isCallExpression(current) || ts.isNewExpression(current)) &&
            current.arguments?.some((argument) => providerValueEscapes(argument))
          ) {
            captured = true;
          } else if (ts.isReturnStatement(current) && current.expression) {
            captured = providerValueEscapes(current.expression);
          }
          if (captured) return;
          ts.forEachChild(current, visit);
        };
        if (candidate.body) visit(candidate.body);
        return captured;
      };
      const containsActiveBinding = (argument: ts.Node): boolean => {
        const value = unwrap(ts.isSpreadElement(argument) ? argument.expression : argument);
        let found = false;
        const visit = (current: ts.Node): void => {
          if (found || ts.isTypeNode(current)) return;
          if (isValueIdentifier(current) && active.has(current.text)) {
            const binding = moduleContext.resolveReference(current, module);
            if (binding && activeBindings.has(symbolKey(binding))) {
              found = true;
              return;
            }
          }
          ts.forEachChild(current, visit);
        };
        visit(value);
        return found;
      };
      const walk = (node: ts.Node): void => {
        if (ts.isTypeNode(node)) return;
        if (node !== fn && isFunctionLike(node)) {
          let parent = node.parent;
          while (
            parent &&
            (ts.isParenthesizedExpression(parent) ||
              ts.isAsExpression(parent) ||
              ts.isTypeAssertionExpression(parent) ||
              ts.isNonNullExpression(parent))
          )
            parent = parent.parent;
          if (parent && ts.isCallExpression(parent) && unwrap(parent.expression) === node) {
            const helperActive = new Set<string>();
            const helperConstants = new Map<string, SetupLiteral>();
            let unprovedActiveArgument = false;
            for (let index = 0; index < parent.arguments.length; index++) {
              const argument = parent.arguments[index];
              const value = argument
                ? unwrap(ts.isSpreadElement(argument) ? argument.expression : argument)
                : null;
              const argumentBinding =
                value && ts.isIdentifier(value)
                  ? moduleContext.resolveReference(value, module)
                  : null;
              if (argumentBinding && activeBindings.has(symbolKey(argumentBinding))) {
                const parameter = node.parameters[index];
                if (parameter && ts.isIdentifier(parameter.name) && !parameter.dotDotDotToken)
                  helperActive.add(parameter.name.text);
                else unprovedActiveArgument = true;
              } else if (containsActiveBinding(argument)) {
                unprovedActiveArgument = true;
              }
            }
            for (let index = 0; index < node.parameters.length; index++) {
              const parameter = node.parameters[index];
              if (!ts.isIdentifier(parameter.name)) continue;
              const argument = parent.arguments[index];
              const known = argument ? literalValue(argument) : literalValue(parameter.initializer);
              const binding = moduleContext.resolveReference(parameter.name, module);
              if (known !== null && binding) helperConstants.set(symbolKey(binding), known);
            }
            const deferred =
              !!node.asteriskToken ||
              !!node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword);
            if (node.parameters.length === 0 && !deferred && !unprovedActiveArgument) {
              if (node.body) walk(node.body);
            } else if (!deferred && helperActive.size > 0 && !unprovedActiveArgument) {
              for (const argument of parent.arguments)
                provedDefinitionArguments.add(unwrap(argument));
              collectSetup(node, module, helperActive, helperConstants);
            } else if (
              unprovedActiveArgument ||
              capturesActive(node) ||
              capturesProviderMutationOrEscape(node)
            ) {
              markSetupUncertain();
            }
          } else if (capturesActive(node) || capturesProviderMutationOrEscape(node)) {
            markSetupUncertain();
          }
          return;
        }
        if (
          isValueIdentifier(node) &&
          active.has(node.text) &&
          !isFacadeMemberOwner(node) &&
          !provedDefinitionArguments.has(node) &&
          !isFacadeAliasInitializer(node)
        ) {
          const binding = moduleContext.resolveReference(node, module);
          if (binding && activeBindings.has(symbolKey(binding))) {
            // An opaque owner escape can replace State constructors through
            // the Def even when no State-facade alias itself escapes.
            stateFacadeProofInvalidated = true;
            markSetupUncertain();
          }
        }
        if (isActiveStateFacadeExpression(node)) {
          if (!isFacadeAliasInitializer(node) && !isFacadeMemberOwner(node)) {
            stateFacadeProofInvalidated = true;
            markSetupUncertain();
          }
        }
        if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
          const owner = memberOwner(node);
          if (owner && isActiveStateFacadeExpression(owner)) {
            let parent = node.parent;
            while (
              parent &&
              (ts.isParenthesizedExpression(parent) ||
                ts.isAsExpression(parent) ||
                ts.isTypeAssertionExpression(parent) ||
                ts.isNonNullExpression(parent))
            )
              parent = parent.parent;
            const calledAsFacadeMethod =
              parent &&
              ts.isCallExpression(parent) &&
              unwrap(parent.expression) === node &&
              memberName(node) !== null;
            if (!calledAsFacadeMethod) markSetupUncertain();
          }
        }
        if (
          ts.isBinaryExpression(node) &&
          node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
          node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
        ) {
          invalidateProviderWrite(node.left);
          invalidateStateFacadeWrite(node.left);
        } else if (
          (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
          (node.operator === ts.SyntaxKind.PlusPlusToken ||
            node.operator === ts.SyntaxKind.MinusMinusToken)
        ) {
          invalidateProviderAccess(node.operand);
          invalidateStateFacadeWrite(node.operand);
        } else if (ts.isDeleteExpression(node)) {
          invalidateProviderAccess(node.expression);
          invalidateStateFacadeWrite(node.expression);
        } else if (
          (ts.isForInStatement(node) || ts.isForOfStatement(node)) &&
          ts.isExpression(node.initializer)
        ) {
          invalidateProviderAccess(node.initializer);
          invalidateStateFacadeWrite(node.initializer);
        }
        if (
          ts.isVariableDeclaration(node) &&
          ts.isObjectBindingPattern(node.name) &&
          node.initializer
        ) {
          const initializer = unwrap(node.initializer);
          let states: ReadonlyMap<string, ProviderStateProof> | null = null;
          if (ts.isCallExpression(initializer)) {
            states = canonicalFocusableStates(initializer, module);
          } else if (ts.isIdentifier(initializer)) {
            const sourceBinding = moduleContext.resolveReference(initializer, module);
            states = sourceBinding
              ? (privilegedHandles.get(symbolKey(sourceBinding)) ?? null)
              : null;
          }
          const stablePattern = (() => {
            const list = node.parent;
            if (!ts.isVariableDeclarationList(list) || (list.flags & ts.NodeFlags.Const) === 0)
              return false;
            return node.name.elements.every(
              (element) =>
                !ts.isBindingElement(element) ||
                !ts.isIdentifier(element.name) ||
                !hasBindingWrite(element.name, module)
            );
          })();
          if (states && stablePattern) {
            for (const element of node.name.elements) {
              if (!ts.isBindingElement(element) || element.dotDotDotToken) continue;
              if (!ts.isIdentifier(element.name)) continue;
              const property = element.propertyName ?? element.name;
              const key =
                ts.isIdentifier(property) || ts.isStringLiteralLike(property)
                  ? property.text
                  : null;
              const proof = key === null ? undefined : states.get(key);
              if (proof && providerMemberIsValid(states, key)) {
                const state = stateFromProof(proof);
                localStates.set(element.name.text, state);
                const binding = moduleContext.resolveReference(element.name, module);
                if (binding) localStateBindings.set(symbolKey(binding), state);
              }
            }
          }
        }
        if (ts.isForOfStatement(node)) {
          if (!finiteExposureLoop(node) && !finiteNonStateLoop(node)) markSetupUncertain();
        } else if (
          ts.isIfStatement(node) ||
          ts.isConditionalExpression(node) ||
          ts.isSwitchStatement(node) ||
          ts.isForStatement(node) ||
          ts.isForInStatement(node) ||
          ts.isWhileStatement(node) ||
          ts.isDoStatement(node) ||
          ts.isTryStatement(node)
        ) {
          markSetupUncertain();
        }
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
          const binding = moduleContext.resolveReference(node.name, module);
          const literal = literalString(node.initializer, module, strings);
          const known = literalValue(node.initializer);
          if (literal !== null && binding && stableVariable(node, module))
            strings.set(symbolKey(binding), literal);
          if (known !== null && binding && stableVariable(node, module))
            constants = new Map(constants).set(symbolKey(binding), known);
          const initializer = unwrap(node.initializer);
          if (
            (ts.isPropertyAccessExpression(initializer) ||
              ts.isElementAccessExpression(initializer)) &&
            ts.isIdentifier(unwrap(initializer.expression))
          ) {
            const ownerBinding = moduleContext.resolveReference(
              unwrap(initializer.expression),
              module
            );
            if (ownerBinding && activeBindings.has(symbolKey(ownerBinding)) && binding) {
              activeSubfacades.add(symbolKey(binding));
              if (memberName(initializer) === 'state' && stableVariable(node, module))
                activeStateFacades.add(symbolKey(binding));
            }
          }
          if (ts.isCallExpression(initializer) || ts.isConditionalExpression(initializer)) {
            const states = providerStatesFor(initializer);
            if (states && binding && stableVariable(node, module))
              privilegedHandles.set(symbolKey(binding), states);
            if (
              ts.isCallExpression(initializer) &&
              canonicalAccessibleCall(initializer, module) &&
              binding &&
              stableVariable(node, module)
            )
              privilegedAccessible.add(symbolKey(binding));
            if (
              ts.isConditionalExpression(initializer) &&
              conditionValue(initializer.condition) === null &&
              (providerStatesFor(initializer.whenTrue) || providerStatesFor(initializer.whenFalse))
            )
              markSetupUncertain();
          }
          const observed = ts.isExpression(initializer) ? privilegedState(initializer) : undefined;
          if (observed && stableVariable(node, module)) {
            localStates.set(node.name.text, observed);
            if (binding) localStateBindings.set(symbolKey(binding), observed);
          }
          if (
            ts.isIdentifier(initializer) &&
            active.has(initializer.text) &&
            stableVariable(node, module)
          ) {
            const initializerBinding = moduleContext.resolveReference(initializer, module);
            if (
              initializerBinding &&
              binding &&
              activeBindings.has(symbolKey(initializerBinding))
            ) {
              active.add(node.name.text);
              activeBindings.add(symbolKey(binding));
            }
          }
          if (ts.isIdentifier(initializer) && stableVariable(node, module)) {
            const state = stateFromHandle(initializer);
            if (state && binding) {
              localStates.set(node.name.text, state);
              localStateBindings.set(symbolKey(binding), state);
            }
            const sourceBinding = moduleContext.resolveReference(initializer, module);
            const targetBinding = moduleContext.resolveReference(node.name, module);
            if (sourceBinding && targetBinding && activeStateFacades.has(symbolKey(sourceBinding)))
              activeStateFacades.add(symbolKey(targetBinding));
            const states = sourceBinding && privilegedHandles.get(symbolKey(sourceBinding));
            if (states && targetBinding) privilegedHandles.set(symbolKey(targetBinding), states);
            if (
              sourceBinding &&
              targetBinding &&
              privilegedAccessible.has(symbolKey(sourceBinding))
            )
              privilegedAccessible.add(symbolKey(targetBinding));
          }
        }
        if (ts.isCallExpression(node)) {
          const expression = unwrap(node.expression);
          const stateOwner = memberOwner(expression);
          const stateContainer = stateOwner ? memberOwner(stateOwner) : null;
          const stateMethod = memberName(expression);
          const stateOwnerExpression =
            stateOwner && ts.isExpression(stateOwner) ? stateOwner : null;
          const stateContainerExpression = stateContainer ? unwrap(stateContainer) : null;
          const stateContainerBinding =
            stateContainerExpression && ts.isIdentifier(stateContainerExpression)
              ? moduleContext.resolveReference(stateContainerExpression, module)
              : null;
          const activeContainer =
            !!stateContainerBinding && activeBindings.has(symbolKey(stateContainerBinding));
          const subfacadeOwner = stateOwner ? unwrap(stateOwner) : null;
          const subfacadeBinding =
            subfacadeOwner && ts.isIdentifier(subfacadeOwner)
              ? moduleContext.resolveReference(subfacadeOwner, module)
              : null;
          const activeStateFacade =
            !!subfacadeBinding && activeStateFacades.has(symbolKey(subfacadeBinding));
          if (
            subfacadeBinding &&
            activeSubfacades.has(symbolKey(subfacadeBinding)) &&
            !activeStateFacade
          )
            markSetupUncertain();
          if (
            stateOwner &&
            stateMethod &&
            !stateFacadeProofInvalidated &&
            (activeStateFacade ||
              (stateContainer && activeContainer && memberName(stateOwner) === 'state'))
          ) {
            if (
              ts.isPropertyAccessExpression(expression) ||
              ts.isElementAccessExpression(expression)
            ) {
              const declaredValue = literalValue(node.arguments[0]);
              const declared = typeof declaredValue === 'string' ? declaredValue : null;
              if (declared !== null) {
                const state = {
                  owner: producer.ref,
                  declaration: sourceRef(node),
                  declaredName: declared,
                  variant: stateMethod,
                };
                recordStateHandle(state);
                const parent = node.parent;
                if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
                  localStates.set(parent.name.text, state);
                  const binding = moduleContext.resolveReference(parent.name, module);
                  if (binding) localStateBindings.set(symbolKey(binding), state);
                }
              } else {
                markSetupUncertain();
              }
            }
          }
          if (
            stateOwner &&
            stateContainer &&
            activeContainer &&
            stateMethod === 'state' &&
            stateContainerExpression &&
            ts.isIdentifier(stateContainerExpression) &&
            stateOwnerExpression &&
            isExposeStateCall(stateOwnerExpression, stateContainerExpression.text) &&
            node.arguments.length > 1
          ) {
            const handle = unwrap(node.arguments[1]);
            const state = stateFromHandle(handle);
            if (state) recordStateHandle(state);
            else markSetupUncertain();
          } else if (stateOwner && stateContainer && activeContainer && stateMethod === 'state') {
            markSetupUncertain();
          }
          const exposedStateCall =
            activeContainer &&
            stateMethod === 'state' &&
            stateContainerExpression &&
            ts.isIdentifier(stateContainerExpression) &&
            stateOwnerExpression &&
            isExposeStateCall(stateOwnerExpression, stateContainerExpression.text);
          if (stateMethod === 'state' && node.arguments.length > 1 && !exposedStateCall) {
            const accessibleOwner = stateOwner ? unwrap(stateOwner) : null;
            const accessibleBinding =
              accessibleOwner && ts.isIdentifier(accessibleOwner)
                ? moduleContext.resolveReference(accessibleOwner, module)
                : null;
            const directAccessible =
              accessibleOwner && ts.isCallExpression(accessibleOwner)
                ? canonicalAccessibleCall(accessibleOwner, module)
                : false;
            // A11y.state mutates the A11y IR, not Def capture. Keep a proven
            // canonical A11y call closed, but never synthesize its argument as
            // a parent state handle.
            if (
              !directAccessible &&
              !(accessibleBinding && privilegedAccessible.has(symbolKey(accessibleBinding)))
            )
              markSetupUncertain();
          }
          const childProducer = producerForCall(node, module.source);
          if (childProducer) {
            const child = summarize(childProducer);
            const childName =
              child.value.kind === 'result' ? child.value.name : producerName(childProducer);
            const childValue: HookSourceValue =
              child.value.kind === 'result'
                ? {
                    kind: 'object',
                    members: new Map<string, HookSourceValue>([
                      ['result', child.value],
                      ['handle', child.value.handle ?? child.value],
                    ]),
                  }
                : child.value;
            registerChild(childName, childProducer, childValue);
          } else {
            const callee = ts.isIdentifier(expression) ? expression : null;
            const activeArguments: number[] = [];
            let unprovedActiveArgument = false;
            for (let index = 0; index < node.arguments.length; index++) {
              const argument = node.arguments[index];
              const value = unwrap(ts.isSpreadElement(argument) ? argument.expression : argument);
              const binding = ts.isIdentifier(value)
                ? moduleContext.resolveReference(value, module)
                : null;
              if (binding && activeBindings.has(symbolKey(binding))) activeArguments.push(index);
              else if (containsActiveBinding(argument)) unprovedActiveArgument = true;
            }
            if (activeArguments.length > 0 || unprovedActiveArgument) {
              const helper = callee ? functionFor(callee, module) : null;
              if (!helper) {
                markSetupUncertain();
              } else if (
                helper.fn.asteriskToken ||
                helper.fn.modifiers?.some(
                  (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword
                )
              ) {
                markSetupUncertain();
                ts.forEachChild(node, walk);
                return;
              } else {
                const helperActive = new Set<string>();
                for (const index of activeArguments) {
                  const parameter = helper.fn.parameters[index];
                  if (parameter && ts.isIdentifier(parameter.name) && !parameter.dotDotDotToken)
                    helperActive.add(parameter.name.text);
                  else unprovedActiveArgument = true;
                }
                const helperConstants = new Map<string, SetupLiteral>();
                for (let index = 0; index < helper.fn.parameters.length; index++) {
                  const parameter = helper.fn.parameters[index];
                  if (!ts.isIdentifier(parameter.name)) continue;
                  const argument = node.arguments[index];
                  const known = argument
                    ? literalValue(argument)
                    : literalValue(parameter.initializer);
                  const binding = moduleContext.resolveReference(parameter.name, helper.module);
                  if (known !== null && binding && !hasBindingWrite(parameter.name, helper.module))
                    helperConstants.set(symbolKey(binding), known);
                }
                if (unprovedActiveArgument || helperActive.size === 0) markSetupUncertain();
                else {
                  for (const argument of node.arguments)
                    provedDefinitionArguments.add(unwrap(argument));
                  collectSetup(helper.fn, helper.module, helperActive, helperConstants);
                }
              }
            }
          }
          for (const argument of node.arguments) invalidateEscapedProviderArgument(argument);
        }
        if (ts.isNewExpression(node)) {
          for (const argument of node.arguments ?? []) invalidateEscapedProviderArgument(argument);
        }
        if (ts.isReturnStatement(node) && node.expression)
          invalidateEscapedProviderArgument(node.expression);
        ts.forEachChild(node, walk);
      };

      // The root setup seeds its first parameter above. Synchronous helpers
      // receive only parameters corresponding to active call arguments;
      // callback bodies never enter this walk and therefore cannot leak later
      // writes.
      try {
        if (fn.body) walk(fn.body);
      } finally {
        activeSetupFunctions.delete(functionKey);
      }
    };

    if (setup) {
      const setupActive = new Set<string>();
      const first = setup.fn.parameters[0];
      if (first && ts.isIdentifier(first.name) && !first.dotDotDotToken) {
        setupActive.add(first.name.text);
      } else if (first) {
        markSetupUncertain();
      }
      collectSetup(setup.fn, setup.module, setupActive);
    } else {
      setupComplete = false;
    }
    if (replayedChildren !== undefined) {
      children.clear();
      for (const [name, child] of replayedChildren) children.set(name, child);
    }
    const result: HookSourceValue = {
      kind: 'result',
      producer: producer.ref,
      name,
      stateHandles,
      children,
      ...(setupComplete && ambiguousStateHandles.size === 0 ? { stateHandlesClosed: true } : {}),
    };

    const projectProperty = configProperty(producer.config, 'projectHandle');
    const projectExpression = projectProperty ? propertyExpression(projectProperty) : undefined;
    const project = functionFor(projectExpression, producer.module);
    if (projectProperty !== null) result.handle = UNKNOWN('unproved public projection');
    if (
      project &&
      !project.fn.asteriskToken &&
      !project.fn.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)
    ) {
      const environment = new Map<string, HookSourceValue>();
      const bindPattern = (
        name: ts.BindingName,
        value: HookSourceValue,
        scope: Map<string, HookSourceValue>
      ): void => {
        if (ts.isIdentifier(name)) {
          scope.set(name.text, value);
          return;
        }
        if (ts.isObjectBindingPattern(name)) {
          for (const element of name.elements) {
            const key = element.propertyName
              ? ts.isComputedPropertyName(element.propertyName)
                ? literalString(element.propertyName.expression, project.module, new Map())
                : propertyName(element.propertyName)
              : ts.isIdentifier(element.name)
                ? element.name.text
                : null;
            const selected =
              element.dotDotDotToken || element.initializer
                ? UNKNOWN('unproved projector parameter default or rest')
                : key === null
                  ? UNKNOWN('unresolved projector parameter key')
                  : memberValue(value, key).value;
            bindPattern(element.name, selected, scope);
          }
          return;
        }
        if (ts.isArrayBindingPattern(name)) {
          let index = 0;
          for (const element of name.elements) {
            if (ts.isOmittedExpression(element)) {
              index++;
              continue;
            }
            const current = index++;
            const selected =
              element.dotDotDotToken ||
              element.initializer ||
              value.kind !== 'object' ||
              value.arrayLength === undefined
                ? UNKNOWN('unproved projector array binding')
                : memberValue(value, String(current)).value;
            bindPattern(element.name, selected, scope);
          }
        }
      };
      for (let index = 0; index < project.fn.parameters.length; index++) {
        const parameter = project.fn.parameters[index];
        const value =
          index === 0 && !parameter.dotDotDotToken
            ? result
            : UNKNOWN('unproved projector argument');
        bindPattern(parameter.name, value, environment);
      }
      const returns: HookSourceResolution[] = [];
      let unprovedCompletion = false;
      const hasEffect = (node: ts.Node, scope: Map<string, HookSourceValue>): boolean => {
        // A function-valued initializer creates a deferred callable; its body
        // runs only when the callable is invoked, not while projecting the
        // handle. An invocation remains a CallExpression root and is still
        // classified below.
        if (isFunctionLike(node)) return false;
        let effect = false;
        const visit = (current: ts.Node): void => {
          if (effect || (current !== node && isFunctionLike(current))) return;
          if (ts.isConditionalExpression(current)) {
            visit(current.condition);
            const condition = unwrap(current.condition);
            if (condition.kind !== ts.SyntaxKind.FalseKeyword) visit(current.whenTrue);
            if (condition.kind !== ts.SyntaxKind.TrueKeyword) visit(current.whenFalse);
            return;
          }
          if (ts.isCallExpression(current)) {
            // Projector reads of its own result accessors do not change what
            // the projection returns, so they are not effects.
            const name = memberName(current.expression);
            const owner = memberOwner(current.expression);
            let pure =
              (name === 'getState' ||
                name === 'getMethod' ||
                name === 'getAsHook' ||
                name === 'getAsHookHandle') &&
              owner !== null &&
              evaluate(owner, project.module.source, scope).value.kind === 'result';
            if (!pure) {
              // Detached accessors retain their captured result identity.
              // A similarly named ordinary function is not a callable proof.
              pure =
                evaluate(current.expression, project.module.source, scope).value.kind ===
                'callable';
            }
            if (!pure) effect = true;
          } else if (
            ts.isNewExpression(current) ||
            ts.isAwaitExpression(current) ||
            ts.isYieldExpression(current) ||
            ts.isDeleteExpression(current) ||
            (ts.isPrefixUnaryExpression(current) &&
              (current.operator === ts.SyntaxKind.PlusPlusToken ||
                current.operator === ts.SyntaxKind.MinusMinusToken)) ||
            ts.isPostfixUnaryExpression(current) ||
            (ts.isBinaryExpression(current) &&
              current.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
              current.operatorToken.kind <= ts.SyntaxKind.LastAssignment)
          )
            effect = true;
          ts.forEachChild(current, visit);
        };
        visit(node);
        return effect;
      };
      const recordReturn = (
        expression: ts.Expression | undefined,
        scope: Map<string, HookSourceValue>
      ): void => {
        if (expression && hasEffect(expression, scope)) {
          unprovedCompletion = true;
          return;
        }
        const held = expression
          ? evaluate(expression, project.module.source, scope)
          : { matched: false, value: UNKNOWN('void projection') };
        // A member set whose keys could not be observed is not a proven public
        // member set. Certifying it would claim a complete set of members that
        // were never seen, so the projection stays unsupported.
        if (held.value.kind === 'object' && held.value.uncertainKeys) {
          unprovedCompletion = true;
          return;
        }
        returns.push(held);
      };
      unprovedCompletion = project.fn.parameters.some(
        (parameter, index) =>
          hasEffect(parameter.name, environment) ||
          (index > 0 &&
            parameter.initializer !== undefined &&
            hasEffect(parameter.initializer, environment))
      );
      const collectReturns = (node: ts.Node, scope: ProjectorScope): boolean => {
        if (ts.isBlock(node)) {
          // A block scopes the `let`, `const` and function declarations it
          // contains; a `var` belongs to the enclosing function and outlives
          // the block that declares it.
          scope.blocks.push(new Map());
          try {
            // Lexical and function bindings shadow their outer names from
            // block entry, before any statement initializer is evaluated.
            for (const statement of node.statements) {
              if (
                ts.isVariableStatement(statement) &&
                (statement.declarationList.flags & ts.NodeFlags.BlockScoped) !== 0
              )
                for (const declaration of statement.declarationList.declarations)
                  predeclareProjectorBinding(
                    scope,
                    declaration.name,
                    UNKNOWN('projector lexical before declaration')
                  );
              else if (ts.isFunctionDeclaration(statement) && statement.name)
                shadowProjectorName(
                  scope,
                  statement.name.text,
                  UNKNOWN('projector local function')
                );
            }
            for (const statement of node.statements) {
              if (!collectReturns(statement, scope)) return false;
            }
          } finally {
            const frame = scope.blocks.pop();
            if (frame)
              for (const [name, shadowed] of frame) {
                if (shadowed === undefined) scope.visible.delete(name);
                else scope.visible.set(name, shadowed);
              }
          }
          return true;
        }
        if (ts.isReturnStatement(node)) {
          recordReturn(node.expression, scope.visible);
          return false;
        }
        if (ts.isThrowStatement(node)) return false;
        if (ts.isIfStatement(node)) {
          if (hasEffect(node.expression, scope.visible)) unprovedCompletion = true;
          const condition = unwrap(node.expression);
          if (condition.kind === ts.SyntaxKind.TrueKeyword)
            return collectReturns(node.thenStatement, scope);
          if (condition.kind === ts.SyntaxKind.FalseKeyword)
            return node.elseStatement ? collectReturns(node.elseStatement, scope) : true;
          const thenScope = forkProjectorScope(scope);
          const first = collectReturns(node.thenStatement, thenScope);
          let elseScope: ProjectorScope | null = null;
          let second = true;
          if (node.elseStatement) {
            elseScope = forkProjectorScope(scope);
            second = collectReturns(node.elseStatement, elseScope);
          }
          // Continuing branches may have changed a binding. Until that join is
          // represented, do not certify a later read using its old snapshot.
          // A branch that throws/returns cannot continue with a changed
          // binding; this is the ordinary projector guard shape.
          if (first && second) unprovedCompletion = true;
          // Exactly one branch continues, so the surviving path is the only one
          // that reaches the code after the branch. Its function-scoped
          // bindings are what that code reads.
          else if (first) adoptProjectorScope(scope, thenScope);
          else if (second && elseScope) adoptProjectorScope(scope, elseScope);
          return first || second;
        }
        if (ts.isVariableStatement(node)) {
          // `var` binds the enclosing function however deeply the declaration
          // is nested; every other declaration belongs to the block that holds
          // it and shadows an outer name only until that block ends.
          const blockScoped = (node.declarationList.flags & ts.NodeFlags.BlockScoped) !== 0;
          for (const declaration of node.declarationList.declarations) {
            if (!ts.isIdentifier(declaration.name)) {
              unprovedCompletion = true;
              continue;
            }
            if (declaration.initializer && hasEffect(declaration.initializer, scope.visible))
              unprovedCompletion = true;
            // An initializer-free `var` redeclaration does not clear the
            // function binding it already has.
            const value = declaration.initializer
              ? evaluate(declaration.initializer, project.module.source, scope.visible).value
              : (scope.visible.get(declaration.name.text) ??
                UNKNOWN('uninitialized projector local'));
            if (blockScoped) shadowProjectorName(scope, declaration.name.text, value);
            else scope.visible.set(declaration.name.text, value);
          }
          return true;
        }
        if (ts.isFunctionDeclaration(node)) {
          const frame = scope.blocks[scope.blocks.length - 1];
          if (node.name && !frame?.has(node.name.text))
            shadowProjectorName(scope, node.name.text, UNKNOWN('projector local function'));
          return true;
        }
        if (ts.isEmptyStatement(node)) return true;
        // Calls, writes, loops and try/finally may alter values or completion;
        // a syntactic return inside them is not a proven public caller handle.
        unprovedCompletion = true;
        return true;
      };
      if (project.fn.body) {
        if (ts.isBlock(project.fn.body)) {
          const parameterNames = new Set(environment.keys());
          const hoistVars = (node: ts.Node): void => {
            if (isFunctionLike(node) || ts.isClassLike(node)) return;
            if (
              ts.isVariableStatement(node) &&
              (node.declarationList.flags & ts.NodeFlags.BlockScoped) === 0
            )
              for (const declaration of node.declarationList.declarations) {
                if (ts.isIdentifier(declaration.name) && !parameterNames.has(declaration.name.text))
                  environment.set(
                    declaration.name.text,
                    UNKNOWN('projector var before initialization')
                  );
              }
            ts.forEachChild(node, hoistVars);
          };
          hoistVars(project.fn.body);
          const scope: ProjectorScope = { visible: new Map(environment), blocks: [] };
          const fallsThrough = collectReturns(project.fn.body, scope);
          if (fallsThrough)
            returns.push({ matched: false, value: UNKNOWN('projection falls through') });
        } else recordReturn(project.fn.body, environment);
      }
      if (!unprovedCompletion && returns.length > 0) {
        let returned = returns[0].value;
        for (let index = 1; index < returns.length; index++)
          returned = joinValues(returned, returns[index].value);
        result.handle = returned;
      }
    }
    if (replayedChildren === undefined) summaryCache.set(key, result);
    summaryStack.delete(key);
    return { matched: true, value: result };
  };

  const resolveCall = (node: ts.CallExpression, source: ts.SourceFile): HookSourceResolution =>
    evaluate(node, source, new Map());

  return {
    registerSource,
    resolve: evaluate,
    resolveCall,
    isAuthoredProducerCall: (node, source) => producerForCall(node, source) !== null,
    isAuthoredSetup,
    isSameSourceBinding,
  };
}
