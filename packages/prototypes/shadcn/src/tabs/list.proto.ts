import { definePrototype, tw } from '@proto.ui/core';
import { asTabsList } from '@proto.ui/prototypes-base/tabs';
import { setupShadcnStyleScope } from '../style-scope';
import { setupTabsVisual } from './visual';
import type { ShadcnTabsListExposes, ShadcnTabsListProps } from './types';
const tabsList = definePrototype<ShadcnTabsListProps, ShadcnTabsListExposes>({
  name: 'shadcn-tabs-list',
  setup(def) {
    def.props.define({
      appearance: { type: 'enum', options: ['default', 'underline'], empty: 'fallback' },
      variant: { type: 'enum', options: ['default', 'line'], empty: 'fallback' },
    });
    def.props.setDefaults({ appearance: 'default', variant: 'default' });
    asTabsList();
    setupShadcnStyleScope(def);
    const { style, orientation } = setupTabsVisual(def);
    const rejectUnsupportedVariant = (run: any) => {
      const variant = run.props.getRaw().variant;
      if (variant != null && variant !== 'default')
        throw new Error(
          '[shadcn-tabs-list] Unsupported upstream line variant: owned decorative feedback target is not implemented'
        );
    };
    def.props.watchRaw(['variant'], rejectUnsupportedVariant);
    def.lifecycle.onCreated(rejectUnsupportedVariant);
    def.rule({
      when: (w) => w.prop('appearance').eq('default'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground'
          )
        ),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(style).eq('rhea')),
      intent: (i) => i.feedback.style.use(tw('rounded-2xl')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.prop('variant').eq('default')),
      intent: (i) => i.feedback.style.use(tw('bg-muted')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(orientation).eq('horizontal')),
      intent: (i) => i.feedback.style.use(tw('h-8')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(orientation).eq('horizontal'),
          w.state(style).eq('new-york-v4')
        ),
      intent: (i) => i.feedback.style.use(tw('h-9')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(orientation).eq('vertical')),
      intent: (i) => i.feedback.style.use(tw('h-fit flex-col')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(orientation).eq('vertical'),
          w.state(style).eq('rhea')
        ),
      intent: (i) => i.feedback.style.use(tw('p-1')),
    });
    // Existing Proto underline is a separately named compatibility surface, not upstream line.
    def.rule({
      when: (w) => w.prop('appearance').eq('underline'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'flex w-full min-w-0 h-auto flex-nowrap items-center justify-start gap-6 overflow-x-auto border-0 rounded-none bg-transparent p-0 text-muted-foreground shadow-none'
          )
        ),
    });
  },
});
export default tabsList;
