// @ts-nocheck
// Recursive ts.Node AST walking extracted from the legacy CLI so source-token
// collection is shared by both user commands and generated preset manifests.
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

import { canonicalizeLoweredVariants } from '../generated/lowered-variant-order.js';
import {
  createHookSourceSummaryContext,
  createSourceGraphVersionTracker,
  hookSourceCallMutation,
  mutateSourceGraph,
  sourceMembersOneProducer,
  sourceMembersProven,
  type HookSourceValue,
} from './hook-source-summary.js';

export async function collectProtoStyleTokens(root) {
  return collectProtoStyleTokensFromFiles(await collectSourceFiles(root));
}

/** Explicit source graph entry for package preset generation; never executes prototype code. */
export async function collectProtoStyleTokensFromFiles(files) {
  const tokens = new Set();
  const moduleCache = new Map();
  const sourceSummary = createHookSourceSummaryContext();

  for (const file of files) {
    const sourceFile = await parseSourceFile(file);
    sourceSummary.registerSource(sourceFile);
    const scope = createScope(null, null, sourceSummary);
    await applyImportBindings(file, sourceFile, scope, moduleCache, []);
    walk(sourceFile, scope, tokens, collectExposures(sourceFile));
  }

  return Array.from(tokens).sort();
}

/** Only proven Template uses bypass Root recipes. Unclassified tw() calls,
 * shared Root uses and lowered Rule tokens remain conservatively Root-bound. */
export async function collectProtoShadowStyleTokenUsage(root) {
  const tokens = new Set();
  const templateTokens = new Set();
  const nonTemplateTokens = new Set();
  const unclassifiedTokens = new Set();
  const occurrences = [];
  const moduleCache = new Map();
  const sourceSummary = createHookSourceSummaryContext();
  for (const file of await collectSourceFiles(root)) {
    const sourceFile = await parseSourceFile(file);
    sourceSummary.registerSource(sourceFile);
    const scope = createScope(null, null, sourceSummary);
    await applyImportBindings(file, sourceFile, scope, moduleCache, []);
    walk(sourceFile, scope, tokens, collectExposures(sourceFile), {
      occurrences,
      sourcePath: path.relative(root, file).split(path.sep).join('/'),
      templateTokens,
      nonTemplateTokens,
      unclassifiedTokens,
    });
  }
  // Reuse Root occurrence provenance; a token used on both targets needs both
  // outputs and must still pass the complete Root recipe preflight.
  for (const { token } of occurrences) nonTemplateTokens.add(token);
  for (const token of unclassifiedTokens) templateTokens.add(token);
  return {
    tokens: Array.from(tokens).sort(),
    rootTokens: Array.from(tokens)
      .filter((token) => !templateTokens.has(token) || nonTemplateTokens.has(token))
      .sort(),
    templateTokens: Array.from(templateTokens).sort(),
  };
}

/**
 * Collect only author-side tokens that flow through Root feedback.style.use.
 *
 * Unlike collectProtoStyleTokens(), this inventory deliberately excludes
 * Template-node style and Web selector variants generated from Rule
 * conditions. It is an analysis surface for Root application-role work, not a
 * replacement for the complete physical CSS closure collector.
 */
export async function collectProtoRootStyleTokens(root) {
  const occurrences = await collectProtoRootStyleTokenOccurrences(root);
  return Array.from(new Set(occurrences.map((occurrence) => occurrence.token))).sort();
}

/**
 * Retain the call-site provenance needed to assess ambiguous Root token roles.
 * Paths are relative to the supplied root and positions are one-based.
 */
export async function collectProtoRootStyleTokenOccurrences(root) {
  const files = await collectSourceFiles(root);
  const occurrences = [];
  const moduleCache = new Map();
  const sourceSummary = createHookSourceSummaryContext();

  for (const file of files) {
    const sourceFile = await parseSourceFile(file);
    sourceSummary.registerSource(sourceFile);
    const scope = createScope(null, null, sourceSummary);
    await applyImportBindings(file, sourceFile, scope, moduleCache, []);
    walk(sourceFile, scope, new Set(), collectExposures(sourceFile), {
      occurrences,
      sourcePath: path.relative(root, file).split(path.sep).join('/'),
    });
  }

  return occurrences.sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.line - right.line ||
      left.column - right.column ||
      left.token.localeCompare(right.token)
  );
}

async function parseSourceFile(file) {
  const sourceText = await fs.readFile(file, 'utf8');
  return ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForFile(file)
  );
}

// Named imports from relative modules (e.g. a local style.ts holding shared
// token constants) are resolved so cross-file token constants stay visible
// to tw(...) calls and rule intent extraction.
async function applyImportBindings(file, sourceFile, scope, moduleCache, stack) {
  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    const specifier = stmt.moduleSpecifier;
    if (!ts.isStringLiteralLike(specifier)) continue;
    if (!specifier.text.startsWith('.')) continue;
    const resolved = await resolveModuleFile(path.dirname(file), specifier.text);
    if (!resolved || stack.includes(resolved)) continue;
    const clause = stmt.importClause;
    if (!clause) continue;
    // A default import binds the module's default export, so the local name
    // stands for whatever that export holds. Bind it as an import: the
    // built-in hook table is a spelling fallback, and a default import that
    // is not a proven authored producer must never reach it.
    if (clause.name) {
      scope.bindings.set(clause.name.text, {
        ...emptyValue(),
        importedBinding: true,
        defaultImport: true,
        importSpecifier: specifier.text,
      });
    }
    if (!clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) continue;
    const bindings = await loadModuleBindings(resolved, moduleCache, stack);
    for (const element of clause.namedBindings.elements) {
      const importedName = (element.propertyName ?? element.name).text;
      const value = bindings.get(importedName);
      if (value) scope.bindings.set(element.name.text, { ...value, importedBinding: true });
    }
  }
}

async function resolveModuleFile(dir, specifier) {
  const base = path.resolve(dir, specifier);
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
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return candidate;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

async function loadModuleBindings(file, moduleCache, stack) {
  const cached = moduleCache.get(file);
  if (cached) return cached;
  // Insert before recursing so circular imports terminate.
  const bindings = new Map();
  moduleCache.set(file, bindings);
  const sourceFile = await parseSourceFile(file);
  const scope = createScope();
  await applyImportBindings(file, sourceFile, scope, moduleCache, [...stack, file]);
  for (const stmt of sourceFile.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      // An imported module holds token constants, not this component's states.
      registerDeclaration(decl, scope, undefined);
    }
  }
  for (const [name, value] of scope.bindings) bindings.set(name, value);
  return bindings;
}
function createScope(parent = null, node = null, sourceSummary = parent?.sourceSummary ?? null) {
  return {
    parent,
    bindings: new Map(),
    node,
    sourceSummary,
    // The versions of the containers this scope's owner holds. A scope chain
    // shares one tracker, so a helper inside an owner shares its owner's
    // containers, while a separate owner starts with its own.
    versions: parent?.versions ?? createSourceGraphVersionTracker(),
    definitelyReachedLogicalAssignments:
      parent?.definitelyReachedLogicalAssignments ?? new WeakSet(),
  };
}

function enclosingFunction(node) {
  return node ? (ts.findAncestor(node, (candidate) => ts.isFunctionLike(candidate)) ?? null) : null;
}

/**
 * `(() => { … })()` runs where it is written, so its writes are ordered. An
 * async function may suspend before the write and a generator does not run its
 * body on the call at all, so neither is ordered however it is invoked.
 */
function runsInPlace(fn) {
  if (fn.asteriskToken) return false;
  if (fn.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)) return false;
  let node = fn;
  while (node.parent && ts.isParenthesizedExpression(node.parent)) node = node.parent;
  return Boolean(
    node.parent && ts.isCallExpression(node.parent) && node.parent.expression === node
  );
}

/**
 * A write inside a callback has not run when a later `def.rule` registers, so
 * the name may still hold what it held before. This is the same
 * over-approximation the conditional path applies, in time rather than in name
 * resolution.
 */
/**
 * Whether a statement may hand control somewhere else before finishing. Nested
 * functions are skipped: their `return` belongs to them, not to this sequence.
 */
