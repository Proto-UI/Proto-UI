import ts from 'typescript';
import type {
  Binding,
  ComponentIR,
  InitialField,
  InputBinding,
  NamedBehavior,
  ScalarType,
  ValueType,
} from '../targets/component-ir.ts';
import { BehaviorProducer } from './behavior.ts';
import type { Readable } from './behavior-types.ts';
import {
  argumentsIn,
  checkedFunction,
  declarationOnly,
  memberAccess,
  memberValue,
  objectMembers,
  operand,
  sourceFunction,
  sourceLiteral,
  sourceName,
  type Member,
  type SourceFunction,
} from './component-syntax.ts';
import { componentView } from './component-view.ts';
import type { SourceContext } from './source.ts';

const definitionParts = {
  props: 'PropsDefinition',
  state: 'StateDefinition',
  expose: 'ExposeDefinition',
  event: 'EventDefinition',
  context: 'ContextDefinition',
  lifecycle: 'LifecycleDefinition',
} as const;

type DefinitionOwner = 'Definition' | (typeof definitionParts)[keyof typeof definitionParts];
type HandleExport = 'PropHandle' | 'StateHandle' | 'DerivedHandle' | 'EventHandle' | 'ActionHandle';
type Signal = { kind: 'signal'; binding: Binding };
type Action = { kind: 'action'; binding: Binding; parameters: number };
type SetupReference =
  | Readable
  | Signal
  | Action
  | { kind: 'owner'; owner: DefinitionOwner }
  | { kind: 'props'; members: Map<string, Readable> }
  | { kind: 'function'; fn: SourceFunction };
type FrameResult = { site: ts.Node; value: SetupReference | null };

function part(reference: SetupReference | undefined, key: string): SetupReference | undefined {
  if (reference?.kind === 'props') return reference.members.get(key);
  if (
    reference?.kind === 'owner' &&
    reference.owner === 'Definition' &&
    Object.hasOwn(definitionParts, key)
  ) {
    return { kind: 'owner', owner: definitionParts[key as keyof typeof definitionParts] };
  }
  return undefined;
}

class ComponentProducer {
  private readonly source: SourceContext;
  private readonly behaviors: BehaviorProducer;
  private readonly references = new Map<ts.Symbol, SetupReference>();
  private readonly setupFrames = new Set<SourceFunction>();
  private readonly pendingCallbacks: (() => void)[] = [];
  private readonly unusedActionParameters = new Map<string, readonly Binding[]>();
  private readonly props: InputBinding[] = [];
  private readonly fields: InitialField[] = [];
  private readonly signals: Binding[] = [];
  private readonly projections: NamedBehavior[] = [];
  private readonly actions: NamedBehavior[] = [];
  private readonly publicNames = {
    prop: new Set<string>(),
    signal: new Set<string>(),
    projection: new Set<string>(),
    action: new Set<string>(),
  };
  private press?: { call: ts.CallExpression; target: Action };

