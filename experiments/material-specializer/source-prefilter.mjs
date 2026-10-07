// First-party deterministic bounded preparation for an opaque owned RGBA source.
// The original audited GPU kernel is unchanged. No DOM, URL or host acquisition.
export function prepareSource(pixels, width, height) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 2048 ||
    height > 2048 ||
    width * height > 1048576 ||
    !(pixels instanceof Uint8Array) ||
    pixels.length !== width * height * 4
  )
    throw new Error('invalid-prefilter-source');
  const weights = [1, 6, 15, 20, 15, 6, 1];
  const horizontal = new Uint8Array(pixels.length);
  const output = new Uint8Array(pixels.length);
  for (let i = 3; i < pixels.length; i += 4)
    if (pixels[i] !== 255) throw new Error('prefilter-requires-opaque-source');
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        let sum = 0;
        for (let k = -3; k <= 3; k++)
          sum +=
            pixels[(y * width + Math.max(0, Math.min(width - 1, x + k))) * 4 + channel] *
            weights[k + 3];
        horizontal[at + channel] = Math.round(sum / 64);
      }
      horizontal[at + 3] = 255;
    }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        let sum = 0;
        for (let k = -3; k <= 3; k++)
          sum +=
            horizontal[(Math.max(0, Math.min(height - 1, y + k)) * width + x) * 4 + channel] *
            weights[k + 3];
        output[at + channel] = Math.round(sum / 64);
      }
      output[at + 3] = 255;
    }
  return output;
}
