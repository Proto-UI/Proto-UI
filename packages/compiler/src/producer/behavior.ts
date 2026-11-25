import ts from 'typescript';
import type { Behavior, Binding, ValueType } from '../targets/component-ir.ts';
import {
  BehaviorBody,
  referenceValue,
  type BehaviorHost,
  type Capability,
  type Facts,
  type Helper,
  type HelperCall,
  type HelperResult,
} from './behavior-body.ts';
import {
  behaviorReturnType,
  checkParameters,
  moduleConstant,
  requireArity,
  staticCallee,
  unparenthesize,
  type BehaviorCallback,
  type Phase,
  type Readable,
  type ResolveRead,
} from './behavior-types.ts';
import type { SourceContext } from './source.ts';
import type { SourceLinks } from './links.ts';

export { behaviorReturnType, behaviorValueType, type BehaviorCallback } from './behavior-types.ts';

interface Produced extends Helper {
  readonly facts: Facts;
}

function inLexicalScope(declaration: Capability, use: ts.Node): boolean {
  const scope = ts.isParameter(declaration) ? declaration.parent : declaration.parent.parent.parent;
  for (let node: ts.Node | undefined = use.parent; node; node = node.parent) {
    if (node === scope) return true;
  }
  return false;
}

export class BehaviorProducer {
  private readonly source: SourceContext;
  private readonly records = new Map<string, Produced>();
  private readonly roots = new Set<string>();
  private readonly constructing = new Set<BehaviorCallback>();
  private readonly host: BehaviorHost;

  constructor(source: SourceContext, resolveRead: ResolveRead, resolveExtern: SourceLinks['resolveExtern']) {
    this.source = source;
    this.host = {
      source,
      resolveRead,
      resolveExtern,
      ordinaryHelper: (call, environment) => this.helper(call, environment),
    };
  }

  callback(binding: Binding, phase: Phase, node: BehaviorCallback, reader: boolean, declaredParams?: readonly ValueType[]): string {
    const body = new BehaviorBody(this.host, binding, phase, node);
    body.callback(node, reader, undefined, declaredParams);
    return this.addRoot(body);
  }

  expression(
    binding: Binding,
    phase: Phase,
    expression: ts.Expression,
    reader: ts.ParameterDeclaration | undefined,
    aliases: readonly ts.VariableDeclaration[] = []
  ): string {
    const body = new BehaviorBody(this.host, binding, phase, expression);
    if (reader) {
      checkParameters(this.source, [reader]);
      body.bindCapability(reader);
    }
    for (const alias of aliases) body.bindAlias(alias);
    body.result(expression, expression);
    return this.addRoot(body);
  }

  read(binding: Binding, reference: Readable): string {
    const facts: Facts = { reads: new Set(), calls: new Set(), ordered: false };
    const result = referenceValue(reference, facts);
    const entry = JSON.stringify(['read-entry', binding.id]);
    const behavior: Behavior = {
      binding,
      phase: 'pure',
      params: [],
      entry,
      dependencies: [...facts.reads],
      blocks: [
        {
          id: entry,
          params: [],
          instructions: [],
          end: { kind: 'return', source: binding.source, value: result.value },
        },
      ],
    };
    this.records.set(binding.id, { behavior, facts, captures: [] });
    this.roots.add(binding.id);
    return binding.id;
  }

  private addRoot(body: BehaviorBody): string {
    const behavior = body.finish();
    this.records.set(behavior.binding.id, { behavior, facts: body.facts, captures: body.captures });
    this.roots.add(behavior.binding.id);
    return behavior.binding.id;
  }

