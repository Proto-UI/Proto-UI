// @ts-nocheck
// Recursive ts.Node AST walking extracted from the legacy CLI so source-token
// collection is shared by both user commands and generated preset manifests.
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

import { canonicalizeLoweredVariants } from '../generated/lowered-variant-order.js';

export async function collectProtoStyleTokens(root) {
  const files = await collectSourceFiles(root);
  const tokens = new Set();
  const moduleCache = new Map();

  for (const file of files) {
    const sourceFile = await parseSourceFile(file);
    const scope = createScope();
    await applyImportBindings(file, sourceFile, scope, moduleCache, []);
    walk(sourceFile, scope, tokens, collectExposures(sourceFile));
  }

  return Array.from(tokens).sort();
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
    if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) continue;
    const bindings = await loadModuleBindings(resolved, moduleCache, stack);
    for (const element of clause.namedBindings.elements) {
      const importedName = (element.propertyName ?? element.name).text;
      const value = bindings.get(importedName);
      if (value) scope.bindings.set(element.name.text, value);
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
function createScope(parent = null, node = null) {
  return { parent, bindings: new Map(), node };
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
  if (!binding) return [];
  return [binding.semantic, ...(binding.alternatives ?? [])].filter(Boolean);
}

/** A member entry holds one semantic, or several once a write may be skipped. */
function memberSemantics(entry) {
  if (!entry) return [];
  return Array.isArray(entry) ? entry.filter(Boolean) : [entry];
}

/** The member entry a `x.name` or `x['name']` read names, if the owner has one. */
function readMemberSemantics(node, scope) {
  const owner = memberOwner(node);
  const name = memberName(node);
  if (!owner || name === null) return [];
  const resolved = resolveExpression(owner, scope);
  // A name that may be either of two objects answers for both, and a container
  // that replaced another conditionally still answers for what it replaced.
  const values = resolved.containers ?? [resolved];
  return [...new Set(values.flatMap((value) => memberSemantics(value.semanticMap?.get(name))))];
}

/**
 * The outermost scope holding this exact container value. An alias and the
 * container are one object, so the object's lifetime — not the alias's
 * declaration — decides whether a write through it has run.
 */
function scopeOwningValue(value, scope) {
  let owning = null;
  for (let current = scope; current; current = current.parent) {
    for (const held of current.bindings.values()) {
      if (held === value) {
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

function walk(node, scope, tokens, exposures) {
  if (createsScope(node)) {
    const nextScope = createScope(scope, node);

    // Registered before the body is walked, the same order the loop runs in.
    for (const decl of loopInitializerDeclarations(node)) {
      registerDeclaration(decl, nextScope, exposures);
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
            if (decl.initializer) walk(decl.initializer, nextScope, tokens, exposures);
          }
          continue;
        }
        walk(stmt, nextScope, tokens, exposures);
      }
      return;
    }

    ts.forEachChild(node, (child) => walk(child, nextScope, tokens, exposures));
    return;
  }

  if (ts.isVariableStatement(node)) {
    // A declaration under single-statement control flow — `if (x) var f = …` —
    // is reached here rather than through a statement list, and the runtime
    // executes it just the same.
    const owner = isVarList(node.declarationList) ? functionScope(scope) : scope;
    for (const decl of node.declarationList.declarations) {
      registerDeclaration(decl, owner, exposures);
      if (decl.initializer) walk(decl.initializer, scope, tokens, exposures);
    }
    return;
  }

  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left))
  ) {
    // Writing through the container moves the member for every read that
    // follows, so the rule side has to see it the way the exposure does.
    walk(node.right, scope, tokens, exposures);
    const base = unwrapTransparent(memberOwner(node.left) ?? node.left);
    const member = memberName(node.left);
    if (ts.isIdentifier(base)) {
      // `const alias = controls` names the same object, and both bindings hold
      // the one resolved value, so the member moves on that value rather than
      // on a copy rebound to whichever name the write happened to use.
      const resolved = resolveExpression(base, scope);
      // A base that may be either of two objects writes to both tables.
      const targets = resolved?.containers ?? (resolved ? [resolved] : []);
      const written = bindingSemantics(resolveBinding(node.right, scope));
      for (const container of targets) {
        if (written.length === 0) break;
        // The scope that owns the container object, not the one that declares
        // the name written through: an alias declared inside a callback would
        // otherwise make the write look ordered against itself.
        const declaring = scopeOwningValue(container, scope) ?? scopeDeclaring(base.text, scope);
        const uncertain =
          isConditionallyReached(node) ||
          isDeferredWrite(node, enclosingFunction(declaring?.node ?? null)) ||
          targets.length > 1 ||
          // A key this cannot read may name any member the container has.
          member === null;
        if (!container.semanticMap) container.semanticMap = new Map();
        const keys = member === null ? [...container.semanticMap.keys()] : [member];
        for (const key of keys) {
          const previous = memberSemantics(container.semanticMap.get(key));
          const kept = uncertain
            ? previous.filter((candidate) => !written.includes(candidate))
            : [];
          container.semanticMap.set(key, [...written, ...kept]);
        }
      }
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
    walk(node.right, scope, tokens, exposures);
    const name = node.left.text;
    const owner = scopeDeclaring(name, scope) ?? scope;
    const previous = owner.bindings.get(name);
    const binding = applyExposure(name, resolveBinding(node.right, scope), owner, exposures);
    // A write the source may skip, or one that has not run yet, leaves the name
    // on either handle, and the runtime lowers whichever it holds.
    const kept = bindingSemantics(previous).filter((candidate) => candidate !== binding.semantic);
    const uncertain =
      isConditionallyReached(node) || isDeferredWrite(node, enclosingFunction(owner.node));
    let next = binding;
    if (uncertain && kept.length > 0) {
      next = { ...next, alternatives: [...new Set([...(next.alternatives ?? []), ...kept])] };
    }
    // Replacing a container keeps its members too: on the branch the source may
    // not take, the name still holds the object it held before.
    if (uncertain && previous && (previous.semanticMap || previous.containers)) {
      const held = [...(next.containers ?? [next]), ...(previous.containers ?? [previous])];
      next = { ...next, containers: [...new Set(held)] };
    }
    owner.bindings.set(name, next);
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
      }
    }
  }

  if (ts.isCallExpression(node) && isPropertyNamed(node.expression, 'rule')) {
    collectRuleVariantTokens(node, scope, tokens, exposures);
  }

  ts.forEachChild(node, (child) => walk(child, scope, tokens, exposures));
}

