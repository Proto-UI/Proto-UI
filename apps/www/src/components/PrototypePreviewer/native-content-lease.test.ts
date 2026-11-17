import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerNativeContentContainer, withNativeContentLease } from './native-content-lease';
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
function fixture(register: boolean) {
  const link = document.createElement('a');
  link.href = '/retained';
  const oldSurface = document.createElement('span'),
    oldText = document.createElement('span'),
    source = document.createElement('span');
  source.textContent = 'Original native source';
  oldText.append(source);
  oldSurface.append(oldText);
  link.append(oldSurface);
  document.body.append(link);
  if (register) {
    registerNativeContentContainer(oldSurface, [source]);
    registerNativeContentContainer(oldText, [source]);
  }
  const nextSurface = document.createElement('span'),
    nextText = document.createElement('span');
  const move = () => {
    nextText.append(source);
    nextSurface.append(nextText);
    oldSurface.replaceWith(nextSurface);
  };
  return { link, source, oldSurface, nextText, move };
}
describe('native source boundary normalization', () => {
  for (const [anchor, focus] of [
    [0, 1],
    [1, 0],
  ])
    it(`maps retired generated Surface endpoints ${anchor} → ${focus} to the same authored content`, () => {
      const { link, source, oldSurface, nextText, move } = fixture(true);
      const selection = document.getSelection()!;
      selection.setBaseAndExtent(oldSurface, anchor!, oldSurface, focus!);
      // HappyDOM 15 aliases focusOffset to anchorOffset; this getter fixture tests
      // forwarding only. Real forward/backward Selection remains in browser CI.
      vi.spyOn(selection, 'focusOffset', 'get').mockReturnValue(focus!);
      const restore = vi.spyOn(selection, 'setBaseAndExtent');
      withNativeContentLease(link, move);
      expect(oldSurface.isConnected).toBe(false);
      expect(source.isConnected).toBe(true);
      expect(restore).toHaveBeenLastCalledWith(nextText, anchor, nextText, focus);
      expect(link.textContent).toBe('Original native source');
    });
  it('negative control cannot claim a retired wrapper is retained without a source mapping', () => {
    const { link, oldSurface, move } = fixture(false);
    const selection = document.getSelection()!;
    selection.setBaseAndExtent(oldSurface, 0, oldSurface, 1);
    vi.spyOn(selection, 'focusOffset', 'get').mockReturnValue(1);
    const restore = vi.spyOn(selection, 'setBaseAndExtent');
    withNativeContentLease(link, move);
    expect(oldSurface.isConnected).toBe(false);
    expect(restore).not.toHaveBeenCalled();
  });
});

describe('passive shell ancestor boundary ownership', () => {
  for (const [anchor, focus] of [
    [0, 1],
    [1, 0],
  ]) {
    it(`restores registered ancestor endpoints ${anchor} → ${focus} for the retained source scope`, () => {
      const { source, oldSurface, nextText, move } = fixture(true);
      const selection = document.getSelection()!;
      selection.setBaseAndExtent(oldSurface, anchor!, oldSurface, focus!);
      vi.spyOn(selection, 'focusOffset', 'get').mockReturnValue(focus!);
      const restore = vi.spyOn(selection, 'setBaseAndExtent');
      withNativeContentLease(source, move);
      expect(restore).toHaveBeenLastCalledWith(nextText, anchor, nextText, focus);
    });
  }
  it('does not claim an unrelated registered container', () => {
    const { source, oldSurface, move } = fixture(true);
    const other = document.createElement('div');
    other.textContent = 'Other owner';
    document.body.append(other);
    registerNativeContentContainer(oldSurface, [other]);
    const selection = document.getSelection()!;
    selection.setBaseAndExtent(oldSurface, 0, oldSurface, 1);
    const restore = vi.spyOn(selection, 'setBaseAndExtent');
    withNativeContentLease(source, move);
    expect(restore).not.toHaveBeenCalled();
  });
});

