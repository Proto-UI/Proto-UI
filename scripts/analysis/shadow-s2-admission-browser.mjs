/** S2 full-prototype admission and teardown, not full S2 conformance.
 * Prerequisites: build:packages and apps-www generate:proto-ui-style.
 * D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001-K; D-WEB-COMPONENT-SHADOW-STYLE-0001-N.
 * Uses public dist exports + the real CLI companion, without source aliases.
 */
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
      import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';
      import button from '@proto.ui/prototypes-shadcn/button';
      import { switchRoot, switchThumb } from '@proto.ui/prototypes-shadcn/switch';
      import { protoShadowStyleArtifact } from './src/styles/proto-ui-shadow-style.generated.js';
      (async () => {
      const failures = [];
      window.addEventListener('error', (event) => {
        failures.push(event.error?.message ?? event.message);
        event.preventDefault(); // Expected native CE reaction errors are asserted below.
      });
      const listeners = new Set();
      const source = {
        get: () => 'light',
        subscribe(callback) { listeners.add(callback); return () => listeners.delete(callback); },
      };
      const Parent = AdaptToWebComponent(switchRoot, { registerAs: 's2-audit-light-parent' });
      const parent = new Parent(); document.body.append(parent);
      const rows = [];
      for (const [index, proto] of [button, switchRoot, switchThumb].entries()) {
        const C = AdaptToWebComponent(proto, {
          registerAs: 's2-audit-' + index,
          shadow: { mode: 'open', presentation: 'split', styleArtifact: protoShadowStyleArtifact, colorSchemeSource: source },
        });
        const host = new C();
        const text = document.createTextNode('Consumer content'); host.append(text);
        const before = failures.length;
        (proto === switchThumb ? parent : document.body).append(host);
        for (let i = 0; i < 12; i++) await Promise.resolve();
        rows.push({
          prototype: proto.name, errors: failures.slice(before),
          surfaceCount: host.shadowRoot.querySelectorAll('[part="surface"]').length,
          hasScheme: host.hasAttribute('data-pui-color-scheme'),
          hasProjection: host.hasAttribute('data-pui-split-root-style'),
          retainedText: host.firstChild === text, subscribers: listeners.size,
        });
        host.remove();
        for (let i = 0; i < 12; i++) await Promise.resolve();
        rows.at(-1).afterRemoval = { subscribers: listeners.size, shadowChildren: host.shadowRoot.childNodes.length };
      }
      parent.remove();
      window.__s2Admission = { rows, failures };
      })();
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
assert.ok(inputs.some((path) => path.includes('adapters/web-component/dist/')));
for (const subpath of ['button', 'switch'])
  assert.ok(inputs.some((path) => path.includes(`prototypes/shadcn/dist/${subpath}/`)));
assert.ok(!inputs.some((path) => /packages\/.+\/src\//.test(path)), 'no source aliases');
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PUI_CHROME_EXECUTABLE ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
try {
  const page = await browser.newPage();
  const unexpected = [];
  page.on('pageerror', (error) => unexpected.push(error.message));
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.waitForFunction(() => window.__s2Admission);
  const result = await page.evaluate(() => window.__s2Admission);
  assert.deepEqual(result.failures, []);
  for (const row of result.rows) {
    assert.equal(row.errors.length, 0);
    assert.equal(row.surfaceCount, 1);
    assert.equal(row.hasScheme, true);
    assert.equal(row.hasProjection, true);
    assert.equal(row.retainedText, true);
    assert.equal(row.subscribers, 1);
    assert.deepEqual(row.afterRemoval, { subscribers: 0, shadowChildren: 0 });
  }
  assert.deepEqual(unexpected, []);
  console.log(
    JSON.stringify(
      { kind: 's2-current-admission-audit', browser: browser.version(), ...result },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