function createsScope(node) {
  return (
    ts.isSourceFile(node) ||
    ts.isBlock(node) ||
    ts.isModuleBlock(node) ||
    ts.isCaseBlock(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
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
  if (!decl.initializer) return;

  if (ts.isIdentifier(decl.name)) {
    const binding = resolveBinding(decl.initializer, scope);
    scope.bindings.set(decl.name.text, applyExposure(decl.name.text, binding, scope, exposures));
    return;
  }

  if (ts.isArrayBindingPattern(decl.name)) {
    const value = resolveBinding(decl.initializer, scope);
    if (!value.semanticMap) return;

    decl.name.elements.forEach((element, index) => {
      if (ts.isOmittedExpression(element) || !ts.isIdentifier(element.name)) return;
      const semantic = value.semanticMap.get(String(index));
      if (semantic) scope.bindings.set(element.name.text, asSemanticValue(semantic));
    });
    return;
  }

  if (ts.isObjectBindingPattern(decl.name)) {
    const value = resolveBinding(decl.initializer, scope);
    if (!value.semanticMap) return;

    for (const element of decl.name.elements) {
      if (!ts.isIdentifier(element.name)) continue;
      const propertyName = element.propertyName
        ? getPropertyName(element.propertyName)
        : element.name.text;
      if (!propertyName) continue;

      const semantic = value.semanticMap.get(propertyName);
      if (!semantic) continue;
      scope.bindings.set(element.name.text, asSemanticValue(semantic));
    }
  }
}

function resolveExpression(node, scope) {
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
    const parts = [];
    let readsAsTokens = true;
    node.elements.forEach((element, index) => {
      if (ts.isOmittedExpression(element)) {
        readsAsTokens = false;
        return;
      }
      const held = resolveBinding(element, scope);
      if (held.semantic) semantics.set(String(index), held.semantic);
      if (held.single) parts.push(held.single);
      else readsAsTokens = false;
    });
    // Keep the element list: a comma-joined string cannot tell an element
    // boundary from a comma inside an arbitrary token such as
    // `transition-[color,box-shadow]`.
    const value = readsAsTokens
      ? { ...asStringValue([parts.join(',')]), elements: parts }
      : emptyValue();
    return semantics.size > 0 ? { ...value, semanticMap: semantics } : value;
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
    const stateHandles = resolveKnownAsHookStateHandles(node);
    if (stateHandles) return asSemanticMapValue(stateHandles);
  }

  // `const controls = { ready: flag }` — a plain container of handles reads the
  // same way an `asHook` bag does, so `w.state(controls.ready)` has a variant.
  if (ts.isPropertyAccessExpression(node) && node.name.text === 'stateHandles') {
    const stateHandles = resolveKnownAsHookStateHandles(node.expression);
    if (stateHandles) return asSemanticMapValue(stateHandles);
    if (ts.isIdentifier(node.expression)) {
      const hookHandle = lookup(node.expression.text, scope);
      if (hookHandle.semanticMap) return hookHandle;
    }
  }

  // `asHook().stateHandles.checked` bound straight to a name. Without this the
  // leaf resolves to nothing and `w.state(checked)` emits no variant, while the
  // same read through a destructure or through the bag resolves fine.
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    const semantics = readMemberSemantics(node, scope);
    if (semantics.length > 0) {
      return { ...asSemanticValue(semantics[0]), alternatives: semantics.slice(1) };
    }
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
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const key = getPropertyName(prop.name);
        if (!key) continue;
        const held = resolveBinding(prop.initializer, scope);
        if (held.strings.length > 0) entries.set(key, held.strings);
        if (held.semantic) semantics.set(key, held.semantic);
      } else if (ts.isShorthandPropertyAssignment(prop)) {
        const held = lookup(prop.name.text, scope);
        if (held.strings.length > 0) entries.set(prop.name.text, held.strings);
        if (held.semantic) semantics.set(prop.name.text, held.semantic);
      }
    }
    const value = asMapValue(entries);
    return semantics.size > 0 ? { ...value, semanticMap: semantics } : value;
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
    const values = new Set([
      ...resolveExpression(node.whenTrue, scope).strings,
      ...resolveExpression(node.whenFalse, scope).strings,
    ]);
    return asStringValue(Array.from(values));
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
  const inner = unwrapTransparent(node);
  // The runtime keeps one branch, and whichever it keeps carries its own
  // declared name, so both candidates need a selector and neither may fall
  // back to the expose key.
  if (ts.isConditionalExpression(inner)) {
    const branches = [
      resolveBinding(inner.whenTrue, scope),
      resolveBinding(inner.whenFalse, scope),
    ];
    const semantics = [...new Set(branches.flatMap(bindingSemantics))];
    if (semantics.length > 0) {
      return { ...branches[0], semantic: semantics[0], alternatives: semantics.slice(1) };
    }
    // Neither branch is a handle, but the name may still be either object, so
    // it carries both and a member write through it reaches both tables.
    // Flattened, because a branch may itself be a conditional: the candidates
    // are the leaves the runtime can land on, not the composites above them.
    const containers = branches.flatMap(
      (branch) => branch.containers ?? (branch.semanticMap ? [branch] : [])
    );
    if (containers.length > 0) return { ...branches[0], containers };
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
    return argument && ts.isStringLiteralLike(argument) ? argument.text : null;
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
function isConditionallyReached(node) {
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
      (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left))
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

  if (kind === 'interaction') {
    return (
      {
        hovered: 'hover',
        pressed: 'active',
        disabled: 'data-[disabled]',
        focused: 'data-[focused]',
        focusVisible: 'data-[focus-visible]',
      }[name] ?? null
    );
  }

  return (
    {
      expanded: 'data-[expanded]',
      invalid: 'data-[invalid]',
      selected: 'data-[selected]',
      checked: 'data-[checked]',
      current: 'data-[current]',
    }[name] ?? null
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
    hookName === 'asDialogTrigger' ||
    hookName === 'asDialogClose' ||
    hookName === 'asDropdownTrigger' ||
    hookName === 'asHoverCardTrigger'
  ) {
    return new Map(COMMAND_STATE_VARIANTS);
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

  if (hookName === 'asAsyncRegionRoot') {
    return new Map([['busy', 'data-[busy]']]);
  }

  if (hookName === 'asSeparatorRoot') {
    return new Map([['orientation', 'data-[orientation]']]);
  }

  return null;
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
                .map((semantic) => resolveStateEqVariant(semantic, expected))
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

function resolveStateHandleSemantic(node, scope) {
  // `w.state(checked!)` and its `as`/parenthesized equivalents name the same
  // handle as the bare identifier.
  if (
    ts.isNonNullExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node)
  ) {
    return resolveStateHandleSemantic(node.expression, scope);
  }
  if (ts.isIdentifier(node)) return lookup(node.text, scope).semantic ?? null;
  return readMemberSemantics(node, scope)[0] ?? null;
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
    const semantics = bindingSemantics(lookup(inner.text, scope));
    if (semantics.length > 0) return semantics;
  }
  const members = readMemberSemantics(inner, scope);
  if (members.length > 0) return members;
  const single = resolveStateHandleSemantic(node, scope);
  return single ? [single] : [];
}

