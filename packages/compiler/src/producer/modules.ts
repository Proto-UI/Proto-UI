import ts from 'typescript';
import { argumentsIn, capabilityParameter, declarationOnly, isConstDeclaration, memberAccess, operand } from './component-syntax.ts';
import type { SourceContext } from './source.ts';

type Factory = 'definePrototype' | 'createContextKey';
type Allocation = { readonly kind: Factory; readonly call: ts.CallExpression };
type Helper = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction;
type Callable = { readonly kind: 'function'; readonly fn: Helper; readonly scope: Frame };
type Known = Allocation | { readonly kind: 'namespace'; readonly symbol: ts.Symbol }
  | { readonly kind: 'extern' } | Callable | undefined;
export type LinkOrigin = (identifier: ts.Identifier) => ts.Expression | undefined;
interface Frame {
  readonly values: ReadonlyMap<ts.Symbol, Known>;
  readonly uses?: { readonly origin: LinkOrigin; readonly resolving: Set<ts.Symbol> };
}

export interface SourceModules {
  componentExport(name: string): ts.CallExpression;
  allocation(node: ts.Expression, factory: Factory, origin?: LinkOrigin): ts.CallExpression;
  publicName(call: ts.CallExpression): string | undefined;
}

function moduleDeclaration(declaration: ts.Declaration): boolean {
  return ts.isExportAssignment(declaration) && ts.isSourceFile(declaration.parent) ||
    isConstDeclaration(declaration) && ts.isVariableStatement(declaration.parent.parent) &&
    ts.isSourceFile(declaration.parent.parent.parent);
}

export function allocationOwner(call: ts.CallExpression): ts.Declaration | undefined {
  let node: ts.Expression = call;
  while (ts.isExpression(node.parent) && operand(node.parent) === call) node = node.parent;
  const declaration = node.parent;
  if (ts.isExportAssignment(declaration) && !declaration.isExportEquals && declaration.expression === node) return declaration;
  if (ts.isVariableDeclaration(declaration) && declaration.initializer === node && moduleDeclaration(declaration)) return declaration;
  return undefined;
}

/** Module evaluation precedes instance creation. Keep actual value origins and initialization
 * order in one pass over value dependencies; the checker also contains type-only and unrelated files. */
