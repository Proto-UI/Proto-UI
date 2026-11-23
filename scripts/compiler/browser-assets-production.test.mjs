import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { runCommand } from '../test/sprint3-consumer-evidence.mjs';

const repository = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test(
  'relocated production modules keep source and target assets bound to their own checkout',
  { timeout: 120_000 },
  async (t) => {
    const cache = path.join(repository, '.cache');
    await mkdir(cache, { recursive: true });
    const output = await mkdtemp(path.join(cache, 'compiler-assets-production-'));
    const foreign = await realpath(
      await mkdtemp(path.join(tmpdir(), 'compiler-assets-foreign-cwd-'))
    );
    t.after(async () => {
      await rm(output, { recursive: true, force: true });
      await rm(foreign, { recursive: true, force: true });
    });
    // A separate real worktree makes an accidental caller-cwd Git lookup observable.
    execFileSync('git', ['init', '--quiet', foreign], { encoding: 'utf8' });
    const bundle = path.join(output, 'apps/www/dist/chunks/compiler-assets.mjs');
    await build({
      stdin: {
        contents: [
          "export { getStaticPaths, GET } from './apps/www/src/pages/compiler-assets/source/[id].json.ts';",
          "export { buildBrowserAssets } from './scripts/compiler/browser-assets.ts';",
          "export { browserRepositoryRoot } from './scripts/compiler/browser-inputs.mjs';",
        ].join('\n'),
        resolveDir: repository,
        sourcefile: 'production-root-consumer.ts',
        loader: 'ts',
      },
      outfile: bundle,
      bundle: true,
      platform: 'node',
      format: 'esm',
      packages: 'external',
    });
    const fixture = JSON.parse(
      await readFile(
        path.join(repository, 'internal/compiler/website-demo-migrations.json'),
        'utf8'
      )
    );
    const expected = fixture.prototypes.filter((row) => row.entry);
    const registration = expected.find((row) => row.id === 'base-button');
    assert.ok(registration, 'the actual source route must include the public Base Button');
    const sourceBytes = await readFile(path.join(repository, registration.entry));
    const program = [
      "import assert from 'node:assert/strict';",
      "import {createHash} from 'node:crypto';",
      "const hash = (value) => createHash('sha256').update(value).digest('hex');",
      'const owner = await import(process.env.PUI_RELOCATED_ASSET_MODULE);',
      // Exercise the same getStaticPaths entry that failed the actual Astro build.
      'const paths = await owner.getStaticPaths();',
      'assert.deepEqual(paths.map((row) => row.params.id).sort(), JSON.parse(process.env.PUI_EXPECTED_SOURCE_IDS));',
      "const response = await owner.GET({params:{id:'base-button'}});",
      'assert.equal(response.status, 200);',
      'const source = await response.json();',
      "assert.equal(source.id, 'base-button');",
      'assert.equal(hash(source.source), process.env.PUI_EXPECTED_SOURCE_SHA256);',
      'assert.equal(source.files[source.entry], source.source);',
      'assert.equal(source.sourceGraphSha256, hash(JSON.stringify({entry:source.entry,files:source.files,sourceImports:source.sourceImports})));',
      'assert.equal(owner.browserRepositoryRoot, process.env.PUI_EXPECTED_REPOSITORY);',
      // Real compiler/target builds also exercise the root used by build-browser
      // and every input hashing default; a source-route-only repair is insufficient.
      'const assets = await owner.buildBrowserAssets(process.env.PUI_ASSET_BUILD_DIRECTORY);',
      "const manifest = JSON.parse(assets.get('input-manifest.json'));",
      "assert.equal(manifest.kind, 'canonical-browser-build-inputs-v1');",
      "assert.ok(manifest.sourceFiles['internal/compiler/website-demo-migrations.json']);",
      "assert.ok(manifest.sourceFiles['packages/compiler/src/browser/entry.ts']);",
      "assert.equal(manifest.compilerBuild.compilerSha256, hash(assets.get('compiler.js')));",
      "const profiles = ['web-component-source-v1','react-dom-source-v1','vue-source-v1','vue2-source-v1'];",
      'for (const profile of profiles) {',
      "  const name = 'targets/' + profile + '.json';",
      '  const target = JSON.parse(assets.get(name));',
      '  assert.equal(target.profile, profile);',
      '  assert.ok(Object.keys(target.modules).length > 0);',
      '  assert.equal(target.modulesSha256, hash(JSON.stringify(target.modules)));',
      '  assert.equal(manifest.targetModulesSha256[profile], target.modulesSha256);',
      '  assert.equal(manifest.assets[name], hash(assets.get(name)));',
      '}',
      'console.log(JSON.stringify({routes:paths.length,source:source.id,targets:profiles.length,root:owner.browserRepositoryRoot}));',
    ].join('\n');
    const log = path.join(output, 'consumer.log');
    const result = await runCommand(process.execPath, ['--input-type=module', '--eval', program], {
      cwd: foreign,
      env: {
        ...process.env,
        PUI_RELOCATED_ASSET_MODULE: pathToFileURL(bundle).href,
        PUI_EXPECTED_SOURCE_IDS: JSON.stringify(expected.map((row) => row.id).sort()),
        PUI_EXPECTED_SOURCE_SHA256: hash(sourceBytes),
        PUI_EXPECTED_REPOSITORY: repository,
        PUI_ASSET_BUILD_DIRECTORY: path.join(output, 'compiled-assets'),
      },
      log,
      timeoutMs: 90_000,
      quiet: true,
    });
    const transcript = await readFile(log, 'utf8');
    assert.equal(result.stopReason, null, transcript);
    assert.equal(result.spawnError, null, transcript);
    assert.equal(result.ioError, null, transcript);
    assert.equal(result.exitCode, 0, transcript);
    const observation = JSON.parse(transcript.trim());
    assert.deepEqual(observation, {
      routes: expected.length,
      source: 'base-button',
      targets: 4,
      root: repository,
    });
  }
);
