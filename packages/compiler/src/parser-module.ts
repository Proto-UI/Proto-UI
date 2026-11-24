import ts from 'typescript';
import { CompilerRejection, reject, unknownDiagnosticSpan } from './diagnostics';
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
  STATIC_CORE_VALUES,
  STATIC_MODULE_FACTORIES,
  STATIC_PACKAGE_CAPABILITIES,
  extractModuleDeclaration,
} from './static-declarations';
import type { ModuleDeclarationIR } from './ir';
import { hookAdmission } from './hook-admission';
import { extractRuleStyleHandle } from './rule-declarations';
import {
  inertCycleModule,
  validateStaticModuleInitialization,
} from './source-module-initialization';
import {
  identifier,
  isSourceFunction,
  propertyName,
  rejectNode,
  scalarInitializer,
  staticDataInitializer,
  staticCallableSelection,
  staticGetterRecordInitializer,
  sourceSpan,
  unwrapSourceExpression,
  type FunctionNode,
} from './source-syntax';

export { sourceName } from './source-resolution';
export {
  identifier,
  isSourceFunction,
  propertyName,
  rejectNode,
  scalarInitializer,
  staticDataInitializer,
  staticScalarMembership,
  staticCallableSelection,
  staticGetterRecordInitializer,
  staticJoin,
  sourceSpan,
  unwrapSourceExpression,
  type FunctionNode,
} from './source-syntax';
export interface Imported {
  module: string;
  exported: string;
  node: ts.Node;
}
type SourceExport = string | Imported | { expression: ts.CallExpression };
interface SourceDescriptor {
  name: string;
  setup: FunctionNode;
  setupModule: SourceModule;
  projectHandle?: FunctionNode;
  projectModule?: SourceModule;
  configure?: FunctionNode;
  configureModule?: SourceModule;
  mode?: 'once' | 'multiple' | 'configurable';
  modules: ModuleDeclarationIR[];
  span: SourceSpan;
}
export type ResolvedSourceBinding =
  | { module: SourceModule; name: string; node: ts.Expression | ts.FunctionDeclaration }
  | { module: null; name: string; imported: Imported };
export interface SourceModule {
  readonly graph: SourceGraph;
  file: ts.SourceFile;
  imports: Map<string, Imported>;
  declarations: Map<string, ts.Expression | ts.FunctionDeclaration>;
  mutableBindings: Set<string>;
  exports: Map<string, SourceExport>;
  starExports: Imported[];
  readonly runtimeEdges: readonly SourceEdge[];
  readonly typeEdges: readonly SourceEdge[];
}
const FACTORIES: Record<string, true> = {
  definePrototype: true,
  defineAsHook: true,
  defineHook: true,
};
export const CORE_FUNCTIONS = {
  delay: 'scheduler.delay',
  snapshotPresentationCompletionConfig: 'presentation.snapshotCompletion',
} as const;
// Public host composition utilities may occur in the same source export graph
// as Prototypes. They are recognized as imports only: reaching them from a
// compiled owner still has no semantic operation and is rejected by the parser.
const HOST_CORE_IMPORTS: ReadonlySet<string> = new Set(['createControlLabelRef']);
const CORE_DECLARATIONS: Record<string, true> = {
  createContextKey: true,
  tw: true,
  ...Object.fromEntries(
    Object.keys(STATIC_CAPABILITY_FACTORIES).map((name) => [name, true as const])
  ),
};
function admittedPackageSymbol(module: string, name: string): boolean {
  if (module === '@proto.ui/core')
    return (
      Object.hasOwn(FACTORIES, name) ||
      Object.hasOwn(CORE_DECLARATIONS, name) ||
      Object.hasOwn(CORE_FUNCTIONS, name) ||
      Object.hasOwn(STATIC_CORE_VALUES, name) ||
      HOST_CORE_IMPORTS.has(name)
    );
  if (module === '@proto.ui/hooks') return hookAdmission(name) !== undefined;
  return (
    Object.hasOwn(STATIC_MODULE_FACTORIES[module] ?? {}, name) ||
    !!STATIC_PACKAGE_CAPABILITIES[module]?.includes(name)
  );
}

