import { createControlLabelRef, type InstanceAssociations } from '@proto.ui/core';
import type { DemoAssociationKeys } from './demo-types';

/** One demo render instance owns this explicit data-key -> public reference lowering. */
export function createDemoAssociationScope() {
  const pairs = new Map<string, InstanceAssociations>();
  let disposed = false;
  return {
    resolve(keys: DemoAssociationKeys | undefined): InstanceAssociations | undefined {
      if (disposed) throw new Error('[Demo associations] render instance is disposed');
      if (!keys) return undefined;
      if (
        Object.keys(keys).some((key) => key !== 'controlLabel') ||
        typeof keys.controlLabel !== 'string' ||
        !keys.controlLabel.trim()
      )
        throw new TypeError('[Demo associations] expected one nonempty controlLabel key');
      let result = pairs.get(keys.controlLabel);
      if (!result) {
        result = Object.freeze({ controlLabel: createControlLabelRef() });
        pairs.set(keys.controlLabel, result);
      }
      return result;
    },
    dispose() {
      disposed = true;
      pairs.clear();
    },
  };
}