function mayCompleteAbruptly(node) {
  let found = false;
  const visit = (current) => {
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
 * reached, so any earlier statement that may complete abruptly leaves it
 * unproven and the earlier handle stays a candidate.
 */
function reachedInPlace(node, boundary) {
  let child = node;
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

function isDeferredWrite(node, readFunction) {
  const writing = enclosingFunction(node);
  if (writing === readFunction) return false;
  if (!writing || !runsInPlace(writing)) return true;
  return !reachedInPlace(node, writing);
}

/** `var` binds to the function however deeply the declaration is nested. */
function functionScope(scope) {
  for (let current = scope; current; current = current.parent) {
    const node = current.node;
    // The variable environment is a function body, the function itself when it
    // has an expression body, or the module.
    if (!node || !current.parent) return current;
    if (ts.isSourceFile(node) || ts.isFunctionLike(node)) return current;
    if (node.parent && ts.isFunctionLike(node.parent)) return current;
  }
  return scope;
}

function isVarList(list) {
  return (
    ts.isVariableDeclarationList(list) && !(list.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const))
  );
}

/** Every runtime branch of a conditional, whether or not this recognizes it. */
function conditionalLeafCount(node) {
  const value = unwrapTransparent(node);
  if (!ts.isConditionalExpression(value)) return 1;
  return conditionalLeafCount(value.whenTrue) + conditionalLeafCount(value.whenFalse);
}

/** Every semantic a binding may stand for, the declared one first. */
function bindingSemantics(binding) {
  if (!binding || binding.unknownAlternative) return [];
  return [binding.semantic, ...(binding.alternatives ?? [])].filter(Boolean);
}

function knownBindingSemantics(binding) {
  return binding ? [binding.semantic, ...(binding.alternatives ?? [])].filter(Boolean) : [];
}

function bindingHasStatePath(binding) {
  if (!binding || binding.unknownAlternative) return false;
  if (bindingSemantics(binding).length > 0) return true;
  if (
    binding.kind === 'localState' ||
    binding.kind === 'handle' ||
    binding.kind === 'handleBag' ||
    binding.kind === 'hookResult' ||
    binding.kind === 'callable'
  )
    return true;
  if (binding.semanticMap?.size || binding.containers?.length) return true;
  const sourceValues = sourceValueCandidates(binding);
  return sourceValues.length > 0 && sourceValues.some((value) => value.kind !== 'unknown');
}

/** A member entry holds one semantic, or several once a write may be skipped. */
function memberSemantics(entry) {
  if (!entry) return [];
  return Array.isArray(entry) ? entry.filter(Boolean) : [entry];
}

// Semantic-only local initializers and writes have no source-state node. Keep their proof
// attached to the exact member-map entry and source snapshot it superseded.
// Known writes advance untouched entries; escapes cannot reuse that proof.
const definitiveLocalMemberWrites = new WeakMap();

function advanceLocalMemberProofs(
  binding,
  previousSource,
  nextSource,
  writtenMember,
  nextCandidates
) {
  const proofs = definitiveLocalMemberWrites.get(binding.semanticMap);
  for (const [key, proof] of proofs ?? []) {
    if (writtenMember instanceof Set ? writtenMember.has(key) : key === writtenMember) {
      proofs.delete(key);
      continue;
    }
    if (proof.sourceValue === previousSource && proof.entry === binding.semanticMap?.get(key))
      proofs.set(key, { ...proof, sourceValue: nextSource, sources: nextCandidates });
  }
}

function joinLocalMemberProofs(binding, branches, scope) {
  if (!binding.semanticMap) return;
  const proofs = new Map();
  for (const [key, entry] of binding.semanticMap ?? []) {
    if (
      branches.every((held) => {
        const proof = definitiveLocalMemberWrites.get(held.semanticMap)?.get(key);
        return (
          proof &&
          proof.versions === scope.versions &&
          proof.sourceValue === held.sourceValue &&
          proof.sources.length === sourceValueCandidates(held).length &&
          proof.sources.every((source) => sourceValueCandidates(held).includes(source)) &&
          !proof.unknown &&
          proof.entry === held.semanticMap?.get(key)
        );
      })
    )
      proofs.set(key, {
        sourceValue: binding.sourceValue,
        sources: sourceValueCandidates(binding),
        versions: scope.versions,
        entry,
      });
  }
  definitiveLocalMemberWrites.set(binding.semanticMap, proofs);
}

function selectMemberBinding(node, scope) {
  const owner = memberOwner(node);
  const key = memberName(node);
  if (!owner || key === null) return null;
  const binding = resolveExpression(owner, scope);
  const branches = binding.containers ?? [binding];
  // Result and callable graphs are resolved by the source summary, not by
  // object-member selection. An empty lexical value likewise says nothing
  // about the member unless it carries a genuine incomplete alternative.
  if (
    !binding.unknownAlternative &&
    !branches.some(
      (branch) =>
        branch.unknownAlternative ||
        branch.semanticMap?.has(key) ||
        sourceValueCandidates(branch).some((source) => source.kind === 'object')
    )
  )
    return null;
  return selectPatternMember(binding, key, scope);
}

/**
 * The outermost scope holding this exact container value. An alias and the
 * container are one object, so the object's lifetime — not the alias's
 * declaration — decides whether a write through it has run.
 */
function scopeOwningValue(value, scope) {
  let owning = null;
  const sources = sourceValueCandidates(value);
  for (let current = scope; current; current = current.parent) {
    for (const held of current.bindings.values()) {
      if (
        held === value ||
        (value.semanticMap != null && held.semanticMap === value.semanticMap) ||
        sources.some((target) =>
          sourceValueCandidates(held).some((source) => containsSourceReference(source, target))
        )
      ) {
        owning = current;
        break;
      }
    }
  }
  return owning;
}

/** The scope a name is already bound in, so an assignment does not shadow it. */
function scopeDeclaring(name, scope) {
  for (let current = scope; current; current = current.parent) {
    if (current.bindings.has(name)) return current;
  }
  return null;
}

function shadowBindingPattern(scope, name) {
  if (ts.isIdentifier(name)) {
    scope.bindings.set(name.text, { ...emptyValue(), opaque: true });
    return;
  }
  for (const element of name.elements) {
    if (ts.isBindingElement(element)) shadowBindingPattern(scope, element.name);
  }
}

function walk(node, scope, tokens, exposures, rootInventory = null) {
  if (ts.isIfStatement(node)) {
    const outcome = sourceConditionOutcome(node.expression, scope);
    walk(node.expression, scope, tokens, exposures, rootInventory);
    if (outcome === false) {
      if (node.elseStatement) walk(node.elseStatement, scope, tokens, exposures, rootInventory);
      return;
    }
    if (outcome === true) {
      walk(node.thenStatement, scope, tokens, exposures, rootInventory);
      return;
    }
    walk(node.thenStatement, scope, tokens, exposures, rootInventory);
    if (node.elseStatement) walk(node.elseStatement, scope, tokens, exposures, rootInventory);
    return;
  }

  if (createsScope(node)) {
    const nextScope = createScope(scope, node);
    // An authored setup is its own owner: it holds its own containers of the
    // producers it reads, so it does not share the versions of the owner
    // around it. A helper inside it inherits them.
    if (scope.sourceSummary?.isAuthoredSetup?.(node, node.getSourceFile()))
      nextScope.versions = createSourceGraphVersionTracker();

    if (ts.isForOfStatement(node)) {
      const iterable = unwrapTransparent(node.expression);
      if (ts.isArrayLiteralExpression(iterable)) {
        const snapshots = new Map();
        const snapshotScope = { ...nextScope, expressionSnapshots: snapshots };
        const capture = (expression) => {
          const value = unwrapTransparent(expression);
          if (ts.isArrayLiteralExpression(value)) {
            for (const element of value.elements) {
              if (!ts.isOmittedExpression(element)) capture(element);
            }
          } else if (ts.isObjectLiteralExpression(value)) {
            for (const property of value.properties) {
              if (property.name && ts.isComputedPropertyName(property.name))
                capture(property.name.expression);
              if (ts.isPropertyAssignment(property)) capture(property.initializer);
              else if (ts.isShorthandPropertyAssignment(property)) capture(property.name);
              else if (ts.isSpreadAssignment(property)) capture(property.expression);
            }
          } else if (
            ts.isBinaryExpression(value) &&
            value.operatorToken.kind === ts.SyntaxKind.EqualsToken
          ) {
            walk(expression, nextScope, tokens, exposures, rootInventory);
            snapshots.set(expression, resolveBinding(value.right, snapshotScope));
            return;
          } else {
            const binding = resolveBinding(expression, snapshotScope);
            walk(expression, nextScope, tokens, exposures, rootInventory);
            snapshots.set(expression, binding);
            return;
          }
          snapshots.set(expression, resolveBinding(expression, snapshotScope));
        };
        const rowScopes = iterable.elements
          .filter((row) => !ts.isOmittedExpression(row))
          .map((row) => {
            capture(row);
            const rowScope = createScope(nextScope, node);
            for (const decl of loopInitializerDeclarations(node)) {
              registerLoopDeclaration(decl, rowScope, exposures, [row], snapshotScope);
            }
            return rowScope;
          });
        for (const rowScope of rowScopes) {
          walk(node.statement, rowScope, tokens, exposures, rootInventory);
        }
        return;
      }
    }

    if (ts.isFunctionLike(node)) {
      for (const parameter of node.parameters) shadowBindingPattern(nextScope, parameter.name);
    }
    if (ts.isCatchClause(node) && node.variableDeclaration)
      shadowBindingPattern(nextScope, node.variableDeclaration.name);

    // Registered before the body is walked, the same order the loop runs in.
    for (const decl of loopInitializerDeclarations(node)) {
      registerDeclaration(decl, nextScope, exposures);
    }
    if (ts.isForOfStatement(node)) {
      const iterable = unwrapTransparent(node.expression);
      if (ts.isArrayLiteralExpression(iterable)) {
        for (const decl of loopInitializerDeclarations(node)) {
          registerLoopDeclaration(decl, nextScope, exposures, iterable.elements);
        }
      }
    }

    if (hasStatements(node)) {
      // Sequential, so a legal redeclaration still registers each binding for
      // the statements that follow it. Exposures need no ordering because they
      // are collected from the whole source before the walk begins.
      for (const stmt of node.statements) {
        if (ts.isVariableStatement(stmt)) {
          // `var` is one function-scoped binding however deeply it is nested,
          // so a nested redeclaration is the same binding seen from outside.
          const owner = isVarList(stmt.declarationList) ? functionScope(nextScope) : nextScope;
          for (const decl of stmt.declarationList.declarations) {
            registerDeclaration(decl, owner, exposures);
            if (decl.initializer) {
              walk(decl.initializer, nextScope, tokens, exposures, rootInventory);
            }
          }
          continue;
        }
        walk(stmt, nextScope, tokens, exposures, rootInventory);
      }
      return;
    }

    ts.forEachChild(node, (child) => walk(child, nextScope, tokens, exposures, rootInventory));
    return;
  }

  if (ts.isVariableStatement(node)) {
    // A declaration under single-statement control flow — `if (x) var f = …` —
    // is reached here rather than through a statement list, and the runtime
    // executes it just the same.
    const owner = isVarList(node.declarationList) ? functionScope(scope) : scope;
    for (const decl of node.declarationList.declarations) {
      registerDeclaration(decl, owner, exposures);
      if (decl.initializer) walk(decl.initializer, scope, tokens, exposures, rootInventory);
    }
    return;
  }

  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
    // A cast or a pair of parentheses names the same member, so the write
    // reaches the same container.
    (ts.isPropertyAccessExpression(unwrapTransparent(node.left)) ||
      ts.isElementAccessExpression(unwrapTransparent(node.left)))
  ) {
    // Writing through the container moves the member for every read that
    // follows, so the rule side has to see it the way the exposure does.
    const operator = node.operatorToken.kind;
    const plainAssignment = operator === ts.SyntaxKind.EqualsToken;
    const logicalAssignment =
      operator === ts.SyntaxKind.AmpersandAmpersandEqualsToken ||
      operator === ts.SyntaxKind.BarBarEqualsToken ||
      operator === ts.SyntaxKind.QuestionQuestionEqualsToken;
    // Assignment evaluates its receiver/key before its RHS. Preserve those
    // effects for intercepted non-plain writes without widening plain `=`.
    if (!plainAssignment) walk(node.left, scope, tokens, exposures, rootInventory);
    const base = unwrapTransparent(memberOwner(node.left) ?? node.left);
    const member = memberName(node.left);
    const resolvedBefore = resolveExpression(base, scope);
    let knownStateHandle = false;
    if (logicalAssignment && member !== null && !resolvedBefore?.unknownAlternative) {
      const targets = resolvedBefore?.containers ?? (resolvedBefore ? [resolvedBefore] : []);
      // State handles are objects, hence truthy and non-nullish. Every possible
      // receiver must prove that exact member before a logical RHS is skipped.
      knownStateHandle =
        targets.length > 0 &&
        targets.every((container) => {
          if (container.unknownAlternative) return false;
          const sourceValues = sourceValueCandidates(container);
          return sourceValues.length > 0
            ? sourceValues.every(
                (source) => source.kind === 'object' && source.members.get(member)?.kind === 'state'
              )
            : memberSemantics(container.semanticMap?.get(member)).length > 0;
        });
    }
    if (
      knownStateHandle &&
      (operator === ts.SyntaxKind.BarBarEqualsToken ||
        operator === ts.SyntaxKind.QuestionQuestionEqualsToken)
    )
      return;
    const definitelyRunsRight =
      operator === ts.SyntaxKind.AmpersandAmpersandEqualsToken && knownStateHandle;
    if (definitelyRunsRight) scope.definitelyReachedLogicalAssignments.add(node);
    try {
      walk(node.right, scope, tokens, exposures, rootInventory);
    } finally {
      if (definitelyRunsRight) scope.definitelyReachedLogicalAssignments.delete(node);
    }
    if (resolvedBefore) {
      // `const alias = controls` names the same object, and both bindings hold
      // the one resolved value, so the member moves on that value rather than
      // on a copy rebound to whichever name the write happened to use.
      const resolved = resolvedBefore;
      // A base that may be either of two objects writes to both tables.
      const targets = resolved?.containers ?? (resolved ? [resolved] : []);
      const writesRight =
        plainAssignment ||
        (operator === ts.SyntaxKind.AmpersandAmpersandEqualsToken && knownStateHandle);
      const rightBinding = writesRight ? resolveBinding(node.right, scope) : null;
      const written = knownBindingSemantics(rightBinding);
      const writtenSource = sourceValueCandidates(rightBinding);
      for (const container of targets) {
        const sourceWrite = writtenSource.length === 1 && hasSourceHookProvenance(writtenSource[0]);
        const unknownWrite =
          !writesRight ||
          rightBinding?.unknownAlternative ||
          (written.length === 0 && !sourceWrite);
        // The scope that owns the container object, not the one that declares
        // the name written through: an alias declared inside a callback would
        // otherwise make the write look ordered against itself.
        const declaring =
          scopeOwningValue(container, scope) ??
          (ts.isIdentifier(base) ? scopeDeclaring(base.text, scope) : null);
        const uncertain =
          isConditionallyReached(node, scope.definitelyReachedLogicalAssignments) ||
          isDeferredWrite(node, enclosingFunction(declaring?.node ?? null)) ||
          targets.length > 1 ||
          (logicalAssignment && !knownStateHandle) ||
          // A key this cannot read may name any member the container has.
          member === null;
        const previousSelection =
          member === null ? null : selectPatternMember(container, member, scope);
        const previousSemantics = knownBindingSemantics(previousSelection);
        const previousMemberProven = bindingSemantics(previousSelection).length > 0;
        updateTokenMembers(container, member, rightBinding, uncertain);
        if (written.length > 0 && !container.semanticMap) container.semanticMap = new Map();
        const keys =
          member === null
            ? [
                ...new Set([
                  ...(container.semanticMap?.keys() ?? []),
                  ...(container.sourceValue?.kind === 'object'
                    ? container.sourceValue.members.keys()
                    : []),
                ]),
              ]
            : [member];
        const previousByKey = new Map(
          keys.map((key) => [
            key,
            member === null ? selectPatternMember(container, key, scope) : previousSelection,
          ])
        );
        // Retire the old entry before installing the joined write result.
        const localProofs = definitiveLocalMemberWrites.get(container.semanticMap);
        if (member === null) localProofs?.clear();
        else localProofs?.delete(member);
        // Local States and multi-source alternatives have no single source
        // declaration. Keep an unknown graph member and retain their proven
        // semantics in the exact-entry overlay below.
        if (
          container.sourceValue?.kind === 'object' &&
          (unknownWrite || writtenSource.length > 0 || written.length > 0)
        ) {
          // Summary values are cached for the whole source graph. Never mutate
          // their member map in place: a write in one walked file must not
          // change what a later file observes from the same producer.
          const previousSource = container.sourceValue;
          const previousCandidates = sourceValueCandidates(container);
          const nextMembers = new Map(previousSource.members);
          const replacement =
            !unknownWrite && writtenSource.length === 1 && written.length <= 1
              ? writtenSource[0]
              : { kind: 'unknown', reason: 'member has local or unproved alternatives' };
          if (member === null) {
            for (const key of nextMembers.keys()) nextMembers.set(key, replacement);
          } else {
            nextMembers.set(member, replacement);
          }
          const nextSource = { ...previousSource, members: nextMembers };
          // The write reaches every version the container may hold, not only
          // the newest one: the container may hold an older graph, and the
          // write reached the container. A version that does not carry the
          // member the write names receives it as the runtime would.
          const others = [];
          for (const version of scope.versions.versions(previousSource)) {
            if (version === previousSource || version.kind !== 'object') continue;
            const otherMembers = new Map(version.members);
            if (member === null) {
              for (const key of otherMembers.keys()) otherMembers.set(key, replacement);
            } else {
              otherMembers.set(member, replacement);
            }
            others.push({ version, next: { ...version, members: otherMembers } });
          }
          const nextCandidates = uncertain
            ? [nextSource, ...previousCandidates, previousSource, ...others.map((o) => o.next)]
            : [
                nextSource,
                ...previousCandidates.filter(
                  (candidate) => !scope.versions.sameContainer(candidate, previousSource)
                ),
                ...others.map((o) => o.next),
              ];
          const uniqueCandidates = [...new Set(nextCandidates)];
          advanceLocalMemberProofs(container, previousSource, nextSource, member, uniqueCandidates);
          container.sourceValue = nextSource;
          if (nextCandidates.length > 1 || container.sourceValues)
            container.sourceValues = uniqueCandidates;

          // Aliases hold the same object identity. Keep their local source
          // pointer in sync without touching the cached summary object.
          for (let owner = scope; owner; owner = owner.parent) {
            for (const held of owner.bindings.values()) {
              if (held === container || held.sourceValue !== previousSource) continue;
              const heldCandidates = uncertain
                ? [...new Set([nextSource, ...(held.sourceValues ?? []), previousSource])]
                : [
                    nextSource,
                    ...(held.sourceValues ?? []).filter(
                      (candidate) => !scope.versions.sameContainer(candidate, previousSource)
                    ),
                    ...others.map((other) => other.next),
                  ];
              advanceLocalMemberProofs(held, previousSource, nextSource, member, heldCandidates);
              updateTokenMembers(held, member, rightBinding, uncertain);
              held.sourceValue = nextSource;
              if (uncertain) {
                held.sourceValues = [
                  ...new Set([nextSource, ...(held.sourceValues ?? []), previousSource]),
                ];
              } else if (held.sourceValues) {
                held.sourceValues = [...new Set(heldCandidates)];
              }
              // Only this member changed. Other entries may carry newer
              // local-state semantics absent from the immutable source graph.
              if (held.semanticMap && held.semanticMap !== container.semanticMap) {
                if (unknownWrite) {
                  if (member === null) held.semanticMap.clear();
                  else held.semanticMap.delete(member);
                } else if (written.length > 0) {
                  const semantics = mergeSourceSemantics(sourceValueCandidates(held));
                  for (const key of keys) {
                    const next = semantics.get(key);
                    if (next !== undefined) held.semanticMap.set(key, next);
                  }
                }
              }
            }
          }
          // The other versions are propagated first, so the graph the
          // container holds now stays the newest one the name holds.
          for (const other of others) {
            propagateSourceReference(
              scope,
              other.version,
              other.next,
              uncertain,
              undefined,
              member ?? undefined
            );
          }
          propagateSourceReference(
            scope,
            previousSource,
            nextSource,
            uncertain,
            undefined,
            member ?? undefined
          );
        }
        if (unknownWrite && written.length === 0) {
          // An unknown write revokes completeness, but a skipped write still
          // leaves its previously known candidates live for CSS enumeration.
          for (const key of keys) {
            const kept = uncertain ? knownBindingSemantics(previousByKey.get(key)) : [];
            if (kept.length === 0) {
              container.semanticMap?.delete(key);
              continue;
            }
            if (!container.semanticMap) container.semanticMap = new Map();
            container.semanticMap.set(key, kept);
            let proofs = definitiveLocalMemberWrites.get(container.semanticMap);
            if (!proofs) {
              proofs = new Map();
              definitiveLocalMemberWrites.set(container.semanticMap, proofs);
            }
            proofs.set(key, {
              sourceValue: container.sourceValue,
              sources: sourceValueCandidates(container),
              versions: scope.versions,
              entry: kept,
              unknown: true,
            });
          }
        } else if (written.length > 0) {
          for (const key of keys) {
            const previous =
              member === null ? knownBindingSemantics(previousByKey.get(key)) : previousSemantics;
            const kept = uncertain
              ? previous.filter((candidate) => !written.includes(candidate))
              : [];
            container.semanticMap.set(key, [...written, ...kept]);
            let proofs = definitiveLocalMemberWrites.get(container.semanticMap);
            if (!proofs) {
              proofs = new Map();
              definitiveLocalMemberWrites.set(container.semanticMap, proofs);
            }
            proofs.set(key, {
              sourceValue: container.sourceValue,
              sources: sourceValueCandidates(container),
              versions: scope.versions,
              entry: container.semanticMap.get(key),
              unknown:
                unknownWrite ||
                (uncertain &&
                  !(member === null
                    ? bindingSemantics(previousByKey.get(key)).length > 0
                    : previousMemberProven)),
            });
          }
        }
      }
    }
    return;
  }

  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    (ts.isObjectLiteralExpression(unwrapTransparent(node.left)) ||
      ts.isArrayLiteralExpression(unwrapTransparent(node.left)))
  ) {
    walk(node.right, scope, tokens, exposures, rootInventory);
    const invalidatePattern = (target) => {
      const value = unwrapTransparent(target);
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
        (scopeDeclaring(value.text, scope) ?? scope).bindings.set(value.text, {
          ...emptyValue(),
          unknownAlternative: true,
          opaque: true,
        });
      } else if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) {
        walk(value, scope, tokens, exposures, rootInventory);
        const key = memberName(value);
        const owner = memberOwner(value);
        if (!owner) return;
        const resolved = resolveExpression(owner, scope);
        for (const held of resolved.containers ?? [resolved]) {
          const previous = held.sourceValue;
          if (previous?.kind === 'object') {
            for (let ownerScope = scope; ownerScope; ownerScope = ownerScope.parent) {
              for (const alias of ownerScope.bindings.values()) {
                if (alias.sourceValue !== previous) continue;
                if (key === null) alias.semanticMap?.clear();
                else alias.semanticMap?.delete(key);
              }
            }
            const members = new Map(previous.members);
            for (const member of key === null ? [...members.keys()] : [key])
              members.set(member, { kind: 'unknown', reason: 'destructured member write' });
            propagateSourceReference(scope, previous, { ...previous, members });
          }
          if (key === null) held.semanticMap?.clear();
          else held.semanticMap?.delete(key);
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
    const held = resolveBinding(node.left, scope);
    const sources = sourceValueCandidates(held);
    const knownHandle =
      !held.unknownAlternative &&
      (sources.length > 0
        ? sources.every((value) => value.kind === 'state')
        : bindingSemantics(held).length > 0);
    if (knownHandle && node.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandEqualsToken)
      return;
    if (knownHandle) scope.definitelyReachedLogicalAssignments.add(node);
    try {
      walk(node.right, scope, tokens, exposures, rootInventory);
      if (knownHandle) assignIdentifierBinding(node, scope, exposures);
      else
        (scopeDeclaring(node.left.text, scope) ?? scope).bindings.set(node.left.text, {
          ...emptyValue(),
          unknownAlternative: true,
          opaque: true,
        });
    } finally {
      if (knownHandle) scope.definitelyReachedLogicalAssignments.delete(node);
    }
    return;
  }

  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    ts.isIdentifier(node.left)
  ) {
    // A reassignment moves the handle for every read that follows it, so the
    // binding has to move with it rather than stay at its declaration.
    walk(node.right, scope, tokens, exposures, rootInventory);
    assignIdentifierBinding(node, scope, exposures);
    return;
  }

  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'tw'
  ) {
    for (const arg of node.arguments) {
      const value = resolveExpression(arg, scope);
      for (const token of value.strings.flatMap(splitTokens)) {
        tokens.add(token);
        if (rootInventory?.templateTokens) {
          if (isTemplateStyleCall(node)) rootInventory.templateTokens.add(token);
          else {
            rootInventory.nonTemplateTokens.add(token);
            if (!isFeedbackStyleTwCall(node)) rootInventory.unclassifiedTokens.add(token);
          }
        }
      }
    }
  }

  if (rootInventory && ts.isCallExpression(node) && isFeedbackStyleUseCall(node)) {
    const sourceFile = node.getSourceFile();
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const context = isInsideRuleCall(node) ? 'rule' : 'setup';
    for (const token of collectTwTokens(node, scope, exposures)) {
      rootInventory.occurrences.push(
        Object.freeze({
          token,
          path: rootInventory.sourcePath,
          line: position.line + 1,
          column: position.character + 1,
          context,
        })
      );
    }
  }

  if (ts.isCallExpression(node) && isPropertyNamed(node.expression, 'rule')) {
    collectRuleVariantTokens(node, scope, tokens, exposures);
    if (rootInventory?.nonTemplateTokens)
      collectRuleVariantTokens(node, scope, rootInventory.nonTemplateTokens, exposures);
  }

  // The callee and the arguments are evaluated in order, and the call
  // receives the objects its arguments denoted while they were evaluated.
  if (ts.isCallExpression(node)) {
    walk(node.expression, scope, tokens, exposures, rootInventory);
    const mutation = hookSourceCallMutation(node);
    // The receiver is evaluated before the arguments, so the container it
    // denotes is captured before they are walked: a later argument that
    // rebinds the name does not move the mutation onto the container the
    // name holds afterwards.
    const receiver = receiverContainerValues(node, scope);
    // The callee is evaluated before the arguments as well, so the proof that
    // it reads the receiver it is called on is captured before they are
    // walked: a later argument that rebinds a name cannot change what the
    // callee denoted. The proof reads the member from the graph the receiver
    // holds now, so a member a write replaced is not exempt.
    const readsOnly = provenAccessorCallee(node, scope, receiver);
    const captured = [];
    for (const argument of node.arguments) {
      const inner = unwrapTransparent(argument);
      // An assignment expression stands for the value it assigned.
      const assigned =
        ts.isBinaryExpression(inner) && inner.operatorToken.kind === ts.SyntaxKind.EqualsToken
          ? inner.right
          : inner;
      const values = containerArgumentValues(assigned, scope);
      captured.push({
        argument,
        values,
        source:
          mutation.kind === 'copy' && mutation.sources.includes(captured.length)
            ? copySourceValue(assigned, scope)
            : undefined,
      });
      walk(argument, scope, tokens, exposures, rootInventory);
    }
    applyCallSourceMutation(node, scope, captured, receiver, readsOnly);
    return;
  }

  ts.forEachChild(node, (child) => walk(child, scope, tokens, exposures, rootInventory));
}