describe('native text control selection', () => {
  for (const tag of ['input', 'textarea'] as const)
    for (const direction of ['forward', 'backward'] as const)
      it(`restores ${tag} ${direction} selection after the document Selection`, () => {
        const control = document.createElement(tag);
        control.value = 'Retained uncontrolled source';
        const source = document.createElement('div');
        const destination = document.createElement('div');
        source.append(control);
        document.body.append(source, destination);
        control.focus();
        control.setSelectionRange(3, 8, direction);
        const selection = document.getSelection()!;
        selection.setBaseAndExtent(control, 0, control, 0);
        const restore = selection.setBaseAndExtent.bind(selection);
        vi.spyOn(selection, 'setBaseAndExtent').mockImplementation((...args) => {
          restore(...args);
          // Chromium's document Selection restoration also moves the control caret.
          control.setSelectionRange(0, 0);
        });

        withNativeContentLease(source, () => {
          control.blur();
          destination.append(source);
        });

        expect(document.activeElement).toBe(control);
        expect(control.value).toBe('Retained uncontrolled source');
        expect([control.selectionStart, control.selectionEnd, control.selectionDirection]).toEqual([
          3,
          8,
          direction,
        ]);
      });
});

describe('callback-updated native text control selection', () => {
  for (const tag of ['input', 'textarea'] as const)
    for (const phase of ['move', 'focus'] as const)
      it(`preserves ${tag} selection updated during ${phase}`, () => {
        const control = document.createElement(tag);
        control.value = 'Retained uncontrolled source';
        const source = document.createElement('div');
        const destination = document.createElement('div');
        source.append(control);
        document.body.append(source, destination);
        control.focus();
        control.setSelectionRange(3, 8, 'forward');
        const selection = document.getSelection()!;
        selection.setBaseAndExtent(control, 0, control, 0);
        const restore = selection.setBaseAndExtent.bind(selection);
        vi.spyOn(selection, 'setBaseAndExtent').mockImplementation((...args) => {
          restore(...args);
          control.setSelectionRange(0, 0);
        });
        const update = () => {
          control.value = 'New text';
          control.setSelectionRange(1, 4, 'backward');
        };
        if (phase === 'focus') control.addEventListener('focus', update);

        withNativeContentLease(source, () => {
          control.blur();
          destination.append(source);
          if (phase === 'move') update();
        });

        expect(document.activeElement).toBe(control);
        expect(control.value).toBe('New text');
        expect([control.selectionStart, control.selectionEnd, control.selectionDirection]).toEqual([
          1,
          4,
          'backward',
        ]);
      });
});

describe('synchronous owner-to-owner Selection freshness', () => {
  it('reads a Selection created by the preceding owner move before leasing the next owner', () => {
    const first = fixture(true);
    const second = fixture(true);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    const restore = vi.spyOn(selection, 'setBaseAndExtent');
    withNativeContentLease(first.link, () => {
      first.move();
      // Models a synchronous connection callback, not a user event between tasks.
      selection.setBaseAndExtent(second.oldSurface, 0, second.oldSurface, 1);
    });
    // HappyDOM 15's known focusOffset alias is isolated to this getter fixture.
    vi.spyOn(selection, 'focusOffset', 'get').mockReturnValue(1);
    withNativeContentLease(second.link, second.move);
    expect(restore).toHaveBeenLastCalledWith(second.nextText, 0, second.nextText, 1);
    expect(second.source.isConnected).toBe(true);
  });

  it('does not reuse an empty snapshot after an interrupted owner creates a Selection', () => {
    const first = fixture(true);
    const second = fixture(true);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    const failure = new Error('interrupted native composition');
    expect(() =>
      withNativeContentLease(first.link, () => {
        selection.setBaseAndExtent(second.oldSurface, 0, second.oldSurface, 1);
        throw failure;
      })
    ).toThrow(failure);
    vi.spyOn(selection, 'focusOffset', 'get').mockReturnValue(1);
    const restore = vi.spyOn(selection, 'setBaseAndExtent');
    withNativeContentLease(second.link, second.move);
    expect(restore).toHaveBeenLastCalledWith(second.nextText, 0, second.nextText, 1);
    expect(first.oldSurface.isConnected).toBe(true);
  });
});
