import ts from 'typescript';
import type { Binding, Block, Edge, Value, ValueType } from '../component-ir.ts';
import {
  arrow, atSource, block, call, constDecl, declaration, f, frozenRecord, id, member, param, property, quotedCommentText,
  sourceObject, str, typeRef, valueType, type Names,
} from './ast.ts';
import { isData } from './data.ts';
import type { FunctionPlan, ReactProgram } from './program.ts';

export interface Environment {
  read(binding: string): ts.Expression;
  inputs?: ts.Expression;
  fields?: ts.Expression;
  draft?: ts.Expression;
  signals?: ts.Expression;
  tasks?: ts.Expression;
}

/** A compiled helper takes its typed source arguments and resolved environment directly. */
export function invoke(plan: FunctionPlan, args: ts.Expression[], env: Environment): ts.CallExpression {
  if (plan.fn.phase === 'action') {
    if (plan.inputs) args.push(env.inputs!);
    if (plan.fields) args.push(plan.writes ? env.draft! : env.fields!);
    if (hasEffects(plan, env.tasks !== undefined)) args.push(env.signals!);
    if (plan.tasks && env.tasks !== undefined) args.push(env.tasks);
  } else {
    for (const binding of plan.captures) args.push(env.read(binding));
  }
  return call(id(plan.name), ...args);
}

export function hasEffects(plan: FunctionPlan, hasTasks: boolean): boolean {
  return plan.emits || (plan.tasks && hasTasks);
}

export function fieldsAndProps(program: ReactProgram, inputs: ts.Expression, fields: ts.Expression, render = false): Environment {
  return {
    inputs, fields,
    read(binding) {
      const prop = program.props.get(binding);
      if (prop) return member(program.hostInputs(inputs), prop.name);
      const consumed = program.contexts.get(binding);
      if (consumed) return render ? id(consumed.valueName) : call(member(member(inputs, consumed.sourceName), 'getSnapshot'));
      return member(fields, program.fieldKeys.get(binding)!);
    },
  };
}

const binaryOperators = {
  add: ts.SyntaxKind.PlusToken,
  multiply: ts.SyntaxKind.AsteriskToken,
  equal: ts.SyntaxKind.EqualsEqualsEqualsToken,
  concat: ts.SyntaxKind.PlusToken,
} as const;

interface LocalBinding {
  binding: Binding;
  name: string;
}

