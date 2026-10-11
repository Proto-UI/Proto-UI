import ts from 'typescript';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

const UNKNOWN = Symbol('unknown');
const FUNCTION = Symbol('function');
const BUILTIN = Symbol('builtin');
export const isUnknown = (v) => v?.[UNKNOWN] === true;
export const isFunction = (v) => Boolean(v?.[FUNCTION]);
export const unwrap = (n) => {
  while (
    n &&
    (ts.isParenthesizedExpression(n) ||
      ts.isAsExpression(n) ||
      ts.isSatisfiesExpression(n) ||
      ts.isNonNullExpression(n))
  )
    n = n.expression;
  return n;
};

// A data reader, never a JS/TS evaluator: no eval, imports, getters, host calls,
// mutation, constructors, loops or method invocation from the inspected input.
export function createStaticReader(root, { read = readFileSync, maxSteps = 500000 } = {}) {
  root = resolve(root);
  const modules = new Map(),
    origins = new WeakMap(),
    inputs = new Map();
  let steps = 0;
  const callStack = [];
  const location = (n) => {
    const sf = n.getSourceFile();
    const p = sf.getLineAndCharacterOfPosition(n.getStart(sf));
    const end = sf.getLineAndCharacterOfPosition(n.getEnd());
    return {
      path: relative(root, sf.fileName).split(sep).join('/'),
      line: p.line + 1,
      column: p.character + 1,
      endLine: end.line + 1,
      endColumn: end.character + 1,
    };
  };
  const unknown = (n, reason) => ({ [UNKNOWN]: true, reason, ...(n ? location(n) : {}) });
  const inside = (p) => p === root || p.startsWith(root + sep);
  const resolveFile = (specifier, from) => {
    if (!specifier.startsWith('.')) return null;
    const base = resolve(dirname(from), specifier);
    return (
      [base, base + '.ts', base + '.tsx', base + '/index.ts'].find(
        (p) => inside(p) && existsSync(p) && statSync(p).isFile()
      ) ?? null
    );
  };
  const functionValue = (node, env) =>
    node.asteriskToken ||
    node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)
      ? unknown(node, 'async/generator functions are outside the synchronous static factory subset')
      : { [FUNCTION]: true, node, env };
  const bind = (statements, env) => {
    for (const s of statements) {
      if (ts.isFunctionDeclaration(s) && s.name) env.set(s.name.text, functionValue(s, env));
      if (ts.isVariableStatement(s))
        for (const d of s.declarationList.declarations) {
          if (ts.isIdentifier(d.name))
            env.set(d.name.text, {
              lazy: true,
              node: d.initializer,
              env,
              constant: Boolean(s.declarationList.flags & ts.NodeFlags.Const),
            });
        }
    }
  };
  const reserve = (statements, env) => {
    const names = (node) => {
      if (ts.isIdentifier(node))
        env.set(node.text, unknown(node, 'lexical binding is not initialized'));
      else if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node))
        for (const element of node.elements) if (ts.isBindingElement(element)) names(element.name);
    };
    for (const statement of statements)
      if (ts.isVariableStatement(statement))
        for (const declaration of statement.declarationList.declarations) names(declaration.name);
  };
  const lookup = (name, env, node) => {
    if (!env.has(name)) return unknown(node, `unresolved binding: ${name}`);
    const value = env.get(name);
    if (!value?.lazy) return value;
    if (
      ts.isIdentifier(node) &&
      value.node &&
      node.getSourceFile() === value.node.getSourceFile() &&
      node.getStart() < value.node.getStart()
    )
      return unknown(node, `forward binding requires initialization evidence: ${name}`);
    if (!value.constant) return unknown(node, `mutable binding: ${name}`);
    env.set(name, unknown(node, `cyclic binding: ${name}`));
    const result = evaluate(value.node, value.env);
    env.set(name, result);
    return result;
  };
  const invoke = (fn, args, callNode) => {
    if (!isFunction(fn)) return unknown(callNode, 'unsupported call; source was not executed');
    callStack.push(location(callNode));
    try {
      const env = new Map(fn.env);
      fn.node.parameters.forEach((p, i) => {
        if (ts.isIdentifier(p.name))
          env.set(
            p.name.text,
            args[i] === undefined && p.initializer ? evaluate(p.initializer, env) : args[i]
          );
      });
      const body = fn.node.body;
      if (!body) return unknown(callNode, 'function has no body');
      if (!ts.isBlock(body)) return evaluate(body, env);
      reserve(body.statements, env);
      bind(body.statements.filter(ts.isFunctionDeclaration), env);
      for (const s of body.statements) {
        if (ts.isVariableStatement(s)) {
          bind([s], env);
          for (const d of s.declarationList.declarations) {
            const value = ts.isIdentifier(d.name)
              ? lookup(d.name.text, env, d)
              : unknown(d, 'unsupported binding pattern');
            if (isUnknown(value)) return value;
          }
        }
        if (ts.isReturnStatement(s)) return evaluate(s.expression, env);
        if (!ts.isVariableStatement(s) && !ts.isFunctionDeclaration(s) && !ts.isEmptyStatement(s))
          return unknown(s, 'unsupported statement before return');
      }
      return unknown(body, 'no static return');
    } finally {
      callStack.pop();
    }
  };
  function evaluate(raw, env) {
    const n = unwrap(raw);
    if (!n) return undefined;
    if (++steps > maxSteps) throw new Error('Static reader step limit exceeded');
    if (ts.isStringLiteralLike(n)) return n.text;
    if (ts.isNumericLiteral(n)) return Number(n.text);
    if (n.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (n.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (n.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isIdentifier(n)) return n.text === 'undefined' ? undefined : lookup(n.text, env, n);
    if (ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isMethodDeclaration(n))
      return functionValue(n, env);
    if (ts.isArrayLiteralExpression(n)) {
      const out = [];
      for (const e of n.elements) {
        const v = evaluate(ts.isSpreadElement(e) ? e.expression : e, env);
        if (ts.isSpreadElement(e)) {
          if (!Array.isArray(v)) return unknown(e, 'unknown array spread');
          out.push(...v);
        } else out.push(v);
      }
      origins.set(out, {
        ...location(n),
        ...(callStack.length ? { callSites: [...callStack] } : {}),
      });
      return out;
    }
    if (ts.isObjectLiteralExpression(n)) {
      const out = Object.create(null);
      for (const p of n.properties) {
        if (ts.isSpreadAssignment(p)) {
          const v = evaluate(p.expression, env);
          if (!v || isUnknown(v) || isFunction(v) || Array.isArray(v) || typeof v !== 'object')
            return unknown(p, 'unknown object spread');
          Object.assign(out, v);
          continue;
        }
        const key =
          p.name &&
          (ts.isComputedPropertyName(p.name) ? evaluate(p.name.expression, env) : p.name.text);
        if (typeof key !== 'string' && typeof key !== 'number')
          return unknown(p, 'unknown property name');
        if (ts.isPropertyAssignment(p)) out[key] = evaluate(p.initializer, env);
        else if (ts.isShorthandPropertyAssignment(p)) out[key] = lookup(p.name.text, env, p);
        else if (ts.isMethodDeclaration(p)) out[key] = functionValue(p, env);
        else return unknown(p, 'accessor is not static data');
      }
      origins.set(out, {
        ...location(n),
        ...(callStack.length ? { callSites: [...callStack] } : {}),
      });
      return out;
    }
    if (ts.isTemplateExpression(n)) {
      let out = n.head.text;
      for (const s of n.templateSpans) {
        const v = evaluate(s.expression, env);
        if (!['string', 'number', 'boolean'].includes(typeof v))
          return unknown(s.expression, 'unknown template substitution');
        out += String(v) + s.literal.text;
      }
      return out;
    }
    if (ts.isConditionalExpression(n)) {
      const v = evaluate(n.condition, env);
      return isUnknown(v)
        ? unknown(n, 'dynamic conditional')
        : evaluate(v ? n.whenTrue : n.whenFalse, env);
    }
    if (ts.isBinaryExpression(n)) {
      const a = evaluate(n.left, env),
        b = evaluate(n.right, env);
      if (isUnknown(a) || isUnknown(b)) return unknown(n, 'dynamic binary expression');
      switch (n.operatorToken.kind) {
        case ts.SyntaxKind.EqualsEqualsEqualsToken:
          return a === b;
        case ts.SyntaxKind.ExclamationEqualsEqualsToken:
          return a !== b;
        case ts.SyntaxKind.PlusToken:
          return ['string', 'number'].includes(typeof a) && ['string', 'number'].includes(typeof b)
            ? a + b
            : unknown(n, 'non-primitive addition');
        default:
          return unknown(n, 'unsupported binary operator');
      }
    }
    if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) {
      const value = evaluate(n.expression, env),
        key = ts.isPropertyAccessExpression(n) ? n.name.text : evaluate(n.argumentExpression, env);
      if (
        !value ||
        isUnknown(value) ||
        isFunction(value) ||
        !['string', 'number'].includes(typeof key)
      )
        return unknown(n, 'unknown member');
      return Object.hasOwn(value, key) ? value[key] : unknown(n, 'missing own member');
    }
    if (ts.isCallExpression(n)) {
      const fn = evaluate(n.expression, env);
      const args = n.arguments.map((a) => evaluate(a, env));
      if (fn?.[BUILTIN] === 'definePrototype') return args[0];
      if (fn?.[BUILTIN] === 'tw')
        return args.length === 1 && typeof args[0] === 'string'
          ? args[0]
          : unknown(n, 'dynamic style tokens');
      return invoke(fn, args, n);
    }
    return unknown(n, `unsupported syntax: ${ts.SyntaxKind[n.kind]}`);
  }
  function module(file) {
    file = resolve(root, file);
    if (!inside(file)) throw new Error('Source is outside the selected repository');
    if (modules.has(file)) return modules.get(file);
    const source = read(file, 'utf8');
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    if (sf.parseDiagnostics.length) throw new Error(`Cannot parse ${relative(root, file)}`);
    inputs.set(
      relative(root, file).split(sep).join('/'),
      createHash('sha256').update(source).digest('hex')
    );
    const env = new Map(),
      exports = new Map();
    const result = { sf, env, exports, invalid: null };
    modules.set(file, result);
    for (const s of sf.statements)
      if (ts.isImportDeclaration(s) && s.importClause && !s.importClause.isTypeOnly) {
        const from = s.moduleSpecifier.text;
        const target = resolveFile(from, file);
        const get = (name) =>
          from === '@proto.ui/core' && ['tw', 'definePrototype'].includes(name)
            ? { [BUILTIN]: name }
            : target
              ? exported(target, name)
              : unknown(s, `external import: ${from}#${name}`);
        if (s.importClause.name) env.set(s.importClause.name.text, get('default'));
        if (s.importClause.namedBindings && ts.isNamedImports(s.importClause.namedBindings))
          for (const e of s.importClause.namedBindings.elements)
            if (!e.isTypeOnly) env.set(e.name.text, get(e.propertyName?.text ?? e.name.text));
      }
    bind(sf.statements, env);
    const containsUnknown = (value) =>
      isUnknown(value) ||
      (!isFunction(value) &&
        value &&
        typeof value === 'object' &&
        Object.values(value).some(containsUnknown));
    for (const s of sf.statements) {
      const declarative =
        ts.isImportDeclaration(s) ||
        ts.isExportDeclaration(s) ||
        ts.isExportAssignment(s) ||
        ts.isFunctionDeclaration(s) ||
        ts.isVariableStatement(s) ||
        ts.isInterfaceDeclaration(s) ||
        ts.isTypeAliasDeclaration(s) ||
        ts.isEmptyStatement(s);
      if (!declarative)
        result.invalid = unknown(
          s,
          'unmodeled executable module statement; composition may be mutated'
        );
      if (ts.isVariableStatement(s))
        for (const d of s.declarationList.declarations) {
          if (!ts.isIdentifier(d.name) || containsUnknown(lookup(d.name.text, env, d)))
            result.invalid = unknown(
              d,
              'unsupported module initializer; effects and resulting composition are unknown'
            );
        }
    }
    for (const s of sf.statements) {
      if (ts.isExportAssignment(s)) exports.set('default', () => evaluate(s.expression, env));
      if (s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        if (ts.isFunctionDeclaration(s) && s.name)
          exports.set(
            s.modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
              ? 'default'
              : s.name.text,
            () => lookup(s.name.text, env, s)
          );
        if (ts.isVariableStatement(s))
          for (const d of s.declarationList.declarations)
            if (ts.isIdentifier(d.name))
              exports.set(d.name.text, () => lookup(d.name.text, env, d));
      }
      if (ts.isExportDeclaration(s) && s.exportClause && ts.isNamedExports(s.exportClause))
        for (const e of s.exportClause.elements) {
          const target = s.moduleSpecifier && resolveFile(s.moduleSpecifier.text, file);
          exports.set(e.name.text, () =>
            target
              ? exported(target, e.propertyName?.text ?? e.name.text)
              : lookup(e.propertyName?.text ?? e.name.text, env, e)
          );
        }
    }
    return result;
  }
  const resolving = new Set();
  function exported(file, name = 'default') {
    const key = `${file}#${name}`;
    if (resolving.has(key)) return unknown(null, 'cyclic export');
    resolving.add(key);
    try {
      const m = module(file);
      return m.invalid ?? m.exports.get(name)?.() ?? unknown(null, `missing export: ${name}`);
    } finally {
      resolving.delete(key);
    }
  }
  return {
    module,
    exported,
    evaluate,
    bind,
    reserve,
    invoke,
    unknown,
    location,
    origins,
    inputs,
    resolveFile,
  };
}
