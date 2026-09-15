import { expect, it } from 'vitest';
import {
  createAnatomyFamily,
  definePrototype,
  type CollectionHandles,
  type CollectionItemHandles,
  type Prototype,
  type RunHandle,
} from '@proto.ui/core';
import { asCollection, asCollectionItem } from '@proto.ui/hooks';
export type CollectionTree = { proto: Prototype; children?: CollectionTree[] };
export type CollectionMount = {
  host: HTMLElement;
  update(tree: CollectionTree[]): Promise<void>;
  flush(action?: () => void): Promise<void>;
  click(el: HTMLElement): Promise<void>;
  unmount(): Promise<void>;
};
export function collectionAdapterConformance(
  name: string,
  mount: (tree: CollectionTree[]) => Promise<CollectionMount>
) {
  it('T-COLLECTION-0002-CASE-ADAPTER: explicit item snapshots follow host insertion, removal, order and live metadata', async () => {
    const family = createAnatomyFamily('collection-' + name, {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        item: { cardinality: { min: 0, max: '*' } },
      },
    });
    const providers = new Map<string, CollectionHandles>(),
      items = new Map<string, CollectionItemHandles>(),
      runs = new Map<string, RunHandle<Record<string, unknown>>>();
    const root = (label: string) =>
      definePrototype({
        name: `collection-${name}-${label}`,
        setup(def) {
          const c = asCollection();
          expect(asCollection()).toBe(c);
          c.configure({ family, rootRole: 'root' });
          providers.set(label, c);
          def.lifecycle.onMounted((run) => runs.set(label, run));
          return (r) => [
            r.el(
              'span',
              `${label}=${c
                .getItems()
                .map((i) => i.id)
                .join(',')}`
            ),
            r.el('button', 'ordinary-host-child'),
            r.slot(),
          ];
        },
      });
    const item = (label: string) =>
      definePrototype({
        name: `collection-${name}-${label}`,
        setup(def) {
          const selected = def.state.bool('selected', false);
          const c = asCollectionItem();
          expect(asCollectionItem()).toBe(c);
          c.configure({
            family,
            getMeta: () => ({ id: label, selected: selected.get(), index: 999 }),
          });
          items.set(label, c);
          def.event.on('press.commit', () => selected.set(!selected.get()));
          return (r) => r.el('span', label);
        },
      });
    const outer = root('outer'),
      inner = root('inner');
    const members = new Map(['a', 'b', 'c', 'd'].map((id) => [id, item(id)]));
    const tree = (ids: string[]): CollectionTree[] => [
      {
        proto: outer,
        children: [
          ...ids.map((id) => ({ proto: members.get(id)! })),
          { proto: inner, children: [{ proto: members.get('c')! }] },
        ],
      },
    ];
    for (let generation = 0; generation < 2; generation++) {
      const view = await mount(tree(['b', 'a']));
      const assert = async (ids: string[]) => {
        await view.flush(() => runs.get('outer')!.update());
        expect(
          providers
            .get('outer')!
            .getItems()
            .map((i) => i.id)
        ).toEqual(ids);
        expect(providers.get('outer')!.count.get()).toBe(ids.length);
        expect(
          providers
            .get('inner')!
            .getItems()
            .map((i) => i.id)
        ).toEqual(['c']);
        expect(
          Array.from(view.host.querySelectorAll('span')).some(
            (s) => s.textContent === `outer=${ids.join(',')}`
          )
        ).toBe(true);
        ids.forEach((id, index) =>
          expect(items.get(id)!.getSnapshot()).toMatchObject({
            index,
            total: ids.length,
            first: index === 0,
            last: index === ids.length - 1,
          })
        );
      };
      try {
        await view.flush();
        await assert(['b', 'a']);
        await view.update(tree(['a', 'b']));
        await assert(['a', 'b']);
        await view.update(tree(['a', 'd', 'b']));
        await assert(['a', 'd', 'b']);
        await view.update(tree(['d', 'a']));
        await assert(['d', 'a']);
        expect(
          providers
            .get('outer')!
            .getItems()
            .every((i) => i.selected === false)
        ).toBe(true);
        const target = Array.from(view.host.querySelectorAll('span'))
          .find((s) => s.textContent === 'd')!
          .closest<HTMLElement>('[data-pui-root]')!;
        await view.click(target);
        await view.flush();
        expect(providers.get('outer')!.getItems()[0]).toMatchObject({
          id: 'd',
          selected: true,
          index: 0,
        });
        expect(items.get('d')!.getSnapshot()).toMatchObject({ selected: true, index: 0, total: 2 });
      } finally {
        await view.unmount();
      }
    }
  });
}
