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
    walk(sourceFile, scope, tokens);
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
      registerDeclaration(decl, scope);
    }
  }
  for (const [name, value] of scope.bindings) bindings.set(name, value);
  return bindings;
}
function createScope(parent = null) {
  return { parent, bindings: new Map() };
}

function walk(node, scope, tokens) {
  if (createsScope(node)) {
    const nextScope = createScope(scope);

    if (hasStatements(node)) {
      for (const stmt of node.statements) {
        if (ts.isVariableStatement(stmt)) {
          for (const decl of stmt.declarationList.declarations) {
            registerDeclaration(decl, nextScope);
            if (decl.initializer) walk(decl.initializer, nextScope, tokens);
          }
          continue;
        }
        walk(stmt, nextScope, tokens);
      }
      return;
    }

    ts.forEachChild(node, (child) => walk(child, nextScope, tokens));
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
    collectRuleVariantTokens(node, scope, tokens);
  }

  ts.forEachChild(node, (child) => walk(child, scope, tokens));
}

function createsScope(node) {
  return (
    ts.isSourceFile(node) ||
    ts.isBlock(node) ||
    ts.isModuleBlock(node) ||
    ts.isCaseBlock(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node)
  );
}

function hasStatements(node) {
  return ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node);
}

function registerDeclaration(decl, scope) {
  if (!decl.initializer) return;

  if (ts.isIdentifier(decl.name)) {
    scope.bindings.set(decl.name.text, resolveBinding(decl.initializer, scope));
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

  if (ts.isArrayLiteralExpression(node)) {
    const parts = [];
    for (const element of node.elements) {
      const value = resolveExpression(element, scope);
      if (!value.single) return emptyValue();
      parts.push(value.single);
    }
    // Keep the element list: a comma-joined string cannot tell an element
    // boundary from a comma inside an arbitrary token such as
    // `transition-[color,box-shadow]`.
    return { ...asStringValue([parts.join(',')]), elements: parts };
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

  if (ts.isPropertyAccessExpression(node) && node.name.text === 'stateHandles') {
    const stateHandles = resolveKnownAsHookStateHandles(node.expression);
    if (stateHandles) return asSemanticMapValue(stateHandles);
    if (ts.isIdentifier(node.expression)) {
      const hookHandle = lookup(node.expression.text, scope);
      if (hookHandle.semanticMap) return hookHandle;
    }
  }

  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node)
  ) {
    return resolveExpression(node.expression, scope);
  }

  if (ts.isObjectLiteralExpression(node)) {
    const entries = new Map();
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const key = getPropertyName(prop.name);
        if (!key) continue;
        const value = resolveExpression(prop.initializer, scope);
        if (value.strings.length > 0) entries.set(key, value.strings);
      } else if (ts.isShorthandPropertyAssignment(prop)) {
        const value = lookup(prop.name.text, scope);
        if (value.strings.length > 0) entries.set(prop.name.text, value.strings);
      }
    }
    return asMapValue(entries);
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
  const semantic = resolveSemanticBinding(node);
  const value = resolveExpression(node, scope);
  return semantic ? { ...value, semantic } : value;
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
    hookName === 'asSelectTrigger' ||
    hookName === 'asHoverCardTrigger'
  ) {
    return new Map(COMMAND_STATE_VARIANTS);
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

  if (hookName === 'asDialogMask' || hookName === 'asDialogContent') {
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

function collectRuleVariantTokens(node, scope, tokens) {
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

  const variants = analyzeWhenVariants(whenProp.initializer, scope);
  if (variants.length === 0) return;

  const intentTokens = collectTwTokens(intentProp.initializer, scope);
  for (const token of intentTokens) {
    tokens.add(`${variants.join(':')}:${token}`);
  }
}

function analyzeWhenVariants(node, scope) {
  const out = new Set();

  visit(node);
  const variants = canonicalizeLoweredVariants(Array.from(out));
  if (variants.length > 0 && variants.every(isNegativeDataVariant)) return [];
  return variants;

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
              const semantic = resolveStateHandleSemantic(firstArg, scope);
              const variant = resolveStateEqVariant(semantic, expected);
              if (variant) out.add(variant);
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
              out.add('dark');
            }
          }
        }
      }
    }

    ts.forEachChild(current, visit);
  }
}

function resolveStateHandleSemantic(node, scope) {
  if (ts.isIdentifier(node)) return lookup(node.text, scope).semantic ?? null;
  if (!ts.isPropertyAccessExpression(node)) return null;

  const owner = resolveExpression(node.expression, scope);
  return owner.semanticMap?.get(node.name.text) ?? null;
}

function resolveStateEqVariant(semantic, expected) {
  if (!semantic) return null;
  if (!expected) return null;
  if (expected.kind === ts.SyntaxKind.TrueKeyword) return semantic;
  if (expected.kind === ts.SyntaxKind.FalseKeyword) return negateDataVariant(semantic);
  if (ts.isStringLiteralLike(expected)) {
    const match = semantic.match(/^data-\[([a-zA-Z0-9-]+)\]$/);
    if (!match || !/^[a-zA-Z0-9_-]+$/.test(expected.text)) return null;
    return `data-[${match[1]}=${expected.text}]`;
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

function collectTwTokens(node, scope) {
  const found = new Set();

  visit(node, scope);
  return Array.from(found);

  function visit(current, currentScope) {
    if (createsScope(current)) {
      const nextScope = createScope(currentScope);
      if (hasStatements(current)) {
        for (const stmt of current.statements) {
          if (ts.isVariableStatement(stmt)) {
            for (const decl of stmt.declarationList.declarations) {
              registerDeclaration(decl, nextScope);
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

async function collectSourceFiles(dir) {
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
