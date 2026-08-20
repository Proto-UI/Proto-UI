import { describe, expect, it, vi } from 'vitest';
import { cancelWebEventDefaultAction } from '@proto.ui/adapter-base';

describe('adapter-base contract: Event default-action projection (v0)', () => {
  it('projects a cancelable DOM Event request to preventDefault()', () => {
    const event = new Event('keydown', { cancelable: true });

    cancelWebEventDefaultAction({ event });

    expect(event.defaultPrevented).toBe(true);
  });

  it('ignores request payloads that do not expose a Web preventDefault operation', () => {
    expect(() => cancelWebEventDefaultAction({ event: undefined })).not.toThrow();
    expect(() => cancelWebEventDefaultAction({ event: { type: 'keydown' } })).not.toThrow();

    const preventDefault = vi.fn();
    cancelWebEventDefaultAction({ event: { preventDefault } });
    expect(preventDefault).toHaveBeenCalledOnce();
  });
});
