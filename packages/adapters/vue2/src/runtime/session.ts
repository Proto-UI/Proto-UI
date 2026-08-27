import { createAdapterHost, createHostWiring } from '@proto.ui/adapter-base';
import type { CommitSignal, RuntimeCheckpoint, RuntimeLifecycleEvent } from '@proto.ui/runtime';
import type { Prototype } from '@proto.ui/core';
import type { RawPropsSource } from '@proto.ui/module-props';
import type { PropsBaseType } from '@proto.ui/types';

export function createVue2HostSession<Props extends PropsBaseType>(args: {
  proto: Prototype<Props>;
  schedule: (task: () => void) => void;
  rawPropsSource: RawPropsSource<Props>;
  wiring: ReturnType<typeof createHostWiring>;
  eventGate: {
    disable(): void;
    dispose(): void;
  };
  router: {
    dispose(): void;
  };
  onLifecycleCheckpoint?: (cp: RuntimeCheckpoint) => void;
  onLifecycleEvent?: (event: RuntimeLifecycleEvent) => void;
  onCommit: (children: any, signal: CommitSignal | null) => void;
  onAfterUnmount?: () => void;
  initialMount?: 'eager' | 'manual';
}) {
  const {
    proto,
    schedule,
    rawPropsSource,
    wiring,
    eventGate,
    router,
    onLifecycleCheckpoint,
    onLifecycleEvent,
    onCommit,
    onAfterUnmount,
    initialMount,
  } = args;

  return createAdapterHost(
    proto,
    {
      getRawProps: () => rawPropsSource.get() as Readonly<Props & PropsBaseType>,
      schedule,
      onLifecycleCheckpoint,
      onLifecycleEvent,
      commit: (children, signal) => {
        eventGate.disable();
        onCommit(children, signal ?? null);
      },
    },
    {
      onRuntimeReady: (wiringApi) => {
        wiring.onRuntimeReady(wiringApi);
      },
      onUnmountBegin: () => {
        eventGate.disable();
      },
      afterUnmount: () => {
        wiring.afterUnmount();
        eventGate.dispose();
        router.dispose();
        onAfterUnmount?.();
      },
    },
    { initialMount }
  );
}
