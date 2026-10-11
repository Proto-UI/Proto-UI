import { initialPaintPresentation } from '../../packages/adapters/base/src/material/initial-paint-experiment.ts';
import { verifyInitialPaintArtifact } from '../../packages/adapters/base/src/material/initial-paint-receipt.ts';
const escape = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
const json = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');
/** Producer output becomes actual server HTML before any consumer page loads.
 * It is never installed by a client-side image injection after initial paint. */
export async function renderInitialPaintPage(serialized, binding) {
  const receipt = await verifyInitialPaintArtifact(serialized, binding);
  const presentation = initialPaintPresentation(receipt, 'seed-control');
  const attributes = Object.entries(presentation.attributes)
    .map(([name, value]) => `${name}="${escape(value)}"`)
    .join(' ');
  // The already visible scene is the exact PNG of the owned source Canvas. Its
  // same deterministic pixels replace this background when the client draws.
  // It is not an arbitrary screenshot and is never claimed as live acquisition.
  const sourceStyle = `background-image:url("${receipt.source.pngDataUrl}");background-size:100% 100%;background-repeat:no-repeat`;
  return `<!doctype html><html lang="en" data-theme="${receipt.layout.theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="icon" href="data:,"><link rel="stylesheet" href="tokens.css"><link rel="stylesheet" href="fixture.css"><style>${presentation.css}</style><title>Internal static Surface seed consumer</title></head><body><h1>Static Liquid Surface seed experiment</h1><p>One finite desktop profile. Other layouts and preferences start opaque.</p><div data-seed-scene><canvas width="${receipt.source.width}" height="${receipt.source.height}" aria-hidden="true" data-seed-source="${receipt.source.rgbaSha256}" style="${escape(sourceStyle)}"></canvas><a href="#destination"><initial-paint-surface ${attributes} style="${escape(presentation.style)}">Continue</initial-paint-surface></a></div><p id="destination" tabindex="-1">Native link destination</p><script type="application/json" id="seed-receipt">${serialized.replaceAll('<', '\\u003c')}</script><script type="application/json" id="seed-binding">${json(binding)}</script><script type="module" src="app.js"></script></body></html>`;
}
