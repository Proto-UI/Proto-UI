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
const directory = mkdtempSync(join(tmpdir(), 'pui-initial-paint-types-'));
try {
  const target = join(directory, 'tsconfig.json');
  writeFileSync(
    target,
    JSON.stringify({
      extends: resolve(root, 'tsconfig.json'),
      compilerOptions: { baseUrl: root, paths, types: [], allowJs: true, checkJs: false },
      files: [
        resolve(root, 'experiments/material-initial-paint/browser-entry.ts'),
        resolve(root, 'packages/adapters/base/test/web-material-initial-paint.test.ts'),
        resolve(root, 'packages/adapters/base/test/web-material-initial-binding.test.ts'),
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
