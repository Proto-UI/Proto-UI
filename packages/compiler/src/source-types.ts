import type ts from 'typescript';
import { parseDataType, type DataType } from './data-types';
import type { SourceModule } from './parser-module';
import { rejectNode } from './source-syntax';
import type { ValueType } from './ir';
import { parseSourceValueType } from './source-values';
import { joinValueTypes, valueAlternatives } from './value-types';

/** JSON boundaries use the ordinary resolved type grammar, followed by a data proof. */
export function parseSourceDataType(module: SourceModule, node: ts.TypeNode): DataType {
  const origins = new Map<ValueType, ts.Node>();
  const data = (type: ValueType, top = false): DataType => {
    if (typeof type === 'string') {
      if (['boolean', 'number', 'string', 'null'].includes(type)) return type as DataType;
      if (top && type === 'void') return 'void';
    } else {
      if (type.kind === 'literal') return type;
      if (type.kind === 'array' || type.kind === 'value-array')
        return { kind: 'array', element: data(type.element) };
      if (type.kind === 'union' || type.kind === 'value-union')
        return { kind: 'union', members: type.members.map((member) => data(member)) };
      if (
        (type.kind === 'record' || type.kind === 'object') &&
        !('index' in type && type.index !== undefined)
      )
        return {
          kind: 'record',
          fields: type.fields.map(({ name, type, optional }) => ({
            name,
            type: data(
              optional
                ? joinValueTypes(valueAlternatives(type).filter((member) => member !== 'void'))
                : type
            ),
            ...(optional ? { optional: true } : {}),
          })),
        };
    }
    rejectNode(
      origins.get(type) ?? node,
      'PUI1020',
      'A data boundary requires finite JSON values; functions, capabilities, unknown, and void fields are not data.'
    );
  };
  try {
    return parseDataType(data(parseSourceValueType(module, node, new Map(), origins), true));
  } catch (error) {
    if (error instanceof TypeError) rejectNode(node, 'PUI1020', error.message);
    throw error;
  }
}
