const DECIMAL = '[+-]?(?:\\d+|\\d*\\.\\d+)';
const NUMBER_OR_PERCENT = new RegExp(`^(${DECIMAL})(%)?$`);
const PIXELS = new RegExp(`^(${DECIMAL})(px)?$`);
const SPACE = /[ \t\n\r\f]/;

function trimCss(value: string): string {
  return value.replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, '');
}

function finiteDecimal(token: string): number | null {
  const value = Number(token);
  // Do not let underflow turn a nonzero declaration into proof of invisibility.
  if (!Number.isFinite(value) || (value === 0 && /[1-9]/.test(token))) return null;
  return value;
}

/** Split only outside color functions; nested/unbalanced functions are unsupported. */
function splitTopLevel(value: string, separator: ',' | ' '): string[] | null {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    const character = value[index]!;
    if (character === '(' && ++depth > 1) return null;
    if (character === ')' && --depth < 0) return null;
    if (depth !== 0 || !(separator === ',' ? character === ',' : SPACE.test(character))) continue;
    const part = trimCss(value.slice(start, index));
    if (part) parts.push(part);
    else if (separator === ',') return null;
    start = index + 1;
  }
  if (depth !== 0) return null;
  const last = trimCss(value.slice(start));
  if (last) parts.push(last);
  else if (separator === ',') return null;
  return parts.length ? parts : null;
}

function channel(token: string, maximum: number): number | null {
  const match = NUMBER_OR_PERCENT.exec(token);
  if (!match) return null;
  const value = finiteDecimal(match[1]!);
  const limit = match[2] ? 100 : maximum;
  if (value === null || value < 0 || value > limit) return null;
  const normalized = value / limit;
  return normalized === 0 && value !== 0 ? null : normalized;
}

function colorAlpha(token: string): number | null {
  if (token === 'transparent') return 0;
  const match = /^rgba?\(([^()]*)\)$/.exec(token);
  if (!match) return null;
  const body = trimCss(match[1]!);
  let components: string[];
  let alpha: string | undefined;
  if (body.includes(',')) {
    const terms = body.split(',').map(trimCss);
    if (terms.length !== 3 && terms.length !== 4) return null;
    components = terms.slice(0, 3);
    alpha = terms[3];
    // Legacy comma syntax cannot mix numeric and percentage RGB channels.
    if (new Set(components.map((term) => term.endsWith('%'))).size !== 1) return null;
  } else {
    const terms = body.split('/');
    if (terms.length > 2) return null;
    components = trimCss(terms[0]!).split(/[ \t\n\r\f]+/);
    alpha = terms[1] === undefined ? undefined : trimCss(terms[1]);
  }
  if (components.length !== 3 || components.some((part) => channel(part, 255) === null))
    return null;
  return alpha === undefined ? 1 : channel(alpha, 1);
}

function invisibleLayer(value: string): boolean {
  const tokens = splitTopLevel(value, ' ');
  if (!tokens) return false;
  const lengths: number[] = [];
  const lengthIndices: number[] = [];
  let alpha: number | null = null;
  let inset = false;
  for (const [index, token] of tokens.entries()) {
    if (token === 'inset') {
      if (inset) return false;
      inset = true;
      continue;
    }
    const length = PIXELS.exec(token);
    if (length) {
      const number = finiteDecimal(length[1]!);
      if (number === null || (!length[2] && number !== 0)) return false;
      lengths.push(number);
      lengthIndices.push(index);
      continue;
    }
    if (alpha !== null) return false;
    alpha = colorAlpha(token);
    if (alpha === null) return false;
  }
  if (alpha === null || lengths.length < 2 || lengths.length > 4) return false;
  // The two-to-four lengths form one grammar component, not interleaved terms.
  if (lengthIndices.some((index, offset) => index !== lengthIndices[0]! + offset)) return false;
  if ((lengths[2] ?? 0) < 0) return false;
  return alpha === 0 || lengths.every((length) => length === 0);
}

/**
 * Prove absence of visible box-shadow from a bounded computed-style grammar:
 * none, or RGB(A)/transparent + contiguous pixel lengths + optional inset.
 * Every layer must have zero alpha or zero x/y/blur/spread (omitted lengths are
 * zero). Unsupported colors/units, exponent notation and invalid syntax fail
 * closed. This is not a general CSS renderer or evidence of a visible focus ring.
 */
export function hasNoVisibleBoxShadow(value: string): boolean {
  const normalized = trimCss(value).toLowerCase();
  if (normalized === 'none') return true;
  const layers = splitTopLevel(normalized, ',');
  return layers !== null && layers.every(invisibleLayer);
}
