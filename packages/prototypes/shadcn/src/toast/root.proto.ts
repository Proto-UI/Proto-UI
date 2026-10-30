import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { asToastRoot, type ToastRootExposes } from '@proto.ui/prototypes-base/toast';
import type { ToastRootProps } from './types';
import { SHADCN_STYLE_IDS, SHADCN_STYLE_SCOPE, setupShadcnStyleScope } from '../style-scope';
import { TOAST_RADIUS } from './recipes';

export default definePrototype<ToastRootProps, ToastRootExposes>({
  name: 'shadcn-toast-root',
  setup(def) {
    const behavior = asToastRoot();
    setupShadcnStyleScope(def);
    // As in the existing Card scope owner, observe the already resolved scope;
    // do not declare a second choice/default resolver on the same Root.
    const style = def.state.enum('toastResolvedStyle', 'new-york-v4', {
      options: SHADCN_STYLE_IDS,
    });
    const selected = def.state.bool('toastHasStyleSelection', false);
    const sync = (run: RunHandle<ToastRootProps>) => {
      const next = run.context.tryRead(SHADCN_STYLE_SCOPE)?.style ?? null;
      style.set(next ?? 'new-york-v4', 'reason: observe Toast style scope');
      selected.set(next !== null, 'reason: observe Toast style selection presence');
    };
    def.context.trySubscribe(SHADCN_STYLE_SCOPE, sync);
    def.lifecycle.onCreated(sync);
    def.lifecycle.onMounted(sync);
    def.lifecycle.onUpdated(sync);
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.all(w.state(selected).eq(true), w.state(style).eq(profile)),
        intent: (i) => i.feedback.style.use(TOAST_RADIUS[profile]),
      });
    }
    def.rule({
      when: (w) => w.state(selected).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-popover text-popover-foreground')),
    });
    // The previously unpinned Proto Toast remains the compatibility fallback;
    // it is not presented as the separately selected New York Sonner recipe.
    def.rule({
      when: (w) => w.state(selected).eq(false),
      intent: (i) => i.feedback.style.use(tw('rounded-md bg-background text-foreground')),
    });
    // Structural layout is an existing Proto projection, not Sonner queue geometry.
    def.feedback.style.use(tw('border border-border shadow-sm grid gap-2 min-w-0 w-full p-4'));
  },
});
