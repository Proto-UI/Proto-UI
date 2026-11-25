import ts from 'typescript';
import { arrow, atSource, block, call, constDecl, declaration, f, id, key, member, object, param, property, semanticExport, str, typeRef } from './ast.ts';
import { fieldsAndProps, invoke, type Environment } from './behavior.ts';
import type { ReactProgram } from './program.ts';
import { hasInputs, initializerProps, publicParameters } from './surface.ts';

function snapshot(): ts.CallExpression { return call(member(id('$store'), 'snapshot')); }
function publishedInputs(): ts.CallExpression { return call(member(id('$lease'), 'read')); }
function fieldArgument(program: ReactProgram): ts.Identifier { return id(program.written.size ? '$store' : '$fields'); }
function argumentNames(params: ts.ParameterDeclaration[]): ts.Identifier[] { return params.map((p) => p.name as ts.Identifier); }

function dispatchCall(program: ReactProgram, fn: string, args: ts.Expression[], inputLease: ts.Expression): ts.CallExpression {
  args.push(inputLease);
  if (program.functions.get(fn)!.fields) args.push(fieldArgument(program));
  return call(id(program.dispatchers.get(fn)!), ...args);
}

export function dispatchers(program: ReactProgram): ts.Statement[] {
  return Array.from(program.dispatchers, ([fn, name]) => {
    const plan = program.functions.get(fn)!;
    const params = publicParameters(program, plan.fn.params);
    const args = argumentNames(params);
    // Admission is synchronous even when the action will run in a later cycle.
    // Only checked, immutable scalar arguments may be retained by the queue.
    const checks = args.map((arg, i) => f.createExpressionStatement(program.guard(plan.fn.params[i], arg)));
    params.push(param('$lease', program.useType('InputLease', typeRef(program.inputsType))));
    const body: ts.Statement[] = [];
    let fields: ts.Expression = id('$fields');
    if (plan.fields) {
      if (program.written.size) {
        params.push(param('$store', program.useType('FieldStore', typeRef(program.fieldsType))));
        if (plan.writes) {
          body.push(constDecl('$draft', f.createNewExpression(program.use('FieldDraft'), undefined, [snapshot()])));
          fields = member(id('$draft'), 'current');
        } else {
          fields = snapshot();
        }
      } else {
        params.push(param('$fields', typeRef(program.fieldsType)));
      }
    }
    if (plan.emits) {
      const queue = f.createNewExpression(program.use('SignalQueue'), [typeRef(program.inputsType)], []);
      body.push(constDecl('$signals', queue));
    }
    const env = { ...fieldsAndProps(program, id('$inputs'), fields), draft: id('$draft'), signals: id('$signals') };
    body.push(f.createExpressionStatement(invoke(plan, args, env)));
    if (plan.writes || plan.emits) {
      const finish = [id('$lease'), id(plan.emits ? '$signals' : 'undefined')] as ts.Expression[];
      if (plan.writes) finish.push(id('$store'), member(id('$draft'), 'current'), id(program.sameFields));
      body.push(f.createReturnStatement(call(program.use('finishAction'), ...finish)));
    }
    const action = arrow(plan.inputs ? [param('$inputs')] : [], block(body));
    const entry: ts.Statement[] = [];
    if (checks.length) entry.push(f.createIfStatement(call(member(id('$lease'), 'active')), block(checks)));
    entry.push(f.createReturnStatement(call(program.use('dispatchAction'), id('$lease'), action)));
    return atSource(declaration(name, params, program.useType('ActionDispatch'), entry), plan.fn.binding.source);
  });
}

function handleHook(program: ReactProgram): ts.Statement {
  const members: ts.ObjectLiteralElementLike[] = [];
  const dependencies = [id('$owner')];
  let readsFields = false;
  for (const { name, fn } of program.ir.projections) {
    const plan = program.functions.get(fn)!;
    const body: ts.Statement[] = [plan.inputs ? constDecl('$inputs', publishedInputs()) : f.createExpressionStatement(publishedInputs())];
    if (plan.fields && program.written.size) body.push(constDecl('$fields', snapshot()));
    readsFields ||= plan.fields;
    body.push(f.createReturnStatement(invoke(plan, [], fieldsAndProps(program, id('$inputs'), id('$fields')))));
    members.push(f.createGetAccessorDeclaration(undefined, key(name), [], undefined, block(body)));
  }
  for (const { name, fn } of program.ir.actions) {
    const plan = program.functions.get(fn)!;
    readsFields ||= plan.fields;
    const params = publicParameters(program, plan.fn.params);
    const dispatch = dispatchCall(program, fn, argumentNames(params), id('$lease'));
    members.push(f.createMethodDeclaration(undefined, undefined, key(name), undefined, undefined, params, undefined, block([f.createReturnStatement(dispatch)])));
  }
  if (readsFields) dependencies.push(fieldArgument(program));
  const make = arrow([], block([
    constDecl('$lease', call(member(id('$owner'), 'lease'))),
    f.createReturnStatement(call(member(id('Object'), 'freeze'), object(members))),
  ]));
  return f.createExpressionStatement(call(program.use('useImperativeHandle'), id('$ref'), make, f.createArrayLiteralExpression(dependencies)));
}

function nativeClick(program: ReactProgram): ts.ArrowFunction {
  const { activate, disabled } = program.ir.view;
  const body: ts.Statement[] = [constDecl('$lease', call(member(id('$owner'), 'lease')))];
  if (disabled !== undefined) {
    const plan = program.functions.get(disabled)!;
    if (plan.inputs) body.push(constDecl('$inputs', publishedInputs()));
    if (plan.fields && program.written.size) body.push(constDecl('$fields', snapshot()));
    const locked = invoke(plan, [], fieldsAndProps(program, id('$inputs'), id('$fields')));
    body.push(f.createIfStatement(locked, f.createReturnStatement()));
  }
  body.push(f.createExpressionStatement(call(program.use('observeNativeAction'), dispatchCall(program, activate!, [], id('$lease')))));
  return arrow([], block(body));
}

