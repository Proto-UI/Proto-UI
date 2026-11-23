import { definePrototype } from '@proto.ui/core';

const IDS = ['vega', 'nova'] as const;

export default definePrototype({
  name: 'native-scalar-conversion',
  setup(def) {
    def.expose.method('probe', (input: string) => {
      const value = +input;
      const finite = Number.isFinite(value);
      return {
        finite,
        nan: value !== value,
        negativeZero: value === 0 && 1 / value < 0,
        number: finite ? value : null,
        text: value + '',
      };
    });
    def.expose.method('arithmeticTexts', () => ({
      negativeZero: -0 + '',
      positiveInfinity: 1 / 0 + '',
      negativeInfinity: -1 / 0 + '',
      nan: 0 / 0 + '',
    }));
    let count = 0;
    let trace = '';
    const step = (value: number) => {
      const before = count++;
      count += value;
      return before + count;
    };
    const identity = step;
    const boxed = { callback: step };
    function optional(value?: number): number {
      if (typeof value !== 'number') return 17;
      return value;
    }
    function apply(value: number, callback: (input: number) => number = (input) => input + 1) {
      return callback(value);
    }
    function finallyValue(value: number): number {
      try {
        if (value < 0) throw false;
        return value + 1;
      } catch (error) {
        if (error === false) return 41;
        throw error;
      } finally {
        count++;
      }
    }
    function mark(label: string, value: number, fail: boolean = false) {
      trace += label;
      if (fail) throw false;
      return value;
    }
    def.expose.method('typedCallable', () => ({
      same: step === identity,
      boxed: step === boxed.callback,
      distinct: step !== ((value: number) => step(value)),
      first: step(2),
      second: boxed.callback(3),
      count,
    }));
    def.expose.method('typedDefaults', () => ({
      missing: optional(),
      explicit: optional(undefined),
      zero: optional(0),
      defaultCallback: apply(4),
      explicitCallback: apply(4, (input) => input * 3),
      explicitUndefined: apply(4, undefined),
      success: finallyValue(4),
      failure: finallyValue(-1),
      count,
    }));
    def.expose.method('numericLiterals', () => ({
      huge: 1e30,
      negativeHuge: -1e30,
      boundary: 1e21,
      tiny: 5e-324,
      negativeTiny: -5e-324,
      negativeZero: 1 / -0 < 0,
      nan: 0 / 0 !== 0 / 0,
    }));
    def.expose.method('membership', () => ({
      present: IDS.includes('vega'),
      // @ts-expect-error Deliberately test an out-of-domain needle against the finite string array.
      absent: IDS.includes('other'),
      // @ts-expect-error ECMAScript accepts an object needle; the negative control must not coerce it.
      noCoercion: IDS.includes({ value: 'vega' }),
      empty: String(),
      number: String(1e21),
      boolean: String(false),
      nil: String(null),
      missing: String(undefined),
    }));
    def.expose.method('assignment', () => {
      trace = '';
      const nested = { value: 3 };
      const result = Object.assign(
        { nested, value: mark('target;', 1) },
        { value: mark('first;', 2) },
        { last: mark('last;', 4) }
      );
      nested.value = 7;
      return {
        value: result.value,
        last: result.last,
        same: result.nested === nested,
        nested: result.nested.value,
        trace,
      };
    });
    def.expose.method('assignmentFailure', () => {
      trace = '';
      try {
        Object.assign(
          { before: mark('before;', 1) },
          { failure: mark('failure;', 2, true) },
          { after: mark('after;', 3) }
        );
      } catch (error) {
        return { same: error === false, trace };
      }
      return { same: false, trace };
    });
    def.expose.method('caughtUnits', () => {
      try {
        throw '𐀀';
      } catch (error) {
        // This try block can only throw its authored string literal; the assertions erase.
        const high = (error as string)[0];
        const low = (error as string)[1];
        const length = high.length;
        if (typeof high === 'string' && typeof low === 'string' && typeof length === 'number')
          return {
            order: high < low,
            before: high < 'a',
            length,
            same: high === (error as string)[0],
            converted: String(high) === high,
            assembled: String(high) + low,
            unpaired: high + 'a' < '',
            finite: Number.isFinite(+high),
            errorMessage: new Error(high).message === high,
          };
        return {
          order: false,
          before: true,
          length: 0,
          same: false,
          converted: false,
          assembled: '',
          unpaired: false,
          finite: true,
          errorMessage: false,
        };
      }
    });
    return (r) => r.el('div', []);
  },
});
