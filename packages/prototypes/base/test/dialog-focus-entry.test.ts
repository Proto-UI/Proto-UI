import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { dialogRoot, dialogTrigger, dialogMask, dialogContent, dialogClose } from '../src/dialog';

// Synthetic WC policy coverage, not native portal/readiness or Search continuity.
let sequence = 0;
const fixtures: Array<{ elements: HTMLElement[]; counts: { created: number; disposed: number } }> =
  [];
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
async function fixture(policy?: 'auto' | 'manual', controlled = false) {
  const counts = { created: 0, disposed: 0 };
  const parts: Record<string, any> = {};
  const prefix = `dialog-entry-${++sequence}`;
  for (const [name, proto] of Object.entries({
    root: dialogRoot,
    trigger: dialogTrigger,
    mask: dialogMask,
    content: dialogContent,
    close: dialogClose,
    second: dialogClose,
  })) {
    const C = AdaptToWebComponent(proto, {
      registerAs: `${prefix}-${name}`,
      diagnostics: {
        onLifecycleEvent(event) {
          if (event.type === 'instance.created') counts.created++;
          if (event.type === 'instance.dispose.done') counts.disposed++;
        },
      },
    });
    parts[name] = new C();
  }
  const { root, trigger, mask, content, close, second } = parts;
  fixtures.push({ elements: Object.values(parts), counts });
  if (policy !== undefined) setElementProps(content, { focusEntry: policy });
  if (controlled) setElementProps(root, { open: false });
  content.append(close, second);
  root.append(trigger, mask, content);
  document.body.append(root);
  await flush();
  trigger.focus();
  expect(document.activeElement).toBe(trigger);
  return parts;
}
async function finish(parts: Record<string, any>) {
  for (const part of [parts.mask, parts.content]) {
    const exposed = part.getExposes();
    if (['entering', 'leaving'].includes(exposed.transitionState.get()))
      exposed.controls.complete();
  }
  await flush();
}
afterEach(async () => {
  let hasFailure = false;
  let firstFailure: unknown;
  const remember = (error: unknown) => {
    if (!hasFailure) firstFailure = error;
    hasFailure = true;
  };
  try {
    for (const fixture of fixtures) {
      for (const element of fixture.elements) {
        try {
          element.remove();
        } catch (error) {
          remember(error);
        }
      }
      try {
        await vi.waitFor(() => expect(fixture.counts.disposed).toBe(fixture.counts.created));
      } catch (error) {
        remember(error);
      }
    }
  } finally {
    fixtures.length = 0;
    vi.restoreAllMocks();
  }
  if (hasFailure) throw firstFailure;
});

describe('Dialog Content per-activation public entry policy', () => {
  it.each([undefined, 'auto'] as const)(
    'preserves %s automatic entry and Close restoration',
    async (policy) => {
      const parts = await fixture(policy);
      parts.trigger.click();
      await flush();
      expect(parts.content.getExposes().open.get()).toBe(true);
      await vi.waitFor(() => expect(document.activeElement).toBe(parts.close));
      parts.close.click();
      await finish(parts);
      expect(parts.content.getExposes().open.get()).toBe(false);
      await vi.waitFor(() => expect(document.activeElement).toBe(parts.trigger));
    }
  );

  it('manual suppresses automatic entry but retains public focus and Tab looping', async () => {
    const parts = await fixture('manual');
    const closeFocus = vi.spyOn(parts.close, 'focus');
    const secondFocus = vi.spyOn(parts.second, 'focus');
    parts.trigger.click();
    await flush();
    expect(parts.content.getExposes().open.get()).toBe(true);
    expect(closeFocus).not.toHaveBeenCalled();
    expect(secondFocus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(parts.trigger);
    parts.close.getExposes().focusSelf({ reason: 'keyboard' });
    await vi.waitFor(() => expect(document.activeElement).toBe(parts.close));
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    );
    await vi.waitFor(() => expect(document.activeElement).toBe(parts.second));
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    );
    await vi.waitFor(() => expect(document.activeElement).toBe(parts.close));
  });

  it.each(['auto', 'manual'] as const)(
    'does not refocus on active %s policy change; next activation reads it',
    async (initial) => {
      const next = initial === 'auto' ? 'manual' : 'auto';
      const parts = await fixture(initial);
      parts.trigger.click();
      await flush();
      parts.second.getExposes().focusSelf({ reason: 'keyboard' });
      await vi.waitFor(() => expect(document.activeElement).toBe(parts.second));
      const closeFocus = vi.spyOn(parts.close, 'focus');
      setElementProps(parts.content, { focusEntry: next });
      await flush();
      expect(closeFocus).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(parts.second);
      parts.root.getExposes().close();
      await finish(parts);
      await vi.waitFor(() => expect(document.activeElement).toBe(parts.trigger));
      closeFocus.mockClear();
      parts.trigger.click();
      await flush();
      expect(parts.content.getExposes().open.get()).toBe(true);
      if (next === 'auto') await vi.waitFor(() => expect(document.activeElement).toBe(parts.close));
      else {
        expect(closeFocus).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(parts.trigger);
      }
    }
  );

  it('rejected controlled open never enters; rejected close never reactivates with new policy', async () => {
    const parts = await fixture('manual', true);
    const requests: unknown[] = [];
    parts.root.addEventListener('openChange', (event: CustomEvent) => requests.push(event.detail));
    const closeFocus = vi.spyOn(parts.close, 'focus');
    parts.trigger.click();
    await flush();
    expect(requests).toEqual([expect.objectContaining({ open: true })]);
    expect(parts.content.getExposes().open.get()).toBe(false);
    expect(closeFocus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(parts.trigger);
    setElementProps(parts.root, { open: true });
    await flush();
    expect(parts.content.getExposes().open.get()).toBe(true);
    expect(closeFocus).not.toHaveBeenCalled();
    parts.second.getExposes().focusSelf({ reason: 'keyboard' });
    await vi.waitFor(() => expect(document.activeElement).toBe(parts.second));
    setElementProps(parts.content, { focusEntry: 'auto' });
    parts.root.getExposes().close();
    await flush();
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(expect.objectContaining({ open: false }));
    expect(parts.content.getExposes().open.get()).toBe(true);
    expect(closeFocus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(parts.second);
  });
});
