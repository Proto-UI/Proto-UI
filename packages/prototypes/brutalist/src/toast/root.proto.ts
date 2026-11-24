import { definePrototype, tw } from '@proto.ui/core';
import {
  asToastRoot,
  type ToastRootProps as BaseToastRootProps,
  type ToastRootExposes,
} from '@proto.ui/prototypes-base/toast';

export type BrutalistToastType = 'default' | 'success' | 'info' | 'warning' | 'error' | 'loading';

export type ToastRootProps = BaseToastRootProps & {
  type?: BrutalistToastType;
};

const BRUTALIST_TOAST_TYPES: readonly BrutalistToastType[] = [
  'default',
  'success',
  'info',
  'warning',
  'error',
  'loading',
];

export default definePrototype<ToastRootProps, ToastRootExposes>({
  name: 'brutalist-toast-root',
  setup(def) {
    const behavior = asToastRoot();
    def.props.define({
      type: { type: 'enum', empty: 'fallback', options: [...BRUTALIST_TOAST_TYPES] },
    });
    def.props.setDefaults({ type: 'default' });
    // Passive grouping surface per design-contract.mdx: 5px rounded-base,
    // 2px border, DM Sans medium body, and static 3px foreground hard shadow.
    def.feedback.style.use(
      tw(
        'rounded-base border-2 border-foreground shadow-[3px_3px_0_0_var(--pui-foreground)] font-sans font-medium grid gap-2 min-w-0 w-full p-4 text-start'
      )
    );
    def.rule({
      when: (w) => w.prop('type').eq('default'),
      intent: (i) => i.feedback.style.use(tw('bg-background text-foreground')),
    });
    def.rule({
      when: (w) => w.prop('type').eq('success'),
      intent: (i) => i.feedback.style.use(tw('bg-mint text-mint-foreground')),
    });
    def.rule({
      when: (w) => w.prop('type').eq('info'),
      intent: (i) => i.feedback.style.use(tw('bg-sky text-sky-foreground')),
    });
    def.rule({
      when: (w) => w.prop('type').eq('warning'),
      intent: (i) => i.feedback.style.use(tw('bg-canary text-canary-foreground')),
    });
    def.rule({
      when: (w) => w.prop('type').eq('error'),
      intent: (i) => i.feedback.style.use(tw('bg-coral text-coral-foreground')),
    });
    def.rule({
      when: (w) => w.prop('type').eq('loading'),
      intent: (i) => i.feedback.style.use(tw('bg-lavender text-lavender-foreground')),
    });
    return behavior.render;
  },
});
