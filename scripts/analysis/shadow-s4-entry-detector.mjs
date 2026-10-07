// Diagnostic for the recorded K1 100% -> ~95% -> 100% paint signature.
// This does not prove CSS clock correctness or detect every kind of dropped frame.
export function readEntryPaintBand(data, info, box, viewportWidth) {
  const ratio = info.width / viewportWidth;
  const y = Math.round((box.y + box.height - 16) * ratio);
  const begin = Math.floor((box.x - 12) * ratio);
  const end = Math.ceil((box.x + box.width + 12) * ratio);
  if (y < 0 || y >= info.height || begin < 0 || end >= info.width) return null;
  const pixel = (x) => {
    const i = (y * info.width + x) * info.channels;
    return [data[i], data[i + 1], data[i + 2]];
  };
  // White document background must not count as a fully painted Dialog.
  if (pixel(begin).some((v) => v >= 220) || pixel(end).some((v) => v >= 220)) return null;
  let length = 0;
  let longest = 0;
  for (let x = begin; x <= end; x++) {
    length = pixel(x).every((v) => v > 246) ? length + 1 : 0;
    longest = Math.max(longest, length);
  }
  return longest / ratio;
}

export function createEntryRollbackDetector(normalWidth) {
  let epoch = null;
  let full = false;
  return {
    push(width, state) {
      if (!state?.open || state.detached) {
        epoch = null;
        full = false;
        return false;
      }
      if (epoch !== state.epoch) {
        epoch = state.epoch;
        full = false;
      }
      if (width === null) return false;
      if (Math.abs(width - normalWidth) <= 3) full = true;
      return full && width > normalWidth * 0.9 && width < normalWidth * 0.975;
    },
  };
}
