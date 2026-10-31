// @vitest-environment happy-dom
import { resolve, dirname, posix } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { emitWebComponentSource } from '../src/web-component-source';

// Full generated graph, strict semantic diagnostics (not transpile-only).
function strictDiagnostics(
  code: string,
  supportingFiles: readonly { path: string; contents: string }[]
) {
  const root = resolve('packages/compiler/.setup-arity-consumer/Component.ts');
  const files = new Map([[root, code]]);
  for (const file of supportingFiles) files.set(resolve(dirname(root), file.path), file.contents);
  const options: ts.CompilerOptions = {
    noEmit: true,
    strict: true,
    skipLibCheck: false,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    types: [],
    baseUrl: resolve('.'),
    paths: {
      '@floating-ui/dom': [
        'packages/modules/positioning/node_modules/@floating-ui/dom/dist/floating-ui.dom.d.ts',
      ],
    },
  };
  const host = ts.createCompilerHost(options);
  const originalRead = host.readFile.bind(host);
  const originalExists = host.fileExists.bind(host);
  const originalDirectoryExists = host.directoryExists?.bind(host);
  host.readFile = (file) => files.get(resolve(file)) ?? originalRead(file);
  host.fileExists = (file) => files.has(resolve(file)) || originalExists(file);
  host.directoryExists = (directory) =>
    [...files.keys()].some((file) => file.startsWith(`${resolve(directory)}/`)) ||
    !!originalDirectoryExists?.(directory);
  host.getSourceFile = (file, languageVersion) => {
    const text = host.readFile(file);
    return text === undefined ? undefined : ts.createSourceFile(file, text, languageVersion, true);
  };
  const program = ts.createProgram(
    [...files.keys()].filter((file) => file.endsWith('.ts')),
    options,
    host
  );
  return ts.getPreEmitDiagnostics(program).map((diagnostic) => ({
    code: diagnostic.code,
    file: diagnostic.file?.fileName,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
  }));
}

