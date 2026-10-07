import { defineHook } from '@proto.ui/core';
import type { ExposeMethod, ExposeState, RunHandle, State } from '@proto.ui/core';

export type OpenStateOptions = {
  prop?: string;
  defaultProp?: string;
  disabledProp?: string;
  stateKey?: string;
  exposeStateKey?: string;
  exposeOpenMethodKey?: string;
  exposeCloseMethodKey?: string;
  exposeToggleMethodKey?: string;
  requestOpen?: (run: RunHandle<any>, nextOpen: boolean, reason: string) => void;
};

export type OpenStateExposes = {
  open: ExposeState<boolean>;
  openDropdown: ExposeMethod<(reason?: string) => void>;
  close: ExposeMethod<(reason?: string) => void>;
  toggle: ExposeMethod<(reason?: string) => void>;
};

export type OpenStateHandles = {
  open: State<boolean>;
};

export const useOpenState = defineHook<
  any,
  OpenStateExposes,
  OpenStateHandles,
  OpenStateOptions | undefined
>({
  name: 'useOpenState',
  mode: 'configurable',
  setup(def, options, api) {
    const prop = options?.prop ?? 'open';
    const defaultProp = options?.defaultProp ?? 'defaultOpen';
    const disabledProp = options?.disabledProp ?? 'disabled';
    const stateKey = options?.stateKey ?? 'open';
    const exposeStateKey = options?.exposeStateKey ?? 'open';
    const exposeOpenMethodKey = options?.exposeOpenMethodKey ?? 'openDropdown';
    const exposeCloseMethodKey = options?.exposeCloseMethodKey ?? 'close';
    const exposeToggleMethodKey = options?.exposeToggleMethodKey ?? 'toggle';

    def.props.define({
      [prop]: { type: 'boolean', empty: 'fallback' },
      [defaultProp]: { type: 'boolean', empty: 'fallback' },
      [disabledProp]: { type: 'boolean', empty: 'fallback' },
    } as any);
    def.props.setDefaults({
      [defaultProp]: false,
      [disabledProp]: false,
    } as any);

    const open = def.state.bool(stateKey, false);
    api.store.prop = prop;
    api.store.defaultProp = defaultProp;
    api.store.disabledProp = disabledProp;
    api.store.open = open;
    api.store.controlled = false;
    api.store.disabled = false;

    const syncFromProps = (run: RunHandle<any>) => {
      const controlled = run.props.isProvided(prop as any);
      api.store.controlled = controlled;
      api.store.disabled = !!run.props.get()[disabledProp as any];
      const nextOpen = controlled
        ? !!run.props.get()[prop as any]
        : !!run.props.get()[defaultProp as any];
      open.set(nextOpen, 'reason: useOpenState.syncFromProps => initialize');
    };

    const syncControlled = (run: RunHandle<any>, nextOpen: boolean) => {
      api.store.controlled = run.props.isProvided(prop as any);
      api.store.disabled = !!run.props.get()[disabledProp as any];
      if (!api.store.controlled) return;
      open.set(nextOpen, 'reason: useOpenState.syncControlled => controlled sync');
    };

    const setOpen = (next: boolean, reason?: string) => {
      open.set(next, reason ?? 'reason: useOpenState.setOpen');
    };

    const requestOpen = (next: boolean, reason: string) => {
      const run = api.store.run as RunHandle<any> | undefined;
      if (options?.requestOpen && run) {
        options.requestOpen(run, next, reason);
        return;
      }
      setOpen(next, reason);
    };

    api.store.syncFromProps = syncFromProps;
    api.store.syncControlled = syncControlled;
    api.store.setOpen = setOpen;

    def.expose.state(exposeStateKey as keyof OpenStateExposes & string, open);
    def.expose.method(exposeOpenMethodKey as keyof OpenStateExposes & string, (reason?: string) => {
      requestOpen(true, reason ?? 'reason: useOpenState.openNow');
    });
    def.expose.method(
      exposeCloseMethodKey as keyof OpenStateExposes & string,
      (reason?: string) => {
        requestOpen(false, reason ?? 'reason: useOpenState.close');
      }
    );
    def.expose.method(
      exposeToggleMethodKey as keyof OpenStateExposes & string,
      (reason?: string) => {
        requestOpen(!open.get(), reason ?? 'reason: useOpenState.toggle');
      }
    );

    def.lifecycle.onCreated((run) => {
      api.store.run = run;
      syncFromProps(run);
    });

    def.lifecycle.onMounted((run) => {
      api.store.run = run;
    });

    def.lifecycle.onBeforeDispose(() => {
      api.store.run = undefined;
    });

    def.props.watch([prop as any, disabledProp as any], (run, next) => {
      syncControlled(run, !!(next as Record<string, unknown>)[prop]);
      api.store.disabled = !!(next as Record<string, unknown>)[disabledProp];
    });
  },
});
