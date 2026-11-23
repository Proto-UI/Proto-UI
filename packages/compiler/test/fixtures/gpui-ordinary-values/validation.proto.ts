import { definePrototype, type RunHandle } from '@proto.ui/core';
import { asScrollSurface } from '@proto.ui/hooks';

type Props = { value: number; notificationPhase: string; notificationRevision: number };

export default definePrototype<Props>({
  name: 'state-validation-boundary',
  setup(def) {
    def.props.define({
      value: { type: 'number', default: 0 },
      notificationPhase: { type: 'string', default: 'none' },
      notificationRevision: { type: 'number', default: 0 },
    });
    let current: RunHandle<Props> | null = null;
    def.lifecycle.onCreated((run) => { current = run; });
    def.expose.event('renderRequest', { payload: 'json' });
    def.props.watch(['notificationRevision'], (run) => { run.update(); });
    def.lifecycle.onMounted((run) => {
      if (run.props.get().notificationPhase !== 'mounted') return;
      run.expose.emit('renderRequest', { phase: 'mounted' });
      throw false;
    });
    def.lifecycle.onMounted((run) => {
      if (run.props.get().notificationPhase === 'mounted') {
        run.expose.emit('renderRequest', { phase: 'after-failed-mounted' });
      }
    });
    def.lifecycle.onUpdated((run) => {
      if (run.props.get().notificationPhase !== 'updated') return;
      run.expose.emit('renderRequest', { phase: 'updated' });
      throw false;
    });
    def.lifecycle.onUpdated((run) => {
      if (run.props.get().notificationPhase === 'updated') {
        run.expose.emit('renderRequest', { phase: 'after-failed-updated' });
      }
    });
    def.expose.method('emitOnly', (value: number) => {
      if (current) current.expose.emit('renderRequest', { value });
    });
    def.props.watch(['value'], (run, next) => {
      run.expose.emit('renderRequest', { value: next.value });
      if (next.value === 13) throw false;
    });
    def.expose.method('emitThenThrow', () => {
      if (current) current.expose.emit('renderRequest', { value: 21 });
      throw 0;
    });
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
    def.expose.method('scrollAxesHorizontal', () => scroll.sync({ axes: 'horizontal' }));
    def.expose.method('scrollAxesVertical', () => scroll.sync({ axes: 'vertical' }));
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
