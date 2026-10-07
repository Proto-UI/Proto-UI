import { expect, it } from 'vitest';
import { observeShadowAcquisition } from './fixtures/focus-intent-native';
// Exercises the browser fixture wiring in happy-dom; trusted/native delivery is
// asserted only by the separately executed Chromium suite.
for (const runtime of ['react', 'vue', 'vue2', 'wc'] as const) {
  it(`runs the ${runtime} closed-shadow native fixture with real adapter wiring`, async () => {
    const { trustedFocusEvents: _trusted, ...result } = await observeShadowAcquisition(
      runtime,
      'closed',
      'native'
    );
    expect(result).toEqual({
      retargeted: true,
      activeInOwnRoot: true,
      knownOwner: true,
      pending: false,
      focused: true,
    });
  });
}
for (const kind of ['programmatic', 'native', 'entry'] as const) {
  it(`runs the WC own-control ${kind} fixture with real adapter wiring`, async () => {
    const { trustedFocusEvents: _trusted, ...result } = await observeShadowAcquisition(
      'wc',
      'own-control',
      kind
    );
    expect(result).toEqual({
      retargeted: true,
      activeInOwnRoot: true,
      knownOwner: true,
      pending: false,
      focused: true,
    });
  });
}
