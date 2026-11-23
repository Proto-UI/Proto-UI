import { definePrototype, tw } from '@proto.ui/core';
import { asAccessible, asScrollSurface } from '@proto.ui/hooks';
import {
  asScrollAreaViewport,
  type ScrollAreaViewportExposes,
  type ScrollAreaViewportProps,
} from '@proto.ui/prototypes-base/scroll-area';

export interface DocumentationImageReadingViewportProps extends ScrollAreaViewportProps {
  a11yLabel?: string;
}

const DEFAULT_LABEL = 'Illustration reading viewport';

/** App presentation of the public ScrollArea Viewport, composed inside its
 * public Root. Base geometry owns sequential navigation; the native scroll
 * projection owns wheel and keyboard scrolling on the same surface lease. */
export default definePrototype<DocumentationImageReadingViewportProps, ScrollAreaViewportExposes>({
  name: 'docs-image-reading-viewport',
  modules: asScrollAreaViewport.modules,
  setup(def) {
    def.props.define({ a11yLabel: { type: 'string', empty: 'fallback' } });
    def.props.setDefaults({ a11yLabel: DEFAULT_LABEL });

    const inherited = asScrollAreaViewport();
    const state = inherited.stateHandles;
    if (!state) throw new Error('[docs-image-reading-viewport] Missing Base scroll facts.');
    asScrollSurface().configure({ projection: 'native' });

    const accessible = asAccessible();
    const label = def.state.string('readingViewportLabel', DEFAULT_LABEL);
    accessible.role('region');
    accessible.name(label);
    def.lifecycle.onCreated((run) => {
      label.set(run.props.get().a11yLabel ?? DEFAULT_LABEL, 'reading viewport label');
    });
    def.props.watch(['a11yLabel'], (_run, next) => {
      label.set(next.a11yLabel ?? DEFAULT_LABEL, 'reading viewport label');
    });

    def.feedback.style.use(tw('block min-h-0 min-w-0 h-full w-full outline-none'));
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('outline-2 outline-ring forced-colors-focus-outline')),
    });
    return inherited.render;
  },
});
