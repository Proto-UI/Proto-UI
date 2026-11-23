// @vitest-environment node
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import { nativeMetaArtifact, nativeMetaSubscriptionArtifact } from '../src/native-async';
import { nativeRuleMetaArtifact } from '../src/native-rule-meta';

function moduleUrl(contents: string) {
  const code = ts.transpileModule(contents, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}
async function load() {
  const source = nativeRuleMetaArtifact.contents
    .replace("'./web-snapshot-v1'", JSON.stringify(moduleUrl(nativeMetaArtifact.contents)))
    .replace(
      "'./subscription-v1'",
      JSON.stringify(moduleUrl(nativeMetaSubscriptionArtifact.contents))
    );
  return import(/* @vite-ignore */ moduleUrl(source));
}
function capture(action: () => void) {
  try {
    action();
    return { failed: false };
  } catch (error) {
    return { failed: true, error };
  }
}
function environment(width = 900) {
  const listeners = new Set<() => void>();
  let onAdd: (() => void) | undefined, onRemove: (() => void) | undefined;
  const view = {
    innerWidth: width,
    addEventListener(_type: string, callback: () => void) {
      listeners.add(callback);
      onAdd?.();
    },
    removeEventListener(_type: string, callback: () => void) {
      listeners.delete(callback);
      onRemove?.();
    },
  };
  const doc = {
    defaultView: view,
    documentElement: { dataset: {}, classList: { contains: () => false } },
  };
  return {
    doc,
    view,
    listeners,
    onAdd(callback?: () => void) {
      onAdd = callback;
    },
    onRemove(callback?: () => void) {
      onRemove = callback;
    },
  };
}

it('releases the old document and lease before a throwing removal and resubscribes to the same document', async () => {
  const { createNativeRuleMeta } = await load(),
    host = environment();
  const reader = createNativeRuleMeta(() => host.doc, ['viewport.width']);
  const oldNotify = vi.fn(),
    freshNotify = vi.fn();
  const release = reader.subscribe(oldNotify, ['viewport.width']);
  const stale = [...host.listeners];
  expect(reader.read('viewport.width')).toBe(900);
  host.onRemove(() => {
    throw undefined;
  });
  expect(capture(release)).toEqual({ failed: true, error: undefined });
  expect(host.listeners.size).toBe(0);
  expect(reader.read('viewport.width')).toBe('unknown');
  host.onRemove();
  const fresh = reader.subscribe(freshNotify, ['viewport.width']);
  expect(host.listeners.size).toBe(1);
  expect(reader.read('viewport.width')).toBe(900);
  for (const callback of stale) callback();
  await Promise.resolve();
  expect(oldNotify).not.toHaveBeenCalled();
  expect(freshNotify).not.toHaveBeenCalled();
  release();
  expect(host.listeners.size).toBe(1);
  fresh();
  expect(host.listeners.size).toBe(0);
});

it('does not let an old release erase a new mount acquired synchronously by host removal', async () => {
  const { createNativeRuleMeta } = await load(),
    host = environment();
  const reader = createNativeRuleMeta(() => host.doc, ['viewport.width']);
  const previous = vi.fn(),
    next = vi.fn();
  const release = reader.subscribe(previous, ['viewport.width']);
  const stale = [...host.listeners];
  let fresh: (() => void) | undefined;
  host.onRemove(() => {
    host.onRemove();
    fresh = reader.subscribe(next, ['viewport.width']);
  });
  release();
  expect(fresh).toBeTypeOf('function');
  expect(host.listeners.size).toBe(1);
  expect(reader.read('viewport.width')).toBe(900);
  for (const callback of stale) callback();
  host.view.innerWidth = 700;
  for (const callback of host.listeners) callback();
  await Promise.resolve();
  expect(previous).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalledTimes(1);
  fresh!();
  expect(host.listeners.size).toBe(0);
});

it('retries document adoption after retirement failed without retaining old facts or callbacks', async () => {
  const { createNativeRuleMeta } = await load(),
    first = environment(900),
    second = environment(700);
  let doc = first.doc;
  const reader = createNativeRuleMeta(() => doc, ['viewport.width']);
  const notify = vi.fn(),
    release = reader.subscribe(notify, ['viewport.width']);
  const stale = [...first.listeners];
  first.onRemove(() => {
    throw 0;
  });
  doc = second.doc;
  expect(capture(() => reader.read('viewport.width'))).toEqual({ failed: true, error: 0 });
  expect(first.listeners.size).toBe(0);
  expect(reader.read('viewport.width')).toBe(700);
  expect(second.listeners.size).toBe(1);
  for (const callback of stale) callback();
  await Promise.resolve();
  expect(notify).not.toHaveBeenCalled();
  release();
  expect(second.listeners.size).toBe(0);
});

it('registers rollback before a partial host attachment and preserves its first thrown value', async () => {
  const { createNativeRuleMeta } = await load(),
    host = environment();
  const reader = createNativeRuleMeta(() => host.doc, ['viewport.width']);
  const initiating = { code: 'partial-attach' };
  host.onAdd(() => {
    throw initiating;
  });
  host.onRemove(() => {
    throw new Error('secondary release');
  });
  expect(capture(() => reader.subscribe(() => {}, ['viewport.width']))).toEqual({
    failed: true,
    error: initiating,
  });
  expect(host.listeners.size).toBe(0);
  expect(reader.read('viewport.width')).toBe('unknown');
  host.onAdd();
  host.onRemove();
  const release = reader.subscribe(() => {}, ['viewport.width']);
  expect(reader.read('viewport.width')).toBe(900);
  release();
  expect(host.listeners.size).toBe(0);
});

it('attempts all reached source retirement before exposing a registration failure', async () => {
  const { createNativeRuleMeta } = await load(),
    host = environment();
  const initiating = { code: 'observer-attach' };
  let observers = 0;
  Object.assign(host.view, {
    MutationObserver: class {
      observe() {
        observers++;
        throw initiating;
      }
      disconnect() {
        observers--;
        throw new Error('secondary observer release');
      }
    },
  });
  host.onRemove(() => {
    throw new Error('tertiary width release');
  });
  const reader = createNativeRuleMeta(() => host.doc, ['viewport.width', 'colorScheme']);
  expect(capture(() => reader.subscribe(() => {}, ['viewport.width', 'colorScheme']))).toEqual({
    failed: true,
    error: initiating,
  });
  expect(observers).toBe(0);
  expect(host.listeners.size).toBe(0);
  expect(reader.read('viewport.width')).toBe('unknown');
  host.onRemove();
  const release = reader.subscribe(() => {}, ['viewport.width']);
  expect(reader.read('viewport.width')).toBe(900);
  release();
});

it('refuses an unpaired viewport source and retains the captured add/remove API pair', async () => {
  const { createNativeRuleMeta } = await load(),
    host = environment();
  const remove = host.view.removeEventListener;
  Object.assign(host.view, { removeEventListener: undefined });
  const reader = createNativeRuleMeta(() => host.doc, ['viewport.width']);
  const absent = reader.subscribe(() => {}, ['viewport.width']);
  expect(reader.read('viewport.width')).toBe('unknown');
  expect(host.listeners.size).toBe(0);
  absent();
  host.view.removeEventListener = remove;
  const release = reader.subscribe(() => {}, ['viewport.width']);
  const replacement = vi.fn();
  host.view.removeEventListener = replacement;
  release();
  expect(replacement).not.toHaveBeenCalled();
  expect(host.listeners.size).toBe(0);
});
