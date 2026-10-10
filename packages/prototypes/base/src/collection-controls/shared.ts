import type { AnatomyFamily, AnatomyPartView, RunHandle } from '@proto.ui/core';

export function readPartState<T>(part: AnatomyPartView, key: string): T | undefined {
  const state = part.getExpose(key);
  return state && typeof state === 'object' && 'get' in state
    ? (state as { get(): T }).get()
    : undefined;
}

export function callOwner(
  run: RunHandle<any>,
  family: AnatomyFamily,
  method: string,
  ...args: unknown[]
): unknown {
  const action = run.anatomy.partsOf(family, 'root')[0]?.getExpose(method);
  return typeof action === 'function' ? action(...args) : false;
}
