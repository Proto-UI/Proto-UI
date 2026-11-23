import ts from 'typescript';
import type { SourceModule } from './parser-module';
import { rejectNode, propertyName } from './source-syntax';
import {
  resolveSourceType,
  resolveSourceValue,
  type TypeSource,
  type TypeDeclaration,
} from './source-type-resolution';
import { isDataValueType, type ParameterIR, type ValueType } from './ir';
import {
  joinValueTypes,
  objectFields,
  objectValueType,
  memberValueType,
  valueAssignable,
  valueAlternatives,
  arrayElementType,
} from './value-types';
import { CORE_VALUE_TYPES } from './core-value-types';
import {
  FOCUS_OPTIONS_TYPE,
  FOCUS_ACTIVATION_OPTIONS_TYPE,
  OPERATION_RULES,
  capabilityMemberType,
} from './operations';
import { eventPayloadMemberType } from './event-types';
import { ecmaNamedType } from './ecmascript-values';
import { ecmaSourcePath } from './source-ecmascript';

export type TypeSubstitutions = ReadonlyMap<string, ValueType>;
export type ValueQueryResolver = (
  owner: TypeSource,
  query: ts.TypeQueryNode
) => ValueType | undefined;

/** Utility-type selection retains the whole original member, including authority. */
function matchesTypeConstraint(actual: ValueType, expected: ValueType): boolean {
  if (expected === 'unknown') return true;
  const sources = valueAlternatives(actual);
  if (sources.length > 1) return sources.every((source) => matchesTypeConstraint(source, expected));
  const targets = valueAlternatives(expected);
  if (targets.length > 1) return targets.some((target) => matchesTypeConstraint(actual, target));
  const fields = objectFields(actual),
    constraints = objectFields(expected);
  if (fields && constraints) {
    // This is a read-only type predicate, not a mutable structural view or an
    // object projection. Extra fields are never erased from the chosen type.
    if (typeof expected !== 'string' && expected.kind === 'object' && expected.index !== undefined)
      return valueAssignable(actual, expected);
    return constraints.every((field) => {
      const source = fields.find((candidate) => candidate.name === field.name);
      return source
        ? (!source.optional || !!field.optional) && matchesTypeConstraint(source.type, field.type)
        : !!field.optional;
    });
  }
  return valueAssignable(actual, expected);
}

export function parseSourceValueType(
  owner: TypeSource,
  node: ts.TypeNode,
  substitutions: TypeSubstitutions = new Map(),
  origins?: Map<ValueType, ts.Node>,
  query?: ValueQueryResolver
): ValueType {
  return new ValueTypeParser(owner, substitutions, new Set(), origins, query).parse(node);
}

class ValueTypeParser {
  constructor(
    private readonly owner: TypeSource,
    private readonly substitutions: TypeSubstitutions,
    private readonly active = new Set<TypeDeclaration>(),
    private readonly origins?: Map<ValueType, ts.Node>,
    private readonly query?: ValueQueryResolver
  ) {}

  parse(node: ts.TypeNode): ValueType {
    const value = this.parseNode(node);
    // Aliases and substitutions retain the original type declaration.
    if (!this.origins?.has(value)) this.origins?.set(value, node);
    return value;
  }

