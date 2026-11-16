import { defineAsHook, definePrototype, type OwnedStateHandle } from '@proto.ui/core';

const install = defineAsHook<
  {},
  { write: (next: number) => void },
  { state: { value: OwnedStateHandle<number> } }
>({
  name: 'borrowed-notification-source',
  setup(def) {
    const value = def.state.numberDiscrete('value', 0);
    def.expose.method('write', (next: number) => value.set(next));
  },
});

export default definePrototype({
  name: 'borrowed-notification-consumer',
  setup(def) {
    const capture = install();
    const watched = capture.getState?.('value')!;
    const write = capture.getMethod?.('write') as (next: number) => void;
    let trace = '';
    watched.watch((_run, event) => {
      if (event.type === 'next') {
        trace = trace + 'a' + event.next + ',';
        if (event.next === 1) {
          write(2);
          throw 0;
        }
      }
    });
    watched.watch((_run, event) => {
      if (event.type === 'next') trace = trace + 'b' + event.next + ',';
    });
    def.expose.method('trace', () => trace);
    return (r) => r.el('div', []);
  },
});
