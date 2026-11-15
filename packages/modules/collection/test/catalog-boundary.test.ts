import { expect, it, vi } from 'vitest';
import { CapsVault, SYS_CAP } from '@proto.ui/module-base';
import { createCollectionModule } from '../src/create';

it('T-COLLECTION-0002-CASE-MODULE: projects current Anatomy order and metadata without mutating source records', () => {
  let setup = true;
  const caps = new CapsVault();
  caps.attachBase([
    [
      SYS_CAP,
      {
        ensureSetup() {
          if (!setup) throw Error('setup only');
        },
      },
    ],
  ]);
  const metadata = Object.freeze({ id: 'a', index: 99, total: 99, first: false, last: false });
  const a = { getExpose: () => metadata },
    b = { getExpose: () => () => ({ id: 'b' }) };
  let parts = [a, b] as Array<{ getExpose: () => unknown }>;
  const aInstance = {},
    bInstance = {};
  const off = vi.fn(),
    subscribe = vi.fn(() => off);
  const anatomy = {
    order: { partsOf: vi.fn(() => parts), indexOfSelf: vi.fn(() => parts.indexOf(b)) },
    resolvePartInstance: (part: (typeof parts)[number]) => (part === b ? bInstance : aInstance),
    resolveSelfInstance: () => bInstance,
    subscribeOrder: subscribe,
  };
  const module = createCollectionModule({
    init: { prototypeName: 'collection-test', declarations: [] },
    caps,
    deps: { requirePort: () => anatomy } as any,
  });
  const provider = module.facade.getCollection(),
    item = module.facade.getCollectionItem();
  expect(provider.readItems()).toEqual([]);
  expect(item.readPosition()).toEqual({ index: -1, total: 0, first: false, last: false });
  const config = { family: {}, itemRole: 'item', itemMetaExposeKey: 'meta' };
  provider.configure(config);
  item.configure({ family: config.family, role: 'item' });
  config.itemRole = 'changed';
  setup = false;
  expect(() => provider.configure(config)).toThrow();
  expect(provider.readItems()).toEqual([
    { id: 'a', index: 0, total: 2, first: true, last: false },
    { id: 'b', index: 1, total: 2, first: false, last: true },
  ]);
  expect(metadata.index).toBe(99);
  expect(anatomy.order.partsOf).toHaveBeenLastCalledWith(config.family, 'item', {
    missing: 'empty',
  });
  parts = [b, a];
  expect(provider.readItems().map((p) => p.id)).toEqual(['b', 'a']);
  expect(item.buildSnapshot({ index: 22, id: 'b' })).toEqual({
    id: 'b',
    index: 0,
    total: 2,
    first: true,
    last: false,
  });
  expect(anatomy.order.indexOfSelf).not.toHaveBeenCalled();
  const cancel = provider.subscribe(() => {});
  cancel();
  expect(off).toHaveBeenCalledTimes(1);
  parts = [];
  expect(provider.readCount()).toBe(0);
  expect(item.readPosition()).toEqual({ index: -1, total: 0, first: false, last: false });
});
