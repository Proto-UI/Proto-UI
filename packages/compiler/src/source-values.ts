import ts from 'typescript';
import type { SourceModule } from './parser-module';
import { rejectNode, propertyName } from './source-syntax';
import { resolveSourceType, type TypeSource, type TypeDeclaration } from './source-type-resolution';
import { isDataValueType, type ParameterIR, type ValueType } from './ir';
import { joinValueTypes, objectFields, objectValueType } from './value-types';
import { CORE_VALUE_TYPES } from './core-value-types';
import { FOCUS_OPTIONS_TYPE, FOCUS_ACTIVATION_OPTIONS_TYPE } from './operations';

export type TypeSubstitutions = ReadonlyMap<string, ValueType>;

export function parseSourceValueType(
  owner: TypeSource,
  node: ts.TypeNode,
  substitutions: TypeSubstitutions = new Map(),
  origins?: Map<ValueType, ts.Node>
): ValueType {
  return new ValueTypeParser(owner, substitutions, new Set(), origins).parse(node);
}

class ValueTypeParser {
  constructor(
    private readonly owner: TypeSource,
    private readonly substitutions: TypeSubstitutions,
    private readonly active = new Set<TypeDeclaration>(),
    private readonly origins?: Map<ValueType, ts.Node>
  ) {}

  parse(node: ts.TypeNode): ValueType {
    const value = this.parseNode(node);
    // Aliases and substitutions retain the original type declaration.
    if (!this.origins?.has(value)) this.origins?.set(value, node);
    return value;
  }

