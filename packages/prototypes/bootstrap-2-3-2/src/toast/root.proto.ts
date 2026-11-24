import { definePrototype, tw } from '@proto.ui/core';
import {
  asToastRoot,
  type ToastRootProps as BaseToastRootProps,
  type ToastRootExposes,
} from '@proto.ui/prototypes-base/toast';

export type BootstrapToastVariant = 'default' | 'info' | 'success' | 'error';

export type ToastRootProps = BaseToastRootProps & {
  variant?: BootstrapToastVariant;
};

const BOOTSTRAP_TOAST_VARIANTS: readonly BootstrapToastVariant[] = [
  'default',
  'info',
  'success',
  'error',
];

export default definePrototype<ToastRootProps, ToastRootExposes>({
  name: 'bootstrap-2-3-2-toast-root',
  modules: asToastRoot.modules,
  setup(def) {
    const behavior = asToastRoot();
    def.props.define({
      variant: { type: 'enum', empty: 'fallback', options: [...BOOTSTRAP_TOAST_VARIANTS] },
    });
    def.props.setDefaults({ variant: 'default' });
    // Toast is a Proto extension, not a Bootstrap plugin. Preserve the pinned
    // .alert geometry and warning default while supporting info/success/error variants.
    def.feedback.style.use(
      tw(
        'min-w-0 w-full rounded-[4px] border pl-[14px] pr-[35px] py-[8px] font-sans text-[14px] leading-[20px] shadow-[0_1px_3px_rgb(0_0_0/10%)] text-start'
      )
    );
    def.rule({
      when: (w) => w.prop('variant').eq('default'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'border-[#fbeed5] bg-[#fcf8e3] text-paint-[#c09853_0_1px_0_rgb(255_255_255/50%)]'
          )
        ),
    });
    def.rule({
      when: (w) => w.prop('variant').eq('info'),
      intent: (i) => i.feedback.style.use(tw('border-[#ccc] bg-[#d9edf7] text-[#005580]')),
    });
    def.rule({
      when: (w) => w.prop('variant').eq('success'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_rgb(0_0_0/25%)_rgb(0_0_0/10%)] bg-[#5bb75b_linear-gradient(#62c462,#51a351)_0_0_repeat-x] text-paint-[#fff_0_-1px_0_rgb(0_0_0/25%)]'
          )
        ),
    });
    def.rule({
      when: (w) => w.prop('variant').eq('error'),
      intent: (i) =>
        i.feedback.style.use(tw('border-[#953b39] bg-destructive/15 text-[#953b39]')),
    });
    return behavior.render;
  },
});
