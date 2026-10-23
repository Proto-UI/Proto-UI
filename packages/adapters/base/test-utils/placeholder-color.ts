import { definePrototype, tw, type Prototype } from '@proto.ui/core';
import { asTextareaRoot, type TextareaRootProps } from '@proto.ui/prototypes-base/textarea';
import { describe, expect, it } from 'vitest';
import type { ColorSchemeMount, ColorSchemeOptions } from './color-scheme';
/** Real adapter/editor contribution evidence, not native ::placeholder raster evidence. */
export function describePlaceholderColorIntegration(
  name: string,
  mount: (proto: Prototype<any>, options: ColorSchemeOptions) => Promise<ColorSchemeMount>
) {
  describe(`${name} placeholder color on the actual editor`, () => {
    it('changes and withdraws paint without replacing the editor or its text/selection', async () => {
      const proto = definePrototype<TextareaRootProps & { enabled?: boolean }>({
        name: `test-${name}-placeholder-color`,
        modules: asTextareaRoot.modules,
        setup(def) {
          asTextareaRoot();
          def.props.define({ enabled: { type: 'boolean', default: false } });
          def.props.setDefaults({ defaultValue: '', placeholder: 'A hint' });
          def.feedback.style.use(tw('text-foreground'));
          def.rule({
            when: (w) => w.prop('enabled').eq(false),
            intent: (i) => i.feedback.style.use(tw('placeholder:text-muted-foreground')),
          });
          def.rule({
            when: (w) => w.prop('enabled').eq(true),
            intent: (i) => i.feedback.style.use(tw('placeholder:text-destructive')),
          });
          return () => null;
        },
      });
      const m = await mount(proto, { autoUpdateOnPropsChange: false });
      try {
        await m.update();
        const editor = m.host.querySelector('textarea')!;
        expect(editor).not.toBeNull();
        await m.act(() => {
          editor.value = 'kept text';
          editor.dispatchEvent(
            new InputEvent('input', { bubbles: true, composed: true, data: 'kept text' })
          );
        });
        editor.setSelectionRange(1, 4);
        expect(editor.placeholder).toBe('A hint');
        expect(editor.getAttribute('data-pui-style')).toContain(
          'placeholder:text-muted-foreground'
        );
        await m.setProps({ enabled: true });
        await m.update();
        expect(m.host.querySelector('textarea')).toBe(editor);
        expect(editor.value).toBe('kept text');
        expect(editor.selectionStart).toBe(1);
        expect(editor.selectionEnd).toBe(4);
        expect(editor.getAttribute('data-pui-style')).toContain('placeholder:text-destructive');
        expect(editor.getAttribute('data-pui-style')).not.toContain(
          'placeholder:text-muted-foreground'
        );
        expect(editor.getAttribute('data-pui-style')?.split(/\s+/)).toContain('text-foreground');
        await m.setProps({ enabled: false });
        await m.update();
        expect(m.host.querySelector('textarea')).toBe(editor);
        expect(editor.getAttribute('data-pui-style')).toContain(
          'placeholder:text-muted-foreground'
        );
        expect(editor.getAttribute('data-pui-style')).not.toContain('placeholder:text-destructive');
      } finally {
        await m.unmount();
      }
    });
  });
}
