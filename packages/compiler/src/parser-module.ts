import ts from 'typescript';
import { reject } from './diagnostics';
import type { ParseOptions, SourceSpan } from './ir';
import {
  isLocalSourceSpecifier,
  localSourceBase,
  localSourceCandidates,
  sourceEdges,
  sourceName,
  type SourceEdge,
} from './source-resolution';
import {
  STATIC_CAPABILITY_FACTORIES,
  STATIC_MODULE_FACTORIES,
  STATIC_PACKAGE_CAPABILITIES,
  extractModuleDeclaration,
} from './static-declarations';
import type { ModuleDeclarationIR } from './ir';
import { PACKAGED_HOOKS } from './operations';

export { sourceName } from './source-resolution';

export type FunctionNode =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration;
export interface Imported {
  module: string;
  exported: string;
  node: ts.Node;
}
type SourceExport = string | Imported | { expression: ts.CallExpression };
export type ResolvedSourceBinding =
  | { module: SourceModule; name: string; node: ts.Expression | ts.FunctionDeclaration }
  | { module: null; name: string; imported: Imported };
export interface SourceModule {
  readonly graph: SourceGraph;
  file: ts.SourceFile;
  imports: Map<string, Imported>;
  declarations: Map<string, ts.Expression | ts.FunctionDeclaration>;
  exports: Map<string, SourceExport>;
  starExports: Imported[];
  readonly runtimeEdges: readonly SourceEdge[];
  readonly typeEdges: readonly SourceEdge[];
}
const FACTORIES: Record<string, true> = { definePrototype: true, defineAsHook: true };
const CORE_DECLARATIONS: Record<string, true> = {
  createContextKey: true,
  tw: true,
  ...Object.fromEntries(
    Object.keys(STATIC_CAPABILITY_FACTORIES).map((name) => [name, true as const])
  ),
};
const HOOKS: Record<string, true> = {
  asTrigger: true,
  asFocusable: true,
  asAccessible: true,
  asFocusEntry: true,
  asFocusScope: true,
  asFocusRoving: true,
  asOverlay: true,
  asScrollSurface: true,
  asTextControl: true,
  asImageView: true,
  asTableStructure: true,
  asBoundary: true,
  asHitParticipation: true,
  asCollection: true,
  asCollectionItem: true,
};

export function sourceSpan(node: ts.Node): SourceSpan {
  const file = node.getSourceFile();
  const start = node.getStart(file);
  const first = file.getLineAndCharacterOfPosition(start);
  const last = file.getLineAndCharacterOfPosition(node.end);
  return {
    file: sourceName(file.fileName),
    start,
    end: node.end,
    line: first.line + 1,
    column: first.character + 1,
    endLine: last.line + 1,
    endColumn: last.character + 1,
  };
}

export function rejectNode(node: ts.Node, code: string, message: string): never {
  return reject(code, message, sourceSpan(node));
}

export function identifier(node: ts.Node): string {
  if (!ts.isIdentifier(node) || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(node.text))
    return rejectNode(node, 'PUI1004', 'Use a simple static identifier.');
  return node.text;
}

export function propertyName(node: ts.PropertyName): string {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return rejectNode(node, 'PUI1004', 'Computed/numeric property names are not admitted.');
}

/** Resolves only explicitly supplied sources. No import/evaluation of input modules occurs. */
export class SourceGraph {
  readonly modules = new Map<string, SourceModule>();
  readonly sources: Record<string, string>;
  private readonly loading = new Set<string>();
  private readonly exportReads = new Map<SourceModule, ts.ExportAssignment>();
  private readonly descriptors = new Map<
    ts.CallExpression,
    ReturnType<SourceGraph['descriptor']> | null
  >();

  constructor(input: string, options: ParseOptions) {
    this.sources = Object.create(null);
    const span: SourceSpan = {
      file: '<input>',
      start: 0,
      end: 0,
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 1,
    };
    for (const [file, text] of Object.entries(options.files ?? {})) {
      const identity = sourceName(file);
      if (Object.hasOwn(this.sources, identity) || typeof text !== 'string') {
        reject(
          'PUI1003',
          `Duplicate source identity or invalid text for ${identity}.`,
          span,
          'invalid-input'
        );
      }
      this.sources[identity] = text;
    }
    const entry = sourceName(options.fileName ?? 'input.proto.ts');
    if (Object.hasOwn(this.sources, entry) && this.sources[entry] !== input) {
      reject(
        'PUI1003',
        `Entry source conflicts with graph identity ${entry}.`,
        span,
        'invalid-input'
      );
    }
    this.sources[entry] = input;
  }

