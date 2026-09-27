import ts from 'typescript';
import { createHash } from 'node:crypto';
import { CompilerRejection } from './diagnostics';
import { OPERATION_RULES } from './operations';
import {
  SourceGraph,
  identifier,
  propertyName,
  rejectNode,
  sourceName,
  sourceSpan,
  type FunctionNode,
  type SourceModule,
} from './parser-module';
import {
  IR_VERSION,
  type AuthoredHookIR,
  type CompileResult,
  type ExposureIR,
  type ExpressionIR,
  type FunctionIR,
  type Operation,
  type ParameterIR,
  type ParseOptions,
  type Phase,
  type PrimitiveType,
  type PropIR,
  type PrototypeIR,
  type StatementIR,
  type ValueType,
} from './ir';

interface Binding {
  type: ValueType;
  helper?: FunctionIR;
  phase?: Phase;
}
type Scope = Map<string, Binding>;
const HOOKS: Record<string, Operation> = {
  asTrigger: 'hook.asTrigger',
  asFocusable: 'hook.asFocusable',
  asAccessible: 'hook.asAccessible',
};
const OPERATORS: Record<string, true> = {
  '===': true,
  '!==': true,
  '<': true,
  '<=': true,
  '>': true,
  '>=': true,
  '+': true,
  '-': true,
  '*': true,
  '/': true,
  '%': true,
  '&&': true,
  '||': true,
  '??': true,
};

class Frontend {
  readonly graph: SourceGraph;
  readonly hooks = new Map<string, AuthoredHookIR>();
  readonly props = new Map<string, PropIR>();
  readonly exposes = new Map<string, ExposureIR>();
  readonly requirements = new Set<string>();
  readonly activeHooks = new Set<string>();
  readonly activeHelpers = new Set<string>();
  readonly usedFunctions = new Set<FunctionNode>();

  constructor(
    input: string,
    readonly options: ParseOptions
  ) {
    this.graph = new SourceGraph(input, options);
  }

  function(
    module: SourceModule,
    node: FunctionNode,
    outer: Scope,
    phase: Phase,
    expected: readonly ValueType[] = []
  ): FunctionIR {
    if (
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ||
      !node.body ||
      ('asteriskToken' in node && node.asteriskToken)
    )
      rejectNode(node, 'PUI1004', 'Async/generator/external functions are unsupported.');
    this.usedFunctions.add(node);
    const scope = new Map(outer);
    const names = new Set<string>();
    const parameters: ParameterIR[] = node.parameters.map((parameter, index) => {
      if (parameter.dotDotDotToken || parameter.initializer)
        rejectNode(parameter, 'PUI1004', 'Rest and default callback parameters are unsupported.');
      const name = identifier(parameter.name);
      if (names.has(name)) rejectNode(parameter, 'PUI1005', `Duplicate parameter ${name}.`);
      names.add(name);
      let type = expected[index] ?? 'unknown';
      if (parameter.type) {
        if (parameter.type.kind === ts.SyntaxKind.BooleanKeyword) type = 'boolean';
        else if (parameter.type.kind === ts.SyntaxKind.StringKeyword) type = 'string';
        else if (parameter.type.kind === ts.SyntaxKind.NumberKeyword) type = 'number';
        else if (
          ts.isTypeReferenceNode(parameter.type) &&
          ts.isIdentifier(parameter.type.typeName) &&
          parameter.type.typeName.text === 'FocusRequestOptions'
        )
          type = 'focus-options';
        else if (type === 'unknown')
          rejectNode(parameter, 'PUI1004', 'Unsupported helper parameter type.');
      }
      scope.set(name, { type });
      return {
        name,
        type,
        ...(parameter.questionToken || type === 'focus-options' ? { optional: true } : {}),
      };
    });
    if (
      phase === 'setup' &&
      (parameters.length > 1 || (parameters.length === 1 && parameters[0].type !== 'def'))
    )
      rejectNode(node, 'PUI1006', 'Setup accepts at most one definition handle parameter.');
    const body = ts.isBlock(node.body)
      ? this.statements(module, node.body.statements, scope, phase)
      : [
          {
            kind: 'return' as const,
            value: this.expression(module, node.body, scope, phase),
            span: sourceSpan(node.body),
          },
        ];
    return { parameters, body, phase, span: sourceSpan(node) };
  }

