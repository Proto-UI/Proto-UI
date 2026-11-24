import { definePrototype } from '@proto.ui/core';
import { TABS_CONTEXT, TABS_FAMILY, type TabsContextValue } from '@proto.ui/prototypes-base/tabs';

function snapshot(value: string): TabsContextValue {
  return {
    value,
    activeValue: value,
    orientation: 'horizontal',
    activationMode: 'automatic',
    controlled: true,
    requestedValue: '',
    requestVersion: 0,
    validationVersion: 0,
  };
}

/** Independent provider for the real Tabs Content contract. This intentionally
 * makes no claim about Tabs Root's trigger discovery or selection algorithm. */
export default definePrototype<{ selected?: string }>({
  name: 'local-tabs-provider',
  setup(def) {
    def.anatomy.claim(TABS_FAMILY, { role: 'root' });
    def.props.define({ selected: { type: 'string', default: 'a' } });
    def.context.provide(TABS_CONTEXT, snapshot('a'));
    def.lifecycle.onCreated((run) => {
      run.context.update(TABS_CONTEXT, snapshot(run.props.get().selected ?? 'a'));
    });
    def.props.watch(['selected'], (run, next) => {
      run.context.update(TABS_CONTEXT, snapshot(next.selected ?? 'a'));
    });
    return (r) => r.el('section', r.slot());
  },
});
