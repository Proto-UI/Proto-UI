import { expect, it, vi } from 'vitest';
import { commitChildren } from '../src/commit';
import {
  MaterialPaintReservationRegistry,
  prepareMaterialPaintReservationPart,
} from '@proto.ui/module-feedback';

it('keeps the committed reservation when a later valid node fails during WC staging', () => {
  const root = document.createElement('div');
  const existing = document.createElement('button');
  root.append(existing);
  document.body.append(root);
  const family = {
    __brand: 'AnatomyFamily',
    decl: { roles: { root: {}, heading: {}, trigger: {} } },
  } as any;
  const self = {};
  const part = { role: 'trigger' };
  const anatomy = {
    subscribeOrder: () => () => {},
    subscribeTargets: () => () => {},
    resolveSelfInstance: () => self,
    resolveSelfRole: () => 'heading',
    parts: () => [part],
    isCurrentPart: () => true,
    resolveAncestorInstance: () => self,
    resolvePartTarget: () => existing,
  } as any;
  const registry = new MaterialPaintReservationRegistry(() => anatomy);
  const reservation = registry.declare({ family, targetRole: 'trigger' });
  let committedLeaseLive = false;
  let committedDisconnects = 0;
  prepareMaterialPaintReservationPart(reservation)({
    connect() {
      committedLeaseLive = true;
      return () => {
        committedLeaseLive = false;
        committedDisconnects++;
      };
    },
  });
  registry.setActive(true);
  const create = document.createElement.bind(document);
  const creation = vi.spyOn(document, 'createElement').mockImplementation(((
    name: string,
    options?: any
  ) => {
    if (name === 'span') throw new Error('injected later host creation failure');
    return create(name, options);
  }) as any);
  try {
    expect(() =>
      commitChildren(root, [
        { type: { kind: 'paint-reservation', target: reservation }, children: null },
        { type: 'span' },
      ])
    ).toThrow('injected later host creation failure');
    expect(root.firstChild).toBe(existing);
    expect(existing.isConnected).toBe(true);
    expect(
      committedLeaseLive,
      'Staging an uncommitted reservation must not revoke the visible committed lease'
    ).toBe(true);
    expect(committedDisconnects).toBe(0);
  } finally {
    creation.mockRestore();
    registry.dispose();
    root.remove();
  }
});
