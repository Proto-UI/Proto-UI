import type { FieldsetRootProps, FieldsetRootExposes } from '@proto.ui/prototypes-base/fieldset';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { asFieldsetRoot, FIELDSET_CONTEXT } from '@proto.ui/prototypes-base/fieldset';

export default definePrototype<FieldsetRootProps, FieldsetRootExposes>({
  name: 'liquid-glass-fieldset-root',
  modules: asFieldsetRoot.modules,
  setup(def) {
    const inherited = asFieldsetRoot();
    const nested = def.state.bool('nested', false);
    const syncNested = (run: RunHandle<FieldsetRootProps>) => {
      nested.set(
        Boolean(run.context.tryReadAncestor(FIELDSET_CONTEXT)),
        'reason: liquid-glass fieldset concentric nesting'
      );
    };
    def.lifecycle.onCreated(syncNested);
    def.lifecycle.onMounted(syncNested);

    def.feedback.style.use(
      tw('flex w-full min-w-0 flex-col gap-3 border border-border text-foreground')
    );
    def.rule({
      when: (w) => w.state(nested).eq(false),
      intent: (i) => i.feedback.style.use(tw('rounded-2xl bg-secondary p-4')),
    });
    def.rule({
      when: (w) => w.state(nested).eq(true),
      intent: (i) => i.feedback.style.use(tw('rounded-xl bg-background p-3')),
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-not-allowed')),
    });
    return inherited.render;
  },
});