  private parseNode(node: ts.TypeNode): ValueType {
    if (ts.isParenthesizedTypeNode(node)) return this.parse(node.type);
    if (node.kind === ts.SyntaxKind.BooleanKeyword) return 'boolean';
    if (node.kind === ts.SyntaxKind.NumberKeyword) return 'number';
    if (node.kind === ts.SyntaxKind.StringKeyword) return 'string';
    if (node.kind === ts.SyntaxKind.VoidKeyword || node.kind === ts.SyntaxKind.UndefinedKeyword)
      return 'void';
    if (node.kind === ts.SyntaxKind.UnknownKeyword) return 'unknown';
    if (node.kind === ts.SyntaxKind.NeverKeyword) return { kind: 'union', members: [] };
    if (ts.isLiteralTypeNode(node)) {
      const value = node.literal;
      if (value.kind === ts.SyntaxKind.NullKeyword) return 'null';
      if (value.kind === ts.SyntaxKind.TrueKeyword || value.kind === ts.SyntaxKind.FalseKeyword)
        return { kind: 'literal', value: value.kind === ts.SyntaxKind.TrueKeyword };
      if (ts.isStringLiteral(value) || ts.isNumericLiteral(value))
        return {
          kind: 'literal',
          value: ts.isStringLiteral(value) ? value.text : Number(value.text),
        };
    }
    if (ts.isUnionTypeNode(node)) return joinValueTypes(node.types.map((type) => this.parse(type)));
    if (ts.isIntersectionTypeNode(node)) {
      const values = node.types.map((type) => this.parse(type));
      if (values.every((value) => objectFields(value)))
        return objectValueType(values.flatMap((value) => [...objectFields(value)!]));
      // keyof-constrained mapped field names remain ordinary strings after erasure.
      if (values.includes('string') && node.types.some((type) => ts.isIndexedAccessTypeNode(type)))
        return 'string';
      rejectNode(node, 'PUI1020', 'Intersection needs ordinary record fields.');
    }
    if (ts.isArrayTypeNode(node) || ts.isTupleTypeNode(node)) {
      const element = ts.isArrayTypeNode(node)
        ? this.parse(node.elementType)
        : joinValueTypes(
            node.elements.map((type) => this.parse(ts.isNamedTupleMember(type) ? type.type : type))
          );
      if (!isDataValueType(element))
        rejectNode(node, 'PUI1020', 'Array elements must be data values.');
      return { kind: 'array', element };
    }
    if (ts.isTypeOperatorNode(node) && node.operator === ts.SyntaxKind.ReadonlyKeyword)
      return this.parse(node.type);
    if (ts.isFunctionTypeNode(node)) return this.signature(node);
    if (ts.isTypeLiteralNode(node)) return this.record(node.members);
    if (
      ts.isIndexedAccessTypeNode(node) &&
      ts.isTypeOperatorNode(node.indexType) &&
      node.indexType.operator === ts.SyntaxKind.KeyOfKeyword
    ) {
      // A mapped keyof selection constrains source field names; it grants no capability.
      return 'string';
    }
    if (ts.isTypeReferenceNode(node)) {
      if (ts.isIdentifier(node.typeName) && this.substitutions.has(node.typeName.text))
        return this.substitutions.get(node.typeName.text)!;
      const local = ts.isIdentifier(node.typeName)
        ? this.localType(node, node.typeName.text)
        : undefined;
      const binding = local
        ? { kind: 'declaration' as const, owner: this.owner, declaration: local }
        : resolveSourceType(this.owner, node.typeName);
      if (binding?.kind === 'external') {
        if (binding.module === '@proto.ui/core' || binding.module === '@proto.ui/types') {
          if (binding.name === 'FocusRequestOptions') return FOCUS_OPTIONS_TYPE;
          if (binding.name === 'FocusScopeActivationOptions') return FOCUS_ACTIVATION_OPTIONS_TYPE;
          if (binding.name === 'JsonObject')
            return { kind: 'object', fields: [], index: 'unknown' };
          const known = CORE_VALUE_TYPES[binding.name];
          if (known) return known;
          if (
            (binding.name === 'State' || binding.name === 'BorrowedStateHandle') &&
            node.typeArguments?.[0]
          ) {
            const value = this.parse(node.typeArguments[0]);
            const primitive = value === 'boolean' || value === 'number' ? value : 'string';
            return `${binding.name === 'State' ? 'state' : 'borrowed'}:${primitive}`;
          }
        }
        rejectNode(
          node,
          'PUI1020',
          `Type ${binding.module}:${binding.name} has no semantic declaration.`
        );
      }
      if (binding?.kind === 'declaration') {
        const declaration = binding.declaration;
        if (this.active.has(declaration))
          rejectNode(node, 'PUI1020', 'Recursive structural types require a finite declaration.');
        const replacements = new Map(this.substitutions);
        declaration.typeParameters?.forEach((parameter, index) => {
          const argument = node.typeArguments?.[index];
          const value = argument
            ? this.parse(argument)
            : parameter.default
              ? this.parse(parameter.default)
              : parameter.constraint
                ? this.parse(parameter.constraint)
                : undefined;
          if (value === undefined)
            rejectNode(node, 'PUI1020', `Missing static type argument ${parameter.name.text}.`);
          replacements.set(parameter.name.text, value);
        });
        const parser = new ValueTypeParser(binding.owner, replacements, this.active, this.origins);
        this.active.add(declaration);
        try {
          if (ts.isTypeAliasDeclaration(declaration)) return parser.parse(declaration.type);
          const own = parser.record(declaration.members);
          const inherited =
            declaration.heritageClauses?.flatMap((clause) =>
              clause.types.map((base) =>
                parser.parse(
                  ts.factory.createTypeReferenceNode(base.expression.getText(), base.typeArguments)
                )
              )
            ) ?? [];
          if (!inherited.length) return own;
          if (!inherited.every((type) => objectFields(type)))
            rejectNode(node, 'PUI1020', 'Interface inheritance requires record types.');
          return objectValueType([
            ...inherited.flatMap((type) => [...objectFields(type)!]),
            ...objectFields(own)!,
          ]);
        } finally {
          this.active.delete(declaration);
        }
      }
      if (ts.isIdentifier(node.typeName)) {
        const name = node.typeName.text,
          args = node.typeArguments ?? [];
        if (
          (name === 'Readonly' || name === 'Required' || name === 'Partial') &&
          args.length === 1
        ) {
          const type = this.parse(args[0]);
          if (name === 'Readonly') {
            const fields = objectFields(type);
            return fields
              ? {
                  kind: 'object',
                  fields: fields.map((field) => ({ ...field, readonly: true })),
                  ...(typeof type !== 'string' && type.kind === 'object' && type.index
                    ? { index: type.index }
                    : {}),
                }
              : type;
          }
          const fields = objectFields(type);
          if (!fields) rejectNode(node, 'PUI1020', `${name} requires a record.`);
          return objectValueType(
            fields.map((field) => ({ ...field, optional: name === 'Partial' }))
          );
        }
        if ((name === 'Omit' || name === 'Pick') && args.length === 2) {
          const type = this.parse(args[0]),
            keys = this.parse(args[1]);
          const members = typeof keys !== 'string' && keys.kind === 'union' ? keys.members : [keys];
          const names = members.map((key) =>
            typeof key !== 'string' && key.kind === 'literal' && typeof key.value === 'string'
              ? key.value
              : rejectNode(node, 'PUI1020', `${name} requires finite string keys.`)
          );
          const fields = objectFields(type);
          if (!fields) rejectNode(node, 'PUI1020', `${name} requires a record.`);
          return objectValueType(
            fields.filter((field) => names.includes(field.name) === (name === 'Pick'))
          );
        }
        if ((name === 'Array' || name === 'ReadonlyArray') && args.length === 1) {
          const type = this.parse(args[0]);
          if (!isDataValueType(type))
            rejectNode(node, 'PUI1020', 'Array elements must be data values.');
          return { kind: 'array', element: type };
        }
      }
    }
    rejectNode(node, 'PUI1020', `Unsupported ordinary value type ${ts.SyntaxKind[node.kind]}.`);
  }

