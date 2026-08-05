import type { PrototypeModuleDeclaration } from '../prototype';

// packages/core/src/module/types.ts
export type ModuleScope = 'instance' | 'host' | 'singleton';

export type InstancePhase = 'setup' | 'alive' | 'disposing' | 'disposed';

export type MountPhase = 'detached' | 'mounting' | 'mounted' | 'unmounting';

/**
 * @deprecated Use InstancePhase and MountPhase. ProtoPhase conflates a
 * repeatable host-view lifecycle with terminal instance disposal.
 */
export type ProtoPhase = 'setup' | 'mounted' | 'updated' | 'unmounted';

export type ModuleInit = {
  prototypeName: string;
  debugLabel?: string;
  declarations: readonly PrototypeModuleDeclaration[];
};

export interface ModuleFacade {
  // intentionally empty; modules define their own facade types
}

export interface ModulePort {
  // intentionally empty; modules define their own port types
}

export interface ModuleInstance<F extends ModuleFacade> {
  readonly name: string;
  readonly scope: ModuleScope;
  readonly facade: F;
  readonly hooks: ModuleHooks;
}

export interface ModuleHooks {
  onInstancePhase?(phase: InstancePhase): void;
  onMountPhase?(phase: MountPhase, epoch: number): void;
  onProtoPhase?(phase: ProtoPhase): void;
  afterRenderCommit?(): void;
  dispose?(): void;
}
