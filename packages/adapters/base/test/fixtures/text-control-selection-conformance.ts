import { describe, expect, it } from 'vitest';
import {
  definePrototype,
  type Prototype,
  type TextControlEvent,
  type TextControlHandle,
} from '@proto.ui/core';
import { asTextControl } from '@proto.ui/hooks';
import { declareTextControl } from '@proto.ui/module-text-control';
import type { PointerFactsMount } from './pointer-facts-conformance';

let serial = 0;
export function textControlSelectionConformance(
  name: string,
  mount: (prototype: Prototype) => Promise<PointerFactsMount>
) {
  describe(`${name}: TextControl host-owned selection`, () => {
    it.each(['controlled', 'uncontrolled'] as const)(
      'keeps %s value ownership separate from caret observations and retires old callbacks',
      async (valueMode) => {
        const events: TextControlEvent[] = [];
        const callbackSnapshots: unknown[] = [];
        let control!: TextControlHandle;
        const prototype = definePrototype({
          name: `selection-${name}-${++serial}`,
          modules: [
            declareTextControl({ content: 'plain-text', lineMode: 'single', engine: 'host' }),
          ],
          setup(def) {
            control = asTextControl();
            for (const type of [
              'selectionchange',
              'input',
              'compositionstart',
              'compositionend',
            ] as const)
              control.on(type, (_run, event) => {
                events.push(event);
                if (type === 'selectionchange') control.sync({ placeholder: 'Observed selection' });
                if (type === 'input') callbackSnapshots.push(control.snapshot());
              });
            def.lifecycle.onCreated(() =>
              control.sync({
                valueMode,
                value: '1234',
                defaultValue: '1234',
              })
            );
            return () => null;
          },
        });
        const mounted = await mount(prototype);
        try {
          await mounted.flush();
          const editor = (
            mounted.root.localName === 'input'
              ? mounted.root
              : (mounted.root.shadowRoot?.querySelector('input') ??
                mounted.root.querySelector('input'))
          ) as HTMLInputElement;
          expect(editor).toBeTruthy();
          expect(editor.value).toBe('1234');
          editor.setSelectionRange(1, 3, 'backward');
          await mounted.dispatch(editor, new Event('select', { bubbles: true }));
          await mounted.flush();
          expect(control.snapshot()).toEqual({
            value: '1234',
            composing: false,
            selection: { start: 1, end: 3, direction: 'backward' },
          });
          expect(events.filter((e) => e.type === 'input')).toEqual([]);
          expect(events.at(-1)).toEqual({
            type: 'selectionchange',
            value: '1234',
            composing: false,
            data: null,
            inputType: null,
            selection: { start: 1, end: 3, direction: 'backward' },
          });
          editor.value = '123456';
          editor.setSelectionRange(5, 6, 'forward');
          await mounted.dispatch(editor, new Event('selectionchange', { bubbles: true }));
          await mounted.flush();
          // Selection may arrive before input. An observation-induced ordinary
          // sync must not replace the uncommitted physical candidate in either mode.
          expect(editor.value).toBe('123456');
          expect(control.snapshot()).toEqual({ value: '1234', composing: false, selection: null });
          await mounted.dispatch(
            editor,
            new InputEvent('input', { bubbles: true, data: '56', inputType: 'insertText' })
          );
          await mounted.flush();
          expect(events.find((e) => e.type === 'input')).toEqual({
            type: 'input',
            value: '123456',
            composing: false,
            data: '56',
            inputType: 'insertText',
            selection: { start: 5, end: 6, direction: 'forward' },
          });
          expect(callbackSnapshots).toEqual([
            valueMode === 'controlled'
              ? {
                  value: '1234',
                  composing: false,
                  selection: null,
                }
              : {
                  value: '123456',
                  composing: false,
                  selection: { start: 5, end: 6, direction: 'forward' },
                },
          ]);
          expect(control.snapshot()).toEqual({
            value: valueMode === 'controlled' ? '1234' : '123456',
            composing: false,
            selection:
              valueMode === 'controlled'
                ? { start: 4, end: 4, direction: 'forward' }
                : { start: 5, end: 6, direction: 'forward' },
          });
          expect(
            events.every(
              (e) => Object.isFrozen(e) && (!e.selection || Object.isFrozen(e.selection))
            )
          ).toBe(true);
          await mounted.unmount();
          const count = events.length;
          editor.setSelectionRange(0, 0);
          editor.dispatchEvent(new Event('selectionchange'));
          editor.dispatchEvent(new InputEvent('input'));
          await mounted.flush();
          expect(events).toHaveLength(count);
        } finally {
          if (mounted.root.isConnected) await mounted.unmount();
        }
      }
    );
  });
}
