import ts from 'typescript';
import type { ComponentBody, ComponentIR, ContextKeyIR, ExternIR, LiteralValue, SourceSpan } from '../component-ir.ts';
import { requireExternBinding, type ReactExternBindings } from '../extern-bindings.ts';
import { unsupportedHostName, type ReachedExtern } from '../validate.ts';
import { Names, arrow, atSource, call, constDecl, f, id, identifierText, member, param, semanticExport, str, typeRef } from './ast.ts';
import { ReactData } from './data.ts';

const modules = {
  react: ['CSSProperties', 'Ref', 'createElement', 'forwardRef', 'useRef', 'useState', 'useSyncExternalStore'],
  '@proto.ui/compiler/support/react': [
    'ActionDispatch', 'ActionFailure', 'ContextValue', 'FieldDraft', 'FieldStore', 'HostValueError', 'InputLease', 'InputPresence', 'SignalQueue',
    'checkTaskResult', 'createNativeContext', 'dispatchAction', 'finishAction', 'missingInput', 'numberFromBits', 'observeNativeAction', 'observeNativeTask', 'omittedInput', 'ownMember', 'presentInput', 'readBool',
    'readCallback', 'readNumber', 'readObject', 'readText', 'readTokens', 'readUnit', 'sameTokens', 'useContextSnapshot', 'useFixedInputs', 'useProvidedContext', 'usePublishedInputs', 'useRequiredContext',
  ],
  '@proto.ui/compiler/support/react/retained': ['useRetainedHandle', 'useRetainedInputs', 'useRetainedView', 'useCreatedActions', 'useTaskLifetime'],
  '@proto.ui/compiler/support/owned-tasks': ['OwnedTaskGroup', 'PostCommit', 'TaskControl', 'TaskExit'],
};
const hostLocals = ['$props', '$inputs', '$checked', '$fields', '$draft', '$signals', '$owner', '$lease', '$store', '$ref', '$handle', '$before', '$after', '$view', '$task', '$tasks', '$enter', '$body', '$retireTasks', '$signal', '$outcome', '$group', '$afterCommit'];

interface BodyNames { component: string; propsType: string; projectionType: string; handleType: string }

/** The normal exported components of a unit share exactly one module namespace,
 * pool of constants, native type table and set of nominal React contexts. */
export class ReactUnit {
  readonly ir: ComponentIR;
  readonly names = new Names([...Object.values(modules).flat(), ...hostLocals, 'AbortSignal', 'Error', 'Object', 'Number', 'Promise', 'PromiseLike', 'ReturnType', 'Symbol', 'undefined', 'exports', 'module', 'require', '__filename', '__dirname']);
  readonly bodies = new Map<string, BodyNames>();
  readonly keys = new Map<string, { key: ContextKeyIR; name: string; identity: string }>();
  readonly data: ReactData;
  readonly externs = new Map<string, { extern: ExternIR; name: string; result: string; localResult: string; module: string; exportName: string }>();
  readonly #imports = new Map<string, boolean>();
  readonly #numbers = new Map<string, { value: number; constant?: string }>();
  readonly #tokens = new Map<string, { name: string; values: readonly string[] }>();
  readonly #bits = new DataView(new ArrayBuffer(8));

  constructor(ir: ComponentIR, reached: readonly ReachedExtern[], bindings: ReactExternBindings | undefined) {
    this.ir = ir;
    const exports = new Map<string, string>();
    const usedKeys = new Set<string>();
    const claim = (name: string, owner: string, source: SourceSpan) => {
      const prior = exports.get(name);
      if (prior !== undefined) unsupportedHostName('react', name, source, 'Two native exports require this module binding.', [prior, owner]);
      exports.set(name, owner);
    };
    const bindBody = (body: ComponentBody) => {
      const publicNames = { component: body.name, propsType: `${body.name}Props`, projectionType: `${body.name}Projection`, handleType: `${body.name}Handle` };
      claim(publicNames.component, body.id, body.source);
      claim(publicNames.propsType, body.id, body.source);
      if (body.projections.length) claim(publicNames.projectionType, body.id, body.source);
      if (body.projections.length || body.actions.length) claim(publicNames.handleType, body.id, body.source);
      this.bodies.set(body.id, {
        component: this.names.take(publicNames.component), propsType: this.names.take(publicNames.propsType),
        projectionType: this.names.take(publicNames.projectionType), handleType: this.names.take(publicNames.handleType),
      });
      for (const read of body.consumes) usedKeys.add(read.key);
      for (const provider of body.provides) usedKeys.add(provider.key);
    };
    bindBody(ir);
    for (const body of ir.components) bindBody(body);
    for (const key of ir.keys) {
      if (key.exportName === undefined && !usedKeys.has(key.binding.id)) continue;
      if (key.exportName !== undefined) claim(key.exportName, key.binding.id, key.binding.source);
      const name = this.names.take(key.exportName ?? key.binding.name);
      this.keys.set(key.binding.id, { key, name, identity: this.names.take(`${name}Identity`) });
    }
    for (const { extern, source, callPath } of reached) {
      const binding = requireExternBinding(extern, 'react', bindings, source, callPath);
      if (typeof binding.export !== 'string' || !identifierText(binding.export) || typeof binding.module !== 'string' || !binding.module.trim() || /[\u0000-\u001f\u007f]/u.test(binding.module)) {
        unsupportedHostName('react', extern.name, source, 'Use a nonempty module specifier and a native export identifier.', callPath);
      }
      const first = String.fromCodePoint(extern.binding.name.codePointAt(0)!);
      const result = `${first.toUpperCase()}${extern.binding.name.slice(first.length)}Result`;
      claim(result, extern.binding.id, extern.binding.source);
      this.externs.set(extern.binding.id, {
        extern, name: this.names.take(`${extern.binding.name}Extern`), result,
        localResult: this.names.take(result), module: binding.module, exportName: binding.export,
      });
    }
    this.data = new ReactData(this);
  }