  constructor(source: SourceContext) {
    // The checker binds a reference even when its setup local has not been initialized. In particular,
    // a hoisted helper can refer to a later const, or a returned closure to a declaration after return.
    const bindingAt = (node: ts.Node): ts.Symbol => {
      const symbol = source.symbol(node);
      const declaration = symbol.valueDeclaration;
      if (
        declaration &&
        (ts.isVariableDeclaration(declaration) || ts.isBindingElement(declaration)) &&
        declaration.name !== node &&
        !this.references.has(symbol)
      ) {
        for (
          let ancestor: ts.Node | undefined = declaration.parent;
          ancestor;
          ancestor = ancestor.parent
        ) {
          if (ts.isFunctionLike(ancestor)) {
            if (this.setupFrames.has(ancestor as SourceFunction)) {
              source.missing(
                node,
                'setup-binding-order',
                `The setup value ${JSON.stringify(symbol.name)} has no established initialization before this use.`
              );
            }
            break;
          }
        }
      }
      return symbol;
    };
    this.source = {
      checker: source.checker,
      data: source.data,
      symbol: bindingAt,
      span: source.span.bind(source),
      binding: source.binding.bind(source),
      method: source.method.bind(source),
      missing: source.missing.bind(source),
      invalid: source.invalid.bind(source),
      intrinsic(expression, exportedName) {
        let base = operand(expression);
        while (ts.isPropertyAccessExpression(base) || ts.isElementAccessExpression(base))
          base = operand(base.expression);
        if (ts.isIdentifier(base) && source.checker.getSymbolAtLocation(base)) bindingAt(base);
        return source.intrinsic(expression, exportedName);
      },
    };
    this.behaviors = new BehaviorProducer(this.source, (expression) => {
      const ref = this.reference(expression);
      if (
        ref &&
        ref.kind !== 'owner' &&
        ref.kind !== 'props' &&
        ref.kind !== 'action' &&
        ref.kind !== 'function'
      )
        return ref;
      return undefined;
    });
  }

  lower(call: ts.CallExpression, publicName: string): ComponentIR {
    const source = this.source;
    if (!publicName)
      return source.missing(
        call,
        'component-public-name',
        'The selected module export needs a nonempty consumer binding.'
      );
    if (!source.intrinsic(call.expression, 'definePrototype')) {
      return source.missing(
        call.expression,
        'prototype-entry',
        'The entry needs the resolved authoring definePrototype binding.'
      );
    }
    argumentsIn(source, call, 1, 1, 'prototype-entry');
    const metadata = objectMembers(source, call.arguments[0]!, 'prototype-definition', [
      'name',
      'setup',
    ]);
    const name = metadata.get('name');
    const setup = metadata.get('setup');
    if (!name || !setup)
      return source.missing(
        call.arguments[0]!,
        'prototype-definition',
        'The definition needs resolved name and setup members.'
      );
    const prototypeName = sourceName(
      source,
      memberValue(source, name, 'prototype-name'),
      'prototype-name'
    );
    const setupFn = this.propertyFunction(setup, 'setup-function');
    const result = this.setupFrame(
      setupFn,
      setupFn.parameters.length ? [{ kind: 'owner', owner: 'Definition' }] : [],
      setup,
      true
    );
    if (result.value?.kind !== 'function')
      return source.missing(
        result.site,
        'setup-view',
        'The setup result needs a resolved returned renderer function.'
      );
    const renderer = checkedFunction(source, result.value.fn, 'setup-view');
    // Resolve callback bodies after setup has declared the handles they close over. Initial field order stays authored.
    for (const lower of this.pendingCallbacks) lower();
    let view = componentView(source, this.behaviors, renderer);
    if (this.press) {
      if (view.tag !== 'button') {
        return source.missing(
          this.press.call,
          'press-connection',
          'This component event needs an owned press connection beyond a button root.'
        );
      }
      view = { ...view, activate: this.press.target.binding.id };
    }
    const lowered = this.behaviors.finish();
    const behaviors = this.unusedActionParameters.size
      ? lowered.map((behavior) => {
          const unused = this.unusedActionParameters.get(behavior.binding.id);
          return unused ? { ...behavior, params: [...behavior.params, ...unused] } : behavior;
        })
      : lowered;
    return {
      // Later interning on the source context must not change a component already handed to a target.
      version: 3,
      name: publicName,
      prototypeName,
      source: source.span(call),
      types: source.data.entries.slice(),
      props: this.props,
      fields: this.fields,
      signals: this.signals,
      behaviors,
      projections: this.projections,
      actions: this.actions,
      view,
    };
  }

  private reference(expression: ts.Expression): SetupReference | undefined {
    const node = operand(expression);
    if (ts.isIdentifier(node)) return this.references.get(this.source.symbol(node));
    const access = memberAccess(node);
    return access && part(this.reference(access.object), access.key);
  }

