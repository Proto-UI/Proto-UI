// packages/runtime/src/orchestrator/module-orchestrator/types.ts
import type {
  CapEntries,
  InstancePhase,
  ModuleFacade,
  ModuleInstance,
  ModuleScope,
  MountPhase,
  ProtoPhase,
} from '@proto.ui/core';
import type { CapsController } from '../caps';

/**
 * A module instance in runtime.
 */
export type AnyModule = ModuleInstance<ModuleFacade> & {
  name: string;
  scope: ModuleScope;
};

/**
 * Facade-only view for places that must NOT touch ports.
 * Kernel should only depend on this.
 */
export interface ModuleOrchestratorFacadeView {
  /** runtime -> handles (facades are safe, stable, public) */
  getFacades(): Record<string, ModuleFacade>;
}

/**
 * Privileged runtime-only view.
 * Instance may use this when it needs to bridge private runtime data into
 * author-facing setup helpers, but Kernel must not depend on it directly.
 */
export interface ModuleOrchestratorPrivilegedView extends ModuleOrchestratorFacadeView {
  getPorts(): Record<string, unknown>;
}

export interface ModuleOrchestrator extends ModuleOrchestratorPrivilegedView {
  /** runtime -> modules */
  setInstancePhase(phase: InstancePhase): void;
  setMountPhase(phase: MountPhase, epoch: number): void;
  setProtoPhase(phase: ProtoPhase): void;
  afterRenderCommit(): void;

  /** runtime -> ports (internal / privileged) */
  getPort<T>(moduleName: string): T | undefined;

  /** runtime -> adapter */
  getCapsController(moduleName: string): CapsController | undefined;

  /** adapter wiring API (flat) */
  getWiring(): ModuleWiring;

  /** lifecycle */
  dispose(): void;
}

export interface ModuleWiring {
  /**
   * Attach host caps for a module.
   * Returns true if attached, false if module not found.
   */
  attach(moduleName: string, entries: CapEntries): boolean;

  /**
   * Reset host caps for a module.
   * If moduleName is omitted, attempt to reset all modules, then rethrow the
   * first failure unchanged. A failing vault still stops its own listeners.
   */
  reset(moduleName?: string): void;
}
