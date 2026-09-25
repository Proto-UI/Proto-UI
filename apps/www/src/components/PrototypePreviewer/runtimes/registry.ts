import type { RuntimeAPI, RuntimeId } from './ids';
// Demonstration Adapters stay lazy so React and Vue never enter the Website shell bundle.

export const runtimeLoaders: Record<RuntimeId, () => Promise<RuntimeAPI>> = {
  wc: async () => (await import('./wc-runtime')).runtime,
  react: async () => (await import('./react-runtime')).runtime,
  vue: async () => (await import('./vue-runtime')).runtime,
  vue2: async () => (await import('./vue2-runtime')).runtime,
};
