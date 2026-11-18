import { definePrototype } from '@proto.ui/core';
import { asScrollSurface } from '@proto.ui/hooks';

export default definePrototype({
  name: 'state-validation-boundary',
  setup(def) {
    const scroll = asScrollSurface();
    scroll.configure({ axes: 'vertical', endFollow: { mode: 'while-at-end', axis: 'vertical' } });
    def.expose.method('scrollTo', () =>
      scroll.request({ kind: 'to', axis: 'vertical', position: 0.5 })
    );
    def.expose.method(
      'scrollToKind',
      () => scroll.request({ kind: 'to', axis: 'vertical', position: 0.5 }).kind
    );
    def.expose.method(
      'scrollBy',
      () => scroll.request({ kind: 'by', axis: 'vertical', delta: 10 }).kind
    );
    def.expose.method(
      'scrollPage',
      () => scroll.request({ kind: 'page', axis: 'vertical', direction: 'after' }).kind
    );
    def.expose.method(
      'scrollDrag',
      () => scroll.request({ kind: 'control-drag', axis: 'vertical', position: 0.25 }).kind
    );
    def.expose.method('scrollEnd', () => scroll.request({ kind: 'to-end', axis: 'vertical' }).kind);
    def.expose.method('scrollWrongAxis', () =>
      scroll.request({ kind: 'to', axis: 'horizontal', position: 0.5 })
    );
    def.expose.method('scrollEndWrongAxis', () =>
      scroll.request({ kind: 'to-end', axis: 'horizontal' })
    );
    const value = def.state.numberRange('value', 0, { min: 0, max: 1 });
    def.expose.method('attempt', () => {
      try {
        value.set(2);
        return false;
      } catch {
        return true;
      }
    });
    def.expose.method('invalid', () => value.set(2));
    def.expose.method('read', () => value.get());
    def.expose.method('valid', () => {
      value.set(1);
      return value.get();
    });
    return (r) => r.el('div', []);
  },
});

export const Retry = definePrototype({
  name: 'state-validation-retry',
  setup(def) {
    let rejected = false;
    try {
      def.state.numberRange('retry', 2, { min: 0, max: 1 });
    } catch {
      rejected = true;
    }
    const value = def.state.numberRange('retry', 0, { min: 0, max: 1 });
    def.expose.value('rejected', rejected);
    def.expose.state('value', value);
    return (r) => r.el('div', []);
  },
});
