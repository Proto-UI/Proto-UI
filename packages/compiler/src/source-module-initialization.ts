import ts from 'typescript';
import type { SourceGraph, SourceModule } from './parser-module';
import {
  isSourceFunction,
  rejectNode,
  scalarInitializer,
  staticCallableSelection,
  staticDataInitializer,
  staticGetterRecordInitializer,
  staticScalarMembership,
  unwrapSourceExpression,
} from './source-syntax';

/** Cycle admission is a closed syntax proof, never an input module evaluator. */
export function inertCycleModule(module: SourceModule): boolean {
  if (module.mutableBindings.size || module.starExports.length) return false;
  if (
    [...module.exports.values()].some((value) => typeof value !== 'string' && 'expression' in value)
  )
    return false;
  return [...module.declarations.values()].every(
    (node) =>
      isSourceFunction(node) ||
      (ts.isExpression(node) &&
        (scalarInitializer(node) || staticDataInitializer(node) || staticCallableSelection(node)))
  );
}

interface Identity {
  module: SourceModule;
  name: string;
  node: ts.Expression | ts.FunctionDeclaration;
}
type Observe = (module: SourceModule, name: string, node: ts.Node, isDefault?: boolean) => void;

/** Keep the actual lexical binding: following a const alias too early would erase its TDZ. */
function identity(
  graph: SourceGraph,
  module: SourceModule,
  name: string,
  node: ts.Node,
  observe: Observe = () => {},
  seen = new Set<string>()
): Identity | undefined {
  const declaration = module.declarations.get(name);
  if (declaration) {
    observe(module, name, node);
    return { module, name, node: declaration };
  }
  const imported = module.imports.get(name);
  if (!imported)
    return rejectNode(node, 'PUI1008', `Static initializer has no declared binding ${name}.`);
  // Admitted package exports are linked before these source modules execute.
  // Source aliases still retain their own lexical identity and TDZ above.
  if (!graph.hasSourceSpecifier(imported.module)) return undefined;
  return exportedIdentity(
    graph,
    graph.importedModule(module, imported),
    imported.exported,
    node,
    observe,
    seen
  );
}

function exportedIdentity(
  graph: SourceGraph,
  module: SourceModule,
  name: string,
  node: ts.Node,
  observe: Observe,
  seen: Set<string>
): Identity | undefined {
  const key = `${module.file.fileName}#${name}`;
  if (seen.has(key)) rejectNode(node, 'PUI1008', `Cyclic static initializer alias ${name}.`);
  seen.add(key);
  try {
    const exported = module.exports.get(name);
    if (typeof exported === 'string') {
      if (name === 'default' && module.file.statements.some(ts.isExportAssignment))
        observe(module, 'default', node, true);
      return identity(graph, module, exported, node, observe, seen);
    }
    if (exported && 'expression' in exported) {
      // A checked default factory expression has a real export snapshot, even
      // though there is no authored local name for that initialized value.
      observe(module, name, node, true);
      return { module, name, node: exported.expression };
    }
    if (exported && !('expression' in exported)) {
      if (!graph.hasSourceSpecifier(exported.module)) return undefined;
      return exportedIdentity(
        graph,
        graph.importedModule(module, exported),
        exported.exported,
        node,
        observe,
        seen
      );
    }
    return rejectNode(
      node,
      'PUI1008',
      'Static initializers require an explicit named source binding.'
    );
  } finally {
    seen.delete(key);
  }
}

