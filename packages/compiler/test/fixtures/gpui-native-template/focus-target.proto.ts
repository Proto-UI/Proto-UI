import { definePrototype, tw, type FocusRequestOptions } from '@proto.ui/core';
import { asFocusable, asFocusEntry, asTextControl } from '@proto.ui/hooks';
import { declareTextControl } from '@proto.ui/module-text-control';

// An ordinary separately compiled logical target, sharing the emitted SDK with its region.
export default definePrototype({
  name: 'ordinary-owned-entry-target',
  setup(def) {
    const focus = asFocusable();
    const entry = asFocusEntry();
    entry.configure({ strategy: 'self', fallback: 'self' });
    def.expose.state('focused', focus.focused);
    def.expose.state('focusVisible', focus.focusVisible);
    def.expose.method('focus', (options: FocusRequestOptions) => {
      focus.focus(options);
    });
    def.expose.method('enter', (options: FocusRequestOptions) => {
      entry.focus(options);
    });
    def.expose.method('blur', () => {
      focus.blur();
    });
    def.expose.method('disable', (disabled: boolean) => {
      focus.setDisabled(disabled);
    });
    def.expose.method('disableEntry', (disabled: boolean) => {
      entry.setDisabled(disabled);
    });
    def.expose.method('navigation', (value: 'auto' | 'none') => {
      focus.setNavParticipation(value);
    });
    return (renderer) => renderer.el('button');
  },
});

export const TextTarget = definePrototype({
  name: 'ordinary-owned-entry-text-target',
  modules: [declareTextControl({ content: 'plain-text', lineMode: 'single', engine: 'host' })],
  setup(def) {
    asFocusable();
    const text = asTextControl();
    def.feedback.style.use(tw('w-40 h-10'));
    def.lifecycle.onCreated(() => {
      text.sync({ defaultValue: '', valueMode: 'uncontrolled' });
    });
    return (renderer) => renderer.el('input');
  },
});