  private declarePublic(
    kind: keyof ComponentProducer['publicNames'],
    name: string,
    origin: ts.Node
  ): void {
    const names = this.publicNames[kind];
    if (!name || names.has(name)) {
      return this.source.missing(
        origin,
        'public-binding-name',
        `The receiving component needs a distinct, nonempty ${kind} name at this declaration.`
      );
    }
    names.add(name);
  }

  private bind(name: ts.BindingName, reference: SetupReference): void {
    const source = this.source;
    if (ts.isIdentifier(name)) {
      this.references.set(source.symbol(name), reference);
      return;
    }
    if (!ts.isObjectBindingPattern(name)) {
      return source.missing(
        name,
        'setup-binding',
        'An indexed setup binding needs its checked element ownership and iteration semantics.'
      );
    }
    for (const item of name.elements) {
      const key = item.propertyName ?? item.name;
      if (
        item.dotDotDotToken ||
        item.initializer ||
        !(ts.isIdentifier(key) || ts.isStringLiteralLike(key) || ts.isNumericLiteral(key))
      ) {
        return source.missing(
          item,
          'setup-binding',
          'This setup binding requires evaluation of its keys, rest or default.'
        );
      }
      const child = part(reference, key.text);
      if (!child)
        return source.missing(
          item,
          'setup-binding',
          `The owner of ${JSON.stringify(key.text)} has no resolved declaration member here.`
        );
      this.bind(item.name, child);
    }
  }

  private setupFrame(
    fn: SourceFunction,
    args: readonly SetupReference[],
    site: ts.Node,
    viewResult: boolean
  ): FrameResult {
    const source = this.source;
    if (this.setupFrames.has(fn)) {
      return source.missing(
        site,
        'setup-helper-environments',
        'Repeated or recursive setup calls need distinct declaration environments.'
      );
    }
    if (args.length !== fn.parameters.length || !fn.body) {
      return source.missing(
        site,
        'setup-helper-arguments',
        'The setup call needs a proved origin and value for every argument and default.'
      );
    }
    this.setupFrames.add(fn);
    fn.parameters.forEach((parameter, i) => {
      if (
        parameter.dotDotDotToken ||
        parameter.initializer ||
        (ts.isIdentifier(parameter.name) && parameter.name.text === 'this')
      ) {
        source.missing(
          parameter,
          'setup-parameter',
          'This setup parameter needs a receiver, rest or default value proof.'
        );
      }
      this.bind(parameter.name, args[i]!);
    });
    if (!ts.isBlock(fn.body)) return this.setupResult(fn.body, viewResult);
    for (const statement of fn.body.statements) {
      if (declarationOnly(statement)) continue;
      if (ts.isReturnStatement(statement)) {
        return statement.expression
          ? this.setupResult(statement.expression, viewResult)
          : { site: statement, value: null };
      }
      if (
        ts.isVariableStatement(statement) &&
        statement.declarationList.flags & ts.NodeFlags.Const
      ) {
        for (const declaration of statement.declarationList.declarations)
          this.setupLocal(declaration);
        continue;
      }
      if (ts.isExpressionStatement(statement)) {
        const expression = operand(statement.expression);
        if (ts.isCallExpression(expression)) {
          if (this.setupOperation(expression) !== undefined) continue;
          const helper = this.functionValue(expression.expression);
          if (helper) {
            this.forwardSetup(expression, helper, false);
            continue;
          }
        }
        if (ts.isStringLiteralLike(expression)) continue;
      }
      return source.missing(
        statement,
        'setup-statement',
        'This reached setup statement needs its execution, ownership and control path represented.'
      );
    }
    return { site: fn.body, value: null };
  }

  private functionValue(expression: ts.Expression): SourceFunction | undefined {
    const ref = this.reference(expression);
    return ref?.kind === 'function' ? ref.fn : sourceFunction(this.source, expression);
  }

