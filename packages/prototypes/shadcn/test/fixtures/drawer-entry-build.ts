import { SHADCN_THEME_CSS } from '../../../../cli/src/legacy/type';
import { renderPrefixedThemeCss } from '../../../../cli/src/services/proto-style-css';
import { build } from 'esbuild';
import path from 'node:path';
/** Alias applies only to the diagnostic bundle; production sources remain byte unchanged. */
export async function buildPublicDrawerEntryProbe() {
  return (
    await build({
      stdin: {
        contents:
          "import demo from './apps/www/src/content/docs/demo-shadcn-drawer.demo'; import {createPublicDrawerEntryFixture as create} from './packages/prototypes/shadcn/test/fixtures/drawer-www-entry'; export const createPublicDrawerEntryFixture = fixed => create(fixed, demo);",
        resolveDir: process.cwd(),
        loader: 'ts',
      },
      bundle: true,
      write: false,
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
    })
  ).outputFiles[0].text;
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
