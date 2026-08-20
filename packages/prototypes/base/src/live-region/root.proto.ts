import type { DefHandle, RenderFn } from '@proto.ui/core';
import { defineAsHook, definePrototype } from '@proto.ui/core';
import type {
  LiveRegionRootAsHookContract,
  LiveRegionRootExposes,
  LiveRegionRootProps,
} from './types';

export type {
  LiveRegionPoliteness,
  LiveRegionRootProps,
  LiveRegionRootExposes,
  LiveRegionRootStateHandles,
  LiveRegionRootAsHookContract,
} from './types';

function setupLiveRegionRoot(def: DefHandle<LiveRegionRootProps, LiveRegionRootExposes>): RenderFn {
  // P-BASE-LIVE-REGION-POLITENESS, P-BASE-LIVE-REGION-ATOMIC
  def.props.define({
    politeness: { type: 'enum', empty: 'fallback', options: ['polite', 'assertive'] },
    atomic: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({ politeness: 'polite', atomic: true });

  // P-BASE-LIVE-REGION-SEMANTICS
  const role = def.state.string('role', 'status');
  const live = def.state.string('live', 'polite');
  const atomic = def.state.bool('atomic', true);
  def.a11y.role(role);
  def.a11y.state('live', live);
  def.a11y.state('atomic', atomic);

  // P-BASE-LIVE-REGION-SEMANTICS, P-BASE-LIVE-REGION-DYNAMIC
  const sync = (props: Readonly<LiveRegionRootProps>) => {
    const nextPoliteness = props.politeness ?? 'polite';
    const nextAtomic = props.atomic ?? true;
    role.set(nextPoliteness === 'assertive' ? 'alert' : 'status', 'reason: live region role');
    live.set(nextPoliteness, 'reason: live region politeness');
    atomic.set(nextAtomic, 'reason: live region atomic');
  };
  def.lifecycle.onCreated((run) => sync(run.props.get()));
  def.props.watchAll((_run, next) => sync(next));
  // P-BASE-LIVE-REGION-CONTENT: authored descendants are the announcement payload.
  return (r) => r.slot();
}

// P-BASE-LIVE-REGION-NO-INTERACTION: no focus, event, or command channel.
export const asLiveRegionRoot = defineAsHook<
  LiveRegionRootProps,
  LiveRegionRootExposes,
  LiveRegionRootAsHookContract
>({ name: 'as-live-region-root', setup: setupLiveRegionRoot });

const liveRegionRoot = definePrototype({
  name: 'base-live-region-root',
  setup: setupLiveRegionRoot,
});
export default liveRegionRoot;
