import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceAt, sampleOptics, makeField, advanceSpring } from './heightfield.mjs';
test('rim displacement is spatially varying, two-dimensional and vanishes outside', () => {
  const left = sampleOptics(230, 132),
    right = sampleOptics(370, 132);
  assert(left.dx < -0.5 && right.dx > 0.5);
  assert(Math.abs(left.dx + right.dx) < 0.1);
  assert(sampleOptics(300, 105).dy < -0.5);
  assert.equal(sampleOptics(300, 132).dx, 0);
  assert.equal(sampleOptics(20, 20).alpha, 0);
});
test('shape union connects continuously and press/morph change actual geometry', () => {
  assert(distanceAt(300, 132, { merge: 0, mode: 'pair' }) > 0);
  assert(distanceAt(300, 132, { merge: 1, mode: 'pair' }) < 0);
  assert(distanceAt(300, 103, { press: 1 }) < distanceAt(300, 103, { press: 0 }));
  assert(distanceAt(300, 60, { mode: 'menu', morph: 0 }) > 0);
  assert(distanceAt(300, 60, { mode: 'menu', morph: 1 }) < 0);
  for (let i = 1; i <= 20; i++)
    assert(
      Math.abs(
        distanceAt(300, 132, { merge: i / 20, mode: 'pair' }) -
          distanceAt(300, 132, { merge: (i - 1) / 20, mode: 'pair' })
      ) < 4
    );
});
test('specular response follows light and field buffers keep bounded shape data', () => {
  const a = sampleOptics(230, 132, { light: [-1, 0] });
  const b = sampleOptics(230, 132, { light: [1, 0] });
  assert(Math.abs(a.highlight - b.highlight) > 0.01);
  const f = makeField();
  assert.equal(f.normal.length, 600 * 264 * 4);
  assert(f.normal.some((v, i) => i % 4 === 2 && v === 255));
  assert.equal(f.normal[2], 0);
  assert(f.normal.every((v, i) => i % 4 !== 3 || v === 255));
});

test('ordinary rim sampling stays monotonic and independent spring clocks converge', () => {
  let previous = -Infinity;
  for (let x = 220; x <= 270; x += 0.25) {
    const mapped = x + sampleOptics(x, 132).dx;
    assert(mapped > previous);
    previous = mapped;
  }
  const states = [30, 60, 120].map((rate) => {
    let s = { value: 0, velocity: 0 };
    for (let i = 0; i < 2 * rate; i++) s = advanceSpring(s.value, s.velocity, 1, 1 / rate);
    return s;
  });
  for (const s of states) assert(Math.abs(s.value - 1) < 0.0001);
  assert(Math.abs(states[0].value - states[2].value) < 1e-8);
  const first = advanceSpring(0.4, 2, 0, 1 / 60);
  assert(first.value > 0.4, 'retarget preserves incoming velocity before turning');
});

test('complementary sharp-rim and scattered-body weights preserve one surface', () => {
  const f = makeField();
  assert.equal(f.weights?.length, f.normal.length);
  for (let i = 0; i < f.normal.length; i += 4) {
    assert(Math.abs(f.weights[i] + f.weights[i + 1] - f.normal[i + 2]) <= 1);
    assert.equal(f.weights[i + 3], 255);
  }
  assert(sampleOptics(230, 132).rimWeight > 0.9);
  assert.equal(sampleOptics(300, 132).rimWeight, 0);
});

test('press changes local optical thickness independently of silhouette and has bounded maps', () => {
  const base = { anchorX: 240, anchorY: 132 };
  const rest = sampleOptics(234, 132, base);
  const press = sampleOptics(234, 132, { ...base, press: 1 });
  const disabled = sampleOptics(234, 132, { ...base, press: 1, opticalPress: false });
  assert(press.rimWidth > rest.rimWidth);
  assert.equal(disabled.rimWidth, rest.rimWidth);
  assert(Math.abs(press.dx - disabled.dx) > 0.1);
  for (const state of [{}, { press: 1, ...base }, { morph: 0.5 }, { morph: 1 }]) {
    for (let y = 34; y < 230; y += 3)
      for (let x = 148; x < 452; x += 3) {
        const a = sampleOptics(x - 0.25, y, state),
          b = sampleOptics(x + 0.25, y, state);
        const c = sampleOptics(x, y - 0.25, state),
          d = sampleOptics(x, y + 0.25, state);
        const xx = 1 + (b.dx - a.dx) / 0.5,
          xy = (d.dx - c.dx) / 0.5;
        const yx = (b.dy - a.dy) / 0.5,
          yy = 1 + (d.dy - c.dy) / 0.5;
        assert(
          xx * yy - xy * yx > 0.15,
          'sampled source map must not fold in the bounded single-surface poses'
        );
      }
  }
});

test('body integration does not draw a second contour at the rim/body crossover', () => {
  let last = 0;
  for (let depth = 1; depth <= 70; depth++) {
    const optical = sampleOptics(300, 39 + depth, { morph: 1 });
    assert(Number.isFinite(optical.bodyTint));
    assert(optical.bodyTint >= last);
    assert(optical.bodyTint - last < 0.004, 'no concentrated tint step at the 14px optical rim');
    last = optical.bodyTint;
  }
  assert(last > 0.1);
});
