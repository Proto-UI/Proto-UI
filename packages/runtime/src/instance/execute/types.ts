import type { InstanceAssociations } from '@proto.ui/core';
// packages/runtime/src/instance/execute/types.ts
import { TemplateChildren } from '@proto.ui/core';
import { PropsBaseType } from '@proto.ui/types';
import { LifecycleRegistry } from '../../kernel/handles/def';
import { ModuleOrchestrator } from '../../orchestrator/module-orchestrator';
import type { Kernel } from '../../kernel';
import type { RuntimeSession } from '../session';

export interface ExecuteOptions {
  props?: any;
}

export interface ExecuteResult<P extends PropsBaseType> {
  children: TemplateChildren;
  lifecycle: LifecycleRegistry<P>;
  invoke(kind: keyof LifecycleRegistry<P>): void;
}

export interface RuntimeController {
  applyInstanceAssociations(input: InstanceAssociations): void;
  applyRawProps(nextRaw: Record<string, any>): void;

  update(): void; // render + commit (host only)

  /** v0: evaluate rule -> style tokens (props only for now) */
  getRuleStyleTokens(): string[];
}

/**
 * Host-based executor (used by adapters).
 */
export interface ExecuteWithHostResult {
  children: TemplateChildren;
  controller: RuntimeController;
  invokeUnmounted(): void | Promise<void>;

  /** expose module host for adapter caps injection (temporary but effective) */
  caps: ModuleOrchestrator;

  /** invoke a function inside the runtime callback scope (for adapter expose method wrapping) */
  invokeInCallbackScope(fn: () => void): void;

  /** underlying kernel reference so adapters can patch run handle extensions */
  kernel?: Kernel<any>;

  /** Repeatable lifecycle session underlying the legacy eager entry point. */
  session: RuntimeSession<any>;
}
