#!/usr/bin/env node
/** Supported build-time CLI/JavaScript artifact from a clean, immutable source pin. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, version as esbuildVersion } from 'esbuild';
import ts from 'typescript';
import { parse as parseYaml } from 'yaml';
import {
  IR_VERSION,
  TARGET_PROFILES,
  writeArtifactSet,
  type CompilerBuildIdentity,
  type OutputArtifact,
} from '../../packages/compiler/src/index';

const root = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
const require = createRequire(import.meta.url);
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}
function cleanPin(revision: string): void {
  if (!/^[a-f0-9]{40}$/.test(revision) || git('rev-parse', 'HEAD') !== revision)
    throw new Error('--revision must be the full 40-character SHA of the checked-out HEAD.');
  if (git('status', '--porcelain', '--untracked-files=normal'))
    throw new Error('A pinned compiler requires a clean checkout, including untracked source.');
}
function argumentsFrom(argv: string[]) {
  const options: Record<string, string> = {};
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (!['--revision', '--output'].includes(key) || options[key] || !argv[index + 1])
      throw new Error(
        'Usage: node --import tsx scripts/compiler/build-pinned.ts --revision <full SHA> --output <fresh directory>'
      );
    options[key] = argv[++index];
  }
  if (!options['--revision'] || !options['--output'])
    throw new Error('Both --revision and --output are required.');
  return { revision: options['--revision'], output: path.resolve(options['--output']) };
}

async function main() {
  const { revision, output } = argumentsFrom(process.argv.slice(2));
  cleanPin(revision);
  if (process.versions.node.split('.')[0] !== '24')
    throw new Error('The pinned build requires Node 24.');
  const lock = await readFile(path.join(root, 'pnpm-lock.yaml'), 'utf8');
  const parsedLock = parseYaml(lock);
  const declaredTypeScript = parsedLock.importers['.'].devDependencies.typescript.version;
  const declaredEsbuild = parsedLock.importers['.'].devDependencies.esbuild.version;
  if (ts.version !== declaredTypeScript || esbuildVersion !== declaredEsbuild)
    throw new Error(
      'Installed TypeScript/esbuild do not match pnpm-lock.yaml; install with --frozen-lockfile.'
    );
  const integrity = parsedLock.packages[`typescript@${ts.version}`]?.resolution?.integrity;
  if (typeof integrity !== 'string')
    throw new Error('The lockfile must declare TypeScript integrity.');
  const profiles = json({ irVersion: IR_VERSION, profiles: TARGET_PROFILES });
  const identity: CompilerBuildIdentity = Object.freeze({
    schema: 'proto-ui.compiler-build.v1',
    revision,
    lockSha256: hash(lock),
    profilesSha256: hash(profiles),
    node: process.versions.node,
    typescript: ts.version,
    esbuild: esbuildVersion,
  });
  // Fixed virtual output paths keep bytes and standard maps independent of --output.
  const virtualOutput = path.join(root, '.pinned-compiler-build');
  const bundled = await build({
    absWorkingDir: root,
    entryPoints: { index: 'packages/compiler/src/index.ts' },
    outdir: virtualOutput,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    external: ['typescript'],
    sourcemap: 'linked',
    sourcesContent: true,
    write: false,
    metafile: true,
    logLevel: 'silent',
    plugins: [
      {
        name: 'verified-compiler-build-identity',
        setup(builder) {
          builder.onLoad({ filter: /[/\\]compiler-build\.ts$/ }, ({ path: filename }) => {
            if (filename !== path.join(root, 'packages/compiler/src/compiler-build.ts')) return;
            return {
              contents: `export const compilerBuildIdentity = Object.freeze(${JSON.stringify(identity)});`,
              loader: 'ts',
            };
          });
        },
      },
    ],
  });
  const externalImports = [
    ...new Set(
      Object.values(bundled.metafile!.outputs).flatMap((entry) =>
        entry.imports
          .filter((dependency) => dependency.external)
          .map((dependency) => dependency.path)
      )
    ),
  ].sort();
  if (
    externalImports.some(
      (dependency) => dependency !== 'typescript' && !dependency.startsWith('node:')
    )
  )
    throw new Error(`Undeclared compiler runtime dependency: ${externalImports.join(', ')}`);
  const inputPaths = [
    ...new Set([
      ...Object.keys(bundled.metafile!.inputs),
      'scripts/compiler/build-pinned.ts',
      'packages/compiler/package.json',
      'package.json',
      'pnpm-lock.yaml',
      'LICENSE',
    ]),
  ].sort();
  const inputs = await Promise.all(
    inputPaths.map(async (filename) => {
      const bytes = await readFile(path.join(root, filename));
      // Every compile-time input must belong to the exact pin; generated/vendor files
      // must not silently become a second source authority.
      git('ls-files', '--error-unmatch', '--', filename);
      return { path: filename, sha256: hash(bytes), bytes: bytes.length };
    })
  );
  const name = '@proto.ui/compiler-pinned',
    version = `0.0.0-pinned.${revision}`;
  const typeScriptManifest = JSON.parse(
    await readFile(require.resolve('typescript/package.json'), 'utf8')
  );
  const manifest = {
    name,
    version,
    private: true,
    type: 'module',
    engines: { node: '24.x' },
    exports: {
      '.': './index.js',
      './build': './compiler-build.json',
      './profiles': './profiles.json',
    },
    bin: { 'proto-ui-compiler': './cli.js' },
    dependencies: { typescript: ts.version },
    description:
      'Supported source-pinned build-time compiler artifact; private experimental profiles, no registry publication.',
  };
  const npmLock = {
    name,
    version,
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': {
        name,
        version,
        dependencies: manifest.dependencies,
        bin: manifest.bin,
        engines: manifest.engines,
      },
      'node_modules/typescript': {
        version: ts.version,
        resolved: `https://registry.npmjs.org/typescript/-/typescript-${ts.version}.tgz`,
        integrity,
        license: typeScriptManifest.license,
        bin: typeScriptManifest.bin,
        engines: typeScriptManifest.engines,
      },
    },
  };
  const artifacts: OutputArtifact[] = bundled.outputFiles!.map((file) => ({
    path: path.relative(virtualOutput, file.path).split(path.sep).join('/'),
    contents: file.text,
    kind: file.path.endsWith('.map') ? 'source-map' : 'source',
  }));
  artifacts.push(
    {
      path: 'cli.js',
      kind: 'source',
      contents:
        "#!/usr/bin/env node\nimport { runCompilerCli, compilerBuildIdentity } from './index.js';\nif (process.argv.length === 3 && process.argv[2] === '--build-info') console.log(JSON.stringify(compilerBuildIdentity, null, 2));\nelse process.exitCode = await runCompilerCli(process.argv.slice(2));\n",
    },
    { path: 'package.json', kind: 'manifest', contents: json(manifest) },
    { path: 'package-lock.json', kind: 'manifest', contents: json(npmLock) },
    { path: 'profiles.json', kind: 'manifest', contents: profiles },
    {
      path: 'LICENSE',
      kind: 'manifest',
      contents: await readFile(path.join(root, 'LICENSE'), 'utf8'),
    },
    {
      path: 'README.md',
      kind: 'manifest',
      contents: `# Proto-UI pinned compiler\n\nSource revision: ${revision}\n\nRun \`npm ci --ignore-scripts\` in this directory, then \`node cli.js --build-info\` and \`node cli.js check <entry.proto.ts> --root <source root> --profile <profile>\`. The only compiler runtime package is TypeScript ${ts.version}; Node 24 built-ins supply the remaining imports. No Proto-UI public-package build or Floating UI installation is needed for the compiler. Generated consumers must install the exact dependencies in their own provenance.\n\nKeep this directory immutable. Generated output is consumer-owned and editable; compile uses a new destination, diff is read-only, and watch keeps immutable revisions. Create the parent directory yourself; existing output is never overwritten. The source SHA and profiles.json digest are the support pin. These private experimental profiles are not registry releases or broader semantic admission. JavaScript API exports are available through index.js; this artifact does not provide a declaration-file release.\n`,
    }
  );
  const files = artifacts
    .map((artifact) => ({
      path: artifact.path,
      bytes: Buffer.byteLength(artifact.contents),
      sha256: hash(artifact.contents),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  artifacts.push({
    path: 'compiler-build.json',
    kind: 'manifest',
    contents: json({
      ...identity,
      repository: 'https://github.com/Proto-UI/Proto-UI',
      status: 'private-source-pinned',
      packageManager: JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
        .packageManager,
      externalImports,
      inputs,
      files,
      costs: {
        bundledSourceBytes: files
          .filter((file) => file.path.endsWith('.js'))
          .reduce((sum, file) => sum + file.bytes, 0),
        mapBytes: files
          .filter((file) => file.path.endsWith('.map'))
          .reduce((sum, file) => sum + file.bytes, 0),
        retainedConsumerBytes: null,
        consumerInitialization: null,
      },
    }),
  });
  cleanPin(revision);
  const result = await writeArtifactSet(artifacts, output);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  console.log(json({ ...identity, directory: output, files: result.value.files.length }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
