import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { toastRoot, toastAction, toastClose } from '../src/toast';

// C-FEEDBACK-STYLE-0004 and the inherited Base Toast command/lifecycle contract.
// These WC observations use synthetic input and do not claim native-browser paint.
for (const prototype of [toastRoot, toastAction, toastClose]) AdaptToWebComponent(prototype);
const settle = async () => {
  for (let index = 0; index < 30; index++) await Promise.resolve();
};
const tokens = (element: Element) => (element.getAttribute('data-pui-style') ?? '').split(/\s+/);
const pointer = (element: HTMLElement, type: string) =>
  element.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0 }));

afterEach(async () => {
  document.body.replaceChildren();
  await settle();
});

for (const kind of ['action', 'close'] as const) {
  it(`keeps ${kind} press paint separate from activation and retires it with availability`, async () => {
    const root = document.createElement('brutalist-toast-root') as HTMLElement & {
      getExposes(): { open: { get(): boolean } };
    };
    setElementProps(root, { duration: 0 });
    const command = document.createElement(`brutalist-toast-${kind}`);
    command.textContent = kind;
    root.append(command);
    document.body.append(root);
    await settle();
    expect(root.getExposes().open.get()).toBe(true);
    const changes: unknown[] = [];
    root.addEventListener('openChange', (event) => changes.push((event as CustomEvent).detail));
    const actions: unknown[] = [];
    command.addEventListener('action', (event) => actions.push(event));

    pointer(command, 'pointerdown');
    await settle();
    expect(tokens(command)).toContain('translate-x-1');
    expect(tokens(command)).toContain('translate-y-1');
    expect(tokens(command)).toContain('shadow-none');
    expect(changes).toHaveLength(0);
    expect(actions).toHaveLength(0);
    pointer(command, 'pointercancel');
    await settle();
    expect(tokens(command)).not.toContain('translate-x-1');
    expect(tokens(command)).not.toContain('shadow-none');

    pointer(command, 'pointerdown');
    await settle();
    setElementProps(command, { disabled: true });
    await settle();
    expect(command.getAttribute('aria-disabled')).toBe('true');
    expect(tokens(command)).not.toContain('translate-x-1');
    command.click();
    await settle();
    expect(root.getExposes().open.get()).toBe(true);
    expect(changes).toHaveLength(0);

    setElementProps(command, { disabled: false });
    await settle();
    expect(tokens(command)).not.toContain('translate-x-1');
    pointer(command, 'pointerdown');
    await settle();
    pointer(command, 'pointerup');
    await settle();
    expect(tokens(command)).not.toContain('translate-x-1');
    pointer(command, 'pointerdown');
    await settle();
    pointer(command, 'pointerleave');
    await settle();
    expect(tokens(command)).not.toContain('translate-x-1');

    pointer(command, 'pointerdown');
    await settle();
    command.remove();
    await settle();
    root.append(command);
    await settle();
    expect(tokens(command)).not.toContain('translate-x-1');
    command.click();
    await settle();
    expect(root.getExposes().open.get()).toBe(false);
    expect(changes).toHaveLength(1);
    expect(actions).toHaveLength(kind === 'action' ? 1 : 0);
  });
}
