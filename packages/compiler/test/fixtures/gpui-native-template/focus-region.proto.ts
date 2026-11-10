import {
  definePrototype,
  type FocusRequestOptions,
  type FocusScopeActivationOptions,
} from '@proto.ui/core';
import { asFocusEntry, asFocusScope } from '@proto.ui/hooks';

// Current authored input. The historical composed.proto.ts is a separate immutable fixture.
export default definePrototype({
  name: 'ordinary-owned-entry-region',
  setup(def) {
    const scope = asFocusScope();
    const entry = asFocusEntry();
    scope.configure({
      entryFallback: 'entry',
      emptyPolicy: 'none',
      restore: 'none',
      trap: true,
      loop: true,
    });
    entry.configure({ strategy: 'descendant-first', fallback: 'self' });
    def.expose.state('active', scope.active);
    def.expose.state('hasFocused', scope.hasFocused);
    def.expose.method('activate', (options: FocusScopeActivationOptions) => {
      scope.activate(options);
    });
    def.expose.method('deactivate', (options: FocusRequestOptions) => {
      scope.deactivate(options);
    });
    def.expose.method('enter', (options: FocusRequestOptions) => {
      entry.focus(options);
    });
    def.expose.method('disableEntry', (disabled: boolean) => {
      entry.setDisabled(disabled);
    });
    return (renderer) => renderer.el('section', renderer.slot());
  },
});

export const ManualRegion = definePrototype({
  name: 'ordinary-configured-manual-region',
  setup(def) {
    const scope = asFocusScope();
    const entry = asFocusEntry();
    scope.configure({
      entryFallback: 'entry',
      entry: 'manual',
      emptyPolicy: 'container',
      restore: 'none',
    });
    entry.configure({ strategy: 'descendant-first', fallback: 'self' });
    def.expose.state('active', scope.active);
    def.expose.method('activate', (options: FocusScopeActivationOptions) => {
      scope.activate(options);
    });
    def.expose.method('deactivate', (options: FocusRequestOptions) => {
      scope.deactivate(options);
    });
    return (renderer) => renderer.el('section', renderer.slot());
  },
});

export const DefaultRegion = definePrototype({
  name: 'ordinary-default-entry-region',
  setup(def) {
    const scope = asFocusScope();
    const entry = asFocusEntry();
    scope.configure({ emptyPolicy: 'none', restore: 'none' });
    entry.configure({ strategy: 'descendant-first', fallback: 'self' });
    def.expose.state('active', scope.active);
    def.expose.method('activate', (options: FocusScopeActivationOptions) => {
      scope.activate(options);
    });
    def.expose.method('deactivate', (options: FocusRequestOptions) => {
      scope.deactivate(options);
    });
    return (renderer) => renderer.el('section', renderer.slot());
  },
});

export const ContainerRegion = definePrototype({
  name: 'ordinary-container-entry-region',
  setup(def) {
    const scope = asFocusScope();
    const entry = asFocusEntry();
    scope.configure({ entryFallback: 'entry', emptyPolicy: 'container', trap: true, loop: true });
    entry.configure({ strategy: 'descendant-first', fallback: 'self' });
    let reenter = false;
    let independentEntry = false;
    let closeOnActivate = false;
    scope.active.watch((_run, event) => {
      if (event.type !== 'next') return;
      if (event.next && closeOnActivate) {
        closeOnActivate = false;
        scope.deactivate();
      }
      if (!event.next && reenter) {
        reenter = false;
        scope.activate({ reason: 'keyboard', preventScroll: true });
      }
      if (!event.next && independentEntry) {
        independentEntry = false;
        entry.focus({ reason: 'pointer', preventScroll: true });
      }
    });
    def.expose.state('active', scope.active);
    def.expose.method('activate', (options: FocusScopeActivationOptions) => {
      scope.activate(options);
    });
    def.expose.method('deactivate', (options: FocusRequestOptions) => {
      scope.deactivate(options);
    });
    def.expose.method('enter', (options: FocusRequestOptions) => {
      entry.focus(options);
    });
    def.expose.method('disableEntry', (disabled: boolean) => {
      entry.setDisabled(disabled);
    });
    def.expose.method('armReentry', () => {
      reenter = true;
    });
    def.expose.method('armIndependentEntry', () => {
      independentEntry = true;
    });
    def.expose.method('armCloseOnActivate', () => {
      closeOnActivate = true;
    });
    return (renderer) => renderer.el('section', renderer.slot());
  },
});
