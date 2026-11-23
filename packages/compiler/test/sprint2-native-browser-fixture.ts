import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { build, version as esbuildVersion } from 'esbuild';
import { compileFile, compilePrototype, writeCompilation } from '../src/compile';
import { generatedSourcePath } from '../src/emitter-map';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const profiles = {
  react: 'react-dom-source-v1',
  vue: 'vue-source-v1',
  vue2: 'vue2-source-v1',
  wc: 'web-component-source-v1',
} as const;
export const candidateTextSource = `import {definePrototype} from '@proto.ui/core';import {asTextControl} from '@proto.ui/hooks';import {declareTextControl} from '@proto.ui/module-text-control';
export default definePrototype({name:'native-candidate-owner',modules:[declareTextControl({content:'plain-text',lineMode:'single',engine:'host'})],setup(def){
  def.props.define({present:{type:'boolean',default:true}});
  const editor=asTextControl();const candidate=def.state.string('candidate','');
  def.expose.state('candidate',candidate);def.expose.method('read',()=>editor.snapshot());
  def.expose.method('accept',(value:string)=>editor.sync({value}));
  def.lifecycle.onCreated(()=>editor.sync({valueMode:'controlled',value:'5'}));
  def.props.watch(['present'],(run,next)=>run.lifecycle.setPresent(next.present));
  editor.on('input',(run,event)=>{editor.sync({value:editor.snapshot()?.value??''});candidate.set(event.value);});
  return()=>null;
}});`;

