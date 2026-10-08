import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as base from '@proto.ui/prototypes-base/field';
import * as liquid from '@proto.ui/prototypes-liquid-glass/field';
import baseButton from '@proto.ui/prototypes-base/button';
import liquidButton from '@proto.ui/prototypes-liquid-glass/button';
import { createFieldDemo } from './field-demo.shared';
import { renderDemo } from '../../components/PrototypePreviewer/demo-renderer';

vi.mock('../../components/PrototypePreviewer/registry', () => ({
  getPrototype(id: string) {
    if (id === 'base-button') return baseButton;
    if (id === 'liquid-glass-button') return liquidButton;
    const family = id.startsWith('liquid-glass-') ? liquid : base;
    const role = id.split('-').at(-1)!;
    return family[`field${role[0].toUpperCase()}${role.slice(1)}` as keyof typeof family];
  },
}));
const cleanups: Array<() => void> = [];
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  document.body.replaceChildren();
  await flush();
  vi.useRealTimers();
});
async function mount(family: string) {
  const host = document.createElement('div');
  document.body.append(host);
  const view = await renderDemo({ runtime: 'wc', demo: createFieldDemo(family), host });
  cleanups.push(() => view.destroy());
  await flush();
  const ref = (name: string) => host.querySelector<HTMLElement>(`[data-demo-ref="${name}"]`)!;
  const input = ref('asyncControl').querySelector<HTMLInputElement>('input')!;
  const root = (ref('asyncRoot') as any).getExposes();
  const requests: string[] = [];
  ref('asyncRoot').addEventListener('validationRequest', (event) =>
    requests.push((event as CustomEvent).detail.requestId)
  );
  const edit = async (value: string, type = 'input') => {
    input.value = value;
    input.dispatchEvent(new Event(type, { bubbles: true, composed: true }));
    await flush();
  };
  const cancel = async () => {
    const button = ref('cancel');
    button.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0 })
    );
    button.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1, button: 0 })
    );
    button.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true, button: 0, detail: 1 })
    );
    await flush();
  };
  return { ref, root, requests, edit, cancel };
}
describe.each(['base', 'liquid-glass'])(
  'Field %s demo cancellation consumer (synthetic WC)',
  (family) => {
    it('retires a pending reply after delivered pointer activation and permits a fresh request', async () => {
      const f = await mount(family);
      await f.edit('taken');
      expect(f.root.pending.get()).toBe(true);
      const old = f.requests.at(-1);
      await f.cancel();
      expect(f.ref('asyncStatus').textContent).toContain('Canceled');
      expect(f.root.pending.get()).toBe(false);
      expect(f.root.resolveValidation(old, { invalid: true })).toBe(false);
      await vi.advanceTimersByTimeAsync(650);
      expect(f.ref('asyncStatus').textContent).toContain('Canceled');
      expect(f.root.invalid.get()).toBe(false);
      await f.edit('newer');
      await vi.advanceTimersByTimeAsync(500);
      expect(f.ref('asyncStatus').textContent).toContain('Available');
      expect(f.root.invalid.get()).toBe(false);
    });
    it('accepts an explicit newer change after cancellation while the canceled request stays retired', async () => {
      const f = await mount(family);
      await f.edit('taken');
      const canceled = f.requests.at(-1);
      await f.cancel();
      await f.edit('taken', 'change');
      expect(f.requests.at(-1)).not.toBe(canceled);
      expect(f.root.resolveValidation(canceled, { invalid: false })).toBe(false);
      await vi.advanceTimersByTimeAsync(500);
      expect(f.ref('asyncStatus').textContent).toContain('Unavailable');
      expect(f.root.invalid.get()).toBe(true);
    });
    it('does not claim cancellation when only pointerdown arrives without a committed command', async () => {
      const f = await mount(family);
      await f.edit('taken');
      f.ref('cancel').dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          composed: true,
          pointerId: 1,
          button: 0,
        })
      );
      await flush();
      await vi.advanceTimersByTimeAsync(650);
      expect(f.ref('asyncStatus').textContent).toContain('Unavailable');
      expect(f.root.invalid.get()).toBe(true);
    });
    it('shows cancellation after an already completed invalid check without clearing established validity', async () => {
      const f = await mount(family);
      await f.edit('taken');
      await vi.advanceTimersByTimeAsync(500);
      expect(f.ref('asyncStatus').textContent).toContain('Unavailable');
      expect(f.root.invalid.get()).toBe(true);
      await f.cancel();
      expect(f.ref('asyncStatus').textContent).toContain('Canceled');
      expect(f.root.invalid.get()).toBe(true);
    });
  }
);
