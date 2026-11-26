/** Build the public package closure first with scripts/build/public-packages.mjs.
 * This producer invokes the shipped CLI and resolves only public dist exports.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(process.argv[2] ?? '.tmp/shadow-percentage-native-build');
const app = join(root, 'apps/www');
const fixture = join(app, 'test-fixtures/shadow-percentage/consumer.ts');
const hash = (data) => createHash('sha256').update(data).digest('hex');
const startedAt = new Date().toISOString();
await mkdir(out, { recursive: true });
const cli = join(root, 'packages/cli/bin/proto-ui.js');
const cliArgs = [
  cli,
  'tokens',
  '--input',
  dirname(fixture),
  '--out',
  join(out, 'tokens.css'),
  '--shadow-out',
  join(out, 'artifact.js'),
];
const generated = spawnSync(process.execPath, cliArgs, { cwd: root, encoding: 'utf8' });
await writeFile(join(out, 'cli.log'), generated.stdout + generated.stderr);
assert.equal(generated.status, 0, generated.stderr || generated.stdout);
const entry = join(out, 'entry.ts');
await writeFile(
  entry,
  `import { createPercentageLab } from ${JSON.stringify(fixture)};
import { protoShadowStyleArtifact } from ${JSON.stringify(join(out, 'artifact.js'))};
export const lab = createPercentageLab(protoShadowStyleArtifact);\n`
);
const bundle = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  globalName: 'PuiPercentage',
  metafile: true,
  tsconfigRaw: { compilerOptions: {} },
});
const inputs = Object.keys(bundle.metafile.inputs);
assert.ok(inputs.some((path) => path.includes('adapters/web-component/dist/')));
assert.ok(inputs.some((path) => path.includes('modules/expose-state-web/dist/')));
assert.ok(inputs.some((path) => path.includes('core/dist/')));
assert.ok(!inputs.some((path) => /packages\/.+\/src\//.test(path)), 'no source aliases');
await writeFile(join(out, 'consumer.js'), bundle.outputFiles[0].contents);
await writeFile(join(out, 'metafile.json'), JSON.stringify(bundle.metafile, null, 2) + '\n');
const inputHashes = {};
for (const input of inputs) {
  const path = resolve(root, input);
  inputHashes[relative(root, path)] = hash(await readFile(path));
}
const outputs = {};
for (const name of [
  'entry.ts',
  'consumer.js',
  'tokens.css',
  'artifact.js',
  'artifact.d.ts',
  'metafile.json',
]) {
  const data = await readFile(join(out, name));
  outputs[name] = { bytes: data.length, sha256: hash(data) };
}
const manifest = {
  kind: 'shadow-percentage-public-producer',
  sourceHead: spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).stdout.trim(),
  startedAt,
  finishedAt: new Date().toISOString(),
  cliCommand: [process.execPath, ...cliArgs],
  cliSha256: hash(await readFile(cli)),
  fixtureSha256: hash(await readFile(fixture)),
  producerSha256: hash(await readFile(fileURLToPath(import.meta.url))),
  sourceAliases: false,
  inputHashes,
  outputs,
};
await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ ...manifest, inputHashes: { count: inputs.length } }));