export async function buildSprint2NativeFixture() {
  const parent = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ?? tmpdir();
  await mkdir(parent, { recursive: true });
  const evidenceDir = await mkdtemp(path.join(parent, 'sprint2-native-'));
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const candidate = {
    head: git('rev-parse', 'HEAD').trim(),
    tree: git('rev-parse', 'HEAD^{tree}').trim(),
    status: git('status', '--porcelain=v1', '--untracked-files=all'),
    diffSha256: hash(git('diff', '--binary', 'HEAD', '--')),
  };
  if (process.env.CANDIDATE_SHA && candidate.head !== process.env.CANDIDATE_SHA)
    throw new Error('Candidate SHA mismatch');
  const sourceFiles: { path: string; sha256: string; bytes: number }[] = [];
  async function visit(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile() && file.endsWith('.ts')) {
        const content = await readFile(file);
        sourceFiles.push({
          path: path.relative(root, file),
          sha256: hash(content),
          bytes: content.length,
        });
      }
    }
  }
  await visit(path.join(root, 'packages/compiler/src'));
  for (const name of [
    'sprint2-browser-consumer.ts',
    'sprint2-native-browser-fixture.ts',
    'sprint2-native.browser.test.ts',
  ]) {
    const file = path.join(root, 'packages/compiler/test', name),
      content = await readFile(file);
    sourceFiles.push({
      path: path.relative(root, file),
      sha256: hash(content),
      bytes: content.length,
    });
  }
  sourceFiles.sort((a, b) => a.path.localeCompare(b.path));
  const imports: string[] = [],
    table: Record<string, Record<string, string>> = {},
    compilations: unknown[] = [],
    artifacts: unknown[] = [];
  for (const [target, profile] of Object.entries(profiles)) {
    table[target] = {};
    for (const kind of ['base', 'shadcn', 'brutalist', 'text']) {
      const entry =
        kind === 'text'
          ? 'native-candidate-owner.proto.ts'
          : `packages/prototypes/${kind}/src/button/button.proto.ts`;
      const result =
        kind === 'text'
          ? compilePrototype(candidateTextSource, { fileName: entry, profile })
          : await compileFile(entry, { root, profile });
      if (!result.ok)
        throw new Error(JSON.stringify({ target, kind, diagnostics: result.diagnostics }));
      compilations.push({
        target,
        kind,
        entry,
        consumerNature:
          kind === 'text' ? 'independent-shared-contract-fixture' : 'unchanged-public-family',
        profile,
        sourceSha256: result.value.ir.source.sha256,
        sourceFiles: result.value.ir.sourceFiles.map(({ file, sha256, content }) => ({
          file,
          sha256,
          bytes: Buffer.byteLength(content),
        })),
        dependencies: result.value.output.dependencies,
      });
      const directory = path.join(evidenceDir, 'generated', target, kind);
      await mkdir(path.dirname(directory), { recursive: true });
      const written = await writeCompilation(result.value, directory);
      if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
      const name = target + '_' + kind;
      table[target][kind] = name;
      imports.push(
        `import * as ${name} from ${JSON.stringify(path.join(directory, generatedSourcePath(profile)))};`
      );
      for (const file of written.value.files) {
        const bytes = await readFile(file);
        artifacts.push({
          path: path.relative(evidenceDir, file),
          sha256: hash(bytes),
          bytes: bytes.length,
        });
      }
    }
  }
  const mapping =
    '{' +
    Object.entries(table)
      .map(
        ([target, kinds]) =>
          target +
          ':{' +
          Object.entries(kinds)
            .map(([kind, name]) => kind + ':' + name)
            .join(',') +
          '}'
      )
      .join(',') +
    '}';
  const entry =
    imports.join('\n') +
    `\nimport {createSprint2BrowserConsumer} from ${JSON.stringify(path.join(root, 'packages/compiler/test/sprint2-browser-consumer.ts'))};export const fixture=createSprint2BrowserConsumer(${mapping});`;
  const require = createRequire(new URL('../package.json', import.meta.url));
  const bundled = await build({
    stdin: {
      contents: entry,
      sourcefile: 'sprint2-native-entry.ts',
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    globalName: 'sprint2Native',
    target: 'es2022',
    tsconfig: path.join(root, 'tsconfig.json'),
    metafile: true,
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [
      {
        name: 'declared-native-frameworks',
        setup(builder) {
          builder.onResolve({ filter: /^(?:react(?:\/.*)?|react-dom(?:\/.*)?|vue)$/ }, (args) => ({
            path: require.resolve(args.path),
          }));
        },
      },
    ],
  });
  const bundle = bundled.outputFiles[0].text,
    inputs: Record<string, string> = {};
  for (const file of Object.keys(bundled.metafile.inputs)) {
    if (file === 'sprint2-native-entry.ts' || file === '<stdin>') continue;
    const absolute = path.resolve(root, file);
    inputs[path.relative(root, absolute)] = hash(await readFile(absolute));
  }
  if (
    Object.keys(inputs).some(
      (file) =>
        /packages\/(?:runtime|modules|prototypes)\/.*\/src\//.test(file) ||
        file.includes('/@floating-ui/')
    )
  )
    throw new Error(
      'Native browser consumer retained an undeclared runtime or geometry implementation'
    );
  for (const file of sourceFiles)
    if (hash(await readFile(path.join(root, file.path))) !== file.sha256)
      throw new Error('Compiler or replay source changed while assembling');
  const manifest = {
    candidate,
    node: process.version,
    esbuild: esbuildVersion,
    lockSha256: hash(await readFile(path.join(root, 'pnpm-lock.yaml'))),
    sourceFiles,
    compilations,
    artifacts,
    inputs,
    entrySha256: hash(entry),
    bundleSha256: hash(bundle),
    scope:
      '12 unchanged family Buttons and four independent TextControl candidates in ordinary generated framework consumers. Browser outcomes require the separate Chromium run; static assembly is not browser acceptance.',
  };
  await writeFile(path.join(evidenceDir, 'entry.ts'), entry);
  await writeFile(path.join(evidenceDir, 'client.js'), bundle);
  const manifestText = JSON.stringify(manifest, null, 2) + '\n';
  await writeFile(path.join(evidenceDir, 'build.json'), manifestText);
  return { evidenceDir, bundle, head: candidate.head, buildSha256: hash(manifestText) };
}