  private propertyFunction(member: Member, role: string): SourceFunction {
    if (ts.isMethodDeclaration(member)) return checkedFunction(this.source, member, role);
    const value = memberValue(this.source, member, role);
    return checkedFunction(this.source, this.functionValue(value) ?? value, role);
  }

  private forwardSetup(
    call: ts.CallExpression,
    helper: SourceFunction,
    viewResult: boolean
  ): FrameResult {
    const source = this.source;
    checkedFunction(source, helper, 'setup-helper');
    argumentsIn(source, call, helper.parameters.length, helper.parameters.length, 'setup-helper');
    // Lower the arguments in the caller scope before introducing any callee bindings.
    const args = call.arguments.map((arg) => {
      const result = this.setupResult(arg, false);
      if (!result.value)
        return source.missing(
          arg,
          'setup-helper-arguments',
          'The setup helper argument needs a represented value.'
        );
      return result.value;
    });
    return this.setupFrame(helper, args, call, viewResult);
  }

  private setupResult(
    expression: ts.Expression,
    viewResult: boolean,
    local?: ts.BindingName
  ): FrameResult {
    const source = this.source;
    const node = operand(expression);
    const alias = this.reference(node);
    if (alias) return { site: expression, value: alias };
    const fn = sourceFunction(source, node);
    if (fn) return { site: expression, value: { kind: 'function', fn } };
    const member = memberAccess(node);
    if (member && ts.isCallExpression(operand(member.object))) {
      const base = this.setupResult(member.object, false).value;
      const value = part(base ?? undefined, member.key);
      if (!value)
        return source.missing(
          node,
          'setup-member',
          'This call result needs its member access lowered with the original receiver.'
        );
      return { site: node, value };
    }
    if (ts.isCallExpression(node)) {
      const declared = this.setupOperation(node);
      if (declared !== undefined) return { site: node, value: declared };
      const passesDeclaration = node.arguments.some((arg) => {
        const value = this.reference(arg);
        return value !== undefined && value.kind !== 'capture';
      });
      // A helper that forwards this setup capability can create declarations of its own. Ordinary
      // value-producing calls in a capture retain their behavior CFG and instance-time evaluation.
      if (viewResult || passesDeclaration) {
        const helper = this.functionValue(node.expression);
        if (!helper)
          return source.missing(
            node.expression,
            'setup-helper',
            'The setup helper needs a resolved authored body for this capability transfer.'
          );
        return this.forwardSetup(node, helper, viewResult);
      }
    }
    if (viewResult)
      return source.missing(
        expression,
        'setup-view',
        'The setup result needs a resolved returned renderer function.'
      );
    if (local && !ts.isIdentifier(local))
      return source.missing(
        local,
        'setup-capture',
        'This capture needs destructuring and an owned environment.'
      );
    const name = local?.text ?? 'setup value';
    const type = source.data.type(node);
    const binding = source.binding(local ?? expression, 'capture', name, type);
    const init = source.binding(expression, 'capture-initializer', name, type);
    this.behaviors.expression(init, 'init', expression, undefined);
    this.fields.push({ kind: 'capture', binding, init: init.id });
    return { site: expression, value: { kind: 'capture', binding } };
  }

  private setupLocal(declaration: ts.VariableDeclaration): void {
    if (!declaration.initializer)
      return this.source.missing(
        declaration,
        'setup-binding',
        'The setup binding needs a proved initializer.'
      );
    const result = this.setupResult(declaration.initializer, false, declaration.name);
    if (!result.value)
      return this.source.missing(
        result.site,
        'setup-operation-result',
        'Binding the result of this registration needs a represented value.'
      );
    this.bind(declaration.name, result.value);
  }

