import { describe, expect, it, vi } from 'vitest';

import { createHostSurfaceProjection } from '../src';

describe('adapter-base host surface projection', () => {
  it('collapses the presentation surface onto the logical boundary by default', () => {
    const boundary = { id: 'boundary' };
    const projection = createHostSurfaceProjection(boundary);

    expect(projection.boundaryTarget).toBe(boundary);
    expect(projection.getSurfaceTarget()).toBe(boundary);
  });

  it('publishes replacement epochs without changing the logical boundary', () => {
    const boundary = { id: 'boundary' };
    const first = { id: 'first' };
    const second = { id: 'second' };
    const projection = createHostSurfaceProjection(boundary, first);
    const listener = vi.fn();
    const unsubscribe = projection.subscribeSurfaceTarget(listener);

    projection.setSurfaceTarget(second);
    projection.setSurfaceTarget(second);

    expect(projection.boundaryTarget).toBe(boundary);
    expect(projection.getSurfaceTarget()).toBe(second);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ previous: first, current: second });

    unsubscribe();
    projection.setSurfaceTarget(null);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
