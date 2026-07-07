// packages/runtime/src/instance/execute/callback-scope.ts
import type { PropsBaseType } from '@proto.ui/types';
import type { RunHandle } from '@proto.ui/core';
import {
  enterActiveRuntimeDelayContext,
  exitActiveRuntimeDelayContext,
  type ActiveRuntimeDelayContext,
} from '@proto.ui/core/internal';
import type { ExecPhase } from '@proto.ui/module-base';
import type { ModuleOrchestrator } from '../../orchestrator/module-orchestrator';
import type { PropsPort, PropsWatchTask } from '@proto.ui/module-props';

/**
 * Centralize callback-phase semantics:
 * - set exec phase to "callback"
 * - set/clear opaque callback ctx for SYS_CAP.getCallbackCtx()
 * - sync props from host (if available)
 * - dispatch props watch tasks
 *
 * This object intentionally does NOT know DefHandle / LifecycleRegistry.
 * It only manages callback context and pre-callback plumbing.
 */
export class CallbackScope<P extends PropsBaseType> {
  private delayContext: ActiveRuntimeDelayContext | undefined;

  constructor(
    private readonly getPhase: () => ExecPhase,
    private readonly setPhase: (p: ExecPhase) => void,
    private readonly moduleHub: ModuleOrchestrator
  ) {}

  setDelayContext(ctx: ActiveRuntimeDelayContext): void {
    this.delayContext = ctx;
  }

  private syncPropsFromHost() {
    const propsPort = this.moduleHub.getPort<PropsPort<P>>('props');
    propsPort?.syncFromHost?.();
  }

  private dispatchPropsTasks(ctx: RunHandle<P>) {
    const propsPort = this.moduleHub.getPort<PropsPort<P>>('props');
    const tasks = propsPort?.consumeTasks?.() ?? [];
    for (const t of tasks as PropsWatchTask<P>[]) {
      // ctx is run; module-props does not know what ctx is.
      t.cb(ctx as any, t.next as any, t.prev as any, t.info as any);
    }
  }

  /**
   * Run a callback block in "callback" phase with ctx set.
   * This guarantees cleanup even if callback throws.
   */
  run<T>(ctx: RunHandle<P>, fn: () => T): T {
    const prevPhase = this.getPhase();
    const prevCtx = (this.moduleHub as any).__getCallbackCtx?.();

    this.setPhase('callback');

    // Provide callback ctx for modules via SYS_CAP.getCallbackCtx()
    (this.moduleHub as any).__setCallbackCtx?.(ctx);
    if (this.delayContext) enterActiveRuntimeDelayContext(this.delayContext);

    try {
      this.syncPropsFromHost();
      this.dispatchPropsTasks(ctx);
      return fn();
    } finally {
      if (this.delayContext) exitActiveRuntimeDelayContext();
      (this.moduleHub as any).__setCallbackCtx?.(prevCtx);
      this.setPhase(prevPhase);
    }
  }

  /**
   * A light variant: do NOT sync from host.
   * Useful for applyRawProps-style flows where props were already applied
   * and we only want to dispatch watch tasks.
   */
  runNoSync<T>(ctx: RunHandle<P>, fn: () => T): T {
    const prevPhase = this.getPhase();
    const prevCtx = (this.moduleHub as any).__getCallbackCtx?.();

    this.setPhase('callback');
    (this.moduleHub as any).__setCallbackCtx?.(ctx);
    if (this.delayContext) enterActiveRuntimeDelayContext(this.delayContext);

    try {
      this.dispatchPropsTasks(ctx);
      return fn();
    } finally {
      if (this.delayContext) exitActiveRuntimeDelayContext();
      (this.moduleHub as any).__setCallbackCtx?.(prevCtx);
      this.setPhase(prevPhase);
    }
  }

  /**
   * Expose primitives when orchestrator needs finer control.
   */
  syncAndDispatch(ctx: RunHandle<P>) {
    this.syncPropsFromHost();
    this.dispatchPropsTasks(ctx);
  }
}
