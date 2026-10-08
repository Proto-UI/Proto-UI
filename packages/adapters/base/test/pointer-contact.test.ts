import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebProtoEventRouter } from '../src/events/web-event-router';
import { observeWebPointerContact } from '../src/events/pointer-contact';
const disposers: (() => void)[] = [];
afterEach(() => {
  disposers
    .splice(0)
    .reverse()
    .forEach((fn) => fn());
  vi.restoreAllMocks();
});
function fixture() {
  const host = document.createElement('div');
  document.body.append(host);
  vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 20, 100, 50));
  const router = createWebProtoEventRouter({ rootEl: host, isEnabled: () => true });
  const listener = vi.fn();
  const contact = observeWebPointerContact(host, listener);
  disposers.push(
    () => host.remove(),
    () => router.dispose(),
    () => contact.dispose()
  );
  const pointer = (type: string, x = 60, y = 45, id = 1, target: EventTarget = host, init = {}) =>
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        pointerId: id,
        clientX: x,
        clientY: y,
        button: 0,
        isPrimary: true,
        ...init,
      })
    );
  return { host, router, listener, contact, pointer };
}
describe('bounded router-owned visual contact; not activation or GPU evidence', () => {
  it('tracks one pointer outside the root using the frozen undeformed down geometry', () => {
    const f = fixture();
    const click = vi.fn();
    f.router.rootTarget.addEventListener('press.commit', click);
    f.pointer('pointerdown');
    expect(f.contact.current()).toMatchObject({
      active: true,
      x: 0.5,
      y: 0.5,
      deltaX: 0,
      deltaY: 0,
      reason: 'down',
    });
    vi.mocked(f.host.getBoundingClientRect).mockReturnValue(new DOMRect(0, 0, 500, 500));
    f.pointer('pointermove', 110, 70, 2, window);
    expect(f.contact.current()?.deltaX).toBe(0);
    f.pointer('pointerleave', 110, 70);
    expect(f.contact.current()?.active).toBe(true);
    f.pointer('pointermove', 210, -20, 1, window);
    expect(f.contact.current()).toMatchObject({
      active: true,
      x: 1,
      y: 0,
      deltaX: 1,
      deltaY: -1,
      reason: 'move',
    });
    f.pointer('pointerup', 210, -20, 1, window);
    expect(f.contact.current()).toMatchObject({ active: false, reason: 'up' });
    f.pointer('pointermove', 60, 45, 1, window);
    expect(f.contact.current()?.reason).toBe('up');
    expect(click).not.toHaveBeenCalled();
  });
  it.each([
    ['pointercancel', 'cancel'],
    ['lostpointercapture', 'lostcapture'],
  ] as const)('ends on %s without activation', (event, reason) => {
    const f = fixture();
    f.pointer('pointerdown');
    f.pointer(event);
    expect(f.contact.current()).toMatchObject({ active: false, reason });
  });
  it('ends on window blur, replaces a session, and clears on disposal', () => {
    const f = fixture();
    f.pointer('pointerdown');
    const first = f.contact.current()!.session;
    window.dispatchEvent(new Event('blur'));
    expect(f.contact.current()).toMatchObject({ active: false, reason: 'blur' });
    f.pointer('pointerdown');
    expect(f.contact.current()!.session).toBeGreaterThan(first);
    f.pointer('pointerdown');
    expect(f.listener.mock.calls.some(([v]) => v.reason === 'replaced')).toBe(true);
    f.router.dispose();
    expect(f.contact.current()).toMatchObject({ active: false, reason: 'unmount' });
  });
  it('ignores secondary/nonprimary starts and never captures a pointer', () => {
    const f = fixture();
    const capture = vi.fn();
    f.host.setPointerCapture = capture;
    f.pointer('pointerdown', 60, 45, 1, f.host, { button: 2 });
    expect(f.contact.current()).toBe(null);
    f.pointer('pointerdown', 60, 45, 1, f.host, { isPrimary: false });
    expect(f.contact.current()).toBe(null);
    f.pointer('pointerdown');
    expect(Object.isFrozen(f.contact.current())).toBe(true);
    expect(capture).not.toHaveBeenCalled();
  });
  it('never starts an ancestor visual session from a descendant interaction owner', () => {
    const f = fixture();
    const child = document.createElement('div');
    f.host.append(child);
    Object.defineProperty(child, Symbol.for('@proto.ui/adapter-web-component/__proto_instance'), {
      value: true,
    });
    f.pointer('pointerdown', 60, 45, 1, child);
    expect(f.contact.current()).toBe(null);
  });
  it('retiring an old router cannot clear its replacement session', () => {
    const f = fixture();
    f.pointer('pointerdown');
    const second = createWebProtoEventRouter({ rootEl: f.host, isEnabled: () => true });
    disposers.push(() => second.dispose());
    expect(f.contact.current()).toMatchObject({ active: false, reason: 'replaced' });
    f.pointer('pointerdown');
    const session = f.contact.current()!.session;
    f.router.dispose();
    expect(f.contact.current()).toMatchObject({ active: true, session });
  });
  it('rejects zero-sized/non-finite geometry and clamps all retained numbers', () => {
    const f = fixture();
    vi.mocked(f.host.getBoundingClientRect).mockReturnValue(new DOMRect(0, 0, 0, 0));
    f.pointer('pointerdown');
    expect(f.contact.current()).toBe(null);
  });
  it('a new primary press elsewhere cancels the old visual session without rerouting input', () => {
    const f = fixture();
    const down = vi.fn();
    f.router.rootTarget.addEventListener('pointer.down', down);
    f.pointer('pointerdown');
    f.pointer('pointerdown', 10, 10, 2, window);
    expect(f.contact.current()).toMatchObject({ active: false, reason: 'replaced' });
    expect(down).toHaveBeenCalledOnce();
  });
});
