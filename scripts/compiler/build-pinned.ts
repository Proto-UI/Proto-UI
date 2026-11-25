#!/usr/bin/env node
/** Supported build-time CLI/JavaScript artifact from a clean, immutable source pin. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, version as esbuildVersion } from 'esbuild';
import ts from 'typescript';
import { parse as parseYaml } from 'yaml';
import { PROTO_IR_VERSION } from '../../packages/compiler/src/ir/types';
import { COMPILATION_TARGETS } from '../../packages/compiler/src/targets/kinds';

const IR_VERSION = PROTO_IR_VERSION;
const TARGETS = COMPILATION_TARGETS;

interface CompilerBuildIdentity {
  readonly schema: 'proto-ui.compiler-package.v3';
  readonly revision: string;
  readonly lockSha256: string;
  readonly profilesSha256: string;
  readonly nativeSourcesSha256: string;
  readonly node: string;
  readonly typescript: string;
  readonly esbuild: string;
}

interface OutputArtifact {
  readonly path: string;
  readonly contents: string | Uint8Array;
  readonly kind: 'source' | 'source-map' | 'manifest' | 'native-source';
  readonly executable?: boolean;
}

async function writeArtifactSet(
  artifacts: readonly OutputArtifact[],
  destination: string
): Promise<{ ok: true; value: { files: string[] } } | { ok: false; diagnostics: string[] }> {
  // Claim the fresh directory atomically, including against dangling symlinks.
  try {
    await mkdir(destination);
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        'Cannot create a fresh package directory: ' + destination + ': ' + String(error),
      ],
    };
  }
  const written: string[] = [];
  for (const artifact of artifacts) {
    const outPath = path.join(destination, artifact.path);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, artifact.contents, { flag: 'wx' });
    if (artifact.executable) await chmod(outPath, 0o755);
    written.push(artifact.path);
  }
  return { ok: true, value: { files: written } };
}

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

async function nativeSources(): Promise<{ source: string; artifact: OutputArtifact }[]> {
  const base = 'packages/compiler/native/';
  const names = ['llvm-builder.cpp', 'rust-builder/Cargo.toml', 'rust-builder/Cargo.lock'];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(path.join(root, base, directory), { withFileTypes: true })) {
      const name = path.posix.join(directory, entry.name);
      if (entry.isDirectory()) await visit(name);
      else if (entry.isFile()) names.push(name);
      else throw new Error('Native builder assets must be regular source files: ' + name);
    }
  };
  await visit('rust-builder/src');
  return Promise.all(
    names.sort().map(async (name) => {
      const source = base + name;
      if (!(await lstat(path.join(root, source))).isFile())
        throw new Error('Invalid native source: ' + source);
      return {
        source,
        artifact: {
          path: 'native/' + name,
          kind: 'native-source' as const,
          contents: await readFile(path.join(root, source)),
        },
      };
    })
  );
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
  const native = await nativeSources();
  const nativeInventory = native.map(({ artifact }) => ({
    path: artifact.path,
    bytes: artifact.contents.length,
    sha256: hash(artifact.contents),
  }));
  const profiles = json({
    irVersion: IR_VERSION,
    targets: TARGETS,
    optionalKernelArtifacts: ['llvm-ir', 'wasm32'],
    backends: {
      react: 'typescript-factory-printer',
      gpui: 'syn-prettyplease',
      kernel: 'llvm-irbuilder',
    },
    admission:
      'Each target reports unsupported semantics; targets do not imply full prototype coverage.',
  });
  const identity: CompilerBuildIdentity = Object.freeze({
    schema: 'proto-ui.compiler-package.v3',
    revision,
    lockSha256: hash(lock),
    profilesSha256: hash(profiles),
    nativeSourcesSha256: hash(json(nativeInventory)),
    node: process.versions.node,
    typescript: ts.version,
    esbuild: esbuildVersion,
  });
  // Fixed virtual output paths keep bytes and standard maps independent of --output.
  const virtualOutput = path.join(root, '.pinned-compiler-build');
  const bundled = await build({
    absWorkingDir: root,
    entryPoints: {
      index: 'packages/compiler/src/index.ts',
      'kernel-host': 'packages/compiler/src/kernel-host.ts',
      cli: 'scripts/compiler/pinned-cli-entry.ts',
    },
    outdir: virtualOutput,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    external: ['typescript'],
    // Each entry is emitted at package root. Native paths remain package-relative
    // after the package is moved; no source checkout path is embedded.
    define: { __PUI_COMPILER_NATIVE_ASSET_BASE__: JSON.stringify('./native/') },
    alias: { '@proto.ui/core': path.join(root, 'packages/core/src/index.ts') },
    sourcemap: 'linked',
    sourcesContent: true,
    write: false,
    metafile: true,
    logLevel: 'silent',
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
      ...native.map((value) => value.source),
      'scripts/compiler/build-pinned.ts',
      'packages/compiler/package.json',
      'package.json',
      'tsconfig.json',
      'pnpm-lock.yaml',
      'LICENSE',
    ]),
  ].sort();
  const inputs = await Promise.all(
    inputPaths.map(async (filename) => {
      if (path.isAbsolute(filename) || filename.split(/[\\/]/).includes('..'))
        throw new Error('Compiler input escaped the source pin: ' + filename);
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
      './kernel-host': './kernel-host.js',
      './build': './compiler-build.json',
      './profiles': './profiles.json',
    },
    bin: { 'proto-ui-compiler': './cli.js' },
    dependencies: { typescript: ts.version },
    description:
      'Source-pinned compiler with native React/GPUI AST targets and LLVM IRBuilder assets; target admission is explicit.',
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
    executable: path.basename(file.path) === 'cli.js',
  }));
  artifacts.push(
    ...native.map((value) => value.artifact),
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
      contents: [
        '# Proto-UI pinned compiler',
        '',
        'Source revision: ' + revision,
        '',
        'Use Node 24. Run `npm ci --ignore-scripts` here, then `node cli.js --build-info` and `node cli.js info`.',
        'Compile with `node cli.js compile <entry.proto.ts> --root <authoring workspace> --target react --out <fresh directory>`.',
        'Targets are react, gpui, kernel and ir. `--ll`, `--wasm` and `--optimize` request optional LLVM kernel work.',
        '',
        'The JavaScript package dependency is TypeScript ' +
          ts.version +
          '. Node built-ins supply the remaining compiler imports.',
        'The authoring workspace must resolve its own Proto-UI source/types. Generated React components import React only.',
        'The GPUI backend requires Cargo and builds the included locked syn/prettyplease driver; generated crates declare their GPUI dependency.',
        'The LLVM backend requires llvm-config and a compatible C++ compiler. Verification/WASM additionally require opt, llc and wasm-ld as reported by `info`.',
        'The native/ directory is part of this package and must travel with index.js and cli.js. Builder binaries are cached outside the installation.',
        '',
        'compiler-build.json records the full source SHA, lock/tool versions, input hashes and output hashes, including native source and Cargo.lock.',
        'Move the whole directory as a unit. Compilation does not need the compiler source checkout.',
        'Unsupported semantics produce diagnostics; this package does not promise that every Base prototype is admitted.',
        'CLI compilation rejects existing generated files unless --overwrite is supplied. The current CLI does not provide the historical diff/watch commands.',
        'index.js exports the current compiler API. This artifact does not publish TypeScript declaration files or the historical compilerBuildIdentity API.',
        'kernel-host.js exposes bounded WASM ABI access under ./kernel-host; there is no ./runtime export or Proto interpreter.',
        '',
      ].join('\n'),
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
      nativeSources: nativeInventory,
      bytes: {
        bundledSourceBytes: files
          .filter((file) => file.path.endsWith('.js'))
          .reduce((sum, file) => sum + file.bytes, 0),
        mapBytes: files
          .filter((file) => file.path.endsWith('.map'))
          .reduce((sum, file) => sum + file.bytes, 0),
        nativeSourceBytes: nativeInventory.reduce((sum, file) => sum + file.bytes, 0),
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
