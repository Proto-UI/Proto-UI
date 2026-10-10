import type { InstanceAssociations } from '@proto.ui/core';
// packages/runtime/src/instance/host.ts
import type { TemplateChildren } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import type { ModuleWiring } from '../orchestrator/module-orchestrator';
import type { RuntimeCheckpoint } from '../kernel/timeline';
import type { RuntimeLifecycleEvent } from '../kernel/lifecycle-events';

export type CommitSignal = {
  done(): void;
};

export type ScheduledDelayTask = {
  cancel(): void;
};

export interface RuntimeHost<P extends PropsBaseType> {
  /** For diagnostics / errors */
  readonly prototypeName: string;

  /**
   * Opts the host into presence intents driving repeatable RuntimeSession
   * mount epochs. Adapters enable this only after their view binding is
   * re-attachable.
   */
  readonly presenceLifecycle?: 'session';

  /** Commit HostRoot children to the host platform and call signal.done() at commit completion. */
  commit(children: TemplateChildren, signal?: CommitSignal): void;

  /** Scheduling hook (for microtask/macrotask decisions, adapter controls timing) */
  schedule(task: () => void): void;

  /**
   * Optional delay scheduling hook. Hosts may map this to platform timers,
   * frame-aware schedulers, or deterministic test clocks. It is required
   * only when code running in this host calls core `delay()`.
   */
  scheduleDelay?(durationMs: number, task: () => void): ScheduledDelayTask;

  /** Optional diagnostics hook for canonical lifecycle checkpoint traces. */
  /** @deprecated Use onLifecycleEvent. */
  onLifecycleCheckpoint?(cp: RuntimeCheckpoint): void;

  /** Optional diagnostics hook for repeatable, epoch-aware lifecycle events. */
  onLifecycleEvent?(event: RuntimeLifecycleEvent): void;

  /** host must provide raw props snapshot (may include undeclared keys) */
  getRawProps(): Readonly<P & PropsBaseType>;

  /** Explicit bounded association channel; excluded from raw and resolved Props. */
  getInstanceAssociations?(): InstanceAssociations;

  /**
   * CP1 hook: called after runtime binds to the host and initial raw props hydration is done,
   * but BEFORE `created` callbacks and BEFORE the first commit.
   *
   * Intended for adapter wiring (caps injection), e.g.:
   * - rawPropsSource
   * - effects ports
   * - platform refs
   */
  onRuntimeReady?(wiring: ModuleWiring): void;

  /**
   * CP8 hook: called when unmount begins, BEFORE `unmounted` callbacks run.
   *
   * Intended for making event systems ineffective, stopping observers, etc.
   * This must NOT dispose moduleHub.
   */
  onUnmountBegin?(): void;
}