  /** undefined is an ordinary call; null is a reached, represented setup operation without a handle. */
  private setupOperation(call: ts.CallExpression): SetupReference | null | undefined {
    const source = this.source;
    const member = memberAccess(call.expression);
    if (!member) return undefined;
    const owner = this.reference(member.object);
    if (owner?.kind !== 'owner') {
      const signature = source.checker.getResolvedSignature(call)?.declaration;
      if (
        signature &&
        ts.isMethodSignature(signature) &&
        ts.isInterfaceDeclaration(signature.parent) &&
        source.method(call, signature.parent.name.text, member.key)
      ) {
        return source.missing(
          member.object,
          'setup-operation-origin',
          `The receiver of ${member.key} has no established setup capability in this scope.`
        );
      }
      return undefined;
    }
    if (!source.method(call, owner.owner, member.key)) {
      return source.missing(
        call.expression,
        'setup-operation-origin',
        'The method needs a checked declaration belonging to the bound setup capability.'
      );
    }
    switch (owner.owner) {
      case 'Definition':
        if (member.key === 'derive' || member.key === 'action')
          return this.behaviorDeclaration(call, member.key);
        if (member.key === 'task')
          return source.missing(
            call,
            'owned-task',
            'An owned task needs a scheduling policy, suspension segments and owner retirement in the receiving IR.'
          );
        break;
      case 'PropsDefinition':
        if (member.key === 'define') return this.propDeclaration(call);
        break;
      case 'StateDefinition':
        if (member.key === 'define') return this.stateDeclaration(call);
        break;
      case 'ExposeDefinition':
        if (member.key === 'event') return this.eventDeclaration(call);
        if (member.key === 'action' || member.key === 'state')
          return this.exposure(call, member.key);
        break;
      case 'EventDefinition':
        if (member.key === 'on') return this.connection(call);
        break;
      case 'ContextDefinition':
        return source.missing(
          call,
          'logical-context',
          `Context ${member.key} needs nominal keys, logical provider identity and owned subscription lowering.`
        );
      case 'LifecycleDefinition':
        return source.missing(
          call,
          'lifecycle-connection',
          `The lifecycle connection ${member.key} needs a represented owner and creation or retirement boundary.`
        );
    }
    return source.missing(
      call,
      'setup-operation',
      `The checked ${owner.owner}.${member.key} operation has no declaration lowering yet.`
    );
  }

