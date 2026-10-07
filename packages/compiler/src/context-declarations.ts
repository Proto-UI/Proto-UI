import ts from 'typescript';
import type { DataType } from './data-types';
import type { SourceSpan } from './ir';
import { rejectNode, sourceName, sourceSpan, type SourceModule } from './parser-module';
import { parseSourceDataType } from './source-types';

/** Serializable declaration identity; a debug name is never a key identity. */
export interface ContextKeyIR {
  id: string;
  name: string;
  type: DataType;
  span: SourceSpan;
}

/** Resolves supplied graph aliases to one declaration; checked failures throw CompilerRejection. */
export function extractContextKeyDeclaration(
  module: SourceModule,
  bindingName: string
): ContextKeyIR {
  const resolved = module.graph.resolveBinding(module, bindingName);
  if (resolved.module === null)
    rejectNode(
      resolved.imported.node,
      'PUI1021',
      'Context keys must be declarations in the supplied source graph.'
    );
  const declaration = resolved.node;
  if (
    !ts.isCallExpression(declaration) ||
    !ts.isIdentifier(declaration.expression) ||
    resolved.module.graph.resolveCoreImport(resolved.module, declaration.expression.text) !==
      'createContextKey'
  )
    rejectNode(
      declaration,
      'PUI1021',
      'Context keys must be created by the admitted core createContextKey factory.'
    );
  if (declaration.arguments.length !== 1)
    rejectNode(declaration, 'PUI1021', 'createContextKey requires exactly one static string name.');
  const name = declaration.arguments[0];
  if (!ts.isStringLiteral(name))
    rejectNode(name, 'PUI1021', 'Context key names must be string literals, not computed values.');
  if (declaration.typeArguments?.length !== 1)
    rejectNode(
      declaration,
      'PUI1021',
      'createContextKey requires one explicit serializable record type.'
    );
  const typeNode = declaration.typeArguments[0];
  const type = parseSourceDataType(resolved.module, typeNode);
  const members = typeof type !== 'string' && type.kind === 'union' ? type.members : [type];
  if (members.some((member) => typeof member === 'string' || member.kind !== 'record'))
    rejectNode(
      typeNode,
      'PUI1021',
      'Context values must be JSON object record shapes, not scalars, arrays or host values.'
    );
  return {
    id: `${sourceName(resolved.module.file.fileName)}#${resolved.name}`,
    name: name.text,
    type,
    span: sourceSpan(declaration),
  };
}
