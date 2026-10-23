import { describe, expect, it } from 'vitest';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { declareTextControl } from '@proto.ui/module-text-control';
import { AdaptToWebComponent, setElementProps } from '../src';

// Transport/ownership evidence only. Native geometry is asserted by the
// real-browser CommandInput fixture, never by this simulated DOM suite.
describe('native text Root layout transport', () => {
  for (const lineMode of ['single', 'multiline'] as const) {
    it(`keeps ${lineMode} paint on the editor and bounded placement on its boundary`, async () => {
      const name = `x-native-layout-${lineMode}`;
      AdaptToWebComponent(
        definePrototype({
          name,
          modules: [declareTextControl({ content: 'plain-text', lineMode, engine: 'host' })],
          setup(def) {
            def.feedback.style.use(tw('w-full min-w-0 grow px-3 border text-base'));
            return () => null;
          },
        })
      );
      const host = document.createElement(name);
      host.setAttribute('data-pui-style', 'consumer-owned');
      document.body.append(host);
      await Promise.resolve();
      const editor = host.querySelector(lineMode === 'single' ? 'input' : 'textarea')!;
      expect(editor).not.toBeNull();
      expect(host.getAttribute('data-pui-style')?.split(/\s+/)).toEqual([
        'consumer-owned',
        'w-full',
      ]);
      expect(editor.getAttribute('data-pui-style')).toBe(
        'w-full min-w-0 grow px-3 border text-base'
      );
      host.remove();
      await Promise.resolve();
      await Promise.resolve();
      expect(host.getAttribute('data-pui-style')).toBe('consumer-owned');
    });
  }
});

describe('native width updates preserve editing ownership', () => {
  it('retracts final width through rule withdrawal and runtime replacement without replacing the editor', async () => {
    let run!: RunHandle<any>;
    const Component = AdaptToWebComponent(
      definePrototype<{ wide?: boolean; disabled?: boolean }>({
        name: 'x-native-width-withdrawal',
        modules: [
          declareTextControl({ content: 'plain-text', lineMode: 'single', engine: 'host' }),
        ],
        setup(def) {
          def.props.define({
            wide: { type: 'boolean', default: false },
            disabled: { type: 'boolean', default: false },
          });
          def.feedback.style.use(tw('px-3 border text-base'));
          def.rule({
            when: (w) => w.prop('wide').eq(true),
            intent: (i) => i.feedback.style.use(tw('w-full')),
          });
          def.rule({
            when: (w) => w.prop('disabled').eq(true),
            intent: (i) => i.feedback.style.use(tw('opacity-50')),
          });
          def.lifecycle.onCreated((r) => {
            run = r;
          });
          return () => null;
        },
      })
    );
    const host = new Component();
    host.className = 'consumer-owner';
    document.body.append(host);
    const flush = async () => {
      for (let i = 0; i < 8; i++) await Promise.resolve();
    };
    await flush();
    const editor = host.querySelector('input')!;
    editor.value = 'unchanged editing value';
    editor.focus();
    editor.setSelectionRange(2, 5);
    expect(host.hasAttribute('data-pui-style')).toBe(false);
    setElementProps(host, { wide: true, disabled: true });
    await flush();
    expect(host.getAttribute('data-pui-style')).toBe('w-full');
    expect(editor.getAttribute('data-pui-style')).toContain('opacity-50');
    run.feedback.style.patch(tw('w-auto'));
    await flush();
    expect(host.hasAttribute('data-pui-style')).toBe(false);
    expect(editor.getAttribute('data-pui-style')).toContain('w-auto');
    run.feedback.style.clearPatch();
    await flush();
    expect(host.getAttribute('data-pui-style')).toBe('w-full');
    setElementProps(host, { wide: false, disabled: false, surfaceClassName: 'w-full' });
    await flush();
    expect(host.hasAttribute('data-pui-style')).toBe(false);
    expect(editor.classList.contains('w-full')).toBe(true);
    expect(editor.getAttribute('data-pui-style')).not.toContain('opacity-50');
    expect(host.classList.contains('consumer-owner')).toBe(true);
    expect(host.querySelector('input')).toBe(editor);
    expect(editor.value).toBe('unchanged editing value');
    expect(document.activeElement).toBe(editor);
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([2, 5]);
    host.remove();
    await flush();
  });
});
