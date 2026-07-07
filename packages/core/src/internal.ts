import type { AsHookRuntime } from './prototype';
import type { DefHandle } from './handles';

export type RuntimeDelayTask = {
  cancel(): void;
};

export type ActiveAsHookContext = Readonly<{
  def: DefHandle<any, any>;
  rt: AsHookRuntime;
  facades: Record<string, unknown>;
  ports: Record<string, unknown>;
}>;

export type ActiveRuntimeDelayContext = Readonly<{
  prototypeName: string;
  scheduleDelay(durationMs: number, callback: () => void): RuntimeDelayTask;
}>;

const activeAsHookContexts: ActiveAsHookContext[] = [];
const activeRuntimeDelayContexts: ActiveRuntimeDelayContext[] = [];
const asHookRuntimeByDef = new WeakMap<object, AsHookRuntime>();

export function enterActiveAsHookContext(ctx: ActiveAsHookContext): void {
  activeAsHookContexts.push(ctx);
}

export function exitActiveAsHookContext(): void {
  activeAsHookContexts.pop();
}

export function getActiveAsHookContext(name: string): ActiveAsHookContext {
  const ctx = activeAsHookContexts.at(-1);
  if (!ctx) {
    throw new Error(`[AsHook] no active setup context for ${name}.`);
  }
  return ctx;
}

export function enterActiveRuntimeDelayContext(ctx: ActiveRuntimeDelayContext): void {
  activeRuntimeDelayContexts.push(ctx);
}

export function exitActiveRuntimeDelayContext(): void {
  activeRuntimeDelayContexts.pop();
}

export function getActiveRuntimeDelayContext(): ActiveRuntimeDelayContext | undefined {
  return activeRuntimeDelayContexts.at(-1);
}

export function bindAsHookRuntime(def: object, runtime: AsHookRuntime): void {
  asHookRuntimeByDef.set(def, runtime);
}

export function getAsHookRuntime(def: object): AsHookRuntime | undefined {
  return asHookRuntimeByDef.get(def);
}
