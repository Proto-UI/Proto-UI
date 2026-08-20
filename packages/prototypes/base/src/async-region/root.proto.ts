import type { DefHandle, RenderFn } from '@proto.ui/core';
import { defineAsHook, definePrototype } from '@proto.ui/core';
import type {
  AsyncRegionRootAsHookContract,
  AsyncRegionRootExposes,
  AsyncRegionRootProps,
} from './types';

export type {
  AsyncRegionRootProps,
  AsyncRegionRootExposes,
  AsyncRegionRootStateHandles,
  AsyncRegionRootAsHookContract,
} from './types';

function setupAsyncRegionRoot(
  def: DefHandle<AsyncRegionRootProps, AsyncRegionRootExposes>
): RenderFn {
  // P-BASE-ASYNC-REGION-BUSY
  def.props.define({
    busy: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({ busy: false });

  // P-BASE-ASYNC-REGION-BUSY
  const busy = def.state.bool('busy', false);
  def.expose.state('busy', busy);
  def.a11y.state('busy', busy);

  // P-BASE-ASYNC-REGION-BUSY, P-BASE-ASYNC-REGION-DYNAMIC
  const sync = (props: Readonly<AsyncRegionRootProps>) => {
    busy.set(props.busy ?? false, 'reason: async region busy');
  };
  def.lifecycle.onCreated((run) => sync(run.props.get()));
  def.props.watchAll((_run, next) => sync(next));
  // P-BASE-ASYNC-REGION-CONTENT: authored descendants and focus are preserved on prop-only transitions.
  return (r) => r.slot();
}

// P-BASE-ASYNC-REGION-NO-INTERACTION: no focus, event, command, or announcement channel.
export const asAsyncRegionRoot = defineAsHook<
  AsyncRegionRootProps,
  AsyncRegionRootExposes,
  AsyncRegionRootAsHookContract
>({ name: 'as-async-region-root', setup: setupAsyncRegionRoot });

const asyncRegionRoot = definePrototype({
  name: 'base-async-region-root',
  setup: setupAsyncRegionRoot,
});
export default asyncRegionRoot;
