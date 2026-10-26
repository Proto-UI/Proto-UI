// Both values must be serialized by getComputedStyle(...).boxShadow.
// The independent expected probe uses the requested theme color and 3px spread,
// never a color or geometry read from the actual control.
export function containsExpectedRingShadow(actualShadow, expectedRingShadow) {
  if (
    typeof actualShadow !== 'string' ||
    typeof expectedRingShadow !== 'string' ||
    !expectedRingShadow ||
    expectedRingShadow === 'none'
  )
    return false;
  const layers = [];
  let depth = 0,
    start = 0;
  for (let i = 0; i < actualShadow.length; i++) {
    const ch = actualShadow[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      if (--depth < 0) return false;
    } else if (ch === ',' && depth === 0) {
      layers.push(actualShadow.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (depth !== 0) return false;
  layers.push(actualShadow.slice(start).trim());
  return layers.some((layer) => layer === expectedRingShadow);
}
