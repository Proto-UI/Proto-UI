import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { format, resolveConfig } from 'prettier';

import { collectFamilyStyleClosure } from './family-style-closure.js';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const inputPath = path.join(root, 'packages/prototypes/shadcn/src');
const outputPath = path.join(root, 'packages/cli/src/generated/shadcn-style-tokens.ts');
const checkOnly = process.argv.slice(2).includes('--check');
const { tokens } = await collectFamilyStyleClosure(
  inputPath,
  path.join(root, 'packages/prototypes/base/src')
);
const prettierConfig = (await resolveConfig(outputPath)) ?? {};
const source = await format(
  `/**
 * Generated from packages/prototypes/shadcn/src by
 * scripts/styles/generate-shadcn-style-tokens.ts.
 * Do not edit by hand.
 */
export const SHADCN_STYLE_TOKENS: string[] = ${JSON.stringify(tokens, null, 2)};
`,
  { ...prettierConfig, filepath: outputPath }
);

if (checkOnly) {
  let current: string;

  try {
    current = await readFile(outputPath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error(
        'Generated Shadcn preset token manifest is missing. Run pnpm styles:preset:generate.'
      );
    }
    throw error;
  }

  if (current !== source) {
    throw new Error(
      'Generated Shadcn preset token manifest is stale. Run pnpm styles:preset:generate.'
    );
  }

  console.log(`Shadcn preset token manifest is current (${tokens.length} tokens).`);
} else {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, source, 'utf8');
  console.log(`Generated ${path.relative(root, outputPath)} (${tokens.length} tokens).`);
}
