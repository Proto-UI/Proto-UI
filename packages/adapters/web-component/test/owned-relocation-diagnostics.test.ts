import { afterEach, expect, it } from 'vitest';
import { captureWebComponentCallerFocus } from '../src/owned-relocation';
import {
  readOwnedRelocationDiagnostics,
  recordOwnedRelocationDiagnostic,
  setOwnedRelocationDiagnostics,
} from '../src/owned-relocation-diagnostics';
afterEach(() => {
  setOwnedRelocationDiagnostics(false);
  document.body.replaceChildren();
});
it('keeps the recorder disabled and returns detached primitive snapshots', () => {
  recordOwnedRelocationDiagnostic(1, 'disabled');
  expect(readOwnedRelocationDiagnostics().entries).toEqual([]);
  setOwnedRelocationDiagnostics(true);
  recordOwnedRelocationDiagnostic(1, 'enabled', true);
  const first = readOwnedRelocationDiagnostics();
  first.entries[0].phase = 'author-mutation';
  expect(readOwnedRelocationDiagnostics().entries[0].phase).toBe('idle:enabled');
  for (let i = 0; i < 2050; i++) recordOwnedRelocationDiagnostic(1, 'bounded', i);
  expect(readOwnedRelocationDiagnostics().entries).toHaveLength(2048);
});
it('records deliberate attached blur without restoring focus', () => {
  setOwnedRelocationDiagnostics(true);
  const input = document.createElement('input');
  document.body.append(input);
  input.focus();
  const guard = captureWebComponentCallerFocus([input]);
  input.blur();
  guard.restore(() => true);
  guard.dispose();
  expect(document.activeElement).not.toBe(input);
  expect(readOwnedRelocationDiagnostics().entries).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ fact: 'attached-focusout' }),
      expect.objectContaining({ phase: 'idle:reject', fact: 'blocked' }),
    ])
  );
});
it('records author focus elsewhere without taking focus back', () => {
  setOwnedRelocationDiagnostics(true);
  const input = document.createElement('input'),
    other = document.createElement('button');
  document.body.append(input, other);
  input.focus();
  const guard = captureWebComponentCallerFocus([input]);
  other.focus();
  guard.restore(() => true);
  guard.dispose();
  expect(document.activeElement).toBe(other);
  expect(
    readOwnedRelocationDiagnostics().entries.some((entry) => entry.fact === 'focusin-elsewhere')
  ).toBe(true);
});
it('retains short-circuit evaluation and does not invoke current after blocked', () => {
  setOwnedRelocationDiagnostics(true);
  const guard = captureWebComponentCallerFocus([]);
  guard.restore(() => {
    throw Error('must not evaluate after blocked');
  });
  guard.dispose();
  expect(readOwnedRelocationDiagnostics().entries).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ fact: 'not-owned' }),
      expect.objectContaining({ fact: 'blocked' }),
    ])
  );
});
