// Adapted from recovered c8a5cf evidence/build-consumer.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { host, entry } = JSON.parse(fs.readFileSync('package.json', 'utf8')).publicConsumer;
const plugins = [];
const styles = new Map();
function styleImports(descriptor, filename) {
  if (!descriptor.styles?.length) return '';
  for (const style of descriptor.styles) {
    assert(
      !style.scoped && !style.module && !style.src && !style.lang,
      'This public Usage driver requires its current plain, inline CSS'
    );
  }
  const id = 'public-consumer-style:' + filename;
  styles.set(id, descriptor.styles.map((style) => style.content).join('\n'));
  return 'import ' + JSON.stringify(id) + ';\n';
}
plugins.push({
  name: 'public-sfc-styles',
  setup(builder) {
    builder.onResolve({ filter: /^public-consumer-style:/ }, ({ path }) => ({
      path,
      namespace: 'public-consumer-style',
    }));
    builder.onLoad({ filter: /.*/, namespace: 'public-consumer-style' }, ({ path }) => {
      assert(styles.has(path), 'Missing authored SFC stylesheet');
      return { contents: styles.get(path), loader: 'css' };
    });
  },
});
if (host === 'vue') {
  const { parse, compileScript } = await import('@vue/compiler-sfc');
  plugins.push({
    name: 'vue-sfc',
    setup(builder) {
      builder.onLoad({ filter: /\.vue$/ }, async ({ path: filename }) => {
        const { descriptor, errors } = parse(fs.readFileSync(filename, 'utf8'), { filename });
        if (errors.length) throw new Error(JSON.stringify(errors));
        return {
          contents:
            styleImports(descriptor, filename) +
            compileScript(descriptor, { id: 'public-usage', inlineTemplate: true }).content,
          loader: 'ts',
          resolveDir: path.dirname(filename),
        };
      });
    },
  });
}
if (host === 'vue2') {
  const compiler = require('vue-template-compiler');
  const transpile = require('vue-template-es2015-compiler');
  plugins.push({
    name: 'vue2-sfc',
    setup(builder) {
      builder.onLoad({ filter: /\.vue$/ }, async ({ path: filename }) => {
        const descriptor = compiler.parseComponent(fs.readFileSync(filename, 'utf8'));
        if (!descriptor.script || !descriptor.template) throw new Error('Missing Vue 2 SFC blocks');
        const compiled = compiler.compile(descriptor.template.content);
        if (compiled.errors.length) throw new Error(JSON.stringify(compiled.errors));
        const render = transpile(
          'var render = function () {' +
            compiled.render +
            '};\nvar staticRenderFns = [' +
            compiled.staticRenderFns.map((code) => 'function () {' + code + '}').join(',') +
            '];',
          { transforms: { stripWith: true } }
        );
        if (!descriptor.script.content.includes('export default {'))
          throw new Error('Expected an Options API component');
        return {
          contents:
            styleImports(descriptor, filename) +
            descriptor.script.content.replace('export default {', 'const component = {') +
            '\n' +
            render +
            '\nrender._withStripped = true;\ncomponent.render = render;\ncomponent.staticRenderFns = staticRenderFns;\ncomponent._compiled = true;\nexport default component;',
          loader: 'js',
          resolveDir: path.dirname(filename),
        };
      });
    },
  });
}
const typed = entry.endsWith('.ts') || entry.endsWith('.tsx');
if (typed) {
  fs.writeFileSync('env.d.ts', "declare module '*.css';\n");
  const program = ts.createProgram([entry, 'env.d.ts'], {
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
  });
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .filter((item) => item.category === ts.DiagnosticCategory.Error);
  fs.writeFileSync(
    'typecheck.json',
    JSON.stringify(
      diagnostics.map((item) => ({
        code: item.code,
        file: item.file?.fileName,
        message: ts.flattenDiagnosticMessageText(item.messageText, '\n'),
      })),
      null,
      2
    ) + '\n'
  );
  if (diagnostics.length)
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (p) => p,
        getCurrentDirectory: () => process.cwd(),
        getNewLine: () => '\n',
      })
    );
}
const result = await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  outfile: 'dist/app.js',
  metafile: true,
  sourcemap: true,
  minify: false,
  jsx: 'automatic',
  plugins,
  define: {
    'process.env.NODE_ENV': '"production"',
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },
});
const app = fs.realpathSync('.');
for (const input of Object.keys(result.metafile.inputs)) {
  if (input.startsWith('public-consumer-style:')) continue;
  assert(
    !path.isAbsolute(input) && !input.startsWith('../'),
    'Consumer build escaped installed application: ' + input
  );
  const local = path.relative(app, fs.realpathSync(input));
  assert(
    local && !local.startsWith('../') && !path.isAbsolute(local),
    'Consumer build reached a linked workspace: ' + input
  );
}
const dependencies = Object.keys(result.metafile.inputs).filter((input) =>
  input.includes('/@proto.ui/')
);
assert(dependencies.length, 'No installed Proto UI inputs reached the browser bundle');
fs.writeFileSync('build-metafile.json', JSON.stringify(result.metafile, null, 2) + '\n');
fs.writeFileSync(
  'build-checks.json',
  JSON.stringify(
    {
      host,
      entry,
      installedProtoInputs: dependencies.length,
      types: typed
        ? 'strict TypeScript with skipLibCheck'
        : host === 'wc'
          ? 'authored HTML JavaScript module; bundled without a TypeScript claim'
          : 'official SFC compiler and browser bundle; full Vue typecheck not claimed',
    },
    null,
    2
  ) + '\n'
);
