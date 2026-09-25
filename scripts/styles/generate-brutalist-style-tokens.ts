import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { format, resolveConfig } from 'prettier';

import { collectProtoStyleTokens } from '../../packages/cli/src/services/prototype-style-tokens.js';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const inputPath = path.join(root, 'packages/prototypes/brutalist/src');
const outputPath = path.join(root, 'packages/cli/src/generated/brutalist-style-tokens.ts');
const themeInputPath = path.join(root, 'packages/prototypes/brutalist/src/theme.ts');
const themeOutputPath = path.join(root, 'packages/cli/src/generated/brutalist-theme.ts');
const checkOnly = process.argv.slice(2).includes('--check');
const tokens = (await collectProtoStyleTokens(inputPath)) as string[];
const themeModule = await import(`${pathToFileURL(themeInputPath).href}?t=${Date.now()}`);
const themeManifest = themeModule.BRUTALIST_THEME as Readonly<{
  light: Readonly<Record<string, string>>;
  dark: Readonly<Record<string, string>>;
}>;
const themeCss = themeModule.renderBrutalistThemeCss() as string;
const prettierConfig = (await resolveConfig(outputPath)) ?? {};
const source = await format(
  `/**
 * Generated from packages/prototypes/brutalist/src by
 * scripts/styles/generate-brutalist-style-tokens.ts.
 * Do not edit by hand.
 */
export const BRUTALIST_STYLE_TOKENS: string[] = ${JSON.stringify(tokens, null, 2)};
`,
  { ...prettierConfig, filepath: outputPath }
);
const themeSource = await format(
  `/**
 * Generated from packages/prototypes/brutalist/src/theme.ts by
 * scripts/styles/generate-brutalist-style-tokens.ts.
 * Do not edit by hand.
 */
export const BRUTALIST_THEME = Object.freeze(${JSON.stringify(themeManifest, null, 2)});
export const BRUTALIST_THEME_CSS = ${JSON.stringify(themeCss)};
`,
  { ...prettierConfig, filepath: themeOutputPath }
);

if (checkOnly) {
  let current: string;
  let currentTheme: string;
  try {
    current = await readFile(outputPath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error(
        'Generated Brutalist preset token manifest is missing. Run pnpm styles:preset:generate.'
      );
    }
    throw error;
  }
  try {
    currentTheme = await readFile(themeOutputPath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error(
        'Generated Brutalist semantic theme projection is missing. Run pnpm styles:preset:generate.'
      );
    }
    throw error;
  }
  if (current !== source) {
    throw new Error(
      'Generated Brutalist preset token manifest is stale. Run pnpm styles:preset:generate.'
    );
  }
  if (currentTheme !== themeSource) {
    throw new Error(
      'Generated Brutalist semantic theme projection is stale. Run pnpm styles:preset:generate.'
    );
  }
  console.log(`Brutalist preset token and theme manifests are current (${tokens.length} tokens).`);
} else {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(themeOutputPath, themeSource, 'utf8');
  await writeFile(outputPath, source, 'utf8');
  console.log(
    `Generated ${path.relative(root, outputPath)} (${tokens.length} tokens) and ${path.relative(root, themeOutputPath)}.`
  );
}
