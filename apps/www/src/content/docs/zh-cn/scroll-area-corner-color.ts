/** Alpha from the bounded computed RGB forms used by this Chromium paint probe. */
export function computedRgbAlpha(color: string): number | null {
  if (color.trim().toLowerCase() === 'transparent') return 0;
  const match = /^rgba?\(\s*(.*?)\s*\)$/i.exec(color.trim());
  if (!match) return null;
  const parts = match[1].includes(',') ? match[1].split(/\s*,\s*/) : match[1].split(/\s*\/\s*/);
  let channels: string[];
  let alpha: string | undefined;
  if (match[1].includes(',')) {
    if (parts.length !== 3 && parts.length !== 4) return null;
    channels = parts.slice(0, 3);
    alpha = parts[3];
  } else {
    if (parts.length > 2) return null;
    channels = parts[0].trim().split(/\s+/);
    alpha = parts[1];
  }
  const number = /^[-+]?(?:\d+\.?\d*|\.\d+)%?$/;
  if (channels.length !== 3 || channels.some((channel) => !number.test(channel))) return null;
  if (alpha === undefined) return 1;
  if (!number.test(alpha)) return null;
  const value = parseFloat(alpha) / (alpha.endsWith('%') ? 100 : 1);
  return value >= 0 && value <= 1 ? value : null;
}
