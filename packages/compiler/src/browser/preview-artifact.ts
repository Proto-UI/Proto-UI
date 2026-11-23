import ts from 'typescript';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
import path from 'node:path';
import { sourceName, localSourceCandidates } from '../source-resolution';
import type { GeneratedModule, PrototypeIR } from '../ir';
import type { BrowserPreviewArtifact } from './protocol';

const profiles = new Set([
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
]);
const moduleId = (file: string) => `pui:generated/${file}`;
const inertTags = new Set(
  'abbr article aside b bdi bdo blockquote br button caption cite code col colgroup data datalist dd del details dfn dialog div dl dt em fieldset figcaption figure footer h1 h2 h3 h4 h5 h6 header hgroup hr i img input ins kbd label legend li main mark menu meter nav ol optgroup option output p picture pre progress q rp rt ruby s samp section select slot small source span strong sub summary sup table tbody td template textarea tfoot th thead time tr u ul var wbr'.split(
    ' '
  )
);

/** Preview delivery grants no document/navigation capability, even to admitted source. */
export function assertPreviewAdmission(ir: PrototypeIR): void {
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const value = node as Record<string, unknown>;
    if (value.kind === 'operation' && value.operation === 'render.el') {
      const tag = (value.arguments as { kind: string; value?: unknown }[])[0];
      if (
        tag?.kind !== 'literal' ||
        typeof tag.value !== 'string' ||
        !inertTags.has(tag.value.toLowerCase())
      )
        throw new Error(
          'Preview admission: only literal inert HTML template tags are available; navigation, form, document, executable and embedded browsing elements are unavailable.'
        );
    }
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  };
  visit(ir.setup);
  ir.hooks.forEach(visit);
  ir.moduleBindings?.forEach(visit);
}

export function previewStyleTokens(ir: PrototypeIR): string[] {
  const tokens = new Set<string>();
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const value = node as Record<string, any>;
    if (value.kind === 'style-handle') for (const token of value.handle.tokens) tokens.add(token);
    if (value.kind === 'rule')
      for (const operation of value.declaration.intent.ops)
        for (const handle of operation.handles)
          for (const token of handle.tokens) tokens.add(token);
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  };
  visit(ir.setup);
  ir.hooks.forEach(visit);
  ir.moduleBindings?.forEach(visit);
  return [...tokens].sort();
}

/**
 * Transpiles compiler output, never authored input. The normal generated files
 * remain unchanged. Preview-only module links and execution checkpoints are a
 * delivery boundary around those files, not another semantic implementation.
 */
export function prepareBrowserPreview(
  output: GeneratedModule,
  events: string[] = [],
  tokens: string[] = []
): BrowserPreviewArtifact {
  if (!profiles.has(output.profile)) throw new Error(`No browser preview for ${output.profile}.`);
  const sources = new Map<string, string>([['entry.ts', output.code]]);
  const styles: string[] = [];
  if (tokens.length) {
    const css = renderProtoStyleTokenCss(tokens);
    if (css.includes('Unsupported Proto UI style tokens'))
      throw new Error(
        'Preview admission: the declared style token closure is not supported by the website stylesheet generator.'
      );
    styles.push(css);
  }
  for (const file of output.supportingFiles ?? []) {
    const name = sourceName(file.path);
    if (file.kind === 'style') styles.push(file.contents);
    else if (file.kind === 'source' && /\.[cm]?[jt]sx?$/.test(name))
      sources.set(name, file.contents);
    else if (file.kind !== 'declaration') throw new Error(`Unsupported preview asset ${name}.`);
  }
  const modules: Record<string, string> = Object.create(null);
  for (const [file, source] of sources) {
    const syntax = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    const identifiers = new Set<string>();
    const collect = (node: ts.Node) => {
      if (ts.isIdentifier(node)) identifiers.add(node.text);
      ts.forEachChild(node, collect);
    };
    collect(syntax);
    let checkpoint = '__puiPreviewCheckpoint';
    while (identifiers.has(checkpoint)) checkpoint += '_';
    const transformed = ts.transpileModule(source, {
      fileName: file,
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.React,
      },
      transformers: {
        before: [
          (context) => {
            const f = context.factory;
            const tick = () =>
              f.createExpressionStatement(
                f.createCallExpression(f.createIdentifier(checkpoint), undefined, [])
              );
            const body = (statement: ts.Statement) =>
              f.createBlock(
                [tick(), ...(ts.isBlock(statement) ? statement.statements : [statement])],
                true
              );
            const visit: ts.Visitor = (original) => {
              let node = ts.visitEachChild(original, visit, context);
              if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
                if (ts.isImportDeclaration(node) ? node.importClause?.isTypeOnly : node.isTypeOnly)
                  return node;
                const specifier = node.moduleSpecifier;
                if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith('.')) {
                  const base = sourceName(
                    path.posix.join(path.posix.dirname(file), specifier.text)
                  );
                  const candidates = [
                    base,
                    base.replace(/\.js$/, '.ts'),
                    ...localSourceCandidates(base),
                  ];
                  const target = candidates.find((name) => sources.has(name));
                  if (!target)
                    throw new Error(
                      `Generated preview has an unclosed import ${specifier.text} in ${file}.`
                    );
                  const next = f.createStringLiteral(moduleId(target));
                  node = ts.isImportDeclaration(node)
                    ? f.updateImportDeclaration(
                        node,
                        node.modifiers,
                        node.importClause,
                        next,
                        node.attributes
                      )
                    : f.updateExportDeclaration(
                        node,
                        node.modifiers,
                        node.isTypeOnly,
                        node.exportClause,
                        next,
                        node.attributes
                      );
                }
              }
              if (ts.isWhileStatement(node))
                return f.updateWhileStatement(node, node.expression, body(node.statement));
              if (ts.isDoStatement(node))
                return f.updateDoStatement(node, body(node.statement), node.expression);
              if (ts.isForStatement(node))
                return f.updateForStatement(
                  node,
                  node.initializer,
                  node.condition,
                  node.incrementor,
                  body(node.statement)
                );
              if (ts.isForOfStatement(node))
                return f.updateForOfStatement(
                  node,
                  node.awaitModifier,
                  node.initializer,
                  node.expression,
                  body(node.statement)
                );
              if (ts.isForInStatement(node))
                return f.updateForInStatement(
                  node,
                  node.initializer,
                  node.expression,
                  body(node.statement)
                );
              if (ts.isBlock(node) && original.parent && ts.isFunctionLike(original.parent))
                return f.updateBlock(node, [tick(), ...node.statements]);
              if (ts.isArrowFunction(node) && !ts.isBlock(node.body))
                return f.updateArrowFunction(
                  node,
                  node.modifiers,
                  node.typeParameters,
                  node.parameters,
                  node.type,
                  node.equalsGreaterThanToken,
                  f.createBlock([tick(), f.createReturnStatement(node.body)], true)
                );
              return node;
            };
            return (input) => ts.visitNode(input, visit) as ts.SourceFile;
          },
        ],
      },
    });
    const error = transformed.diagnostics?.find(
      (entry) => entry.category === ts.DiagnosticCategory.Error
    );
    if (error)
      throw new Error(
        `Generated preview transpilation failed: ${ts.flattenDiagnosticMessageText(error.messageText, '\n')}`
      );
    modules[moduleId(file)] =
      `import {checkpoint as ${checkpoint}} from 'pui:preview-budget';\n${transformed.outputText}`;
  }
  return {
    format: 1,
    entry: moduleId('entry.ts'),
    modules,
    styles,
    events,
    executionBudget: '100000-checkpoints-per-task-v1',
  };
}
