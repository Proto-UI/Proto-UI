import { cap, type PrototypeModuleDeclaration } from '@proto.ui/core';
import type { ModuleDeps } from '@proto.ui/module-base';
import type { OwnedMaterialFrame } from './owned-slot';

export type MaterialBinding = {
  connect(): void;
  snapshot(): OwnedMaterialFrame;
  dispose(): void;
};
/** A framework Module implementation, not a host subscriber or author callback. */
export type MaterialBindingFactory = (
  declarations: readonly PrototypeModuleDeclaration[],
  deps: ModuleDeps,
  invalidate: () => void
) => MaterialBinding | null;
export const MATERIAL_BINDING_FACTORY_CAP = cap<MaterialBindingFactory>(
  '@proto.ui/feedback/experimental-material-runtime'
);