export function emitBehavior(program: ReactProgram, plan: FunctionPlan, taskBlock?: Block): ts.FunctionDeclaration {
  const { fn } = plan;
  const scope = program.names.scope();
  const argumentsById = new Map<string, LocalBinding>();
  const blockPlan = taskBlock && plan.taskBlocks!.get(taskBlock.id);
  const parameters = (blockPlan?.originalParams ?? fn.params).map((binding) => {
    const name = scope.take(binding.name);
    argumentsById.set(binding.id, { binding, name });
    return param(name, program.data.type(binding.type));
  });
  let environment: Environment;
  const tasks = program.taskKeys.size ? id('$tasks') : undefined;
  const effects = hasEffects(plan, tasks !== undefined);
  const result = program.data.type(fn.binding.type);
  const taskTypes = taskBlock ? [typeRef(plan.taskView!), result] : undefined;
  if (taskBlock) {
    parameters.unshift(param('$view', taskTypes![0]), param('$task', program.useType('TaskControl', ...taskTypes!)));
    const view = (name: string) => member(id('$view'), name);
    const draft = view('draft');
    const fields = plan.writes ? member(draft, 'current') : view('fields');
    environment = {
      ...fieldsAndProps(program, view('inputs'), fields), draft, signals: view('signals'),
      ...(tasks && { tasks: view('tasks') }),
    };
  } else if (fn.phase === 'action') {
    const fields = plan.writes ? member(id('$draft'), 'current') : id('$fields');
    environment = { ...fieldsAndProps(program, id('$inputs'), fields), draft: id('$draft'), signals: id('$signals'), ...(tasks && { tasks }) };
    if (plan.inputs) parameters.push(param('$inputs', typeRef(program.inputsType)));
    if (plan.fields) {
      const type = typeRef(program.fieldsType);
      parameters.push(plan.writes ? param('$draft', program.useType('FieldDraft', type)) : param('$fields', type));
    }
    if (effects) parameters.push(param('$signals', program.useType('SignalQueue', typeRef(program.inputsType))));
    if (plan.tasks && tasks) parameters.push(param('$tasks', typeRef(program.tasksType)));
  } else {
    const captures = new Map<string, string>();
    for (const dep of plan.captures) {
      const binding = program.binding(dep);
      const name = scope.take(binding.name);
      captures.set(dep, name);
      parameters.push(param(name, program.data.type(binding.type)));
    }
    environment = { read: (dep) => id(captures.get(dep)!) };
  }

  const blockParameters = new Map<string, LocalBinding[]>();
  const declarations: ts.VariableDeclaration[] = [];
  const labelNames = program.names.scope();
  const blocks = taskBlock ? [taskBlock] : plan.blocks;
  for (const entry of blocks) {
    blockParameters.set(entry.id, entry.params.map((binding) => {
      const name = scope.take(binding.name);
      // All incoming edges assign this slot before entering its block.
      if (taskBlock) parameters.push(param(name, program.data.type(binding.type)));
      else declarations.push(f.createVariableDeclaration(name, f.createToken(ts.SyntaxKind.ExclamationToken), program.data.type(binding.type)));
      return { binding, name };
    }));
  }

  // A label encloses just the code its incoming jumps must skip. Linear chains
  // fall through, and consecutive diamonds do not nest inside each other.
  const labels = new Map<string, { name: string; from: number }>();
  const regions: Array<{ start: number; statements: ts.Statement[] }> = [];
  for (const [index, current] of blocks.entries()) {
    const label = labels.get(current.id);
    if (label) {
      let first = regions.length - 1;
      while (first > 0 && regions[first].start > label.from) first--;
      const covered = regions.splice(first);
      const body = block(covered.flatMap((region) => region.statements));
      regions.push({ start: covered[0].start, statements: [f.createLabeledStatement(label.name, body)] });
    }
    const statements: ts.Statement[] = [];
    let locals: Map<string, LocalBinding> | undefined;
    let localsScope: Names | undefined;
    for (const local of blockParameters.get(current.id)!) {
      (locals ??= new Map()).set(local.binding.id, local);
    }
    function localBinding(key: string): LocalBinding {
      return locals?.get(key) ?? argumentsById.get(key)!;
    }
    function typeOf(expr: Value): ValueType {
      switch (expr.kind) {
        case 'bool': case 'number': case 'text': case 'tokens': return expr.kind;
        case 'not': case 'has-value': return 'bool';
        case 'record': case 'tagged': case 'literal-text': return expr.type;
        case 'widen-text': case 'tag': return 'text';
        case 'prop': return program.props.get(expr.id)!.type;
        case 'context': case 'state': case 'capture': return program.binding(expr.id).type;
        case 'local': return localBinding(expr.id).binding.type;
        case 'call': return program.functions.get(expr.fn)!.fn.binding.type;
        case 'binary': return expr.op === 'equal' ? 'bool' : expr.op === 'concat' ? 'text' : 'number';
        case 'member': {
          const type = typeOf(expr.value);
          const record = isData(type) && program.data.definition(type);
          if (!record || record.kind !== 'record') throw new Error('Expected validated record member.');
          return record.fields.find(field => field.name === expr.field)!.type;
        }
      }
    }
    function value(expr: Value): ts.Expression {
      switch (expr.kind) {
        case 'bool': case 'number': case 'text': case 'tokens': return program.literal(expr);
        case 'literal-text': return str(program.data.literalText(expr.type));
        case 'widen-text': return f.createAsExpression(value(expr.value), valueType('text'));
        case 'tag': return f.createAsExpression(member(value(expr.value), program.data.tagged(typeOf(expr.value)).discriminant), valueType('text'));
        case 'tagged': {
          const tagged = program.data.tagged(expr.type);
          const properties: ts.ObjectLiteralElementLike[] = [property(tagged.discriminant, str(expr.tag))];
          if (expr.payload.kind === 'record') {
            for (const field of expr.payload.fields) properties.push(property(field.name, value(field.value)));
          } else {
            properties.push(f.createSpreadAssignment(value(expr.payload)));
          }
          return frozenRecord(properties);
        }
        case 'record': return frozenRecord(expr.fields.map(field => property(field.name, value(field.value))));
        case 'member': return member(value(expr.value), expr.field);
        case 'has-value': return f.createBinaryExpression(member(value(expr.value), 'kind'), ts.SyntaxKind.EqualsEqualsEqualsToken, str('present'));
        case 'prop': case 'context': case 'state': case 'capture': return environment.read(expr.id);
        case 'local': return id(localBinding(expr.id).name);
        case 'not': return f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken, value(expr.value));
        case 'binary': {
          const left = value(expr.left);
          let right = value(expr.right);
          if (expr.op === 'equal') return program.data.compare(typeOf(expr.left), left, right, false);
          // Floating-point addition and multiplication cannot be reassociated by a printer.
          if (expr.right.kind === 'binary') right = f.createParenthesizedExpression(right);
          return f.createBinaryExpression(left, binaryOperators[expr.op], right);
        }
        case 'call': return invoke(program.functions.get(expr.fn)!, expr.args.map(value), environment);
      }
    }
    function transfer(edge: Edge, payload?: ts.Expression): ts.Statement[] {
      const values = edge.args.map(value);
      if (payload) values.unshift(payload);
      if (taskBlock) {
        const next = plan.taskBlocks!.get(edge.block)!;
        return [f.createReturnStatement(call(id(next.name), id('$view'), id('$task'), ...originalArgs(next.originalParams), ...values))];
      }
      const params = blockParameters.get(edge.block)!;
      const moves: ts.Statement[] = values.map((arg, i) => f.createExpressionStatement(f.createAssignment(id(params[i].name), arg)));
      if (edge.block !== plan.blocks[index + 1]?.id) {
        let label = labels.get(edge.block);
        if (!label) {
          label = { name: labelNames.take(edge.block), from: index };
          labels.set(edge.block, label);
        }
        moves.push(f.createBreakStatement(id(label.name)));
      }
      return moves;
    }
    function originalArgs(params: readonly Binding[]) {
      return params.map(binding => id(argumentsById.get(binding.id)!.name));
    }
    for (const op of current.instructions) {
      let out: ts.Statement;
      switch (op.kind) {
        case 'let': {
          const init = value(op.value);
          const name = (localsScope ??= scope.scope()).take(op.binding.name);
          (locals ??= new Map()).set(op.binding.id, { binding: op.binding, name });
          out = constDecl(name, init);
          break;
        }
        case 'write': {
          const target = member(call(member(environment.draft!, 'edit')), program.fieldKeys.get(op.target)!);
          out = f.createExpressionStatement(f.createAssignment(target, value(op.value)));
          break;
        }
        case 'emit': {
          const listener = id(program.listeners.get(op.target)!);
          out = f.createExpressionStatement(call(member(environment.signals!, 'send'), listener, value(op.value)));
          break;
        }
        case 'invoke': {
          out = f.createExpressionStatement(invoke(program.functions.get(op.fn)!, op.args.map(value), environment));
          break;
        }
        case 'start': case 'cancel': {
          const group = program.taskKeys.get(op.task);
          if (group === undefined) continue;
          const after = member(environment.signals!, 'afterCommit');
          const args: ts.Expression[] = [after];
          if (op.kind === 'start') {
            const task = program.functions.get(op.task)!;
            const boundArgs = task.fn.params.map(binding => scope.take(binding.name));
            const first = arrow([param('$view'), param('$task')], call(id(task.name), id('$view'), id('$task'), ...boundArgs.map(id)));
            if (boundArgs.length) {
              // Capture only immutable native arguments, outside the working view.
              const groupType = program.useType('OwnedTaskGroup', typeRef(task.taskView!), program.data.type(task.fn.binding.type));
              const params = [param('$group', groupType), param('$afterCommit', program.useType('PostCommit')), ...task.fn.params.map((p, i) => param(boundArgs[i], program.data.type(p.type)))];
              const stage = arrow(params, call(member(id('$group'), 'start'), id('$afterCommit'), first, program.use('observeNativeTask')));
              out = f.createExpressionStatement(call(f.createParenthesizedExpression(stage), member(environment.tasks!, group), after, ...op.args.map(value)));
              break;
            }
            args.push(first, program.use('observeNativeTask'));
          }
          out = f.createExpressionStatement(call(member(member(environment.tasks!, group), op.kind), ...args));
          break;
        }
      }
      statements.push(atSource(out, op.source));
    }
    const end = current.end;
    switch (end.kind) {
      case 'return': {
        const returned = end.value && value(end.value);
        statements.push(atSource(f.createReturnStatement(taskBlock ? call(member(id('$task'), 'complete'), returned ?? id('undefined')) : returned), end.source));
        break;
      }
      case 'jump': {
        const moves = transfer(end.to);
        if (moves.length) atSource(moves[0], end.source);
        statements.push(...moves);
        break;
      }
      case 'branch': {
        const condition = value(end.condition);
        const yes = transfer(end.yes);
        const no = transfer(end.no);
        let branch: ts.Statement;
        if (yes.length) {
          branch = f.createIfStatement(condition, block(yes), no.length ? block(no) : undefined);
        } else if (no.length) {
          branch = f.createIfStatement(f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken, condition), block(no));
        } else {
          branch = f.createExpressionStatement(condition);
        }
        statements.push(atSource(branch, end.source));
        break;
      }
      case 'presence': {
        const test = (localsScope ??= scope.scope()).take('matched');
        const condition = f.createBinaryExpression(member(id(test), 'kind'), ts.SyntaxKind.EqualsEqualsEqualsToken, str('present'));
        const present = transfer(end.present, member(id(test), 'value'));
        const omitted = transfer(end.omitted);
        const branch = f.createIfStatement(condition, block(present), omitted.length ? block(omitted) : undefined);
        statements.push(atSource(block([constDecl(test, value(end.value)), branch]), end.source));
        break;
      }
      case 'match': {
        const test = id((localsScope ??= scope.scope()).take('matched'));
        const type = typeOf(end.value);
        const { discriminant, cases } = program.data.tagged(type);
        let select: ts.Statement = f.createThrowStatement(f.createNewExpression(id('Error'), undefined, [str('Unreachable checked match case.')]));
        for (const { tag, to } of [...end.cases].reverse()) {
          const declared = cases.find(c => c.tag === tag)!;
          const fields = program.data.record(declared.payload).fields;
          const payload = frozenRecord(fields.map(field => property(field.name, member(test, field.name))));
          const condition = f.createBinaryExpression(member(test, discriminant), ts.SyntaxKind.EqualsEqualsEqualsToken, str(tag));
          select = f.createIfStatement(condition, block(transfer(to, payload)), select);
        }
        const operand = f.createAsExpression(value(end.value), program.data.type(type));
        statements.push(atSource(block([constDecl(test, operand), select]), end.source));
        break;
      }
      case 'await': {
        const { extern, name, localResult } = program.unit.externs.get(end.extern)!;
        const next = plan.taskBlocks!.get(end.resume.block)!;
        const bind = (binding: Binding) => param(scope.take(binding.name), program.data.type(binding.type));
        const commandParams = extern.params.map(bind);
        const originalParams = next.originalParams.map(bind);
        const edgeParams = next.block.params.slice(1).map(bind);
        const paramNames = (params: ts.ParameterDeclaration[]) => params.map(p => p.name as ts.Identifier);
        const commandArgs = [...paramNames(commandParams), id('$signal')];
        const commandResult = typeRef(localResult);
        const origin = str(`${end.source.file}:${end.source.start}-${end.source.end} (${extern.name})`);
        const validate = arrow([param('$outcome')], program.data.read(extern.binding.type, id('$outcome'), origin));
        const read = f.createCallExpression(program.use('checkTaskResult'), [commandResult], [call(id(name), ...commandArgs), validate]);
        const command = arrow([param('$signal')], read);
        const resume = arrow([param('$view'), param('$task'), param('$outcome')], call(
          id(next.name), id('$view'), id('$task'), ...paramNames(originalParams), id('$outcome'), ...paramNames(edgeParams)
        ));
        const wait = f.createCallExpression(member(id('$task'), 'await'), [commandResult], [command, resume]);
        const suspend = arrow([param('$task', program.useType('TaskControl', ...taskTypes!)), ...commandParams, ...originalParams, ...edgeParams], wait);
        const start = call(f.createParenthesizedExpression(suspend), id('$task'), ...end.args.map(value), ...originalArgs(next.originalParams), ...end.resume.args.map(value));
        statements.push(atSource(f.createReturnStatement(start), end.source));
        break;
      }
      case 'fail': {
        const error = f.createNewExpression(program.use('ActionFailure'), undefined, [str(end.reason), sourceObject(end.source)]);
        statements.push(atSource(f.createThrowStatement(error), end.source));
        break;
      }
    }
    const needsScope = plan.blocks.length > 1 && current.instructions.some((op) => op.kind === 'let');
    const region = needsScope ? [block(statements)] : statements;
    if (plan.blocks.length > 1 && region.length) {
      ts.addSyntheticLeadingComment(region[0], ts.SyntaxKind.SingleLineCommentTrivia, ` block ${quotedCommentText(current.id)}`, true);
    }
    regions.push({ start: index, statements: region });
  }
  const statements = regions.flatMap((region) => region.statements);
  if (declarations.length) statements.unshift(f.createVariableStatement(undefined, f.createVariableDeclarationList(declarations, ts.NodeFlags.Let)));
  const name = blockPlan?.name ?? plan.name;
  return atSource(declaration(name, parameters, taskTypes ? program.useType('TaskExit', ...taskTypes) : result, statements), taskBlock?.end.source ?? fn.binding.source);
}
