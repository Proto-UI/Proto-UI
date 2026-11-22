import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import { transform } from 'esbuild';
import { Window } from 'happy-dom';
import { classifyKnownUnsupportedContrastFrame } from './contrast-known-unsupported.mjs';

const digest = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const plain = (value) => JSON.parse(JSON.stringify(value));
const rectangle = (x, y, width, height) => ({
  x,
  y,
  width,
  height,
  left: x,
  top: y,
  right: x + width,
  bottom: y + height,
});

// A valid small PNG is the controlled raster input, not a native screenshot.
// The actual collector runs against controlled CSSOM, geometry and canvas data.
const chunk = (name, data) => {
  const type = Buffer.from(name);
  let crc = 0xffffffff;
  for (const value of Buffer.concat([type, data])) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4),
    checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, type, data, checksum]);
};
const whitePng = () => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(128, 0);
  header.writeUInt32BE(128, 4);
  header[8] = 8;
  header[9] = 6;
  const pixels = Buffer.alloc((128 * 4 + 1) * 128, 255);
  for (let row = 0; row < 128; row++) pixels[row * (128 * 4 + 1)] = 0;
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const baseStyle = {
  visibility: 'visible',
  display: 'block',
  contentVisibility: 'visible',
  opacity: '1',
  mixBlendMode: 'normal',
  backgroundColor: 'rgb(255, 255, 255)',
  backgroundImage: 'none',
  backgroundClip: 'border-box',
  color: 'rgb(0, 0, 0)',
  webkitTextFillColor: 'rgb(0, 0, 0)',
  webkitTextStrokeWidth: '0px',
  textShadow: 'none',
  filter: 'none',
  backdropFilter: 'none',
  clip: 'auto',
  clipPath: 'none',
  maskImage: 'none',
  perspective: 'none',
  transformStyle: 'flat',
  transform: 'none',
  translate: 'none',
  rotate: 'none',
  scale: 'none',
  zoom: '1',
  contain: 'none',
  overflowX: 'visible',
  overflowY: 'visible',
  borderTopLeftRadius: '0px',
  borderTopRightRadius: '0px',
  borderBottomRightRadius: '0px',
  borderBottomLeftRadius: '0px',
  boxShadow: 'none',
  fontSize: '16px',
  fontWeight: '400',
  borderImageSource: 'none',
  outlineColor: 'rgb(0, 0, 0)',
  outlineWidth: '0px',
  outlineStyle: 'none',
  content: 'none',
  ...Object.fromEntries(
    ['Top', 'Right', 'Bottom', 'Left'].flatMap((side) => [
      [`border${side}Color`, 'rgb(0, 0, 0)'],
      [`border${side}Width`, '0px'],
      [`border${side}Style`, 'solid'],
    ])
  ),
};

function reseal(fixture) {
  const { frame, fingerprints, raw } = fixture;
  frame.image.digest = digest(raw.image);
  frame.facts.imageDigest = digest(raw.image);
  frame.beforeFingerprintDigest = digest(fingerprints.before);
  frame.afterFingerprintDigest = digest(fingerprints.after);
  frame.facts.stateFingerprintDigest = digest(fingerprints.facts);
  raw.facts = `${JSON.stringify(frame.facts, null, 2)}\n`;
  raw.fingerprints = `${JSON.stringify(fingerprints, null, 2)}\n`;
  frame.factsFile.digest = digest(raw.facts);
  frame.fingerprintsFile.digest = digest(raw.fingerprints);
}

