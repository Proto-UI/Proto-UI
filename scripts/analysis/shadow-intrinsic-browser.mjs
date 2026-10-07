/** Scoped intrinsic sizing evidence. Run: node --import tsx scripts/analysis/shadow-intrinsic-browser.mjs */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowSplitStyleArtifact,
} from '../../packages/cli/src/services/proto-style-css.ts';
const tokens = [
  'inline-flex',
  'flex-1',
  'whitespace-nowrap',
  'border',
  'px-2',
  'text-sm',
  'items-center',
  'justify-center',
];
const documentCss = renderProtoStyleTokenCss(tokens),
  shadowCss = renderProtoShadowSplitStyleArtifact(tokens).cssText;
const { chromium } = createRequire(new URL('../../apps/www/package.json', import.meta.url))(
  'playwright-core'
);
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PUI_CHROME_EXECUTABLE ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
try {
  const page = await browser.newPage();
  const samples = await page.evaluate(
    ({ tokens, documentCss, shadowCss }) => {
      const sheet = document.createElement('style');
      sheet.textContent = documentCss;
      document.head.append(sheet);
      const results = [];
      for (const direction of ['row', 'column'])
        for (const width of [40, 180, 600])
          for (const label of ['Short', 'A much longer label']) {
            const build = (split) => {
              const row = document.createElement('div');
              row.style.cssText = `display:flex;flex-direction:${direction};width:${width}px;font:16px Arial`;
              document.body.append(row);
              const children = [label, 'Peer'].map((text) => {
                const host = document.createElement('x-intrinsic');
                row.append(host);
                let surface = host;
                if (split) {
                  host.setAttribute('data-pui-split-root-style', tokens.join(' '));
                  const root = host.attachShadow({ mode: 'open' });
                  const sheet = document.createElement('style');
                  sheet.textContent = shadowCss;
                  surface = document.createElement('div');
                  surface.setAttribute('data-pui-split-surface', '');
                  surface.setAttribute(
                    'data-pui-style',
                    tokens.filter((t) => t !== 'flex-1').join(' ')
                  );
                  surface.append(document.createElement('slot'));
                  root.append(sheet, surface);
                } else host.setAttribute('data-pui-style', tokens.join(' '));
                host.textContent = text;
                return { host, surface };
              });
              const result = children.map(({ host, surface }) => ({
                width: host.getBoundingClientRect().width,
                height: host.getBoundingClientRect().height,
                surface: surface.getBoundingClientRect().width,
                basis: getComputedStyle(host).flexBasis,
              }));
              row.remove();
              return result;
            };
            results.push({ direction, width, label, light: build(false), split: build(true) });
          }
      return results;
    },
    { tokens, documentCss, shadowCss }
  );
  console.log(JSON.stringify(samples, null, 2));
  for (const sample of samples)
    assert.deepEqual(
      sample.split,
      sample.light,
      `${sample.direction}/${sample.width}/${sample.label}`
    );
  console.log(`Intrinsic sizing: ${samples.length} comparisons passed (${browser.version()})`);
} finally {
  await browser.close();
}