function isTemplateStyleCall(node) {
  // No wrapper can receive the handle before the Template node does.
  const style = node.parent;
  if (
    !ts.isPropertyAssignment(style) ||
    style.initializer !== node ||
    getPropertyName(style.name) !== 'style'
  )
    return false;
  const props = style.parent;
  const call = props.parent;
  if (
    !ts.isObjectLiteralExpression(props) ||
    !ts.isCallExpression(call) ||
    call.arguments[1] !== props ||
    !ts.isPropertyAccessExpression(call.expression) ||
    call.expression.name.text !== 'el' ||
    !ts.isIdentifier(call.expression.expression)
  )
    return false;

  const render = ts.findAncestor(call, ts.isFunctionLike);
  if (!render || !(ts.isArrowFunction(render) || ts.isFunctionExpression(render))) return false;
  const parameter = render.parameters[0];
  const receiver = call.expression.expression.text;
  if (
    !parameter ||
    !ts.isIdentifier(parameter.name) ||
    parameter.name.text !== receiver ||
    parameter.initializer ||
    parameter.dotDotDotToken
  )
    return false;

  // Only a directly returned callback in canonical definePrototype.setup
  // establishes the renderer receiver. Arbitrary functions named el do not.
  const body = render.body;
  const returned =
    ts.isBlock(body) && body.statements.length === 1 && ts.isReturnStatement(body.statements[0])
      ? body.statements[0].expression
      : body;
  // Follow only literal Template structure to the return value, never an
  // opaque wrapper, alias, spread or a call on another receiver.
  for (let current = call; current !== returned; ) {
    const parent = current.parent;
    if (ts.isArrayLiteralExpression(parent) && parent.elements.includes(current)) {
      current = parent;
      continue;
    }
    if (
      ts.isCallExpression(parent) &&
      ts.isPropertyAccessExpression(parent.expression) &&
      ts.isIdentifier(parent.expression.expression) &&
      parent.expression.expression.text === receiver &&
      parent.expression.name.text === 'el' &&
      ((parent.arguments.length === 3 && parent.arguments[2] === current) ||
        (parent.arguments.length === 2 && parent.arguments[1] === current))
    ) {
      current = parent;
      continue;
    }
    return false;
  }
  const setup = ts.findAncestor(render.parent, ts.isFunctionLike);
  if (
    !setup ||
    !ts.isMethodDeclaration(setup) ||
    !ts.isReturnStatement(render.parent) ||
    render.parent.expression !== render ||
    render.parent.parent !== setup.body
  )
    return false;
  if (getPropertyName(setup.name) !== 'setup') return false;
  const config = setup.parent;
  const definition = config.parent;
  if (
    !ts.isObjectLiteralExpression(config) ||
    !ts.isCallExpression(definition) ||
    definition.arguments[0] !== config ||
    !ts.isIdentifier(definition.expression) ||
    definition.expression.text !== 'definePrototype' ||
    ts.findAncestor(definition.parent, ts.isFunctionLike)
  )
    return false;
  const source = node.getSourceFile();
  for (const name of ['definePrototype', 'tw']) {
    if (
      !source.statements.some(
        (statement) =>
          ts.isImportDeclaration(statement) &&
          statement.moduleSpecifier.text === '@proto.ui/core' &&
          !statement.importClause?.isTypeOnly &&
          ts.isNamedImports(statement.importClause?.namedBindings ?? {}) &&
          statement.importClause.namedBindings.elements.some(
            (binding) =>
              !binding.isTypeOnly &&
              binding.name.text === name &&
              (binding.propertyName ?? binding.name).text === name
          )
      )
    )
      return false;
  }

  let safe = true;
  function check(current) {
    if (ts.isIdentifier(current) && current.text === receiver && current !== parameter.name) {
      const access = current.parent;
      // Reject shadowing, reassignment, method replacement and escaping the
      // receiver to helpers; only direct renderer calls prove this bounded case.
      if (
        !(
          ts.isPropertyAccessExpression(access) &&
          access.expression === current &&
          ['el', 'slot'].includes(access.name.text) &&
          ts.isCallExpression(access.parent) &&
          access.parent.expression === access
        )
      )
        safe = false;
    }
    ts.forEachChild(current, check);
  }
  check(render);
  // A local tw binding would invalidate the canonical direct initializer too.
  function checkTw(current) {
    if (
      (ts.isVariableDeclaration(current) ||
        ts.isParameter(current) ||
        ts.isBindingElement(current) ||
        ts.isFunctionDeclaration(current)) &&
      current.name &&
      ts.isIdentifier(current.name) &&
      current.name.text === 'tw'
    )
      safe = false;
    ts.forEachChild(current, checkTw);
  }
  checkTw(setup);
  return safe;
}

function isFeedbackStyleUseCall(node) {
  if (!memberIs(node.expression, 'use')) return false;
  const style = memberOwner(node.expression);
  if (!style || !memberIs(style, 'style')) return false;
  const feedback = memberOwner(style);
  return Boolean(feedback && memberIs(feedback, 'feedback'));
}

function isFeedbackStyleTwCall(node) {
  return Boolean(
    ts.findAncestor(
      node,
      (ancestor) => ts.isCallExpression(ancestor) && isFeedbackStyleUseCall(ancestor)
    )
  );
}

function isInsideRuleCall(node) {
  return Boolean(
    ts.findAncestor(
      node,
      (ancestor) => ts.isCallExpression(ancestor) && memberIs(ancestor.expression, 'rule')
    )
  );
}

function createsScope(node) {
  return (
    ts.isSourceFile(node) ||
    ts.isBlock(node) ||
    ts.isModuleBlock(node) ||
    ts.isCaseBlock(node) ||
    ts.isCatchClause(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    // A loop initializer binds in the loop's own scope, so a name it shadows
    // must not answer for the body.
    isLoopStatement(node)
  );
}

function isLoopStatement(node) {
  return ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node);
}

/** The declarations a loop initializer introduces, if it declares anything. */
function loopInitializerDeclarations(node) {
  const initializer = isLoopStatement(node) ? node.initializer : undefined;
  return initializer && ts.isVariableDeclarationList(initializer) ? initializer.declarations : [];
}

function hasStatements(node) {
  return ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node);
}

function registerDeclaration(decl, scope, exposures) {
  if (!decl.initializer) {
    if (isVarList(decl.parent) && ts.isIdentifier(decl.name) && scope.bindings.has(decl.name.text))
      return;
    shadowBindingPattern(scope, decl.name);
    return;
  }

  if (ts.isIdentifier(decl.name)) {
    const binding = resolveBinding(decl.initializer, scope);
    const local = { ...binding, importedBinding: false, bindingNode: decl };
    // `const alias = controls` names the one object the container binding holds.
    // A member write through either name has to move the member the other reads,
    // so the two bindings share one member map. The spread above copies an
    // existing map by reference already; when the container has none yet, create
    // one and hand it to both so a later `alias.ready = …` is visible as
    // `controls.ready` (and vice versa) instead of landing on a private copy.
    if (
      ts.isIdentifier(unwrapTransparent(decl.initializer)) &&
      binding.semanticMap == null &&
      local.semanticMap == null &&
      !binding.semantic &&
      !binding.unknownAlternative &&
      binding.sourceValue?.kind !== 'state'
    ) {
      const shared = new Map();
      binding.semanticMap = shared;
      local.semanticMap = shared;
    }
    scope.bindings.set(decl.name.text, applyExposure(decl.name.text, local, scope, exposures));
    return;
  }

  if (ts.isArrayBindingPattern(decl.name)) {
    const value = resolveBinding(decl.initializer, scope);

    decl.name.elements.forEach((element, index) => {
      if (ts.isOmittedExpression(element) || !ts.isIdentifier(element.name)) return;
      const selected = element.dotDotDotToken
        ? emptyValue()
        : selectPatternMember(value, String(index), scope);
      scope.bindings.set(element.name.text, selected);
    });
    return;
  }

  if (ts.isObjectBindingPattern(decl.name)) {
    const value = resolveBinding(decl.initializer, scope);

    for (const element of decl.name.elements) {
      if (!ts.isIdentifier(element.name)) continue;
      const propertyName = element.propertyName
        ? getPropertyName(element.propertyName)
        : element.name.text;
      if (!propertyName) continue;

      const selected = element.dotDotDotToken
        ? emptyValue()
        : selectPatternMember(value, propertyName, scope);
      scope.bindings.set(element.name.text, selected);
    }
  }
}

/** Select every live container alternative without manufacturing a member AST. */
function selectPatternMember(value, key, scope) {
  const branches = value.containers ?? [value];
  const selected = branches.map((branch) => {
    const capturedGraphs = sourceValueCandidates(branch);
    const graphs = [
      ...new Set(
        capturedGraphs.flatMap((graph) =>
          graph.kind === 'object' ? scope.versions.versions(graph) : [graph]
        )
      ),
    ];
    const members = graphs.map((graph) =>
      graph.kind === 'object' ? graph.members.get(key) : undefined
    );
    const proof = definitiveLocalMemberWrites.get(branch.semanticMap)?.get(key);
    const fresh =
      proof &&
      proof.versions === scope.versions &&
      proof.sourceValue === branch.sourceValue &&
      proof.sources.length === capturedGraphs.length &&
      proof.sources.every((source) => capturedGraphs.includes(source)) &&
      proof.entry === branch.semanticMap?.get(key);
    const semanticCandidates = [];
    let unknown = Boolean(branch.unknownAlternative || (fresh && proof.unknown));
    if (fresh) semanticCandidates.push(...memberSemantics(proof.entry));
    else
      for (const member of members) {
        const semantics = member ? sourceValueSemantics(member) : null;
        if (member && member.kind !== 'state' && member.kind !== 'unknown') continue;
        const entries = memberSemantics(semantics?.get('__state'));
        if (entries.length > 0) semanticCandidates.push(...entries);
        else unknown = true;
      }
    if (graphs.length === 0)
      semanticCandidates.push(...memberSemantics(branch.semanticMap?.get(key)));
    if (graphs.length === 0 && !branch.semanticMap?.has(key)) unknown = true;
    const sources = fresh
      ? []
      : [
          ...new Set(
            members
              .filter(Boolean)
              .flatMap((member) =>
                member.kind === 'object' ? scope.versions.versions(member) : [member]
              )
          ),
        ];
    // Reuse the actual object binding when it exists: its maps and graph are
    // shared with aliases, including local proofs and token-map lifetimes.
    let held;
    if (
      sources.length > 0 &&
      sources.every((member) => member.kind !== 'state' && member.kind !== 'unknown')
    ) {
      for (let owner = scope; owner && !held; owner = owner.parent) {
        for (const binding of owner.bindings.values()) {
          const candidates = sourceValueCandidates(binding);
          if (
            !binding.unknownAlternative &&
            candidates.length === sources.length &&
            sources.every((member) => candidates.includes(member))
          ) {
            held = binding;
            break;
          }
        }
      }
    }
    const semantics = [...new Set(semanticCandidates)];
    const strings = branch.map?.get(key) ?? [];
    return {
      ...(held ?? (strings.length > 0 ? asStringValue(strings) : emptyValue())),
      ...(semantics.length > 0 ? { semantic: semantics[0], alternatives: semantics.slice(1) } : {}),
      ...(sources.length > 0 ? { sourceValue: sources[0], sourceValues: sources } : {}),
      ...(unknown ? { unknownAlternative: true } : {}),
    };
  });
  const semantics = [...new Set(selected.flatMap(knownBindingSemantics))];
  const sources = [...new Set(selected.flatMap(sourceValueCandidates))];
  const strings = [...new Set(selected.flatMap((branch) => branch.strings))];
  return {
    ...selected[0],
    strings,
    single: strings.length === 1 ? strings[0] : null,
    semantic: semantics[0] ?? null,
    alternatives: semantics.slice(1),
    ...(sources.length > 0 ? { sourceValue: sources[0], sourceValues: sources } : {}),
    ...(selected.length > 1 ? { containers: selected } : {}),
    ...(value.unknownAlternative ||
    selected.some((branch) => branch.unknownAlternative) ||
    (semantics.length > 0 && selected.some((branch) => bindingSemantics(branch).length === 0))
      ? { unknownAlternative: true }
      : {}),
  };
}

function loopMemberExpression(value, key) {
  const inner = unwrapTransparent(value);
  if (ts.isArrayLiteralExpression(inner)) {
    const index = Number(key);
    return Number.isInteger(index) && index >= 0 ? (inner.elements[index] ?? null) : null;
  }
  if (!ts.isObjectLiteralExpression(inner)) return null;
  for (const property of inner.properties) {
    if (ts.isShorthandPropertyAssignment(property) && property.name.text === key)
      return property.name;
    if (
      ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) &&
      property.name.text === key
    )
      return property.initializer;
  }
  return null;
}

function joinLoopBindings(expressions, scope) {
  const bindings = expressions
    .filter(Boolean)
    .map((expression) => resolveBinding(expression, scope));
  if (bindings.length === 0) return emptyValue();
  const strings = [...new Set(bindings.flatMap((binding) => binding.strings))];
  const semantics = [
    ...new Set(
      bindings
        .flatMap((binding) => [binding.semantic, ...(binding.alternatives ?? [])])
        .filter(Boolean)
    ),
  ];
  const sourceValues = [...new Set(bindings.flatMap(sourceValueCandidates))];
  return {
    ...bindings[0],
    strings,
    single: strings.length === 1 ? strings[0] : null,
    ...(semantics.length > 0 ? { semantic: semantics[0], alternatives: semantics.slice(1) } : {}),
    ...(sourceValues.length > 0 ? { sourceValue: sourceValues[0], sourceValues } : {}),
  };
}

function registerLoopDeclaration(decl, scope, exposures, elements, lookupScope = scope) {
  const assign = (name, expressions) => {
    if (!ts.isIdentifier(name)) return;
    const binding = joinLoopBindings(expressions, lookupScope);
    const local = { ...binding, importedBinding: false, bindingNode: decl };
    scope.bindings.set(name.text, applyExposure(name.text, local, scope, exposures));
  };
  if (ts.isIdentifier(decl.name)) {
    assign(decl.name, elements);
    return;
  }
  if (ts.isArrayBindingPattern(decl.name)) {
    decl.name.elements.forEach((element, index) => {
      if (ts.isOmittedExpression(element) || !ts.isIdentifier(element.name)) return;
      assign(
        element.name,
        elements.map((value) => loopMemberExpression(value, String(index))).filter(Boolean)
      );
    });
    return;
  }
  if (ts.isObjectBindingPattern(decl.name)) {
    for (const element of decl.name.elements) {
      if (!ts.isBindingElement(element) || !ts.isIdentifier(element.name)) continue;
      const property = element.propertyName ?? element.name;
      const key =
        ts.isIdentifier(property) || ts.isStringLiteralLike(property) ? property.text : null;
      if (key !== null)
        assign(
          element.name,
          elements.map((value) => loopMemberExpression(value, key)).filter(Boolean)
        );
    }
  }
}

function sourceStateSemantic(state) {
  // Focus state handles keep a capture name (`__stateName`) distinct from the
  // Web semantic (`__stateSemantic`). Prefer that source metadata; authored
  // `def.state` declarations have no separate semantic and retain the name.
  // In particular, `constructor` is a state name, not Object.prototype.constructor.
  const semantic = String(state.semantic ?? state.declaredName);
  const native = officialEntry(OFFICIAL_NATIVE_VARIANTS, semantic);
  if (native) return native;
  if (state.semantic === undefined) {
    if (state.variant === 'fromInteraction')
      return officialEntry(INTERACTION_STATE_SEMANTICS, state.declaredName);
    if (state.variant === 'fromAccessibility')
      return officialEntry(ACCESSIBILITY_STATE_SEMANTICS, state.declaredName);
  }
  const attribute = exposedDataAttributeName(semantic);
  return attribute ? `data-[${attribute}]` : null;
}

function sourceValueSemantics(value) {
  if (!value || value.kind === 'unknown') return null;
  if (value.kind === 'state') {
    const semantic = sourceStateSemantic(value.state);
    return semantic ? new Map([['__state', semantic]]) : null;
  }
  if (value.kind === 'callable') return null;
  if (value.kind === 'result') {
    // State handles are exposed under the runtime's `stateHandles` member. Do
    // not flatten them onto the result itself: `hook.required` is not the same
    // path as `hook.stateHandles.required`. The member resolver materializes
    // the nested map when that path is actually read.
    return null;
  }
  const map = new Map();
  for (const [name, member] of value.members) {
    const nested = sourceValueSemantics(member);
    if (nested?.has('__state')) map.set(name, nested.get('__state'));
  }
  return map;
}

/** Whether a summary value carries an admitted authored hook identity. */
function hasSourceHookProvenance(value) {
  if (!value || value.kind === 'unknown') return false;
  if (value.kind === 'state' || value.kind === 'result' || value.kind === 'callable') return true;
  for (const member of value.members.values()) {
    if (hasSourceHookProvenance(member)) return true;
  }
  return false;
}

/** The source candidates a value may hold after a conditional/reassignment. */
function sourceValueCandidates(value) {
  if (!value) return [];
  const values = value.sourceValues ?? (value.sourceValue ? [value.sourceValue] : []);
  return [...new Set(values)];
}

function containsSourceReference(value, target, seen = new Set()) {
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
}