  load(fileName: string): SourceModule {
    fileName = sourceName(fileName);
    const cached = this.modules.get(fileName);
    if (cached) return cached;
    const text = this.sources[fileName];
    if (text === undefined) throw new Error(`Source graph lacks ${fileName}`);
    const file = ts.createSourceFile(
      fileName,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    // SourceFile carries parser diagnostics at runtime, although the public TS interface omits them.
    const parsed = file as ts.SourceFile & {
      parseDiagnostics: readonly ts.DiagnosticWithLocation[];
    };
    if (parsed.parseDiagnostics.length) {
      const diagnostic = parsed.parseDiagnostics[0];
      const position = file.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
      reject(
        'PUI1001',
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        {
          file: fileName,
          start: diagnostic.start ?? 0,
          end: (diagnostic.start ?? 0) + (diagnostic.length ?? 0),
          line: position.line + 1,
          column: position.character + 1,
          endLine: position.line + 1,
          endColumn: position.character + 1 + (diagnostic.length ?? 0),
        },
        'invalid-input'
      );
    }
    const edges = sourceEdges(file);
    const result: SourceModule = {
      graph: this,
      file,
      imports: new Map(),
      declarations: new Map(),
      exports: new Map(),
      starExports: [],
      runtimeEdges: edges.filter((edge) => !edge.typeOnly),
      typeEdges: edges.filter((edge) => edge.typeOnly),
    };
    this.modules.set(fileName, result);
    this.loading.add(fileName);
    try {
      // ESM import bindings are instantiated before top-level declarations, even
      // when the import appears later in the source text.
      for (const statement of file.statements) {
        if (!ts.isImportDeclaration(statement)) continue;
        if (statement.attributes)
          rejectNode(statement, 'PUI1003', 'Import attributes are unsupported.');
        if (!ts.isStringLiteral(statement.moduleSpecifier) || !statement.importClause)
          rejectNode(statement, 'PUI1003', 'Side-effect/computed imports are unsupported.');
        const clause = statement.importClause;
        if (clause.isTypeOnly) continue;
        if (clause.namedBindings && !ts.isNamedImports(clause.namedBindings))
          rejectNode(statement, 'PUI1003', 'Namespace imports are unsupported.');
        const specifier = statement.moduleSpecifier.text;
        const bindings: { name: string; exported: string; node: ts.Node }[] = [];
        if (clause.name)
          bindings.push({ name: identifier(clause.name), exported: 'default', node: clause.name });
        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          for (const element of clause.namedBindings.elements) {
            if (element.isTypeOnly) continue;
            bindings.push({
              name: identifier(element.name),
              exported: element.propertyName?.text ?? element.name.text,
              node: element,
            });
          }
          if (!clause.name && clause.namedBindings.elements.length && !bindings.length) continue;
        }
        if (
          specifier !== '@proto.ui/core' &&
          specifier !== '@proto.ui/hooks' &&
          !Object.hasOwn(PACKAGED_HOOKS, specifier) &&
          !Object.hasOwn(STATIC_MODULE_FACTORIES, specifier) &&
          !Object.hasOwn(STATIC_PACKAGE_CAPABILITIES, specifier) &&
          !isLocalSourceSpecifier(specifier)
        )
          rejectNode(statement, 'PUI1003', `Unsupported source package ${specifier}.`);
        for (const { name, exported, node } of bindings) {
          if (
            specifier === '@proto.ui/core'
              ? !Object.hasOwn(FACTORIES, exported) && !Object.hasOwn(CORE_DECLARATIONS, exported)
              : specifier === '@proto.ui/hooks'
                ? !Object.hasOwn(HOOKS, exported)
                : Object.hasOwn(PACKAGED_HOOKS, specifier)
                  ? !Object.hasOwn(PACKAGED_HOOKS[specifier], exported)
                  : Object.hasOwn(STATIC_MODULE_FACTORIES, specifier)
                    ? !Object.hasOwn(STATIC_MODULE_FACTORIES[specifier], exported)
                    : Object.hasOwn(STATIC_PACKAGE_CAPABILITIES, specifier)
                      ? !STATIC_PACKAGE_CAPABILITIES[specifier].includes(exported)
                      : false
          )
            rejectNode(node, 'PUI1003', `Unsupported import ${exported} from ${specifier}.`);
          if (result.imports.has(name))
            rejectNode(node, 'PUI1003', `Duplicate imported binding ${name}.`);
          result.imports.set(name, { module: specifier, exported, node });
        }
      }
      for (const statement of file.statements) {
        if (ts.isImportDeclaration(statement)) continue;
        if (ts.isFunctionDeclaration(statement)) {
          if (
            !statement.name ||
            !statement.body ||
            statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)
          )
            rejectNode(statement, 'PUI1004', 'Only named synchronous functions are admitted.');
          this.add(result, statement.name.text, statement, statement);
        } else if (ts.isVariableStatement(statement)) {
          if (!(statement.declarationList.flags & ts.NodeFlags.Const))
            rejectNode(statement, 'PUI1004', 'Top-level bindings must be immutable.');
          for (const declaration of statement.declarationList.declarations) {
            if (!declaration.initializer)
              rejectNode(declaration, 'PUI1004', 'A declaration requires an initializer.');
            const value = declaration.initializer;
            if (!ts.isCallExpression(value) || !ts.isIdentifier(value.expression))
              rejectNode(
                value,
                'PUI1004',
                'Top-level runtime bindings must be admitted static core declarations.'
              );
            const imported = result.imports.get(value.expression.text);
            if (
              !imported ||
              !(imported.module === '@proto.ui/core'
                ? Object.hasOwn(FACTORIES, imported.exported) ||
                  Object.hasOwn(CORE_DECLARATIONS, imported.exported)
                : Object.hasOwn(STATIC_MODULE_FACTORIES[imported.module] ?? {}, imported.exported))
            )
              rejectNode(value, 'PUI1004', 'Top-level source execution is not admitted.');
            if (
              imported.exported === 'tw' &&
              (!value.arguments.length ||
                value.arguments.some((argument) => !ts.isStringLiteral(argument)))
            )
              rejectNode(
                value,
                'PUI1004',
                'Top-level style declarations require static string literals.'
              );
            this.add(result, identifier(declaration.name), value, statement);
          }
        } else if (ts.isExportAssignment(statement)) {
          if (statement.isExportEquals)
            rejectNode(statement, 'PUI1002', 'CommonJS export assignment is unsupported.');
          if (ts.isIdentifier(statement.expression)) {
            this.publishExport(result, 'default', statement.expression.text, statement);
            this.exportReads.set(result, statement);
          } else if (ts.isCallExpression(statement.expression))
            this.publishExport(result, 'default', { expression: statement.expression }, statement);
          else
            rejectNode(
              statement,
              'PUI1002',
              'Default export must name or define a static prototype.'
            );
        } else if (ts.isExportDeclaration(statement)) {
          if (statement.attributes)
            rejectNode(statement, 'PUI1003', 'Export attributes are unsupported.');
          if (statement.isTypeOnly) continue;
          if (
            statement.exportClause &&
            ts.isNamedExports(statement.exportClause) &&
            statement.exportClause.elements.length > 0 &&
            statement.exportClause.elements.every((element) => element.isTypeOnly)
          )
            continue;
          if (
            statement.moduleSpecifier &&
            (!ts.isStringLiteral(statement.moduleSpecifier) ||
              !isLocalSourceSpecifier(statement.moduleSpecifier.text))
          )
            rejectNode(statement, 'PUI1003', 'Only local static re-exports are admitted.');
          if (!statement.exportClause) {
            if (!statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier))
              rejectNode(statement, 'PUI1003', 'A wildcard export requires a local source.');
            result.starExports.push({
              module: statement.moduleSpecifier.text,
              exported: '*',
              node: statement,
            });
            continue;
          }
          if (!ts.isNamedExports(statement.exportClause))
            rejectNode(statement, 'PUI1003', 'Namespace re-exports are unsupported.');
          for (const element of statement.exportClause.elements) {
            if (element.isTypeOnly) continue;
            const local = element.propertyName?.text ?? element.name.text;
            if (statement.moduleSpecifier) {
              if (
                !ts.isStringLiteral(statement.moduleSpecifier) ||
                !isLocalSourceSpecifier(statement.moduleSpecifier.text)
              )
                rejectNode(statement, 'PUI1003', 'Only local named re-exports are admitted.');
              this.publishExport(
                result,
                element.name.text,
                { module: statement.moduleSpecifier.text, exported: local, node: element },
                element
              );
            } else this.publishExport(result, element.name.text, local, element);
          }
        } else if (
          !ts.isInterfaceDeclaration(statement) &&
          !ts.isTypeAliasDeclaration(statement) &&
          !ts.isEmptyStatement(statement)
        )
          rejectNode(
            statement,
            'PUI1004',
            'Unsupported top-level statement; compilation never executes input code.'
          );
      }
      // All runtime edges are checked, including empty binding lists and stars;
      // type-only edges retain provenance but never introduce runtime behavior.
      for (const edge of result.runtimeEdges) {
        if (isLocalSourceSpecifier(edge.specifier))
          this.importedModule(result, { module: edge.specifier, exported: '*', node: edge.node });
      }
      return result;
    } catch (error) {
      this.modules.delete(fileName);
      this.exportReads.delete(result);
      throw error;
    } finally {
      this.loading.delete(fileName);
    }
  }

  /** Reject unresolved static exports, including those outside the selected entry. */
  validateExports(): void {
    for (const module of this.modules.values()) {
      for (const name of this.exportNames(module, new Set())) this.resolveExport(module, name);
      for (const [name, exported] of module.exports) {
        if (typeof exported !== 'string' && 'expression' in exported) {
          const definition = this.definition(module, name);
          this.descriptor(definition.module, definition.node);
        }
      }
      for (const name of module.imports.keys()) this.resolveBinding(module, name);
    }
  }

  /** Resolve aliases to an original declaration or an explicitly admitted package symbol. */
  resolveBinding(module: SourceModule, name: string): ResolvedSourceBinding {
    return this.binding(module, name, new Set());
  }

  resolveCoreImport(module: SourceModule, name: string): string | undefined {
    const binding = this.resolveBinding(module, name);
    return binding.module === null && binding.imported.module === '@proto.ui/core'
      ? binding.name
      : undefined;
  }

  resolveExport(module: SourceModule, name: string): ResolvedSourceBinding {
    const binding = this.exportBinding(module, name, new Set());
    if (!binding) rejectNode(module.file, 'PUI1002', `No static ${name} export.`);
    return binding;
  }

  private binding(
    module: SourceModule,
    name: string,
    visiting: Set<string>
  ): ResolvedSourceBinding {
    const node = module.declarations.get(name);
    if (node) return { module, name, node };
    const imported = module.imports.get(name);
    if (!imported) rejectNode(module.file, 'PUI1002', `No local ${name} binding.`);
    if (!isLocalSourceSpecifier(imported.module))
      return { module: null, name: imported.exported, imported };
    const target = this.importedModule(module, imported);
    const binding = this.exportBinding(target, imported.exported, visiting);
    if (!binding)
      rejectNode(
        imported.node,
        'PUI1002',
        `No static ${imported.exported} export in ${target.file.fileName}.`
      );
    return binding;
  }

  private exportBinding(
    module: SourceModule,
    name: string,
    visiting: Set<string>
  ): ResolvedSourceBinding | undefined {
    const key = JSON.stringify([module.file.fileName, name]);
    if (visiting.has(key)) rejectNode(module.file, 'PUI1008', `Cyclic source export ${name}.`);
    visiting.add(key);
    try {
      const exported = module.exports.get(name);
      if (typeof exported === 'string') {
        const read = name === 'default' ? this.exportReads.get(module) : undefined;
        const declaration = module.declarations.get(exported);
        if (
          read &&
          declaration &&
          !ts.isFunctionDeclaration(declaration) &&
          declaration.pos > read.pos
        )
          rejectNode(
            read.expression,
            'PUI1008',
            `Default export reads ${exported} before initialization.`
          );
        return this.binding(module, exported, visiting);
      }
      if (exported) {
        if ('expression' in exported) return { module, name, node: exported.expression };
        const target = this.importedModule(module, exported);
        const binding = this.exportBinding(target, exported.exported, visiting);
        if (!binding)
          rejectNode(
            exported.node,
            'PUI1002',
            `No static ${exported.exported} export in ${target.file.fileName}.`
          );
        return binding;
      }
      // ESM star forwarding never includes default, and explicit exports above
      // always win. Multiple paths to the same binding are not ambiguous.
      if (name === 'default') return undefined;
      let resolved: ResolvedSourceBinding | undefined;
      for (const star of module.starExports) {
        const binding = this.exportBinding(this.importedModule(module, star), name, visiting);
        if (!binding) continue;
        if (resolved) {
          const same =
            resolved.module === null
              ? binding.module === null &&
                resolved.imported.module === binding.imported.module &&
                resolved.name === binding.name
              : binding.module === resolved.module && resolved.name === binding.name;
          if (!same)
            rejectNode(
              star.node,
              'PUI1002',
              `Ambiguous static ${name} export in ${module.file.fileName}.`
            );
        } else resolved = binding;
      }
      return resolved;
    } finally {
      visiting.delete(key);
    }
  }

  private exportNames(module: SourceModule, visiting: Set<SourceModule>): Set<string> {
    if (visiting.has(module)) rejectNode(module.file, 'PUI1008', 'Cyclic wildcard export graph.');
    visiting.add(module);
    try {
      const names = new Set(module.exports.keys());
      for (const star of module.starExports) {
        for (const name of this.exportNames(this.importedModule(module, star), visiting))
          if (name !== 'default') names.add(name);
      }
      return names;
    } finally {
      visiting.delete(module);
    }
  }

  private add(
    module: SourceModule,
    name: string,
    value: ts.Expression | ts.FunctionDeclaration,
    statement: ts.Statement
  ): void {
    if (module.declarations.has(name) || module.imports.has(name))
      rejectNode(statement, 'PUI1005', `Duplicate/shadowed binding ${name}.`);
    module.declarations.set(name, value);
    if (ts.canHaveModifiers(statement)) {
      const modifiers = ts.getModifiers(statement);
      if (modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword))
        this.publishExport(module, 'default', name, statement);
      else if (modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword))
        this.publishExport(module, name, name, statement);
    }
  }

  private publishExport(
    module: SourceModule,
    name: string,
    value: SourceExport,
    node: ts.Node
  ): void {
    if (module.exports.has(name))
      reject('PUI1002', `Duplicate export ${name}.`, sourceSpan(node), 'invalid-input');
    module.exports.set(name, value);
  }

  importedModule(module: SourceModule, imported: Imported): SourceModule {
    if (!isLocalSourceSpecifier(imported.module))
      rejectNode(imported.node, 'PUI1003', `Not an admitted local source: ${imported.module}.`);
    const base = localSourceBase(module.file.fileName, imported.module);
    const found = localSourceCandidates(base).find((candidate) =>
      Object.hasOwn(this.sources, candidate)
    );
    if (!found)
      rejectNode(
        imported.node,
        'PUI1003',
        `Local source ${imported.module} is absent from the explicit source graph.`
      );
    if (this.loading.has(found))
      rejectNode(
        imported.node,
        'PUI1008',
        `Cyclic runtime source graph: ${module.file.fileName} -> ${found}.`
      );
    return this.load(found);
  }

  definition(
    module: SourceModule,
    exportName: string
  ): { module: SourceModule; node: ts.CallExpression; factory: string } {
    const binding = this.resolveExport(module, exportName);
    if (binding.module === null)
      rejectNode(
        binding.imported.node,
        'PUI1002',
        'Entry must be a static prototype/asHook descriptor.'
      );
    const node = binding.node;
    module = binding.module;
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression))
      rejectNode(node, 'PUI1002', 'Entry must be a static prototype/asHook descriptor.');
    const factory = module.imports.get(node.expression.text);
    if (factory?.module !== '@proto.ui/core' || !Object.hasOwn(FACTORIES, factory.exported))
      rejectNode(node, 'PUI1002', 'Factory must resolve to the admitted core import.');
    return { module, node, factory: factory.exported };
  }

  private checkedModuleDeclarations(
    module: SourceModule,
    input: ts.Expression
  ): ModuleDeclarationIR[] {
    let node = input;
    while (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node)
    )
      node = node.expression;
    if (ts.isArrayLiteralExpression(node)) {
      const declarations: ModuleDeclarationIR[] = [];
      const ids = new Set<string>();
      for (const expression of node.elements) {
        if (ts.isSpreadElement(expression)) {
          for (const declaration of this.checkedModuleDeclarations(module, expression.expression)) {
            if (ids.has(declaration.id))
              rejectNode(expression, 'PUI1025', `Duplicate Module declaration ${declaration.id}.`);
            ids.add(declaration.id);
            declarations.push(declaration);
          }
        } else {
          const declaration = extractModuleDeclaration(module, expression);
          if (!declaration)
            rejectNode(expression, 'PUI1025', 'Use an admitted static Module declaration factory.');
          if (ids.has(declaration.id))
            rejectNode(expression, 'PUI1025', `Duplicate Module declaration ${declaration.id}.`);
          ids.add(declaration.id);
          declarations.push(declaration);
        }
      }
      return declarations;
    }
    const receiver =
      ts.isPropertyAccessExpression(node) && node.name.text === 'modules'
        ? node.expression
        : ts.isElementAccessExpression(node) &&
            node.argumentExpression &&
            ts.isStringLiteral(node.argumentExpression) &&
            node.argumentExpression.text === 'modules'
          ? node.expression
          : undefined;
    if (!receiver || !ts.isIdentifier(receiver))
      rejectNode(
        node,
        'PUI1025',
        'Module requirements must be checked declaration arrays or static descriptor modules snapshots.'
      );
    const binding = this.resolveBinding(module, receiver.text);
    if (
      binding.module === null ||
      !ts.isCallExpression(binding.node) ||
      !ts.isIdentifier(binding.node.expression)
    )
      rejectNode(node, 'PUI1025', 'Module snapshots require an admitted static core descriptor.');
    const factory = this.resolveCoreImport(binding.module, binding.node.expression.text);
    if (!factory || !Object.hasOwn(FACTORIES, factory))
      rejectNode(node, 'PUI1025', 'Module snapshots require an admitted static core descriptor.');
    if (binding.module === module && binding.node.pos > node.pos)
      rejectNode(node, 'PUI1008', `Module snapshot reads ${receiver.text} before initialization.`);
    return this.descriptor(binding.module, binding.node).modules;
  }

  descriptor(
    module: SourceModule,
    node: ts.CallExpression
  ): { name: string; setup: FunctionNode; modules: ModuleDeclarationIR[]; span: SourceSpan } {
    const previous = this.descriptors.get(node);
    if (previous === null) rejectNode(node, 'PUI1008', 'Cyclic static Module requirements.');
    if (previous) return previous;
    this.descriptors.set(node, null);
    try {
      if (node.arguments.length !== 1 || !ts.isObjectLiteralExpression(node.arguments[0]))
        rejectNode(node, 'PUI1006', 'Definition requires one literal object.');
      let name: string | undefined;
      let setup: FunctionNode | undefined;
      let modules: ModuleDeclarationIR[] | undefined;
      const keys = new Set<string>();
      for (const property of node.arguments[0].properties) {
        if (
          !ts.isPropertyAssignment(property) &&
          !ts.isMethodDeclaration(property) &&
          !ts.isShorthandPropertyAssignment(property)
        )
          rejectNode(property, 'PUI1006', 'Descriptor spread is unsupported.');
        const key = propertyName(property.name);
        if (keys.has(key)) rejectNode(property, 'PUI1006', `Duplicate descriptor key ${key}.`);
        keys.add(key);
        if (
          key === 'name' &&
          ts.isPropertyAssignment(property) &&
          ts.isStringLiteral(property.initializer)
        )
          name = property.initializer.text;
        else if (key === 'modules' && ts.isPropertyAssignment(property)) {
          modules = this.checkedModuleDeclarations(module, property.initializer);
        } else if (key === 'setup') {
          const value = ts.isMethodDeclaration(property)
            ? property
            : ts.isShorthandPropertyAssignment(property)
              ? property.name
              : property.initializer;
          if (
            ts.isMethodDeclaration(value) ||
            ts.isArrowFunction(value) ||
            ts.isFunctionExpression(value)
          )
            setup = value;
          else if (ts.isIdentifier(value)) {
            const declaration = module.declarations.get(value.text);
            if (declaration && ts.isFunctionDeclaration(declaration)) setup = declaration;
            else rejectNode(value, 'PUI1006', 'Setup must resolve to a local source function.');
          } else rejectNode(value, 'PUI1006', 'Setup must be a static function.');
        } else
          rejectNode(
            property,
            'PUI1006',
            `Unsupported descriptor property ${key}; module requirements cannot be silently discarded.`
          );
      }
      if (!name || !setup)
        rejectNode(node, 'PUI1006', 'Definition requires a nonempty name and static setup.');
      const descriptor = { name, setup, modules: modules ?? [], span: sourceSpan(node) };
      this.descriptors.set(node, descriptor);
      return descriptor;
    } catch (error) {
      this.descriptors.delete(node);
      throw error;
    }
  }
}
