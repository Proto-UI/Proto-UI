import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { collectProtoStyleTokens } from '../../packages/cli/src/services/prototype-style-tokens.js';
import { renderProtoStyleTokenCss } from '../../packages/cli/src/services/proto-style-css.js';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const output = path.join(root, 'packages/cli/src/generated/draft-family-style-tokens.ts');
const entries: Record<string, string[]> = {};
for (const family of ['bootstrap-2-3-2', 'liquid-glass']) {
  const tokens = (await collectProtoStyleTokens(
    path.join(root, 'packages/prototypes', family, 'src')
  )) as string[];
  if (renderProtoStyleTokenCss(tokens).includes('Unsupported Proto UI style tokens')) {
    throw new Error(`Draft family ${family} contains an unsupported physical style token.`);
  }
  entries[family] = tokens;
}
const source = await format(
  `/** Generated from the two draft Prototype families by scripts/styles/generate-draft-family-style-tokens.ts. Do not edit. */\nexport const DRAFT_FAMILY_STYLE_TOKENS = ${JSON.stringify(entries, null, 2)} as const;\n`,
  { ...(await resolveConfig(output)), filepath: output }
);
if (process.argv.includes('--check')) {
  if ((await readFile(output, 'utf8')) !== source)
    throw new Error('Draft family tokens are stale. Run pnpm styles:preset:generate.');
  console.log('Draft family physical token closure is current.');
} else {
  await writeFile(output, source);
  console.log(`Generated ${path.relative(root, output)}.`);
}
