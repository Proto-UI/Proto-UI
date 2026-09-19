/** Build packages and run apps-www generate:proto-ui-style before this smoke.
 * Resolves package exports from dist, without repository source aliases. */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const app = fileURLToPath(new URL('../../apps/www/', import.meta.url));
const { chromium } = createRequire(new URL('../../apps/www/package.json', import.meta.url))(
  'playwright-core'
);
const bundle = await build({
  stdin: {
    resolveDir: app,
    loader: 'ts',
    contents: `
    import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
    import { checkboxRoot, checkboxIndicator } from '@proto.ui/prototypes-shadcn/checkbox';
    import { protoShadowStyleArtifact } from './src/styles/proto-ui-shadow-style.generated.js';
    const shadow = { mode: 'open', presentation: 'split', styleArtifact: protoShadowStyleArtifact } as const;
    const Root = AdaptToWebComponent(checkboxRoot, { shadow });
    const Indicator = AdaptToWebComponent(checkboxIndicator, { shadow });
    const root = new Root(); root.id = 'consumer-root';
    root.append(new Indicator());
    setElementProps(root, { defaultChecked: true });
    document.body.append(root);
  `,
  },
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  metafile: true,
  tsconfigRaw: { compilerOptions: {} },
});
const inputs = Object.keys(bundle.metafile.inputs);
assert.ok(
  inputs.some((path) => path.includes('adapters/web-component/dist/')),
  'public WC dist entry'
);
assert.ok(
  inputs.some((path) => path.includes('prototypes/shadcn/dist/checkbox/')),
  'public prototype subpath'
);
assert.ok(!inputs.some((path) => /packages\/.+\/src\//.test(path)), 'no repository source aliases');
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PUI_CHROME_EXECUTABLE ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const root = page.locator('#consumer-root');
  assert.equal(await root.getAttribute('aria-checked'), 'true');
  assert.equal(await root.locator('path').getAttribute('d'), 'm20 6-11 11-5-5');
  assert.deepEqual(
    await root.evaluate((el) => {
      const h = el.getBoundingClientRect(),
        s = el.shadowRoot.querySelector('[part="surface"]').getBoundingClientRect();
      return [h.width, h.height, s.width, s.height];
    }),
    [16, 16, 16, 16]
  );
  await root.click();
  await page.waitForFunction(
    () => !document.querySelector('shadcn-checkbox-indicator').shadowRoot.querySelector('path')
  );
  assert.equal(await root.getAttribute('aria-checked'), 'false');
  const handle = await root.elementHandle();
  await root.evaluate((el) => el.remove());
  await page.evaluate(() => Promise.resolve());
  assert.equal(await handle.evaluate((el) => el.shadowRoot.childNodes.length), 0);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      kind: 'public-shadow-dist-consumer',
      browser: browser.version(),
      packageExports: true,
      sourceAliases: false,
      checkboxIndicatorInputCleanup: true,
    })
  );
} finally {
  await browser.close();
}
