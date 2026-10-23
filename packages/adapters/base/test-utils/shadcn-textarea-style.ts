import { describe, expect, it } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import textarea from '../../../prototypes/shadcn/src/textarea';
type Mounted = {
  host: HTMLElement;
  act(fn: () => void): Promise<void>;
  setProps(props: any, concurrent?: () => void): Promise<void>;
  unmount(): Promise<void>;
  setPresent(value: boolean): Promise<void>;
  update(): Promise<void>;
};
export function describeShadcnTextareaStyle(
  adapter: string,
  mount: (proto: Prototype<any>, options: any) => Promise<Mounted>
) {
  describe(`${adapter} production Textarea style switching`, () => {
    it('preserves edited value, selection, focus and composition across profile/width changes', async () => {
      const width = Object.getOwnPropertyDescriptor(window, 'innerWidth');
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: 767,
      });
      let m: Mounted | undefined;
      try {
        m = await mount(textarea, { autoUpdateOnPropsChange: false });
        await m.act(() => {});
        const editor = m.host.querySelector('textarea')!;
        expect(editor).not.toBeNull();
        const tokens = () => editor.getAttribute('data-pui-style') ?? '';
        expect(tokens()).toContain('rounded-md');
        expect(tokens()).toContain('text-base');
        await m.act(() => {
          editor.value = 'kept text';
          editor.dispatchEvent(
            new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'kept text' })
          );
          editor.focus();
          editor.setSelectionRange(2, 6);
          editor.dispatchEvent(
            new CompositionEvent('compositionstart', { bubbles: true, data: '' })
          );
        });
        await m.setProps({ styleProfile: 'rhea', rows: 4, placeholder: 'Write here' });
        expect(m.host.querySelector('textarea')).toBe(editor);
        expect(editor.value).toBe('kept text');
        expect(editor.selectionStart).toBe(2);
        expect(editor.selectionEnd).toBe(6);
        expect(document.activeElement).toBe(editor);
        expect(tokens()).toContain('rounded-[var(--pui-radius-2xl)]');
        expect(tokens()).toContain('resize-none');
        expect(tokens()).toContain('bg-input/50');
        expect(tokens()).toContain('placeholder:text-muted-foreground');
        expect(tokens()).not.toContain('shadow-xs');
        expect(Number(editor.rows)).toBe(4);
        await m.act(() => {
          Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            writable: true,
            value: 768,
          });
          window.dispatchEvent(new Event('resize'));
        });
        expect(tokens()).toContain('text-sm');
        expect(editor.value).toBe('kept text');
        expect(editor.selectionStart).toBe(2);
        await m.setProps({ styleProfile: 'new-york', rows: 4 });
        expect(tokens()).toContain('rounded-md');
        expect(tokens()).toContain('resize-y');
        expect(tokens()).toContain('shadow-xs');
        expect(tokens()).not.toContain('rounded-[var(--pui-radius-2xl)]');
        await m.act(() =>
          editor.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '' }))
        );
        await m.setProps({ styleProfile: 'rhea', disabled: true, readOnly: true, rows: 4 });
        expect(editor.disabled).toBe(true);
        expect(editor.readOnly).toBe(true);
        expect(editor.value).toBe('kept text');
        await m.unmount();
        m = undefined;
      } finally {
        await m?.unmount();
        if (width) Object.defineProperty(window, 'innerWidth', width);
      }
    });
  });
}
