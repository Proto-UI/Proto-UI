import { afterEach, describe, expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  bindLogicalParent,
  getLogicalParent,
} from '../../../adapters/web-component/src/platform/instance-tree';
import { dialogRoot, dialogTrigger, dialogMask, dialogContent, dialogClose } from '../src/dialog';
import type { DialogContentProps } from '../src/dialog/types';
import { DIALOG_CONTEXT } from '../src/dialog/shared';

// Synthetic WC policy coverage, not native portal/readiness or Search continuity.
let sequence = 0;
const fixtures: Array<{ elements: HTMLElement[]; counts: { created: number; disposed: number } }> =
  [];
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
async function fixture(
  policy?: DialogContentProps['focusEntry'],
  controlled = false,
  options: { duration?: number; withContent?: boolean; observeOwner?: boolean } = {}
) {
  const counts = { created: 0, disposed: 0 };
  const parts: Record<string, any> = {};
  const prefix = `dialog-entry-${++sequence}`;
  let readContentOwner: (() => string) | undefined;
  const contentPrototype = options.observeOwner
    ? definePrototype<DialogContentProps>({
        name: `${prefix}-observed-content`,
        setup(def) {
          dialogContent.setup(def);
          def.lifecycle.onCreated((run) => {
            readContentOwner = () => run.context.read(DIALOG_CONTEXT).rootId;
          });
        },
      })
    : dialogContent;
  for (const [name, proto] of Object.entries({
    root: dialogRoot,
    trigger: dialogTrigger,
    mask: dialogMask,
    content: contentPrototype,
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
  setElementProps(content, {
    ...(policy === undefined ? {} : { focusEntry: policy }),
    ...(options.duration === undefined
      ? {}
      : { enterDuration: options.duration, leaveDuration: options.duration }),
  });
  if (controlled) setElementProps(root, { open: false });
  content.append(close, second);
  root.append(trigger, mask);
  if (options.withContent !== false) root.append(content);
  document.body.append(root);
  await flush();
  trigger.focus();
  expect(document.activeElement).toBe(trigger);
  return {
    root,
    trigger,
    mask,
    content,
    close,
    second,
    readContentOwner: () => readContentOwner?.(),
  };
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

  it('content enters the dialog surface without adding it to the descendant Tab loop', async () => {
    const parts = await fixture('content');
    const closeFocus = vi.spyOn(parts.close, 'focus');
    parts.trigger.click();
    await flush();
    await vi.waitFor(() => expect(document.activeElement).toBe(parts.content));
    expect(parts.content.getAttribute('role')).toBe('dialog');
    expect(parts.content.getAttribute('aria-modal')).toBe('true');
    expect(parts.content.tabIndex).toBe(-1);
    expect(closeFocus).not.toHaveBeenCalled();
    for (const [shiftKey, expected] of [
      [false, parts.close],
      [true, parts.second],
      [false, parts.close],
    ] as const) {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true })
      );
      await vi.waitFor(() => expect(document.activeElement).toBe(expected));
    }
    parts.close.click();
    await finish(parts);
    await vi.waitFor(() => expect(document.activeElement).toBe(parts.trigger));
  });

  it.each(['auto', 'manual'] as const)(
    'content keeps the active target when policy changes to %s and reads it on reopening',
    async (next) => {
      const parts = await fixture('content');
      parts.trigger.click();
      await flush();
      await vi.waitFor(() => expect(document.activeElement).toBe(parts.content));
      setElementProps(parts.content, { focusEntry: next });
      await flush();
      expect(document.activeElement).toBe(parts.content);
      parts.root.getExposes().close();
      await finish(parts);
      expect(document.activeElement).toBe(parts.trigger);
      parts.trigger.click();
      await flush();
      await vi.waitFor(() =>
        expect(document.activeElement).toBe(next === 'auto' ? parts.close : parts.trigger)
      );
    }
  );

  it('content neither enters on a declined controlled open nor retires on a declined close', async () => {
    const parts = await fixture('content', true);
    const contentFocus = vi.spyOn(parts.content, 'focus');
    parts.trigger.click();
    await flush();
    expect(contentFocus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(parts.trigger);
    setElementProps(parts.root, { open: true });
    await flush();
    await vi.waitFor(() => expect(document.activeElement).toBe(parts.content));
    contentFocus.mockClear();
    parts.root.getExposes().close();
    await flush();
    expect(parts.content.getExposes().open.get()).toBe(true);
    expect(document.activeElement).toBe(parts.content);
    expect(contentFocus).not.toHaveBeenCalled();
    setElementProps(parts.root, { open: false });
    await finish(parts);
    await vi.waitFor(() => expect(document.activeElement).toBe(parts.trigger));
  });

  it.each([undefined, 0])(
    'content retains its accepted activation after a declined Escape with duration %s',
    async (duration) => {
      const parts = await fixture('content', true, { duration });
      setElementProps(parts.root, { open: true });
      await flush();
      await vi.waitFor(() => expect(document.activeElement).toBe(parts.content));
      const contentFocus = vi.spyOn(parts.content, 'focus');
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      );
      await flush();
      expect(parts.content.getExposes().open.get()).toBe(true);
      expect(document.activeElement).toBe(parts.content);
      expect(contentFocus).not.toHaveBeenCalled();
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
      );
      await vi.waitFor(() => expect(document.activeElement).toBe(parts.close));
      setElementProps(parts.root, { open: false });
      await finish(parts);
      await vi.waitFor(() => expect(document.activeElement).toBe(parts.trigger));
    }
  );

  it.each([
    { next: 'auto', duration: undefined },
    { next: 'manual', duration: undefined },
    { next: 'auto', duration: 0 },
    { next: 'manual', duration: 0 },
  ] as const)(
    'content cancels rejected host acquisition before a later $next activation with duration $duration',
    async ({ next, duration }) => {
      const parts = await fixture('content', false, { duration });
      // Host seam: an available surface rejects acquisition. No focus fact is injected.
      const contentFocus = vi.spyOn(parts.content, 'focus').mockImplementation(() => {});
      parts.trigger.click();
      await flush();
      expect(contentFocus).toHaveBeenCalled();
      expect(document.activeElement).toBe(parts.trigger);
      parts.root.getExposes().close();
      await finish(parts);
      contentFocus.mockRestore();
      const laterFocus = vi.spyOn(parts.content, 'focus');
      setElementProps(parts.content, { focusEntry: next });
      parts.trigger.click();
      await flush();
      await vi.waitFor(() =>
        expect(document.activeElement).toBe(next === 'auto' ? parts.close : parts.trigger)
      );
      expect(laterFocus).not.toHaveBeenCalled();
    }
  );

  it('content cancels a rejected request when its replacement owner publishes', async () => {
    const old = await fixture('content', false, { observeOwner: true });
    const next = await fixture('manual', false, { withContent: false });
    old.trigger.focus();
    const focus = vi.spyOn(old.content, 'focus').mockImplementation(() => {});
    old.trigger.click();
    await flush();
    expect(focus).toHaveBeenCalled();
    const previousId = old.content.id;
    const previousOwner = old.readContentOwner();
    setElementProps(old.content, { focusEntry: 'manual' });
    next.root.getExposes().openDialog();
    await flush();
    // Explicit Adapter rebind seam: physical portal movement alone is not an owner change.
    bindLogicalParent(old.content._instanceToken, next.root._instanceToken, {
      authority: 'owner',
    });
    old.content._controller.update();
    // Context reads resolve the new provider; ancestry changes alone do not
    // publish values (M-CONTEXT-0001-E). Deliver a real new-owner update next.
    expect(old.readContentOwner()).not.toBe(previousOwner);
    setElementProps(next.root, { a11yLabel: 'Replacement dialog owner' });
    await flush();
    expect(getLogicalParent(old.content._instanceToken)).toBe(next.root._instanceToken);
    expect(old.content.id).not.toBe(previousId);
    expect(old.content.getExposes().open.get()).toBe(true);
    focus.mockRestore();
    const laterFocus = vi.spyOn(old.content, 'focus');
    old.content._controller.update();
    await flush();
    expect(laterFocus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(old.trigger);
    next.root.getExposes().close();
    await finish({ mask: next.mask, content: old.content });
    old.root.getExposes().close();
    await finish({ mask: old.mask, content: old.content });
  });

  it('content stops entry when native focus synchronously closes the current dialog', async () => {
    const parts = await fixture('content');
    parts.content.addEventListener('focus', () => parts.root.getExposes().close(), { once: true });
    parts.trigger.click();
    await flush();
    expect(parts.content.getExposes().open.get()).toBe(false);
    await finish(parts);
    await vi.waitFor(() => expect(document.activeElement).toBe(parts.trigger));
    const laterFocus = vi.spyOn(parts.content, 'focus');
    setElementProps(parts.content, { focusEntry: 'manual' });
    parts.trigger.click();
    await flush();
    expect(document.activeElement).toBe(parts.trigger);
    expect(laterFocus).not.toHaveBeenCalled();
  });

  it('content cannot overwrite a newer activation during its native focus callback', async () => {
    const parts = await fixture('content');
    let replaced = false;
    parts.content.addEventListener(
      'focus',
      () => {
        replaced = true;
        parts.root.getExposes().close();
        setElementProps(parts.content, { focusEntry: 'auto' });
        parts.root.getExposes().openDialog();
      },
      { once: true }
    );
    parts.trigger.click();
    await flush();
    expect(replaced).toBe(true);
    expect(parts.content.getExposes().open.get()).toBe(true);
    await vi.waitFor(() => expect(document.activeElement).toBe(parts.close));
    expect(parts.content.tabIndex).toBe(-1);
    parts.root.getExposes().close();
    await finish(parts);
    await vi.waitFor(() => expect(document.activeElement).toBe(parts.trigger));
  });

  it.each(['content', 'auto'] as const)(
    'content preserves the previous owner when close blur synchronously opens %s',
    async (next) => {
      const parts = await fixture('content');
      parts.trigger.click();
      await flush();
      await vi.waitFor(() => expect(document.activeElement).toBe(parts.content));
      let reopened = false;
      parts.content.addEventListener(
        'blur',
        () => {
          reopened = true;
          setElementProps(parts.content, { focusEntry: next });
          parts.root.getExposes().openDialog();
        },
        { once: true }
      );
      parts.root.getExposes().close();
      await flush();
      expect(reopened).toBe(true);
      expect(parts.content.getExposes().open.get()).toBe(true);
      await vi.waitFor(() =>
        expect(document.activeElement).toBe(next === 'content' ? parts.content : parts.close)
      );
      parts.root.getExposes().close();
      await finish(parts);
      await vi.waitFor(() => expect(document.activeElement).toBe(parts.trigger));
    }
  );

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
