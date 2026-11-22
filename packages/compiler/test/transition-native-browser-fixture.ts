import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, version as esbuildVersion } from 'esbuild';
import { compilePrototype, writeCompilation } from '../src/compile';
import { generatedSourcePath } from '../src/emitter-map';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const profiles = {
  react: 'react-dom-source-v1',
  vue: 'vue-source-v1',
  vue2: 'vue2-source-v1',
  wc: 'web-component-source-v1',
};

async function compilerInputs() {
  const names = execFileSync(
    'git',
    [
      'ls-files',
      '-z',
      '--',
      'packages/compiler/src',
      'packages/prototypes/base/src/transition',
      'packages/compiler/package.json',
      'package.json',
      'pnpm-lock.yaml',
      'tsconfig.json',
    ],
    { cwd: root, encoding: 'utf8' }
  )
    .split('\0')
    .filter(Boolean);
  return Object.fromEntries(
    await Promise.all(
      names.map(async (name) => [name, digest(await readFile(path.join(root, name)))])
    )
  );
}

/** Produce actual native modules from the shared authored Transition source. */
export async function buildTransitionNativeFixture(target: keyof typeof profiles) {
  const parent = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ?? tmpdir();
  await mkdir(parent, { recursive: true });
  const evidenceDir = await mkdtemp(path.join(parent, 'transition-native-'));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const status = execFileSync('git', ['status', '--porcelain=v1'], { cwd: root, encoding: 'utf8' });
  if (process.env.CANDIDATE_SHA && process.env.CANDIDATE_SHA !== head)
    throw new Error('Transition fixture checkout does not match CANDIDATE_SHA');
  const compilerSource = await compilerInputs();
  const files: Record<string, string> = {};
  for (const name of ['as-transition.proto.ts', 'machine.ts', 'types.ts'])
    files[`transition/${name}`] = await readFile(
      path.join(root, 'packages/prototypes/base/src/transition', name),
      'utf8'
    );
  const imports: string[] = [];
  const table: Record<string, Record<string, string>> = {};
  const artifacts: Record<string, string> = {};
  const sources: Record<string, string> = {};
  for (const [name, contents] of Object.entries(files)) sources[name] = digest(contents);
  const selectedProfiles = { [target]: profiles[target] };
  for (const [target, profile] of Object.entries(selectedProfiles)) {
    table[target] = {};
    for (const variant of ['ordinary', 'prepared']) {
      const source = `import {definePrototype} from '@proto.ui/core';
import {asTransition} from './transition/as-transition.proto';
export default definePrototype({name:'browser-transition-${variant}',setup(){
  asTransition().configure({coldEntryPreparation:${variant === 'prepared'},appear:false,enterDuration:200,leaveDuration:500});
  return r=>r.el('section',['Transition view ',r.slot()]);
}});`;
      const compiled = compilePrototype(source, { profile, fileName: 'entry.proto.ts', files });
      if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
      const directory = path.join(evidenceDir, 'generated', target, variant);
      await mkdir(path.dirname(directory), { recursive: true });
      const written = await writeCompilation(compiled.value, directory);
      if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
      const identifier = `${target}_${variant}`;
      imports.push(
        `import * as ${identifier} from ${JSON.stringify(path.join(directory, generatedSourcePath(compiled.value.output.profile)))};`
      );
      table[target][variant] = identifier;
      sources[`${target}/${variant}/entry.proto.ts`] = digest(source);
      await mkdir(path.join(evidenceDir, 'authored'), { recursive: true });
      await writeFile(path.join(evidenceDir, 'authored', `${variant}.proto.ts`), source);
      for (const filename of written.value.files)
        artifacts[path.relative(evidenceDir, filename)] = digest(await readFile(filename));
    }
  }
  const entries = `{${Object.entries(table)
    .map(
      ([target, variants]) =>
        `${target}:{${Object.entries(variants)
          .map(([variant, name]) => `${variant}:${name}`)
          .join(',')}}`
    )
    .join(',')}}`;
  const entrySource = `${imports.join('\n')}
import {createTransitionBrowserFixture} from ${JSON.stringify(path.join(root, 'packages/compiler/test/transition-browser-consumer.ts'))};
export const fixture = createTransitionBrowserFixture(${entries});`;
  const consumerRequire = createRequire(new URL('../package.json', import.meta.url));
  const positioningRequire = createRequire(
    new URL('../../modules/positioning/package.json', import.meta.url)
  );
  const built = await build({
    stdin: {
      contents: entrySource,
      sourcefile: 'transition-native-entry.ts',
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    globalName: 'transitionNative',
    target: 'es2022',
    tsconfig: path.join(root, 'tsconfig.json'),
    metafile: true,
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [
      {
        name: 'real-framework-consumer',
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
  const bundle = built.outputFiles[0].text;
  const inputs: Record<string, string> = {};
  for (const filename of Object.keys(built.metafile.inputs)) {
    if (filename === 'transition-native-entry.ts' || filename === '<stdin>') continue;
    inputs[path.relative(root, path.resolve(root, filename))] = digest(
      await readFile(path.resolve(root, filename))
    );
  }
  for (const filename of [
    'pnpm-lock.yaml',
    'packages/compiler/test/transition-native-browser-fixture.ts',
    'packages/compiler/test/transition-native.browser.test.ts',
  ])
    inputs[filename] = digest(await readFile(path.join(root, filename)));
  const afterHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  if (
    head !== afterHead ||
    JSON.stringify(compilerSource) !== JSON.stringify(await compilerInputs())
  )
    throw new Error('Compiler/source checkout changed while building the Transition consumer');
  await writeFile(path.join(evidenceDir, 'client.js'), bundle);
  await writeFile(
    path.join(evidenceDir, 'source.json'),
    JSON.stringify(
      {
        head,
        status,
        node: process.version,
        esbuild: esbuildVersion,
        profiles: selectedProfiles,
        compilerSource,
        sources,
        artifacts,
        inputs,
        bundleSha256: digest(bundle),
        scope: `Actual authored Runtime and generated ${target} lifecycle consumers; ordinary imports, native DOM and real timers. No GPUI, OS assistive technology or performance certification.`,
      },
      null,
      2
    ) + '\n'
  );
  return { evidenceDir, bundle, head, bundleSha256: digest(bundle) };
}