describe('WC authored setup invocation arity', () => {
  for (const ssr of [false, true]) {
    for (const shadow of [false, true]) {
      for (const formals of ['', 'def']) {
        it(`strict complete graph: ssr=${ssr}, shadow=${shadow}, setup(${formals})`, () => {
          const source = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'setup-arity',setup(${formals}){
${formals ? "const value=def.state.numberDiscrete('value',1);return r=>r.el('section',value.get());" : "return r=>r.el('section','retained');"}}});`;
          const parsed = parsePrototype(source, { fileName: 'setup-arity.proto.ts' });
          if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
          expect(parsed.value.setup.parameters).toHaveLength(formals ? 1 : 0);
          const emitted = emitWebComponentSource(parsed.value, { ssr, shadow });
          if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
          expect(
            strictDiagnostics(emitted.value.code, emitted.value.supportingFiles ?? [])
          ).toEqual([]);
          // Inspect the actual call expression assigned to owner.render, not incidental strings.
          const file = ts.createSourceFile(
            'component.ts',
            emitted.value.code,
            ts.ScriptTarget.Latest,
            true
          );
          const argumentCounts: number[] = [];
          const visit = (node: ts.Node) => {
            if (
              ts.isBinaryExpression(node) &&
              node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
              ts.isPropertyAccessExpression(node.left) &&
              node.left.name.text === 'render' &&
              ts.isCallExpression(node.right)
            )
              argumentCounts.push(node.right.arguments.length);
            ts.forEachChild(node, visit);
          };
          visit(file);
          expect(argumentCounts).toEqual([formals ? 1 : 0]);
        });
      }
    }
  }

  it('preserves frontend rejection of additional setup parameters', () => {
    const parsed = parsePrototype(
      `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'setup-extra',setup(def, extra:string){return r=>r.el('span',extra);}});`,
      { fileName: 'setup-extra.proto.ts' }
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok)
      expect(parsed.diagnostics.some((diagnostic) => diagnostic.code === 'PUI1006')).toBe(true);
  });
});

function hookSource(formals: '' | 'def') {
  return `import {definePrototype,defineAsHook} from '@proto.ui/core';
const asLeaf=defineAsHook({name:'arity-leaf',setup(${formals}){
${formals ? "const value=def.state.numberDiscrete('hook-value',1);def.expose.method('hookValue',()=>value.get());def.expose.event('teardown');def.lifecycle.onCreated(()=>{value.set(value.get()*10+1);});def.lifecycle.onMounted(()=>{value.set(value.get()*10+2);});def.lifecycle.onBeforeDispose((run)=>{run.expose.emit('teardown',value.get());});" : ''}
}});
const asParent=defineAsHook({name:'arity-parent',setup(){asLeaf();}});
export default definePrototype({name:'hook-arity',setup(def){
const first=asLeaf();asParent();const again=asLeaf();
def.expose.value('same',first===again);
return r=>r.el('section','hook');}});`;
}

describe('WC authored-hook setup invocation arity', () => {
  for (const ssr of [false, true]) {
    for (const shadow of [false, true]) {
      for (const formals of ['', 'def'] as const) {
        it(`strict hook graph: ssr=${ssr}, shadow=${shadow}, setup(${formals})`, () => {
          const parsed = parsePrototype(hookSource(formals), { fileName: 'hook-arity.proto.ts' });
          if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
          expect(parsed.value.hooks.map((hook) => hook.setup.parameters.length)).toEqual([
            formals ? 1 : 0,
            0,
          ]);
          const emitted = emitWebComponentSource(parsed.value, { ssr, shadow });
          if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
          expect(
            strictDiagnostics(emitted.value.code, emitted.value.supportingFiles ?? [])
          ).toEqual([]);
          const file = ts.createSourceFile(
            'Component.ts',
            emitted.value.code,
            ts.ScriptTarget.Latest,
            true
          );
          const calls: number[] = [];
          const visit = (node: ts.Node) => {
            if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
              const expression = node.expression.expression;
              if (
                ts.isParenthesizedExpression(expression) &&
                ts.isArrowFunction(expression.expression)
              ) {
                expect(node.expression.arguments.length).toBe(
                  expression.expression.parameters.length
                );
                calls.push(node.expression.arguments.length);
              }
            }
            ts.forEachChild(node, visit);
          };
          visit(file);
          expect(calls).toEqual([formals ? 1 : 0, 0]);
        });
      }
    }
  }

  it('retains frontend rejection of additional authored-hook setup parameters', () => {
    const parsed = parsePrototype(
      `import {definePrototype,defineAsHook} from '@proto.ui/core';
const asBad=defineAsHook({name:'bad-hook',setup(def, extra:string){}});
export default definePrototype({name:'bad-hook-owner',setup(){asBad();return r=>r.el('span','x');}});`,
      { fileName: 'hook-extra.proto.ts' }
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok)
      expect(parsed.diagnostics.some((diagnostic) => diagnostic.code === 'PUI1006')).toBe(true);
  });

  for (const shadow of [false, true]) {
    it(`retains nested hook identity, captured state and lifecycle order: shadow=${shadow}`, () => {
      const parsed = parsePrototype(hookSource('def'), { fileName: 'hook-arity.proto.ts' });
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
      const emitted = emitWebComponentSource(parsed.value, { shadow });
      if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
      const files = new Map(
        (emitted.value.supportingFiles ?? []).map((file) => [file.path, file.contents])
      );
      files.set('Component.ts', emitted.value.code);
      const cache = new Map<string, Record<string, unknown>>();
      function load(name: string): Record<string, unknown> {
        const cached = cache.get(name);
        if (cached) return cached;
        const text = files.get(name);
        if (text === undefined) throw new Error(`Missing generated dependency: ${name}`);
        const exports: Record<string, unknown> = {};
        cache.set(name, exports);
        const js = ts.transpileModule(text, {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.CommonJS,
          },
        }).outputText;
        new Function('exports', 'require', js)(exports, (id: string) => {
          if (id === '@floating-ui/dom')
            return createRequire(
              fileURLToPath(new NodeURL('../../modules/positioning/package.json', import.meta.url))
            )('@floating-ui/dom');
          if (!id.startsWith('.')) throw new Error(`Unexpected generated dependency: ${id}`);
          const next = posix.normalize(posix.join(posix.dirname(name), id));
          return load(next.endsWith('.ts') ? next : `${next}.ts`);
        });
        return exports;
      }
      const module = load('Component.ts');
      if (typeof module.register !== 'function') throw new Error('Missing generated register');
      const tag = `hook-arity-${shadow ? 'shadow' : 'light'}`;
      module.register(tag);
      for (let owner = 0; owner < 2; owner++) {
        const element = document.createElement(tag) as HTMLElement & {
          getExposes(): { same: boolean; hookValue(): number };
          dispose(): void;
        };
        const teardown: number[] = [];
        element.addEventListener('teardown', (event) =>
          teardown.push((event as CustomEvent<number>).detail)
        );
        document.body.append(element);
        try {
          const exposes = element.getExposes();
          expect(exposes.same).toBe(true);
          expect(exposes.hookValue()).toBe(112);
          element.dispose();
          expect(teardown).toEqual([112]);
          expect(() => exposes.hookValue()).toThrow();
        } finally {
          element.dispose();
          element.remove();
        }
      }
    });
  }
});