/** Read only immutable literal booleans. A mutable or runtime-derived guard is not a proof. */
export function moduleBoolean(
  graph: SourceGraph,
  module: SourceModule,
  value: ts.Expression,
  visiting = new Set<ts.Node>()
): boolean {
  value = unwrapSourceExpression(value);
  if (value.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (value.kind === ts.SyntaxKind.FalseKeyword) return false;
  const membership = staticScalarMembership(value);
  if (membership !== undefined) return membership;
  if (ts.isIdentifier(value)) {
    const target = identity(graph, module, value.text, value);
    if (!target)
      return rejectNode(
        value,
        'PUI1008',
        'Static callable selection requires a source literal boolean.'
      );
    if (target.module.mutableBindings.has(target.name))
      rejectNode(
        value,
        'PUI1008',
        'A static callable selection cannot snapshot mutable module storage.'
      );
    if (!ts.isExpression(target.node) || visiting.has(target.node))
      rejectNode(
        value,
        'PUI1008',
        'Static callable selection requires an initialized literal boolean.'
      );
    visiting.add(target.node);
    try {
      return moduleBoolean(graph, target.module, target.node, visiting);
    } finally {
      visiting.delete(target.node);
    }
  }
  return rejectNode(
    value,
    'PUI1008',
    'Static callable selection requires an immutable literal boolean.'
  );
}

/**
 * Validate immediate reads in actual ESM dependency postorder. Function bodies
 * are deferred; functions declared with `function` are initialized at linking.
 * Every other lexical binding, including default-export snapshots, begins in TDZ.
 */
export function validateStaticModuleInitialization(graph: SourceGraph): void {
  const modules = [...graph.modules.values()];
  const initialized = new Map(modules.map((module) => [module, new Set<string>()]));
  const defaultReady = new Set<SourceModule>();
  for (const module of modules)
    for (const [name, declaration] of module.declarations)
      if (ts.isFunctionDeclaration(declaration)) initialized.get(module)!.add(name);
  const active = new Set<SourceModule>(),
    completed = new Set<SourceModule>();
  const observe: Observe = (module, name, node, isDefault) => {
    if (isDefault ? !defaultReady.has(module) : !initialized.get(module)?.has(name))
      rejectNode(node, 'PUI1008', `Module initializer reads ${name} before initialization.`);
  };
  const read = (module: SourceModule, value: ts.Expression): void => {
    value = unwrapSourceExpression(value);
    if (isSourceFunction(value)) return;
    if (staticCallableSelection(value)) {
      read(module, value.condition);
      read(
        module,
        moduleBoolean(graph, module, value.condition) ? value.whenTrue : value.whenFalse
      );
      return;
    }
    if (ts.isPropertyAccessExpression(value)) {
      read(module, value.expression);
      return;
    }
    if (ts.isIdentifier(value)) {
      if (
        value.text === 'undefined' &&
        !module.declarations.has(value.text) &&
        !module.imports.has(value.text)
      )
        return;
      const target = identity(graph, module, value.text, value, observe);
      if (!target) return;
      // A finite container snapshots a scalar let at this initialization point.
      // Its source TDZ is checked above and the semantic parser separately
      // checks the scalar storage type; later writes cannot replay this read.
      if (target.module.mutableBindings.has(target.name) && !scalarInitializer(target.node))
        rejectNode(
          value,
          'PUI1008',
          'Static module initialization requires scalar mutable storage.'
        );
      return;
    }
    if (ts.isObjectLiteralExpression(value)) {
      for (const property of value.properties) {
        if (ts.isPropertyAssignment(property)) read(module, property.initializer);
        else if (ts.isSpreadAssignment(property)) read(module, property.expression);
      }
      return;
    }
    ts.forEachChild(value, (child) => {
      if (ts.isExpression(child)) read(module, child);
    });
  };
  const visit = (module: SourceModule): void => {
    if (completed.has(module) || active.has(module)) return;
    active.add(module);
    for (const edge of module.runtimeEdges) {
      if (graph.hasSourceSpecifier(edge.specifier))
        visit(
          graph.importedModule(module, { module: edge.specifier, exported: '*', node: edge.node })
        );
    }
    const cycle = graph.cyclicModules.has(module);
    for (const statement of module.file.statements) {
      if (ts.isVariableStatement(statement))
        for (const declaration of statement.declarationList.declarations) {
          const value = declaration.initializer && unwrapSourceExpression(declaration.initializer);
          if (!value || !ts.isIdentifier(declaration.name)) continue;
          // Check every admitted eager data/alias initializer, not only the
          // conditional that eventually consumes it. Resolving an alias to a
          // hoisted function must not erase an intermediate lexical TDZ, and
          // creating a getter object still evaluates its ordinary data fields.
          if (
            cycle ||
            ts.isIdentifier(value) ||
            staticDataInitializer(value) ||
            staticCallableSelection(value) ||
            staticGetterRecordInitializer(value)
          )
            read(module, value);
          initialized.get(module)!.add(declaration.name.text);
        }
      else if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
        if (ts.isIdentifier(statement.expression)) read(module, statement.expression);
        defaultReady.add(module);
      }
    }
    active.delete(module);
    completed.add(module);
  };
  for (const module of modules) visit(module);
}
