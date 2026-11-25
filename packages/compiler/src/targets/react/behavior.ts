import ts from 'typescript';
import type { Binding, Edge, Value } from '../component-ir.ts';
import {
  atSource, block, call, constDecl, declaration, f, id, member, param, quotedCommentText,
  scalar, sourceObject, str, typeRef, type Names,
} from './ast.ts';
import type { FunctionPlan, ReactProgram } from './program.ts';

export interface Environment {
  read(binding: string): ts.Expression;
  inputs?: ts.Expression;
  fields?: ts.Expression;
  draft?: ts.Expression;
  signals?: ts.Expression;
}

/** A compiled helper takes its typed source arguments and resolved environment directly. */
export function invoke(plan: FunctionPlan, args: ts.Expression[], env: Environment): ts.CallExpression {
  if (plan.fn.phase === 'action') {
    if (plan.inputs) args.push(env.inputs!);
    if (plan.fields) args.push(plan.writes ? env.draft! : env.fields!);
    if (plan.emits) args.push(env.signals!);
  } else {
    for (const binding of plan.captures) args.push(env.read(binding));
  }
  return call(id(plan.name), ...args);
}

export function fieldsAndProps(program: ReactProgram, inputs: ts.Expression, fields: ts.Expression): Environment {
  return {
    inputs, fields,
    read(binding) {
      const prop = program.props.get(binding);
      return prop ? member(inputs, prop.name) : member(fields, program.fieldKeys.get(binding)!);
    },
  };
}

const binaryOperators = {
  add: ts.SyntaxKind.PlusToken,
  multiply: ts.SyntaxKind.AsteriskToken,
  equal: ts.SyntaxKind.EqualsEqualsEqualsToken,
  concat: ts.SyntaxKind.PlusToken,
} as const;

export function emitBehavior(program: ReactProgram, plan: FunctionPlan): ts.FunctionDeclaration {
  const { fn } = plan;
  const scope = program.names.scope();
  const argumentsById = new Map<string, string>();
  const parameters = fn.params.map((binding) => {
    const name = scope.take(binding.name);
    argumentsById.set(binding.id, name);
    return param(name, scalar(binding.type));
  });
  let environment: Environment;
  if (fn.phase === 'action') {
    const fields = plan.writes ? member(id('$draft'), 'current') : id('$fields');
    environment = { ...fieldsAndProps(program, id('$inputs'), fields), draft: id('$draft'), signals: id('$signals') };
    if (plan.inputs) parameters.push(param('$inputs', typeRef(program.inputsType)));
    if (plan.fields) {
      const type = typeRef(program.fieldsType);
      parameters.push(plan.writes ? param('$draft', program.useType('FieldDraft', type)) : param('$fields', type));
    }
    if (plan.emits) parameters.push(param('$signals', program.useType('SignalQueue', typeRef(program.inputsType))));
  } else {
    const captures = new Map<string, string>();
    for (const dep of plan.captures) {
      const binding = program.props.get(dep) ?? program.fields.get(dep)!;
      const name = scope.take(binding.name);
      captures.set(dep, name);
      parameters.push(param(name, scalar(binding.type)));
    }
    environment = { read: (dep) => id(captures.get(dep)!) };
  }

  const blockParameters = new Map<string, Array<{ binding: Binding; name: string }>>();
  const declarations: ts.VariableDeclaration[] = [];
  const labelNames = program.names.scope();
  for (const entry of plan.blocks) {
    blockParameters.set(entry.id, entry.params.map((binding) => {
      const name = scope.take(binding.name);
      // All incoming edges assign this slot before entering its block.
      declarations.push(f.createVariableDeclaration(name, f.createToken(ts.SyntaxKind.ExclamationToken), scalar(binding.type)));
      return { binding, name };
    }));
  }

  // A label encloses just the code its incoming jumps must skip. Linear chains
  // fall through, and consecutive diamonds do not nest inside each other.
  const labels = new Map<string, { name: string; from: number }>();
  const regions: Array<{ start: number; statements: ts.Statement[] }> = [];
  for (const [index, current] of plan.blocks.entries()) {
    const label = labels.get(current.id);
    if (label) {
      let first = regions.length - 1;
      while (first > 0 && regions[first].start > label.from) first--;
      const covered = regions.splice(first);
      const body = block(covered.flatMap((region) => region.statements));
      regions.push({ start: covered[0].start, statements: [f.createLabeledStatement(label.name, body)] });
    }
    const statements: ts.Statement[] = [];
    let locals: Map<string, string> | undefined;
    let localsScope: Names | undefined;
    for (const { binding, name } of blockParameters.get(current.id)!) {
      (locals ??= new Map()).set(binding.id, name);
    }
    function value(expr: Value): ts.Expression {
      switch (expr.kind) {
        case 'bool': return expr.value ? f.createTrue() : f.createFalse();
        case 'number': return program.number(expr.bits);
        case 'text': return str(expr.value);
        case 'prop': case 'state': case 'capture': return environment.read(expr.id);
        case 'local': return id(locals?.get(expr.id) ?? argumentsById.get(expr.id)!);
        case 'not': return f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken, value(expr.value));
        case 'binary': {
          const left = value(expr.left);
          let right = value(expr.right);
          // Floating-point addition and multiplication cannot be reassociated by a printer.
          if (expr.right.kind === 'binary') right = f.createParenthesizedExpression(right);
          return f.createBinaryExpression(left, binaryOperators[expr.op], right);
        }
        case 'call': return invoke(program.functions.get(expr.fn)!, expr.args.map(value), environment);
      }
    }
    function transfer(edge: Edge): ts.Statement[] {
      const params = blockParameters.get(edge.block)!;
      const moves: ts.Statement[] = edge.args.map((arg, i) => f.createExpressionStatement(f.createAssignment(id(params[i].name), value(arg))));
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
    for (const op of current.instructions) {
      let out: ts.Statement;
      switch (op.kind) {
        case 'let': {
          const init = value(op.value);
          const name = (localsScope ??= scope.scope()).take(op.binding.name);
          (locals ??= new Map()).set(op.binding.id, name);
          out = constDecl(name, init);
          break;
        }
        case 'write': {
          const target = member(call(member(id('$draft'), 'edit')), program.fieldKeys.get(op.target)!);
          out = f.createExpressionStatement(f.createAssignment(target, value(op.value)));
          break;
        }
        case 'emit': {
          const listener = id(program.listeners.get(op.target)!);
          out = f.createExpressionStatement(call(member(id('$signals'), 'send'), listener, value(op.value)));
          break;
        }
        case 'invoke': {
          out = f.createExpressionStatement(invoke(program.functions.get(op.fn)!, op.args.map(value), environment));
          break;
        }
      }
      statements.push(atSource(out, op.source));
    }
    const end = current.end;
    switch (end.kind) {
      case 'return': statements.push(atSource(f.createReturnStatement(end.value && value(end.value)), end.source)); break;
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
  return atSource(declaration(plan.name, parameters, scalar(fn.binding.type), statements), fn.binding.source);
}
