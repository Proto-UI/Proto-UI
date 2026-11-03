import type { ExpressionIR, FunctionIR, PrototypeIR, StatementIR } from './ir';
import { operationArgumentRule, type ArgumentRule } from './operations';
import { nativeShape, NativeLexicalScope, type NativeShape } from './template-shape';

type Operation = Extract<ExpressionIR, { kind: 'operation' }>;

type Use = 'declaration' | 'alias' | 'identity' | 'invoke' | 'other';
type Binding = NonNullable<ReturnType<NativeLexicalScope['lookup']>>;
interface Observation {
  readonly expression: ExpressionIR;
  readonly use: Use;
}
interface Entry {
  readonly fn: FunctionIR;
  creations: number;
  readonly uses: Observation[];
  readonly blocked: Set<string>;
}

/**
 * Consumes already validated IR only. Incomplete proof returns no eligible
 * functions, never a new DSL rejection. All syntax is visited, not merely the
 * functions/branches believed invoked by the native child context collector.
 *
 * The emitter preserves each original function creation position and parameter
 * list. Only the body proven unobservable by this closed use set is omitted.
 */
export function collectVue2IdentityOnlyFunctions(
  ir: PrototypeIR,
  knownInvoked: ReadonlySet<FunctionIR>
) {
  const entries = new Map<FunctionIR, Entry>();
  const active = new Set<FunctionIR>();
  const roots = new Set([ir.setup, ...ir.hooks.map((hook) => hook.setup)]);
  const incomplete = new Set<string>();

  function entry(fn: FunctionIR): Entry {
    let result = entries.get(fn);
    if (!result) {
      result = { fn, creations: 0, uses: [], blocked: new Set() };
      entries.set(fn, result);
    }
    return result;
  }

  function target(value: ExpressionIR, scope: NativeLexicalScope): FunctionIR | undefined {
    const seen = new Set<Binding>();
    while (value.kind === 'reference') {
      const binding = scope.lookup(value.name);
      if (!binding?.value || seen.has(binding)) {
        if (value.type === 'function') incomplete.add('unresolved-or-cyclic-function-binding');
        return undefined;
      }
      seen.add(binding);
      value = binding.value;
      scope = binding.environment;
    }
    if (value.kind === 'function') return value.function;
    // Do not invent callable propagation through factories/native operations.
    // An unknown callable anywhere disables this deliberately narrow proof.
    if (value.type === 'function') incomplete.add('unresolved-function-origin');
    return undefined;
  }

  function observe(value: ExpressionIR, scope: NativeLexicalScope, use: Use) {
    const fn = target(value, scope);
    if (!fn) return;
    const record = entry(fn);
    record.uses.push({ expression: value, use });
    if (use !== 'declaration' && use !== 'alias' && use !== 'identity') record.blocked.add(use);
  }

  function body(fn: FunctionIR, declaration: NativeLexicalScope) {
    if (active.has(fn)) {
      incomplete.add('recursive-function-graph');
      return;
    }
    active.add(fn);
    let scope = declaration;
    for (const parameter of fn.parameters)
      scope = scope.parameter(parameter.name, undefined, declaration, null);
    try {
      statements(fn.body, scope);
    } finally {
      active.delete(fn);
    }
  }

  function expression(value: ExpressionIR, scope: NativeLexicalScope, use: Use): void {
    if (value.type === 'function' && value.kind !== 'function' && value.kind !== 'reference')
      incomplete.add('unresolved-function-result');
    switch (value.kind) {
      case 'function': {
        const record = entry(value.function);
        record.creations++;
        observe(value, scope, use);
        body(value.function, scope);
        return;
      }
      case 'reference':
        observe(value, scope, use);
        return;
      case 'helper-call': {
        const binding = scope.lookup(value.name);
        const fn = binding?.value ? target(binding.value, binding.environment) : undefined;
        if (!fn) incomplete.add('unresolved-helper-entry');
        else {
          const record = entry(fn);
          record.uses.push({ expression: value, use: 'invoke' });
          record.blocked.add('invoke');
        }
        for (const argument of value.arguments) expression(argument, scope, 'other');
        return;
      }
      case 'binary': {
        const operandUse =
          value.operator === '===' || value.operator === '!==' ? 'identity' : 'other';
        expression(value.left, scope, operandUse);
        expression(value.right, scope, operandUse);
        return;
      }
      case 'unary':
        expression(value.operand, scope, 'other');
        return;
      case 'member':
        expression(value.object, scope, 'other');
        return;
      case 'array':
        for (const item of value.elements) expression(item, scope, 'other');
        return;
      case 'record':
        for (const item of value.entries) expression(item.value, scope, 'other');
        return;
      case 'operation':
        if (value.receiver) expression(value.receiver, scope, 'other');
        for (const argument of value.arguments) expression(argument, scope, 'other');
        return;
      case 'rule':
        expression(value.receiver, scope, 'other');
        for (const state of value.states) expression(state.value, scope, 'other');
        return;
      case 'authored-hook':
        // Every hook root/body is independently visited, including unused hooks.
        return;
      case 'literal':
      case 'context-key':
      case 'static-capability':
      case 'style-handle':
        return;
      default: {
        const unsupported: never = value;
        void unsupported;
        incomplete.add('unknown-expression');
      }
    }
  }

  function statements(values: readonly StatementIR[], initial: NativeLexicalScope) {
    let scope = initial;
    for (const statement of values) {
      switch (statement.kind) {
        case 'const':
          expression(
            statement.value,
            scope,
            statement.value.kind === 'function'
              ? 'declaration'
              : statement.value.kind === 'reference'
                ? 'alias'
                : 'other'
          );
          scope = scope.bind(statement.name, statement.value);
          break;
        case 'effect':
          expression(statement.expression, scope, 'other');
          break;
        case 'return':
          if (statement.value) expression(statement.value, scope, 'other');
          break; // deliberately continue visiting syntactically unreachable uses
        case 'if':
          expression(statement.condition, scope, 'other');
          statements(statement.then, scope);
          statements(statement.otherwise, scope);
          break;
        default: {
          const unsupported: never = statement;
          void unsupported;
          incomplete.add('unknown-statement');
        }
      }
    }
  }

  for (const root of roots) body(root, NativeLexicalScope.empty());
  const eligible = new Set<FunctionIR>();
  for (const record of entries.values()) {
    if (roots.has(record.fn)) record.blocked.add('root-entry');
    if (record.fn.context !== 'helper') record.blocked.add('non-helper-context');
    if (record.creations !== 1) record.blocked.add('non-unique-creation-syntax');
    if (knownInvoked.has(record.fn)) record.blocked.add('known-invoked');
    if (!record.uses.some((use) => use.use === 'identity'))
      record.blocked.add('no-identity-observation');
    if (!incomplete.size && !record.blocked.size) eligible.add(record.fn);
  }
  return { eligible, entries, incomplete };
}