  private localType(node: ts.Node, name: string): TypeDeclaration | undefined {
    for (let parent: ts.Node | undefined = node.parent; parent; parent = parent.parent) {
      if (!ts.isBlock(parent)) continue;
      const declaration = parent.statements.find(
        (statement) =>
          (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) &&
          statement.name.text === name
      );
      if (declaration) return declaration as TypeDeclaration;
    }
    return undefined;
  }

  private signature(node: ts.FunctionTypeNode | ts.MethodSignature): ValueType {
    const types = new Map(this.substitutions);
    node.typeParameters?.forEach((parameter) =>
      types.set(
        parameter.name.text,
        parameter.constraint ? this.parse(parameter.constraint) : 'unknown'
      )
    );
    const parser = new ValueTypeParser(this.owner, types, this.active, this.origins);
    const parameters: Pick<ParameterIR, 'name' | 'type' | 'optional'>[] = node.parameters.map(
      (parameter) => {
        if (parameter.initializer)
          rejectNode(
            parameter,
            'PUI1020',
            'Callable type signatures cannot contain parameter initializers.'
          );
        if (parameter.dotDotDotToken)
          rejectNode(
            parameter,
            'PUI1020',
            'Rest parameters in callable type signatures are unsupported.'
          );
        if (!ts.isIdentifier(parameter.name) || !parameter.type)
          rejectNode(parameter, 'PUI1020', 'Callable types require named, typed parameters.');
        return {
          name: parameter.name.text,
          type: parser.parse(parameter.type),
          ...(parameter.questionToken ? { optional: true } : {}),
        };
      }
    );
    return {
      kind: 'callable',
      parameters,
      returnType: node.type ? parser.parse(node.type) : 'void',
    };
  }

  private record(members: readonly ts.TypeElement[]): ValueType {
    const fields = members.map((member) => {
      if (ts.isMethodSignature(member)) {
        const type = this.signature(member);
        this.origins?.set(type, member);
        return {
          name: propertyName(member.name),
          type,
          ...(member.questionToken ? { optional: true } : {}),
        };
      }
      if (!ts.isPropertySignature(member) || !member.type)
        rejectNode(
          member,
          'PUI1020',
          'Ordinary records require statically declared fields or methods.'
        );
      return {
        name: propertyName(member.name),
        type: this.parse(member.type),
        ...(member.questionToken ? { optional: true } : {}),
        ...(member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword)
          ? { readonly: true }
          : {}),
      };
    });
    return objectValueType(fields);
  }
}
