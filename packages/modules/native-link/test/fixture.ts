import { definePrototype, type NativeLinkNavigate, type RunHandle } from '@proto.ui/core';
import { asNativeLink } from '@proto.ui/hooks';
import { declareNativeLink } from '../src';

let next = 0;
export function linkFixture(
  options: { slot?: boolean; observe?: (event: NativeLinkNavigate) => void } = {}
) {
  return definePrototype({
    name: `x-native-link-fixture-${++next}`,
    modules: [declareNativeLink()],
    setup(def) {
      def.props.define({
        href: { type: 'string', default: '' },
        target: { type: 'string', default: '' },
        rel: { type: 'string', default: '' },
        disabled: { type: 'boolean', default: false },
      });
      const link = asNativeLink();
      let run!: RunHandle<any>;
      const sync = (next: RunHandle<any>) => {
        run = next;
        link.sync(next.props.get());
      };
      def.lifecycle.onCreated(sync);
      def.props.watch(['href', 'target', 'rel', 'disabled'], sync);
      link.on('navigate', (_run, event) => options.observe?.(event));
      def.expose('view', {
        hide: () => run.lifecycle.setPresent(false),
        show: () => run.lifecycle.setPresent(true),
      });
      return (renderer) => (options.slot ? renderer.slot() : 'Link text');
    },
  });
}
