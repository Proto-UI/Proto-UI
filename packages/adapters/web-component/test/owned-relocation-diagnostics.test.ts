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
it('attributes an attached focusout only to the exact captured subtree move', () => {
  setOwnedRelocationDiagnostics(true);
  const root = document.createElement('div');
  const input = document.createElement('input');
  root.append(input);
  document.body.append(root);
  input.focus();
  const guard = captureWebComponentCallerFocus([root]);
  guard.move([root], () => {
    // Model Chromium's observed blur-before-detach ordering; the native F3
    // fixture separately exercises the actual DOM removal without this call.
    input.blur();
    root.remove();
    document.body.append(root);
  });
  guard.restore(() => true);
  guard.dispose();
  expect(document.activeElement).toBe(input);
  const entries = readOwnedRelocationDiagnostics().entries;
  expect(entries).toContainEqual(
    expect.objectContaining({ phase: 'idle:focusout:owned-move', fact: true })
  );
  expect(entries).not.toContainEqual(expect.objectContaining({ fact: 'attached-focusout' }));
});
it('does not attribute an unrelated attached focusout to the captured target move', () => {
  setOwnedRelocationDiagnostics(true);
  const root = document.createElement('div');
  const input = document.createElement('input');
  const unrelated = document.createElement('div');
  root.append(input);
  document.body.append(root, unrelated);
  input.focus();
  const guard = captureWebComponentCallerFocus([root]);
  guard.move([unrelated], () => {
    input.blur();
  });
  guard.restore(() => true);
  guard.dispose();
  expect(document.activeElement).not.toBe(input);
  expect(readOwnedRelocationDiagnostics().entries).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ phase: 'idle:blocked', fact: 'attached-focusout' }),
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
  guard.move([input], () => other.focus());
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
