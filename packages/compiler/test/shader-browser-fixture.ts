import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, version as esbuildVersion } from 'esbuild';
import { compileFile, writeCompilation } from '../src/compile';
import { generatedSourcePath } from '../src/emitter-map';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const digest = (text: string | Uint8Array) => createHash('sha256').update(text).digest('hex');
const profiles = {
  react: 'react-dom-source-v1',
  vue: 'vue-source-v1',
  vue2: 'vue2-source-v1',
  wc: 'web-component-source-v1',
};

async function generatorManifest() {
  const files: { file: string; sha256: string; bytes: number }[] = [];
  async function visit(directory: string) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, item.name);
      if (item.isDirectory()) await visit(filename);
      else if (item.isFile() && item.name.endsWith('.ts')) {
        const contents = await readFile(filename);
        files.push({
          file: path.relative(root, filename),
          sha256: digest(contents),
          bytes: contents.byteLength,
        });
      }
    }
  }
  await visit(path.join(root, 'packages/compiler/src'));
  files.sort((a, b) => a.file.localeCompare(b.file));
  return { sha256: digest(JSON.stringify(files)), files };
}

/** Retain ordinary generated native imports and every actual browser bundle input. */
export async function buildPhysicalPresentationBrowserFixture(configuration: {
  name: string;
  entry: string;
  consumer: string;
  factory: string;
  global: string;
  harness: readonly string[];
  scope: string;
  prototypeArgument?: boolean;
}) {
  const { entry } = configuration;
  const parent = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ?? tmpdir();
  await mkdir(parent, { recursive: true });
  const evidenceDir = await mkdtemp(path.join(parent, configuration.name + '-'));
  const git = (args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const head = git(['rev-parse', 'HEAD']).trim(),
    status = git(['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  if (process.env.CANDIDATE_SHA && process.env.CANDIDATE_SHA !== head)
    throw new Error('Presentation fixture does not match CANDIDATE_SHA');
  const sourceGenerator = await generatorManifest();
  const candidate = {
    head,
    headTree: git(['rev-parse', 'HEAD^{tree}']).trim(),
    dirty: status.length > 0,
    statusSha256: digest(status),
    trackedDiffSha256: digest(git(['diff', '--binary', 'HEAD', '--'])),
  };
  const artifacts: { path: string; sha256: string; bytes: number }[] = [],
    compilations: unknown[] = [],
    imports: string[] = [];
  for (const [target, profile] of Object.entries(profiles)) {
    const result = await compileFile(entry, { root, profile });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    const sourceFiles = [];
    for (const source of result.value.ir.sourceFiles) {
      if (
        digest(source.content) !== source.sha256 ||
        (await readFile(path.resolve(root, source.file), 'utf8')) !== source.content
      )
        throw new Error(`Presentation source changed: ${source.file}`);
      sourceFiles.push({
        file: source.file,
        sha256: source.sha256,
        bytes: Buffer.byteLength(source.content),
      });
    }
    compilations.push({
      target,
      profile,
      entry,
      sourceSha256: result.value.ir.source.sha256,
      sourceFiles,
    });
    const directory = path.join(evidenceDir, 'generated', target);
    await mkdir(path.dirname(directory), { recursive: true });
    const written = await writeCompilation(result.value, directory);
    if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
    imports.push(
      `import * as ${target} from ${JSON.stringify(path.join(directory, generatedSourcePath(result.value.output.profile)))};`
    );
    for (const filename of written.value.files) {
      const contents = await readFile(filename);
      artifacts.push({
        path: path.relative(evidenceDir, filename),
        sha256: digest(contents),
        bytes: contents.byteLength,
      });
    }
  }
  const prototypeImport = configuration.prototypeArgument
    ? `import prototype from ${JSON.stringify(path.join(root, entry))};\n`
    : '';
  const entrySource = `${imports.join('\n')}\n${prototypeImport}import {${configuration.factory}} from ${JSON.stringify(path.join(root, configuration.consumer))};\nexport const fixture=${configuration.factory}({react,vue,vue2,wc}${configuration.prototypeArgument ? ', prototype' : ''});\n`;
  const consumerRequire = createRequire(new URL('../package.json', import.meta.url));
  const positioningRequire = createRequire(
    new URL('../../modules/positioning/package.json', import.meta.url)
  );
  const bundled = await build({
    stdin: {
      contents: entrySource,
      sourcefile: 'presentation-browser-entry.ts',
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    globalName: configuration.global,
    target: 'es2022',
    tsconfig: path.join(root, 'tsconfig.json'),
    metafile: true,
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [
      {
        name: 'real-framework-dependencies',
        setup(builder) {
          builder.onResolve(
            { filter: /^(?:react(?:\/.*)?|react-dom(?:\/.*)?|vue|@floating-ui\/dom)$/ },
            (args) => ({
              path: (args.path === '@floating-ui/dom'
                ? positioningRequire
                : consumerRequire
              ).resolve(args.path),
            })
          );
        },
      },
    ],
  });
  const bundle = bundled.outputFiles[0].text,
    inputs: Record<string, string> = {};
  for (const filename of Object.keys(bundled.metafile.inputs)) {
    if (filename === 'presentation-browser-entry.ts' || filename === '<stdin>') continue;
    const absolute = path.resolve(root, filename);
    inputs[path.relative(root, absolute)] = digest(await readFile(absolute));
  }
  const harness: Record<string, string> = {};
  for (const file of [
    ...configuration.harness,
    'packages/compiler/test/shader-browser-fixture.ts',
    'scripts/test/runtime-test-plan.mjs',
  ])
    harness[file] = digest(await readFile(path.join(root, file)));
  if ((await generatorManifest()).sha256 !== sourceGenerator.sha256)
    throw new Error('Compiler changed during presentation fixture generation');
  const buildManifest =
    JSON.stringify(
      {
        candidate,
        node: process.version,
        esbuildVersion,
        bundleSha256: digest(bundle),
        entrySha256: digest(entrySource),
        lockSha256: digest(await readFile(path.join(root, 'pnpm-lock.yaml'))),
        sourceGenerator,
        compilations,
        artifacts,
        inputs,
        harness,
        scope: configuration.scope,
      },
      null,
      2
    ) + '\n';
  await writeFile(path.join(evidenceDir, 'entry.ts'), entrySource);
  await writeFile(path.join(evidenceDir, 'client.js'), bundle);
  await writeFile(path.join(evidenceDir, 'build.json'), buildManifest);
  return { evidenceDir, bundle, head, buildSha256: digest(buildManifest) };
}

export const buildShaderBrowserFixture = (variant: 'inline' | 'static-data' = 'inline') =>
  buildPhysicalPresentationBrowserFixture({
    name: `shader-presentation-${variant}`,
    entry: `packages/compiler/test/fixtures/shader-${variant === 'inline' ? 'presentation' : 'static-data'}-owner.proto.ts`,
    consumer: 'packages/compiler/test/shader-browser-consumer.ts',
    factory: 'createShaderBrowserFixture',
    prototypeArgument: true,
    global: 'shaderNative',
    harness: [
      'packages/compiler/test/shader-presentation.browser.test.ts',
      'packages/compiler/test/shader-oracle.ts',
    ],
    scope: `Draft owned-pixels copy/tint graph (${variant} construction) through actual Feedback Runtime and four native Web profiles. Real Chromium WebGL2 readback and CSS background publication. This is not application backing-source admission or non-Web GPU acceptance.`,
  });
