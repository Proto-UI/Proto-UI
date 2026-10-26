/** Facts are read from the actual public instance; never from a DOM query or copied state. */
export interface InputShellFact {
  get(): boolean;
  subscribe(listener: () => void): () => void;
}
export interface InputShellControlInstance {
  getExposes(): unknown;
}
export interface InputShellOwner {
  isCurrent(): boolean;
  onDispose(dispose: () => void): () => void;
}
export interface InputShellTarget {
  /** The real target instance, not a fresh wrapper identity. */
  instance: object;
  /** Merge only these facts with authored props; do not replace unrelated props. */
  setFacts(facts: Readonly<{ focusVisible: boolean; disabled: boolean }>): void;
}
const targets = new WeakSet<object>();
const controls = new WeakSet<object>();
function fail(message: string): never {
  throw new Error(`[input-shell] ${message}`);
}
function read(instance: InputShellControlInstance) {
  if (!instance || typeof instance.getExposes !== 'function')
    fail('A public control instance is required');
  const exposes = instance.getExposes() as Record<string, unknown> | null;
  const result = {} as Record<'focusVisible' | 'disabled', InputShellFact>;
  for (const key of ['focusVisible', 'disabled'] as const) {
    const value = exposes?.[key] as InputShellFact | undefined;
    if (!value || typeof value.get !== 'function' || typeof value.subscribe !== 'function')
      fail(`Missing public control fact: ${key}`);
    if (typeof value.get() !== 'boolean') fail(`Invalid public control fact: ${key}`);
    result[key] = value;
  }
  return result;
}
/** Single-control composition. The control keeps all editing, disabled and focus authority. */
export function bindInputShellControl(
  owner: InputShellOwner,
  target: InputShellTarget,
  initial: InputShellControlInstance
) {
  if (!owner || typeof owner.isCurrent !== 'function' || typeof owner.onDispose !== 'function')
    fail('An explicit view owner is required');
  if (
    !target ||
    !target.instance ||
    typeof target.instance !== 'object' ||
    typeof target.setFacts !== 'function'
  )
    fail('A real passive target instance is required');
  read(initial);
  if (!owner.isCurrent()) fail('Cannot bind a retired owner');
  if (targets.has(target.instance) || controls.has(initial)) fail('Duplicate active binding');
  let source = initial;
  let disposed = false;
  let attaching = false;
  let syncing = false;
  let pending = false;
  let generation = 0;
  let subscriptions: Array<() => void> = [];
  let ownerCleanup: (() => void) | undefined;
  const retire = () => {
    generation++;
    controls.delete(source);
    const old = subscriptions;
    subscriptions = [];
    let failed = false;
    let error: unknown;
    for (const off of old) {
      try {
        off();
      } catch (cause) {
        if (!failed) {
          failed = true;
          error = cause;
        }
      }
    }
    if (failed) throw error;
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    targets.delete(target.instance);
    const off = ownerCleanup;
    ownerCleanup = undefined;
    let failed = false;
    let error: unknown;
    try {
      retire();
    } catch (cause) {
      failed = true;
      error = cause;
    }
    try {
      off?.();
    } catch (cause) {
      if (!failed) {
        failed = true;
        error = cause;
      }
    }
    if (failed) throw error;
  };
  const abort = (error: unknown): never => {
    try {
      dispose();
    } catch {
      /* Preserve the original failure after attempting every cleanup. */
    }
    throw error;
  };
  const sync = () => {
    if (disposed) return;
    pending = true;
    if (syncing || attaching) return;
    syncing = true;
    try {
      while (pending && !disposed) {
        pending = false;
        if (!owner.isCurrent()) {
          dispose();
          break;
        }
        const observedSource = source;
        const observedGeneration = generation;
        const facts = read(observedSource);
        const snapshot = { focusVisible: facts.focusVisible.get(), disabled: facts.disabled.get() };
        if (typeof snapshot.focusVisible !== 'boolean' || typeof snapshot.disabled !== 'boolean')
          fail('Invalid public control fact snapshot');
        if (disposed || !owner.isCurrent()) {
          dispose();
          break;
        }
        if (source !== observedSource || generation !== observedGeneration) {
          pending = true;
          continue;
        }
        target.setFacts(snapshot);
      }
    } catch (error) {
      abort(error);
    } finally {
      syncing = false;
    }
  };
  const attach = () => {
    if (disposed || !owner.isCurrent()) {
      dispose();
      return;
    }
    const attachedSource = source;
    const beforeRead = generation;
    const facts = read(attachedSource);
    if (disposed || !owner.isCurrent()) {
      dispose();
      return;
    }
    if (source !== attachedSource || generation !== beforeRead) return;
    const current = ++generation;
    controls.add(attachedSource);
    attaching = true;
    try {
      for (const fact of [facts.focusVisible, facts.disabled]) {
        if (disposed || !owner.isCurrent()) {
          dispose();
          break;
        }
        if (current !== generation || source !== attachedSource) break;
        const off = fact.subscribe(() => {
          if (current === generation) sync();
        });
        if (typeof off !== 'function') fail('Control subscription cleanup is required');
        if (disposed || current !== generation) off();
        else subscriptions.push(off);
      }
    } finally {
      attaching = false;
    }
    sync();
  };
  targets.add(target.instance);
  try {
    const off = owner.onDispose(dispose);
    if (typeof off !== 'function') fail('Owner cleanup is required');
    if (disposed) off();
    else {
      ownerCleanup = off;
      attach();
    }
  } catch (error) {
    abort(error);
  }
  return {
    dispose,
    sync,
    replace(next: InputShellControlInstance) {
      if (disposed || !owner.isCurrent()) {
        dispose();
        fail('Retired binding');
      }
      try {
        const previousSource = source;
        const previousGeneration = generation;
        read(next);
        if (disposed || !owner.isCurrent()) fail('Retired binding');
        if (source !== previousSource || generation !== previousGeneration)
          fail('Binding changed during replacement');
        if (next === source) return sync();
        if (controls.has(next)) fail('Duplicate active control');
        retire();
        if (disposed || !owner.isCurrent()) fail('Retired binding');
        if (source !== previousSource || generation !== previousGeneration + 1)
          fail('Binding changed during replacement cleanup');
        source = next;
        attach();
      } catch (error) {
        abort(error);
      }
    },
  };
}
