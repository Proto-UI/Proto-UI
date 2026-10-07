import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { assertConsumerBoundary } from './consumer-boundary.mjs';
import { createRequire } from 'node:module';
import { getPublicPackages } from '../../scripts/build/public-packages.mjs';
import { renderThemeCss } from '../../packages/prototypes/liquid-glass/src/theme.ts';
const packed = process.argv.includes('--packed');
const out = resolve(process.argv[2] ?? '/tmp/pui-material-v2');
await mkdir(out, { recursive: true });
const config = JSON.parse(await readFile('tsconfig.json', 'utf8'));
const paths = { ...config.compilerOptions.paths };
// Use the same pinned framework installations as the website. Package exports
// below still determine source versus emitted Proto UI consumption.
const websiteRequire = createRequire(resolve('apps/www/package.json'));
for (const name of ['react', 'react-dom', 'react-dom/client', 'vue', 'vue2-runtime'])
  paths[name] = [websiteRequire.resolve(name)];
if (packed)
  for (const pkg of getPublicPackages())
    for (const [key, value] of Object.entries(pkg.manifest.exports ?? {}))
      paths[pkg.name + (key === '.' ? '' : key.slice(1))] = [
        resolve(pkg.dir, typeof value === 'string' ? value : value.import),
      ];
paths['material-v2-diagnostics'] = [
  resolve(
    `packages/adapters/base/${packed ? 'dist/material/program-pool.js' : 'src/material/program-pool.ts'}`
  ),
];
const result = await build({
  entryPoints: ['experiments/material-v2/browser-entry.ts'],
  outfile: resolve(out, 'app.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  metafile: true,
  tsconfigRaw: { compilerOptions: { baseUrl: process.cwd(), paths } },
});
const { packageInputs, publicSourceInputs } = assertConsumerBoundary(result.metafile, { packed });
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
await writeFile(
  resolve(out, 'index.html'),
  `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="icon" href="data:,"><title>V2 four-Web optical artifact consumer</title><link rel="stylesheet" href="tokens.css"><style>${renderThemeCss()}body{font:16px system-ui;color:var(--pui-foreground);background:var(--pui-background);margin:24px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:1100px}.controls{display:flex;gap:16px;padding:28px;align-items:center}.scene{min-width:0}h2{font-size:18px}</style></head><body><h1>V2 optical material: four real Web runtimes</h1><p>Visible application canvas, one fixed audited GPU kernel. No arbitrary DOM or native-equivalence claim.</p><div class="grid">${['wc', 'react', 'vue', 'vue2'].map((runtime) => `<section><h2>${runtime}</h2><div class="scene" data-runtime="${runtime}"></div><p>Activations: <output data-count="${runtime}">0</output></p></section>`).join('')}</div><script type="module" src="app.js"></script></body></html>`
);
await writeFile(
  resolve(out, 'source.json'),
  JSON.stringify(
    {
      revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      dirty:
        execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length !== 0,
      assetSha256: createHash('sha256')
        .update(await readFile(resolve(out, 'app.js')))
        .digest('hex'),
      packageMode: packed
        ? 'emitted-public-packages-with-explicit-private-prototype-source'
        : 'workspace-source',
      privatePrototype: 'packages/prototypes/liquid-glass',
      shader: '88f681ab7035fd55b04f63edff1841e32c4199e9',
      packageInputs,
      publicSourceInputs,
      execution: 'pending-browser-evidence',
    },
    null,
    2
  )
);
console.log(out);
