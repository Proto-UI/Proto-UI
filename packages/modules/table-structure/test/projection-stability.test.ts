import { afterEach, describe, expect, it } from 'vitest';
import { createA11ySemanticObjectRef, type AnatomyPartView } from '@proto.ui/core';
import type { A11yPort } from '@proto.ui/module-a11y';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import type { StateFacade, StatePort } from '@proto.ui/module-state';
import { TableStructureModuleImpl } from '../src/create';
import type { TablePartRole } from '../src/types';

const live: TableStructureModuleImpl[] = [];
afterEach(() => {
  for (const impl of live.splice(0).reverse()) impl.dispose();
});

function fixture() {
  const domain = {};
  const values = new Map<object, unknown>();
  const changes: unknown[] = [];
  const parts: AnatomyPartView[] = [];
  let orderReads = 0;
  const tokens = new Map<AnatomyPartView, object>();
  const targetNotifications: Array<() => void> = [];
  let rowToken: object;
  const create = (role: TablePartRole) => {
    const token = {};
    if (role === 'row') rowToken = token;
    const part = { role } as AnatomyPartView;
    parts.push(part);
    tokens.set(part, token);
    const ref = createA11ySemanticObjectRef();
    const relations = new Map<string, readonly unknown[]>();
    const impl = new TableStructureModuleImpl(
      { onChange: () => () => {} } as any,
      {
        resolveSelfInstance: () => token,
        resolveSelfRole: () => role,
        resolvePartInstance: (part: AnatomyPartView) => tokens.get(part),
        resolveAncestorInstance: (_family: unknown, part: AnatomyPartView) =>
          part.role === 'headerCell' || part.role === 'cell' ? rowToken : null,
        resolveDomainScope: () => domain,
        order: {
          parts: () => {
            orderReads++;
            return parts;
          },
        },
        subscribeOrder: () => () => {},
        subscribeTargets: (_family: unknown, notify: () => void) => {
          targetNotifications.push(notify);
          return () => targetNotifications.splice(targetNotifications.indexOf(notify), 1);
        },
      } as unknown as AnatomyPort,
      {
        getObjectRef: () => ref,
        setRelation: (key: string, spec: { target: readonly unknown[] }) => {
          const previous = relations.get(key);
          if (
            !previous ||
            previous.length !== spec.target.length ||
            previous.some((ref, index) => ref !== spec.target[index])
          )
            changes.push({ role, relation: key, targets: spec.target });
          relations.set(key, spec.target);
        },
      } as unknown as A11yPort,
      {
        set: (handle: object, value: unknown) => {
          if (!Object.is(values.get(handle), value)) changes.push({ role, value });
          values.set(handle, value);
        },
      } as unknown as StatePort,
      { string: () => ({}), numberDiscrete: () => ({}) } as unknown as StateFacade
    );
    live.push(impl);
    const handle = impl.facade.declare(role);
    return { impl, handle, relations, ref };
  };
  const root = create('root');
  const row = create('row');
  const header = create('headerCell');
  const cell = create('cell');
  header.handle.configure({ headerKey: 'column', headerKind: 'column' });
  cell.handle.configure({ headers: ['column'] });
  for (const { impl } of [root, row, header, cell]) impl.onMountPhase('mounted', 1);
  changes.length = 0;
  return {
    root,
    row,
    header,
    cell,
    values,
    changes,
    notifyTargets: () => targetNotifications.forEach((notify) => notify()),
    orderReads: () => orderReads,
  };
}

describe('Table projection continuity', () => {
  it('retains valid semantic facts when target notification leaves topology unchanged', () => {
    const { root, row, header, cell, values, changes, notifyTargets } = fixture();
    expect(root.handle.getSnapshot()?.valid).toBe(true);
    notifyTargets();
    // The synthetic host reports a target change with identical logical topology.
    // Observe portable State/relationship transitions, not elapsed wall time.
    expect(changes).toEqual([]);
    expect(values.get(root.handle.states.a11yRole)).toBe('table');
    expect(values.get(row.handle.states.a11yRole)).toBe('row');
    expect(values.get(header.handle.states.a11yRole)).toBe('columnheader');
    expect(values.get(cell.handle.states.a11yRole)).toBe('cell');
    expect(cell.relations.get('labelledBy')).toEqual([header.ref, cell.ref]);
  });

  it('still clears invalid topology and restores current facts after recovery', () => {
    const { root, row, header, cell, values } = fixture();
    cell.handle.configure({ headers: ['missing'] });
    expect(root.handle.getSnapshot()?.valid).toBe(false);
    for (const part of [root, row, header, cell]) {
      expect(values.get(part.handle.states.a11yRole)).toBe('');
    }
    expect(cell.relations.get('labelledBy')).toEqual([]);
    cell.handle.configure({ headers: ['column'], columnSpan: 2 });
    expect(root.handle.getSnapshot()).toMatchObject({ valid: true, columnCount: 3 });
    expect(values.get(cell.handle.states.columnSpan)).toBe(2);
    expect(cell.relations.get('labelledBy')).toEqual([header.ref, cell.ref]);
  });
  it('does not recompute stable membership on ordinary updated phases', () => {
    const current = fixture();
    const before = current.orderReads();
    for (const part of [current.root, current.row, current.header, current.cell]) {
      part.impl.onProtoPhase('updated');
    }
    expect(current.orderReads()).toBe(before);
    expect(current.changes).toEqual([]);
  });
});
