/**
 * Non-normative D1 experiment: falsify candidate box bridges, not Adapter conformance.
 * Run: node --import tsx scripts/analysis/shadow-split-geometry-probe.mjs
 * Requires the existing apps/www playwright-core dependency and local Chrome.
 * No server, network, app profile, or production source mutation is used.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
} from '../../packages/cli/src/services/proto-style-css.ts';

const requireBrowser = createRequire(new URL('../../apps/www/package.json', import.meta.url));
const { chromium } = requireBrowser('playwright-core');
const executablePath =
  process.env.PUI_CHROME_EXECUTABLE ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const scenarios = [
  {
    name: 'checkbox-size',
    placement: 'size-4 shrink-0',
    surface: 'border',
    display: 'block',
    text: '',
    peer: false,
  },
  {
    name: 'badge-fit',
    placement: 'w-fit shrink-0',
    surface: 'inline-flex items-center justify-center border-2 px-2 py-0.5 font-mono text-xs',
    display: 'inline-flex',
    text: 'Badge text',
    peer: false,
  },
  {
    name: 'fixed-mask',
    placement: 'fixed inset-0',
    surface: 'bg-black/50',
    display: 'block',
    text: '',
    peer: false,
  },
  {
    name: 'flex-control',
    placement: 'flex-1 min-w-0',
    surface: '',
    display: 'block',
    text: 'Hello',
    peer: true,
  },
  {
    name: 'flex-decorated',
    placement: 'flex-1 min-w-0',
    surface: 'p-2 border-2',
    display: 'block',
    text: 'Hello',
    peer: true,
  },
  {
    name: 'percent-max',
    placement: 'w-full max-w-[75%]',
    surface: 'p-2 border-2',
    display: 'block',
    text: 'Hello',
    peer: false,
  },
  {
    name: 'font-relative',
    placement: 'w-[2em] h-[2em]',
    surface: 'text-xs border-2',
    display: 'block',
    text: '',
    peer: false,
  },
];
const tokens = [
  ...new Set(scenarios.flatMap((s) => `${s.placement} ${s.surface}`.split(/\s+/).filter(Boolean))),
].sort();
const documentCss = renderProtoStyleTokenCss(tokens);
const shadowCss = renderProtoShadowStyleTokenCss(tokens);
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const samples = await page.evaluate(
    ({ scenarios, documentCss, shadowCss }) => {
      const style = document.createElement('style');
      style.textContent = documentCss;
      document.head.append(style);
      const size = (el) => ({
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
      });
      return ['inherited-fill', 'grid-fill'].flatMap((recipe) =>
        scenarios.map((scenario) => {
          const build = (split) => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;width:240px;align-items:flex-start;font-size:16px';
            document.body.append(row);
            const target = document.createElement('x-probe');
            target.style.display = scenario.display;
            target.setAttribute(
              'data-pui-style',
              split ? scenario.placement : `${scenario.placement} ${scenario.surface}`
            );
            row.append(target);
            const peer = document.createElement('div');
            peer.style.cssText = 'flex:1 1 0%;min-width:0';
            peer.textContent = 'Peer';
            if (scenario.peer) row.append(peer);
            let surface = target;
            if (split) {
              const root = target.attachShadow({ mode: 'open' });
              const localStyle = document.createElement('style');
              localStyle.textContent = shadowCss;
              surface = document.createElement('div');
              surface.setAttribute('data-pui-style', scenario.surface);
              root.append(localStyle, surface);
              target.style.display = scenario.display === 'inline-flex' ? 'inline-block' : 'block';
              if (recipe === 'grid-fill') {
                target.style.display = scenario.display === 'inline-flex' ? 'inline-grid' : 'grid';
                surface.style.cssText = 'min-width:0;min-height:0';
              } else {
                surface.style.cssText =
                  'width:100%;height:100%;min-width:inherit;min-height:inherit;max-width:inherit;max-height:inherit';
              }
            }
            surface.textContent = scenario.text;
            const result = {
              host: size(target),
              surface: size(surface),
              peer: scenario.peer ? size(peer) : null,
            };
            row.remove();
            return result;
          };
          return { recipe, scenario: scenario.name, collapsed: build(false), split: build(true) };
        })
      );
    },
    { scenarios, documentCss, shadowCss }
  );

  // Observational assertions bind this decision packet, not a desired product behavior.
  for (const recipe of ['inherited-fill', 'grid-fill']) {
    const pick = (name) => samples.find((s) => s.recipe === recipe && s.scenario === name);
    assert.equal(pick('flex-control').collapsed.host.width, 120);
    assert.equal(pick('flex-control').split.host.width, 120);
    assert.equal(pick('flex-decorated').collapsed.host.width, 130);
    assert.equal(pick('flex-decorated').split.host.width, 120);
    assert.equal(pick('flex-decorated').collapsed.peer.width, 110);
    assert.equal(pick('flex-decorated').split.peer.width, 120);
    assert.equal(pick('font-relative').collapsed.host.width, 24);
    assert.equal(pick('font-relative').split.host.width, 32);
  }
  console.log(
    JSON.stringify(
      {
        kind: 'non-normative-shadow-geometry-observation',
        browser: browser.version(),
        source: fileURLToPath(import.meta.url),
        tokenClosure: tokens,
        samples,
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
