import ts from 'typescript';
import {
  lookupDataType,
  type DataRef,
  type DataType,
  type ScalarType,
  type ValueType,
} from '../component-ir.ts';
import {
  atSource,
  call,
  constDecl,
  declaration,
  f,
  id,
  member,
  object,
  param,
  property,
  signature,
  str,
  typeRef,
  valueType,
} from './ast.ts';
import type { ReactProgram } from './program.ts';

const guards: Record<ScalarType, string> = {
  bool: 'readBool',
  number: 'readNumber',
  text: 'readText',
  unit: 'readUnit',
  tokens: 'readTokens',
};
const strictEqual = (a: ts.Expression, b: ts.Expression) =>
  f.createBinaryExpression(a, ts.SyntaxKind.EqualsEqualsEqualsToken, b);
const and = (a: ts.Expression, b: ts.Expression) =>
  f.createBinaryExpression(a, ts.SyntaxKind.AmpersandAmpersandToken, b);
export function isData(type: ValueType): type is DataRef {
  return type.startsWith('data:');
}
export function needsSnapshot(type: ValueType): boolean {
  return type === 'tokens' || isData(type);
}

interface UsedType {
  alias: string;
  reader: string;
  equality: string;
  sameness: string;
  used: boolean;
  read: boolean;
  equal: boolean;
  same: boolean;
}

/** Only emitted declaration names live here. Generated guards and comparisons
 * have one statically typed expression per authored field and carry no schema. */
export class ReactData {
  readonly #program: ReactProgram;
  readonly #used = new Map<DataRef, UsedType>();

  constructor(program: ReactProgram) {
    this.#program = program;
    // Reserve module bindings before any authored parameters or block locals can
    // shadow them. Only operations reached below acquire emitted declarations.
    for (let index = 0; index < program.ir.types.length; index++) {
      const alias = program.names.take(`Data${index}`);
      this.#used.set(`data:${index}`, {
        alias,
        reader: program.names.take(`read${alias}`),
        equality: program.names.take(`equal${alias}`),
        sameness: program.names.take(`same${alias}`),
        used: false,
        read: false,
        equal: false,
        same: false,
      });
    }
  }

  definition(type: DataRef): DataType {
    return lookupDataType(this.#program.ir.types, type)!;
  }

  presence(type: ValueType): ValueType | undefined {
    if (!isData(type)) return undefined;
    const def = this.definition(type);
    return def.kind === 'presence' ? def.value : undefined;
  }

  #binding(type: DataRef): UsedType {
    const names = this.#used.get(type)!;
    names.used = true;
    return names;
  }

  type(type: ValueType): ts.TypeNode {
    return isData(type) ? typeRef(this.#binding(type).alias) : valueType(type);
  }

  read(type: ValueType, value: ts.Expression, origin: ts.Expression): ts.Expression {
    if (!isData(type)) return call(this.#program.use(guards[type]), value, origin);
    const names = this.#binding(type);
    names.read = true;
    return call(id(names.reader), value, origin);
  }

  compare(
    type: ValueType,
    left: ts.Expression,
    right: ts.Expression,
    commit: boolean
  ): ts.Expression {
    if (type === 'tokens') return call(this.#program.use('sameTokens'), left, right);
    if (!isData(type))
      return type === 'number' && commit
        ? call(member(id('Object'), 'is'), left, right)
        : strictEqual(left, right);
    const names = this.#binding(type);
    if (commit) names.same = true;
    else names.equal = true;
    return call(id(commit ? names.sameness : names.equality), left, right);
  }

  #reader(ref: DataRef, name: string): ts.Statement {
    const def = this.definition(ref);
    const program = this.#program;
    const input = id('$value'),
      origin = id('$origin'),
      record = id('$record');
    const statements: ts.Statement[] = [
      constDecl('$record', call(program.use('readObject'), input, origin)),
    ];
    const readField = (name: string, type: ValueType) => {
      const located = f.createBinaryExpression(
        origin,
        ts.SyntaxKind.PlusToken,
        str(`[${JSON.stringify(name)}]`)
      );
      return this.read(type, call(program.use('ownMember'), record, str(name), origin), located);
    };
    if (def.kind === 'record') {
      const members = def.fields.map((field) =>
        atSource(property(field.name, readField(field.name, field.type)), field.source)
      );
      statements.push(
        f.createReturnStatement(call(member(id('Object'), 'freeze'), object(members)))
      );
    } else {
      statements.push(
        constDecl('$kind', call(program.use('ownMember'), record, str('kind'), origin))
      );
      statements.push(
        f.createIfStatement(
          strictEqual(id('$kind'), str('omitted')),
          f.createReturnStatement(program.use('omittedInput'))
        )
      );
      statements.push(
        f.createIfStatement(
          strictEqual(id('$kind'), str('present')),
          f.createReturnStatement(call(program.use('presentInput'), readField('value', def.value)))
        )
      );
      statements.push(
        f.createThrowStatement(
          f.createNewExpression(program.use('HostValueError'), undefined, [
            str('a present or omitted input value'),
            origin,
          ])
        )
      );
    }
    return atSource(
      declaration(
        name,
        [
          param('$value', f.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword)),
          param('$origin', valueType('text')),
        ],
        this.type(ref),
        statements
      ),
      def.source
    );
  }

  #comparison(ref: DataRef, name: string, commit: boolean): ts.Statement {
    const left = id('$left'),
      right = id('$right');
    const def = this.definition(ref);
    let result: ts.Expression;
    if (def.kind === 'record') {
      const fields = def.fields.map((field) =>
        this.compare(field.type, member(left, field.name), member(right, field.name), commit)
      );
      result = fields.length ? fields.reduce(and) : f.createTrue();
    } else {
      const omitted = (side: ts.Expression) => strictEqual(member(side, 'kind'), str('omitted'));
      const present = strictEqual(member(right, 'kind'), str('present'));
      const payload = this.compare(
        def.value,
        member(left, 'value'),
        member(right, 'value'),
        commit
      );
      result = f.createConditionalExpression(
        omitted(left),
        undefined,
        omitted(right),
        undefined,
        and(present, payload)
      );
    }
    return atSource(
      declaration(
        name,
        [param('$left', this.type(ref)), param('$right', this.type(ref))],
        valueType('bool'),
        [f.createReturnStatement(result)]
      ),
      def.source
    );
  }

  declarations(): ts.Statement[] {
    const groups: ts.Statement[][] = [];
    // Declaration members only reference earlier entries. Lowering a reader or
    // comparator can require one of those earlier helpers as well.
    for (let index = this.#program.ir.types.length - 1; index >= 0; index--) {
      const ref: DataRef = `data:${index}`;
      const names = this.#used.get(ref);
      if (!names?.used) continue;
      const def = this.definition(ref);
      const type =
        def.kind === 'presence'
          ? this.#program.useType('InputPresence', this.type(def.value))
          : f.createTypeLiteralNode(
              def.fields.map((field) =>
                atSource(signature(field.name, this.type(field.type)), field.source)
              )
            );
      const group: ts.Statement[] = [
        atSource(f.createTypeAliasDeclaration(undefined, names.alias, undefined, type), def.source),
      ];
      if (names.read) group.push(this.#reader(ref, names.reader));
      if (names.equal) group.push(this.#comparison(ref, names.equality, false));
      if (names.same) group.push(this.#comparison(ref, names.sameness, true));
      groups.push(group);
    }
    return groups.reverse().flat();
  }
}
