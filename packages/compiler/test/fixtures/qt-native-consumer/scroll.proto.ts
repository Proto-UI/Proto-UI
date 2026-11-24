import { definePrototype, tw } from '@proto.ui/core';
import { asScrollSurface } from '@proto.ui/hooks';
export default definePrototype({
  name: 'native-qt-scroll-consumer',
  setup(def) {
    def.props.define({ present: { type: 'boolean', default: true } });
    def.props.watch(['present'], (run, next) => run.lifecycle.setPresent(next.present));
    const scroll = asScrollSurface();
    scroll.configure({
      axes: 'vertical',
      projection: 'system',
      endFollow: { mode: 'while-at-end', axis: 'vertical' },
    });
    def.feedback.style.use(tw('w-60 h-50'));
    def.expose.method('snapshot', () => scroll.getSnapshot());
    def.expose.method('horizontal', () => scroll.sync({ axes: 'horizontal' }));
    def.expose.method('vertical', () => scroll.sync({ axes: 'vertical' }));
    def.expose.method('both', () => scroll.sync({ axes: 'both' }));
    def.expose.method('same', () => scroll.sync({}));
    const extra: { axes: 'horizontal'; projection: 'composed' } = {
      axes: 'horizontal',
      projection: 'composed',
    };
    def.expose.method('extra', () => scroll.sync(extra));
    def.expose.method('middle', () =>
      scroll.request({ kind: 'to', axis: 'vertical', position: 0.5 })
    );
    def.expose.method('relative', () =>
      scroll.request({ kind: 'by', axis: 'vertical', delta: 10 })
    );
    def.expose.method('pageBefore', () =>
      scroll.request({ kind: 'page', axis: 'vertical', direction: 'before' })
    );
    def.expose.method('quarter', () =>
      scroll.request({ kind: 'control-drag', axis: 'vertical', position: 0.25 })
    );
    def.expose.method('end', () => scroll.request({ kind: 'to-end', axis: 'vertical' }));
    def.expose.method('pause', () => scroll.pauseFollowing());
    return (r) => r.slot();
  },
});
