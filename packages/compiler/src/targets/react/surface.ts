import ts from 'typescript';
import type { Binding } from '../component-ir.ts';
import { atSource, call, constDecl, declaration, f, id, key, member, object, param, property, signature, str, typeRef, valueType } from './ast.ts';
import { invoke } from './behavior.ts';
import { origin, type ReactProgram } from './program.ts';

export function publicParameters(program: ReactProgram, bindings: readonly Binding[]): ts.ParameterDeclaration[] {
  const names = program.names.scope();
  return bindings.map((binding) => param(names.take(binding.name), program.data.type(binding.type)));
}

export function publicSurface(program: ReactProgram): ts.Statement[] {
  const { ir } = program;
  const statements: ts.Statement[] = [];
  const props = ir.props.map((p) => {
    const payload = program.data.presence(p.type);
    return atSource(signature(p.name, program.data.type(payload ?? p.type), payload !== undefined || p.default !== undefined), p.source);
  });
  for (const signal of ir.signals) {
    const callback = f.createFunctionTypeNode(undefined, [param('value', program.data.type(signal.type))], valueType('unit'));
    props.push(atSource(signature(program.callbacks.get(signal.id)!, callback, true), signal.source));
  }
  if (ir.projections.length) {
    const projected = ir.projections.map(({ name, fn }) => {
      const { binding } = program.functions.get(fn)!.fn;
      return atSource(signature(name, program.data.type(binding.type)), binding.source);
    });
    statements.push(f.createInterfaceDeclaration(undefined, program.projectionType, undefined, undefined, projected));
    const appearance = f.createFunctionTypeNode(undefined, [param('projection', typeRef(program.projectionType))], program.useType('CSSProperties'));
    props.push(signature('appearance', appearance, true));
  }
  if (program.hasHandle) props.push(signature('ref', program.useType('Ref', typeRef(program.handleType)), true));
  statements.push(f.createInterfaceDeclaration(undefined, program.propsType, undefined, undefined, props));
  if (program.hasHandle) {
    const extendsProjection = ir.projections.length ? [f.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [f.createExpressionWithTypeArguments(id(program.projectionType), undefined)])] : undefined;
    const actions = ir.actions.map(({ name, fn }) => {
      const behavior = program.functions.get(fn)!.fn;
      const actionType = f.createFunctionTypeNode(undefined, publicParameters(program, behavior.params), program.useType('ActionDispatch'));
      return atSource(signature(name, actionType), behavior.binding.source);
    });
    statements.push(f.createInterfaceDeclaration(undefined, program.handleType, undefined, extendsProjection, actions));
  }
  return statements;
}

export function hasInputs(program: ReactProgram): boolean {
  return program.ir.props.length + program.ir.signals.length > 0;
}

export function appearanceInput(program: ReactProgram): ts.Expression {
  const { file, start, end } = program.ir.source;
  return call(program.use('readCallback'), member(id('$props'), 'appearance'), str(`${file}:${start}-${end} (appearance)`));
}

/** Snapshot host values once on entry. A published handle never reads mutable host getters. */
export function inputReader(program: ReactProgram): ts.Statement[] {
  if (!program.groupsInputs) return [];
  const statements: ts.Statement[] = [];
  let hostType: ts.TypeNode = f.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword);
  if (hasInputs(program)) {
    const items = program.ir.props.map((p) => property(p.name, program.readProp(p, id('$props'))));
    for (const signal of program.ir.signals) {
      const { file, start, end } = signal.source;
      const name = program.callbacks.get(signal.id)!;
      items.push(property(name, call(program.use('readCallback'), member(id('$props'), name), str(`${file}:${start}-${end} (${name})`))));
    }
    if (program.fixed.length && program.ir.projections.length) items.push(property('appearance', appearanceInput(program)));
    statements.push(declaration(program.readInputs, [param('$props', typeRef(program.propsType))], undefined, [f.createReturnStatement(object(items))]));
    hostType = typeRef('ReturnType', f.createTypeQueryNode(id(program.readInputs)));
  }
  if (program.dispatchers.size || (program.fixed.length && !program.contexts.size)) {
    let inputType: ts.TypeNode = hostType;
    if (program.contexts.size) {
      const members = hasInputs(program) ? [signature('host', hostType)] : [];
      for (const { binding, sourceName } of program.contexts.values()) {
        members.push(signature(sourceName, program.useType('ContextValue', program.data.type(binding.type))));
      }
      inputType = f.createTypeLiteralNode(members);
    }
    statements.push(f.createTypeAliasDeclaration(undefined, program.inputsType, undefined, inputType));
  }
  if (program.fixed.length) {
    const checks = program.fixed.map(binding => {
      const kind = (input: string) => member(member(id(input), binding.name), 'kind');
      const changed = f.createBinaryExpression(kind('$before'), ts.SyntaxKind.ExclamationEqualsEqualsToken, kind('$after'));
      const error = f.createNewExpression(program.use('HostValueError'), undefined, [str('the same input presence for this instance'), origin(binding)]);
      return atSource(f.createIfStatement(changed, f.createThrowStatement(error)), binding.source);
    });
    const checkedType = program.contexts.size ? hostType : typeRef(program.inputsType);
    statements.push(declaration(program.checkFixed, [param('$before', checkedType), param('$after', checkedType)], valueType('unit'), checks));
  }
  for (const signal of program.ir.signals) {
    const listener = program.listeners.get(signal.id);
    if (listener === undefined) continue;
    const callback = member(program.hostInputs(id('$inputs')), program.callbacks.get(signal.id)!);
    const getListener = declaration(listener, [param('$inputs', typeRef(program.inputsType))], undefined, [f.createReturnStatement(callback)]);
    statements.push(atSource(getListener, signal.source));
  }
  return statements;
}

export function initializerInputs(program: ReactProgram): Binding[] {
  const inputs = new Set<string>();
  for (const { init } of program.ir.fields) {
    for (const binding of program.functions.get(init)!.captures) if (program.props.has(binding) || program.contexts.has(binding)) inputs.add(binding);
  }
  return Array.from(inputs, binding => program.binding(binding));
}

export function fieldStorage(program: ReactProgram): ts.Statement[] {
  if (!program.ir.fields.length) return [];
  const { fields } = program.ir;
  const names = program.names.scope();
  const available = new Map<string, string>();
  const parameters = initializerInputs(program).map((binding) => {
    const name = names.take(binding.name);
    available.set(binding.id, name);
    return param(name, program.data.type(binding.type));
  });
  const members: ts.TypeElement[] = [];
  const initializers: ts.Statement[] = [];
  const values: ts.PropertyAssignment[] = [];
  for (const { binding, init } of fields) {
    const field = program.fieldKeys.get(binding.id)!;
    members.push(program.written.has(binding.id)
      ? f.createPropertySignature(undefined, key(field), undefined, program.data.type(binding.type))
      : signature(field, program.data.type(binding.type)));
    const name = names.take(binding.name);
    const value = invoke(program.functions.get(init)!, [], { read: (dep) => id(available.get(dep)!) });
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
      return program.data.compare(program.fields.get(dep)!.type, member(id('$before'), field), member(id('$after'), field), true);
    });
    const same = comparisons.reduce((lhs, rhs) => f.createBinaryExpression(lhs, ts.SyntaxKind.AmpersandAmpersandToken, rhs));
    statements.push(declaration(program.sameFields, [param('$before', typeRef(program.fieldsType)), param('$after', typeRef(program.fieldsType))], valueType('bool'), [f.createReturnStatement(same)]));
  }
  return statements;
}