  statements(
    module: SourceModule,
    statements: readonly ts.Statement[],
    scope: Scope,
    phase: Phase
  ): StatementIR[] {
    const output: StatementIR[] = [];
    for (const node of statements) {
      const span = sourceSpan(node);
      if (ts.isVariableStatement(node)) {
        if (!(node.declarationList.flags & ts.NodeFlags.Const))
          rejectNode(
            node,
            'PUI1004',
            'Use immutable lexical bindings and governed State for mutable facts.'
          );
        for (const declaration of node.declarationList.declarations) {
          const name = identifier(declaration.name);
          if (scope.has(name) || module.imports.has(name))
            rejectNode(declaration, 'PUI1005', `Shadowing/rebinding ${name} is not admitted.`);
          if (!declaration.initializer)
            rejectNode(declaration, 'PUI1004', 'Binding requires a value.');
          const init = declaration.initializer;
          let value: ExpressionIR;
          if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
            this.activeHelpers.add(name);
            scope.set(name, { type: 'function', phase: 'callback' });
            const fn = this.function(module, init, scope, 'callback');
            this.activeHelpers.delete(name);
            scope.set(name, { type: 'function', helper: fn, phase: fn.phase });
            value = { kind: 'function', type: 'function', function: fn, span: sourceSpan(init) };
          } else {
            value = this.expression(module, init, scope, phase);
            scope.set(name, { type: value.type });
          }
          output.push({ kind: 'const', name, value, span: sourceSpan(declaration) });
        }
      } else if (ts.isExpressionStatement(node))
        output.push({
          kind: 'effect',
          expression: this.expression(module, node.expression, scope, phase),
          span,
        });
      else if (ts.isIfStatement(node)) {
        const condition = this.expression(module, node.expression, scope, phase);
        const then = this.statements(
          module,
          ts.isBlock(node.thenStatement) ? node.thenStatement.statements : [node.thenStatement],
          new Map(scope),
          phase
        );
        const otherwise = node.elseStatement
          ? this.statements(
              module,
              ts.isBlock(node.elseStatement) ? node.elseStatement.statements : [node.elseStatement],
              new Map(scope),
              phase
            )
          : [];
        output.push({ kind: 'if', condition, then, otherwise, span });
      } else if (ts.isReturnStatement(node)) {
        if (!node.expression) output.push({ kind: 'return', span });
        else if (
          phase === 'setup' &&
          (ts.isArrowFunction(node.expression) || ts.isFunctionExpression(node.expression))
        )
          output.push({
            kind: 'return',
            value: {
              kind: 'function',
              type: 'function',
              function: this.function(module, node.expression, scope, 'render', ['render']),
              span: sourceSpan(node.expression),
            },
            span,
          });
        else
          output.push({
            kind: 'return',
            value: this.expression(module, node.expression, scope, phase),
            span,
          });
      } else if (!ts.isEmptyStatement(node))
        rejectNode(node, 'PUI1004', `Unsupported ${ts.SyntaxKind[node.kind]} statement.`);
    }
    return output;
  }

  expression(module: SourceModule, node: ts.Expression, scope: Scope, phase: Phase): ExpressionIR {
    if (ts.isParenthesizedExpression(node))
      return this.expression(module, node.expression, scope, phase);
    const span = sourceSpan(node);
    if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword)
      return {
        kind: 'literal',
        value: node.kind === ts.SyntaxKind.TrueKeyword,
        type: 'boolean',
        span,
      };
    if (node.kind === ts.SyntaxKind.NullKeyword)
      return { kind: 'literal', value: null, type: 'null', span };
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      return { kind: 'literal', value: node.text, type: 'string', span };
    if (ts.isNumericLiteral(node))
      return { kind: 'literal', value: Number(node.text), type: 'number', span };
    if (ts.isIdentifier(node)) {
      const binding = scope.get(node.text);
      if (!binding)
        rejectNode(
          node,
          'PUI1005',
          `Unresolved capture ${node.text}; only declared lexical values and semantic handles are admitted.`
        );
      return { kind: 'reference', name: node.text, type: binding.type, span };
    }
    if (ts.isArrayLiteralExpression(node))
      return {
        kind: 'array',
        type: 'array',
        elements: node.elements.map((element) => this.expression(module, element, scope, phase)),
        span,
      };
    if (ts.isObjectLiteralExpression(node)) {
      const keys = new Set<string>();
      const entries = node.properties.map((property) => {
        if (!ts.isPropertyAssignment(property))
          rejectNode(property, 'PUI1004', 'Object spread, methods and shorthand are unsupported.');
        const key = propertyName(property.name);
        if (keys.has(key)) rejectNode(property, 'PUI1006', `Duplicate object key ${key}.`);
        keys.add(key);
        return { key, value: this.expression(module, property.initializer, scope, phase) };
      });
      return { kind: 'record', type: 'record', entries, span };
    }
    if (ts.isPrefixUnaryExpression(node)) {
      const operator = ts.tokenToString(node.operator);
      if (operator !== '!' && operator !== '-' && operator !== '+')
        rejectNode(node, 'PUI1004', 'Mutation unary operators are unsupported.');
      return {
        kind: 'unary',
        type: operator === '!' ? 'boolean' : 'number',
        operator,
        operand: this.expression(module, node.operand, scope, phase),
        span,
      };
    }
    if (ts.isBinaryExpression(node)) {
      const operator = ts.tokenToString(node.operatorToken.kind) ?? '';
      if (!Object.hasOwn(OPERATORS, operator))
        rejectNode(node, 'PUI1004', `Unsupported operator ${operator}.`);
      const left = this.expression(module, node.left, scope, phase);
      const right = this.expression(module, node.right, scope, phase);
      const typedOperator = operator as Extract<ExpressionIR, { kind: 'binary' }>['operator'];
      return {
        kind: 'binary',
        operator: typedOperator,
        left,
        right,
        type: ['===', '!==', '<', '<=', '>', '>='].includes(operator) ? 'boolean' : left.type,
        span,
      };
    }
    if (ts.isPropertyAccessExpression(node)) {
      const object = this.expression(module, node.expression, scope, phase);
      const property = node.name.text;
      let type: ValueType;
      if (object.type === 'focus' && ['focused', 'focusVisible', 'focusable'].includes(property))
        type = 'state:boolean';
      else if (object.type === 'props') {
        const prop = this.props.get(property);
        if (!prop) rejectNode(node, 'PUI1006', `Read of undeclared prop ${property}.`);
        type = prop.type;
      } else if (object.type === 'event' && ['key', 'type', 'control'].includes(property))
        type = property === 'control' ? 'event' : 'string';
      else if (
        object.type === 'event' &&
        ['shiftKey', 'ctrlKey', 'altKey', 'metaKey', 'repeat'].includes(property)
      )
        type = 'boolean';
      else if (object.type === 'focus-options' && ['reason', 'preventScroll'].includes(property))
        type = property === 'reason' ? 'string' : 'boolean';
      else rejectNode(node, 'PUI1004', `Unsupported member ${property} on ${object.type}.`);
      return { kind: 'member', object, property, optional: !!node.questionDotToken, type, span };
    }
    if (ts.isCallExpression(node)) return this.call(module, node, scope, phase);
    rejectNode(
      node,
      'PUI1004',
      `Unsupported expression ${ts.SyntaxKind[node.kind]}; no input code is executed.`
    );
  }

  call(module: SourceModule, node: ts.CallExpression, scope: Scope, phase: Phase): ExpressionIR {
    const span = sourceSpan(node);
    if (node.questionDotToken) rejectNode(node, 'PUI1004', 'Optional calls are unsupported.');
    let operation: Operation | undefined;
    let receiver: ExpressionIR | undefined;
    if (ts.isIdentifier(node.expression)) {
      const name = node.expression.text;
      const binding = scope.get(name);
      if (binding) {
        if (this.activeHelpers.has(name))
          rejectNode(node, 'PUI1008', `Recursive helper ${name} is unsupported.`);
        if (!binding.helper || binding.type !== 'function')
          rejectNode(node, 'PUI1004', `Calling ${name} is not an admitted static helper.`);
        if (phase !== binding.phase)
          rejectNode(node, 'PUI1007', `Helper ${name} belongs to ${binding.phase}, not ${phase}.`);
        if (node.arguments.length !== binding.helper.parameters.length)
          rejectNode(node, 'PUI1006', `Helper ${name} argument count mismatch.`);
        const args = node.arguments.map((argument) =>
          this.expression(module, argument, scope, phase)
        );
        for (let index = 0; index < args.length; index++) {
          if (
            binding.helper.parameters[index].type !== 'unknown' &&
            args[index].type !== binding.helper.parameters[index].type
          )
            rejectNode(node.arguments[index], 'PUI1006', 'Helper argument type mismatch.');
        }
        return { kind: 'helper-call', name, arguments: args, type: 'void', span };
      }
      const imported = module.imports.get(name);
      if (imported?.module === '@proto.ui/hooks') operation = HOOKS[imported.exported];
      else if (imported?.module.startsWith('.')) {
        if (phase !== 'setup' || node.arguments.length)
          rejectNode(node, 'PUI1007', 'Authored hooks require a static no-argument setup call.');
        const definition = this.graph.definition(
          this.graph.importedModule(module, imported),
          imported.exported
        );
        if (definition.factory !== 'defineAsHook')
          rejectNode(node, 'PUI1004', 'Only static authored-hook source calls are admitted.');
        const id = `${definition.module.file.fileName}#${imported.exported}`;
        if (this.activeHooks.has(id))
          rejectNode(node, 'PUI1008', 'Recursive authored-hook composition.');
        if (!this.hooks.has(id)) {
          this.activeHooks.add(id);
          const descriptor = this.graph.descriptor(definition.module, definition.node);
          const setup = this.function(definition.module, descriptor.setup, new Map(), 'setup', [
            'def',
          ]);
          this.hooks.set(id, { id, name: descriptor.name, setup, span: descriptor.span });
          this.activeHooks.delete(id);
        }
        this.requirements.add('authored-hook');
        return { kind: 'authored-hook', hookId: id, type: 'void', span };
      } else rejectNode(node, 'PUI1004', `Unadmitted call ${name}.`);
    } else if (ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      const owner = node.expression.expression;
      if (ts.isPropertyAccessExpression(owner) && ts.isIdentifier(owner.expression)) {
        const root = scope.get(owner.expression.text);
        if (root?.type === 'def' || root?.type === 'run') {
          const candidate = `${owner.name.text}.${method}`;
          if (
            Object.hasOwn(OPERATION_RULES, candidate) &&
            OPERATION_RULES[candidate as Operation].receiver === root.type
          ) {
            operation = candidate as Operation;
            receiver = this.expression(module, owner.expression, scope, phase);
          }
        }
      }
      if (!operation) {
        receiver = this.expression(module, owner, scope, phase);
        const family = receiver.type.startsWith('state:') ? 'state' : receiver.type;
        const candidate = `${family}.${method}`;
        if (Object.hasOwn(OPERATION_RULES, candidate)) operation = candidate as Operation;
      }
    }
    if (!operation)
      rejectNode(node, 'PUI1004', 'Call is outside the supported semantic operation set.');
    const rule = OPERATION_RULES[operation];
    if (!rule.phases.includes(phase))
      rejectNode(node, 'PUI1007', `${operation} is not valid in ${phase} phase.`);
    if (node.arguments.length < rule.min || node.arguments.length > rule.max)
      rejectNode(node, 'PUI1006', `Invalid argument count for ${operation}.`);
    this.requirements.add(operation.split('.')[0]);
    const args = node.arguments.map((argument, index): ExpressionIR => {
      if (rule.callback?.at === index) {
        if (!ts.isArrowFunction(argument) && !ts.isFunctionExpression(argument))
          rejectNode(argument, 'PUI1005', 'Registration requires an inline checked callback.');
        return {
          kind: 'function',
          type: 'function',
          function: this.function(
            module,
            argument,
            scope,
            rule.callback.phase,
            rule.callback.parameters
          ),
          span: sourceSpan(argument),
        };
      }
      return this.expression(module, argument, scope, phase);
    });
    this.metadata(operation, node, args, receiver);
    const type =
      operation === 'state.get' && receiver
        ? (receiver.type.slice('state:'.length) as PrimitiveType)
        : rule.result;
    return {
      kind: 'operation',
      operation,
      ...(receiver ? { receiver } : {}),
      arguments: args,
      type,
      span,
    };
  }

  metadata(
    operation: Operation,
    node: ts.CallExpression,
    args: ExpressionIR[],
    receiver?: ExpressionIR
  ): void {
    const span = sourceSpan(node);
    const rule = OPERATION_RULES[operation];
    if (operation.startsWith('state.') && rule.receiver === 'def') {
      this.literalString(args[0], node.arguments[0]);
      if (args[1].type !== rule.result.slice('state:'.length))
        rejectNode(node.arguments[1], 'PUI1006', 'Initial state type differs from declaration.');
    }
    if (
      operation === 'state.set' &&
      receiver &&
      args[0].type !== receiver.type.slice('state:'.length)
    )
      rejectNode(node.arguments[0], 'PUI1006', 'State write type does not match its handle.');
    if (operation === 'props.define') {
      if (args[0].kind !== 'record')
        rejectNode(node, 'PUI1006', 'Props declarations must be literal records.');
      for (const entry of args[0].entries) {
        if (entry.value.kind !== 'record')
          rejectNode(node, 'PUI1006', 'Prop schema must be a literal record.');
        const typeEntry = entry.value.entries.find((item) => item.key === 'type');
        const type = typeEntry?.value.kind === 'literal' ? typeEntry.value.value : undefined;
        if (type !== 'boolean' && type !== 'number' && type !== 'string')
          rejectNode(node, 'PUI1006', 'Only primitive prop types are admitted.');
        const prior = this.props.get(entry.key);
        if (prior && prior.type !== type)
          rejectNode(node, 'PUI1006', `Conflicting prop type ${entry.key}.`);
        this.props.set(entry.key, { name: entry.key, type, span: entry.value.span });
      }
    }
    if (
      operation === 'props.watch' &&
      (args[0].kind !== 'array' ||
        !args[0].elements.length ||
        args[0].elements.some(
          (item) =>
            item.kind !== 'literal' || typeof item.value !== 'string' || !this.props.has(item.value)
        ))
    )
      rejectNode(node.arguments[0], 'PUI1006', 'Watch keys must name declared props.');
    if (
      operation === 'expose.state' ||
      operation === 'expose.event' ||
      operation === 'expose.method'
    ) {
      const name = this.literalString(args[0], node.arguments[0]);
      let exposure: ExposureIR;
      if (operation === 'expose.state') {
        if (!args[1].type.startsWith('state:'))
          rejectNode(node.arguments[1], 'PUI1006', 'Expose state requires a state handle.');
        exposure = {
          name,
          kind: 'state',
          type: args[1].type.slice('state:'.length) as PrimitiveType,
          span,
        };
      } else if (operation === 'expose.event') {
        if (
          args[1].kind !== 'record' ||
          args[1].entries.length !== 1 ||
          args[1].entries[0].key !== 'payload' ||
          args[1].entries[0].value.kind !== 'literal' ||
          args[1].entries[0].value.value !== 'void'
        )
          rejectNode(node, 'PUI1006', 'Only explicit void event payloads are currently admitted.');
        exposure = { name, kind: 'event', payload: 'void', span };
      } else {
        if (args[1].kind !== 'function')
          rejectNode(node, 'PUI1006', 'Expose method needs a checked callback.');
        exposure = { name, kind: 'method', parameters: args[1].function.parameters, span };
      }
      const prior = this.exposes.get(name);
      if (prior && prior.kind !== exposure.kind)
        rejectNode(node, 'PUI1006', `Conflicting exposure ${name}.`);
      this.exposes.set(name, exposure);
    }
    if (operation === 'render.el') this.literalString(args[0], node.arguments[0]);
  }

  literalString(expression: ExpressionIR, node: ts.Node): string {
    if (expression.kind !== 'literal' || typeof expression.value !== 'string' || !expression.value)
      rejectNode(node, 'PUI1006', 'A nonempty static string is required.');
    return expression.value;
  }

  compile(): PrototypeIR {
    const fileName = sourceName(this.options.fileName ?? 'input.proto.ts');
    const module = this.graph.load(fileName);
    const exportName = this.options.exportName ?? 'default';
    const definition = this.graph.definition(module, exportName);
    if (definition.factory !== 'definePrototype')
      rejectNode(definition.node, 'PUI1002', 'A subjectless asHook requires a caller prototype.');
    const descriptor = this.graph.descriptor(definition.module, definition.node);
    const setup = this.function(definition.module, descriptor.setup, new Map(), 'setup', ['def']);
    for (const loaded of this.graph.modules.values()) {
      for (const declaration of loaded.declarations.values()) {
        if (ts.isCallExpression(declaration)) this.graph.descriptor(loaded, declaration);
        else if (ts.isFunctionDeclaration(declaration) && !this.usedFunctions.has(declaration))
          rejectNode(
            declaration,
            'PUI1004',
            'Unreachable runtime function is outside this admitted source unit.'
          );
      }
    }
    const graphText = [...this.graph.modules]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([file, value]) => [file, value.file.text]);
    return {
      schemaVersion: IR_VERSION,
      name: descriptor.name,
      source: {
        file: fileName,
        exportName,
        sha256: createHash('sha256').update(JSON.stringify(graphText)).digest('hex'),
      },
      setup,
      hooks: [...this.hooks.values()],
      props: [...this.props.values()],
      exposes: [...this.exposes.values()],
      requirements: [...this.requirements].sort(),
    };
  }
}

export function parsePrototype(
  source: string,
  options: ParseOptions = {}
): CompileResult<PrototypeIR> {
  try {
    return { ok: true, value: new Frontend(source, options).compile() };
  } catch (error) {
    if (error instanceof CompilerRejection) return { ok: false, diagnostics: [error.diagnostic] };
    const file = sourceName(options.fileName ?? 'input.proto.ts');
    return {
      ok: false,
      diagnostics: [
        {
          code: 'PUI1999',
          category: 'compiler-defect',
          message: `Unexpected frontend failure: ${error instanceof Error ? error.message : String(error)}`,
          span: { file, start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 },
        },
      ],
    };
  }
}