function resolveStateEqVariant(semantic, expected) {
  if (!semantic) return null;
  if (!expected) return null;
  if (expected.kind === ts.SyntaxKind.TrueKeyword) return semantic;
  const attribute = officialEntry(NATIVE_VARIANT_ATTRIBUTES, semantic) ?? semantic;
  if (expected.kind === ts.SyntaxKind.FalseKeyword) return negateDataVariant(attribute);
  if (ts.isStringLiteralLike(expected)) {
    const match = attribute.match(/^data-\[([a-zA-Z0-9-]+)\]$/);
    if (!match || !/^[a-zA-Z0-9_-]+$/.test(expected.text)) return null;
    return `data-[${match[1]}=${expected.text}]`;
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

function collectTwTokens(node, scope, exposures) {
  const found = new Set();

  visit(node, scope);
  return Array.from(found);

  function visit(current, currentScope) {
    if (createsScope(current)) {
      const nextScope = createScope(currentScope, current);
      if (hasStatements(current)) {
        for (const stmt of current.statements) {
          if (ts.isVariableStatement(stmt)) {
            for (const decl of stmt.declarationList.declarations) {
              registerDeclaration(decl, nextScope, exposures);
              if (decl.initializer) visit(decl.initializer, nextScope);
            }
            continue;
          }
          visit(stmt, nextScope);
        }
        return;
      }
    }

    if (
      ts.isCallExpression(current) &&
      ts.isIdentifier(current.expression) &&
      current.expression.text === 'tw'
    ) {
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
