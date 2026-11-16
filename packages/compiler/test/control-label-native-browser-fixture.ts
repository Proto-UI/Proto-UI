import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { build, version as esbuildVersion } from 'esbuild';
import { compileFile, writeCompilation } from '../src/compile';
import { generatedSourcePath } from '../src/emitter-map';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const digest = (contents: string | Uint8Array) =>
  createHash('sha256').update(contents).digest('hex');
const profiles = {
  react: 'react-dom-source-v1',
  vue: 'vue-source-v1',
  vue2: 'vue2-source-v1',
  wc: 'web-component-source-v1',
};
const entries = {
  button: 'packages/prototypes/base/src/button/button.proto.ts',
  toggle: 'packages/prototypes/base/src/toggle/toggle.proto.ts',
  label: 'packages/prototypes/base/src/label/root.proto.ts',
};

async function sourceGeneratorManifest() {
  const files: { file: string; sha256: string; bytes: number }[] = [];
  async function visit(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(filename);
      else if (entry.isFile() && entry.name.endsWith('.ts')) {
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
  files.sort((left, right) => left.file.localeCompare(right.file));
  return { sha256: digest(JSON.stringify(files)), files };
}

async function testHarnessManifest() {
  const paths = [
    'packages/compiler/test/control-label-browser-consumer.ts',
    'packages/compiler/test/control-label-native-browser-fixture.ts',
    'packages/compiler/test/control-label-native.browser.test.ts',
    'scripts/test/runtime-test-plan.mjs',
    'apps/www/src/content/docs/zh-cn/browser-harness.ts',
  ];
  const files = await Promise.all(
    paths.sort().map(async (file) => {
      const contents = await readFile(path.join(root, file));
      return { file, sha256: digest(contents), bytes: contents.byteLength };
    })
  );
  return { sha256: digest(JSON.stringify(files)), files };
}

function candidateTree() {
  const git = (args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const status = git(['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  return {
    head: git(['rev-parse', 'HEAD']).trim(),
    headTree: git(['rev-parse', 'HEAD^{tree}']).trim(),
    dirty: status.length > 0,
    statusEntries: status.split('\0').filter(Boolean),
    statusSha256: digest(status),
    trackedDiffSha256: digest(git(['diff', '--binary', 'HEAD', '--'])),
  };
}

/** Build and retain the actual independently emitted native graphs and browser consumer. */
export async function buildControlLabelNativeFixture() {
  const parent = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ?? tmpdir();
  await mkdir(parent, { recursive: true });
  const evidenceDir = await mkdtemp(path.join(parent, 'control-label-native-'));
  const candidate = candidateTree();
  if (process.env.CANDIDATE_SHA && process.env.CANDIDATE_SHA !== candidate.head)
    throw new Error('The browser fixture checkout does not match CANDIDATE_SHA');
  const sourceGenerator = await sourceGeneratorManifest();
  const testHarness = await testHarnessManifest();
  const imports: string[] = [];
  const components: Record<string, Record<string, string>> = {};
  const artifacts: { path: string; sha256: string; bytes: number }[] = [];
  const compilations: {
    target: string;
    kind: string;
    entry: string;
    profile: string;
    sourceSha256: string;
    sourceFiles: { file: string; sha256: string; bytes: number }[];
  }[] = [];
  for (const [target, profile] of Object.entries(profiles)) {
    components[target] = {};
    for (const [kind, entry] of Object.entries(entries)) {
      const result = await compileFile(entry, { root, profile });
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      const sourceFiles: { file: string; sha256: string; bytes: number }[] = [];
      for (const source of result.value.ir.sourceFiles) {
        if (
          digest(source.content) !== source.sha256 ||
          (await readFile(path.resolve(root, source.file), 'utf8')) !== source.content
        )
          throw new Error(`Compiler source changed during collection: ${source.file}`);
        sourceFiles.push({
          file: source.file,
          sha256: source.sha256,
          bytes: Buffer.byteLength(source.content),
        });
      }
      compilations.push({
        target,
        kind,
        entry,
        profile,
        sourceSha256: result.value.ir.source.sha256,
        sourceFiles,
      });
      const directory = path.join(evidenceDir, 'generated', target, kind);
      await mkdir(path.dirname(directory), { recursive: true });
      const written = await writeCompilation(result.value, directory);
      if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
      const name = `${target}_${kind}`;
      imports.push(
        `import * as ${name} from ${JSON.stringify(path.join(directory, generatedSourcePath(result.value.output.profile)))};`
      );
      components[target][kind] = name;
      for (const filename of written.value.files) {
        const contents = await readFile(filename);
        artifacts.push({
          path: path.relative(evidenceDir, filename),
          sha256: digest(contents),
          bytes: contents.byteLength,
        });
      }
    }
  }
  const table = `{${Object.entries(components)
    .map(
      ([target, kinds]) =>
        `${target}:{${Object.entries(kinds)
          .map(([kind, name]) => `${kind}:${name}`)
          .join(',')}}`
    )
    .join(',')}}`;
  const entrySource = `${imports.join('\n')}\nimport {createControlLabelBrowserFixture} from ${JSON.stringify(path.join(root, 'packages/compiler/test/control-label-browser-consumer.ts'))};\nexport const fixture = createControlLabelBrowserFixture(${table});\n`;
  const consumerRequire = createRequire(new URL('../package.json', import.meta.url));
  const positioningRequire = createRequire(
    new URL('../../modules/positioning/package.json', import.meta.url)
  );
  const bundled = await build({
    stdin: {
      contents: entrySource,
      sourcefile: 'control-label-native-entry.ts',
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    globalName: 'controlLabelNative',
    target: 'es2022',
    tsconfig: path.join(root, 'tsconfig.json'),
    metafile: true,
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [
      {
        name: 'real-host-declarations-and-runtime',
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
  const bundle = bundled.outputFiles[0].text;
  const inputs: Record<string, string> = {};
  for (const filename of Object.keys(bundled.metafile.inputs)) {
    if (filename === 'control-label-native-entry.ts' || filename === '<stdin>') continue;
    const absolute = path.resolve(root, filename);
    inputs[path.relative(root, absolute)] = digest(await readFile(absolute));
  }
  if ((await sourceGeneratorManifest()).sha256 !== sourceGenerator.sha256)
    throw new Error('Compiler implementation changed while building the browser fixture');
  if ((await testHarnessManifest()).sha256 !== testHarness.sha256)
    throw new Error('Browser test implementation changed while building the fixture');
  const candidateAfter = candidateTree();
  if (JSON.stringify(candidateAfter) !== JSON.stringify(candidate))
    throw new Error('Candidate checkout changed while building the browser fixture');
  await writeFile(path.join(evidenceDir, 'entry.ts'), entrySource);
  await writeFile(path.join(evidenceDir, 'client.js'), bundle);
  const buildManifest =
    JSON.stringify(
      {
        head: candidate.head,
        candidate,
        node: process.version,
        esbuildVersion,
        bundleSha256: digest(bundle),
        entrySha256: digest(entrySource),
        lockSha256: digest(await readFile(path.join(root, 'pnpm-lock.yaml'))),
        profiles,
        sourceGenerator,
        testHarness,
        compilations,
        artifacts,
        inputs,
        scope:
          'Actual Base Button/Toggle/Label, ordinary generated imports, public factory refs and real Runtime Adapters. Native Chromium input evidence; no OS assistive-technology certification or Toggle Group compiler claim.',
      },
      null,
      2
    ) + '\n';
  await writeFile(path.join(evidenceDir, 'build.json'), buildManifest);
  return { evidenceDir, bundle, head: candidate.head, buildSha256: digest(buildManifest) };
}
