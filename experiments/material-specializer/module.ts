import { declareModule, moduleDeclaration } from '@proto.ui/core';

/** Private, unadmitted experiment. Generic adapters do not acquire this capability. */
export const MATERIAL_EXPERIMENT_ID = 'experimental/material-owned-texture-v1';
export type OwnedMaterialConfig = Readonly<{
  version: 1;
  preset: 'liquidgl-owned-surface-v1';
  source: Readonly<{ kind: 'owned-texture'; slot: 'scene' }>;
  shape: Readonly<{ kind: 'rounded-rect'; radius: number }>;
  fallback: readonly [number, number, number, 1];
  bindings: Readonly<{ pressed: 'pressed'; disabled: 'disabled' }>;
}>;
const token = moduleDeclaration<OwnedMaterialConfig>(MATERIAL_EXPERIMENT_ID);
export function declareOwnedMaterial(config: OwnedMaterialConfig) {
  return declareModule(
    token,
    Object.freeze({
      ...config,
      source: Object.freeze({ ...config.source }),
      shape: Object.freeze({ ...config.shape }),
      fallback: Object.freeze([...config.fallback]) as OwnedMaterialConfig['fallback'],
      bindings: Object.freeze({ ...config.bindings }),
    })
  );
}