function elementArguments(node: Operation) {
  const second = node.arguments[1];
  const hasProps =
    node.arguments.length > 2 ||
    Boolean(
      second &&
      (second.kind === 'record' ||
        second.type === 'template-props' ||
        second.type === 'record' ||
        (typeof second.type === 'object' && second.type.kind === 'record'))
    );
  return {
    props: hasProps ? second : undefined,
    child: node.arguments.length > 2 ? node.arguments[2] : hasProps ? undefined : second,
  };
}

/**
 * Context discovery only: every shape is obtained from nativeShape, never from
 * a second Vue2 shape inference. Analyze a child-use in each actual lexical
 * call frame before joining its facts. Joining formal types first would lose
 * record-member provenance and declaration/caller separation.
 *
 * This pass never rewrites or clones authored functions. The emitter retains
 * their one function object, lexical captures, aliases and original calls.
 */
export function collectVue2NativeChildShapes(ir: PrototypeIR) {
  const facts = new Map<ExpressionIR, NativeShape[]>();
  const active = new Set<FunctionIR>();
  const invoked = new Set<FunctionIR>();
  const hooks = new Map(ir.hooks.map((hook) => [hook.id, hook.setup]));

  function record(value: ExpressionIR, scope: NativeLexicalScope) {
    const result = nativeShape(value, scope);
    if (!result) {
      throw new Error(
        `Vue2 native child provenance is unresolved at ${value.span.file}:${value.span.line}:${value.span.column}`
      );
    }
    const entries = facts.get(value) ?? [];
    const identity = JSON.stringify(result);
    if (!entries.some((entry) => JSON.stringify(entry) === identity)) entries.push(result);
    facts.set(value, entries);
  }

  interface AuthoredCallable {
    kind: 'authored';
    fn: FunctionIR;
    scope: NativeLexicalScope;
  }
  interface NativeDisposer {
    kind: 'native-disposer';
    operation: Operation;
  }
  type Callable = AuthoredCallable | NativeDisposer;
  // Exact native operation ABI, not a guess from the umbrella function type.
  // The four props watches return registerPropsWatch's () => void; Context
  // subscribe/trySubscribe return ContextScope.subscribe's () => void.
  const nativeDisposers = new Set<Operation['operation']>([
    'props.watch',
    'props.watchAll',
    'props.watchRaw',
    'props.watchRawAll',
    'context.subscribe',
    'context.trySubscribe',
  ]);
  const voidShape = (span: ExpressionIR['span']) =>
    nativeShape(
      {
        kind: 'reference',
        name: '\0vue2-native-disposer-result',
        type: 'void',
        span,
      },
      NativeLexicalScope.empty()
    )!;
  function authored(value: Callable): AuthoredCallable {
    // Checked helper-call and callback positions cannot invoke an operation's
    // unsubscribe result as a lexical helper. Keep this as an internal invariant.
    if (value.kind !== 'authored')
      throw new Error('Native disposer is not an authored helper binding.');
    return value;
  }
  const callableParameters = new WeakMap<object, Callable[]>();
  const resolving = new Set<ExpressionIR>();

  function targets(value: ExpressionIR, scope: NativeLexicalScope): Callable[] {
    if (value.kind === 'function') return [{ kind: 'authored', fn: value.function, scope }];
    if (value.kind === 'operation' && nativeDisposers.has(value.operation))
      return [{ kind: 'native-disposer', operation: value }];
    if (value.kind === 'reference') {
      const binding = scope.lookup(value.name);
      return binding && callableParameters.has(binding)
        ? callableParameters.get(binding)!
        : binding?.value
          ? targets(binding.value, binding.environment)
          : [];
    }
    if (value.kind !== 'helper-call') return [];
    const binding = scope.lookup(value.name);
    const callees = binding?.value ? targets(binding.value, binding.environment) : [];
    // Resolve arguments before entering a result-producing body: a finite
    // wrapper(wrapper(draw)) is not recursive authored execution.
    const arguments_ = value.arguments.map((argument) =>
      argument.type === 'function' ? targets(argument, scope) : undefined
    );
    if (resolving.has(value)) throw new Error('Recursive checked callable provenance.');
    resolving.add(value);
    try {
      const result: Callable[] = [];
      for (const target of callees) {
        const callee = authored(target);
        const local = bind(callee.fn, callee.scope, value.arguments, scope, arguments_);
        function returns(body: readonly StatementIR[], initial: NativeLexicalScope): boolean {
          let current = initial;
          for (const statement of body) {
            if (statement.kind === 'const') current = current.bind(statement.name, statement.value);
            else if (statement.kind === 'return') {
              if (statement.value) result.push(...targets(statement.value, current));
              return true;
            } else if (statement.kind === 'if') {
              const then = returns(statement.then, current);
              const otherwise = returns(statement.otherwise, current);
              if (then && otherwise) return true;
            }
          }
          return false;
        }
        returns(callee.fn.body, local);
      }
      return result;
    } finally {
      resolving.delete(value);
    }
  }

  function bind(
    fn: FunctionIR,
    definition: NativeLexicalScope,
    args?: readonly ExpressionIR[],
    caller = NativeLexicalScope.empty(),
    callableArguments?: readonly (Callable[] | undefined)[]
  ) {
    let local = definition;
    for (const [index, parameter] of fn.parameters.entries()) {
      const actual = args?.[index];
      const formal: ExpressionIR = {
        kind: 'reference',
        name: parameter.name,
        type: parameter.type,
        span: fn.span,
      };
      local = local.parameter(
        parameter.name,
        actual,
        caller,
        args
          ? actual
            ? nativeShape(actual, caller)
            : { kind: 'undefined' }
          : nativeShape(formal, NativeLexicalScope.empty())
      );
      if (parameter.type === 'function' && args) {
        callableParameters.set(
          local.lookup(parameter.name)!,
          callableArguments?.[index] ?? (actual ? targets(actual, caller) : [])
        );
      }
    }
    return local;
  }

  const rootShapes: NativeShape[] = [];
  function renderer(value: ExpressionIR, scope: NativeLexicalScope) {
    const callables = targets(value, scope);
    if (!callables.length)
      throw new Error('Vue2 compiler lost the setup-result callable provenance.');
    for (const callable of callables) {
      if (callable.kind === 'native-disposer') {
        rootShapes.push(voidShape(callable.operation.span));
        continue;
      }
      const args: ExpressionIR[] = [
        {
          kind: 'reference',
          name: '\0vue2-native-renderer',
          type: 'render',
          span: callable.fn.span,
        },
      ];
      enter(callable.fn, callable.scope, args);
      const name = '\0vue2-native-render-entry';
      const declaration = callable.scope.bind(name, {
        kind: 'function',
        function: callable.fn,
        type: 'function',
        span: callable.fn.span,
      });
      // Resolve the returned value with the canonical analyzer, not FunctionIR
      // context or the legacy returnType umbrella.
      const result = nativeShape(
        {
          kind: 'helper-call',
          name,
          arguments: args,
          type: callable.fn.returnType,
          span: callable.fn.span,
        },
        declaration
      );
      rootShapes.push(result ?? { kind: 'invalid' });
    }
  }

  function enter(
    fn: FunctionIR,
    definition: NativeLexicalScope,
    args?: readonly ExpressionIR[],
    caller = NativeLexicalScope.empty()
  ) {
    if (active.has(fn)) throw new Error('Vue2 native context traversal encountered recursive IR.');
    const local = bind(fn, definition, args, caller);
    invoked.add(fn);
    active.add(fn);
    try {
      statements(fn.body, local, fn === ir.setup);
    } finally {
      active.delete(fn);
    }
  }

  function expression(value: ExpressionIR, scope: NativeLexicalScope) {
    switch (value.kind) {
      case 'helper-call': {
        value.arguments.forEach((argument) => expression(argument, scope));
        const binding = scope.lookup(value.name);
        const callees = binding?.value ? targets(binding.value, binding.environment) : [];
        if (!callees.length)
          throw new Error(`Vue2 native context traversal lost helper ${value.name}.`);
        for (const target of callees) {
          const callee = authored(target);
          enter(callee.fn, callee.scope, value.arguments, scope);
        }
        return;
      }
      case 'function':
        // Helpers are visited at their calls, not with a fictitious legacy
        // formal that would poison all later concrete contexts.
        // Declaration alone is not invocation, whatever FunctionIR.context says.
        return;
      case 'operation': {
        if (value.receiver) expression(value.receiver, scope);
        for (const [index, argument] of value.arguments.entries()) {
          expression(argument, scope);
          callbacks(argument, scope, operationArgumentRule(value.operation, index));
        }
        if (value.operation === 'render.el') {
          const child = elementArguments(value).child;
          if (child) record(child, scope);
        }
        return;
      }
      case 'authored-hook': {
        const hook = hooks.get(value.hookId);
        if (!hook) throw new Error(`Vue2 native context traversal lost hook ${value.hookId}.`);
        enter(hook, NativeLexicalScope.empty());
        return;
      }
      case 'array':
        value.elements.forEach((item) => expression(item, scope));
        return;
      case 'record':
        value.entries.forEach((entry) => expression(entry.value, scope));
        return;
      case 'member':
        expression(value.object, scope);
        return;
      case 'binary':
        expression(value.left, scope);
        expression(value.right, scope);
        return;
      case 'unary':
        expression(value.operand, scope);
        return;
    }
  }

  function callbacks(value: ExpressionIR, scope: NativeLexicalScope, rule?: ArgumentRule) {
    if (rule?.callback && (!rule.callback.acceptsValue || value.kind === 'function')) {
      for (const target of targets(value, scope)) {
        const callback = authored(target);
        enter(callback.fn, callback.scope);
      }
    }
    if (rule?.fields && value.kind === 'record') {
      for (const entry of value.entries) callbacks(entry.value, scope, rule.fields[entry.key]);
    }
  }

  function statements(
    body: readonly StatementIR[],
    initial: NativeLexicalScope,
    setup: boolean
  ): boolean {
    let scope = initial;
    for (const statement of body) {
      if (statement.kind === 'const') {
        expression(statement.value, scope);
        scope = scope.bind(statement.name, statement.value);
      } else if (statement.kind === 'effect') expression(statement.expression, scope);
      else if (statement.kind === 'return') {
        if (statement.value) {
          expression(statement.value, scope);
          if (setup && statement.value.type === 'function') renderer(statement.value, scope);
        }
        return true;
      } else {
        expression(statement.condition, scope);
        const then = statements(statement.then, scope, setup);
        const otherwise = statements(statement.otherwise, scope, setup);
        if (then && otherwise) return true;
      }
    }
    return false;
  }

  enter(ir.setup, NativeLexicalScope.empty());
  return {
    invoked,
    identityOnly: collectVue2IdentityOnlyFunctions(ir, invoked).eligible,
    childShape(value: ExpressionIR): NativeShape | undefined {
      const entries = facts.get(value);
      return entries && (entries.length === 1 ? entries[0] : { kind: 'union', items: entries });
    },
    // Setup-void uses the owner's existing default-slot path, not this wrapper.
    // An empty callable set must never make an unknown result into a node.
    resultShape: {
      kind: 'union',
      items: rootShapes.length ? rootShapes : [voidShape(ir.setup.span)],
    } as NativeShape,
  };
}

