import {
  declareModule,
  moduleDeclaration,
  type OwnedStateHandle,
  type PrototypeModuleDeclaration,
} from '@proto.ui/core';
import type { ModuleDeps } from '@proto.ui/module-base';

/** Private finite declaration shared by the source specializer and Feedback. */
export const OWNED_MATERIAL_ID = 'experimental/feedback-material-v1';
export type OwnedMaterialConfig = Readonly<{
  version: 1;
  material: Readonly<{ kind: 'refractive'; variant: 'regular' }>;
  sampling: Readonly<{ kind: 'owned-scene'; slot: 'scene' }>;
  shape: Readonly<{ kind: 'rounded-rect'; geometry: 'style' }>;
  fallback: Readonly<{
    fill: readonly [number, number, number, 1];
    foreground: 'style';
  }>;
  interaction: Readonly<{ kind: 'button-press' }>;
}>;
const token = moduleDeclaration<OwnedMaterialConfig>(OWNED_MATERIAL_ID);
export function assertOwnedMaterialConfig(value: unknown): asserts value is OwnedMaterialConfig {
  const keys = (v: unknown, expected: string[]): v is Record<string, any> =>
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    Object.keys(v).sort().join('|') === expected.sort().join('|');
  const opaque = (v: unknown) =>
    Array.isArray(v) &&
    v.length === 4 &&
    v[3] === 1 &&
    [0, 1, 2, 3].every(
      (i) =>
        Object.hasOwn(v, i) &&
        typeof v[i] === 'number' &&
        Number.isFinite(v[i]) &&
        v[i] >= 0 &&
        v[i] <= 1
    );
  if (
    !keys(value, ['version', 'material', 'sampling', 'shape', 'fallback', 'interaction']) ||
    value.version !== 1 ||
    !keys(value.material, ['kind', 'variant']) ||
    value.material.kind !== 'refractive' ||
    value.material.variant !== 'regular' ||
    !keys(value.sampling, ['kind', 'slot']) ||
    value.sampling.kind !== 'owned-scene' ||
    value.sampling.slot !== 'scene' ||
    !keys(value.shape, ['kind', 'geometry']) ||
    value.shape.kind !== 'rounded-rect' ||
    value.shape.geometry !== 'style' ||
    !keys(value.fallback, ['fill', 'foreground']) ||
    !opaque(value.fallback.fill) ||
    value.fallback.foreground !== 'style' ||
    !keys(value.interaction, ['kind']) ||
    value.interaction.kind !== 'button-press'
  )
    throw new Error('Invalid finite owned-material declaration');
}
export function declareMaterial(
  config: OwnedMaterialConfig
): PrototypeModuleDeclaration<OwnedMaterialConfig> {
  assertOwnedMaterialConfig(config);
  const copy = structuredClone(config);
  for (const value of Object.values(copy))
    if (value && typeof value === 'object') Object.freeze(value);
  Object.freeze(copy.fallback.fill);
  return declareModule(token, Object.freeze(copy));
}

export type OwnedMaterialFrame = Readonly<{
  config: OwnedMaterialConfig;
  pressed: boolean;
  disabled: boolean;
  bindingsReady: boolean;
}>;

type ExposePort = { get(key: string): unknown };
type StatePort = { watch(handle: OwnedStateHandle<boolean>, callback: () => void): () => void };

/** Feedback owns semantic observation; no Adapter/external subscriber reimplements Base state. */
export function createOwnedMaterialBinding(
  declarations: readonly PrototypeModuleDeclaration[],
  deps: ModuleDeps,
  invalidate: () => void
) {
  const found = declarations.filter((d) => d.id === OWNED_MATERIAL_ID);
  if (!found.length) return null;
  if (found.length !== 1) throw new Error('Only one experimental material slot is supported');
  assertOwnedMaterialConfig(found[0].config);
  const config = structuredClone(found[0].config) as OwnedMaterialConfig;
  const freeze = (value: unknown): void => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return;
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  };
  freeze(config);
  let handles: { pressed: OwnedStateHandle<boolean>; disabled: OwnedStateHandle<boolean> } | null =
    null;
  let disposed = false;
  const offs: Array<() => void> = [];
  return {
    connect() {
      if (disposed || handles) return;
      const exposed = deps.tryPort<ExposePort>('expose');
      const states = deps.tryPort<StatePort>('state');
      if (!exposed || !states) return;
      const pressed = exposed.get('pressed');
      const disabled = exposed.get('disabled');
      const valid = (v: unknown): v is OwnedStateHandle<boolean> =>
        !!v &&
        typeof v === 'object' &&
        '__stateId' in v &&
        typeof (v as unknown as OwnedStateHandle<boolean>).get === 'function' &&
        typeof (v as unknown as OwnedStateHandle<boolean>).get() === 'boolean';
      if (!valid(pressed) || !valid(disabled)) return;
      handles = { pressed, disabled };
      for (const handle of [pressed, disabled])
        offs.push(
          states.watch(handle, () => {
            if (disposed) return;
            try {
              invalidate();
            } catch (error) {
              // Host projection must not abort State's semantic fan-out before
              // Rule updates its retained style contribution. Feedback keeps
              // the failed projection retryable; report the original failure
              // after the current observer delivery rather than swallowing it.
              queueMicrotask(() => {
                throw error;
              });
            }
          })
        );
    },
    snapshot(): OwnedMaterialFrame {
      return Object.freeze({
        config,
        pressed: handles?.pressed.get() ?? false,
        disabled: handles?.disabled.get() ?? true,
        bindingsReady: handles !== null,
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const off of offs.splice(0)) off();
      handles = null;
    },
  };
}