  private propDeclaration(call: ts.CallExpression): SetupReference {
    const source = this.source;
    argumentsIn(source, call, 1, 1, 'prop-schema');
    const handles = source.checker.getTypeAtLocation(call);
    if (
      !(handles.flags & ts.TypeFlags.Object) ||
      source.checker.getIndexInfosOfType(handles).length
    ) {
      return source.missing(
        call.arguments[0]!,
        'prop-schema-domain',
        'The resolved schema needs a concrete record with a closed set of prop handles.'
      );
    }
    const members = new Map<string, Readable>();
    for (const [name, member] of objectMembers(source, call.arguments[0]!, 'prop-schema')) {
      this.declarePublic('prop', name, member.name);
      const schema = objectMembers(
        source,
        memberValue(source, member, 'prop-schema'),
        'prop-field',
        ['type', 'default', 'optional', 'controlMode']
      );
      const typeMember = schema.get('type');
      if (!typeMember)
        return source.missing(member, 'prop-type', 'The prop needs its declared value domain.');
      const typeNode = memberValue(source, typeMember, 'prop-type');
      const schemaType = sourceName(source, typeNode, 'prop-type');
      let scalar: ScalarType;
      switch (schemaType) {
        case 'boolean':
          scalar = 'bool';
          break;
        case 'number':
          scalar = 'number';
          break;
        case 'string':
          scalar = 'text';
          break;
        default:
          return source.missing(
            typeNode,
            'prop-type',
            `The prop domain ${JSON.stringify(schemaType)} needs a receiving value representation.`
          );
      }
      let optional = false;
      const presence = schema.get('optional');
      if (presence) {
        const flag = sourceLiteral(source, memberValue(source, presence, 'prop-presence'));
        if (flag?.kind !== 'bool')
          return source.missing(
            presence,
            'prop-presence',
            'The input schema needs the resolved boolean value of optional.'
          );
        optional = flag.value;
      }
      let controlMode: InputBinding['controlMode'];
      const control = schema.get('controlMode');
      if (control) {
        const policy = sourceLiteral(source, memberValue(source, control, 'prop-control-mode'));
        if (policy?.kind !== 'text' || policy.value !== 'fixed-instance') {
          return source.missing(
            control,
            'prop-control-mode',
            'The declared input control policy needs its permitted presence transitions represented.'
          );
        }
        if (!optional)
          return source.invalid(
            control,
            'PUI_PROP_CONTROL_PRESENCE',
            'A fixed-instance control policy requires an optional input whose presence selects its initial mode.'
          );
        controlMode = policy.value;
      }
      const domain = optional ? source.data.presence(scalar, member) : scalar;
      const property = handles.getProperty(name);
      if (!property)
        return source.missing(
          member.name,
          'prop-schema-domain',
          'The resolved schema result has no handle for this authored prop.'
        );
      const [payload] = this.handleArguments(
        source.checker.getTypeOfSymbolAtLocation(property, call),
        member,
        'PropHandle'
      );
      const checked = source.data.type(member, payload!);
      if (domain !== checked)
        return source.missing(
          member,
          'prop-schema-domain',
          'The authored prop domain and the checked handle payload need the same value and presence type.'
        );
      const binding = source.binding(member, 'prop', name, domain);
      let input: InputBinding = controlMode ? { ...binding, controlMode } : binding;
      const fallback = schema.get('default');
      if (fallback) {
        if (optional)
          return source.invalid(
            fallback,
            'PUI_OPTIONAL_PROP_DEFAULT',
            'An optional input preserves omission and cannot declare a schema default.'
          );
        const valueNode = memberValue(source, fallback, 'prop-default');
        const literal = sourceLiteral(source, valueNode);
        if (!literal)
          return source.missing(
            valueNode,
            'prop-default',
            'This default needs its checked computation represented in the prop schema.'
          );
        if (literal.kind !== scalar)
          return source.invalid(
            valueNode,
            'PUI_PROP_DEFAULT_TYPE',
            `The ${name} default has domain ${literal.kind}; its schema declares ${scalar}.`
          );
        input = { ...binding, default: literal };
      }
      this.props.push(input);
      members.set(name, { kind: 'prop', binding });
    }
    if (handles.getProperties().some((property) => !members.has(property.name))) {
      return source.missing(
        call.arguments[0]!,
        'prop-schema-domain',
        'The resolved schema declares a prop without a corresponding authored field.'
      );
    }
    return { kind: 'props', members };
  }

