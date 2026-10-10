import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../../', import.meta.url));
const config = JSON.parse(readFileSync(resolve(root, 'tsconfig.json'), 'utf8'));
const paths = Object.fromEntries(
  Object.entries(config.compilerOptions.paths).map(([key, values]) => [
    key,
    values.map((value) => resolve(root, value)),
  ])
);
Object.assign(paths, {
  react: [resolve(root, 'apps/www/node_modules/@types/react/index.d.ts')],
  'react-dom': [resolve(root, 'apps/www/node_modules/@types/react-dom/index.d.ts')],
  'react-dom/*': [resolve(root, 'apps/www/node_modules/@types/react-dom/*')],
  vue: [resolve(root, 'apps/www/node_modules/vue')],
  'vue2-runtime': [resolve(root, 'apps/www/node_modules/vue2-runtime')],
});
const directory = mkdtempSync(join(tmpdir(), 'pui-material-consumer-types-'));
try {
  const target = join(directory, 'tsconfig.json');
  writeFileSync(
    target,
    JSON.stringify({
      extends: resolve(root, 'tsconfig.json'),
      compilerOptions: { baseUrl: root, paths, types: [] },
      files: [
        resolve(root, 'apps/www/test/material-v2-direct-consumer.ts'),
        ...['browser-entry.ts', 'diagnostics.d.ts'].map((name) =>
          resolve(root, 'experiments/material-v2', name)
        ),
      ],
      include: [],
    })
  );
  const result = spawnSync(
    process.execPath,
    [resolve(root, 'node_modules/typescript/bin/tsc'), '-p', target, '--noEmit'],
    { stdio: 'inherit' }
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
