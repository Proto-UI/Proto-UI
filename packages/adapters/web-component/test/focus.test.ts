import { describe, expect, it, vi } from 'vitest';
import { definePrototype, type FocusableHandle } from '@proto.ui/core';
import { asFocusable, asFocusEntry, asFocusScope } from '@proto.ui/hooks';
import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';
import { asButton } from '../../../prototypes/base/src/button';
describe('adapter-web-component focus wiring', () => {
  it('makes asButton host focusable and syncs focus/blur to exposes', () => {
    const P = definePrototype({
      name: 'x-focusable-button',
      setup() {
        asButton();
        return (r) => [r.el('button', 'ok')];
      },
    });

    AdaptToWebComponent(P as any);

    const el = document.createElement('x-focusable-button') as any;
    document.body.appendChild(el);

    expect(el.tabIndex).toBe(0);

    const exposes = el.getExposes();
    expect(exposes.focused.get()).toBe(false);

    el.focus();
    expect(exposes.focused.get()).toBe(true);

    el.blur();
    expect(exposes.focused.get()).toBe(false);
  });

  it('stops retrying focus when the target never accepts focus', async () => {
    let focusable!: FocusableHandle;
    const frames: Array<FrameRequestCallback> = [];
    const P = definePrototype({
      name: 'x-focus-retry-bound',
      setup() {
        focusable = asFocusable();
        focusable.configure({ disabled: false });
        return (r) => [r.el('div', 'ok')];
      },
    });

    AdaptToWebComponent(P as any);
    const el = document.createElement('x-focus-retry-bound') as any;
    document.body.appendChild(el);
    await Promise.resolve();
    const focus = vi.spyOn(el, 'focus').mockImplementation(() => {});
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });

    try {
      focusable.focus();
      expect(frames).toHaveLength(1);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        frames.shift()?.(0);
        frames.shift()?.(0);
        await Promise.resolve();
      }
      expect(focus).toHaveBeenCalledTimes(4);
      expect(frames).toHaveLength(0);
    } finally {
      raf.mockRestore();
      focus.mockRestore();
      el.remove();
    }
  });

  it('does not make focus-scope-only host focusable', () => {
    const P = definePrototype({
      name: 'x-focus-scope-only',
      setup() {
        const scope = asFocusScope();
        scope.configure({ emptyPolicy: 'container' });
        return (r) => [r.el('div', 'ok')];
      },
    });

    AdaptToWebComponent(P as any);

    const el = document.createElement('x-focus-scope-only') as any;
    document.body.appendChild(el);

    expect(el.tabIndex).toBe(-1);
    expect(el.hasAttribute('tabindex')).toBe(false);
    expect(document.activeElement).not.toBe(el);
  });

  it('makes focus entry host focusable only when descendant-first needs self fallback', async () => {
    const P = definePrototype({
      name: 'x-focus-entry-panel',
      setup() {
        const entry = asFocusEntry();
        entry.configure({ strategy: 'descendant-first', fallback: 'self' });
        return (r) => [r.slot()];
      },
    });

    AdaptToWebComponent(P as any);

    const empty = document.createElement('x-focus-entry-panel') as any;
    document.body.appendChild(empty);
    await Promise.resolve();

    expect(empty.tabIndex).toBe(0);

    const withButton = document.createElement('x-focus-entry-panel') as any;
    const button = document.createElement('button');
    withButton.appendChild(button);
    document.body.appendChild(withButton);
    await Promise.resolve();

    expect(withButton.tabIndex).toBe(-1);
    expect(withButton.hasAttribute('tabindex')).toBe(false);

    empty.remove();
    withButton.remove();
  });

  it('delegates programmatic focus entry to the first tabbable descendant', async () => {
    let capturedEntry!: ReturnType<typeof asFocusEntry>;
    const P = definePrototype({
      name: 'x-focus-entry-delegate',
      setup() {
        capturedEntry = asFocusEntry();
        capturedEntry.configure({ strategy: 'descendant-first', fallback: 'self' });
        return (r) => [r.slot()];
      },
    });

    AdaptToWebComponent(P as any);

    const el = document.createElement('x-focus-entry-delegate') as any;
    const disabled = document.createElement('button');
    const enabled = document.createElement('button');
    disabled.disabled = true;
    el.append(disabled, enabled);
    document.body.appendChild(el);
    await Promise.resolve();

    capturedEntry.focus();

    expect(document.activeElement).toBe(enabled);

    el.remove();
  });
});