/** Resolves only explicitly supplied sources. No import/evaluation of input modules occurs. */
export class SourceGraph {
  readonly modules = new Map<string, SourceModule>();
  /** Erased type dependencies are parsed for symbols, never admitted as executable modules. */
  readonly typeSources = new Map<string, ts.SourceFile>();
  readonly sources: Record<string, string>;
  readonly sourceImports: Readonly<Record<string, string>>;
  private readonly loading = new Set<string>();
  private readonly declarationsReady = new Set<SourceModule>();
  readonly cyclicModules = new Set<SourceModule>();
  private readonly exportReads = new Map<SourceModule, ts.ExportAssignment>();
  private readonly descriptorReads = new Set<ts.CallExpression>();

  constructor(input: string, options: ParseOptions) {
    this.sources = Object.create(null);
    this.sourceImports = Object.fromEntries(
      Object.entries(options.sourceImports ?? {}).map(([specifier, target]) => [
        specifier,
        sourceName(target),
      ])
    );
    const span = unknownDiagnosticSpan();
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
      mutableBindings: new Set(),
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
          !Object.hasOwn(STATIC_MODULE_FACTORIES, specifier) &&
          !Object.hasOwn(STATIC_PACKAGE_CAPABILITIES, specifier) &&
          !this.hasSourceSpecifier(specifier)
        )
          rejectNode(
            statement,
            'PUI1003',
            `Source package ${specifier} requires an explicit proto export or sourceImports mapping.`
          );
        for (const { name, exported, node } of bindings) {
          const hook = specifier === '@proto.ui/hooks' ? hookAdmission(exported) : undefined;
          if (
            !Object.hasOwn(this.sourceImports, specifier) &&
            (specifier === '@proto.ui/core'
              ? !Object.hasOwn(FACTORIES, exported) &&
                !Object.hasOwn(CORE_DECLARATIONS, exported) &&
                !Object.hasOwn(CORE_FUNCTIONS, exported) &&
                !Object.hasOwn(STATIC_CORE_VALUES, exported) &&
                !HOST_CORE_IMPORTS.has(exported)
              : specifier === '@proto.ui/hooks'
                ? hook === undefined
                : Object.hasOwn(STATIC_MODULE_FACTORIES, specifier)
                  ? !Object.hasOwn(STATIC_MODULE_FACTORIES[specifier], exported)
                  : Object.hasOwn(STATIC_PACKAGE_CAPABILITIES, specifier)
                    ? !STATIC_PACKAGE_CAPABILITIES[specifier].includes(exported)
                    : false)
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
          const mutable = !!(statement.declarationList.flags & ts.NodeFlags.Let);
          if (!(statement.declarationList.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let)))
            rejectNode(statement, 'PUI1004', 'Top-level bindings must use const or let.');
          for (const declaration of statement.declarationList.declarations) {
            if (!declaration.initializer)
              rejectNode(declaration, 'PUI1004', 'A declaration requires an initializer.');
            const value = unwrapSourceExpression(declaration.initializer);
            if (staticCallableSelection(value)) {
              let authored = declaration.initializer;
              while (ts.isParenthesizedExpression(authored)) authored = authored.expression;
              if (authored !== value)
                rejectNode(
                  authored,
                  'PUI1004',
                  'Static module callable selection requires an explicit declaration annotation, not an erased type view.'
                );
            }
            if (scalarInitializer(value)) {
              const name = identifier(declaration.name);
              this.add(result, name, value, statement);
              if (mutable) result.mutableBindings.add(name);
              continue;
            }
            if (mutable)
              rejectNode(
                value,
                'PUI1004',
                'Shared module mutable storage requires pure scalar data; owner closures and capabilities cannot escape into module storage.'
              );
            if (
              (!ts.isIdentifier(value) &&
                staticDataInitializer(value, (call) => this.staticStyleCall(result, call))) ||
              staticCallableSelection(value) ||
              staticGetterRecordInitializer(value)
            ) {
              this.add(result, identifier(declaration.name), value, statement);
              continue;
            }
            if (
              ts.isArrowFunction(value) ||
              ts.isFunctionExpression(value) ||
              ts.isIdentifier(value)
            ) {
              this.add(result, identifier(declaration.name), value, statement);
              continue;
            }
            if (!ts.isCallExpression(value) || !ts.isIdentifier(value.expression))
              rejectNode(
                value,
                'PUI1004',
                'Top-level runtime bindings must be admitted static core declarations.'
              );
            const resolved = this.resolveBinding(result, value.expression.text);
            const imported = resolved.module === null ? resolved.imported : undefined;
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
          if (statement.moduleSpecifier && !ts.isStringLiteral(statement.moduleSpecifier))
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
              if (!ts.isStringLiteral(statement.moduleSpecifier))
                rejectNode(statement, 'PUI1003', 'Only static named re-exports are admitted.');
              if (
                !this.hasSourceSpecifier(statement.moduleSpecifier.text) &&
                !admittedPackageSymbol(statement.moduleSpecifier.text, local)
              )
                rejectNode(
                  element,
                  'PUI1003',
                  `Unsupported re-export ${local} from ${statement.moduleSpecifier.text}.`
                );
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
      this.declarationsReady.add(result);
      for (const edge of result.runtimeEdges) {
        if (this.hasSourceSpecifier(edge.specifier))
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
    validateStaticModuleInitialization(this);
    for (const module of this.modules.values()) {
      for (const name of this.exportNames(module, new Set())) this.resolveExport(module, name);
      for (const [name, exported] of module.exports) {
        if (typeof exported !== 'string' && 'expression' in exported) {
          const definition = this.definition(module, name);
          this.descriptor(definition.module, definition.node);
        }
      }
      for (const name of module.imports.keys()) this.resolveBinding(module, name);
      for (const [name, declaration] of module.declarations) {
        if (!ts.isIdentifier(declaration)) continue;
        const target = this.resolveBinding(module, name);
        if (
          target.module !== null &&
          !isSourceFunction(target.node) &&
          !staticCallableSelection(target.node) &&
          (target.module.mutableBindings.has(target.name) ||
            !ts.isExpression(target.node) ||
            !staticDataInitializer(target.node, (call) =>
              this.staticStyleCall(target.module!, call)
            ))
        )
          rejectNode(
            declaration,
            'PUI1004',
            'Module aliases require immutable static data, a function, or an admitted package symbol.'
          );
      }
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

  /** Resolve immutable token data through the same checked extractor as setup
   * style declarations. No authored function or module initializer is run. */
  private staticStyleCall(module: SourceModule, call: ts.CallExpression): boolean {
    if (
      !ts.isIdentifier(call.expression) ||
      this.resolveCoreImport(module, call.expression.text) !== 'tw'
    )
      return false;
    try {
      extractRuleStyleHandle(module, call);
    } catch (error) {
      if (error instanceof CompilerRejection)
        rejectNode(
          call,
          'PUI1004',
          `Top-level style declarations require immutable static tokens: ${error.message}`
        );
      throw error;
    }
    return true;
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
    if (node) {
      if (!ts.isIdentifier(node)) return { module, name, node };
      const id = `${module.file.fileName}#binding:${name}`;
      if (visiting.has(id)) rejectNode(node, 'PUI1008', `Cyclic source alias ${name}.`);
      visiting.add(id);
      try {
        const target = this.binding(module, node.text, visiting);
        if (
          target.module === module &&
          !ts.isFunctionDeclaration(target.node) &&
          target.node.pos > node.pos
        )
          rejectNode(node, 'PUI1008', `Module alias reads ${node.text} before initialization.`);
        return target;
      } finally {
        visiting.delete(id);
      }
    }
    const imported = module.imports.get(name);
    if (!imported) rejectNode(module.file, 'PUI1002', `No local ${name} binding.`);
    if (!this.hasSourceSpecifier(imported.module))
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
        if (!this.hasSourceSpecifier(exported.module))
          return { module: null, name: exported.exported, imported: exported };
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
    if (!this.hasSourceSpecifier(imported.module))
      rejectNode(imported.node, 'PUI1003', `Not an admitted local source: ${imported.module}.`);
    const mapped = this.sourceImports[imported.module];
    const base = mapped ?? localSourceBase(module.file.fileName, imported.module);
    const found = (mapped ? [mapped] : localSourceCandidates(base)).find((candidate) =>
      Object.hasOwn(this.sources, candidate)
    );
    if (!found)
      rejectNode(
        imported.node,
        'PUI1003',
        `Local source ${imported.module} is absent from the explicit source graph.`
      );
    if (this.loading.has(found)) {
      const names = [...this.loading];
      const cycle = names.slice(names.indexOf(found)).map((name) => this.modules.get(name)!);
      if (cycle.some((item) => !this.declarationsReady.has(item) || !inertCycleModule(item)))
        rejectNode(
          imported.node,
          'PUI1008',
          `Cyclic runtime source graph requires complete inert declarations: ${module.file.fileName} -> ${found}.`
        );
      cycle.forEach((item) => this.cyclicModules.add(item));
    }
    return this.load(found);
  }

  hasSourceSpecifier(specifier: string): boolean {
    return isLocalSourceSpecifier(specifier) || Object.hasOwn(this.sourceImports, specifier);
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
    const factory = this.resolveCoreImport(module, node.expression.text);
    if (!factory || !Object.hasOwn(FACTORIES, factory))
      rejectNode(node, 'PUI1002', 'Factory must resolve to the admitted core import.');
    return { module, node, factory };
  }

  /** Finite module literals, preserving the identity of any admitted intrinsic. */
  staticDataDeclaration(module: SourceModule, node: ts.Expression): boolean {
    if (!staticDataInitializer(node)) return false;
    let valid = true;
    const visit = (child: ts.Node): void => {
      const global =
        ts.isNewExpression(child) && ts.isIdentifier(child.expression)
          ? child.expression.text
          : ts.isCallExpression(child) &&
              ts.isPropertyAccessExpression(child.expression) &&
              ts.isIdentifier(child.expression.expression)
            ? child.expression.expression.text
            : undefined;
      if (
        (global === 'Object' || global === 'Set') &&
        (module.imports.has(global) || module.declarations.has(global))
      )
        valid = false;
      ts.forEachChild(child, visit);
    };
    visit(node);
    return valid;
  }

  /** The module requirements of `<hook>.modules`, when `<hook>` resolves to a
   *  static `defineHook`/`defineAsHook` declaration; otherwise undefined. */
  private inheritedModules(
    module: SourceModule,
    node: ts.Expression
  ): ModuleDeclarationIR[] | undefined {
    node = unwrapSourceExpression(node);
    if (
      !ts.isPropertyAccessExpression(node) ||
      node.name.text !== 'modules' ||
      !ts.isIdentifier(node.expression)
    )
      return undefined;
    const resolved = this.resolveBinding(module, node.expression.text);
    if (resolved.module === null || !ts.isCallExpression(resolved.node)) return undefined;
    const callee = resolved.node.expression;
    const factory = ts.isIdentifier(callee)
      ? this.resolveCoreImport(resolved.module, callee.text)
      : undefined;
    if (factory !== 'defineHook' && factory !== 'defineAsHook') return undefined;
    return this.descriptor(resolved.module, resolved.node).modules;
  }

  descriptor(module: SourceModule, node: ts.CallExpression): SourceDescriptor {
    if (this.descriptorReads.has(node))
      rejectNode(node, 'PUI1008', 'Cyclic static prototype/asHook descriptor.');
    this.descriptorReads.add(node);
    try {
      return this.readDescriptor(module, node);
    } finally {
      this.descriptorReads.delete(node);
    }
  }

  private readDescriptor(module: SourceModule, node: ts.CallExpression): SourceDescriptor {
    const factory = ts.isIdentifier(node.expression)
      ? this.resolveCoreImport(module, node.expression.text)
      : undefined;
    if (node.arguments.length !== 1)
      rejectNode(node, 'PUI1006', 'Definition requires one static descriptor.');
    const input = unwrapSourceExpression(node.arguments[0]);
    if (!ts.isObjectLiteralExpression(input)) {
      // defineAsHook accepts an actual Prototype object. Resolve its checked
      // source declaration; do not execute an import, copy a setup body into the
      // caller module, or drop its inherited Module requirements.
      if (factory !== 'defineAsHook')
        rejectNode(input, 'PUI1006', 'Definition requires one literal object.');
      let owner = module;
      let definition: ts.Expression | ts.FunctionDeclaration = input;
      if (ts.isIdentifier(input)) {
        const resolved = this.resolveBinding(module, input.text);
        if (resolved.module === null)
          rejectNode(input, 'PUI1006', 'asHook requires a checked source Prototype definition.');
        owner = resolved.module;
        definition = resolved.node;
      }
      if (
        !ts.isCallExpression(definition) ||
        !ts.isIdentifier(definition.expression) ||
        this.resolveCoreImport(owner, definition.expression.text) !== 'definePrototype'
      )
        rejectNode(input, 'PUI1006', 'asHook requires a checked source Prototype definition.');
      return this.descriptor(owner, definition);
    }
    let name: string | undefined;
    let setup: FunctionNode | undefined;
    let setupModule = module;
    let projectHandle: FunctionNode | undefined,
      projectModule: SourceModule | undefined,
      configure: FunctionNode | undefined,
      configureModule: SourceModule | undefined,
      mode: 'once' | 'multiple' | 'configurable' | undefined;
    const modules: ModuleDeclarationIR[] = [];
    const keys = new Set<string>();
    for (const property of input.properties) {
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
        // `modules: asFamily.modules` reuses the requirements another static
        // hook declaration already states, read from its own descriptor.
        const inherited = this.inheritedModules(module, property.initializer);
        if (inherited) {
          for (const declaration of inherited) {
            if (keys.has(`module:${declaration.id}`))
              rejectNode(property, 'PUI1025', `Duplicate Module declaration ${declaration.id}.`);
            keys.add(`module:${declaration.id}`);
            modules.push(declaration);
          }
          continue;
        }
        if (!ts.isArrayLiteralExpression(property.initializer))
          rejectNode(
            property.initializer,
            'PUI1025',
            "Module requirements must be a checked literal declaration array or a static hook declaration's modules."
          );
        const ids = new Set<string>();
        for (const expression of property.initializer.elements) {
          const declaration = extractModuleDeclaration(module, expression);
          if (!declaration)
            rejectNode(expression, 'PUI1025', 'Use an admitted static Module declaration factory.');
          if (ids.has(declaration.id))
            rejectNode(expression, 'PUI1025', `Duplicate Module declaration ${declaration.id}.`);
          ids.add(declaration.id);
          modules.push(declaration);
        }
      } else if (
        key === 'mode' &&
        factory === 'defineHook' &&
        ts.isPropertyAssignment(property) &&
        ts.isStringLiteral(property.initializer) &&
        ['once', 'multiple', 'configurable'].includes(property.initializer.text)
      ) {
        mode = property.initializer.text as typeof mode;
      } else if (
        key === 'setup' ||
        (key === 'projectHandle' && factory === 'defineAsHook') ||
        (key === 'configure' && factory === 'defineHook')
      ) {
        const value = ts.isMethodDeclaration(property)
          ? property
          : ts.isShorthandPropertyAssignment(property)
            ? property.name
            : property.initializer;
        let fn: FunctionNode,
          owner = module;
        if (
          ts.isMethodDeclaration(value) ||
          ts.isArrowFunction(value) ||
          ts.isFunctionExpression(value)
        )
          fn = value;
        else if (ts.isIdentifier(value)) {
          const declaration = this.resolveBinding(module, value.text);
          if (declaration.module !== null && isSourceFunction(declaration.node)) {
            fn = declaration.node;
            owner = declaration.module;
          } else rejectNode(value, 'PUI1006', 'Setup must resolve to a static source function.');
        } else rejectNode(value, 'PUI1006', 'Descriptor callbacks must be static functions.');
        if (key === 'setup') {
          setup = fn;
          setupModule = owner;
        } else if (key === 'projectHandle') {
          projectHandle = fn;
          projectModule = owner;
        } else {
          configure = fn;
          configureModule = owner;
        }
      } else
        rejectNode(
          property,
          'PUI1006',
          `Unsupported descriptor property ${key}; module requirements cannot be silently discarded.`
        );
    }
    if (!name || !setup)
      rejectNode(node, 'PUI1006', 'Definition requires a nonempty name and static setup.');
    return {
      name,
      setup,
      setupModule,
      ...(projectHandle ? { projectHandle, projectModule } : {}),
      ...(configure ? { configure, configureModule } : {}),
      ...(mode ? { mode } : {}),
      modules,
      span: sourceSpan(node),
    };
  }
}