function replaceSourceReference(value, target, replacement, rewritten = new Map(), replacements) {
  const direct = replacements?.get(value) ?? (value === target ? replacement : undefined);
  if (direct !== undefined) return { value: direct, changed: true };
  if (!value || value.kind === 'unknown') return { value, changed: false };
  if (rewritten.has(value)) return rewritten.get(value);
  const result = { value, changed: false };
  rewritten.set(value, result);
  if (value.kind === 'object') {
    let changed = false;
    const members = new Map();
    for (const [key, member] of value.members) {
      const next = replaceSourceReference(member, target, replacement, rewritten, replacements);
      members.set(key, next.value);
      changed ||= next.changed;
    }
    if (changed) {
      result.value = { ...value, members };
      result.changed = true;
    }
    return result;
  }
  if (value.kind === 'result') {
    const handle = value.handle
      ? replaceSourceReference(value.handle, target, replacement, rewritten, replacements)
      : { value: undefined, changed: false };
    const children = new Map();
    let changed = handle.changed;
    for (const [key, child] of value.children) {
      const next = replaceSourceReference(child, target, replacement, rewritten, replacements);
      children.set(key, next.value);
      changed ||= next.changed;
    }
    if (changed) {
      result.value = {
        ...value,
        ...(handle.value ? { handle: handle.value } : {}),
        children,
      };
      result.changed = true;
    }
    return result;
  }
  return result;
}

function propagateSourceReference(
  scope,
  target,
  replacement,
  uncertain = false,
  replacements,
  writtenMember
) {
  if (replacements) {
    for (const [before, after] of replacements) scope.versions.record(before, after, uncertain);
  } else {
    scope.versions.record(target, replacement, uncertain);
  }
  const rewritten = new Map();
  for (let current = scope; current; current = current.parent) {
    for (const binding of current.bindings.values()) {
      const candidates = sourceValueCandidates(binding);
      if (candidates.length === 0) continue;
      const replaced = candidates.map(
        (candidate) =>
          replaceSourceReference(candidate, target, replacement, rewritten, replacements).value
      );
      if (!replaced.some((candidate, index) => candidate !== candidates[index])) continue;
      const next = uncertain ? [...new Set([...replaced, ...candidates])] : replaced;
      if (writtenMember !== undefined && binding.sourceValue === target)
        advanceLocalMemberProofs(
          binding,
          binding.sourceValue,
          next[0],
          binding.sourceValue === target ? writtenMember : undefined,
          next
        );
      else if (
        binding.sourceValue !== target &&
        !replacements?.has(binding.sourceValue) &&
        binding.sourceValue?.kind === 'object' &&
        replaced[0]?.kind === 'object'
      ) {
        // A child mutation rewrites its ancestors without writing their other
        // members. Reanchor only proofs for unchanged immediate siblings.
        const before = binding.sourceValue.members;
        const after = replaced[0].members;
        const changed = new Set(
          [...new Set([...before.keys(), ...after.keys()])].filter(
            (key) => before.get(key) !== after.get(key)
          )
        );
        advanceLocalMemberProofs(binding, binding.sourceValue, next[0], changed, next);
      }
      binding.sourceValue = next[0];
      if (next.length > 1 || binding.sourceValues) binding.sourceValues = next;
    }
  }
  // A write to a nested object rewrites the ancestors that hold it, so the
  // graph a container holds is a newer version of the graph it replaced.
  // Recording the ancestors keeps a later resolution of one of them - a
  // producer call that hands the same container out again - from reaching the
  // graph that was written to.
  for (const [before, result] of rewritten) {
    if (!result.changed || before === result.value) continue;
    scope.versions.record(before, result.value, uncertain);
  }
}

function mergeSourceSemantics(values) {
  const merged = new Map();
  for (const value of values) {
    const semantics = sourceValueSemantics(value);
    if (!semantics) continue;
    for (const [key, semantic] of semantics) {
      const candidates = Array.isArray(semantic) ? semantic : [semantic];
      const previous = merged.get(key);
      const all = [
        ...(previous ? (Array.isArray(previous) ? previous : [previous]) : []),
        ...candidates,
      ];
      const unique = [...new Set(all.filter(Boolean))];
      if (unique.length === 1) merged.set(key, unique[0]);
      else if (unique.length > 1) merged.set(key, unique);
    }
  }
  return merged;
}

/** A container's token strings change with its members, just like its State graph. */
function updateTokenMembers(binding, member, written, uncertain = false) {
  if (!binding.map) return;
  if (member === null) binding.map.clear();
  else if (written && !written.unknownAlternative && written.strings.length > 0) {
    const previous = uncertain ? (binding.map.get(member) ?? []) : [];
    binding.map.set(member, [...new Set([...previous, ...written.strings])]);
  } else binding.map.delete(member);
  binding.strings = [...new Set([...binding.map.values()].flat())];
  binding.single = binding.strings.length === 1 ? binding.strings[0] : null;
}

/**
 * The selector map of a binding is per binding, so the members a call
 * replaced move there as well as in the source graph.
 */
function applyCallSemantics(scope, previous, next, copied, proven, uncertain, priorProofs) {
  const keys = proven
    ? [
        ...new Set(
          copied.flatMap((source) => (source.kind === 'object' ? [...source.members.keys()] : []))
        ),
      ]
    : [...previous.members.keys()];
  const semantics = mergeSourceSemantics([next]);
  for (let owner = scope; owner; owner = owner.parent) {
    for (const held of owner.bindings.values()) {
      if (held.sourceValue !== next) continue;
      for (const key of keys) updateTokenMembers(held, key, null);
      if (!held.semanticMap) continue;
      const affected = proven ? keys : [...new Set([...keys, ...held.semanticMap.keys()])];
      for (const key of affected) {
        if (!proven) {
          const before = priorProofs?.get(held.semanticMap)?.get(key);
          const kept = uncertain ? knownBindingSemantics(before) : [];
          if (kept.length > 0) {
            held.semanticMap.set(key, kept);
            let proofs = definitiveLocalMemberWrites.get(held.semanticMap);
            if (!proofs) {
              proofs = new Map();
              definitiveLocalMemberWrites.set(held.semanticMap, proofs);
            }
            proofs.set(key, {
              sourceValue: held.sourceValue,
              sources: sourceValueCandidates(held),
              versions: scope.versions,
              entry: held.semanticMap.get(key),
              unknown: true,
            });
          } else held.semanticMap.delete(key);
          continue;
        }
        const written = memberSemantics(semantics.get(key));
        if (written.length === 0) {
          held.semanticMap.delete(key);
          continue;
        }
        const before = priorProofs?.get(held.semanticMap)?.get(key);
        const kept = uncertain
          ? knownBindingSemantics(before).filter((entry) => !written.includes(entry))
          : [];
        held.semanticMap.set(key, [...written, ...kept]);
        if (uncertain && before) {
          let proofs = definitiveLocalMemberWrites.get(held.semanticMap);
          if (!proofs) {
            proofs = new Map();
            definitiveLocalMemberWrites.set(held.semanticMap, proofs);
          }
          proofs.set(key, {
            sourceValue: held.sourceValue,
            sources: sourceValueCandidates(held),
            versions: scope.versions,
            entry: held.semanticMap.get(key),
            unknown: before.unknownAlternative || bindingSemantics(before).length === 0,
          });
        }
      }
    }
  }
}

/**
 * The scope that holds a source graph, so a write inside a callback is not
 * ordered against a read outside it. The outermost scope that holds the graph
 * is the one that decides, the same way the container owner does: an alias
 * inside a callback does not make the write ordered against an outer read.
 */
function scopeOwningGraph(graph, scope) {
  let owning = null;
  for (let current = scope; current; current = current.parent) {
    for (const held of current.bindings.values()) {
      if (sourceValueCandidates(held).includes(graph)) owning = current;
    }
  }
  return owning;
}

/**
 * The source-backed containers an argument may denote.
 *
 * A name answers from its binding, and a member of a name that holds no
 * proven source value cannot be one either. Resolving the expression instead
 * would expand the scope into one environment per candidate, for every call
 * argument.
 */
function containerArgumentValues(argument, scope) {
  const inner = unwrapTransparent(argument);
  if (ts.isIdentifier(inner)) {
    return sourceValueCandidates(lookup(inner.text, scope)).filter(
      (value) => value.kind === 'object'
    );
  }
  const owner = memberOwner(inner);
  if (owner && ts.isIdentifier(unwrapTransparent(owner))) {
    const candidates = sourceValueCandidates(lookup(unwrapTransparent(owner).text, scope));
    if (candidates.length === 0) return [];
    // A member of a proven object graph is read from that graph, so the scope
    // does not have to be expanded into one environment per candidate.
    const key = memberName(inner);
    if (key !== null && candidates.every((value) => value.kind === 'object')) {
      const members = candidates.map((value) =>
        value.kind === 'object' ? value.members.get(key) : undefined
      );
      return [...new Set(members.filter((member) => member !== undefined))];
    }
  }
  return sourceValueCandidates(resolveExpression(inner, scope)).filter(
    (value) => value.kind === 'object'
  );
}

/**
 * The source-backed containers a call's receiver denotes.
 *
 * A method call may write to the object it is called on, so the receiver is a
 * container the call may mutate even when the call takes no argument at all.
 * A call whose callee is a bare name has no receiver: nothing is handed to it
 * but its arguments.
 */
function receiverContainerValues(node, scope) {
  const callee = unwrapTransparent(node.expression);
  if (!ts.isPropertyAccessExpression(callee) && !ts.isElementAccessExpression(callee)) return [];
  return containerArgumentValues(callee.expression, scope);
}

/**
 * The source graph a copy reads from, when the expression denotes exactly
 * one proven graph. A source with an unproved alternative copies a different
 * member set on the other branch, so nothing about the copy is proven.
 */
function copySourceValue(argument, scope) {
  const inner = unwrapTransparent(argument);
  // A name answers from its binding, which holds the graph the name denotes.
  if (ts.isIdentifier(inner)) {
    const values = sourceValueCandidates(lookup(inner.text, scope));
    if (values.length !== 1) return undefined;
    const value = values[0];
    if (value.kind !== 'object') return undefined;
    return sourceMembersProven(value) ? value : undefined;
  }
  const source = sourceSummaryValue(inner, scope);
  if (!source) return undefined;
  const values = source.resolvedValues ?? [source.resolved.value];
  if (values.length !== 1) return undefined;
  const value = values[0];
  if (value.kind !== 'object') return undefined;
  return sourceMembersProven(value) ? value : undefined;
}

/**
 * Whether a call's callee denotes a proven read-only accessor.
 *
 * A proven accessor reads the result it is called on and never writes to it,
 * so the call does not withdraw the proof the receiver's members carry. The
 * proof is the callee itself, not the value the call returns: a state read
 * with a dynamic key returns a value the summary cannot name, while the
 * accessor still reads.
 *
 * The member is read from the graph the receiver holds now, not from the
 * projection the producer declared. A member write replaces the member in the
 * graph the container holds, and a producer hands the same container to every
 * call, so a later call reaches the member the container holds then. Reading
 * the declared projection instead would certify a receiver whose member a
 * write may already have replaced.
 *
 * Every graph the receiver may denote must carry such an accessor. The
 * receiver may be one of several values - a name that holds one object on one
 * branch and another on the other - and the runtime picks the branch it
 * takes, so a callee that may be a mutator on one of them writes to the
 * receiver on that branch. Reading only the primary resolution would certify
 * a receiver the runtime may have written to.
 *
 * The result's `getState` accessor is the one callable the summary proves,
 * and it reads the result it is called on without ever writing to it. A
 * method whose name merely looks read-only proves nothing about what it does
 * to its receiver, so nothing is exempt by its spelling, and a callable that
 * is not an admitted accessor proves nothing either.
 *
 * The receiver is captured before the arguments are walked, so the proof is
 * the one the receiver carried when the call was reached: a later argument
 * that rebinds a name cannot change what the callee denoted.
 *
 * Every version the receiver may hold is read, not only the newest one. A
 * write that may not have run leaves the graph it replaced in place, so the
 * container may still hold a member the newest version replaced.
 */
function provenAccessorCallee(node, scope, receiver) {
  const callee = unwrapTransparent(node.expression);
  if (!ts.isPropertyAccessExpression(callee) && !ts.isElementAccessExpression(callee)) return false;
  const key = memberName(callee);
  if (key === null || !receiver || receiver.length === 0) return false;
  // Every version the receiver may hold is required, and the versions of
  // several candidates are the same container, so they are counted once.
  const versions = new Set();
  for (const held of receiver) {
    for (const version of scope.versions.versions(held)) versions.add(version);
  }
  if (versions.size === 0) return false;
  return [...versions].every((current) => {
    if (!current || current.kind !== 'object') return false;
    const member = current.members.get(key);
    if (!member || member.kind !== 'callable') return false;
    return member.operation === 'getState';
  });
}

/**
 * Withdraw reachable mutable containers without following immutable State or
 * callable captures. Identity-based visitation preserves distinct twins and
 * handles shared children without writing them twice within this graph. Each
 * reachability class is one batch, with no intermediate conditional parents.
 */
function invalidateUnknownCallGraphs(scope, requests) {
  const collect = (uncertain, seen, skip) => {
    const replacements = new Map();
    const visit = (current) => {
      if (!current || (current.kind !== 'object' && current.kind !== 'result')) return;
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
      // Keep a retired reference in the batch without following its detached
      // members; only live versions describe what the call can reach.
      if (!replacements.has(current)) replacements.set(current, mutateSourceGraph(current, null));
      for (const version of versions) {
        if (version.kind !== 'object' || skip?.has(version)) continue;
        if (!replacements.has(version)) replacements.set(version, mutateSourceGraph(version, null));
        for (const member of version.members.values()) visit(member);
      }
    };
    for (const request of requests) {
      if (request.uncertain === uncertain) visit(request.value);
    }
    return replacements;
  };
  // Definite reachability wins when another candidate can also reach the same
  // container. Both maps still read only pre-call graphs.
  const definiteSeen = new Set();
  const definite = collect(false, definiteSeen);
  const conditional = collect(true, new Set(), definiteSeen);
  const publishBatch = (replacements, uncertain) => {
    const first = replacements.entries().next();
    if (first.done) return;
    const priorProofs = new Map();
    if (uncertain) {
      for (let owner = scope; owner; owner = owner.parent) {
        for (const held of owner.bindings.values()) {
          if (
            held.sourceValue?.kind !== 'object' ||
            !replacements.has(held.sourceValue) ||
            !held.semanticMap
          )
            continue;
          const keys = new Set([...held.semanticMap.keys(), ...held.sourceValue.members.keys()]);
          priorProofs.set(
            held.semanticMap,
            new Map([...keys].map((key) => [key, selectPatternMember(held, key, scope)]))
          );
        }
      }
    }
    propagateSourceReference(scope, first.value[0], first.value[1], uncertain, replacements);
    for (const [previous, next] of replacements) {
      applyCallSemantics(scope, previous, next, [], false, uncertain, priorProofs);
    }
  };
  // Definite writes advance the graphs a possible write retained, without
  // discarding the unknown alternative from that possible write.
  publishBatch(conditional, true);
  publishBatch(definite, false);
}

/**
 * Withdraw the proof the members of a call's receiver carry.
 *
 * A method call may replace any member of the object it is called on, so the
 * container keeps no proof of the members it holds. The container is the one
 * the receiver denoted when it was evaluated, and the write lands on the
 * version that container holds now.
 */
function invalidateReceiverSource(
  node,
  scope,
  receiver,
  readsOnly,
  live,
  mutation,
  unknownCallValues
) {
  if (receiver.length === 0) return;
  // A call the summary proves reads its receiver does not write to it. The
  // proof is the callee: a hook accessor such as `getState`, `getAsHook` or
  // `getAsHookHandle` reads the result it is called on. What the call returns
  // is not part of that proof, because a state read with a dynamic key
  // returns a value the summary cannot name while the accessor still reads.
  // A method whose name merely looks read-only proves nothing about what it
  // does to its receiver, so no call is exempt by its spelling.
  if (readsOnly) return;
  // A member write replaced the graph the container holds without replacing
  // the container, so the mutation lands on the version this identity holds
  // now - not on another candidate's version. Every version the container may
  // hold is withdrawn, because a write that may not have run leaves the graph
  // it replaced in place. The versions are the ones the call found: they are
  // read before any container of the call is written.
  // The versions of one container are that container, so the call wrote to all
  // of them; the candidates of different containers are written one at a time,
  // so the others keep the members they held.
  const first = receiver[0];
  const oneContainer =
    first !== undefined &&
    receiver.every((candidate) => candidate && scope.versions.sameContainer(candidate, first));
  for (const current of live) {
    if (!current || current.kind !== 'object') continue;
    const owning = scopeOwningGraph(current, scope);
    const uncertain =
      // Only one of several containers is written, so the others keep the
      // members they held.
      !oneContainer ||
      isConditionallyReached(node, scope.definitelyReachedLogicalAssignments) ||
      isDeferredWrite(node, enclosingFunction(owning?.node ?? null));
    if (mutation.kind === 'unknown') {
      unknownCallValues.push({ value: current, uncertain });
      continue;
    }
    const next = mutateSourceGraph(current, null);
    propagateSourceReference(scope, current, next, uncertain);
    applyCallSemantics(scope, current, next, [], false, uncertain);
  }
}

/**
 * A call may write to the containers it receives, so the cached provenance of
 * a source-backed container is only sound while no member it holds has been
 * replaced.
 *
 * A known mutating call is tracked when every member it copies is proven. Any
 * other call keeps no proof of the members the containers it received hold,
 * or of mutable containers reachable through them, because it may have
 * replaced any of them.
 */
