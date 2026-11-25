/** Target identities shared by Node orchestration, portable tooling, and inventory consumers. */
export const COMPONENT_TARGETS = ['react', 'gpui'] as const;
export const COMPILATION_TARGETS = [...COMPONENT_TARGETS, 'kernel', 'ir'] as const;

export type ComponentTarget = (typeof COMPONENT_TARGETS)[number];
export type CompilationTarget = (typeof COMPILATION_TARGETS)[number];
