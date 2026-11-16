import { definePrototype } from '@proto.ui/core';

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
    return (r) => r.el('div', []);
  },
});
