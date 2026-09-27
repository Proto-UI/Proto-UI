import ts from 'typescript';
import path from 'node:path';
import { reject } from './diagnostics';
import type { ParseOptions, SourceSpan } from './ir';

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
export interface SourceModule {
  file: ts.SourceFile;
  imports: Map<string, Imported>;
  declarations: Map<string, ts.Expression | ts.FunctionDeclaration>;
  exports: Map<string, SourceExport>;
}
const FACTORIES: Record<string, true> = { definePrototype: true, defineAsHook: true };
const HOOKS: Record<string, true> = { asTrigger: true, asFocusable: true, asAccessible: true };

export function sourceName(file: string): string {
  const span: SourceSpan = {
    file: '<input>',
    start: 0,
    end: 0,
    line: 1,
    column: 1,
    endLine: 1,
    endColumn: 1,
  };
  if (
    typeof file !== 'string' ||
    !file ||
    /^[A-Za-z]:/.test(file) ||
    file.startsWith('/') ||
    file.startsWith('\\\\')
  ) {
    reject(
      'PUI1003',
      'Source graph identities must be relative paths, not absolute paths.',
      span,
      'invalid-input'
    );
  }
  const normalized = path.posix.normalize(file.replace(/\\/g, '/'));
  if (
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.startsWith('/')
  ) {
    reject(
      'PUI1003',
      'Source identity must remain inside the explicit relative source graph.',
      span,
      'invalid-input'
    );
  }
  return normalized;
}

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
  private readonly resolving = new Set<string>();

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
    const result: SourceModule = {
      file,
      imports: new Map(),
      declarations: new Map(),
      exports: new Map(),
    };
    this.modules.set(fileName, result);
    for (const statement of file.statements) {
      if (ts.isImportDeclaration(statement)) {
        if (!ts.isStringLiteral(statement.moduleSpecifier) || !statement.importClause)
          rejectNode(statement, 'PUI1003', 'Side-effect/computed imports are unsupported.');
        const clause = statement.importClause;
        if (clause.isTypeOnly) continue;
        if (clause.name || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings))
          rejectNode(statement, 'PUI1003', 'Use named static imports.');
        const specifier = statement.moduleSpecifier.text;
        for (const element of clause.namedBindings.elements) {
          if (element.isTypeOnly) continue;
          const name = identifier(element.name);
          const exported = element.propertyName?.text ?? name;
          if (
            specifier === '@proto.ui/core'
              ? !Object.hasOwn(FACTORIES, exported)
              : specifier === '@proto.ui/hooks'
                ? !Object.hasOwn(HOOKS, exported)
                : !specifier.startsWith('.')
          )
            rejectNode(element, 'PUI1003', `Unsupported import ${exported} from ${specifier}.`);
          if (result.imports.has(name))
            rejectNode(element, 'PUI1003', `Duplicate imported binding ${name}.`);
          result.imports.set(name, { module: specifier, exported, node: element });
        }
      } else if (ts.isFunctionDeclaration(statement)) {
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
              'Top-level runtime bindings must be static prototype/asHook definitions.'
            );
          const imported = result.imports.get(value.expression.text);
          if (imported?.module !== '@proto.ui/core' || !Object.hasOwn(FACTORIES, imported.exported))
            rejectNode(value, 'PUI1004', 'Top-level source execution is not admitted.');
          this.add(result, identifier(declaration.name), value, statement);
        }
      } else if (ts.isExportAssignment(statement)) {
        if (statement.isExportEquals)
          rejectNode(statement, 'PUI1002', 'CommonJS export assignment is unsupported.');
        if (ts.isIdentifier(statement.expression))
          this.publishExport(result, 'default', statement.expression.text, statement);
        else if (ts.isCallExpression(statement.expression))
          this.publishExport(result, 'default', { expression: statement.expression }, statement);
        else
          rejectNode(
            statement,
            'PUI1002',
            'Default export must name or define a static prototype.'
          );
      } else if (ts.isExportDeclaration(statement)) {
        if (statement.isTypeOnly) continue;
        if (!statement.exportClause || !ts.isNamedExports(statement.exportClause))
          rejectNode(statement, 'PUI1003', 'Use explicit named exports, not wildcard exports.');
        for (const element of statement.exportClause.elements) {
          if (element.isTypeOnly) continue;
          const local = element.propertyName?.text ?? element.name.text;
          if (statement.moduleSpecifier) {
            if (
              !ts.isStringLiteral(statement.moduleSpecifier) ||
              !statement.moduleSpecifier.text.startsWith('.')
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
    for (const imported of result.imports.values()) {
      if (imported.module.startsWith('.')) this.importedModule(result, imported);
    }
    return result;
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
    const base = path.posix.normalize(
      path.posix.join(path.posix.dirname(module.file.fileName), imported.module)
    );
    const found = [base, `${base}.ts`, `${base}.proto.ts`, `${base}/index.ts`].find((candidate) =>
      Object.hasOwn(this.sources, candidate)
    );
    if (!found)
      rejectNode(
        imported.node,
        'PUI1003',
        `Local source ${imported.module} is absent from the explicit source graph.`
      );
    return this.load(found);
  }

  definition(
    module: SourceModule,
    exportName: string
  ): { module: SourceModule; node: ts.CallExpression; factory: string } {
    const key = `${module.file.fileName}#${exportName}`;
    if (this.resolving.has(key)) rejectNode(module.file, 'PUI1008', 'Cyclic source export.');
    this.resolving.add(key);
    try {
      const exported = module.exports.get(exportName);
      if (!exported) rejectNode(module.file, 'PUI1002', `No static ${exportName} export.`);
      let node: ts.Expression | ts.FunctionDeclaration | undefined;
      if (typeof exported !== 'string') {
        if ('expression' in exported) node = exported.expression;
        else return this.definition(this.importedModule(module, exported), exported.exported);
      } else {
        const imported = module.imports.get(exported);
        if (imported)
          return this.definition(this.importedModule(module, imported), imported.exported);
        node = module.declarations.get(exported);
      }
      if (!node || !ts.isCallExpression(node) || !ts.isIdentifier(node.expression))
        rejectNode(
          node ?? module.file,
          'PUI1002',
          'Entry must be a static prototype/asHook descriptor.'
        );
      const factory = module.imports.get(node.expression.text);
      if (factory?.module !== '@proto.ui/core' || !Object.hasOwn(FACTORIES, factory.exported))
        rejectNode(node, 'PUI1002', 'Factory must resolve to the admitted core import.');
      return { module, node, factory: factory.exported };
    } finally {
      this.resolving.delete(key);
    }
  }

  descriptor(
    module: SourceModule,
    node: ts.CallExpression
  ): { name: string; setup: FunctionNode; span: SourceSpan } {
    if (node.arguments.length !== 1 || !ts.isObjectLiteralExpression(node.arguments[0]))
      rejectNode(node, 'PUI1006', 'Definition requires one literal object.');
    let name: string | undefined;
    let setup: FunctionNode | undefined;
    const keys = new Set<string>();
    for (const property of node.arguments[0].properties) {
      if (!ts.isPropertyAssignment(property) && !ts.isMethodDeclaration(property))
        rejectNode(property, 'PUI1006', 'Descriptor spread/shorthand is unsupported.');
      const key = propertyName(property.name);
      if (keys.has(key)) rejectNode(property, 'PUI1006', `Duplicate descriptor key ${key}.`);
      keys.add(key);
      if (
        key === 'name' &&
        ts.isPropertyAssignment(property) &&
        ts.isStringLiteral(property.initializer)
      )
        name = property.initializer.text;
      else if (key === 'setup') {
        const value = ts.isMethodDeclaration(property) ? property : property.initializer;
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
    return { name, setup, span: sourceSpan(node) };
  }
}
