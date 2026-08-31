// src/components/PrototypePreviewer/runtimes/registry.ts
export type RuntimeId = 'wc' | 'react' | 'vue' | 'vue2';
/** Runtimes presented as supported adapters in public website surfaces. */
export const AdapterIds = ['wc', 'react', 'vue', 'vue2'] as const;
export type PublicRuntimeId = (typeof AdapterIds)[number];

/** Kept as a compatibility alias for internal validation surfaces. */
export const InternalAdapterIds = [...AdapterIds] as const satisfies readonly RuntimeId[];

export function isRuntimeId(value: unknown): value is RuntimeId {
  return typeof value === 'string' && (AdapterIds as readonly string[]).includes(value);
}

export function selectRuntimeIds(
  requested: readonly RuntimeId[] | undefined,
  permitted: readonly RuntimeId[] = AdapterIds
): RuntimeId[] {
  if (requested === undefined) return [...permitted];

  const supported = requested.filter((runtime) => permitted.includes(runtime));
  if (supported.length === 0) {
    throw new Error(
      `[PrototypePreviewer] none of the explicitly requested runtimes are permitted: ${requested.join(', ') || '(empty)'}`
    );
  }
  return supported;
}
export type RuntimeAPI = {
  id: RuntimeId;
  label: string;
  mount(
    host: HTMLElement,
    prototype: any,
    options?: { props?: Record<string, unknown> }
  ): Promise<void> | void;
  unmount(host: HTMLElement): Promise<void> | void;
};

export const runtimeLoaders: Record<RuntimeId, () => Promise<RuntimeAPI>> = {
  wc: async () => (await import('./wc-runtime')).runtime,
  react: async () => (await import('./react-runtime')).runtime,
  vue: async () => (await import('./vue-runtime')).runtime,
  vue2: async () => (await import('./vue2-runtime')).runtime,
};