async function collectedReceipt() {
  const window = new Window();
  window.visualViewport = null;
  Object.defineProperties(window, {
    innerWidth: { value: 128 },
    innerHeight: { value: 128 },
    devicePixelRatio: { value: 1 },
  });
  const source = await readFile(new URL('./contrast-probe.browser.ts', import.meta.url), 'utf8');
  const compiled = await transform(source, {
    loader: 'ts',
    format: 'iife',
    globalName: 'puiContrastProbe',
  });
  const document = window.document;
  document.documentElement.dataset.theme = 'light';
  document.body.innerHTML =
    '<section data-projection-scope="fixture" data-projection-owner="fixture" data-projection-generation="1" data-projection-family="brutalist" data-projection-runtime="react">' +
    '<div data-pui-root data-projection-owner="fixture" data-projection-generation="1" data-projection-prototype="brutalist-scroll-area-root">' +
    '<div data-pui-root data-projection-owner="fixture" data-projection-generation="1" data-projection-prototype="brutalist-scroll-area-viewport"></div></div></section>';
  const root = document.querySelector('[data-projection-prototype="brutalist-scroll-area-root"]');
  const viewport = document.querySelector(
    '[data-projection-prototype="brutalist-scroll-area-viewport"]'
  );
  const bounds = new Map([
    [root, rectangle(10, 10, 100, 100)],
    [viewport, rectangle(12, 12, 96, 96)],
  ]);
  for (const element of document.querySelectorAll('*')) {
    const box = bounds.get(element) ?? rectangle(0, 0, 128, 128);
    const border = element === root ? 2 : 0;
    element.getBoundingClientRect = () => box;
    element.getClientRects = () => [box];
    Object.defineProperties(element, {
      clientLeft: { value: border },
      clientTop: { value: border },
      clientWidth: { value: box.width - 2 * border },
      clientHeight: { value: box.height - 2 * border },
    });
  }
  window.getComputedStyle = (element) => {
    const style = {
      ...baseStyle,
      ...(element === root
        ? {
            overflowX: 'hidden',
            overflowY: 'hidden',
            ...Object.fromEntries(
              ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map((side) => [
                `border${side}Radius`,
                '5px',
              ])
            ),
            ...Object.fromEntries(
              ['Top', 'Right', 'Bottom', 'Left'].map((side) => [`border${side}Width`, '2px'])
            ),
          }
        : {}),
    };
    style.getPropertyValue = (property) =>
      style[property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] ?? '';
    return style;
  };
  window.Image = class {
    naturalWidth = 128;
    naturalHeight = 128;
    async decode() {
      const bytes = Buffer.from(this.src.split(',')[1], 'base64');
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.equal(bytes.readUInt32BE(16), this.naturalWidth);
      assert.equal(bytes.readUInt32BE(20), this.naturalHeight);
    }
  };
  window.HTMLCanvasElement.prototype.getContext = () => ({
    drawImage() {},
    getImageData: () => ({ data: new Uint8ClampedArray([255, 255, 255, 255]) }),
  });
  try {
    window.eval(compiled.code);
    const png = whitePng();
    const before = window.puiContrastProbe.readContrastState();
    const facts = await window.puiContrastProbe.collectContrastFrame({
      image: png.toString('base64'),
      family: 'scroll-area',
    });
    const primaryPaint = window.puiContrastProbe.readContrastTargetObservation(viewport);
    const after = window.puiContrastProbe.readContrastState();
    assert.equal(before, facts.stateFingerprint);
    assert.equal(before, after);
    // Exercise the actual runner's synchronous PNG/fact sealing expression.
    const runner = await readFile(
      new URL('./audit-brutalist-contrast.mts', import.meta.url),
      'utf8'
    );
    const start = runner.indexOf('const { stateFingerprint, ...storedFacts } = facts;');
    const end = runner.indexOf('const factsJSON =', start);
    assert.ok(start > 0 && end > start);
    const seal = new Function(
      'facts',
      'png',
      'digest',
      `const frame = {}; ${runner.slice(start, end)} return frame.facts;`
    );
    const item = {
      family: 'scroll-area',
      runtime: 'react',
      theme: 'light',
      plannedStates: ['rest', 'hover', 'keyboard-focus', 'scroll-end', 'wheel-both-axes'],
      achievedTargets: [],
    };
    // Projection/anatomy are explicit calibration prerequisites here. This is
    // never evidence that an actual Previewer or native journey was accepted.
    const lease = { achieved: true, owner: 'fixture', generation: '1' };
    const frame = plain({
      family: item.family,
      runtime: item.runtime,
      theme: item.theme,
      requestedState: 'rest',
      projectionBefore: lease,
      projectionAfter: lease,
      anatomyBefore: lease,
      anatomyAfter: lease,
      targetObservation: { achieved: true },
      sameProjectionLease: true,
      sameMeasurementLease: true,
      primaryPaint,
      facts: seal(facts, png, digest),
      image: { path: 'scroll-area-react-light-rest.png', digest: digest(png) },
      factsFile: { path: 'scroll-area-react-light-rest.facts.json' },
      fingerprintsFile: { path: 'scroll-area-react-light-rest.fingerprints.json' },
    });
    // Check the producer seal before resealing any negative-control mutations.
    assert.equal(frame.facts.imageDigest, digest(png));
    const fixture = {
      item,
      frame,
      raw: { image: png },
      fingerprints: { before, facts: facts.stateFingerprint, after },
    };
    reseal(fixture);
    return fixture;
  } finally {
    await window.happyDOM.abort();
  }
}

