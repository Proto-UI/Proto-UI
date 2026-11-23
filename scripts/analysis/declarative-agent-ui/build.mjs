import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { schemaResult, upstreamIdentity } from './schema.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const output = process.argv[2];
if (!output || process.argv.length !== 3)
  throw new Error('Usage: node build.mjs <new-output-directory>');
const destination = path.resolve(output);
fs.mkdirSync(destination, { recursive: false });
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const require = createRequire(path.join(here, 'package.json'));
const protocol = JSON.parse(fs.readFileSync(path.join(here, 'protocol.json')));
const fixture = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/settings.json')));
const shape = fixture.map(schemaResult);
if (shape.some((item) => !item.valid)) throw new Error(JSON.stringify(shape));
const result = await build({
  absWorkingDir: repo,
  entryPoints: [path.join(here, 'app.tsx')],
  outfile: path.join(destination, 'app.js'),
  bundle: true,
  minify: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  metafile: true,
  tsconfig: path.join(repo, 'tsconfig.json'),
  define: { 'process.env.NODE_ENV': '"production"' },
  alias: Object.fromEntries(
    ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', '@radix-ui/react-tabs'].map(
      (id) => [id, require.resolve(id)]
    )
  ),
});
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Account settings · Catalog study</title><style>
*{box-sizing:border-box}body{margin:0;background:#f7f8fa;color:#171923;font:16px/1.6 system-ui,sans-serif}header,main{max-width:760px;margin:auto;padding:32px 28px}header{padding-bottom:0}h1{font-size:34px;letter-spacing:-.035em;margin:8px 0}.eyebrow{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#536172}.summary{color:#556070;max-width:600px}.catalog{padding:24px;border:1px solid #ccd2dc;border-radius:12px;background:white;min-height:205px}[role=tablist]{display:flex;gap:8px;border-bottom:1px solid #d9dee6;padding-bottom:10px}[role=tab]{display:inline-block;padding:9px 14px;font:inherit;font-weight:550;cursor:pointer;border:1px solid transparent;border-radius:7px;background:transparent;color:#384354}[role=tab][aria-selected=true]{background:#e7edf8;color:#1a3d70;border-color:#c2d1e7}[role=tab]:focus-visible,[role=tabpanel]:focus-visible,button:focus-visible{outline:2px solid #3266ba;outline-offset:3px}[role=tabpanel]{margin-top:18px;min-height:65px}button{font:inherit;padding:8px 14px;border-radius:7px;border:1px solid #b4bfce;background:white;cursor:pointer}.caption{font-size:13px;color:#596579}output{display:block;padding-top:10px}@media(max-width:480px){header,main{padding:20px}h1{font-size:28px}.catalog{padding:16px}[role=tablist]{gap:3px}[role=tab]{padding:8px;font-size:13px}}
</style></head><body><div id="app"></div><script type="module" src="/app.js"></script></body></html>`;
fs.writeFileSync(path.join(destination, 'index.html'), html);
const sources = [
  ...new Set([
    ...Object.keys(result.metafile.inputs),
    ...[
      'app.tsx',
      'mapping.mjs',
      'schema.mjs',
      'protocol.json',
      'package.json',
      'package-lock.json',
      'build.mjs',
      'run.mjs',
    ].map((file) => path.relative(repo, path.join(here, file))),
  ]),
]
  .sort()
  .map((relative) => ({
    path: relative,
    sha256: sha256(fs.readFileSync(path.resolve(repo, relative))),
  }));
const manifest = {
  schemaVersion: 1,
  issue: 757,
  builtAt: new Date().toISOString(),
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repo,
    encoding: 'utf8',
  }).trim(),
  dirty: Boolean(
    execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }).trim()
  ),
  node: process.version,
  esbuild: require('esbuild/package.json').version,
  protocol,
  protocolSha256: sha256(fs.readFileSync(path.join(here, 'protocol.json'))),
  input: fixture,
  inputSha256: sha256(fs.readFileSync(path.join(here, 'fixtures/settings.json'))),
  upstream: upstreamIdentity(),
  sources,
  files: ['index.html', 'app.js'].map((file) => ({
    path: file,
    bytes: fs.statSync(path.join(destination, file)).size,
    sha256: sha256(fs.readFileSync(path.join(destination, file))),
  })),
};
fs.writeFileSync(path.join(destination, 'build.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(
  JSON.stringify({
    output: destination,
    sourceRevision: manifest.sourceRevision,
    dirty: manifest.dirty,
    protocolSha256: manifest.protocolSha256,
    files: manifest.files,
  })
);
