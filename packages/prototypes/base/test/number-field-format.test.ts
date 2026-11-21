import { describe, expect, it } from 'vitest';
import { createNumberFieldFormat } from '../src/number-field/format';
import type { NumberFieldFormatOptions } from '../src/number-field/types';

describe('Number Field locale grammar', () => {
  it('retains legacy ungrouped decimals and distinguishes incomplete/empty/invalid input', () => {
    const format = createNumberFieldFormat();
    expect(format.format(1234.125)).toBe('1234.125');
    expect(format.parse('3.')).toEqual({ kind: 'number', value: 3 });
    expect(format.parse('1e2')).toEqual({ kind: 'number', value: 100 });
    expect(format.parse(' ')).toEqual({ kind: 'empty' });
    for (const text of ['-', '.', '2oops', '0x20', 'Infinity', 'NaN', '1,234', '1e999'])
      expect(format.parse(text), text).toEqual({ kind: 'invalid' });
  });
  it.each(['en-US', 'de-DE', 'fr-FR', 'hi-IN', 'ar-EG', 'fa-IR', 'bn-BD', 'ja-JP'])(
    'round-trips standard decimals in %s',
    (locale) => {
      const format = createNumberFieldFormat(locale);
      for (const value of [0, -0.125, 1.5, -1234567.875, 98765.4321])
        expect(format.parse(format.format(value)), format.format(value)).toEqual({
          kind: 'number',
          value,
        });
    }
  );
  it.each([
    ['en-US', '1,234.5', 1234.5],
    ['de-DE', '1.234,5', 1234.5],
    ['fr-FR', '1\u202f234,5', 1234.5],
    ['fr-FR', '1 234,5', 1234.5],
    ['hi-IN', '12,34,567.5', 1234567.5],
    ['ar-EG', '١٬٢٣٤٫٥', 1234.5],
    ['fa-IR', '−۱۲۳٫۵', -123.5],
    ['ja-JP', '１２３.５', 123.5],
  ] as const)('parses %s %s', (locale, text, expected) => {
    expect(createNumberFieldFormat(locale).parse(text)).toEqual({
      kind: 'number',
      value: expected,
    });
  });
  it.each([
    ['en-US', '12,34.5'],
    ['en-US', '1,,234'],
    ['en-US', '1,234.5.6'],
    ['de-DE', '1,234.5'],
    ['de-DE', '1.23'],
    ['fr-FR', '1 2 3'],
    ['hi-IN', '1,234,567'],
    ['en-US', '123garbage'],
    ['en-US', '--5'],
    ['en-US', '1 234'],
    ['en-US', '1%'],
    ['en-US', '$123'],
    ['en-US', '(123)'],
  ] as const)('refuses malformed %s %s', (locale, text) => {
    expect(createNumberFieldFormat(locale).parse(text)).toEqual({ kind: 'invalid' });
  });
  it.each([
    ['en-US', { style: 'currency', currency: 'USD' }],
    ['de-DE', { style: 'currency', currency: 'EUR' }],
    ['fr-FR', { style: 'currency', currency: 'EUR' }],
    ['ar-EG', { style: 'currency', currency: 'EGP' }],
    ['en-US', { style: 'currency', currency: 'USD', currencySign: 'accounting' }],
    ['en-US', { style: 'currency', currency: 'USD', currencyDisplay: 'name' }],
    [
      'ru-RU',
      { style: 'currency', currency: 'RUB', currencyDisplay: 'name', maximumFractionDigits: 0 },
    ],
  ] as const)('round-trips %s currency affixes %j', (locale, options) => {
    const format = createNumberFieldFormat(locale, options);
    for (const value of 'maximumFractionDigits' in options && options.maximumFractionDigits === 0
      ? [0, 1, -1, 2, 5, 21, 1234]
      : [0, 1, -1, 1234.5, -1234.5])
      expect(format.parse(format.format(value)), format.format(value)).toEqual({
        kind: 'number',
        value,
      });
  });
  it.each(['en-US', 'de-DE', 'ar-EG'])('parses %s percentages in display units', (locale) => {
    const format = createNumberFieldFormat(locale, { style: 'percent', maximumFractionDigits: 2 });
    expect(format.parse(format.format(0.125))).toEqual({ kind: 'number', value: 0.125 });
    expect(format.parse('25')).toEqual({ kind: 'number', value: 0.25 });
  });
  it('limits rounding to presentation and returns null as empty text', () => {
    const format = createNumberFieldFormat('en-US', { maximumFractionDigits: 2 });
    expect(format.format(1234.56789)).toBe('1,234.57');
    expect(format.format(null)).toBe('');
  });
  it.each([
    ['bad_locale', undefined],
    ['en-US', { style: 'currency' }],
    ['en-US', { maximumFractionDigits: -1 }],
    ['en-US', { notation: 'compact' }],
  ])('reports invalid format configuration instead of throwing %s %j', (locale, options) => {
    const format = createNumberFieldFormat(locale as string, options as NumberFieldFormatOptions);
    expect(format.invalid).toBe(true);
    expect(format.format(1234.5)).toBe('1234.5');
    expect(format.parse('2.5')).toEqual({ kind: 'number', value: 2.5 });
  });
});
