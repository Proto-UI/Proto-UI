import { definePrototype, tw } from '@proto.ui/core';
import {
  asImageRoot,
  type ImageRootProps,
  type ImageRootExposes,
} from '@proto.ui/prototypes-base/image';

export type Bootstrap232ImageRootProps = ImageRootProps & {
  /** Bootstrap 2.3.2 image trim only; never another image or Surface owner. */
  appearance?: 'default' | 'rounded' | 'polaroid' | 'circle';
};

export const imageRoot = definePrototype<Bootstrap232ImageRootProps, ImageRootExposes>({
  name: 'bootstrap-2-3-2-image-root',
  // Adapter target selection must receive the exact Base Image View declaration
  // before setup. The family neither renders an img nor duplicates its loader.
  modules: asImageRoot.modules,
  setup(def) {
    def.props.define({
      appearance: {
        type: 'enum',
        empty: 'fallback',
        options: ['default', 'rounded', 'polaroid', 'circle'],
      },
    });
    def.props.setDefaults({ appearance: 'default' });
    const behavior = asImageRoot();
    def.feedback.style.use(tw('max-w-full h-auto align-middle border-0'));
    // Pinned v2.3.2 less/scaffolding.less .img-* recipes. These are not
    // .thumbnail (a separate Surface composition) and install no interaction.
    def.rule({
      when: (w) => w.prop('appearance').eq('rounded'),
      intent: (i) => i.feedback.style.use(tw('rounded-[6px]')),
    });
    def.rule({
      when: (w) => w.prop('appearance').eq('polaroid'),
      intent: (i) =>
        i.feedback.style.use(
          tw('p-[4px] bg-white border border-[rgb(0_0_0/20%)] shadow-[0_1px_3px_rgb(0_0_0/10%)]')
        ),
    });
    def.rule({
      when: (w) => w.prop('appearance').eq('circle'),
      intent: (i) => i.feedback.style.use(tw('rounded-[500px]')),
    });
    return behavior.render;
  },
});

export default imageRoot;
