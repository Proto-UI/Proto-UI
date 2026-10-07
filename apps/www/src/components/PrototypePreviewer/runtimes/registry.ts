import type { RuntimeAPI, RuntimeId } from './ids';
// Executable loaders stay lazy; static identity consumers import ./ids directly.
export { AdapterIds, InternalAdapterIds, isRuntimeId, selectRuntimeIds } from './ids';
export type { RuntimeAPI, RuntimeId, PublicRuntimeId } from './ids';

export const runtimeLoaders: Record<RuntimeId, () => Promise<RuntimeAPI>> = {
  wc: async () => (await import('./wc-runtime')).runtime,
  react: async () => (await import('./react-runtime')).runtime,
  vue: async () => (await import('./vue-runtime')).runtime,
  vue2: async () => (await import('./vue2-runtime')).runtime,
};
