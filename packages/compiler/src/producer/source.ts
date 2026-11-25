import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { PRELUDE_PATH } from '../frontend/program.ts';
import type { ProtoDiagnostic } from '../frontend/types.ts';
import type { Binding, SourceSpan, ValueType } from '../targets/component-ir.ts';
import { createSourceData, type SourceData } from './data-types.ts';

export const AUTHORING_DECLARATIONS = fileURLToPath(
  new URL('../../prelude/authoring.d.ts', import.meta.url)
);

export interface SourceContext {
  readonly checker: ts.TypeChecker;
  readonly data: SourceData;
  span(node: ts.Node): SourceSpan;
  binding(node: ts.Node, role: string, name: string, type: ValueType): Binding;
  symbol(node: ts.Node): ts.Symbol;
  intrinsic(node: ts.Expression, exportedName: string): boolean;
  method(call: ts.CallExpression, owner: string, method: string): boolean;
  missing(node: ts.Node, capability: string, message: string): never;
  invalid(node: ts.Node, code: string, message: string): never;
}

export class SourceIssue extends Error {
  readonly diagnostic: ProtoDiagnostic;

  constructor(diagnostic: ProtoDiagnostic) {
    super(diagnostic.message);
    this.name = 'SourceIssue';
    this.diagnostic = diagnostic;
  }
}

export function sourceLocation(node: ts.Node) {
  const file = node.getSourceFile();
  const start = node.getStart(file);
  const { line, character } = file.getLineAndCharacterOfPosition(start);
  return { file: file.fileName, line: line + 1, column: character + 1, length: node.end - start };
}

export function unalias(checker: ts.TypeChecker, symbol: ts.Symbol): ts.Symbol {
  return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

export function createSourceContext(program: ts.Program): SourceContext {
  const checker = program.getTypeChecker();
  const declarations = program.getSourceFile(AUTHORING_DECLARATIONS);
  const module = declarations && checker.getSymbolAtLocation(declarations);
  const exports = new Map(
    module ? checker.getExportsOfModule(module).map((s) => [s.name, unalias(checker, s)]) : []
  );
  const primitives = program.getSourceFile(PRELUDE_PATH);
  function lookup(node: ts.Node): ts.Symbol | undefined {
    const symbol =
      ts.isIdentifier(node) && ts.isShorthandPropertyAssignment(node.parent)
        ? checker.getShorthandAssignmentValueSymbol(node.parent)
        : checker.getSymbolAtLocation(node);
    return symbol && unalias(checker, symbol);
  }
  function origin(expression: ts.Expression, seen = new Set<ts.Symbol>()): ts.Symbol | undefined {
    if (ts.isParenthesizedExpression(expression) || ts.isSatisfiesExpression(expression))
      return origin(expression.expression, seen);
    if (ts.isPropertyAccessExpression(expression)) {
      const receiver = origin(expression.expression, seen);
      if (!receiver?.declarations?.some(ts.isSourceFile)) return undefined;
    } else if (!ts.isIdentifier(expression)) return undefined;
    const symbol = lookup(expression);
    if (!symbol || seen.has(symbol)) return undefined;
    const declaration = symbol.valueDeclaration;
    if (
      declaration &&
      ts.isVariableDeclaration(declaration) &&
      declaration.initializer &&
      ts.isVariableDeclarationList(declaration.parent) &&
      declaration.parent.flags & ts.NodeFlags.Const
    ) {
      seen.add(symbol);
      return origin(declaration.initializer, seen);
    }
    return symbol;
  }
  function span(node: ts.Node): SourceSpan {
    const file = node.getSourceFile();
    return {
      file: path.relative(program.getCurrentDirectory(), file.fileName).split(path.sep).join('/'),
      start: node.getStart(file),
      end: node.end,
    };
  }
  function missing(node: ts.Node, capability: string, message: string): never {
    throw new SourceIssue({
      code: 'PUI_COMPILER_MISSING',
      ruleId: 'proto/source-producer',
      criterion: ['C-COMPILER-FOUNDATION-0001-IR'],
      category: 'compiler-missing',
      severity: 'info',
      capabilityKey: capability,
      trackingRef: '#1809',
      message,
      location: sourceLocation(node),
    });
  }
  return {
    checker,
    span,
    missing,
    data: createSourceData(checker, exports, primitives, span, missing),
    binding(node, role, name, type) {
      const source = span(node);
      return {
        id: JSON.stringify([source.file, source.start, source.end, role]),
        name,
        type,
        source,
      };
    },
    symbol(node) {
      return (
        lookup(node) ??
        missing(
          node,
          'producer/unresolved-binding',
          'The checker could not resolve a declaration for this reference.'
        )
      );
    },
    intrinsic(node, exportedName) {
      const symbol = origin(node);
      if (!symbol) return false;
      if (exportedName === 'Infinity' || exportedName === 'NaN') {
        return (
          symbol.name === exportedName && symbol.valueDeclaration?.getSourceFile() === primitives
        );
      }
      return exports.get(exportedName) === symbol;
    },
    method(call, owner, method) {
      const signature = checker.getResolvedSignature(call)?.declaration;
      if (
        !signature ||
        !declarations ||
        signature.getSourceFile() !== declarations ||
        !ts.isMethodSignature(signature)
      )
        return false;
      return (
        ts.isInterfaceDeclaration(signature.parent) &&
        signature.parent.name.text === owner &&
        ts.isIdentifier(signature.name) &&
        signature.name.text === method
      );
    },
    invalid(node, code, message) {
      throw new SourceIssue({
        code,
        ruleId: 'proto/source-producer',
        criterion: ['C-COMPILER-FOUNDATION-0001-LANGUAGE'],
        category: 'source-invalid',
        severity: 'error',
        message,
        location: sourceLocation(node),
      });
    },
  };
}