function output(program: ReactProgram, env: Environment): ts.Expression {
  const { view, projections } = program.ir;
  const attributes: ts.PropertyAssignment[] = [];
  if (view.role === 'button') attributes.push(property('type', str('button')));
  if (view.disabled !== undefined) attributes.push(property('disabled', invoke(program.functions.get(view.disabled)!, [], env)));
  if (view.activate !== undefined) attributes.push(property('onClick', nativeClick(program)));
  if (projections.length) {
    const { file, start, end } = program.ir.source;
    const callback = call(
      program.use('readCallback'),
      member(id('$props'), 'appearance'),
      str(`${file}:${start}-${end} (appearance)`)
    );
    const projection = object(projections.map(({ name, fn }) => property(name, invoke(program.functions.get(fn)!, [], env))));
    const appearance = f.createCallChain(callback, f.createToken(ts.SyntaxKind.QuestionDotToken), undefined, [call(member(id('Object'), 'freeze'), projection)]);
    attributes.push(property('style', appearance));
  }
  const text = invoke(program.functions.get(view.text)!, [], env);
  return call(program.use('createElement'), str(view.role === 'button' ? 'button' : 'span'), attributes.length ? object(attributes) : f.createNull(), text);
}

function firstState(name: string, program: ReactProgram, initializer: ts.Expression): ts.VariableStatement {
  const first = f.createArrayBindingPattern([f.createBindingElement(undefined, undefined, name)]);
  return constDecl(first, call(program.use('useState'), arrow([], initializer)));
}

export function component(program: ReactProgram): ts.Statement[] {
  const { ir } = program;
  const statements: ts.Statement[] = [];
  let environment: Environment;
  if (program.hasOwner) {
    const inputs = hasInputs(program) ? id('$inputs') : id('undefined');
    if (hasInputs(program)) statements.push(constDecl('$inputs', call(id(program.readInputs), id('$props'))));
    statements.push(constDecl('$owner', call(program.use('usePublishedInputs'), inputs)));
    environment = fieldsAndProps(program, inputs, id('$fields'));
  } else {
    const names = program.names.scope();
    const locals = new Map<string, string>();
    const reads = new Set<string>();
    for (const plan of program.functions.values()) for (const capture of plan.captures) reads.add(capture);
    for (const binding of ir.props) {
      const checked = program.guard(binding, member(id('$props'), binding.name));
      if (reads.has(binding.id)) {
        const name = names.take(binding.name);
        locals.set(binding.id, name);
        statements.push(constDecl(name, checked));
      } else {
        statements.push(f.createExpressionStatement(checked));
      }
    }
    environment = { read: (dep) => program.props.has(dep) ? id(locals.get(dep)!) : member(id('$fields'), program.fieldKeys.get(dep)!) };
  }
  if (ir.fields.length) {
    const init = call(id(program.initFields), ...initializerProps(program).map((binding) => environment.read(binding.id)));
    const renderFns = [ir.view.text, ...ir.projections.map((p) => p.fn)];
    if (ir.view.disabled !== undefined) renderFns.push(ir.view.disabled);
    const renderReadsFields = renderFns.some((fn) => program.functions.get(fn)!.fields);
    if (program.written.size) {
      statements.push(firstState('$store', program, f.createNewExpression(program.use('FieldStore'), undefined, [init])));
      if (renderReadsFields) {
        const storeSnapshot = member(id('$store'), 'snapshot');
        const fromStore = call(program.use('useSyncExternalStore'), member(id('$store'), 'subscribe'), storeSnapshot, storeSnapshot);
        statements.push(constDecl('$fields', fromStore));
      }
    } else if (renderReadsFields || Array.from(program.dispatchers.keys()).some((fn) => program.functions.get(fn)!.fields)) {
      statements.push(firstState('$fields', program, init));
    } else {
      statements.push(f.createExpressionStatement(call(program.use('useState'), arrow([], init))));
    }
  }
  if (program.hasHandle) statements.push(handleHook(program));
  statements.push(f.createReturnStatement(output(program, environment)));

  let component: ts.Statement;
  if (program.hasHandle) {
    const render = f.createFunctionExpression(undefined, undefined, program.component, undefined, [param('$props'), param('$ref')], undefined, block(statements));
    const forwarded = f.createCallExpression(program.use('forwardRef'), [typeRef(program.handleType), typeRef(program.propsType)], [render]);
    component = constDecl(program.component, forwarded);
  } else {
    component = declaration(program.component, [param('$props', typeRef(program.propsType))], undefined, statements);
  }
  const exports = [
    semanticExport(program.component, ir.name),
    semanticExport(program.propsType, `${ir.name}Props`, true),
  ];
  if (ir.projections.length) exports.push(semanticExport(program.projectionType, `${ir.name}Projection`, true));
  if (program.hasHandle) exports.push(semanticExport(program.handleType, `${ir.name}Handle`, true));
  const declarations: ts.Statement[] = [atSource(component, ir.source)];
  if (program.component !== ir.name) {
    const displayName = f.createAssignment(member(id(program.component), 'displayName'), str(ir.name));
    declarations.push(f.createExpressionStatement(displayName));
  }
  declarations.push(f.createExportDeclaration(undefined, false, f.createNamedExports(exports)));
  return declarations;
}
