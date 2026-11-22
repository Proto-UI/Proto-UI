import { describe, expect, it } from 'vitest';
import { canonicalizeTextControlSelection, type TextControlEvent } from '@proto.ui/core';
import { createWebTextControlHost } from '../src/web';

describe('portable TextControl selection facts', () => {
  it('normalizes UTF-16 offsets with line endings without guessing invalid facts', () => {
    const source = 'a\r\n😀\rb';
    const selection = { start: 3, end: 6, direction: 'backward' } as const;
    expect(canonicalizeTextControlSelection(selection, source, 'multiline')).toEqual({
      start: 2,
      end: 5,
      direction: 'backward',
    });
    const single = canonicalizeTextControlSelection(selection, source, 'single');
    expect(single).toEqual({ start: 1, end: 3, direction: 'backward' });
    expect(Object.isFrozen(single)).toBe(true);
    for (const invalid of [
      undefined,
      null,
      4,
      {},
      { start: -1, end: 2, direction: 'none' },
      { start: 2, end: 1, direction: 'none' },
      { start: 0, end: 9, direction: 'none' },
      { start: 0.5, end: 2, direction: 'none' },
      { start: NaN, end: 2, direction: 'none' },
      { start: 0, end: Infinity, direction: 'none' },
      { start: 0, end: 2, direction: 'unknown' },
      {
        get start() {
          throw new Error('unavailable selection');
        },
      },
    ])
      expect(canonicalizeTextControlSelection(invalid, source, 'single')).toBeNull();
    expect(selection).toEqual({ start: 3, end: 6, direction: 'backward' });
  });

  it.each(['input', 'textarea'] as const)(
    '%s observes caret and ranges without duplicate editing events or raw host objects',
    (tag) => {
      const editor = document.createElement(tag);
      document.body.append(editor);
      const events: TextControlEvent[] = [];
      const lease = createWebTextControlHost(() => editor).attach({
        patch: { valueMode: 'controlled', value: '1234' },
        onEvent: (event) => events.push(event),
      });
      expect(events).toEqual([]);
      editor.focus();
      editor.setSelectionRange(1, 3, 'backward');
      editor.dispatchEvent(new Event('select', { bubbles: true }));
      editor.dispatchEvent(new Event('selectionchange', { bubbles: true }));
      document.dispatchEvent(new Event('selectionchange'));
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'selectionchange',
        value: '1234',
        composing: false,
        data: null,
        inputType: null,
        selection: { start: 1, end: 3, direction: 'backward' },
      });
      expect(Object.isFrozen(events[0])).toBe(true);
      expect(Object.isFrozen(events[0].selection)).toBe(true);
      expect(lease.snapshot()).toEqual({
        value: '1234',
        composing: false,
        selection: { start: 1, end: 3, direction: 'backward' },
      });
      editor.setSelectionRange(2, 2, 'none');
      editor.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }));
      expect(events.at(-1)?.selection).toEqual({ start: 2, end: 2, direction: 'none' });
      expect(events.every((event) => event.type === 'selectionchange')).toBe(true);
      const count = events.length;
      lease.dispose();
      editor.setSelectionRange(0, 0);
      editor.dispatchEvent(new Event('select'));
      document.dispatchEvent(new Event('selectionchange'));
      expect(events).toHaveLength(count);
      expect(() => lease.snapshot()).toThrow('disposed Web host lease');
      editor.remove();
    }
  );

  it('retires a queued restoration observation when its editor lease is disposed', async () => {
    const editor = document.createElement('input');
    const events: TextControlEvent[] = [];
    const lease = createWebTextControlHost(() => editor).attach({
      patch: { valueMode: 'controlled', value: '123456' },
      onEvent: (event) => events.push(event),
    });
    editor.setSelectionRange(3, 5, 'forward');
    lease.update({ valueMode: 'controlled', value: '12' });
    lease.dispose();
    const count = events.length;
    const replacement = createWebTextControlHost(() => editor).attach({
      patch: { valueMode: 'controlled', value: 'owner' },
      onEvent: (event) => events.push(event),
    });
    await Promise.resolve();
    expect(events).toHaveLength(count);
    expect(replacement.snapshot()?.value).toBe('owner');
    replacement.dispose();
  });

  it('returns unknown for unavailable host selection instead of making an end caret', () => {
    const editor = document.createElement('input');
    const lease = createWebTextControlHost(() => editor).attach({
      patch: { valueMode: 'uncontrolled', defaultValue: '1234' },
      onEvent() {},
    });
    Object.defineProperty(editor, 'selectionStart', {
      get() {
        throw new Error('not exposed by this host');
      },
    });
    expect(lease.snapshot()).toEqual({ value: '1234', composing: false, selection: null });
    lease.dispose();
  });
});
