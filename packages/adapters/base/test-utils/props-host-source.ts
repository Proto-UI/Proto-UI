import { definePrototype, type Prototype } from '@proto.ui/core';
import { describe, expect, it } from 'vitest';

export type AdapterPropsHostSourceMounted = {
  updateHostProps(nextProps: Record<string, unknown>): void | Promise<void>;
  syncRuntime(): void | Promise<void>;
  readRenderedValue(): string | null;
  unmount(): void | Promise<void>;
};

export type AdapterPropsHostSourceHarness = {
  adapterName: string;
  watchValuesAfterHostUpdate?: readonly unknown[];
  mount(
    proto: Prototype<any>,
    props: Record<string, unknown>
  ): AdapterPropsHostSourceMounted | Promise<AdapterPropsHostSourceMounted>;
};

export function describeAdapterPropsHostSourceConformance(harness: AdapterPropsHostSourceHarness) {
  describe(`${harness.adapterName}: Props host-source conformance`, () => {
    it('keeps invalidation separate from render and dispatches only at a runtime sync point', async () => {
      const watched: unknown[] = [];
      const proto = definePrototype<{ value: number }>({
        name: `${harness.adapterName}-props-host-source`,
        setup(def) {
          def.props.define({
            value: { type: 'number', default: 0 },
          });
          def.props.watch(['value'], (_run, next) => {
            watched.push(next.value);
          });

          return (renderer) => [renderer.el('span', String(renderer.read.props.get().value))];
        },
      });

      const mounted = await harness.mount(proto, { value: 1 });

      try {
        expect(mounted.readRenderedValue()).toBe('1');

        await mounted.updateHostProps({ value: 2 });

        expect(watched).toEqual(harness.watchValuesAfterHostUpdate ?? []);
        expect(mounted.readRenderedValue()).toBe('1');

        await mounted.syncRuntime();

        expect({ watched, rendered: mounted.readRenderedValue() }).toEqual({
          watched: [2],
          rendered: '2',
        });

        await mounted.updateHostProps({ value: 2 });
        await mounted.syncRuntime();

        expect(watched).toEqual([2]);
        expect(mounted.readRenderedValue()).toBe('2');
      } finally {
        await mounted.unmount();
      }
    });
  });
}
