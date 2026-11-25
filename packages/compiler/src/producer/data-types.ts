import ts from 'typescript';
import {
  lookupDataType,
  type DataField,
  type DataRef,
  type DataType,
  type ScalarType,
  type SourceSpan,
  type ValueType,
} from '../targets/component-ir.ts';

export interface SourceData {
  readonly entries: readonly DataType[];
  type(node: ts.Node, type?: ts.Type): ValueType;
  presence(value: ValueType, node: ts.Node): DataRef;
  record(fields: readonly DataField[], node: ts.Node): DataRef;
  get(type: ValueType): DataType | undefined;
}

type FieldDeclaration =
  | ts.PropertySignature
  | ts.PropertyAssignment
  | ts.ShorthandPropertyAssignment;

function dataField(node: ts.Node): node is FieldDeclaration {
  return (
    ts.isPropertySignature(node) ||
    ts.isPropertyAssignment(node) ||
    ts.isShorthandPropertyAssignment(node)
  );
}

function staticName(node: ts.PropertyName): boolean {
  if (ts.isComputedPropertyName(node)) {
    let key = node.expression;
    while (ts.isParenthesizedExpression(key)) key = key.expression;
    return ts.isStringLiteralLike(key) || ts.isNumericLiteral(key);
  }
  return ts.isIdentifier(node) || ts.isStringLiteralLike(node) || ts.isNumericLiteral(node);
}

function compareNames(left: { readonly name: string }, right: { readonly name: string }): number {
  return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
}

