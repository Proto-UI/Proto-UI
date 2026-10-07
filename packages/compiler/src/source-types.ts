import ts from 'typescript';
import { dataTypeEqual, type DataType } from './data-types';
import { rejectNode, type SourceModule } from './parser-module';

type RecordType = Extract<DataType, { kind: 'record' }>;
type TypeDeclaration = ts.TypeAliasDeclaration | ts.InterfaceDeclaration;

/** Converts the admitted static TypeScript data subset, without evaluating input source. */
export function parseSourceDataType(module: SourceModule, node: ts.TypeNode): DataType {
  return new SourceTypeParser(module).parse(node);
}

class SourceTypeParser {
  private readonly declarations = new Map<string, TypeDeclaration>();
  private readonly importedNames = new Set<string>();
  private readonly active = new Set<TypeDeclaration>();

  constructor(module: SourceModule) {
    for (const statement of module.file.statements) {
      if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
        if (this.declarations.has(statement.name.text))
          rejectNode(
            statement.name,
            'PUI1020',
            'Merged or duplicate data type declarations are unsupported.'
          );
        this.declarations.set(statement.name.text, statement);
      } else if (ts.isImportDeclaration(statement) && statement.importClause) {
        const clause = statement.importClause;
        if (clause.name) this.importedNames.add(clause.name.text);
        if (clause.namedBindings) {
          if (ts.isNamespaceImport(clause.namedBindings))
            this.importedNames.add(clause.namedBindings.name.text);
          else
            for (const binding of clause.namedBindings.elements)
              this.importedNames.add(binding.name.text);
        }
      }
    }
  }

  parse(node: ts.TypeNode): DataType {
    switch (node.kind) {
      case ts.SyntaxKind.BooleanKeyword:
        return 'boolean';
      case ts.SyntaxKind.NumberKeyword:
        return 'number';
      case ts.SyntaxKind.StringKeyword:
        return 'string';
      case ts.SyntaxKind.VoidKeyword:
        return 'void';
    }
    if (ts.isParenthesizedTypeNode(node)) return this.parse(node.type);
    if (ts.isTypeLiteralNode(node)) return this.record(node.members);
    if (ts.isArrayTypeNode(node)) return this.array(this.parse(node.elementType), node.elementType);
    if (ts.isUnionTypeNode(node)) {
      const members: DataType[] = [];
      for (const type of node.types) {
        const parsed = this.parse(type);
        this.requireJson(parsed, type);
        const additions =
          typeof parsed !== 'string' && parsed.kind === 'union' ? parsed.members : [parsed];
        for (const member of additions)
          if (!members.some((existing) => dataTypeEqual(existing, member))) members.push(member);
      }
      return members.length === 1 ? members[0] : { kind: 'union', members };
    }
    if (ts.isIntersectionTypeNode(node))
      return this.mergeRecords(node.types.map((type) => ({ type: this.parse(type), node: type })));
    if (ts.isLiteralTypeNode(node)) {
      const literal = node.literal;
      if (literal.kind === ts.SyntaxKind.NullKeyword) return 'null';
      if (literal.kind === ts.SyntaxKind.TrueKeyword) return { kind: 'literal', value: true };
      if (literal.kind === ts.SyntaxKind.FalseKeyword) return { kind: 'literal', value: false };
      if (ts.isStringLiteral(literal)) return { kind: 'literal', value: literal.text };
      if (ts.isNumericLiteral(literal)) return this.numberLiteral(Number(literal.text), literal);
      if (
        ts.isPrefixUnaryExpression(literal) &&
        literal.operator === ts.SyntaxKind.MinusToken &&
        ts.isNumericLiteral(literal.operand)
      )
        return this.numberLiteral(-Number(literal.operand.text), literal);
      rejectNode(literal, 'PUI1020', 'Only finite JSON primitive literal types are admitted.');
    }
    if (ts.isTypeReferenceNode(node))
      return this.reference(node.typeName, node.typeArguments, node);
    if (
      ts.isTypeOperatorNode(node) &&
      node.operator === ts.SyntaxKind.ReadonlyKeyword &&
      ts.isArrayTypeNode(node.type)
    )
      return this.parse(node.type);
    return rejectNode(
      node,
      'PUI1020',
      'Unsupported data type; use static JSON records, arrays, primitives or unions.'
    );
  }

  private reference(
    name: ts.Node,
    args: readonly ts.TypeNode[] | undefined,
    node: ts.Node
  ): DataType {
    if (!ts.isIdentifier(name))
      rejectNode(name, 'PUI1020', 'Qualified or imported data types are unsupported.');
    const declaration = this.declarations.get(name.text);
    if (declaration) {
      if (this.importedNames.has(name.text))
        rejectNode(
          node,
          'PUI1020',
          'A local data declaration cannot shadow an imported type binding.'
        );
      if (args?.length || declaration.typeParameters?.length)
        rejectNode(node, 'PUI1020', 'Generic local data types are unsupported.');
      if (this.active.has(declaration))
        rejectNode(
          node,
          'PUI1020',
          'Recursive data types cannot be represented by the finite compiler schema.'
        );
      this.active.add(declaration);
      try {
        if (ts.isTypeAliasDeclaration(declaration)) return this.parse(declaration.type);
        const inherited =
          declaration.heritageClauses?.flatMap((clause) => {
            if (clause.token !== ts.SyntaxKind.ExtendsKeyword)
              rejectNode(clause, 'PUI1020', 'Only static interface inheritance is admitted.');
            return clause.types.map((base) => ({
              type: this.reference(base.expression, base.typeArguments, base),
              node: base,
            }));
          }) ?? [];
        return this.mergeRecords([
          ...inherited,
          { type: this.record(declaration.members), node: declaration },
        ]);
      } finally {
        this.active.delete(declaration);
      }
    }
    if (
      !this.importedNames.has(name.text) &&
      (name.text === 'Array' || name.text === 'ReadonlyArray') &&
      args?.length === 1
    )
      return this.array(this.parse(args[0]), args[0]);
    if (!this.importedNames.has(name.text) && name.text === 'Readonly' && args?.length === 1)
      return this.parse(args[0]);
    return rejectNode(
      node,
      'PUI1020',
      `Data type ${name.text} must resolve to a supported local declaration.`
    );
  }

  private record(members: readonly ts.TypeElement[]): RecordType {
    const fields: RecordType['fields'][number][] = [];
    const names = new Set<string>();
    for (const member of members) {
      if (!ts.isPropertySignature(member) || !member.type)
        rejectNode(
          member,
          'PUI1020',
          'JSON records require explicitly typed properties, not methods or index signatures.'
        );
      if (!ts.isIdentifier(member.name) && !ts.isStringLiteral(member.name))
        rejectNode(
          member.name,
          'PUI1020',
          'Computed or numeric data property names are unsupported.'
        );
      const name = member.name.text;
      if (names.has(name)) rejectNode(member.name, 'PUI1020', `Duplicate data field ${name}.`);
      names.add(name);
      const type = this.parse(member.type);
      this.requireJson(type, member.type);
      fields.push({ name, type, ...(member.questionToken ? { optional: true } : {}) });
    }
    return { kind: 'record', fields };
  }

  private mergeRecords(parts: readonly { type: DataType; node: ts.Node }[]): RecordType {
    const fields: RecordType['fields'][number][] = [];
    for (const part of parts) {
      if (typeof part.type === 'string' || part.type.kind !== 'record')
        rejectNode(
          part.node,
          'PUI1020',
          'Data intersections and interface bases must be record shapes.'
        );
      for (const field of part.type.fields) {
        const existing = fields.find((candidate) => candidate.name === field.name);
        if (existing) {
          if (
            !dataTypeEqual(existing.type, field.type) ||
            Boolean(existing.optional) !== Boolean(field.optional)
          )
            rejectNode(part.node, 'PUI1020', `Conflicting inherited data field ${field.name}.`);
        } else fields.push(field);
      }
    }
    return { kind: 'record', fields };
  }

  private array(element: DataType, node: ts.Node): DataType {
    this.requireJson(element, node);
    return { kind: 'array', element };
  }

  private requireJson(type: DataType, node: ts.Node): void {
    if (type === 'void') rejectNode(node, 'PUI1020', 'Void is not a JSON data value.');
  }

  private numberLiteral(value: number, node: ts.Node): DataType {
    if (!Number.isFinite(value))
      rejectNode(node, 'PUI1020', 'JSON numeric literals must be finite.');
    return { kind: 'literal', value };
  }
}
