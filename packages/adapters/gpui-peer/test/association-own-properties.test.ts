import { expect, it, vi } from 'vitest';
import { createAssociationLedger } from '../src/associations';

it('does not materialize an inherited renderer key from an empty association record', () => {
  const previous = Object.getOwnPropertyDescriptor(Object.prototype, 'controlLabel');
  const ledger = createAssociationLedger(),
    commit = vi.fn();
  try {
    Object.defineProperty(Object.prototype, 'controlLabel', {
      configurable: true,
      value: 'inherited:renderer:key',
    });
    ledger.apply('control', {}, commit);
    expect(commit).toHaveBeenCalledWith({ controlLabel: null });
    expect(ledger.size()).toBe(0);
  } finally {
    if (previous) Object.defineProperty(Object.prototype, 'controlLabel', previous);
    else Reflect.deleteProperty(Object.prototype, 'controlLabel');
  }
});

it('rejects unsupported nonenumerable own fields before committing or changing ownership', () => {
  const ledger = createAssociationLedger(),
    commit = vi.fn();
  const input = Object.defineProperty({ controlLabel: 'valid:key' }, 'unsupported', {
    value: 'hidden',
    enumerable: false,
  });
  expect(() => ledger.apply('control', input, commit)).toThrow(
    'unknown instance association: unsupported'
  );
  expect(commit).not.toHaveBeenCalled();
  expect(ledger.size()).toBe(0);
});

it('preserves a permitted nonenumerable own renderer key', () => {
  const ledger = createAssociationLedger(),
    commit = vi.fn();
  const input = Object.defineProperty({}, 'controlLabel', { value: 'own:key', enumerable: false });
  ledger.apply('control', input, commit);
  expect(commit.mock.calls[0]?.[0]?.controlLabel).toBeTruthy();
  expect(ledger.size()).toBe(1);
});
