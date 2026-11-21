import { SHADCN_THEME_CSS } from '../../../../cli/src/legacy/type';
import { renderPrefixedThemeCss } from '../../../../cli/src/services/proto-style-css';
import { collectProtoStyleTokensFromFiles } from '../../../../cli/src/services/prototype-style-tokens';
import { build } from 'esbuild';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

/** Physical recipes of the actual public DemoSpec; no full-family preset fallback. */
export async function collectPublicDrawerEntryStyleTokens() {
  const files: string[] = [];
  for (const directory of [
    'packages/prototypes/base/src/drawer',
    'packages/prototypes/shadcn/src/drawer',
    // Public Trigger/Close contain actual Button prototypes, not plain text.
    'packages/prototypes/base/src/button',
    'packages/prototypes/shadcn/src/button',
    // The public demo owns this carrier. It currently contributes no host CSS.
    'packages/prototypes/shadcn/src/style-scope',
  ]) {
    for (const file of (await readdir(directory)).sort())
      if (file.endsWith('.ts')) files.push(`${directory}/${file}`);
  }
  const tokens = (await collectProtoStyleTokensFromFiles(files)).filter(
    (token): token is string => typeof token === 'string'
  );
  return { files, tokens };
}

/** Alias applies only to the diagnostic bundle; production sources remain byte unchanged. */
export async function buildPublicDrawerEntryProbe() {
  const result = await build({
    stdin: {
      contents:
        "import demo from './apps/www/src/content/docs/demo-shadcn-drawer.demo'; import {createPublicDrawerEntryFixture as create} from './packages/prototypes/shadcn/test/fixtures/drawer-www-entry'; export const createPublicDrawerEntryFixture = fixed => create(fixed, demo); export const createMissingScopeFixture = () => create(false, demo, false);",
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    // The real preview renderer imports its scene stylesheet. Keep that
    // dependency in the fixture instead of dropping it with an empty loader.
    outfile: 'drawer-public-entry.js',
    format: 'iife',
    globalName: 'PublicDrawerEntry',
    platform: 'browser',
    tsconfig: 'tsconfig.json',
    plugins: [
      {
        name: 'drawer-entry-observation-only',
        setup(builder) {
          builder.onResolve({ filter: /^@proto\.ui\/module-feedback$/ }, () => ({
            path: path.resolve(
              'packages/prototypes/shadcn/test/fixtures/drawer-entry-projector-probe.ts'
            ),
          }));
          builder.onResolve({ filter: /^virtual:proto-ui\/runtime-retry-urls$/ }, () => ({
            path: 'retry-urls',
            namespace: 'drawer-entry',
          }));
          // WC does not use framework retry URLs. Fail rather than acquiring another runtime.
          builder.onLoad({ filter: /.*/, namespace: 'drawer-entry' }, () => ({
            contents: 'export default {};',
            loader: 'js',
          }));
        },
      },
    ],
  });
  const script = result.outputFiles.find((file) => file.path.endsWith('.js'));
  const css = result.outputFiles.find((file) => file.path.endsWith('.css'));
  if (!script || !css) throw new Error('Public Drawer fixture requires its JS and CSS outputs');
  return { script: script.text, css: css.text };
}

/** Compile the real www Tailwind entry for actual box classes, including its reset. */
export async function buildPublicDrawerBoxCss(tokens: string[]) {
  const { createRequire } = await import('node:module');
  const { readFile } = await import('node:fs/promises');
  const wwwRequire = createRequire(path.resolve('apps/www/package.json'));
  const viteRequire = createRequire(wwwRequire.resolve('@tailwindcss/vite'));
  const { compile } = viteRequire('@tailwindcss/node');
  const base = path.resolve('apps/www/src/styles');
  const input = await readFile(path.join(base, 'tailwindcss.css'), 'utf8');
  const compiled = await compile(input, { base, onDependency() {} });
  return `${renderPrefixedThemeCss(SHADCN_THEME_CSS)}\n${compiled.build(tokens)}`;
}