export function checkModuleClosure(source: SourceContext, entry: ts.SourceFile, authoring: ts.SourceFile): SourceModules {
  const checker = source.checker;
  const files = new Set<ts.SourceFile>();
  const initialized = new Map<ts.Declaration, Known>();
  const active = new Set<Helper>();
  const empty: Frame = { values: new Map() };
  const exportsByModule = new Map<ts.Symbol, ReadonlyMap<string, ts.Symbol>>();

  function exportsOf(module: ts.Symbol): ReadonlyMap<string, ts.Symbol> {
    let entries = exportsByModule.get(module);
    if (!entries) {
      entries = new Map(checker.getExportsOfModule(module).map(symbol => [symbol.name, symbol]));
      exportsByModule.set(module, entries);
    }
    return entries;
  }

  function runtimeSymbol(symbol: ts.Symbol): ts.Symbol | undefined {
    const seen = new Set<ts.Symbol>();
    while (symbol.flags & ts.SymbolFlags.Alias) {
      if (seen.has(symbol) || symbol.declarations?.some(ts.isTypeOnlyImportOrExportDeclaration)) return undefined;
      seen.add(symbol);
      const target = checker.getImmediateAliasedSymbol(symbol);
      if (!target) return undefined;
      symbol = target;
    }
    return symbol.flags & ts.SymbolFlags.Value ? symbol : undefined;
  }

  /** A star export may give the checker the origin symbol directly, including through `export type *`. */
  function valueExport(file: ts.SourceFile, name: string, seen = new Set<ts.SourceFile>()): ts.Symbol | undefined {
    if (seen.has(file)) return undefined;
    const module = checker.getSymbolAtLocation(file);
    const exported = module && exportsOf(module).get(name);
    if (!exported) return undefined;
    const target = runtimeSymbol(exported);
    if (!target) return undefined;
    const declared = exported.declarations?.find(node => node.getSourceFile() === file);
    if (declared && (!ts.isExportSpecifier(declared) || !declared.parent.parent.moduleSpecifier)) return target;
    seen.add(file);
    try {
      for (const statement of file.statements) {
        if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier || statement.isTypeOnly) continue;
        let origin = name;
        if (statement.exportClause) {
          if (!ts.isNamedExports(statement.exportClause)) continue;
          const specifier = statement.exportClause.elements.find(item => item.name.text === name);
          if (!specifier || specifier.isTypeOnly) continue;
          origin = (specifier.propertyName ?? specifier.name).text;
        } else if (name === 'default') continue;
        const dependency = checker.getSymbolAtLocation(statement.moduleSpecifier)?.declarations?.find(ts.isSourceFile);
        if (dependency && valueExport(dependency, origin, seen) === target) return target;
      }
      return undefined;
    } finally {
      seen.delete(file);
    }
  }

  function reference(node: ts.Expression, symbol: ts.Symbol, frame: Frame): Known {
    if (frame.values.has(symbol)) return frame.values.get(symbol);
    if (frame.uses && ts.isIdentifier(node)) {
      const actual = frame.uses.origin(node);
      if (actual) {
        if (frame.uses.resolving.has(symbol)) return source.missing(node, 'producer/link-argument-cycle', 'This lexical argument needs a finite chain to its bound source origin.');
        frame.uses.resolving.add(symbol);
        try { return value(actual, frame); }
        finally { frame.uses.resolving.delete(symbol); }
      }
    }
    const declaration = symbol.valueDeclaration;
    if (symbol.declarations?.some(ts.isSourceFile)) return { kind: 'namespace', symbol };
    const fn = symbol.declarations?.find((item): item is ts.FunctionDeclaration => ts.isFunctionDeclaration(item) && !!item.body);
    if (fn) {
      if (!files.has(fn.getSourceFile())) return source.missing(node, 'producer/external-link', 'The callable declaration is outside the reached runtime module closure.');
      return { kind: 'function', fn, scope: ts.isSourceFile(fn.parent) ? empty : frame };
    }
    if (!declaration || declaration.getSourceFile().isDeclarationFile) return undefined;
    if (initialized.has(declaration)) return initialized.get(declaration);
    if (!files.has(declaration.getSourceFile())) return source.missing(node, 'producer/external-link', 'The value declaration is outside the reached runtime module closure.');
    if (moduleDeclaration(declaration)) {
      return source.missing(node, 'producer/module-initialization-order', 'An eager module read precedes initialization of its resolved binding.');
    }
    return source.missing(node, 'producer/source-link-binding', 'This reference needs a proved initialized binding in its own lexical invocation and source unit.');
  }

  function callHelper(call: ts.CallExpression, callable: Callable, caller: Frame): Known {
    const { fn } = callable;
    if (!fn.body || fn.asteriskToken || fn.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword) || active.has(fn)) {
      return source.missing(call, 'producer/module-link-helper', 'Following this helper needs its finite synchronous authored return.');
    }
    argumentsIn(source, call, fn.parameters.length, fn.parameters.length, 'producer/module-link-arguments');
    const locals = new Map(callable.scope.values);
    const frame: Frame = { ...callable.scope, values: locals };
    for (const [index, parameter] of fn.parameters.entries()) {
      const name = capabilityParameter(source, parameter, 'producer/module-link-parameter');
      locals.set(source.symbol(name), value(call.arguments[index]!, caller));
    }
    active.add(fn);
    try {
      if (!ts.isBlock(fn.body)) return value(fn.body, frame);
      for (const statement of fn.body.statements) {
        if (declarationOnly(statement)) continue;
        if (ts.isReturnStatement(statement) && statement.expression) return value(statement.expression, frame);
        if (ts.isVariableStatement(statement) && statement.declarationList.flags & ts.NodeFlags.Const) {
          for (const item of statement.declarationList.declarations) {
            if (!ts.isIdentifier(item.name) || !item.initializer) return source.missing(item, 'producer/module-link-binding', 'This helper binding needs its destructuring or initialization semantics.');
            locals.set(source.symbol(item.name), value(item.initializer, frame));
          }
          continue;
        }
        return source.missing(statement, 'producer/module-link-helper', 'This reached helper statement needs its effects or control flow represented before following its result.');
      }
      return source.missing(fn.body, 'producer/module-link-return', 'The helper needs a proved returned binding.');
    } finally {
      active.delete(fn);
    }
  }

  // This proves source bindings and the absence of additional effects; it never invokes author code.
  function value(expression: ts.Expression, frame: Frame): Known {
    const node = operand(expression);
    if (ts.isIdentifier(node)) return reference(node, source.symbol(node), frame);
    const access = memberAccess(node);
    if (access) {
      const receiver = value(access.object, frame);
      const module = receiver?.kind === 'namespace' && receiver.symbol.declarations?.find(ts.isSourceFile);
      const target = module && valueExport(module, access.key);
      if (target) return reference(node, target, frame);
      return source.missing(node, 'producer/module-member', 'This member needs a resolved value export on an actual module namespace or its property evaluation semantics.');
    }
    if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) return { kind: 'function', fn: node, scope: frame };
    if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node) || node.kind === ts.SyntaxKind.TrueKeyword ||
        node.kind === ts.SyntaxKind.FalseKeyword || node.kind === ts.SyntaxKind.NullKeyword) return undefined;
    if (ts.isPrefixUnaryExpression(node) && (node.operator === ts.SyntaxKind.MinusToken || node.operator === ts.SyntaxKind.PlusToken) &&
        (ts.isNumericLiteral(node.operand) || source.intrinsic(node.operand, 'Infinity') || source.intrinsic(node.operand, 'NaN'))) {
      value(node.operand, frame);
      return undefined;
    }
    if (ts.isObjectLiteralExpression(node)) {
      for (const member of node.properties) {
        if (ts.isShorthandPropertyAssignment(member) && !member.objectAssignmentInitializer) value(member.name, frame);
        else if (ts.isMethodDeclaration(member) && !ts.isComputedPropertyName(member.name)) continue;
        else if (ts.isPropertyAssignment(member) && !ts.isComputedPropertyName(member.name)) value(member.initializer, frame);
        else return source.missing(member, 'producer/module-member', 'Module initialization needs a proof for this object member.');
      }
      return undefined;
    }
    if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements) value(element, frame);
      return undefined;
    }
    if (ts.isCallExpression(node)) {
      const callee = value(node.expression, frame);
      const factory = (['definePrototype', 'createContextKey', 'declareExtern', 'tw'] as const).find(name => source.intrinsic(node.expression, name));
      if (factory) {
        for (const argument of node.arguments) value(argument, frame);
        if (factory === 'declareExtern') return { kind: 'extern' };
        return factory === 'definePrototype' || factory === 'createContextKey' ? { kind: factory, call: node } : undefined;
      }
      if (callee?.kind === 'function') {
        const result = callHelper(node, callee, frame);
        if (result?.kind === 'definePrototype' || result?.kind === 'createContextKey') return result;
      }
    }
    return source.missing(node, 'producer/module-initializer', 'The producer needs the evaluation effects and origin of this expression before it can emit the component.');
  }

  function visit(file: ts.SourceFile): void {
    if (files.has(file)) return;
    files.add(file);
    for (const statement of file.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      if (!statement.moduleSpecifier || (ts.isImportDeclaration(statement) ? statement.importClause?.isTypeOnly : statement.isTypeOnly)) continue;
      const clause = ts.isImportDeclaration(statement) ? statement.importClause?.namedBindings : statement.exportClause;
      if (clause && (ts.isNamedImports(clause) || ts.isNamedExports(clause)) && clause.elements.length &&
          clause.elements.every(item => item.isTypeOnly) && !(ts.isImportDeclaration(statement) && statement.importClause?.name)) continue;
      const dependency = checker.getSymbolAtLocation(statement.moduleSpecifier)?.declarations?.find(ts.isSourceFile);
      if (dependency === authoring) continue;
      if (!dependency || dependency.isDeclarationFile) return source.missing(statement.moduleSpecifier, 'producer/external-module-effects', 'A value import needs its source module or a declared and bound atomic operation.');
      visit(dependency);
    }
    for (const statement of file.statements) {
      if (declarationOnly(statement) || ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) continue;
      if (ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)) continue;
      if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
        initialized.set(statement, value(statement.expression, empty));
        continue;
      }
      if (ts.isVariableStatement(statement) && statement.declarationList.flags & ts.NodeFlags.Const) {
        for (const declaration of statement.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name) || !declaration.initializer) return source.missing(declaration, 'producer/module-binding', 'Binding this module declaration requires additional initialization coverage.');
          initialized.set(declaration, value(declaration.initializer, empty));
        }
        continue;
      }
      return source.missing(statement, 'producer/module-effects', 'This reached module statement needs its effects represented before emission.');
    }
  }
  visit(entry);

  function requireSite(result: Known, kind: Factory, node: ts.Node): ts.CallExpression {
    const role = kind === 'createContextKey' ? 'context-key' : 'component';
    if (result?.kind === 'extern') return source.missing(node, `producer/external-${role}`, `The external ${role} needs its bound runtime identity and cross-unit linkage.`);
    if (result?.kind !== kind) return source.missing(node, `producer/${role}-origin`, `The ${role} needs a source binding to the resolved authoring ${kind} allocation in this unit.`);
    const owner = allocationOwner(result.call);
    const allocated = owner && initialized.get(owner);
    if (allocated?.kind !== kind || allocated.call !== result.call) {
      return source.missing(result.call, `producer/${role}-lifetime`, `This ${role} allocation needs its creation lifetime and sharing represented; the linker currently realizes immutable, direct module allocations.`);
    }
    return result.call;
  }

  type Published = Map<ts.CallExpression, Map<ts.SourceFile, Set<string>>>;
  let published: Published | undefined;
  function publicBindings(): Published {
    if (published) return published;
    const bindings: Published = new Map();
    for (const file of files) {
      const module = checker.getSymbolAtLocation(file);
      if (!module) continue;
      for (const name of exportsOf(module).keys()) {
        const declaration = valueExport(file, name)?.valueDeclaration;
        const known = declaration && initialized.get(declaration);
        if (known?.kind !== 'createContextKey' && known?.kind !== 'definePrototype') continue;
        let origins = bindings.get(known.call);
        if (!origins) bindings.set(known.call, origins = new Map());
        let names = origins.get(file);
        if (!names) origins.set(file, names = new Set());
        names.add(name);
      }
    }
    return published = bindings;
  }

  return {
    componentExport(name) {
      const target = valueExport(entry, name);
      if (!target) return source.missing(entry, 'producer/entry-export', `The requested value export ${JSON.stringify(name)} is unavailable.`);
      const declaration = target.valueDeclaration;
      return requireSite(declaration && initialized.get(declaration), 'definePrototype', declaration ?? entry);
    },
    allocation(node, factory, origin) {
      const expression = operand(node);
      if (ts.isCallExpression(expression)) {
        const owner = allocationOwner(expression);
        const known = owner && initialized.get(owner);
        if ((known?.kind === 'definePrototype' || known?.kind === 'createContextKey') && known.call === expression) {
          return requireSite(known, factory, node);
        }
      }
      const frame = origin ? { values: empty.values, uses: { origin, resolving: new Set<ts.Symbol>() } } : empty;
      return requireSite(value(node, frame), factory, node);
    },
    publicName(call) {
      const origins = publicBindings().get(call);
      if (!origins) return undefined;
      const owner = allocationOwner(call);
      const direct = owner && ts.isVariableDeclaration(owner) && ts.isIdentifier(owner.name) ? owner.name.text : undefined;
      function select(group: ReadonlySet<string> | undefined): string | undefined {
        if (!group) return undefined;
        if (direct && group.has(direct)) return direct;
        let selected: string | undefined;
        for (const name of group) {
          if (name === 'default') continue;
          if (selected !== undefined) return source.missing(call, 'producer/link-public-aliases', 'Several public aliases select this allocation; the native unit needs their export mapping.');
          selected = name;
        }
        return selected;
      }
      const local = select(origins.get(entry)) ?? select(origins.get(call.getSourceFile()));
      if (local !== undefined) return local;
      const names = new Set<string>();
      for (const group of origins.values()) for (const name of group) names.add(name);
      return select(names) ?? source.missing(call, 'producer/link-default-export', 'This linked declaration has only a default export; its consumer binding in the combined native unit is required.');
    },
  };
}
