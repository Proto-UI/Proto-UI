import { definePrototype, tw } from '@proto.ui/core';
import { asScrollSurface } from '@proto.ui/hooks';

export default definePrototype({
  name: 'external-native-scroll',
  setup(def) {
    const scroll = asScrollSurface();
    scroll.configure({ axes: 'vertical', projection: 'system' });
    def.expose.method('snapshot', () => scroll.getSnapshot());
    def.expose.method('middle', () =>
      scroll.request({ kind: 'to', axis: 'vertical', position: 0.5 })
    );
    def.expose.method('end', () => scroll.request({ kind: 'to-end', axis: 'vertical' }));
    def.expose.method('horizontal', () => scroll.sync({ axes: 'horizontal' }));
    def.expose.method('vertical', () => scroll.sync({ axes: 'vertical' }));
    def.expose.method('sameAxis', () => scroll.sync({}));
    const extra: { axes: 'horizontal'; projection: 'composed' } = {
      axes: 'horizontal',
      projection: 'composed',
    };
    def.expose.method('extraFields', () => scroll.sync(extra));
    def.feedback.style.use(tw('w-full h-full min-h-0'));
    return (r) => r.slot();
  },
});
