import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const canonicalPath = path.join(root, 'scripts/styles/lowered-variant-order.canonical.ts');
const outputPaths = [
  path.join(root, 'packages/modules/rule-expose-state-web/src/generated/lowered-variant-order.ts'),
  path.join(root, 'packages/cli/src/generated/lowered-variant-order.ts'),
];

const checkOnly = process.argv.slice(2).includes('--check');
const canonical = await readFile(canonicalPath, 'utf8');
const header = `/**
 * Generated from scripts/styles/lowered-variant-order.canonical.ts by
 * scripts/styles/generate-lowered-variant-order.ts.
 * Do not edit by hand.
 */
`;
const source = `${header}${canonical}`;

if (checkOnly) {
  for (const outputPath of outputPaths) {
    let current: string;
    try {
      current = await readFile(outputPath, 'utf8');
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        throw new Error(
          `${path.relative(root, outputPath)} is missing. Run pnpm styles:variant-order:generate.`
        );
      }
      throw error;
    }
    if (current !== source) {
      throw new Error(
        `${path.relative(root, outputPath)} is stale. Run pnpm styles:variant-order:generate.`
      );
    }
  }
  console.log(`Lowered variant order is identical in ${outputPaths.length} consumers.`);
} else {
  for (const outputPath of outputPaths) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, source, 'utf8');
  }
  console.log(`Generated lowered variant order for ${outputPaths.length} consumers.`);
}
