import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as base from '@proto.ui/prototypes-base/field';
import * as liquid from '@proto.ui/prototypes-liquid-glass/field';
import * as shadcn from '@proto.ui/prototypes-shadcn/field';
import * as brutalist from '@proto.ui/prototypes-brutalist/field';
import * as bootstrap from '@proto.ui/prototypes-bootstrap-2-3-2/field';
import baseButton from '@proto.ui/prototypes-base/button';
import liquidButton from '@proto.ui/prototypes-liquid-glass/button';
import shadcnButton from '@proto.ui/prototypes-shadcn/button';
import brutalistButton from '@proto.ui/prototypes-brutalist/button';
import bootstrapButton from '@proto.ui/prototypes-bootstrap-2-3-2/button';
import * as shadcnSelect from '@proto.ui/prototypes-shadcn/select';
import * as bootstrapSelect from '@proto.ui/prototypes-bootstrap-2-3-2/select';
import * as liquidSelect from '@proto.ui/prototypes-liquid-glass/select';
import * as shadcnSwitch from '@proto.ui/prototypes-shadcn/switch';
import * as bootstrapSwitch from '@proto.ui/prototypes-bootstrap-2-3-2/switch';
import * as liquidSwitch from '@proto.ui/prototypes-liquid-glass/switch';
import { createFieldDemo } from './field-demo.shared';
import { renderDemo } from '../../components/PrototypePreviewer/demo-renderer';

vi.mock('../../components/PrototypePreviewer/registry', () => ({
  getPrototype(id: string) {
    // The actual demo also contains Field Select/Switch compositions. Resolve
    // the real exported prototype identity, not the last word of its role.
    const candidates = [
      baseButton,
      liquidButton,
      shadcnButton,
      brutalistButton,
      bootstrapButton,
      ...[
        base,
        liquid,
        shadcn,
        brutalist,
        bootstrap,
        shadcnSelect,
        bootstrapSelect,
        liquidSelect,
        shadcnSwitch,
        bootstrapSwitch,
        liquidSwitch,
      ].flatMap(Object.values),
    ];
    const prototype = candidates.find(
      (value) => value && typeof value === 'object' && 'name' in value && value.name === id
    );
    if (!prototype) throw new Error(`Missing real Field demo dependency: ${id}`);
    return prototype;
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
  const input = ref('handleControl').querySelector<HTMLInputElement>('input')!;
  const root = (ref('handleRoot') as any).getExposes();
  const requests: string[] = [];
  ref('handleRoot').addEventListener('validationRequest', (event) =>
    requests.push((event as CustomEvent).detail.requestId)
  );
  const edit = async (value: string, type = 'input') => {
    input.value = value;
    input.dispatchEvent(new Event(type, { bubbles: true, composed: true }));
    await flush();
  };
  const reset = async () => {
    const button = ref('reset');
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
  return { ref, root, requests, edit, reset };
}
describe.each(['base', 'shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'])(
  'Field %s demo validation reset (synthetic WC)',
  (family) => {
    it('retires a pending reply after delivered pointer activation and permits a fresh request', async () => {
      const f = await mount(family);
      await f.edit('taken');
      expect(f.root.pending.get()).toBe(true);
      const old = f.requests.at(-1);
      expect(old).toEqual(expect.stringMatching(/.+/));
      await f.reset();
      expect(f.ref('handleStatus').textContent).toContain('Handle ready');
      expect(f.root.pending.get()).toBe(false);
      expect(f.root.resolveValidation(old, { invalid: true })).toBe(false);
      await vi.advanceTimersByTimeAsync(650);
      expect(f.ref('handleStatus').textContent).toContain('Handle ready');
      expect(f.root.invalid.get()).toBe(false);
      await f.edit('newer');
      await vi.advanceTimersByTimeAsync(500);
      expect(f.ref('handleStatus').textContent).toContain('Handle available');
      expect(f.root.invalid.get()).toBe(false);
    });
    it('accepts an explicit newer change after reset while the retired request stays ignored', async () => {
      const f = await mount(family);
      await f.edit('taken');
      const retired = f.requests.at(-1);
      expect(retired).toEqual(expect.stringMatching(/.+/));
      await f.reset();
      await f.edit('taken', 'change');
      expect(f.requests.at(-1)).toEqual(expect.stringMatching(/.+/));
      expect(f.requests.at(-1)).not.toBe(retired);
      expect(f.root.resolveValidation(retired, { invalid: false })).toBe(false);
      await vi.advanceTimersByTimeAsync(500);
      expect(f.ref('handleStatus').textContent).toContain('Handle unavailable');
      expect(f.root.invalid.get()).toBe(true);
    });
    it('does not reset validation when only pointerdown arrives without a committed command', async () => {
      const f = await mount(family);
      await f.edit('taken');
      f.ref('reset').dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          composed: true,
          pointerId: 1,
          button: 0,
        })
      );
      await flush();
      await vi.advanceTimersByTimeAsync(650);
      expect(f.ref('handleStatus').textContent).toContain('Handle unavailable');
      expect(f.root.invalid.get()).toBe(true);
    });
    it('clears established validity and restores ready status after an already completed invalid check', async () => {
      const f = await mount(family);
      await f.edit('taken');
      await vi.advanceTimersByTimeAsync(500);
      expect(f.ref('handleStatus').textContent).toContain('Handle unavailable');
      expect(f.root.invalid.get()).toBe(true);
      await f.reset();
      expect(f.ref('handleStatus').textContent).toContain('Handle ready');
      expect(f.root.invalid.get()).toBe(false);
    });
    it('keeps mounted error feedback before form actions and preserves editor associations', async () => {
      const f = await mount(family);
      await f.edit('taken');
      await vi.advanceTimersByTimeAsync(500);
      const reset = f.ref('reset');
      const error = f.ref('handleError');
      const input = f.ref('handleControl').querySelector('input')!;
      expect(error.compareDocumentPosition(reset) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(input.getAttribute('aria-labelledby')).toBe(f.ref('handleLabel').id);
      expect(input.getAttribute('aria-describedby')).toBe(f.ref('handleDescription').id);
      expect(input.getAttribute('aria-errormessage')).toBe(error.id);
      expect(error.getAttribute('role')).not.toBe('alert');
      expect(error.getAttribute('aria-live')).toBeNull();
      await f.edit('taken', 'change');
      expect(f.root.pending.get()).toBe(true);
      expect(input.getAttribute('aria-errormessage')).toBeNull();
      expect(f.ref('reset')).toBe(reset);
      await f.reset();
      await vi.advanceTimersByTimeAsync(650);
      expect(f.ref('handleStatus').textContent).toContain('Handle ready');
      expect(f.root.invalid.get()).toBe(false);
    });
  }
);
