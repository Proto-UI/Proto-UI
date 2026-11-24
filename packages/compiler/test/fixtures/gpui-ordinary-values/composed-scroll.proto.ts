import { createAnatomyFamily, createContextKey, definePrototype, tw } from '@proto.ui/core';
import { asScrollSurface } from '@proto.ui/hooks';

// The names deliberately differ from ScrollArea's official parts. The host
// consumes this declared relationship, not a component or role-name protocol.
const scope = createContextKey<{ reader: boolean }>('native-composed-reader');
const anatomy = createAnatomyFamily('native-composed-reader', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    rail: { cardinality: { min: 0, max: 2 } },
    knob: { cardinality: { min: 0, max: 2 } },
  },
  relations: [
    { kind: 'contains', parent: 'root', child: 'rail' },
    { kind: 'contains', parent: 'rail', child: 'knob' },
  ],
});

export default definePrototype({
  name: 'native-composed-reader',
  setup(def) {
    def.context.provide(scope, { reader: true });
    def.anatomy.claim(anatomy, { role: 'root' });
    const scroll = asScrollSurface();
    scroll.configure({ axes: 'both', requireProjection: 'composed' });
    const chrome = {
      scope,
      anatomy,
      scrollbarRole: 'rail',
      thumbRole: 'knob',
      orientationExpose: 'direction',
    };
    scroll.bindComposedChrome(chrome);
    // The same setup binding is idempotent; a different binding is refused.
    scroll.bindComposedChrome(chrome);
    def.feedback.style.use(tw('relative w-64 h-40'));
    def.expose.method('snapshot', () => scroll.getSnapshot());
    def.expose.method('middle', () =>
      scroll.request({ kind: 'to', axis: 'vertical', position: 0.5 })
    );
    def.expose.method('horizontal', () => scroll.sync({ axes: 'horizontal' }));
    def.expose.method('vertical', () => scroll.sync({ axes: 'vertical' }));
    def.expose.method('both', () => scroll.sync({ axes: 'both' }));
    return (renderer) => renderer.slot();
  },
});
