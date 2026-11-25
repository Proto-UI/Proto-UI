import ts from 'typescript';
import type { Binding } from '../component-ir.ts';
import {
  atSource,
  call,
  constDecl,
  declaration,
  f,
  id,
  key,
  member,
  object,
  param,
  property,
  signature,
  str,
  typeRef,
  valueType,
} from './ast.ts';
import { invoke } from './behavior.ts';
import type { ReactProgram } from './program.ts';

export function publicParameters(
  program: ReactProgram,
  bindings: readonly Binding[]
): ts.ParameterDeclaration[] {
  const names = program.names.scope();
  return bindings.map((binding) => param(names.take(binding.name), valueType(binding.type)));
}

export function publicSurface(program: ReactProgram): ts.Statement[] {
  const { ir } = program;
  const statements: ts.Statement[] = [];
  const props = ir.props.map((p) =>
    atSource(signature(p.name, valueType(p.type), p.default !== undefined), p.source)
  );
  for (const signal of ir.signals) {
    const callback = f.createFunctionTypeNode(
      undefined,
      [param('value', valueType(signal.type))],
      valueType('unit')
    );
    props.push(
      atSource(signature(program.callbacks.get(signal.id)!, callback, true), signal.source)
    );
  }
  if (ir.projections.length) {
    const projected = ir.projections.map(({ name, fn }) => {
      const { binding } = program.functions.get(fn)!.fn;
      return atSource(signature(name, valueType(binding.type)), binding.source);
    });
    statements.push(
      f.createInterfaceDeclaration(
        undefined,
        program.projectionType,
        undefined,
        undefined,
        projected
      )
    );
    const appearance = f.createFunctionTypeNode(
      undefined,
      [param('projection', typeRef(program.projectionType))],
      program.useType('CSSProperties')
    );
    props.push(signature('appearance', appearance, true));
  }
  if (program.hasHandle)
    props.push(signature('ref', program.useType('Ref', typeRef(program.handleType)), true));
  statements.push(
    f.createInterfaceDeclaration(undefined, program.propsType, undefined, undefined, props)
  );
  if (program.hasHandle) {
    const extendsProjection = ir.projections.length
      ? [
          f.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
            f.createExpressionWithTypeArguments(id(program.projectionType), undefined),
          ]),
        ]
      : undefined;
    const actions = ir.actions.map(({ name, fn }) => {
      const behavior = program.functions.get(fn)!.fn;
      const actionType = f.createFunctionTypeNode(
        undefined,
        publicParameters(program, behavior.params),
        program.useType('ActionDispatch')
      );
      return atSource(signature(name, actionType), behavior.binding.source);
    });
    statements.push(
      f.createInterfaceDeclaration(
        undefined,
        program.handleType,
        undefined,
        extendsProjection,
        actions
      )
    );
  }
  return statements;
}

export function hasInputs(program: ReactProgram): boolean {
  return program.ir.props.length + program.ir.signals.length > 0;
}

/** Snapshot host primitives once on entry. A published handle never reads mutable host getters. */
export function inputReader(program: ReactProgram): ts.Statement[] {
  if (!program.hasOwner) return [];
  const statements: ts.Statement[] = [];
  let inputType: ts.TypeNode = f.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword);
  if (hasInputs(program)) {
    const items = program.ir.props.map((p) => property(p.name, program.readProp(p, id('$props'))));
    for (const signal of program.ir.signals) {
      const { file, start, end } = signal.source;
      const name = program.callbacks.get(signal.id)!;
      items.push(
        property(
          name,
          call(
            program.use('readCallback'),
            member(id('$props'), name),
            str(`${file}:${start}-${end} (${name})`)
          )
        )
      );
    }
    statements.push(
      declaration(program.readInputs, [param('$props', typeRef(program.propsType))], undefined, [
        f.createReturnStatement(object(items)),
      ])
    );
    inputType = typeRef('ReturnType', f.createTypeQueryNode(id(program.readInputs)));
  }
  if (program.dispatchers.size)
    statements.push(
      f.createTypeAliasDeclaration(undefined, program.inputsType, undefined, inputType)
    );
  for (const signal of program.ir.signals) {
    const listener = program.listeners.get(signal.id);
    if (listener === undefined) continue;
    const callback = member(id('$inputs'), program.callbacks.get(signal.id)!);
    const getListener = declaration(
      listener,
      [param('$inputs', typeRef(program.inputsType))],
      undefined,
      [f.createReturnStatement(callback)]
    );
    statements.push(atSource(getListener, signal.source));
  }
  return statements;
}

export function initializerProps(program: ReactProgram): Binding[] {
  const props = new Set<string>();
  for (const { init } of program.ir.fields) {
    for (const binding of program.functions.get(init)!.captures)
      if (program.props.has(binding)) props.add(binding);
  }
  return Array.from(props, (binding) => program.props.get(binding)!);
}

export function fieldStorage(program: ReactProgram): ts.Statement[] {
  if (!program.ir.fields.length) return [];
  const { fields } = program.ir;
  const names = program.names.scope();
  const available = new Map<string, string>();
  const parameters = initializerProps(program).map((binding) => {
    const name = names.take(binding.name);
    available.set(binding.id, name);
    return param(name, valueType(binding.type));
  });
  const members: ts.TypeElement[] = [];
  const initializers: ts.Statement[] = [];
  const values: ts.PropertyAssignment[] = [];
  for (const { binding, init } of fields) {
    const field = program.fieldKeys.get(binding.id)!;
    members.push(
      program.written.has(binding.id)
        ? f.createPropertySignature(undefined, key(field), undefined, valueType(binding.type))
        : signature(field, valueType(binding.type))
    );
    const name = names.take(binding.name);
    const value = invoke(program.functions.get(init)!, [], {
      read: (dep) => id(available.get(dep)!),
    });
    initializers.push(atSource(constDecl(name, value), binding.source));
    available.set(binding.id, name);
    values.push(property(field, id(name)));
  }
  initializers.push(f.createReturnStatement(object(values)));
  const statements: ts.Statement[] = [
    f.createInterfaceDeclaration(undefined, program.fieldsType, undefined, undefined, members),
    declaration(program.initFields, parameters, typeRef(program.fieldsType), initializers),
  ];
  if (program.written.size) {
    const comparisons: ts.Expression[] = Array.from(program.written, (dep) => {
      const field = program.fieldKeys.get(dep)!;
      const equal =
        program.fields.get(dep)!.type === 'tokens'
          ? program.use('sameTokens')
          : member(id('Object'), 'is');
      return call(equal, member(id('$before'), field), member(id('$after'), field));
    });
    const same = comparisons.reduce((lhs, rhs) =>
      f.createBinaryExpression(lhs, ts.SyntaxKind.AmpersandAmpersandToken, rhs)
    );
    statements.push(
      declaration(
        program.sameFields,
        [
          param('$before', typeRef(program.fieldsType)),
          param('$after', typeRef(program.fieldsType)),
        ],
        valueType('bool'),
        [f.createReturnStatement(same)]
      )
    );
  }
  return statements;
}