function applyCallSourceMutation(node, scope, captured, receiver, readsOnly) {
  if (captured.length === 0 && receiver.length === 0) return;
  // An authored asHook producer never receives the arguments of its call:
  // the runtime evaluates them for their effects and then invokes the
  // producer's setup with the definition handle alone
  // (packages/core/src/prototype.ts, `proto.setup(def)` for the asHook kind),
  // and the summary only recognizes `defineAsHook` declarations as producers.
  // The producer therefore cannot write to a container it was passed, so the
  // call does not withdraw it here.
  if (scope.sourceSummary?.isAuthoredProducerCall?.(node, node.getSourceFile())) return;
  const mutation = hookSourceCallMutation(node);
  const unknownCallValues = [];
  // The receiver is evaluated before the arguments, so the container it
  // denoted is the one the call wrote to before it looked at an argument.
  // Every version a container the call received may hold is read before any
  // of them is written: a write can leave the container holding a new graph,
  // and the versions the call wrote to are the ones the call found. Reading
  // them per container as the call goes would let the write to one container
  // add versions to the container the next lookup reads, and the call would
  // write to graphs the call never received.
  const receiverLive = new Set();
  if (!readsOnly) {
    for (const previous of receiver) {
      if (!previous || previous.kind !== 'object') continue;
      for (const version of scope.versions.versions(previous)) receiverLive.add(version);
    }
  }
  const capturedLive = captured.map((entry) => {
    const live = new Set();
    for (const previous of entry.values) {
      if (!previous || previous.kind !== 'object') continue;
      for (const version of scope.versions.versions(previous)) live.add(version);
    }
    // The versions of one container are that container, so the call wrote to
    // all of them; the candidates of different containers are written one at
    // a time, so the others keep the members they held. The candidates are
    // read before any container of the call is written.
    const first = entry.values[0];
    const oneContainer =
      first !== undefined &&
      entry.values.every(
        (candidate) => candidate && scope.versions.sameContainer(candidate, first)
      );
    return { live, oneContainer };
  });
  invalidateReceiverSource(
    node,
    scope,
    receiver,
    readsOnly,
    receiverLive,
    mutation,
    unknownCallValues
  );
  const copied = [];
  let proven = false;
  if (mutation.kind === 'copy') {
    const sources = mutation.sources.map((index) => captured[index]).filter(Boolean);
    // A copy with no source changes nothing, so the container keeps its proof.
    if (sources.length === 0) return;
    proven = true;
    for (const argument of sources) {
      // The source is read when the call runs, so it advances to the version
      // it holds then and not to the snapshot taken while it was evaluated.
      const value = argument.source ? scope.versions.latest(argument.source) : undefined;
      // Members that come from more than one producer name no single
      // producer, so the copy is not proven.
      if (!value || !sourceMembersProven(value) || !sourceMembersOneProducer(value)) {
        proven = false;
        break;
      }
      copied.push(value);
    }
  }
  const targets = mutation.kind === 'copy' ? [captured[mutation.target]].filter(Boolean) : captured;
  const targetLive =
    mutation.kind === 'copy'
      ? capturedLive[mutation.target]
        ? [capturedLive[mutation.target]]
        : []
      : capturedLive;
  for (const [index] of targets.entries()) {
    // A member write replaced the graph the container holds without replacing
    // the container, so the mutation lands on the version this identity holds
    // now - not on another candidate's version. Every version the container may
    // hold is withdrawn, because a write that may not have run leaves the graph
    // it replaced in place.
    const oneContainer = targetLive[index]?.oneContainer ?? false;
    for (const current of targetLive[index]?.live ?? []) {
      if (!current || current.kind !== 'object') continue;
      const owning = scopeOwningGraph(current, scope);
      const uncertain =
        // Only one of several targets is written, so the others keep the
        // members they held.
        !oneContainer ||
        isConditionallyReached(node, scope.definitelyReachedLogicalAssignments) ||
        isDeferredWrite(node, enclosingFunction(owning?.node ?? null));
      if (mutation.kind === 'unknown') {
        unknownCallValues.push({ value: current, uncertain });
        continue;
      }
      // Object.assign only replaces outer members, even when its sources are
      // unproven; it cannot mutate a previously captured nested container.
      const next = proven ? mutateSourceGraph(current, copied) : mutateSourceGraph(current, null);
      const copiedKeys = proven
        ? new Set(copied.flatMap((source) => [...source.members.keys()]))
        : undefined;
      const priorProofs = new Map();
      if (uncertain && copiedKeys) {
        for (let owner = scope; owner; owner = owner.parent) {
          for (const held of owner.bindings.values()) {
            if (held.sourceValue !== current || !held.semanticMap) continue;
            const valid = new Map();
            for (const key of copiedKeys) {
              valid.set(key, selectPatternMember(held, key, scope));
            }
            if (valid.size > 0) priorProofs.set(held.semanticMap, valid);
          }
        }
      }
      propagateSourceReference(scope, current, next, uncertain, undefined, copiedKeys);
      applyCallSemantics(scope, current, next, copied, proven, uncertain, priorProofs);
    }
  }
  if (mutation.kind === 'unknown') invalidateUnknownCallGraphs(scope, unknownCallValues);
}

function sourceSummaryValue(node, scope) {
  const summary = scope.sourceSummary;
  if (!summary) return null;
  if (
    !ts.isCallExpression(node) &&
    !ts.isPropertyAccessExpression(node) &&
    !ts.isElementAccessExpression(node) &&
    !ts.isObjectLiteralExpression(node) &&
    !ts.isArrayLiteralExpression(node)
  )
    return null;
  const value = unwrapTransparent(node);
  // A member of a producer call reads the container the producer handed out,
  // and the container holds its current graph: the member a write replaced is
  // the member the call reads. The declared projection is not what the
  // container holds now.
  if (
    (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) &&
    ts.isCallExpression(unwrapTransparent(value.expression))
  ) {
    const owner = resolveExpression(unwrapTransparent(value.expression), scope);
    const container = owner.sourceValue;
    const key = memberName(value);
    if (container && container.kind === 'object' && key !== null) {
      const versions = scope.versions.versions(container);
      const graphs = versions.length > 0 ? versions : [container];
      // The values are the member's values, one per graph the container may
      // hold, and not the graphs themselves: the member is what the read is
      // about, and the other members of a graph say nothing about it.
      const seen = new Set();
      const values = [];
      for (const graph of graphs) {
        const member = graph.members.get(key);
        if (!member) {
          // A member no graph carries is an alternative of its own, so it is
          // not deduped away.
          values.push({ kind: 'unknown', reason: 'unknown member' });
          continue;
        }
        // The same member in two graphs is one member: the graphs differ in
        // other members, not in this one.
        if (seen.has(member)) continue;
        seen.add(member);
        values.push(member);
      }
      const allProven = values.length > 0 && values.every(hasSourceHookProvenance);
      return {
        resolved: { matched: true, value: values[values.length - 1] },
        resolvedValues: values,
        semanticMap: allProven ? mergeSourceSemantics(values) : null,
      };
    }
  }
  const owner = memberOwner(value);
  if (owner && ts.isIdentifier(unwrapTransparent(owner))) {
    const ownerBinding = lookup(unwrapTransparent(owner).text, scope);
    if (ownerBinding?.unknownAlternative) return null;
  }
  let localBinding = null;
  if (ts.isCallExpression(value) && ts.isIdentifier(unwrapTransparent(value.expression))) {
    const name = unwrapTransparent(value.expression).text;
    localBinding = lookup(name, scope);
    if (localBinding?.unknownAlternative) return null;
    // A detached callable alias (for example `const lookup = facts.getState!`)
    // is resolved through the source environment, not as a producer binding.
    // Keep the producer identity fence for every other local call so a
    // same-named shadow cannot reach an enclosing authored producer.
    if (
      localBinding?.kind &&
      !localBinding.importedBinding &&
      localBinding.sourceValue?.kind !== 'callable'
    ) {
      const bindingNode = localBinding.bindingNode;
      const sameBinding =
        bindingNode && typeof summary.isSameSourceBinding === 'function'
          ? summary.isSameSourceBinding(value, node.getSourceFile(), bindingNode)
          : false;
      if (!sameBinding) {
        return {
          resolved: { matched: true, value: { kind: 'unknown', reason: 'lexically shadowed' } },
          semanticMap: null,
        };
      }
    }
  }
  const environment = new Map();
  for (let current = scope; current; current = current.parent) {
    for (const [name, binding] of current.bindings) {
      if (environment.has(name)) continue;
      if (binding?.unknownAlternative)
        environment.set(name, { kind: 'unknown', reason: 'incomplete binding' });
      else if (binding?.sourceValue) environment.set(name, binding.sourceValue);
      else if (binding?.sourceState)
        environment.set(name, { kind: 'state', state: binding.sourceState });
      else if (binding?.importedBinding || binding?.kind === 'tokenImport') continue;
      else environment.set(name, { kind: 'unknown', reason: 'lexically shadowed' });
    }
  }
  const candidateBindings = [];
  const referenced = new Set();
  const collectReferenced = (current) => {
    if (ts.isIdentifier(current)) {
      const parent = current.parent;
      if (!(ts.isPropertyAccessExpression(parent) && parent.name === current))
        referenced.add(current.text);
    }
    ts.forEachChild(current, collectReferenced);
  };
  collectReferenced(node);
  const seen = new Set();
  for (let current = scope; current; current = current.parent) {
    for (const [name, binding] of current.bindings) {
      if (seen.has(name)) continue;
      seen.add(name);
      if (!referenced.has(name)) continue;
      const candidates = binding.unknownAlternative ? [] : sourceValueCandidates(binding);
      if (candidates.length > 1) candidateBindings.push({ name, candidates });
    }
  }
  let environments = [environment];
  for (const { name, candidates } of candidateBindings) {
    environments = environments.flatMap((base) =>
      candidates.map((candidate) => {
        const next = new Map(base);
        next.set(name, candidate);
        return next;
      })
    );
  }
  const resolutions = environments.map((candidate) =>
    summary.resolve(node, node.getSourceFile(), candidate)
  );
  // A producer hands the same container to every call, so a copy that wrote
  // to it is visible to a later resolution of that producer: the resolution
  // advances to the version the container holds now.
  const matched = resolutions.find((candidate) => candidate.matched) ?? resolutions[0];
  const resolved = {
    matched: matched.matched,
    value: matched.value.kind === 'object' ? scope.versions.latest(matched.value) : matched.value,
  };
  // A container may hold several graphs: a write that may not have run left
  // the graph it replaced in place, and a producer hands the same container to
  // every call. Fan out over the versions the container may hold, before a
  // newest-version normalization drops one of them. The same container is
  // reached through several names, so a version is counted once.
  const values = [];
  const seenVersions = new Set();
  for (const candidate of resolutions) {
    if (!candidate.matched) {
      values.push({ kind: 'unknown', reason: 'unmatched source alternative' });
      continue;
    }
    const held =
      candidate.value.kind === 'object'
        ? scope.versions.versions(candidate.value)
        : [candidate.value];
    for (const value of held) {
      if (seenVersions.has(value)) continue;
      seenVersions.add(value);
      values.push(value);
    }
  }
  const sourceOwner = memberOwner(node);
  const ownerProven = sourceOwner
    ? hasSourceHookProvenance(summary.resolve(sourceOwner, node.getSourceFile(), environment).value)
    : false;
  const sourcePath = values.some(hasSourceHookProvenance) || ownerProven;
  if (!resolved.matched && localBinding && !localBinding.importedBinding)
    return {
      resolved: { matched: true, value: { kind: 'unknown', reason: 'local call' } },
      semanticMap: null,
    };
  if (!resolved.matched || !sourcePath) return null;
  const allProven = values.length > 0 && values.every(hasSourceHookProvenance);
  const sourceValues = values.length > 0 ? values : [resolved.value];
  return {
    resolved,
    resolvedValues: sourceValues,
    semanticMap: allProven ? mergeSourceSemantics(sourceValues) : null,
  };
}

const objectPrototypeEscapeBySource = new WeakMap();