  use(name: string): ts.Identifier { this.#imports.set(name, false); return id(name); }
  useType(name: string, ...args: ts.TypeNode[]): ts.TypeReferenceNode {
    if (!this.#imports.has(name)) this.#imports.set(name, true);
    return typeRef(name, ...args);
  }

  imports(): ts.ImportDeclaration[] {
    const result: ts.ImportDeclaration[] = [];
    for (const [module, choices] of Object.entries(modules)) {
      const names = choices.filter(name => this.#imports.has(name));
      if (!names.length) continue;
      const items = names.map(name => f.createImportSpecifier(this.#imports.get(name)!, undefined, id(name)));
      result.push(f.createImportDeclaration(undefined, f.createImportClause(false, undefined, f.createNamedImports(items)), str(module)));
    }
    const native = new Map<string, ts.ImportSpecifier[]>();
    for (const { module, exportName, name } of this.externs.values()) {
      const specifier = f.createImportSpecifier(false, exportName === name ? undefined : id(exportName), id(name));
      const group = native.get(module);
      if (group) group.push(specifier);
      else native.set(module, [specifier]);
    }
    for (const [module, imports] of native) {
      result.push(f.createImportDeclaration(undefined, f.createImportClause(false, undefined, f.createNamedImports(imports)), str(module)));
    }
    return result;
  }

  externResults(): ts.Statement[] {
    const declarations: ts.Statement[] = [];
    for (const { extern, result, localResult } of this.externs.values()) {
      declarations.push(atSource(f.createTypeAliasDeclaration(undefined, localResult, undefined, this.data.type(extern.binding.type)), extern.binding.source));
      declarations.push(f.createExportDeclaration(undefined, false, f.createNamedExports([semanticExport(localResult, result, true)])));
    }
    return declarations;
  }

  channels(): ts.Statement[] {
    const declarations: ts.Statement[] = [];
    const exports: ts.ExportSpecifier[] = [];
    for (const { key, name, identity } of this.keys.values()) {
      const { type, source } = key.binding;
      const origin = str(`${source.file}:${source.start}-${source.end} (${key.binding.name})`);
      const check = arrow([param('$value')], this.data.read(type, id('$value'), origin));
      const same = arrow([param('$before'), param('$after')], this.data.compare(type, id('$before'), id('$after'), true));
      declarations.push(atSource(constDecl(identity, call(id('Symbol'))), source));
      const domain = [this.data.type(type), f.createTypeQueryNode(id(identity))];
      const channel = f.createCallExpression(this.use('createNativeContext'), domain, [id(identity), str(key.debugName), check, same]);
      declarations.push(atSource(constDecl(name, channel), source));
      if (key.exportName !== undefined) exports.push(semanticExport(name, key.exportName));
    }
    if (exports.length) declarations.push(f.createExportDeclaration(undefined, false, f.createNamedExports(exports)));
    return declarations;
  }

  reserveLiteral(literal: LiteralValue): void {
    if (literal.kind === 'tokens') {
      const key = literal.values.join(' ');
      if (!this.#tokens.has(key)) this.#tokens.set(key, { name: this.names.take('styleTokens'), values: literal.values });
      return;
    }
    if (literal.kind !== 'number') return;
    const hex = literal.bits.toLowerCase();
    if (this.#numbers.has(hex)) return;
    this.#bits.setBigUint64(0, BigInt(`0x${hex}`));
    const value = this.#bits.getFloat64(0);
    const entry = Number.isNaN(value) && hex !== '7ff8000000000000' ? { value, constant: this.names.take(`nan_${hex}`) } : { value };
    this.#numbers.set(hex, entry);
  }

  literal(literal: LiteralValue): ts.Expression {
    switch (literal.kind) {
      case 'bool': return literal.value ? f.createTrue() : f.createFalse();
      case 'text': return str(literal.value);
      case 'tokens': return id(this.#tokens.get(literal.values.join(' '))!.name);
    }
    const { value, constant } = this.#numbers.get(literal.bits.toLowerCase())!;
    if (constant) return id(constant);
    if (Number.isNaN(value)) return member(id('Number'), 'NaN');
    if (!Number.isFinite(value)) return member(id('Number'), value < 0 ? 'NEGATIVE_INFINITY' : 'POSITIVE_INFINITY');
    const magnitude = f.createNumericLiteral(Math.abs(value));
    return value < 0 || Object.is(value, -0) ? f.createPrefixUnaryExpression(ts.SyntaxKind.MinusToken, magnitude) : magnitude;
  }

  constants(): ts.Statement[] {
    const statements: ts.Statement[] = [];
    for (const [hex, { constant }] of this.#numbers) {
      if (!constant) continue;
      const high = f.createNumericLiteral(`0x${hex.slice(0, 8)}`);
      const low = f.createNumericLiteral(`0x${hex.slice(8)}`);
      statements.push(constDecl(constant, call(this.use('numberFromBits'), high, low)));
    }
    for (const { name, values } of this.#tokens.values()) {
      statements.push(constDecl(name, call(member(id('Object'), 'freeze'), f.createArrayLiteralExpression(values.map(str)))));
    }
    return statements;
  }
}