test('actual collector and PNG seal supply the existing rounded ScrollArea evidence closure', async () => {
  const fixture = await collectedReceipt();
  const result = classifyKnownUnsupportedContrastFrame(fixture.item, fixture.frame, fixture.raw);
  assert.ok(result);
  assert.equal(result.achieved, false);
  assert.equal(result.numericAcceptance, 'not-evaluated');
  assert.equal(result.followup, 'https://github.com/Proto-UI/Proto-UI/issues/853');
  assert.deepEqual(result.unexecutedTargets, fixture.item.plannedStates);
  assert.deepEqual(fixture.item.achievedTargets, []);
  const viewport = fixture.frame.facts.surfaces.find((surface) =>
    surface.prototype.endsWith('viewport')
  );
  assert.equal(result.physicalNodeId, viewport.physicalNodeId);
  assert.notEqual(viewport.physicalNodeId, fixture.frame.facts.surfaces[0].physicalNodeId);
});

for (const [name, damage] of [
  [
    'old producer metadata omission',
    ({ frame }) => {
      delete frame.facts.raster;
      for (const surface of frame.facts.surfaces) {
        delete surface.physicalNodeId;
        delete surface.hostNodeId;
        delete surface.owner;
        delete surface.generation;
      }
    },
  ],
  [
    'primary physical node replacement',
    ({ frame }) => {
      frame.primaryPaint.physicalNodeId += 100;
    },
  ],
  [
    'clip physical node replacement',
    ({ frame }) => {
      frame.primaryPaint.visibility.roundedOverflowClips[0].physicalNodeId += 100;
    },
  ],
  [
    'forged root node shared by facts and clip',
    ({ frame }) => {
      frame.facts.surfaces[0].physicalNodeId += 100;
      frame.primaryPaint.visibility.roundedOverflowClips[0].physicalNodeId += 100;
    },
  ],
  [
    'foreign surface owner',
    ({ frame }) => {
      frame.facts.surfaces[0].owner = 'foreign';
    },
  ],
  [
    'stale surface generation',
    ({ frame }) => {
      frame.facts.surfaces[0].generation = 'retired';
    },
  ],
  [
    'forged client geometry',
    ({ frame }) => {
      for (const visibility of [frame.primaryPaint.visibility, frame.facts.surfaces[1].visibility])
        visibility.roundedOverflowClips[0].clientBox.x += 1;
    },
  ],
  [
    'forged target geometry',
    ({ frame }) => {
      for (const visibility of [frame.primaryPaint.visibility, frame.facts.surfaces[1].visibility])
        visibility.roundedOverflowClips[0].targetBoxes[0].width -= 1;
    },
  ],
  [
    'forged border widths',
    ({ frame }) => {
      for (const visibility of [frame.primaryPaint.visibility, frame.facts.surfaces[1].visibility])
        visibility.roundedOverflowClips[0].borderWidths[0] = '1px';
    },
  ],
  [
    'rebound fingerprint physical node',
    ({ fingerprints }) => {
      const snapshot = JSON.parse(fingerprints.before);
      snapshot.surfaces[1].target[0].id += 100;
      fingerprints.before = fingerprints.facts = fingerprints.after = JSON.stringify(snapshot);
    },
  ],
  [
    'fingerprint changes during collection',
    ({ fingerprints }) => {
      const snapshot = JSON.parse(fingerprints.after);
      snapshot.surfaces[1].target[0].rect[0] += 1;
      fingerprints.after = JSON.stringify(snapshot);
    },
  ],
  [
    'raster dimension mismatch',
    ({ frame }) => {
      frame.facts.raster.width -= 1;
    },
  ],
]) {
  test(`actual collected ScrollArea receipt rejects ${name}`, async () => {
    const fixture = await collectedReceipt();
    assert.ok(classifyKnownUnsupportedContrastFrame(fixture.item, fixture.frame, fixture.raw));
    damage(fixture);
    // Keep byte/hash envelopes internally valid: reject the substantive mismatch.
    reseal(fixture);
    assert.equal(
      classifyKnownUnsupportedContrastFrame(fixture.item, fixture.frame, fixture.raw),
      null
    );
  });
}
