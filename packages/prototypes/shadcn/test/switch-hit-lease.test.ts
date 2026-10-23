import { expect, it, vi } from 'vitest';
import { createSwitchHitLease } from '../src/switch/hit-lease';
it.each(['scope', 'retire'])(
  'releases an acquisition invalidated by synchronous %s reentry',
  () => {
    let wanted = true;
    const dispose = vi.fn();
    const register = vi.fn(() => {
      wanted = false;
      lease.sync();
      return dispose;
    });
    const lease = createSwitchHitLease(() => wanted, register);
    lease.sync();
    expect(register).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
    lease.release();
    expect(dispose).toHaveBeenCalledTimes(1);
  }
);
it('does not double-register when acquisition reenters with an unchanged source', () => {
  const dispose = vi.fn();
  const register = vi.fn(() => {
    lease.sync();
    return dispose;
  });
  const lease = createSwitchHitLease(() => true, register);
  lease.sync();
  expect(register).toHaveBeenCalledTimes(1);
  lease.release();
  expect(dispose).toHaveBeenCalledTimes(1);
});
it('detaches old disposal before a release callback reacquires a new lease', () => {
  let wanted = true;
  const second = vi.fn();
  const first = vi.fn(() => {
    wanted = true;
    lease.sync();
  });
  const register = vi.fn().mockReturnValueOnce(first).mockReturnValue(second);
  const lease = createSwitchHitLease(() => wanted, register);
  lease.sync();
  wanted = false;
  lease.sync();
  expect(first).toHaveBeenCalledTimes(1);
  expect(register).toHaveBeenCalledTimes(2);
  lease.release();
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(1);
});
