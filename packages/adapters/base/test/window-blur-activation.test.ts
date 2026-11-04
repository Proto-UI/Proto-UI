import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebProtoEventRouter } from '../src/events/web-event-router';

const cleanup: (() => void)[] = [];
afterEach(() =>
  cleanup
    .splice(0)
    .reverse()
    .forEach((fn) => fn())
);

function fixture(mode: 'root' | 'shadow' | 'portal' = 'root') {
  const shell = document.createElement('div');
  const root = document.createElement('div');
  root.tabIndex = 0;
  document.body.append(shell);
  (mode === 'shadow' ? shell.attachShadow({ mode: 'open' }) : shell).append(root);
  const target = mode === 'portal' ? document.createElement('button') : root;
  if (mode === 'portal') document.body.append(target);
  cleanup.push(
    () => shell.remove(),
    () => target.remove()
  );
  if (mode === 'shadow') {
    // Model only Happy DOM's missing outer-listener retargeting, as in shadow-retarget-routing.
    const retarget = (event: Event) =>
      Object.defineProperty(event, 'target', { configurable: true, value: shell });
    window.addEventListener('click', retarget);
    cleanup.push(() => window.removeEventListener('click', retarget));
  }
  const router = createWebProtoEventRouter({
    rootEl: root,
    isEnabled: () => true,
    resolveEventRouteOwner: (node) => (node === target || node === root ? root : null),
  });
  cleanup.push(() => router.dispose());
  const commit = vi.fn();
  const cancel = vi.fn();
  router.rootTarget.addEventListener('press.commit', commit);
  router.rootTarget.addEventListener('press.cancel', cancel);
  const pointer = (type: string, pointerId = 1, detail = 1) =>
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        composed: true,
        pointerId,
        pointerType: 'mouse',
        button: 0,
        isPrimary: true,
        detail,
      })
    );
  return { root, target, commit, cancel, pointer };
}

describe('C-EVENT-TYPE-0002-D/E: window blur cancels the pending pointer activation', () => {
  it.each(['root', 'shadow', 'portal'] as const)(
    'rejects the canceled %s click and admits a fresh pointer press',
    (mode) => {
      const f = fixture(mode);
      f.pointer('pointerdown');
      window.dispatchEvent(new Event('blur'));
      expect(f.cancel).toHaveBeenCalledOnce();
      f.pointer('pointerup');
      f.pointer('click');
      expect(f.commit).not.toHaveBeenCalled();
      f.pointer('pointerdown');
      f.pointer('pointerup');
      f.pointer('click');
      expect(f.commit).toHaveBeenCalledOnce();
    }
  );

  it('preserves an independent zero-detail activation without consuming the canceled pointer', () => {
    const f = fixture();
    f.pointer('pointerdown');
    window.dispatchEvent(new Event('blur'));
    f.target.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(f.commit).toHaveBeenCalledOnce();
    f.pointer('pointerup');
    f.pointer('click');
    expect(f.commit).toHaveBeenCalledOnce();
  });

  it('does not consume the canceled identity on another pointer click', () => {
    const f = fixture();
    f.pointer('pointerdown');
    window.dispatchEvent(new Event('blur'));
    f.pointer('click', 2);
    expect(f.commit).toHaveBeenCalledOnce();
    f.pointer('pointerup');
    f.pointer('click');
    expect(f.commit).toHaveBeenCalledOnce();
  });

  it('does not consume the canceled identity when the click kind cannot be read', () => {
    const f = fixture();
    f.pointer('pointerdown');
    window.dispatchEvent(new Event('blur'));
    const event = new PointerEvent('click', { bubbles: true, pointerId: 1, detail: 1 });
    Object.defineProperty(event, 'pointerType', {
      get: () => {
        throw new Error('unreadable kind');
      },
    });
    expect(() => f.target.dispatchEvent(event)).not.toThrow();
    expect(f.commit).toHaveBeenCalledOnce();
    f.pointer('pointerup');
    f.pointer('click');
    expect(f.commit).toHaveBeenCalledOnce();
  });

  it('retires the canceled identity on a fresh owned down with an unreadable kind', () => {
    const f = fixture();
    f.pointer('pointerdown');
    window.dispatchEvent(new Event('blur'));
    const event = new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 1,
      button: 0,
      isPrimary: true,
    });
    Object.defineProperty(event, 'pointerType', {
      get: () => {
        throw new Error('unreadable kind');
      },
    });
    expect(() => f.target.dispatchEvent(event)).not.toThrow();
    f.pointer('pointerup');
    f.pointer('click');
    expect(f.commit).toHaveBeenCalledOnce();
  });

  it.each(['Enter', ' '])('preserves a fresh %j commit and its follow-up click control', (key) => {
    const f = fixture();
    f.root.focus();
    f.pointer('pointerdown');
    window.dispatchEvent(new Event('blur'));
    f.root.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    expect(f.commit).toHaveBeenCalledOnce();
    f.root.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(f.commit).toHaveBeenCalledOnce();
    f.pointer('pointerup');
    f.pointer('click');
    expect(f.commit).toHaveBeenCalledOnce();
  });

  it('does not suppress click-only input when blur had no pending pointer', () => {
    const f = fixture();
    window.dispatchEvent(new Event('blur'));
    f.pointer('click');
    expect(f.commit).toHaveBeenCalledOnce();
  });
});
