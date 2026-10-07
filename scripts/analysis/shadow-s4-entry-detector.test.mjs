import assert from 'node:assert/strict';
import test from 'node:test';
import { createEntryRollbackDetector, readEntryPaintBand } from './shadow-s4-entry-detector.mjs';

const open = { open: true, detached: false, epoch: 1 };
test('K1 diagnostic flags rollback after full paint, not ordinary entry or rounding', () => {
  const d = createEntryRollbackDetector(510);
  assert.deepEqual(
    [null, 484, 495, 509, 510, 508, 484, 510].map((w) => d.push(w, open)),
    [false, false, false, false, false, false, true, false]
  );
});
test('close, detach, unknown state, and new epoch cannot reuse old full-paint evidence', () => {
  for (const state of [{ ...open, open: false }, { ...open, detached: true }, null]) {
    const d = createEntryRollbackDetector(510);
    d.push(510, open);
    assert.equal(d.push(484, state), false);
    assert.equal(d.push(484, open), false);
  }
  const d = createEntryRollbackDetector(510);
  d.push(510, open);
  assert.equal(d.push(484, { ...open, epoch: 2 }), false);
});
test('pixel band measures opaque paint at either capture scale; excludes white page and fade', () => {
  for (const ratio of [1, 2]) {
    const info = { width: 742 * ratio, height: 1000 * ratio, channels: 3 };
    const box = { x: 115, y: 300, width: 512, height: 400 };
    const data = Buffer.alloc(info.width * info.height * 3, 120);
    const paint = (width, color) => {
      data.fill(120);
      const y = (box.y + box.height - 16) * ratio;
      const start = (371 - width / 2) * ratio;
      data.fill(color, (y * info.width + start) * 3, (y * info.width + start + width * ratio) * 3);
    };
    paint(484, 255);
    assert.equal(readEntryPaintBand(data, info, box, 742), 484);
    paint(510, 240);
    assert.equal(readEntryPaintBand(data, info, box, 742), 0);
    data.fill(255);
    assert.equal(readEntryPaintBand(data, info, box, 742), null);
    assert.equal(readEntryPaintBand(data, info, { ...box, y: 950 }, 742), null);
  }
});
