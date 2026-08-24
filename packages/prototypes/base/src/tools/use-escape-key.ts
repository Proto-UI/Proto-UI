import { defineHook } from '@proto.ui/core';
import type { RunHandle } from '@proto.ui/core';

export type EscapeKeyOptions = {
  enabled?: boolean;
  onEscape?: (run: RunHandle<any>, event?: any) => void;
};

export const useEscapeKey = defineHook<
  any,
  Record<string, never>,
  {},
  EscapeKeyOptions | undefined
>({
  name: 'useEscapeKey',
  mode: 'configurable',
  setup(def, options, api) {
    api.store.enabled = options?.enabled ?? true;
    api.store.onEscape = options?.onEscape;

    def.event.onGlobal('key.down', (run, ev) => {
      if (api.store.enabled === false) return;
      const key = ev?.key;
      if (key !== 'Escape') return;

      const onEscape = api.store.onEscape as
        | ((run: RunHandle<any>, event?: any) => void)
        | undefined;
      onEscape?.(run as RunHandle<any>, ev);
    });
  },
  configure(api, options) {
    if (typeof options?.enabled !== 'undefined') {
      api.store.enabled = options.enabled;
    }
    if (typeof options?.onEscape !== 'undefined') {
      api.store.onEscape = options.onEscape;
    }
  },
});