function sourceHasObjectPrototypeEscape(source) {
  const cached = objectPrototypeEscapeBySource.get(source);
  if (cached !== undefined) return cached;
  let escaped = false;
  const visit = (node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === 'prototype' &&
      ts.isIdentifier(unwrapTransparent(node.expression)) &&
      unwrapTransparent(node.expression).text === 'Object'
    ) {
      escaped = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  objectPrototypeEscapeBySource.set(source, escaped);
  return escaped;
}

function sourceMemberPresence(node, scope) {
  const value = unwrapTransparent(node);
  if (!ts.isPropertyAccessExpression(value) && !ts.isElementAccessExpression(value)) return null;
  const key = memberName(value);
  const owner = memberOwner(value);
  if (
    key === null ||
    !owner ||
    sourceHasObjectPrototypeEscape(value.getSourceFile()) ||
    key in Object.prototype
  )
    return null;
  const resolved = resolveExpression(owner, scope);
  const sources = resolved.sourceValues ?? (resolved.sourceValue ? [resolved.sourceValue] : []);
  if (sources.length === 0 || sources.some((source) => source.kind !== 'object')) return null;
  if (sources.every((source) => !source.members.has(key) && source.closed === true)) return false;
  return null;
}

function sourceConditionOutcome(node, scope) {
  const value = unwrapTransparent(node);
  if (ts.isPrefixUnaryExpression(value) && value.operator === ts.SyntaxKind.ExclamationToken) {
    const presence = sourceMemberPresence(value.operand, scope);
    return presence === null ? null : !presence;
  }
  return sourceMemberPresence(value, scope);
}

function resolveExpression(node, scope) {
  const snapshot = scope.expressionSnapshots?.get(node);
  if (snapshot) return snapshot;
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return asStringValue([node.text]);
  }

  if (ts.isTemplateExpression(node)) {
    const parts = [node.head.text];
    for (const span of node.templateSpans) {
      const value = resolveExpression(span.expression, scope);
      if (value.single == null) return emptyValue();
      parts.push(value.single, span.literal.text);
    }
    return asStringValue([parts.join('')]);
  }

  // The index is the member name a positional pattern binds, and an array may
  // hold tokens and handles at once, so both are read in one pass.
  if (ts.isArrayLiteralExpression(node)) {
    const semantics = new Map();
    const incomplete = new Set();
    const parts = [];
    let readsAsTokens = true;
    node.elements.forEach((element, index) => {
      if (ts.isOmittedExpression(element)) {
        readsAsTokens = false;
        return;
      }
      const held = resolveBinding(element, scope);
      if (held.unknownAlternative) {
        readsAsTokens = false;
        incomplete.add(String(index));
      }
      const candidates = knownBindingSemantics(held);
      if (candidates.length > 0 || held.unknownAlternative)
        semantics.set(String(index), candidates.length === 1 ? candidates[0] : candidates);
      if (held.single) parts.push(held.single);
      else readsAsTokens = false;
    });
    // Keep the element list: a comma-joined string cannot tell an element
    // boundary from a comma inside an arbitrary token such as
    // `transition-[color,box-shadow]`.
    const value = readsAsTokens
      ? { ...asStringValue([parts.join(',')]), elements: parts }
      : emptyValue();
    const source = sourceSummaryValue(node, scope);
    if (semantics.size > 0) {
      const proofs = new Map();
      for (const [key, entry] of semantics) {
        proofs.set(key, {
          sourceValue: source?.resolved.value,
          sources: source ? (source.resolvedValues ?? [source.resolved.value]) : [],
          versions: scope.versions,
          entry,
          unknown: incomplete.has(key),
        });
      }
      definitiveLocalMemberWrites.set(semantics, proofs);
    }
    return {
      ...value,
      ...(semantics.size > 0 ? { semanticMap: semantics } : {}),
      ...(source
        ? { sourceValue: source.resolved.value, sourceValues: source.resolvedValues }
        : {}),
    };
  }

  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'join'
  ) {
    return resolveJoinCall(node, scope);
  }

  if (ts.isIdentifier(node)) {
    return lookup(node.text, scope);
  }

  if (ts.isCallExpression(node)) {
    if (ts.isIdentifier(node.expression) && node.expression.text === 'tw') {
      const strings = node.arguments.flatMap(
        (argument) => resolveExpression(argument, scope).strings
      );
      return asStringValue(strings);
    }
    const source = sourceSummaryValue(node, scope);
    const stateHandles = resolveTrustedKnownAsHookStateHandles(node, scope);
    if (source) {
      if (source.semanticMap?.size) {
        // A source-backed `getState('name')` resolves to one state semantic,
        // while a source-backed result/container resolves to a member map.
        // Keep the former as a leaf so `w.state(facts.getState!('name'))`
        // reaches the same path as a named state-handle member.
        if (source.semanticMap.size === 1 && source.semanticMap.has('__state')) {
          const semantic = source.semanticMap.get('__state');
          const candidates = Array.isArray(semantic) ? semantic : [semantic];
          return {
            ...asSemanticValue(candidates[0]),
            alternatives: candidates.slice(1),
            sourceValue: source.resolved.value,
            sourceValues: source.resolvedValues,
          };
        }
        return {
          ...asSemanticMapValue(source.semanticMap),
          sourceValue: source.resolved.value,
          sourceValues: source.resolvedValues,
        };
      }
      // A result may have no immediate state map while still carrying child
      // entries or a projected public handle. Keep that identity for the next
      // member hop instead of turning it into an ordinary empty value. The
      // source summary is authoritative here: known-hook tables are only a
      // fallback when the source path is unavailable altogether.
      return {
        ...emptyValue(),
        sourceValue: source.resolved.value,
        sourceValues: source.resolvedValues,
      };
    }
    if (stateHandles) return asSemanticMapValue(stateHandles);
  }

  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    const source = sourceSummaryValue(node, scope);
    if (source) {
      if (source.resolved.value.kind === 'object') {
        const candidates = source.resolvedValues ?? [source.resolved.value];
        for (let current = scope; current; current = current.parent) {
          for (const held of current.bindings.values()) {
            if (held.unknownAlternative || held.sourceValue !== source.resolved.value) continue;
            const heldCandidates = sourceValueCandidates(held);
            if (
              heldCandidates.length === candidates.length &&
              candidates.every((candidate) => heldCandidates.includes(candidate))
            )
              return held;
          }
        }
      }
      // A local/container semantic map reflects member writes and branch
      // joins. It is newer than an immutable source snapshot, so use it when
      // available and never reintroduce a stale source candidate. A null
      // source map means one possible source path is unknown, so even an old
      // local semantic must not certify a convenient branch.
      const selected = selectMemberBinding(node, scope);
      if (selected && (knownBindingSemantics(selected).length > 0 || selected.unknownAlternative))
        return selected;
      if (source.semanticMap?.size) {
        if (source.semanticMap.size === 1 && source.semanticMap.has('__state')) {
          const semantic = source.semanticMap.get('__state');
          const candidates = Array.isArray(semantic) ? semantic : [semantic];
          return {
            ...asSemanticValue(candidates[0]),
            alternatives: candidates.slice(1),
            sourceValue: source.resolved.value,
            sourceValues: source.resolvedValues,
          };
        }
        return {
          ...asSemanticMapValue(source.semanticMap),
          sourceValue: source.resolved.value,
          sourceValues: source.resolvedValues,
        };
      }
      // Source authority governs state proofs, not the independently captured
      // token strings of a mixed local literal. Read the live lexical map;
      // never re-evaluate its initializer to recover a revoked handle.
      const owner = memberOwner(node);
      const key = memberName(node);
      const strings = owner && key !== null ? resolveExpression(owner, scope).map?.get(key) : null;
      return {
        ...(strings ? asStringValue(strings) : emptyValue()),
        sourceValue: source.resolved.value,
        sourceValues: source.resolvedValues,
      };
    }
  }

  // `const controls = { ready: flag }` — a plain container of handles reads the
  // same way an `asHook` bag does, so `w.state(controls.ready)` has a variant.
  if (ts.isPropertyAccessExpression(node) && node.name.text === 'stateHandles') {
    const stateHandles = resolveTrustedKnownAsHookStateHandles(node.expression, scope);
    if (stateHandles) return asSemanticMapValue(stateHandles);
    if (ts.isIdentifier(node.expression)) {
      const hookHandle = lookup(node.expression.text, scope);
      if (hookHandle.semanticMap) return hookHandle;
      // `const inherited = asFormSubmit()` binds a known hook result whose own
      // bag is resolved from the callee, not from an authored producer. Reach
      // the same table here so a variable-bound call lowers exactly like the
      // direct `asFormSubmit().stateHandles` form.
      const declaration = hookHandle.bindingNode;
      if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) {
        const inherited = resolveTrustedKnownAsHookStateHandles(declaration.initializer, scope);
        if (inherited) return asSemanticMapValue(inherited);
      }
    }
  }

  // `asHook().stateHandles.checked` bound straight to a name. Without this the
  // leaf resolves to nothing and `w.state(checked)` emits no variant, while the
  // same read through a destructure or through the bag resolves fine.
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    const selected = selectMemberBinding(node, scope);
    if (selected && (knownBindingSemantics(selected).length > 0 || selected.unknownAlternative))
      return selected;
  }

  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    // `asHook().stateHandles!` — the bag is optional on the hook result type,
    // so authors reach it through a non-null assertion.
    ts.isNonNullExpression(node)
  ) {
    return resolveExpression(node.expression, scope);
  }

  // A container may hold token data and state handles at once — reading it for
  // one must not discard the other. `const controls = { ready: flag, className:
  // 'bg-red' }` has to answer both `w.state(controls.ready)` and
  // `tw(controls.className)`.
  if (ts.isObjectLiteralExpression(node)) {
    const entries = new Map();
    const semantics = new Map();
    const incomplete = new Set();
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const key = getPropertyName(prop.name);
        if (!key) continue;
        const held = resolveBinding(prop.initializer, scope);
        if (held.unknownAlternative) incomplete.add(key);
        if (!held.unknownAlternative && held.strings.length > 0) entries.set(key, held.strings);
        const candidates = knownBindingSemantics(held);
        if (candidates.length > 0 || held.unknownAlternative)
          semantics.set(key, candidates.length === 1 ? candidates[0] : candidates);
      } else if (ts.isShorthandPropertyAssignment(prop)) {
        const held = lookup(prop.name.text, scope);
        if (held.unknownAlternative) incomplete.add(prop.name.text);
        if (!held.unknownAlternative && held.strings.length > 0)
          entries.set(prop.name.text, held.strings);
        const candidates = knownBindingSemantics(held);
        if (candidates.length > 0 || held.unknownAlternative)
          semantics.set(prop.name.text, candidates.length === 1 ? candidates[0] : candidates);
      }
    }
    const value = asMapValue(entries);
    // Token maps and immediate semantic maps do not describe nested object
    // identity. Retain the summary graph as well so writes and escapes through
    // wrappers reach every alias of the held hook result.
    const source = sourceSummaryValue(node, scope);
    if (semantics.size > 0) {
      const proofs = new Map();
      for (const [key, entry] of semantics) {
        proofs.set(key, {
          sourceValue: source?.resolved.value,
          sources: source ? (source.resolvedValues ?? [source.resolved.value]) : [],
          versions: scope.versions,
          entry,
          unknown: incomplete.has(key),
        });
      }
      definitiveLocalMemberWrites.set(semantics, proofs);
    }
    return {
      ...value,
      ...(semantics.size > 0 ? { semanticMap: semantics } : {}),
      ...(source
        ? { sourceValue: source.resolved.value, sourceValues: source.resolvedValues }
        : {}),
    };
  }

  if (ts.isElementAccessExpression(node)) {
    const base = resolveExpression(node.expression, scope);
    if (!base.map) return emptyValue();

    if (node.argumentExpression && ts.isStringLiteralLike(node.argumentExpression)) {
      return asStringValue(base.map.get(node.argumentExpression.text) ?? []);
    }

    const out = new Set();
    for (const strings of base.map.values()) {
      for (const value of strings) out.add(value);
    }
    return asStringValue(Array.from(out));
  }

  if (ts.isConditionalExpression(node)) {
    const branches = [
      resolveExpression(node.whenTrue, scope),
      resolveExpression(node.whenFalse, scope),
    ];
    const values = new Set([...branches[0].strings, ...branches[1].strings]);
    const semanticMap = new Map();
    for (const branch of branches) {
      for (const [key, semantic] of branch.semanticMap ?? []) {
        const candidates = Array.isArray(semantic) ? semantic : [semantic];
        const previous = semanticMap.get(key);
        const all = [
          ...(previous ? (Array.isArray(previous) ? previous : [previous]) : []),
          ...candidates,
        ];
        const unique = [...new Set(all.filter(Boolean))];
        if (unique.length === 1) semanticMap.set(key, unique[0]);
        else if (unique.length > 1) semanticMap.set(key, unique);
      }
    }
    const sourceValues = [...new Set(branches.flatMap(sourceValueCandidates))];
    const containers = [...new Set(branches.flatMap((branch) => branch.containers ?? [branch]))];
    const result = asStringValue(Array.from(values));
    return {
      ...result,
      ...(semanticMap.size > 0 ? { semanticMap } : {}),
      ...(sourceValues.length > 0 ? { sourceValue: sourceValues[0], sourceValues } : {}),
      ...(containers.length > 0 ? { containers } : {}),
      ...(branches.some((branch) => branch.unknownAlternative) ? { unknownAlternative: true } : {}),
    };
  }

  return emptyValue();
}

function resolveJoinCall(node, scope) {
  const separatorArg = node.arguments[0];
  const separator =
    separatorArg &&
    (ts.isStringLiteralLike(separatorArg) || ts.isNoSubstitutionTemplateLiteral(separatorArg))
      ? separatorArg.text
      : ',';
  const base = resolveExpression(node.expression.expression, scope);
  if (base.elements) return asStringValue([base.elements.join(separator)]);
  if (!base.single) return emptyValue();
  return asStringValue([base.single.split(',').join(separator)]);
}

function lookup(name, scope) {
  let current = scope;
  while (current) {
    const value = current.bindings.get(name);
    if (value) return value;
    current = current.parent;
  }
  return emptyValue();
}

function resolveBinding(node, scope) {
  const snapshot = scope.expressionSnapshots?.get(node);
  if (snapshot) return snapshot;
  const inner = unwrapTransparent(node);
  // The runtime keeps one branch, and whichever it keeps carries its own
  // declared name, so both candidates need a selector and neither may fall
  // back to the expose key.
  if (ts.isConditionalExpression(inner)) {
    const branches = [
      resolveBinding(inner.whenTrue, scope),
      resolveBinding(inner.whenFalse, scope),
    ];
    const hasUnknownBranch = branches.some((branch) => !bindingHasStatePath(branch));
    const branchSourceValues = branches.map(sourceValueCandidates);
    const scalarSemantics = [...new Set(branches.flatMap(knownBindingSemantics))];
    if (scalarSemantics.length > 0) {
      const allSource = branchSourceValues.every((values) => values.length > 0);
      const sourceValues = allSource ? [...new Set(branchSourceValues.flat())] : [];
      return {
        ...asSemanticValue(scalarSemantics[0]),
        alternatives: scalarSemantics.slice(1),
        ...(sourceValues.length > 0 ? { sourceValue: sourceValues[0], sourceValues } : {}),
        ...(hasUnknownBranch ? { unknownAlternative: true } : {}),
      };
    }
    const allSourceBranches = branchSourceValues.every((values) => values.length > 0);
    if (allSourceBranches) {
      const sourceValues = [...new Set(branchSourceValues.flat())];
      const semantics = mergeSourceSemantics(sourceValues);
      // Source graphs cannot represent prototype-local handles. Join their
      // captured entries as well, but only all-branch fresh proofs may fill
      // an unknown source member at the Rule consumer.
      for (const branch of branches) {
        for (const [key, entry] of branch.semanticMap ?? []) {
          const joined = [
            ...new Set([...memberSemantics(semantics.get(key)), ...memberSemantics(entry)]),
          ];
          semantics.set(key, joined.length === 1 ? joined[0] : joined);
        }
      }
      const source = {
        ...branches[0],
        sourceValue: sourceValues[0],
        sourceValues,
        containers: [...new Set(branches.flatMap((branch) => branch.containers ?? [branch]))],
        ...(semantics.size > 0 ? { semanticMap: semantics } : {}),
      };
      joinLocalMemberProofs(source, branches, scope);
      return hasUnknownBranch ? { ...source, unknownAlternative: true } : source;
    }
    const semantics = [...new Set(branches.flatMap(bindingSemantics))];
    if (semantics.length > 0) {
      return {
        ...branches[0],
        semantic: semantics[0],
        alternatives: semantics.slice(1),
        ...(hasUnknownBranch ? { unknownAlternative: true } : {}),
      };
    }
    // Neither branch is a handle, but the name may still be either object, so
    // it carries both and a member write through it reaches both tables.
    // Flattened, because a branch may itself be a conditional: the candidates
    // are the leaves the runtime can land on, not the composites above them.
    // Empty branches still participate: a missing member cannot prove that a
    // logical assignment skips its RHS.
    const containers = branches.flatMap((branch) => branch.containers ?? [branch]);
    if (containers.some((branch) => branch.semanticMap)) return { ...branches[0], containers };
  }

  const semantic = resolveSemanticBinding(node);
  const value = resolveExpression(node, scope);
  const declared = resolveDeclaredStateName(node, scope);
  const withName = declared ? { ...value, stateName: declared } : value;
  return semantic ? { ...withName, semantic } : withName;
}

/**
 * `def.state.bool('hidden', …)` — the name the prototype declared. `StateKernel`
 * stores it as `__stateSemantic`, and `ExposeStateWebModuleImpl` maps that
 * before it would fall back to the expose key, so this is the name the Web
 * attribute comes from.
 */
/** Parentheses, `as`, and non-null assertions name the same expression. */
function unwrapTransparent(node) {
  return ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isNonNullExpression(node)
    ? unwrapTransparent(node.expression)
    : node;
}

/** `x.name` and `x['name']` reach the same member. */
function memberIs(node, name) {
  const target = unwrapTransparent(node);
  if (ts.isPropertyAccessExpression(target)) return target.name.text === name;
  if (ts.isElementAccessExpression(target)) {
    const argument = target.argumentExpression;
    return Boolean(argument) && ts.isStringLiteralLike(argument) && argument.text === name;
  }
  return false;
}

function memberOwner(node) {
  const target = unwrapTransparent(node);
  return ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)
    ? target.expression
    : null;
}

/** The member a `x.name` or `x['name']` write names, if it is static. */
function memberName(node) {
  const target = unwrapTransparent(node);
  if (ts.isPropertyAccessExpression(target)) return target.name.text;
  if (ts.isElementAccessExpression(target)) {
    const argument = target.argumentExpression;
    return argument && (ts.isStringLiteralLike(argument) || ts.isNumericLiteral(argument))
      ? argument.text
      : null;
  }
  return null;
}

function resolveDeclaredStateName(initializer, scope) {
  const node = unwrapTransparent(initializer);
  if (!ts.isCallExpression(node)) return null;
  const owner = memberOwner(node.expression);
  if (!owner || !memberIs(owner, 'state')) return null;
  const first = node.arguments[0];
  if (!first) return null;
  // The name may be a constant the runtime resolves to a real string. A name
  // this cannot evaluate is still a name at runtime, so it is reported as
  // unknown rather than absent — the expose key must not stand in for it.
  const resolved = ts.isStringLiteralLike(first)
    ? first.text
    : resolveExpression(first, scope).single;
  return resolved ?? UNKNOWN_STATE_NAME;
}

/** A `def.state.*` declaration whose name the extractor cannot evaluate. */
const UNKNOWN_STATE_NAME = Symbol('unknown-state-name');

/**
 * The same normalization `createExposeStateWebNameMap` applies to an
 * unannotated exposed key before it becomes a data attribute.
 */
/**
 * Mirrors `OFFICIAL_EXPOSED_STATE_NAMES` in `@proto.ui/module-expose-state-web`.
 * Duplicated rather than imported so this analyzer stays free of runtime
 * dependencies; `prototype-style-tokens.test.ts` asserts the two are identical.
 */