export function createSourceData(
  checker: ts.TypeChecker,
  authoring: ReadonlyMap<string, ts.Symbol>,
  primitives: ts.SourceFile | undefined,
  span: (node: ts.Node) => SourceSpan,
  missing: (node: ts.Node, capability: string, message: string) => never
): SourceData {
  const entries: DataType[] = [];
  const interned = new Map<string, DataRef>();
  const checked = new Map<ts.Type, ValueType>();
  const active = new Set<ts.Type>();
  const expanding = new Map<ts.Node, ts.Type>();
  const tokenSymbol = authoring.get('StyleTokens');
  const presenceSymbol = authoring.get('Presence');
  const presenceDeclaration = presenceSymbol?.declarations?.find(ts.isTypeAliasDeclaration);
  const prelude = presenceDeclaration?.getSourceFile();
  const readValue = prelude?.statements.find(
    (statement): statement is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(statement) && statement.name.text === 'ReadValue'
  );
  const readonlyProjection =
    readValue &&
    ts.forEachChild(readValue.type, function visit(node): ts.MappedTypeNode | undefined {
      return ts.isMappedTypeNode(node) ? node : ts.forEachChild(node, visit);
    });

  function requireEarlier(type: ValueType, node: ts.Node): void {
    if (type.startsWith('data:') && !lookupDataType(entries, type)) {
      missing(
        node,
        'producer/data-reference',
        `The composite field refers to an unregistered type ${type}.`
      );
    }
  }

  function intern(key: string, definition: DataType): DataRef {
    const existing = interned.get(key);
    if (existing !== undefined) return existing;
    const ref: DataRef = `data:${entries.length}`;
    entries.push(definition);
    interned.set(key, ref);
    return ref;
  }

  function presence(value: ValueType, node: ts.Node): DataRef {
    requireEarlier(value, node);
    return intern(JSON.stringify(['presence', value]), {
      kind: 'presence',
      value,
      source: span(node),
    });
  }

  function record(fields: readonly DataField[], node: ts.Node): DataRef {
    const sorted = [...fields].sort(compareNames);
    for (const [index, field] of sorted.entries()) {
      requireEarlier(field.type, node);
      if (index && sorted[index - 1]!.name === field.name) {
        missing(
          node,
          'producer/record-field',
          `The record contains duplicate field ${JSON.stringify(field.name)}.`
        );
      }
    }
    const shape = sorted.map(({ name, type }) => [name, type]);
    return intern(JSON.stringify(['record', shape]), {
      kind: 'record',
      fields: sorted,
      source: span(node),
    });
  }

  function scalar(type: ts.Type): ScalarType | undefined {
    if (type.flags & ts.TypeFlags.EnumLike) return undefined;
    if (type.flags & ts.TypeFlags.BooleanLike) return 'bool';
    if (type.flags & ts.TypeFlags.NumberLike) return 'number';
    if (type.flags & ts.TypeFlags.StringLike) return 'text';
    if (type.flags & ts.TypeFlags.Void) return 'unit';
    if (tokenSymbol && (type.getSymbol() === tokenSymbol || type.aliasSymbol === tokenSymbol))
      return 'tokens';
    if (type.isUnion()) {
      const domain = scalar(type.types[0]!);
      if (domain && type.types.slice(1).every((part) => scalar(part) === domain)) return domain;
    }
    return undefined;
  }

  // An authored type alias may replace the outer alias symbol while retaining
  // the two original branch types. A remapping of their fields is a new type.
  function presencePayload(type: ts.UnionType, node: ts.Node): ts.Type | undefined {
    if (
      presenceSymbol &&
      type.aliasSymbol === presenceSymbol &&
      type.aliasTypeArguments?.length === 1
    ) {
      return type.aliasTypeArguments[0];
    }
    if (!presenceDeclaration || type.types.length !== 2) return undefined;
    let omitted = false;
    let payload: ts.Type | undefined;
    for (const arm of type.types) {
      const declarations = arm.getSymbol()?.declarations;
      if (
        !declarations?.length ||
        !declarations.every(
          (decl) =>
            ts.isTypeLiteralNode(decl) &&
            ts.isUnionTypeNode(decl.parent) &&
            decl.parent.parent === presenceDeclaration
        )
      )
        return undefined;
      if (
        arm.isIntersection() ||
        arm.getCallSignatures().length ||
        arm.getConstructSignatures().length ||
        checker.getIndexInfosOfType(arm).length
      )
        return undefined;
      const tag = arm.getProperty('kind');
      if (!tag || tag.flags & ts.SymbolFlags.Optional) return undefined;
      const discriminator = checker.getTypeOfSymbolAtLocation(tag, node);
      if (!discriminator.isStringLiteral()) return undefined;
      const count = arm.getProperties().length;
      if (discriminator.value === 'omitted' && count === 1) omitted = true;
      else if (discriminator.value === 'present' && count === 2) {
        const field = arm.getProperty('value');
        if (!field || field.flags & ts.SymbolFlags.Optional) return undefined;
        payload = checker.getTypeOfSymbolAtLocation(field, node);
      } else return undefined;
    }
    return omitted ? payload : undefined;
  }

  function fieldDeclaration(property: ts.Symbol, node: ts.Node): FieldDeclaration {
    const declarations =
      property.declarations ??
      checker.getRootSymbols(property).flatMap((root) => root.declarations ?? []);
    const declaration = declarations[0];
    if (
      property.flags & ts.SymbolFlags.Optional ||
      !declaration ||
      !dataField(declaration) ||
      declarations.some(
        (decl) =>
          !dataField(decl) ||
          !staticName(decl.name) ||
          (ts.isPropertySignature(decl) && decl.questionToken !== undefined) ||
          decl.getSourceFile() === prelude ||
          decl.getSourceFile() === primitives
      )
    ) {
      return missing(
        declaration ?? node,
        'producer/record-field',
        `Representing ${JSON.stringify(property.name)} requires a concrete, required source data field with a static key.`
      );
    }
    return declaration;
  }

  function recordType(type: ts.Type, node: ts.Node): DataRef {
    const declarations = type.getSymbol()?.declarations;
    if (
      !(type.flags & ts.TypeFlags.Object) ||
      type.isClass() ||
      !declarations?.length ||
      type.getCallSignatures().length ||
      type.getConstructSignatures().length ||
      checker.getIndexInfosOfType(type).length ||
      checker.isArrayType(type) ||
      checker.isTupleType(type)
    ) {
      return missing(
        node,
        'producer/value-type',
        `The checked type ${checker.typeToString(type)} has no closed source record layout.`
      );
    }
    for (const declaration of declarations) {
      if (declaration === readonlyProjection) continue;
      if (
        declaration.getSourceFile() === prelude ||
        declaration.getSourceFile() === primitives ||
        !(
          ts.isTypeLiteralNode(declaration) ||
          ts.isInterfaceDeclaration(declaration) ||
          ts.isObjectLiteralExpression(declaration)
        )
      ) {
        return missing(
          node,
          'producer/record-origin',
          'This object type has no checked source record declaration or construction.'
        );
      }
      const members = ts.isObjectLiteralExpression(declaration)
        ? declaration.properties
        : declaration.members;
      for (const member of members) {
        if (
          !dataField(member) ||
          !staticName(member.name) ||
          (ts.isPropertySignature(member) && member.questionToken)
        ) {
          return missing(
            member,
            'producer/record-field',
            'A closed record needs required data fields with static keys.'
          );
        }
        if (
          (ts.isShorthandPropertyAssignment(member) && member.objectAssignmentInitializer) ||
          (ts.isPropertyAssignment(member) &&
            !ts.isComputedPropertyName(member.name) &&
            member.name.text === '__proto__')
        ) {
          return missing(
            member,
            'producer/record-field',
            'This initializer does not declare an ordinary own data field.'
          );
        }
      }
    }
    const properties = [...type.getProperties()].sort(compareNames);
    if (!properties.length && declarations.every((decl) => decl === readonlyProjection)) {
      return missing(
        node,
        'producer/record-origin',
        'An empty readonly projection needs its original source record layout.'
      );
    }
    const fields = properties.map((property): DataField => {
      const field = fieldDeclaration(property, node);
      const fieldType = checker.getTypeOfSymbolAtLocation(property, node);
      const fieldNode = ts.isPropertySignature(field) && field.type ? field.type : field;
      return { name: property.name, type: lower(fieldNode, fieldType), source: span(field) };
    });
    return record(fields, node);
  }

  function argumentsOf(type: ts.Type): readonly ts.Type[] {
    if (type.aliasTypeArguments?.length) return type.aliasTypeArguments;
    if (
      type.flags & ts.TypeFlags.Object &&
      (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference
    ) {
      return checker.getTypeArguments(type as ts.TypeReference);
    }
    return [];
  }

  // A repeated generic field can consume a finite nested argument, e.g. Box<Box<T>>.
  // Expanding a fresh specialization at the same field cannot establish a finite layout.
  function nestedArgument(parent: ts.Type, child: ts.Type): boolean {
    const pending = [...argumentsOf(parent)];
    const seen = new Set<ts.Type>();
    for (let i = 0; i < pending.length; i++) {
      const argument = pending[i]!;
      if (argument === child) return true;
      if (!seen.has(argument)) {
        seen.add(argument);
        pending.push(...argumentsOf(argument));
      }
    }
    return false;
  }

  function lower(
    node: ts.Node,
    type = checker.getTypeAtLocation(node),
    presenceParent?: ts.Type
  ): ValueType {
    const cached = checked.get(type);
    if (cached !== undefined) return cached;
    const simple = scalar(type);
    if (simple !== undefined) return simple;
    const prior = expanding.get(node);
    // The declared Presence proves its immediate record payload. Further record
    // recursion passes through independently checked source fields.
    const recordPayload = presenceParent === prior && !type.isUnion();
    if (active.has(type) || (prior && !recordPayload && !nestedArgument(prior, type))) {
      return missing(
        node,
        'producer/recursive-data',
        'This repeated source type needs a finite, acyclic composite layout.'
      );
    }
    active.add(type);
    expanding.set(node, type);
    try {
      let result: ValueType;
      if (type.isUnion()) {
        const payload = presencePayload(type, node);
        if (!payload) {
          return missing(
            node,
            'producer/value-type',
            `The checked union ${checker.typeToString(type)} needs a declared data representation.`
          );
        }
        const argument =
          ts.isTypeReferenceNode(node) && node.typeArguments?.length === 1
            ? node.typeArguments[0]!
            : node;
        result = presence(lower(argument, payload, type), node);
      } else {
        result = recordType(type, node);
      }
      checked.set(type, result);
      return result;
    } finally {
      active.delete(type);
      if (prior) expanding.set(node, prior);
      else expanding.delete(node);
    }
  }

  return { entries, type: lower, presence, record, get: (type) => lookupDataType(entries, type) };
}
