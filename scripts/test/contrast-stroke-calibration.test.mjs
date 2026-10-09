import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(
  'apps/www/src/content/docs/zh-cn/contrast-probe.browser.test.ts',
  'utf8'
);
const fixture = source.slice(
  source.indexOf("it('calibrates translucent paint and zero-area straight SVG stroke witnesses")
);
const viewportWidth = Number(fixture.match(/viewport: \{ width: (\d+)/)?.[1]);
const svgWidth = Number(fixture.match(/style="width:(\d+)px;height:/)?.[1]);
const viewBoxWidth = Number(fixture.match(/viewBox="0 0 (\d+) 24"/)?.[1]);
const offset = Number(
  fixture.match(
    /root\('stroke-outside', path\('M5 12h14', 'transform:translateX\((\d+)px\)'\)\)/
  )?.[1]
);
const scale = svgWidth / viewBoxWidth;

// Arithmetic controls for the authored fixture, not a substitute for native
// CTM, viewport, stroke envelope and owner-visibility assertions in the suite.
const leftStrokeEdge = (translation) => 24 + (5 + translation) * scale - (3 * scale) / 2;
const requireOutside = (translation) => assert.ok(leftStrokeEdge(translation) > viewportWidth);

test('current calibration moves only the child path fully beyond the viewport', () => {
  assert.ok([viewportWidth, svgWidth, viewBoxWidth, offset].every(Number.isFinite));
  assert.equal(viewportWidth, 800);
  assert.equal(svgWidth, 14);
  assert.equal(viewBoxWidth, 24);
  requireOutside(offset);
});

test('the historical 900-user-unit negative control fails the actual screen-space condition', () => {
  assert.equal(900 * scale, 525);
  assert.ok(leftStrokeEdge(900) > 0);
  assert.ok(leftStrokeEdge(900) < viewportWidth);
  assert.throws(() => requireOutside(900));
});

test('native evidence records CTM and rejects malformed offscreen fixtures before visibility expectations', () => {
  assert.match(fixture, /getScreenCTM\(\)\?\.toJSON\(\)/);
  assert.match(fixture, /width: innerWidth, height: innerHeight/);
  assert.match(fixture, /outside\.ownerRect\.right\)\.toBeLessThanOrEqual\(viewport\.width\)/);
  assert.match(fixture, /outside\.ownerRect\.bottom\)\.toBeLessThanOrEqual\(viewport\.height\)/);
  assert.match(fixture, /Math\.hypot\(outside\.screenCTM!\.a, outside\.screenCTM!\.c\)/);
  assert.match(
    fixture,
    /outside\.centerline!\.left - halfStrokeX\)\.toBeGreaterThan\(viewport\.width\)/
  );
  assert.ok(fixture.indexOf('left - halfStrokeX') < fixture.indexOf('row.observation.achieved'));
});

test('outside remains negative, clipped witness remains distinct and no visibility threshold is relaxed', () => {
  assert.match(fixture, /\['translucent', 'horizontal', 'vertical'\]\.includes\(row.id\)/);
  assert.match(fixture, /root\('stroke-clipped', `<div style="height:0;overflow:hidden">/);
  assert.match(fixture, /root\('stroke-rotated'/);
  assert.match(fixture, /vector-effect: non-scaling-stroke/);
});