  private helper(call: ts.CallExpression, environment: HelperCall): HelperResult {
    const source = this.source;
    const callee = unparenthesize(call.expression);
    let symbol = source.symbol(callee);
    let expressionBody: ts.ArrowFunction | ts.FunctionExpression | undefined;
    // Module initialization has run. Follow only immutable aliases, or the
    // actual authored callable expression installed by an initializer/export.
    const visited = new Set<ts.Symbol>();
    while (!visited.has(symbol)) {
      visited.add(symbol);
      const declaration = symbol.valueDeclaration;
      const initializer =
        declaration && ts.isExportAssignment(declaration) && !declaration.isExportEquals
          ? declaration.expression
          : moduleConstant(symbol)?.initializer;
      if (!initializer) break;
      const expression = unparenthesize(initializer);
      if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
        expressionBody = expression;
        break;
      }
      if (!staticCallee(source, expression)) break;
      symbol = source.symbol(expression);
    }
    const declarations = symbol.declarations?.filter(ts.isFunctionDeclaration) ?? [];
    const resolved = source.checker.getResolvedSignature(call)?.declaration;
    const fn = expressionBody ?? (declarations.length === 1 ? declarations[0] : undefined);
    if (!fn?.body || resolved !== fn || fn.getSourceFile().isDeclarationFile) {
      return source.missing(
        call,
        'producer/helper-source',
        'This call needs an unambiguous resolved implementation with an authored body and concrete signature.'
      );
    }
    requireArity(source, call, fn.parameters.length);
    if (this.constructing.has(fn)) {
      return source.missing(
        call,
        'producer/recursive-helper',
        'This reached source helper cycle needs recursive-call support in the receiver.'
      );
    }
    const { actionScope, symbolicArgs } = environment;
    const inherited = [...environment.lexical].filter(({ declaration }) =>
      inLexicalScope(declaration, fn)
    );
    const result = behaviorReturnType(source, fn);
    const hasReader =
      inherited.some(({ value }) => value.kind === 'reader') ||
      [...symbolicArgs.values()].some((value) => value.kind === 'reader');
    const name = fn.name?.text ?? symbol.getName();
    const canCapture = (symbol: ts.Symbol): boolean => {
      const declaration = symbol.valueDeclaration;
      return !!declaration && (ts.isParameter(declaration) ||
        (ts.isVariableDeclaration(declaration) && ts.isVariableDeclarationList(declaration.parent) &&
         !!(declaration.parent.flags & ts.NodeFlags.Const))) && inLexicalScope(declaration, fn);
    };
    if (environment.inline && hasReader) {
      const lowered = environment.inline({ fn, name, result, lexical: inherited, canCapture });
      if (lowered) return lowered;
    }
    const phase = result === 'unit' && actionScope && hasReader ? 'action' : 'pure';
    // Specialize on the handle binding. A context read keeps its consumed
    // binding ID so each invocation reads through the current logical provider.
    const role = JSON.stringify([
      'behavior-helper',
      phase,
      symbolicArgs.get(0)?.kind === 'reader',
      inherited.map(({ declaration, value }) =>
        value.kind === 'reader'
          ? source.span(declaration)
          : [source.span(declaration), value.kind, value.binding.id]
      ),
      ...[...symbolicArgs]
        .filter(([index, value]) => index !== 0 || value.kind !== 'reader')
        .map(([index, value]) =>
          value.kind === 'reader' ? [index, value.kind] : [index, value.kind, value.binding.id]
        ),
    ]);
    const binding = source.binding(fn, role, name, result);
    const prior = this.records.get(binding.id);
    if (prior) return prior;
    this.constructing.add(fn);
    try {
      const body = new BehaviorBody(this.host, binding, phase, fn, {
        lexical: inherited,
        actionScope,
        capturedType: (symbol) => canCapture(symbol) ? environment.capture(symbol) : undefined,
      });
      body.callback(fn, false, symbolicArgs);
      const emitted = body.finish();
      const behavior =
        phase === 'action' && !body.facts.ordered
          ? { ...emitted, phase: 'pure' as const }
          : emitted;
      const record = { behavior, facts: body.facts, captures: body.captures };
      this.records.set(binding.id, record);
      return record;
    } finally {
      this.constructing.delete(fn);
    }
  }

  finish(): readonly Behavior[] {
    const reached = new Set(this.roots);
    const dependencies = new Map<string, Set<string>>();
    const callers = new Map<string, Set<string>>();
    const work: { fn: string; field: string }[] = [];
    for (const fn of reached) {
      const record = this.records.get(fn);
      // Forward derive bindings belong to the component. The receiver also checks
      // each referenced declaration against the complete component at assembly.
      if (!record) continue;
      dependencies.set(fn, new Set(record.facts.reads));
      for (const field of record.facts.reads) work.push({ fn, field });
      for (const callee of record.facts.calls) {
        reached.add(callee);
        let reverse = callers.get(callee);
        if (!reverse) callers.set(callee, (reverse = new Set()));
        reverse.add(fn);
      }
    }
    while (work.length) {
      const { fn, field } = work.pop()!;
      for (const caller of callers.get(fn) ?? []) {
        const fields = dependencies.get(caller)!;
        if (!fields.has(field)) {
          fields.add(field);
          work.push({ fn: caller, field });
        }
      }
    }
    return [...dependencies].map(([id, reads]) => ({
      ...this.records.get(id)!.behavior,
      dependencies: [...reads],
    }));
  }
}
