import { resolve, dirname } from 'node:path';
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
