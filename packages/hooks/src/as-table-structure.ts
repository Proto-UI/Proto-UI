import type { PropsBaseType } from '@proto.ui/types';
import type {
  TablePartRole,
  TableStructureFacade,
  TableStructureHandle,
} from '@proto.ui/module-table-structure';
import { definePrivilegedAsHook } from './privileged';

export function asTableStructure<P extends PropsBaseType = PropsBaseType>(
  role: TablePartRole
): TableStructureHandle {
  return getTableStructure(role);
}

const getTableStructure = (role: TablePartRole): TableStructureHandle => {
  const getHandle = definePrivilegedAsHook<PropsBaseType, TableStructureHandle>({
    name: `asTableStructure:${role}`,
    setup: ({ facades }) => {
      const facade = facades['table-structure'] as TableStructureFacade | undefined;
      if (!facade) throw new Error('[AsHook] table-structure facade unavailable.');
      return facade.declare(role);
    },
  });
  return getHandle();
};