const OFFICIAL_EXPOSED_STATE_NAMES = Object.freeze({
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

/**
 * The variant the Web optimizer emits for an official semantic instead of its
 * attribute. `buildVariant` consults `buildSemanticVariant` first, so an owned
 * `@interaction/hovered` lowers to `hover:`; every other official semantic
 * either has no native variant or is refused by the adapter's native-variant
 * policy and falls back to `data-[…]`, which is what `resolveSemanticBinding`
 * already returns for the matching `fromInteraction` name.
 */
const OFFICIAL_NATIVE_VARIANTS = Object.freeze({
  '@interaction/hovered': 'hover',
  '@interaction/pressed': 'active',
});

const INTERACTION_STATE_SEMANTICS = Object.freeze({
  hovered: 'hover',
  pressed: 'active',
  disabled: 'data-[disabled]',
  focused: 'data-[focused]',
  focusVisible: 'data-[focus-visible]',
});

const ACCESSIBILITY_STATE_SEMANTICS = Object.freeze({
  expanded: 'data-[expanded]',
  invalid: 'data-[invalid]',
  selected: 'data-[selected]',
  checked: 'data-[checked]',
  current: 'data-[current]',
});

/** Both tables inherit `Object.prototype`, so `constructor` is not an entry. */
function officialEntry(table, key) {
  return Object.hasOwn(table, key) ? table[key] : null;
}

function exposedDataAttributeName(key) {
  // The runtime maps an official semantic before it normalizes anything, so
  // `@accessibility/checked` is `data-checked`, not `data-accessibility-checked`.
  const official = officialEntry(OFFICIAL_EXPOSED_STATE_NAMES, key);
  if (official) return official;
  return key
    .trim()
    .replace(/\s+/g, '-')
    .replace(/\./g, '-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/**
 * Every `def.expose.state(key, handle)` in a source, resolved to the handle it
 * ultimately names.
 *
 * Exposure is component-wide at runtime rather than block-scoped, and the
 * exposed-state map is built after setup returns, so neither the block a call
 * sits in nor its position relative to a rule decides whether the rule lowers.
 * Aliases are followed because two references to one handle carry one state id.
 */
/**
 * Whether a write may be skipped at runtime. A branch the source decides
 * statically executes exactly as written; anything else has to keep whatever
 * the name held before it, because the runtime may take the other path.
 */
function isConditionallyReached(node, definitelyReachedLogicalAssignments) {
  for (let child = node, parent = node.parent; parent; child = parent, parent = parent.parent) {
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
function visibleEdges(edges, at) {
  const candidates = edges.filter((edge) => edge.at <= at);
  if (candidates.length === 0) return [];
  const positions = [...new Set(candidates.map((edge) => edge.at))].sort((a, b) => b - a);
  const selected = [];
  for (const position of positions) {
    const group = candidates.filter((edge) => edge.at === position);
    selected.push(...group);
    if (!group.every((edge) => edge.conditional)) break;
  }
  return selected;
}

function collectExposures(root) {
  // Alias edges carry their scope and source position, so two sibling scopes
  // may bind the same name and a later redeclaration cannot rewrite what an
  // earlier expose call captured.
  const aliasEdges = [];
  const declaredIn = new Map();
  const exposures = [];

  const unwrapExpression = (node) =>
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isNonNullExpression(node)
      ? unwrapExpression(node.expression)
      : node;

  const namesExposeState = (callee) => {
    if (ts.isPropertyAccessExpression(callee)) {
      return callee.name.text === 'state' && namesExposeOwner(callee.expression);
    }
    if (ts.isElementAccessExpression(callee)) {
      const argument = callee.argumentExpression;
      return (
        Boolean(argument) &&
        ts.isStringLiteralLike(argument) &&
        argument.text === 'state' &&
        namesExposeOwner(callee.expression)
      );
    }
    return false;
  };

  const namesExpose = (callee) => {
    if (ts.isPropertyAccessExpression(callee)) return callee.name.text === 'expose';
    if (ts.isElementAccessExpression(callee)) {
      const argument = callee.argumentExpression;
      return Boolean(argument) && ts.isStringLiteralLike(argument) && argument.text === 'expose';
    }
    return false;
  };

  const namesExposeOwner = (node) => {
    const owner = unwrapExpression(node);
    if (ts.isPropertyAccessExpression(owner)) return owner.name.text === 'expose';
    if (ts.isElementAccessExpression(owner)) {
      const argument = owner.argumentExpression;
      return Boolean(argument) && ts.isStringLiteralLike(argument) && argument.text === 'expose';
    }
    return false;
  };

  // `const controls = { ready }; def.expose.state('ready', controls.ready)`
  /**
   * Every handle an initializer may end up naming. A conditional selects one at
   * runtime, so both are recorded: over-approximating gives each candidate its
   * variant, which is safe, while recording neither leaves the chosen one
   * without CSS.
   */
  const aliasTargets = (node) => {
    const value = unwrapExpression(node);
    if (ts.isIdentifier(value)) return [value.text];
    if (ts.isConditionalExpression(value)) {
      return [...aliasTargets(value.whenTrue), ...aliasTargets(value.whenFalse)];
    }
    return [];
  };

  // Scoped like every other binding: a nested `controls` must not answer for
  // an outer one of the same name. Members carry positions for the same reason
  // aliases do: `controls.ready = second` retargets the member from there on.
  const objectMembers = new Map();

  /** Every member an object literal names, at the position it was written. */
  /**
   * Every object literal an initializer may yield. A conditional selects one at
   * runtime, so both are recorded for the same reason `aliasTargets` fans out.
   */
  const objectLiteralTargets = (node) => {
    const value = unwrapExpression(node);
    if (ts.isObjectLiteralExpression(value)) return [value];
    if (ts.isConditionalExpression(value)) {
      return [...objectLiteralTargets(value.whenTrue), ...objectLiteralTargets(value.whenFalse)];
    }
    return [];
  };

  const recordObjectLiteral = (owner, base, literal, at, conditional) => {
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
  const containerRoots = (name, chain, at, seen = new Set()) => {
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

  const declaringScopeNode = (chain, name) =>
    chain.find((candidate) => declaredIn.get(candidate)?.has(name)) ?? null;

  const recordMember = (owner, base, key, target, at, conditional) => {
    const scoped = objectMembers.get(owner) ?? new Map();
    const members = scoped.get(base) ?? new Map();
    members.set(key, [...(members.get(key) ?? []), { target, at, conditional }]);
    scoped.set(base, members);
    objectMembers.set(owner, scoped);
  };

  /** The identifier member `key` of an initializer names, if it names one. */
  const memberTargetName = (initializer, key, chain, at) => {
    const value = unwrapExpression(initializer);
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
          const assigned = unwrapExpression(property.initializer);
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
   * same state object a plain `const publicFlag = flag` does, so it has to
   * create the same edge.
   */
  const patternTargets = (name, initializer, chain, at) => {
    const out = [];
    if (ts.isObjectBindingPattern(name)) {
      for (const element of name.elements) {
        if (!ts.isIdentifier(element.name) || element.dotDotDotToken) continue;
        const key = element.propertyName
          ? getPropertyName(element.propertyName)
          : element.name.text;
        if (!key) continue;
        const resolved = memberTargetName(initializer, key, chain, at);
        if (resolved) out.push({ name: element.name.text, ...resolved });
      }
      return out;
    }
    if (!ts.isArrayBindingPattern(name)) return out;
    const values = unwrapExpression(initializer);
    if (!ts.isArrayLiteralExpression(values)) return out;
    name.elements.forEach((element, index) => {
      if (ts.isOmittedExpression(element)) return;
      if (!ts.isIdentifier(element.name) || element.dotDotDotToken) return;
      const value = values.elements[index] && unwrapExpression(values.elements[index]);
      if (value && ts.isIdentifier(value))
        out.push({ name: element.name.text, target: value.text, at });
    });
    return out;
  };

  /**
   * The handles an expose argument may name, each with the position its own
   * edge was written at: a member captured whatever its target named then, not
   * what that name was reassigned to later.
   */
  const resolveHandleNames = (node, chain, at) => {
    const value = unwrapExpression(node);
    if (ts.isIdentifier(value)) return [{ name: value.text, at }];
    const owner = memberOwner(value);
    if (!owner) return [];
    const base = unwrapExpression(owner);
    if (!ts.isIdentifier(base)) return [];
    const out = [];
    for (const container of containerRoots(base.text, chain, at)) {
      for (const scope of chain) {
        const members = objectMembers.get(scope)?.get(container);
        if (!members) continue;
        for (const [key, edges] of members) {
          if (!memberIs(value, key)) continue;
          out.push(...visibleEdges(edges, at).map((edge) => ({ name: edge.target, at: edge.at })));
        }
        break;
      }
    }
    return out;
  };

  const visit = (node, chain) => {
    // Every scope the extractor itself creates, so two sibling blocks in one
    // setup may reuse an alias name without either edge overwriting the other.
    const nextChain = createsScope(node) ? [node, ...chain] : chain;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      // `var` binds to the enclosing function however deeply it is nested, so a
      // redeclaration inside a block is the same binding seen from outside it.
      const isVar =
        ts.isVariableDeclarationList(node.parent) &&
        !(node.parent.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const));
      const enclosingFunctionBody = isVar
        ? ts.findAncestor(node, (candidate) => ts.isFunctionLike(candidate))?.body
        : undefined;
      const owner =
        (enclosingFunctionBody && nextChain.includes(enclosingFunctionBody)
          ? enclosingFunctionBody
          : nextChain[0]) ?? root;
      if (!declaredIn.has(owner)) declaredIn.set(owner, new Set());
      declaredIn.get(owner).add(node.name.text);
      if (node.initializer) {
        const literal = unwrapExpression(node.initializer);
        const conditional = isConditionallyReached(node);
        const literals = objectLiteralTargets(node.initializer);
        for (const held of literals) {
          recordObjectLiteral(
            owner,
            node.name.text,
            held,
            node.getStart(),
            conditional || literals.length > 1
          );
        }
        void literal;
        for (const target of aliasTargets(node.initializer)) {
          aliasEdges.push({
            owner,
            name: node.name.text,
            target,
            at: node.getStart(),
            conditional,
            chain: [...nextChain, root],
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
      const owner = nextChain[0] ?? root;
      const at = node.getStart();
      const conditional = isConditionallyReached(node);
      for (const alias of patternTargets(node.name, node.initializer, nextChain, at)) {
        if (!declaredIn.has(owner)) declaredIn.set(owner, new Set());
        declaredIn.get(owner).add(alias.name);
        // The edge sits where the member was written, so following it resolves
        // the target as it stood then.
        aliasEdges.push({
          owner,
          name: alias.name,
          target: alias.target,
          at: alias.at,
          conditional,
          chain: [...nextChain, root],
          node,
        });
      }
    }
    // Writing through the container moves the handle the same way, so the
    // member the exposure reads is the one assigned last before it.
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      // A cast or a pair of parentheses names the same member, so the write
      // reaches the same container.
      (ts.isPropertyAccessExpression(unwrapTransparent(node.left)) ||
        ts.isElementAccessExpression(unwrapTransparent(node.left)))
    ) {
      const base = unwrapExpression(memberOwner(node.left) ?? node.left);
      const member = memberName(node.left);
      if (ts.isIdentifier(base)) {
        const chain = [...nextChain, root];
        const at = node.getStart();
        const containers = containerRoots(base.text, chain, at);
        // A write the source may skip, one that has not run, one that may land
        // on either of two objects, or one whose key is not statically known:
        // in each case the member may still hold what it held before.
        const conditional =
          isConditionallyReached(node) ||
          isDeferredWrite(node, enclosingFunction(declaringScopeNode(chain, containers[0]))) ||
          containers.length > 1 ||
          member === null;
        for (const container of containers) {
          const owner =
            chain.find((candidate) => declaredIn.get(candidate)?.has(container)) ??
            nextChain[0] ??
            root;
          // An unreadable key may be any member the container already has.
          const keys =
            member === null
              ? [...(objectMembers.get(owner)?.get(container)?.keys() ?? [])]
              : [member];
          for (const key of keys) {
            for (const target of aliasTargets(node.right)) {
              recordMember(owner, container, key, target, at, conditional);
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
      // the binding — otherwise a reassignment inside a nested block would be
      // invisible to an exposure written outside it.
      const owner =
        [...nextChain, root].find((candidate) => declaredIn.get(candidate)?.has(node.left.text)) ??
        nextChain[0] ??
        root;
      const conditional = isConditionallyReached(node);
      const replacements = objectLiteralTargets(node.right);
      // A conditional may mix a literal with a name; when it can yield more
      // than one value neither outcome is certain.
      // Every branch counts, not only the ones this recognizes: an
      // unrecognized branch is still a value the name may end up holding.
      const valueCount = conditionalLeafCount(node.right);
      for (const replacement of replacements) {
        recordObjectLiteral(
          owner,
          node.left.text,
          replacement,
          node.getStart(),
          // Either literal may be the one the runtime took, and the name may
          // still hold the container it replaced.
          conditional || valueCount > 1
        );
      }
      for (const target of aliasTargets(node.right)) {
        aliasEdges.push({
          owner,
          name: node.left.text,
          target,
          at: node.getStart(),
          conditional: conditional || valueCount > 1,
          chain: [...nextChain, root],
          node,
        });
      }
    }
    if (
      ts.isCallExpression(node) &&
      (namesExposeState(unwrapExpression(node.expression)) ||
        // `def.expose('ready', state)` — the generic entry wraps a state handle,
        // so the Web optimizer lowers rules on it just the same.
        namesExpose(unwrapExpression(node.expression)))
    ) {
      const [nameArg, handleArg] = node.arguments;
      const handles = handleArg
        ? resolveHandleNames(handleArg, [...nextChain, root], node.getStart())
        : [];
      if (nameArg && handles.length > 0) {
        exposures.push({ handles, key: nameArg, chain: [...nextChain, root] });
      }
    }
    ts.forEachChild(node, (child) => visit(child, nextChain));
  };
  visit(root, []);

  // The edge in effect where the exposure was written, nearest scope first.
  // Every edge written at the latest position at or before `at`, nearest scope
  // first. A conditional contributes several edges at one position.
  const lookupAliases = (name, chain, at) => {
    // A write in another function is unordered against this read, so it adds a
    // candidate rather than replacing one.
    const readFunction = enclosingFunction(chain[0] ?? null);
    const ordered = (edge) =>
      edge.conditional || !edge.node || !isDeferredWrite(edge.node, readFunction)
        ? edge
        : { ...edge, conditional: true };
    for (const owner of chain) {
      const candidates = aliasEdges
        .filter((edge) => edge.owner === owner && edge.name === name)
        .map(ordered);
      if (candidates.length === 0) continue;
      return visibleEdges(candidates, at);
    }
    return [];
  };

  // Each hop resolves where that edge was created, not where the exposure was
  // written: an alias captured its target at its own initialization, so a later
  // redeclaration of the intermediate name cannot retarget it.
  // A conditional alias records one edge per branch, so resolution fans out
  // rather than picking one: whichever handle the runtime selects has a variant.
  const rootNames = (name, chain, at, seen = new Set()) => {
    if (seen.has(name)) return [{ name, chain }];
    const edges = lookupAliases(name, chain, at);
    if (edges.length === 0) return [{ name, chain }];
    const next = new Set([...seen, name]);
    // An alias captured its target where the alias was written, so a name the
    // exposure site shadows must not answer for it.
    return edges.flatMap((edge) => rootNames(edge.target, edge.chain ?? chain, edge.at, next));
  };

  // An exposure names a binding, and a binding lives in one scope. Recording it
  // by name alone would let a sibling prototype that reuses the same local name
  // inherit an exposure its own runtime never registers.
  const declaringScope = (name, chain) =>
    chain.find((candidate) => declaredIn.get(candidate)?.has(name)) ?? chain[chain.length - 1];

  const byScope = new Map();
  for (const { handles, key, chain } of exposures) {
    // Both the alias and the handle it names carry the same state id.
    const named = handles.flatMap((handle) => [
      { name: handle.name, chain },
      ...rootNames(handle.name, chain, handle.at),
    ]);
    const seen = new Set();
    for (const entry of named) {
      const owner = declaringScope(entry.name, entry.chain);
      if (!owner) continue;
      const identity = `${entry.name}\u0000${owner.pos}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      const scoped = byScope.get(owner) ?? new Map();
      if (!scoped.has(entry.name)) scoped.set(entry.name, key);
      byScope.set(owner, scoped);
    }
  }
  return byScope;
}

/**
 * The Web attribute comes from `__stateSemantic` — the declared name — and only
 * falls back to the expose key, so a state exposed under a different key still
 * lowers to its declared name. A handle that already carries an official
 * semantic keeps it, which is the same precedence the runtime applies.
 */
function applyExposure(name, binding, scope, exposures) {
  if (!exposures || binding.semantic) return binding;
  let key;
  for (let current = scope; current && key === undefined; current = current.parent) {
    if (current.node) key = exposures.get(current.node)?.get(name);
  }
  if (!key) return binding;
  // `__stateSemantic` wins at runtime, so a declared name this cannot read
  // leaves no safe selector to emit; the expose key would be the wrong one.
  if (binding.stateName === UNKNOWN_STATE_NAME) return binding;
  const exposedKey = ts.isStringLiteralLike(key) ? key.text : resolveExpression(key, scope).single;
  const declared = binding.stateName ?? exposedKey ?? '';
  // An owned state may carry an official semantic itself, and the optimizer
  // lowers that to a native variant before it ever reaches the attribute.
  const native = officialEntry(OFFICIAL_NATIVE_VARIANTS, declared);
  if (native) return { ...binding, semantic: native };
  const attribute = exposedDataAttributeName(declared);
  if (!attribute) return binding;
  return { ...binding, semantic: `data-[${attribute}]` };
}

function resolveSemanticBinding(node) {
  if (
    !ts.isCallExpression(node) ||
    !isPropertyAccessChain(node.expression, ['state', 'fromInteraction'])
  ) {
    if (
      !ts.isCallExpression(node) ||
      !isPropertyAccessChain(node.expression, ['state', 'fromAccessibility'])
    ) {
      return null;
    }
  }

  if (!ts.isPropertyAccessExpression(node.expression)) return null;
  const kind = node.expression.name.text === 'fromInteraction' ? 'interaction' : 'accessibility';
  const firstArg = node.arguments[0];
  if (!firstArg || !ts.isStringLiteralLike(firstArg)) return null;
  const name = firstArg.text;
  return officialEntry(
    kind === 'interaction' ? INTERACTION_STATE_SEMANTICS : ACCESSIBILITY_STATE_SEMANTICS,
    name
  );
}

function resolveKnownAsHookStateHandles(node) {
  if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return null;

  const hookName = node.expression.text;
  const COMMAND_STATE_VARIANTS = [
    ['disabled', 'data-[disabled]'],
    ['hovered', 'data-[hovered]'],
    ['focused', 'data-[focused]'],
    ['focusVisible', 'data-[focus-visible]'],
    ['pressed', 'data-[pressed]'],
  ];

  if (
    hookName === 'asFormSubmit' ||
    hookName === 'asFormReset' ||
    hookName === 'asDialogTrigger' ||
    hookName === 'asDialogClose' ||
    hookName === 'asDropdownTrigger' ||
    hookName === 'asHoverCardTrigger' ||
    hookName === 'asTooltipTrigger'
  ) {
    return new Map(COMMAND_STATE_VARIANTS);
  }

  if (hookName === 'asCollapsibleTrigger' || hookName === 'asAccordionTrigger') {
    return new Map([
      ...COMMAND_STATE_VARIANTS,
      ['expanded', 'data-[expanded]'],
      ...(hookName === 'asAccordionTrigger'
        ? [['collapseBlocked', 'data-[collapse-blocked]']]
        : []),
    ]);
  }

  if (hookName === 'asFieldLabel') {
    return new Map([
      ['disabled', 'data-[disabled]'],
      ['required', 'data-[required]'],
    ]);
  }

  if (hookName === 'asFieldTextControl') {
    return new Map([
      ['value', 'data-[value]'],
      ['disabled', 'data-[disabled]'],
      ['readOnly', 'data-[read-only]'],
      ['focused', 'data-[focused]'],
      ['focusVisible', 'data-[focus-visible]'],
      ['composing', 'data-[composing]'],
    ]);
  }

  if (hookName === 'asSelectTrigger') {
    // Select Trigger is the one command surface that also reports whether it is
    // still showing its placeholder.
    return new Map([...COMMAND_STATE_VARIANTS, ['placeholder', 'data-[placeholder]']]);
  }

  if (hookName === 'asDropdownItem') {
    return new Map([...COMMAND_STATE_VARIANTS, ['active', 'data-[active]']]);
  }

  if (hookName === 'asSelectItem') {
    return new Map([
      ...COMMAND_STATE_VARIANTS,
      ['active', 'data-[active]'],
      ['selected', 'data-[selected]'],
    ]);
  }

  if (hookName === 'asButton') {
    return new Map([
      ['disabled', 'data-[disabled]'],
      ['hovered', 'data-[hovered]'],
      ['focused', 'data-[focused]'],
      ['pressed', 'data-[pressed]'],
      ['focusVisible', 'data-[focus-visible]'],
    ]);
  }

  if (hookName === 'asCheckboxRoot') {
    return new Map([
      ['checked', 'data-[checked]'],
      ['indeterminate', 'data-[indeterminate]'],
      ['disabled', 'data-[disabled]'],
      ['hovered', 'data-[hovered]'],
      ['focused', 'data-[focused]'],
      ['focusVisible', 'data-[focus-visible]'],
      ['pressed', 'data-[pressed]'],
    ]);
  }

  if (hookName === 'asCheckboxIndicator') {
    return new Map([
      ['checked', 'data-[checked]'],
      ['indeterminate', 'data-[indeterminate]'],
    ]);
  }

  if (hookName === 'asRadioGroupItem') {
    return new Map([...COMMAND_STATE_VARIANTS, ['checked', 'data-[checked]']]);
  }

  if (hookName === 'asRadioGroupIndicator') {
    return new Map([
      ['checked', 'data-[checked]'],
      ['disabled', 'data-[disabled]'],
    ]);
  }

  if (hookName === 'asScrollAreaViewport') {
    return new Map([
      ['focused', 'data-[focused]'],
      ['focusVisible', 'data-[focus-visible]'],
    ]);
  }

  if (hookName === 'asSwitchRoot') {
    return new Map([
      ['checked', 'data-[checked]'],
      ['disabled', 'data-[disabled]'],
      ['hovered', 'data-[hovered]'],
      ['focused', 'data-[focused]'],
      ['focusVisible', 'data-[focus-visible]'],
      ['pressed', 'data-[pressed]'],
    ]);
  }

  if (hookName === 'asSwitchThumb') {
    return new Map([
      ['checked', 'data-[checked]'],
      ['disabled', 'data-[disabled]'],
    ]);
  }

  if (hookName === 'asToggle') {
    return new Map([
      ['active', 'data-[active]'],
      ['disabled', 'data-[disabled]'],
      ['hovered', 'data-[hovered]'],
      ['focused', 'data-[focused]'],
      ['focusVisible', 'data-[focus-visible]'],
      ['pressed', 'data-[pressed]'],
    ]);
  }

  if (hookName === 'asTabsTrigger') {
    return new Map([
      ['disabled', 'data-[disabled]'],
      ['hovered', 'data-[hovered]'],
      ['focused', 'data-[focused]'],
      ['focusVisible', 'data-[focus-visible]'],
      ['pressed', 'data-[pressed]'],
      ['selected', 'data-[selected]'],
    ]);
  }

  if (hookName === 'asTabsContent') {
    return new Map([
      ['current', 'data-[current]'],
      ['hidden', 'data-[hidden]'],
    ]);
  }

  if (
    hookName === 'asDialogMask' ||
    hookName === 'asDialogContent' ||
    hookName === 'asHoverCardContent'
  ) {
    return new Map([['open', 'data-[open]']]);
  }

  if (hookName === 'asDialogTrigger' || hookName === 'asDialogClose') {
    return new Map([
      ['disabled', 'data-[disabled]'],
      ['hovered', 'data-[hovered]'],
      ['focused', 'data-[focused]'],
      ['focusVisible', 'data-[focus-visible]'],
      ['pressed', 'data-[pressed]'],
    ]);
  }

  if (hookName === 'asTextareaRoot') {
    return new Map([
      ['value', 'data-[value]'],
      ['disabled', 'data-[disabled]'],
      ['readOnly', 'data-[read-only]'],
      ['focused', 'data-[focused]'],
      ['focusVisible', 'data-[focus-visible]'],
      ['composing', 'data-[composing]'],
    ]);
  }

  if (hookName === 'asInputRoot') {
    return new Map([
      ['value', 'data-[value]'],
      ['disabled', 'data-[disabled]'],
      ['readOnly', 'data-[read-only]'],
      ['focused', 'data-[focused]'],
      ['focusVisible', 'data-[focus-visible]'],
      ['composing', 'data-[composing]'],
    ]);
  }

  if (hookName === 'asAsyncRegionRoot') {
    return new Map([['busy', 'data-[busy]']]);
  }

  if (hookName === 'asScrollAreaViewport') {
    return new Map([
      ['focused', 'data-[focused]'],
      ['focusVisible', 'data-[focus-visible]'],
    ]);
  }

  if (hookName === 'asSeparatorRoot' || hookName === 'asScrollAreaScrollbar') {
    return new Map([['orientation', 'data-[orientation]']]);
  }

  return null;
}

function resolveTrustedKnownAsHookStateHandles(node, scope) {
  const table = resolveKnownAsHookStateHandles(node);
  if (!table || !ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return table;
  // An authored producer owns its public handle even when its projection is
  // unsupported. Missing source proof cannot be replaced by a spelling table.
  if (scope.sourceSummary?.isAuthoredProducerCall(node, node.getSourceFile())) return null;
  const binding = lookup(node.expression.text, scope);
  // A default import names the module's default export, not a built-in hook.
  // Only a proven authored producer may stand behind such a name, and the
  // source summary resolves that one; the spelling proves nothing.
  if (binding?.defaultImport) return null;
  // A known spelling is only a fallback for an unavailable imported binding.
  // A local value with that spelling may be a lookalike or an unknown branch;
  // source summaries and lexical scope must remain authoritative for it.
  if (binding?.kind && !binding.importedBinding && binding.kind !== 'tokenImport') return null;
  return table;
}

/**
 * Asks the same resolver the extractor uses, so a coverage gate cannot drift by
 * keeping its own copy of the hook list. Returns null when the hook has no
 * entry, which is exactly the case where a rule keyed on its state handles
 * silently produces no variant token.
 */
export function loweredHookStates(hookName) {
  const probe = ts.factory.createCallExpression(
    ts.factory.createIdentifier(hookName),
    undefined,
    []
  );
  const resolved = resolveKnownAsHookStateHandles(probe);
  return resolved ? new Map(resolved) : null;
}

function collectRuleVariantTokens(node, scope, tokens, exposures) {
  const config = node.arguments[0];
  if (!config || !ts.isObjectLiteralExpression(config)) return;

  const whenProp = config.properties.find(
    (prop) => ts.isPropertyAssignment(prop) && getPropertyName(prop.name) === 'when'
  );
  const intentProp = config.properties.find(
    (prop) => ts.isPropertyAssignment(prop) && getPropertyName(prop.name) === 'intent'
  );
  if (
    !whenProp ||
    !intentProp ||
    !ts.isPropertyAssignment(whenProp) ||
    !ts.isPropertyAssignment(intentProp)
  ) {
    return;
  }

  const chains = analyzeWhenVariants(whenProp.initializer, scope);
  if (chains.length === 0) return;

  const intentTokens = collectTwTokens(intentProp.initializer, scope, exposures);
  for (const chain of chains) {
    const prefix = chain.join(':');
    for (const token of intentTokens) tokens.add(`${prefix}:${token}`);
  }
}

/**
 * Every selector chain the rule may lower to. A condition whose handle is not
 * statically single-valued contributes one alternative per candidate, and the
 * runtime takes exactly one of them, so each combination needs its own tokens.
 */
function analyzeWhenVariants(node, scope) {
  const groups = [];

  visit(node);
  let chains = [[]];
  for (const group of groups) {
    chains = chains.flatMap((chain) => group.map((variant) => [...chain, variant]));
  }
  return chains
    .map((chain) => canonicalizeLoweredVariants(chain))
    .filter((chain) => chain.length > 0 && !chain.every(isNegativeDataVariant));

  function visit(current) {
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      visit(current.body);
      return;
    }

    if (
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current)
    ) {
      visit(current.expression);
      return;
    }

    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
      const method = current.expression.name.text;

      if (method === 'all' || method === 'any') {
        for (const arg of current.arguments) visit(arg);
        return;
      }

      if (method === 'eq') {
        const subject = current.expression.expression;
        if (ts.isCallExpression(subject) && ts.isPropertyAccessExpression(subject.expression)) {
          const subjectMethod = subject.expression.name.text;
          if (subjectMethod === 'state') {
            const firstArg = subject.arguments[0];
            const expected = current.arguments[0];
            if (firstArg) {
              const variants = resolveStateHandleSemantics(firstArg, scope)
                .map((semantic) => resolveStateEqVariant(semantic, expected, scope))
                .filter(Boolean);
              if (variants.length > 0) groups.push([...new Set(variants)]);
            }
            return;
          }

          if (subjectMethod === 'meta') {
            const key = subject.arguments[0];
            const value = current.arguments[0];
            if (
              key &&
              value &&
              ts.isStringLiteralLike(key) &&
              ts.isStringLiteralLike(value) &&
              key.text === 'colorScheme' &&
              value.text === 'dark'
            ) {
              groups.push(['dark']);
            }
          }
        }
      }
    }

    ts.forEachChild(current, visit);
  }
}

/**
 * `buildSemanticVariant` takes a native variant only for a true comparison, so
 * every other comparison falls back to the attribute the same binding carries.
 */
const NATIVE_VARIANT_ATTRIBUTES = Object.freeze({
  hover: 'data-[hovered]',
  active: 'data-[pressed]',
});

/** Every semantic a `w.state(x)` argument may stand for. */
function resolveStateHandleSemantics(node, scope) {
  const inner = unwrapTransparent(node);
  if (ts.isIdentifier(inner)) {
    return bindingSemantics(lookup(inner.text, scope));
  }
  if (ts.isCallExpression(inner)) {
    const resolved = resolveExpression(inner, scope);
    const semantics = bindingSemantics(resolved);
    if (semantics.length > 0) return semantics;
  }
  // Direct member reads enumerate known candidates for CSS; unlike scalar
  // captures, this projection does not certify an incomplete source-free
  // binding. A matched source path with unknown members, however, is the
  // authority for that read and must not be replaced by a partial selector.
  const selected = selectMemberBinding(inner, scope);
  const source = selected ? sourceSummaryValue(inner, scope) : null;
  if (source && source.semanticMap === null) return bindingSemantics(selected);
  return selected
    ? knownBindingSemantics(selected)
    : bindingSemantics(resolveExpression(inner, scope));
}

function resolveStateEqVariant(semantic, expected, scope) {
  if (!semantic) return null;
  if (!expected) return null;
  if (expected.kind === ts.SyntaxKind.TrueKeyword) return semantic;
  const attribute = officialEntry(NATIVE_VARIANT_ATTRIBUTES, semantic) ?? semantic;
  if (expected.kind === ts.SyntaxKind.FalseKeyword) return negateDataVariant(attribute);
  const expectedText = ts.isStringLiteralLike(expected)
    ? expected.text
    : ts.isIdentifier(expected)
      ? resolveExpression(expected, scope).single
      : null;
  if (expectedText !== null) {
    const match = attribute.match(/^data-\[([a-zA-Z0-9-]+)\]$/);
    if (!match || !/^[a-zA-Z0-9_-]+$/.test(expectedText)) return null;
    return `data-[${match[1]}=${expectedText}]`;
  }
  // `number.discrete` bindings lower by stringifying the literal, the same way
  // enum and string bindings do.
  const numeric = signedNumericText(expected);
  if (numeric !== null) {
    const match = attribute.match(/^data-\[([a-zA-Z0-9-]+)\]$/);
    if (!match) return null;
    return `data-[${match[1]}=${numeric}]`;
  }
  return null;
}

/** `-1` parses as a prefix unary expression rather than a numeric literal. */
function signedNumericText(node) {
  // The runtime lowers with `String(literal)`, so the canonical value is what
  // the selector must carry — `-0` projects as `0`, not `-0`.
  const canonical = (value) => (Number.isFinite(value) ? String(value) : null);
  if (ts.isNumericLiteral(node)) return canonical(Number(node.text));
  if (
    ts.isPrefixUnaryExpression(node) &&
    (node.operator === ts.SyntaxKind.MinusToken || node.operator === ts.SyntaxKind.PlusToken) &&
    ts.isNumericLiteral(node.operand)
  ) {
    const magnitude = Number(node.operand.text);
    return canonical(node.operator === ts.SyntaxKind.MinusToken ? -magnitude : magnitude);
  }
  return null;
}

function negateDataVariant(variant) {
  const match = variant.match(/^data-\[([a-zA-Z0-9-]+)\]$/);
  return match ? `not-[data-${match[1]}]` : null;
}

function isNegativeDataVariant(variant) {
  return /^not-\[data-[a-zA-Z0-9-]+\]$/.test(variant);
}

function assignIdentifierBinding(node, scope, exposures) {
  const name = node.left.text;
  const owner = scopeDeclaring(name, scope) ?? scope;
  const previous = owner.bindings.get(name);
  const binding = applyExposure(name, resolveBinding(node.right, scope), owner, exposures);
  const kept = bindingSemantics(previous).filter((candidate) => candidate !== binding.semantic);
  const uncertain =
    isConditionallyReached(node, scope.definitelyReachedLogicalAssignments) ||
    isDeferredWrite(node, enclosingFunction(owner.node));
  let next = binding;
  if (uncertain && !bindingHasStatePath(previous)) {
    next = { ...next, unknownAlternative: true };
  }
  if (uncertain && kept.length > 0) {
    next = { ...next, alternatives: [...new Set([...(next.alternatives ?? []), ...kept])] };
  }
  if (uncertain && previous) {
    const strings = [...new Set([...next.strings, ...previous.strings])];
    next = { ...next, strings, single: strings.length === 1 ? strings[0] : null };
  }
  if (uncertain && previous && (previous.semanticMap || previous.containers)) {
    const held = [...(next.containers ?? [next]), ...(previous.containers ?? [previous])];
    next = { ...next, containers: [...new Set(held)] };
    if (next.semanticMap || previous.semanticMap) {
      const semanticMap = new Map(next.semanticMap ?? []);
      for (const [key, value] of previous.semanticMap ?? []) {
        const existing = semanticMap.get(key);
        const values = [
          ...(existing ? (Array.isArray(existing) ? existing : [existing]) : []),
          ...(Array.isArray(value) ? value : [value]),
        ];
        const unique = [...new Set(values.filter(Boolean))];
        if (unique.length === 1) semanticMap.set(key, unique[0]);
        else if (unique.length > 1) semanticMap.set(key, unique);
      }
      next = { ...next, semanticMap };
    }
  }
  const nextSourceValues = sourceValueCandidates(next);
  const previousSourceValues = sourceValueCandidates(previous);
  if (uncertain && nextSourceValues.length > 0 && previousSourceValues.length > 0) {
    const sourceValues = [...new Set([...nextSourceValues, ...previousSourceValues])];
    next = { ...next, sourceValue: sourceValues[0], sourceValues };
  } else if (nextSourceValues.length > 1) {
    next = { ...next, sourceValue: nextSourceValues[0], sourceValues: nextSourceValues };
  }
  if (next.bindingNode) next = { ...next, bindingNode: node };
  if (uncertain && next.semanticMap && next.containers) {
    joinLocalMemberProofs(next, next.containers, scope);
  }
  owner.bindings.set(name, next);
}

function collectTwTokens(node, scope, exposures) {
  const found = new Set();

  visit(node, scope);
  return Array.from(found);

  function visit(current, currentScope) {
    if (createsScope(current)) {
      const nextScope = createScope(currentScope, current);
      if (ts.isFunctionLike(current)) {
        for (const parameter of current.parameters) shadowBindingPattern(nextScope, parameter.name);
      }
      if (ts.isCatchClause(current) && current.variableDeclaration) {
        shadowBindingPattern(nextScope, current.variableDeclaration.name);
      }
      if (hasStatements(current)) {
        for (const stmt of current.statements) {
          if (ts.isVariableStatement(stmt)) {
            const owner = isVarList(stmt.declarationList) ? functionScope(nextScope) : nextScope;
            for (const decl of stmt.declarationList.declarations) {
              registerDeclaration(decl, owner, exposures);
              if (decl.initializer) visit(decl.initializer, nextScope);
            }
            continue;
          }
          visit(stmt, nextScope);
        }
        return;
      }
      ts.forEachChild(current, (child) => visit(child, nextScope));
      return;
    }

    if (
      ts.isBinaryExpression(current) &&
      current.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(current.left)
    ) {
      visit(current.right, currentScope);
      assignIdentifierBinding(current, currentScope, exposures);
      return;
    }

    if (ts.isCallExpression(current) && isFeedbackStyleUseCall(current)) {
      for (const arg of current.arguments) {
        const value = resolveExpression(arg, currentScope);
        for (const token of value.strings.flatMap(splitTokens)) found.add(token);
      }
    }

    ts.forEachChild(current, (child) => visit(child, currentScope));
  }
}

function isPropertyNamed(node, name) {
  return ts.isPropertyAccessExpression(node) && node.name.text === name;
}

function isPropertyAccessChain(node, names) {
  let current = node;
  for (let i = names.length - 1; i >= 0; i -= 1) {
    if (!ts.isPropertyAccessExpression(current) || current.name.text !== names[i]) return false;
    current = current.expression;
  }
  return ts.isIdentifier(current);
}

function getPropertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
  return null;
}

function splitTokens(value) {
  return value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function emptyValue() {
  return { strings: [], single: null, map: null, semanticMap: null, semantic: null };
}

function asStringValue(strings) {
  return {
    strings,
    single: strings.length === 1 ? strings[0] : null,
    map: null,
    semanticMap: null,
    semantic: null,
  };
}

function asMapValue(map) {
  const strings = [];
  for (const values of map.values()) strings.push(...values);
  return {
    strings,
    single: null,
    map,
    semanticMap: null,
    semantic: null,
  };
}

function asSemanticValue(semantic) {
  return {
    strings: [],
    single: null,
    map: null,
    semanticMap: null,
    semantic,
  };
}

function asSemanticMapValue(semanticMap) {
  return {
    strings: [],
    single: null,
    map: null,
    semanticMap,
    semantic: null,
  };
}
function scriptKindForFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.tsx') return ts.ScriptKind.TSX;
  if (ext === '.jsx') return ts.ScriptKind.JSX;
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

/**
 * Every file the token extractor reads under a root. Exported so a coverage
 * scan can walk the same set instead of keeping its own narrower glob.
 */
export async function collectSourceFiles(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'dist' || entry.name === 'test' || entry.name === 'node_modules') continue;
      out.push(...(await collectSourceFiles(fullPath)));
      continue;
    }
    if (
      entry.isFile() &&
      /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(entry.name) &&
      !/\.d\.ts$/i.test(entry.name)
    ) {
      out.push(fullPath);
    }
  }
  return out;
}
