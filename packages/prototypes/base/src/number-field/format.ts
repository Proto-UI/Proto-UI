import type { NumberFieldFormatOptions } from './types';

export type NumberFieldParseResult =
  | { kind: 'number'; value: number }
  | { kind: 'empty' }
  | { kind: 'invalid' };
export type NumberFieldFormat = {
  invalid: boolean;
  format(value: number | null): string;
  parse(text: string): NumberFieldParseResult;
};
const INVALID: NumberFieldParseResult = { kind: 'invalid' };
const plain = (invalid = false): NumberFieldFormat => ({
  invalid,
  format: (value) => (value === null ? '' : String(value)),
  parse(text) {
    const input = text.trim();
    if (!input) return { kind: 'empty' };
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(input)) return INVALID;
    const value = Number(input);
    return Number.isFinite(value) ? { kind: 'number', value } : INVALID;
  },
});
const optionKeys = new Set([
  'style',
  'currency',
  'currencyDisplay',
  'currencySign',
  'useGrouping',
  'minimumIntegerDigits',
  'minimumFractionDigits',
  'maximumFractionDigits',
  'minimumSignificantDigits',
  'maximumSignificantDigits',
  'signDisplay',
]);
// Direction marks are presentation, not number syntax. Space grouping has the
// same meaning when copied from narrow/no-break-space formatted output.
const clean = (text: string) =>
  text.replace(/[\u061c\u200e\u200f]/g, '').replace(/[\u00a0\u202f]/g, ' ');

/** Pure portable format/parse policy. No editor, selection or host objects. */
export function createNumberFieldFormat(
  locale?: string,
  options?: NumberFieldFormatOptions
): NumberFieldFormat {
  if (!locale && !options) return plain();
  try {
    if (
      options &&
      (typeof options !== 'object' ||
        Array.isArray(options) ||
        Object.keys(options).some((key) => !optionKeys.has(key)) ||
        (options.style !== undefined &&
          !['decimal', 'currency', 'percent'].includes(options.style)))
    )
      return plain(true);
    const formatter = new Intl.NumberFormat(locale || 'en-US', {
      ...(!options?.style || options.style === 'decimal' ? { maximumFractionDigits: 20 } : {}),
      ...options,
    });
    const resolved = formatter.resolvedOptions();
    // Numeric symbols and group widths can depend on style, not only locale:
    // fr-CH currency uses a different decimal separator, and Bengali percent
    // uses groups of three rather than its decimal 3/2 pattern. Probe the
    // selected style with an explicit fraction so display rounding cannot hide
    // the editing separator (including percent's integer-scaled probe).
    const symbols = new Intl.NumberFormat(resolved.locale, {
      style: resolved.style,
      ...(resolved.style === 'currency'
        ? {
            currency: resolved.currency,
            currencyDisplay: resolved.currencyDisplay,
            currencySign: resolved.currencySign,
          }
        : {}),
      useGrouping: true,
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    }).formatToParts(-1234567890123.45);
    const decimal = clean(symbols.find((part) => part.type === 'decimal')?.value ?? '.');
    const group = clean(symbols.find((part) => part.type === 'group')?.value ?? ',');
    const minus = clean(symbols.find((part) => part.type === 'minusSign')?.value ?? '-');
    const groups = symbols
      .filter((part) => part.type === 'integer')
      .map((part) => [...part.value].length);
    const primary = groups.at(-1) ?? 3;
    const secondary = groups.at(-2) ?? primary;
    const digitFormatter = new Intl.NumberFormat(resolved.locale, { useGrouping: false });
    const digits = new Map<string, string>();
    for (let n = 0; n < 10; n++) digits.set(clean(digitFormatter.format(n)), String(n));
    const affixes = (value: number) => {
      const parts = formatter.formatToParts(value);
      const first = parts.findIndex((part) => part.type === 'integer');
      let last = parts.length - 1;
      while (last >= 0 && !['integer', 'fraction'].includes(parts[last].type)) last--;
      return {
        prefix: clean(
          parts
            .slice(0, first)
            .map((part) => part.value)
            .join('')
        ),
        suffix: clean(
          parts
            .slice(last + 1)
            .map((part) => part.value)
            .join('')
        ),
      };
    };
    const parseDigits = (text: string) => {
      let result = '';
      for (const char of text) {
        const mapped = digits.get(char);
        if (mapped !== undefined) result += mapped;
        else if (char >= '\uff10' && char <= '\uff19')
          result += String(char.charCodeAt(0) - 0xff10);
        else result += char;
      }
      return result;
    };
    const numeric = (text: string, negative = false): NumberFieldParseResult => {
      let source = parseDigits(text);
      if (source.startsWith(minus) || source.startsWith('-') || source.startsWith('\u2212')) {
        if (negative) return INVALID;
        negative = true;
        source = source.slice(source.startsWith(minus) ? minus.length : 1);
      } else if (source.startsWith('+')) {
        if (negative) return INVALID;
        source = source.slice(1);
      }
      const parts = source.split(decimal);
      if (parts.length > 2) return INVALID;
      const [integer, fraction] = parts;
      const chunks = integer.split(group);
      if (
        chunks.length > 1 &&
        (!chunks.every((chunk) => /^\d+$/.test(chunk)) ||
          chunks.at(-1)!.length !== primary ||
          chunks.slice(1, -1).some((chunk) => chunk.length !== secondary) ||
          chunks[0].length < 1 ||
          chunks[0].length > secondary)
      )
        return INVALID;
      const whole = chunks.join('');
      if (!/^\d*$/.test(whole) || (fraction !== undefined && !/^\d*$/.test(fraction)))
        return INVALID;
      if (!whole && !fraction) return INVALID;
      const scaled = Number(`${negative ? '-' : ''}${whole || '0'}.${fraction ?? ''}`);
      const value = resolved.style === 'percent' ? scaled / 100 : scaled;
      return Number.isFinite(value) ? { kind: 'number', value } : INVALID;
    };
    return {
      invalid: false,
      format: (value) => (value === null ? '' : formatter.format(value)),
      parse(text) {
        const source = clean(text).trim();
        if (!source) return { kind: 'empty' };
        // Raw localized digits are useful while editing currency/percent fields.
        const raw = numeric(source);
        if (raw.kind === 'number') return raw;
        const characters = [...source];
        const isDigit = (char: string) => digits.has(char) || /^[0-9\uff10-\uff19]$/.test(char);
        const first = characters.findIndex(isDigit);
        let last = characters.length - 1;
        while (last >= first && !isDigit(characters[last])) last--;
        if (first < 0 || last < first) return INVALID;
        const result = numeric(characters.slice(first, last + 1).join(''));
        if (result.kind !== 'number') return INVALID;
        const actualPrefix = characters.slice(0, first).join('');
        const actualSuffix = characters.slice(last + 1).join('');
        // Validate the exact affixes for this value, including locale plural
        // currency names and accounting signs. Arbitrary adornments are never
        // stripped into another valid number.
        for (const sign of [1, -1]) {
          const value = sign * result.value;
          const expected = affixes(value);
          if (actualPrefix === expected.prefix && actualSuffix === expected.suffix)
            return { kind: 'number', value };
        }
        return INVALID;
      },
    };
  } catch {
    return plain(true);
  }
}
