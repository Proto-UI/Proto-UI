import { describe, expect, it } from 'vitest';
import { resolveScrollProjection, ScrollProjectionResolutionError } from '../src';

describe('module-scroll: projection negotiation', () => {
  it('resolves explicit and host preferences with deterministic fallback', () => {
    expect(
      resolveScrollProjection(
        { axes: 'both', projection: 'auto', endFollow: { mode: 'off' } },
        { system: true, composed: true },
        'composed'
      )
    ).toBe('composed');
    expect(
      resolveScrollProjection(
        { axes: 'both', projection: 'composed', endFollow: { mode: 'off' } },
        { system: true, composed: false }
      )
    ).toBe('system');
  });

  it('does not silently downgrade a required projection', () => {
    expect(() =>
      resolveScrollProjection(
        {
          axes: 'both',
          projection: 'auto',
          requireProjection: 'composed',
          endFollow: { mode: 'off' },
        },
        { system: true, composed: false }
      )
    ).toThrowError(
      expect.objectContaining<Partial<ScrollProjectionResolutionError>>({
        code: 'PUI_SCROLL_PROJECTION_UNSUPPORTED',
        requested: 'composed',
      })
    );
  });
});
