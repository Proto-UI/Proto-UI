import { definePrototype, tw } from '@proto.ui/core';
export const RESIDENT_FIXTURE_TOKENS = [
  'block',
  'w-4',
  'h-4',
  'rounded-full',
  'translate-x-0',
  'translate-x-[calc(100%_-_2px)]',
  'bg-input',
  'bg-primary',
];
/** Repository-owned fixture shared by runtime and official browser evidence. */
export function createResidentMotionFixture(name: string) {
  return definePrototype<{ active?: boolean }, { readResolved: () => unknown }>({
    name,
    setup(def) {
      def.props.define({ active: { type: 'boolean', empty: 'fallback' } });
      def.props.setDefaults({ active: false });
      let resolved: unknown = {};
      def.lifecycle.onCreated((run) => {
        resolved = { ...run.props.get() };
      });
      def.props.watchRawAll((run) => {
        resolved = { ...run.props.get() };
      });
      def.expose.method('readResolved', () => resolved);
      def.feedback.style.use(tw('block w-4 h-4 rounded-full translate-x-0 bg-input'));
      def.feedback.style.transition({
        properties: ['translate', 'background-color'],
        durationMs: 400,
        easing: [0, 0, 1, 1],
      });
      def.rule({
        when: (w) => w.prop('active').eq(true),
        intent: (i) => i.feedback.style.use(tw('translate-x-[calc(100%_-_2px)] bg-primary')),
      });
    },
  });
}
