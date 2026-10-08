// Internal finite-profile experiment. It does not enable a public Adapter or
// Compiler capability or add a production Library route.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { renderThemeCss } from '../../packages/prototypes/liquid-glass/src/theme.ts';
const out = resolve(process.argv[2] ?? '/tmp/pui-initial-paint');
await mkdir(out, { recursive: true });
const config = JSON.parse(await readFile('tsconfig.json', 'utf8'));
const result = await build({
  entryPoints: ['experiments/material-initial-paint/browser-entry.ts'],
  outfile: resolve(out, 'app.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  metafile: true,
  tsconfigRaw: { compilerOptions: { baseUrl: process.cwd(), paths: config.compilerOptions.paths } },
});
execFileSync(
  process.execPath,
  [
    'packages/cli/bin/proto-ui.js',
    'tokens',
    '--input',
    'packages/prototypes/liquid-glass/src',
    '--out',
    resolve(out, 'tokens.css'),
  ],
  { stdio: 'inherit' }
);
const css = `${renderThemeCss()}html{color-scheme:light dark}body{font:16px system-ui;margin:32px;color:var(--pui-foreground);background:var(--pui-background)}[data-seed-scene]{position:relative;isolation:isolate;width:480px;height:200px;max-width:100%;overflow:visible}[data-seed-scene]>canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}a{position:absolute;left:120px;top:68px;color:inherit;text-decoration:none}a:focus-visible{outline:3px solid currentColor;outline-offset:5px;border-radius:999px}initial-paint-surface{display:block;box-sizing:border-box;width:240px;height:64px;text-align:center;line-height:64px}#destination{margin-top:24px}@media(forced-colors:active){[data-seed-scene]>canvas{visibility:hidden}}`;
await writeFile(resolve(out, 'fixture.css'), css);
await writeFile(
  resolve(out, 'index.html'),
  `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="icon" href="data:,"><link rel="stylesheet" href="tokens.css"><link rel="stylesheet" href="fixture.css"><title>Internal static Surface seed producer</title></head><body><h1>Static Liquid Surface seed experiment</h1><p>One finite desktop profile. Other layouts and preferences start opaque.</p><div data-seed-scene><canvas width="480" height="200" aria-hidden="true"></canvas><a href="#destination"><initial-paint-surface id="seed-control">Continue</initial-paint-surface></a></div><p id="destination" tabindex="-1">Native link destination</p><script type="module" src="app.js"></script></body></html>`
);
await writeFile(
  resolve(out, 'source.json'),
  JSON.stringify(
    {
      sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(),
      dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0,
      assetSha256: createHash('sha256')
        .update(await readFile(resolve(out, 'app.js')))
        .digest('hex'),
      inputs: Object.keys(result.metafile.inputs),
      scope:
        'Private source-only finite rest Surface capability. Actual browser rendering pending; no generic Card, mobile, four-runtime, contact, Compiler, or optical-equivalence claim.',
    },
    null,
    2
  )
);
console.log(out);
