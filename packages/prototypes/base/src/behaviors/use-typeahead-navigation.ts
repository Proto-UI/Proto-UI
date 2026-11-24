import { defineHook, delay, type DelayTask, type RunHandle } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';

export type TypeaheadNavigationOptions<P extends PropsBaseType, Entry> = {
  resetAfter?: number;
  isEnabled(run: RunHandle<P>): boolean;
  getEntries(run: RunHandle<P>): readonly Entry[];
  getCurrentIndex(run: RunHandle<P>, entries: readonly Entry[]): number;
  getText(entry: Entry): string;
  onMatch(run: RunHandle<P>, entry: Entry): void;
};

/**
 * Host-neutral printable-key typeahead for ordered interaction collections.
 * Collection membership, labels, current-item policy, and focus remain owned by
 * the consuming prototype or module.
 */
export const useTypeaheadNavigation = defineHook<any, {}, {}, TypeaheadNavigationOptions<any, any>>(
  {
    name: 'useTypeaheadNavigation',
    setup(def, options) {
      let buffer = '';
      let resetTask: DelayTask | null = null;

      const clear = () => {
        resetTask?.cancel();
        resetTask = null;
        buffer = '';
      };

      def.event.onGlobal('key.down', (run, ev) => {
        if (!options.isEnabled(run)) return;
        const detail = ev;
        const key = detail?.key;
        if (typeof key !== 'string' || key.length !== 1) return;
        if (detail?.ctrlKey || detail?.metaKey || detail?.altKey) return;

        const entries = options.getEntries(run);
        if (entries.length === 0) return;
        const currentIndex = Math.max(-1, options.getCurrentIndex(run, entries));
        const nextBuffer = `${buffer ?? ''}${key}`.toLowerCase();
        buffer = nextBuffer;
        resetTask?.cancel();
        resetTask = delay(options.resetAfter ?? 400, () => {
          buffer = '';
          resetTask = null;
        });

        const findMatch = (query: string) => {
          for (let step = 1; step <= entries.length; step++) {
            const entry = entries[(currentIndex + step) % entries.length]!;
            if (options.getText(entry).toLowerCase().startsWith(query)) return entry;
          }
          return null;
        };
        const match = findMatch(nextBuffer) ?? findMatch(key.toLowerCase());
        if (match) options.onMatch(run, match);
      });

      def.lifecycle.onUnmounted(clear);
    },
  }
);
