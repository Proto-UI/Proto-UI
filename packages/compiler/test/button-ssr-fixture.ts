import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { SHADCN_THEME_CSS } from '../../cli/src/legacy/type';
import { renderPrefixedThemeCss } from '../../cli/src/services/proto-style-css';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import ts from 'typescript';
import { build } from 'esbuild';
import { compileFile, compilationArtifacts } from '../src/compile';
import { emitWebComponentSource } from '../src/web-component-source';
import type { Compilation } from '../src/compile';

export const repositoryRoot = fileURLToPath(new NodeURL('../../../', import.meta.url));
// C-PROTOTYPE-STYLE-CLOSURE-0001-D: this test consumer explicitly chooses its theme.
export const buttonSsrStyleEnvironment = {
  id: 'shadcn-consumer-light',
  cssText:
    '@layer theme, proto-ui;\n@layer theme {\n' + renderPrefixedThemeCss(SHADCN_THEME_CSS) + '}\n',
};
export const baseButtonPath = 'packages/prototypes/base/src/button/button.proto.ts';
export const fixtureButtonPath = 'packages/compiler/test/fixtures/button-ssr/button.proto.ts';

export type FixtureCarrier = {
  version: number;
  profile: string;
  binding: string;
  instanceId: string;
  artifacts: { source: string; helpers: string; css: string; environment: string };
  raw: unknown[];
  attributes: Record<string, string>;
  [key: string]: unknown;
};
export type FixtureServer = {
  hydrationBinding: string;
  hydrationArtifacts: FixtureCarrier['artifacts'];
  renderToString(
    props?: Record<string, unknown>,
    options?: {
      slotHtml?: string;
      rootAttributes?: Record<string, string>;
    }
  ): { html: string; carrier: FixtureCarrier };
};

/** Execute generated statements only. Authored source is never imported or evaluated. */
export function loadGeneratedModule(
  files: readonly { path: string; contents: string }[],
  entry: string
) {
  const sources = new Map(files.map((file) => [file.path, file.contents]));
  const modules = new Map<string, Record<string, unknown>>();
  const require = createRequire(
    new NodeURL('../../modules/positioning/package.json', import.meta.url)
  );
  function load(name: string): Record<string, unknown> {
    name = path.posix.normalize(name);
    const previous = modules.get(name);
    if (previous) return previous;
    const source = sources.get(name);
    if (source === undefined) throw new Error(`Missing generated artifact: ${name}`);
    const exports: Record<string, unknown> = {};
    modules.set(name, exports);
    const js = ts.transpileModule(source, {
      fileName: name,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText;
    new Function('exports', 'require', js)(exports, (specifier: string) => {
      if (specifier === '@floating-ui/dom') return require(specifier);
      if (!specifier.startsWith('.'))
        throw new Error(`Unadmitted generated dependency: ${specifier}`);
      const relative = path.posix.join(path.posix.dirname(name), specifier);
      return load(relative.endsWith('.ts') ? relative : `${relative}.ts`);
    });
    return exports;
  }
  return load(entry);
}

/** Internal evidence harness, never a public target or a substitute for compilePrototype admission. */
export async function compileButtonSsrFixture(
  options: { tagName?: string; direct?: boolean } = {}
): Promise<Compilation> {
  const source = await compileFile(
    path.join(repositoryRoot, options.direct ? baseButtonPath : fixtureButtonPath),
    {
      root: repositoryRoot,
      profile: 'web-component-source-v1',
    }
  );
  if (!source.ok) throw new Error(JSON.stringify(source.diagnostics));
  const output = emitWebComponentSource(source.value.ir, {
    ssr: true,
    tagName: options.tagName ?? 'pui-ssr-button',
    className: 'CompiledButton',
    styleEnvironment: buttonSsrStyleEnvironment,
  });
  if (!output.ok) throw new Error(JSON.stringify(output.diagnostics));
  return { ir: source.value.ir, output: output.value };
}

export async function buildButtonSsrFixture(options: { tagName?: string; direct?: boolean } = {}) {
  const tagName = options.tagName ?? 'pui-ssr-button';
  const compilation = await compileButtonSsrFixture({ ...options, tagName });
  const generatedFiles = compilationArtifacts(compilation);
  const cssText = generatedFiles.find((file) => file.path === 'Component.css')!.contents;
  const environmentCssText = generatedFiles.find(
    (file) => file.path === 'Component.environment.css'
  )!.contents;
  const environmentSources = await Promise.all(
    ['packages/cli/src/legacy/type.ts', 'packages/cli/src/services/proto-style-css.ts'].map(
      async (file) => ({
        file,
        sha256: createHash('sha256')
          .update(await readFile(path.join(repositoryRoot, file)))
          .digest('hex'),
      })
    )
  );
  const server = loadGeneratedModule(generatedFiles, 'Component.ts') as unknown as FixtureServer;
  const sources = new Map(generatedFiles.map((file) => [file.path, file.contents]));
  const positioningRequire = createRequire(
    new NodeURL('../../modules/positioning/package.json', import.meta.url)
  );
  const bundled = await build({
    entryPoints: ['Component.client.ts'],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'ButtonSsrFixture',
    platform: 'browser',
    target: 'es2022',
    plugins: [
      {
        name: 'generated-button-artifacts',
        setup(builder) {
          builder.onResolve({ filter: /.*/ }, (args) => {
            if (args.path === '@floating-ui/dom')
              return { path: positioningRequire.resolve(args.path) };
            if (args.namespace && args.namespace !== 'button-generated') return undefined;
            const target = path.posix.normalize(
              path.posix.join(path.posix.dirname(args.importer || 'Component.client.ts'), args.path)
            );
            for (const candidate of [target, `${target}.ts`])
              if (sources.has(candidate)) return { path: candidate, namespace: 'button-generated' };
            if (args.importer)
              throw new Error(`Generated dependency escaped artifact set: ${args.path}`);
            return undefined;
          });
          builder.onLoad({ filter: /.*/, namespace: 'button-generated' }, (args) => ({
            contents: sources.get(args.path)!,
            loader: 'ts',
          }));
        },
      },
    ],
  });
  const clientCode = bundled.outputFiles[0].text;
  return {
    tagName,
    cssText,
    environmentCssText,
    clientCode,
    generatedFiles,
    render: server.renderToString,
    provenance: {
      ...compilation.output.provenance,
      profile: compilation.output.profile,
      sourceFiles: compilation.ir.sourceFiles.map(({ file, sha256 }) => ({ file, sha256 })),
      binding: server.hydrationBinding,
      artifacts: server.hydrationArtifacts,
      environmentSources,
      themeActivation: { attribute: 'data-theme', value: 'light' },
      generatedFiles: generatedFiles.map((file) => ({
        path: file.path,
        sha256: createHash('sha256').update(file.contents).digest('hex'),
      })),
      cssSha256: createHash('sha256').update(cssText).digest('hex'),
      clientSha256: createHash('sha256').update(clientCode).digest('hex'),
    },
  };
}