/** Compiler-only services. Neither lexical frames nor shape facts enter the output. */
export interface Vue2NativeTemplateHost {
  readonly prefix: string;
  readonly styled: boolean;
  readonly resultShape: NativeShape;
  scope(): NativeLexicalScope;
  childShape(value: ExpressionIR): NativeShape | undefined;
  expression(value: ExpressionIR, depth: number): string;
}

/**
 * Native construction, split at the authored commit boundary.
 *
 * The outer IIFEs evaluate the original receiver/arguments exactly once, in JS
 * argument order. Their result is a native paint closure, not a VNode snapshot
 * or a semantic tag/children record. A later native Vue render invokes that
 * closure with current native slots, without re-running authored expressions.
 *
 * This module consumes the sole shared shape analysis. A legacy annotation is
 * deliberately NOT proof of a node. Call-context specialization must resolve
 * it before using these primitives; losing provenance is a compiler defect,
 * not permission to emit a universal runtime template walker.
 */
export function createVue2NativeTemplateEmitter(host: Vue2NativeTemplateHost) {
  let sequence = 0;
  const name = (role: string) => `${host.prefix}${role}${sequence++}`;
  const paintType = `${host.prefix}NativePaint`;
  const childrenType = `${host.prefix}NativeChildren`;
  const frameType = `${host.prefix}NativeSlotFrame`;
  const invalid = "throw new TypeError('[Vue2 native] invalid template child.');";

  function shape(value: ExpressionIR): NativeShape {
    // An identity-observed, never-called body may still have a fully declared
    // scalar child type. Retain its original body instead of replacing it with
    // a throw. This fallback never broadens an unresolved template formal.
    const result = host.childShape(value) ?? nativeShape(value, host.scope());
    if (!result) {
      throw new Error(
        `Vue2 native lowering lost child provenance at ${value.span.file}:${value.span.line}:${value.span.column}`
      );
    }
    return result;
  }

  function type(value: NativeShape): string {
    switch (value.kind) {
      case 'node':
        return paintType;
      case 'text':
        return '(string | number)';
      case 'null':
        return 'null';
      case 'undefined':
        return 'undefined';
      case 'invalid':
        // The generated branch always throws; unknown is never projected.
        return 'unknown';
      case 'array':
        return `Array<${type({ kind: 'union', items: value.items })}>`;
      case 'union':
        return value.items.length
          ? `(${[...new Set(value.items.map(type))].join(' | ')})`
          : 'never';
      case 'legacy-template':
        throw new Error('Vue2 native lowering requires actual template parameter provenance.');
    }
  }

  function append(
    valueShape: NativeShape,
    value: string,
    output: string,
    h: string,
    vm: string,
    slots: string
  ): string {
    switch (valueShape.kind) {
      case 'node':
        return `${output}.push(...${value}(${h}, ${vm}, ${slots}));`;
      case 'text':
        // Vue2 normalizes primitive children to text. Do this only at the
        // native output boundary; the captured authored value stays unchanged.
        // Concatenation avoids resolving an authored lexical `String` binding.
        return `${output}.push('' + (${value}));`;
      case 'null':
      case 'undefined':
        // Preserve Vue2's existing empty-child compatibility, independently of
        // other targets' undefined policy. No draft contract is promoted here.
        return '';
      case 'invalid':
        return invalid;
      case 'legacy-template':
        throw new Error('Vue2 native lowering requires actual template parameter provenance.');
      case 'array': {
        const item = name('Child');
        const itemShape: NativeShape = { kind: 'union', items: valueShape.items };
        return `for (const ${item} of ${value}) { ${append(itemShape, item, output, h, vm, slots)} }`;
      }
      case 'union': {
        const variants: NativeShape[] = [];
        const flatten = (item: NativeShape) => {
          if (item.kind === 'union') item.items.forEach(flatten);
          else variants.push(item);
        };
        valueShape.items.forEach(flatten);
        if (variants.some((item) => item.kind === 'legacy-template')) {
          throw new Error('Vue2 native lowering requires actual template parameter provenance.');
        }
        const kinds = new Set(variants.map((item) => item.kind));
        const branches: string[] = [];
        if (kinds.has('node')) {
          branches.push(
            `if (typeof ${value} === 'function') { ${append({ kind: 'node' }, `/** @type {${paintType}} */ (${value})`, output, h, vm, slots)} }`
          );
        }
        if (kinds.has('text')) {
          branches.push(
            `if (typeof ${value} === 'string' || typeof ${value} === 'number') { ${append({ kind: 'text' }, value, output, h, vm, slots)} }`
          );
        }
        if (kinds.has('null')) branches.push(`if (${value} === null) {}`);
        if (kinds.has('undefined')) branches.push(`if (${value} === undefined) {}`);
        const arrays = variants.filter(
          (item): item is Extract<NativeShape, { kind: 'array' }> => item.kind === 'array'
        );
        if (arrays.length) {
          const arrayShape: NativeShape = {
            kind: 'array',
            items: arrays.flatMap((item) => item.items),
          };
          branches.push(
            `if (Array.isArray(${value})) { ${append(arrayShape, `/** @type {${type(arrayShape)}} */ (${value})`, output, h, vm, slots)} }`
          );
        }
        // These branches are a finite compiled union, not a runtime recursive
        // shape decoder. Nested arrays produce a statically bounded loop nest.
        return branches.length ? `${branches.join(' else ')} else { ${invalid} }` : invalid;
      }
    }
  }

  function paint(valueShape: NativeShape, value: string): string {
    const h = name('H'),
      vm = name('Vm'),
      slots = name('Slots'),
      output = name('Children');
    return `/** @type {${paintType}} */ ((${h}, ${vm}, ${slots}) => {
      /** @type {${childrenType}} */ const ${output} = [];
      ${append(valueShape, value, output, h, vm, slots)}
      return ${output};
    })`;
  }

  /** Only the private owner boundary wraps the returned callable's result.
   * Authored function returns, aliases and helper-call identity are unchanged. */
  function publication(value: string): string {
    const captured = name('Committed');
    return `(/** @param {${type(host.resultShape)}} ${captured} */ (${captured}) => ${paint(host.resultShape, captured)})(${value})`;
  }

  function element(node: Operation, depth: number): string {
    const args = node.arguments;
    const { props: second, child } = elementArguments(node);
    const hasProps = second !== undefined;
    const childShape = child ? shape(child) : { kind: 'undefined' as const };
    const receiver = name('Receiver'),
      tag = name('Tag'),
      a = name('Arg'),
      b = name('Arg');
    const tokens = name('Tokens'),
      h = name('H'),
      vm = name('Vm'),
      slots = name('Slots');
    const output = name('Children'),
      data = name('Data');
    const props =
      hasProps && second?.kind === 'record'
        ? second.entries.find((entry) => entry.key === 'style')
        : undefined;
    const styled = Boolean(props);
    if (styled && !host.styled) throw new Error('Vue2 native style demand was not retained.');
    const parameterTypes = [
      `@param {unknown} ${receiver}`,
      `@param {string} ${tag}`,
      ...(args.length > 1
        ? [
            `@param {${hasProps ? (styled ? `{ style: ${host.prefix}NativeStyleHandle }` : 'object') : type(childShape)}} ${a}`,
          ]
        : []),
      ...(args.length > 2 ? [`@param {${type(childShape)}} ${b}`] : []),
    ];
    const parameters = [
      receiver,
      tag,
      ...(args.length > 1 ? [a] : []),
      ...(args.length > 2 ? [b] : []),
    ];
    return `(/** ${parameterTypes.join(' ')} */ (${parameters.join(', ')}) => {
      ${styled ? `const ${tokens} = ${host.prefix}TemplateStyleTokens(${a}.style);` : ''}
      return /** @type {${paintType}} */ ((${h}, ${vm}, ${slots}) => {
        /** @type {${childrenType}} */ const ${output} = [];
        ${child ? append(childShape, args.length > 2 ? b : a, output, h, vm, slots) : ''}
        /** @type {import('vue').VNodeData & { pre: true }} */ const ${data} = { pre: true${styled ? `, attrs: { 'data-pui-style': ${tokens} }` : ''} };
        return [${h}(${tag}, ${data}, ${output})];
      });
    })(${host.expression(node.receiver!, depth)}, ${args.map((arg) => host.expression(arg, depth)).join(', ')})`;
  }

  function slot(node: Operation, depth: number): string {
    const receiver = name('Receiver');
    const h = name('H'),
      vm = name('Vm'),
      slots = name('Slots');
    return `(/** @param {unknown} ${receiver} */ (${receiver}) =>
      /** @type {${paintType}} */ ((${h}, ${vm}, ${slots}) => {
        if (${slots}.used) throw new Error('[Vue2 native] only one default slot is supported.');
        ${slots}.used = true;
        const scoped = ${vm}.$scopedSlots.default;
        return (scoped ? scoped({}) : ${vm}.$slots.default) || [];
      }))(${host.expression(node.receiver!, depth)})`;
  }

  return {
    publication,
    element,
    slot,
    declarations: `/** @typedef {Array<import('vue').VNode | string>} ${childrenType} */
/** @typedef {{ used: boolean }} ${frameType} */
/** @typedef {(h: import('vue').CreateElement, vm: import('vue').default, slots: ${frameType}) => ${childrenType}} ${paintType} */`,
  };
}
