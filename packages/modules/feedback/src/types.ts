import type { StyleHandle, ModuleInstance } from '@proto.ui/core';
import type { ModuleFacade, ModuleHooks, ModuleScope } from '@proto.ui/core';

export type FeedbackRuntimeStyleDisposer = (options?: { flush?: boolean }) => void;

export interface FeedbackFacade extends ModuleFacade {
  style: {
    /** setup-only */
    use: (...handles: StyleHandle[]) => () => void;

    /** runtime-only */
    patch: (...handles: StyleHandle[]) => void;

    /** runtime-only */
    suppress: (...handles: StyleHandle[]) => void;

    /** runtime-only */
    clearPatch: () => void;

    /** pure snapshot: allowed in any phase */
    exportMerged: () => StyleHandle;
  };
}

export type FeedbackPort = {
  /**
   * Runtime-only: apply merged style tokens directly.
   * Intended for rule execution or adapter-driven updates.
   */
  applyMergedStyle(handle: StyleHandle): void;

  /** Internal: record a rule-produced base style use (returns unUse). */
  useStyleRuntime: (...handles: StyleHandle[]) => FeedbackRuntimeStyleDisposer;

  /** Internal: replace a rule-produced style contribution with a single flush. */
  replaceStyleRuntime: (
    previous: FeedbackRuntimeStyleDisposer | null,
    ...handles: StyleHandle[]
  ) => FeedbackRuntimeStyleDisposer | null;

  /** Runtime-only public feedback.style patch surface. */
  patchStyle: (...handles: StyleHandle[]) => void;

  /** Runtime-only public feedback.style suppress surface. */
  suppressStyle: (...handles: StyleHandle[]) => void;

  /** Runtime-only public feedback.style patch reset surface. */
  clearStylePatch: () => void;

  /**
   * Internal: record style tokens without v0 token validation.
   * Intended for rule extensions that emit selector-based tokens.
   */
  useStyleUnsafe: (...handles: StyleHandle[]) => () => void;
};

/**
 * Optional internal hooks (runtime-facing).
 * If你不想暴露这些，就把它们留在实现文件里，不导出也行。
 */
export interface FeedbackInternalHooks extends ModuleHooks {
  /** called by runtime or host to try applying effects */
  flushIfPossible(): void;

  /** optional hook: structural commit replaced DOM */
  afterRenderCommit(): void;

  /** optional: runtime/adapter can call this after flush tick */
  onEffectsFlushed?(): void;
}

export type FeedbackModule = ModuleInstance<FeedbackFacade> & {
  name: 'feedback';
  scope: ModuleScope; // normally "instance"
};