  /** The trusted declaration returns a handle parameterized by its value. An explicit or inferred widened
   * state/event domain cannot be reconstructed from the narrower first value used in an initializer. */
  private handleArguments(
    type: ts.Type,
    node: ts.Node,
    expected: HandleExport
  ): readonly ts.Type[] {
    const source = this.source;
    if (
      type.flags & ts.TypeFlags.Object &&
      (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference
    ) {
      const handle = type as ts.TypeReference;
      const declared = handle.target
        .getSymbol()
        ?.declarations?.some(
          (decl) => ts.isInterfaceDeclaration(decl) && source.intrinsic(decl.name, expected)
        );
      if (!declared)
        return source.missing(
          node,
          'handle-origin',
          `The operation needs the resolved authoring ${expected} declaration.`
        );
      // An authored alias can rearrange its own type arguments. The handle target's instantiated arguments
      // are authoritative even when the call was written with explicit source type arguments.
      const args = source.checker.getTypeArguments(handle);
      if (args.length === (expected === 'ActionHandle' ? 2 : 1)) return args;
    }
    return source.missing(
      node,
      'handle-value-type',
      'The checked handle needs its concrete payload domain in the receiving IR.'
    );
  }

  private declaredHandle(call: ts.CallExpression, expected: HandleExport): readonly ts.Type[] {
    const source = this.source;
    const signature = source.checker.getResolvedSignature(call);
    if (!signature)
      return source.missing(
        call,
        'handle-value-type',
        'The handle declaration needs a resolved source signature.'
      );
    return this.handleArguments(source.checker.getReturnTypeOfSignature(signature), call, expected);
  }

  private handleType(
    call: ts.CallExpression,
    expected: 'StateHandle' | 'DerivedHandle' | 'EventHandle'
  ): ValueType {
    const [payload] = this.declaredHandle(call, expected);
    return this.source.data.type(call.typeArguments?.[0] ?? call, payload!);
  }

  private actionArity(
    call: ts.CallExpression,
    callback: SourceFunction,
    args: ts.Type,
    binding: Binding
  ): number {
    const source = this.source;
    const origin = call.typeArguments?.[0] ?? call.arguments[1]!;
    if (!source.checker.isTupleType(args))
      return source.missing(
        origin,
        'action-arguments',
        'The action handle needs a finite typed argument tuple.'
      );
    const tuple = args as ts.TupleTypeReference;
    if (tuple.target.elementFlags.some((flag) => flag !== ts.ElementFlags.Required)) {
      return source.missing(
        origin,
        'action-arguments',
        'Optional, rest or variadic action arguments need their own host dispatch representation.'
      );
    }
    const elements = source.checker.getTypeArguments(tuple);
    const actual = callback.parameters.slice(1);
    if (actual.length > elements.length)
      return source.missing(
        actual[elements.length]!,
        'action-arguments',
        'This callback parameter has no supplied argument in the declared action tuple.'
      );
    const unused: Binding[] = [];
    for (const [index, element] of elements.entries()) {
      const named = tuple.target.labeledElementDeclarations?.[index];
      const node =
        named ?? (ts.isTupleTypeNode(origin) ? origin.elements[index] : undefined) ?? origin;
      const type = source.data.type(node, element);
      const parameter = actual[index];
      if (parameter) {
        if (source.data.type(parameter) !== type)
          return source.missing(
            parameter,
            'action-parameter-domain',
            'The callback argument needs the same represented domain as the declared action tuple.'
          );
      } else {
        // A shorter callback ignores these values; the public action still accepts the full declared tuple.
        const name = named && ts.isIdentifier(named.name) ? named.name.text : `arg${index + 1}`;
        unused.push(
          source.binding(node, JSON.stringify(['action-parameter', binding.id, index]), name, type)
        );
      }
    }
    if (unused.length) this.unusedActionParameters.set(binding.id, unused);
    return elements.length;
  }

  private stateDeclaration(call: ts.CallExpression): Readable {
    const source = this.source;
    argumentsIn(source, call, 2, 2, 'state-declaration');
    const name = sourceName(source, call.arguments[0]!, 'state-name');
    const options = objectMembers(source, call.arguments[1]!, 'state-options', ['initialize']);
    const member = options.get('initialize');
    if (!member)
      return source.missing(
        call.arguments[1]!,
        'state-initializer',
        'The state location needs its per-instance initializer.'
      );
    const callback = this.propertyFunction(member, 'state-initializer');
    const type = this.handleType(call, 'StateHandle');
    const binding = source.binding(call, 'state', name, type);
    const init = source.binding(member, 'state-initializer', name, type);
    this.pendingCallbacks.push(() => {
      this.behaviors.callback(init, 'init', callback, true);
    });
    this.fields.push({ kind: 'state', binding, init: init.id });
    return { kind: 'state', binding };
  }

  private behaviorDeclaration(
    call: ts.CallExpression,
    kind: 'derive' | 'action'
  ): Readable | Action {
    const source = this.source;
    argumentsIn(source, call, 2, 2, kind);
    const name = sourceName(source, call.arguments[0]!, `${kind}-name`);
    const argument = call.arguments[1]!;
    const callback = checkedFunction(
      source,
      this.functionValue(argument) ?? argument,
      `${kind}-callback`
    );
    if (kind === 'action') {
      const [args, outcome] = this.declaredHandle(call, 'ActionHandle');
      const type = source.data.type(call.typeArguments?.[1] ?? callback.type ?? callback, outcome!);
      const binding = source.binding(call, kind, name, type);
      const parameters = this.actionArity(call, callback, args!, binding);
      this.pendingCallbacks.push(() => {
        this.behaviors.callback(binding, 'action', callback, true);
      });
      return { kind, binding, parameters };
    }
    const binding = source.binding(call, kind, name, this.handleType(call, 'DerivedHandle'));
    this.pendingCallbacks.push(() => {
      this.behaviors.callback(binding, 'pure', callback, true);
    });
    return { kind, binding };
  }

  private eventDeclaration(call: ts.CallExpression): Signal {
    const source = this.source;
    argumentsIn(source, call, 1, 1, 'event-declaration');
    const name = sourceName(source, call.arguments[0]!, 'event-name');
    this.declarePublic('signal', name, call.arguments[0]!);
    const binding = source.binding(call, 'signal', name, this.handleType(call, 'EventHandle'));
    this.signals.push(binding);
    return { kind: 'signal', binding };
  }

  private exposure(call: ts.CallExpression, kind: 'action' | 'state'): null {
    const source = this.source;
    argumentsIn(source, call, 2, 2, 'public-exposure');
    const name = sourceName(source, call.arguments[0]!, 'public-name');
    this.declarePublic(kind === 'action' ? 'action' : 'projection', name, call.arguments[0]!);
    const target = call.arguments[1]!;
    const handle = this.setupResult(target, false).value;
    if (kind === 'action') {
      if (handle?.kind !== 'action')
        return source.missing(
          target,
          'public-action-origin',
          'The public action needs its resolved owned action declaration.'
        );
      this.actions.push({ name, fn: handle.binding.id });
    } else {
      if (
        !handle ||
        !(handle.kind === 'prop' || handle.kind === 'state' || handle.kind === 'derive')
      ) {
        return source.missing(
          target,
          'public-state-origin',
          'The public projection needs a resolved readable handle from this setup.'
        );
      }
      const binding = source.binding(call, 'public-projection', name, handle.binding.type);
      this.projections.push({ name, fn: this.behaviors.read(binding, handle) });
    }
    return null;
  }

  private connection(call: ts.CallExpression): null {
    const source = this.source;
    argumentsIn(source, call, 2, 2, 'event-connection');
    const event = sourceName(source, call.arguments[0]!, 'semantic-event');
    if (event !== 'press.commit')
      return source.missing(
        call.arguments[0]!,
        'semantic-event',
        `The receiving IR needs a connection for semantic event ${JSON.stringify(event)}.`
      );
    const target = this.setupResult(call.arguments[1]!, false).value;
    if (target?.kind !== 'action')
      return source.missing(
        call.arguments[1]!,
        'event-action-origin',
        'The press connection needs its resolved owned action.'
      );
    if (target.parameters || target.binding.type !== 'unit')
      return source.missing(
        call,
        'press-signature',
        'The receiving press connection dispatches a zero-argument action with unit outcome.'
      );
    if (this.press)
      return source.missing(
        call,
        'press-connections',
        'Multiple owned press subscriptions need ordered connection storage.'
      );
    this.press = { target, call };
    return null;
  }
}

export function lowerComponent(
  source: SourceContext,
  call: ts.CallExpression,
  publicName: string
): ComponentIR {
  return new ComponentProducer(source).lower(call, publicName);
}