  private parseNode(node: ts.TypeNode): ValueType {
    if (ts.isParenthesizedTypeNode(node)) return this.parse(node.type);
    if (ts.isTypeQueryNode(node)) {
      const path = (name: ts.EntityName): string =>
        ts.isIdentifier(name) ? name.text : `${path(name.left)}.${name.right.text}`;
      const name = path(node.exprName);
      const exact = this.substitutions.get(`typeof:${name}`);
      if (exact !== undefined) return exact;
      const [root, ...members] = name.split('.');
      let value = this.substitutions.get(`typeof:${root}`);
      if (value !== undefined) {
        try {
          for (const member of members) value = memberValueType(value, member);
          return value;
        } catch {
          /* A method result requires its own declared operation signature. */
        }
      }
      const resolved = this.query?.(this.owner, node);
      if (resolved !== undefined) return resolved;
      rejectNode(node, 'PUI1020', 'A type query requires a checked lexical value declaration.');
    }
    if (node.kind === ts.SyntaxKind.BooleanKeyword) return 'boolean';
    if (node.kind === ts.SyntaxKind.NumberKeyword) return 'number';
    if (node.kind === ts.SyntaxKind.StringKeyword) return 'string';
    if (node.kind === ts.SyntaxKind.VoidKeyword || node.kind === ts.SyntaxKind.UndefinedKeyword)
      return 'void';
    if (node.kind === ts.SyntaxKind.UnknownKeyword || node.kind === ts.SyntaxKind.AnyKeyword)
      return 'unknown';
    if (node.kind === ts.SyntaxKind.ObjectKeyword)
      return { kind: 'object', fields: [], index: 'unknown' };
    // A source type predicate still returns a Boolean. Array filtering derives
    // its narrowed element from the checked condition body, never this label.
    if (ts.isTypePredicateNode(node) && !node.assertsModifier) return 'boolean';
    if (node.kind === ts.SyntaxKind.NeverKeyword) return { kind: 'union', members: [] };
    if (
      ts.isImportTypeNode(node) &&
      !node.isTypeOf &&
      node.qualifier &&
      ts.isIdentifier(node.qualifier) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      const module = node.argument.literal.text,
        name = node.qualifier.text;
      if (module === '@proto.ui/core' || module === '@proto.ui/types') {
        if (CORE_VALUE_TYPES[name]) return CORE_VALUE_TYPES[name];
        if (name === 'FocusRequestOptions') return FOCUS_OPTIONS_TYPE;
        if (name === 'FocusScopeActivationOptions') return FOCUS_ACTIVATION_OPTIONS_TYPE;
        if (name === 'StyleHandle' || name === 'StyleTokenHandle') return 'style-handle';
      }
      rejectNode(node, 'PUI1020', `Type ${module}:${name} has no semantic declaration.`);
    }
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
      if (values.every(isDataValueType)) {
        let result = valueAlternatives(values[0]);
        for (const value of values.slice(1))
          result = result.flatMap((left) =>
            valueAlternatives(value).flatMap((right) =>
              valueAssignable(left, right) ? [left] : valueAssignable(right, left) ? [right] : []
            )
          );
        return joinValueTypes(result);
      }
      rejectNode(
        node,
        'PUI1020',
        'Intersection needs ordinary record fields or compatible data types.'
      );
    }
    if (ts.isArrayTypeNode(node) || ts.isTupleTypeNode(node)) {
      const element = ts.isArrayTypeNode(node)
        ? this.parse(node.elementType)
        : joinValueTypes(
            node.elements.map((type) => this.parse(ts.isNamedTupleMember(type) ? type.type : type))
          );
      return { kind: 'value-array', element };
    }
    if (ts.isTypeOperatorNode(node) && node.operator === ts.SyntaxKind.KeyOfKeyword) {
      const type = this.parse(node.type),
        fields = objectFields(type);
      if (!fields) rejectNode(node, 'PUI1020', 'keyof requires a checked finite ordinary record.');
      if (typeof type !== 'string' && type.kind === 'object' && type.index !== undefined)
        return 'string';
      return joinValueTypes(fields.map((field) => ({ kind: 'literal', value: field.name })));
    }
    if (ts.isTypeOperatorNode(node) && node.operator === ts.SyntaxKind.ReadonlyKeyword) {
      const type = this.parse(node.type);
      return typeof type !== 'string' && type.kind === 'value-array'
        ? isDataValueType(type.element)
          ? { kind: 'array', element: type.element }
          : { ...type, readonly: true }
        : type;
    }
    if (ts.isMappedTypeNode(node)) {
      if (!node.typeParameter.constraint || !node.type)
        rejectNode(
          node,
          'PUI1020',
          'Mapped values require finite keys and an explicit value type.'
        );
      const keys = valueAlternatives(this.parse(node.typeParameter.constraint));
      const inherited =
        ts.isTypeOperatorNode(node.typeParameter.constraint) &&
        node.typeParameter.constraint.operator === ts.SyntaxKind.KeyOfKeyword
          ? objectFields(this.parse(node.typeParameter.constraint.type))
          : undefined;
      return objectValueType(
        keys.map((key) => {
          if (typeof key === 'string' || key.kind !== 'literal' || typeof key.value !== 'string')
            rejectNode(node, 'PUI1020', 'Mapped values require a finite literal string key set.');
          const substitutions = new Map(this.substitutions);
          substitutions.set(node.typeParameter.name.text, key);
          const parser = new ValueTypeParser(
            this.owner,
            substitutions,
            this.active,
            this.origins,
            this.query
          );
          const renamed = node.nameType ? parser.parse(node.nameType) : key;
          if (
            typeof renamed === 'string' ||
            renamed.kind !== 'literal' ||
            typeof renamed.value !== 'string'
          )
            rejectNode(
              node,
              'PUI1020',
              'Mapped key remapping must retain one finite literal string.'
            );
          const source = inherited?.find((field) => field.name === key.value);
          const optional = node.questionToken
            ? node.questionToken.kind !== ts.SyntaxKind.MinusToken
            : !!source?.optional;
          const readonly = node.readonlyToken
            ? node.readonlyToken.kind !== ts.SyntaxKind.MinusToken
            : !!source?.readonly;
          const value = parser.parse(node.type!);
          return {
            name: renamed.value,
            type: optional ? joinValueTypes([value, 'void']) : value,
            ...(optional ? { optional: true } : {}),
            ...(readonly ? { readonly: true } : {}),
          };
        })
      );
    }
    if (ts.isFunctionTypeNode(node)) return this.signature(node);
    if (ts.isTypeLiteralNode(node)) return this.record(node.members);
    if (
      ts.isIndexedAccessTypeNode(node) &&
      ts.isLiteralTypeNode(node.indexType) &&
      ts.isStringLiteral(node.indexType.literal)
    ) {
      try {
        return memberValueType(this.parse(node.objectType), node.indexType.literal.text);
      } catch (error) {
        rejectNode(
          node,
          'PUI1020',
          error instanceof Error ? error.message : 'Invalid indexed value type.'
        );
      }
    }
    if (ts.isIndexedAccessTypeNode(node) && node.indexType.kind === ts.SyntaxKind.NumberKeyword) {
      let object = node.objectType;
      while (ts.isParenthesizedTypeNode(object)) object = object.type;
      if (ts.isTypeQueryNode(object)) return this.tupleElements(object);
      const element = arrayElementType(this.parse(object));
      if (element !== undefined) return element;
      rejectNode(node, 'PUI1020', 'Numeric indexed access requires a checked array value type.');
    }
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
          if (binding.name === 'StyleHandle' || binding.name === 'StyleTokenHandle')
            return 'style-handle';
          if (
            ['ExposeMethod', 'ExposeValue', 'ExposeEvent'].includes(binding.name) &&
            node.typeArguments?.[0]
          ) {
            const value = this.parse(node.typeArguments[0]);
            return objectValueType([
              {
                name: 'kind',
                type: {
                  kind: 'literal',
                  value:
                    binding.name === 'ExposeMethod'
                      ? 'method'
                      : binding.name === 'ExposeValue'
                        ? 'value'
                        : 'event',
                },
              },
              {
                name:
                  binding.name === 'ExposeMethod'
                    ? 'fn'
                    : binding.name === 'ExposeValue'
                      ? 'value'
                      : 'payload',
                type: value,
                ...(binding.name === 'ExposeEvent' ? { optional: true } : {}),
              },
            ]);
          }
          if (binding.name === 'JsonObject' || binding.name === 'PropsBaseType')
            return { kind: 'object', fields: [], index: 'unknown' };
          if (
            (binding.name === 'StateWatchCallback' || binding.name === 'StateSubscribeCallback') &&
            node.typeArguments?.[0]
          ) {
            const value = this.parse(node.typeArguments[0]);
            const scalar = (['boolean', 'number', 'string'] as const).find((type) =>
              valueAssignable(value, type)
            );
            if (!scalar)
              rejectNode(node, 'PUI1020', 'State callbacks require a proven scalar payload.');
            return {
              kind: 'callable',
              parameters: [
                ...(binding.name === 'StateWatchCallback'
                  ? [{ name: 'run', type: 'run' as const }]
                  : []),
                { name: 'event', type: `state-event:${scalar}` },
              ],
              returnType: 'void',
            };
          }
          if (binding.name === 'CollectionExposes' || binding.name === 'CollectionItemExposes') {
            const method = (result: ValueType): ValueType =>
              objectValueType([
                { name: 'kind', type: { kind: 'literal', value: 'method' } },
                { name: 'fn', type: { kind: 'callable', parameters: [], returnType: result } },
              ]);
            return objectValueType(
              binding.name === 'CollectionExposes'
                ? [
                    { name: 'count', type: 'state:number' },
                    { name: 'getCollectionItems', type: method('collection-snapshot-list') },
                    { name: 'getCollectionCount', type: method('number') },
                  ]
                : [
                    { name: 'collectionIndex', type: 'state:number' },
                    { name: 'collectionTotal', type: 'state:number' },
                    { name: 'collectionFirst', type: 'state:boolean' },
                    { name: 'collectionLast', type: 'state:boolean' },
                    { name: 'getCollectionItem', type: method('collection-snapshot') },
                  ]
            );
          }
          const known = CORE_VALUE_TYPES[binding.name];
          if (known) return known;
          if (
            (binding.name === 'State' ||
              binding.name === 'ExposeState' ||
              binding.name === 'OwnedStateHandle' ||
              binding.name === 'ObservedStateHandle' ||
              binding.name === 'BorrowedStateHandle') &&
            node.typeArguments?.[0]
          ) {
            const value = this.parse(node.typeArguments[0]);
            const primitive = (['boolean', 'number', 'string'] as const).find((candidate) =>
              valueAssignable(value, candidate)
            );
            if (!primitive)
              rejectNode(
                node,
                'PUI1020',
                'Semantic State handles require a proven boolean, number or string payload.'
              );
            if (binding.name === 'State')
              return joinValueTypes([
                `state:${primitive}`,
                `borrowed:${primitive}`,
                `observed:${primitive}`,
              ]);
            return `${binding.name === 'BorrowedStateHandle' ? 'borrowed' : binding.name === 'ObservedStateHandle' ? 'observed' : 'state'}:${primitive}`;
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
        const parser = new ValueTypeParser(
          binding.owner,
          replacements,
          this.active,
          this.origins,
          this.query
        );
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
      if (!binding) {
        const path = ecmaSourcePath(node.typeName);
        const ordinary = path && ecmaNamedType(path);
        if (ordinary) {
          if (node.typeArguments?.length)
            rejectNode(node, 'PUI1020', 'This ECMAScript type does not admit type arguments.');
          return ordinary;
        }
      }
      if (ts.isIdentifier(node.typeName)) {
        const name = node.typeName.text,
          args = node.typeArguments ?? [];
        if (name === 'NonNullable' && args.length === 1) {
          const alternatives = valueAlternatives(this.parse(args[0]));
          if (alternatives.includes('unknown'))
            rejectNode(node, 'PUI1020', 'NonNullable requires a checked value domain.');
          return joinValueTypes(
            alternatives.filter((member) => member !== 'null' && member !== 'void')
          );
        }
        if (name === 'ReturnType' && args.length === 1) {
          if (ts.isTypeQueryNode(args[0])) {
            const path = (name: ts.EntityName): string =>
              ts.isIdentifier(name) ? name.text : `${path(name.left)}.${name.right.text}`;
            const resolved = this.substitutions.get(`ReturnType:${path(args[0].exprName)}`);
            if (resolved !== undefined) return resolved;
          }
          const value = this.parse(args[0]);
          if (typeof value !== 'string' && value.kind === 'callable') return value.returnType;
          rejectNode(node, 'PUI1020', 'ReturnType requires a checked callable declaration.');
        }
        if ((name === 'Extract' || name === 'Exclude') && args.length === 2) {
          const source = this.parse(args[0]),
            constraint = this.parse(args[1]);
          return joinValueTypes(
            valueAlternatives(source).filter(
              (member) => matchesTypeConstraint(member, constraint) === (name === 'Extract')
            )
          );
        }
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
          if (
            name === 'Pick' &&
            typeof type === 'string' &&
            names.every(
              (key) =>
                capabilityMemberType(type, key) !== undefined ||
                eventPayloadMemberType(type, key) !== undefined ||
                Object.values(OPERATION_RULES).some(
                  (rule) => rule.receiver === type && rule.path.split('.')[0] === key
                )
            )
          )
            return type;
          if (!fields) rejectNode(node, 'PUI1020', `${name} requires a record.`);
          return objectValueType(
            fields.filter((field) => names.includes(field.name) === (name === 'Pick'))
          );
        }
        if (name === 'Record' && args.length === 2) {
          const keys = this.parse(args[0]),
            value = this.parse(args[1]);
          if (keys === 'string' && value === 'unknown')
            return { kind: 'object', fields: [], index: 'unknown' };
          if (
            keys === 'string' &&
            typeof value !== 'string' &&
            value.kind === 'union' &&
            !value.members.length
          )
            return { kind: 'record', fields: [] };
          const members = typeof keys !== 'string' && keys.kind === 'union' ? keys.members : [keys];
          const fields = members.map((key) => {
            if (typeof key === 'string' || key.kind !== 'literal' || typeof key.value !== 'string')
              rejectNode(
                node,
                'PUI1020',
                'Record requires finite string keys or an opaque unknown index.'
              );
            return { name: key.value, type: value };
          });
          return objectValueType(fields);
        }
        if ((name === 'Array' || name === 'ReadonlyArray') && args.length === 1) {
          const type = this.parse(args[0]);
          return name === 'ReadonlyArray' && isDataValueType(type)
            ? { kind: 'array', element: type }
            : {
                kind: 'value-array',
                element: type,
                ...(name === 'ReadonlyArray' ? { readonly: true } : {}),
              };
        }
        if (name === 'Set' && args.length === 1)
          return { kind: 'set', element: this.parse(args[0]) };
        if ((name === 'Map' || name === 'ReadonlyMap') && args.length === 2)
          return {
            kind: 'map',
            key: this.parse(args[0]),
            value: this.parse(args[1]),
            ...(name === 'ReadonlyMap' ? { readonly: true } : {}),
          };
      }
    }
    rejectNode(node, 'PUI1020', `Unsupported ordinary value type ${ts.SyntaxKind[node.kind]}.`);
  }

  private tupleElements(query: ts.TypeQueryNode): ValueType {
    const fail = (): never =>
      rejectNode(
        query,
        'PUI1020',
        'Numeric value queries require an immutable module literal tuple declared as const.'
      );
    if (!ts.isIdentifier(query.exprName) || query.typeArguments?.length) return fail();
    // Module resolution cannot stand in for a nearer lexical value declaration.
    const name = query.exprName.text;
    const binds = (binding: ts.BindingName): boolean =>
      ts.isIdentifier(binding)
        ? binding.text === name
        : binding.elements.some(
            (element) => !ts.isOmittedExpression(element) && binds(element.name)
          );
    for (let scope = query.parent; scope && !ts.isSourceFile(scope); scope = scope.parent) {
      if (ts.isFunctionLike(scope) && scope.parameters.some((parameter) => binds(parameter.name)))
        return fail();
      if (ts.isFunctionLike(scope)) {
        let shadowed = false;
        const visit = (node: ts.Node): void => {
          if (ts.isFunctionLike(node) && node !== scope) return;
          if (
            ts.isVariableDeclarationList(node) &&
            !(node.flags & ts.NodeFlags.BlockScoped) &&
            node.declarations.some((declaration) => binds(declaration.name))
          )
            shadowed = true;
          ts.forEachChild(node, visit);
        };
        visit(scope);
        if (shadowed) return fail();
      }
      if (
        ts.isModuleBlock(scope) ||
        ((ts.isClassDeclaration(scope) || ts.isClassExpression(scope)) && scope.name?.text === name)
      )
        return fail();
      if (
        ts.isBlock(scope) &&
        scope.statements.some((statement) =>
          ts.isVariableStatement(statement)
            ? statement.declarationList.declarations.some((declaration) => binds(declaration.name))
            : (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
              statement.name?.text === name
        )
      )
        return fail();
      if (
        ts.isCatchClause(scope) &&
        scope.variableDeclaration &&
        binds(scope.variableDeclaration.name)
      )
        return fail();
      if (
        (ts.isForStatement(scope) || ts.isForInStatement(scope) || ts.isForOfStatement(scope)) &&
        scope.initializer &&
        ts.isVariableDeclarationList(scope.initializer) &&
        scope.initializer.declarations.some((declaration) => binds(declaration.name))
      )
        return fail();
      if (ts.isFunctionExpression(scope) && scope.name?.text === name) return fail();
    }
    const binding = resolveSourceValue(this.owner, query.exprName);
    if (!binding) return fail();
    const declaration = binding.declaration;
    if (
      declaration.type ||
      !declaration.initializer ||
      !ts.isVariableDeclarationList(declaration.parent) ||
      !(declaration.parent.flags & ts.NodeFlags.Const)
    )
      return fail();
    let initializer = declaration.initializer;
    while (ts.isParenthesizedExpression(initializer) || ts.isSatisfiesExpression(initializer))
      initializer = initializer.expression;
    if (
      !ts.isAsExpression(initializer) ||
      !ts.isTypeReferenceNode(initializer.type) ||
      !ts.isIdentifier(initializer.type.typeName) ||
      initializer.type.typeName.text !== 'const' ||
      initializer.type.typeArguments?.length
    )
      return fail();
    initializer = initializer.expression;
    while (ts.isParenthesizedExpression(initializer)) initializer = initializer.expression;
    if (!ts.isArrayLiteralExpression(initializer)) return fail();
    return joinValueTypes(
      initializer.elements.map((element): ValueType => {
        if (ts.isStringLiteral(element)) return { kind: 'literal', value: element.text };
        if (ts.isNumericLiteral(element)) {
          const value = Number(element.text);
          if (!Number.isFinite(value)) return fail();
          return { kind: 'literal', value };
        }
        if (
          element.kind === ts.SyntaxKind.TrueKeyword ||
          element.kind === ts.SyntaxKind.FalseKeyword
        )
          return { kind: 'literal', value: element.kind === ts.SyntaxKind.TrueKeyword };
        if (element.kind === ts.SyntaxKind.NullKeyword) return 'null';
        if (
          ts.isPrefixUnaryExpression(element) &&
          ts.isNumericLiteral(element.operand) &&
          (element.operator === ts.SyntaxKind.MinusToken ||
            element.operator === ts.SyntaxKind.PlusToken)
        ) {
          const value =
            Number(element.operand.text) * (element.operator === ts.SyntaxKind.MinusToken ? -1 : 1);
          if (!Number.isFinite(value)) return fail();
          return { kind: 'literal', value };
        }
        return fail();
      })
    );
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
    const parser = new ValueTypeParser(this.owner, types, this.active, this.origins, this.query);
    const parameters: Pick<ParameterIR, 'name' | 'type' | 'optional' | 'rest'>[] =
      node.parameters.map((parameter) => {
        if (parameter.initializer)
          rejectNode(
            parameter,
            'PUI1020',
            'Callable type signatures cannot contain parameter initializers.'
          );
        if (!ts.isIdentifier(parameter.name) || !parameter.type)
          rejectNode(parameter, 'PUI1020', 'Callable types require named, typed parameters.');
        return {
          name: parameter.name.text,
          type: parser.parse(parameter.type),
          ...(parameter.questionToken ? { optional: true } : {}),
          ...(parameter.dotDotDotToken ? { rest: true } : {}),
        };
      });
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
        type: member.questionToken
          ? joinValueTypes([this.parse(member.type), 'void'])
          : this.parse(member.type),
        ...(member.questionToken ? { optional: true } : {}),
        ...(member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword)
          ? { readonly: true }
          : {}),
      };
    });
    return objectValueType(fields);
  }
}
