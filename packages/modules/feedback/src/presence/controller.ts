import {
  snapshotPresencePresentation,
  snapshotPresentationOwnerFrame,
  type PresenceOwnerDeclaration,
  type PresencePresentationDeclaration,
  type PresentationOwnerRef,
  type PresentationOwnerWriter,
  type PresentationOwnerFrame,
  type PresentationReceipt,
  type PresentationViewBinding,
  type PresentationOutcome,
  type CompletionRequest,
  type StyleHandle,
  type State,
  type Translation,
} from '@proto.ui/core';
import type { PresencePresentationSink, ResolvedPresenceEndpoint } from './sink';
type Owner = {
  ref: PresentationOwnerRef;
  writer: PresentationOwnerWriter;
  frame: PresentationOwnerFrame | null;
  callback: ((run: any, request: CompletionRequest) => void) | null;
  binding: PresentationViewBinding | null;
  targetRevision: number;
  targetKey: string | null;
  pending: PresentationReceipt | null;
};
export type PresenceControllerOptions = {
  setup(op: string): void;
  runtime(op: string): void;
  invalidate(): void;
  dispatch(callback: () => void): void;
  callbackContext(): unknown;
  watch(source: State<string>, callback: () => void): () => void;
  sink(): PresencePresentationSink | null;
  fallback(style: StyleHandle): void;
};
export function createPresenceController(options: PresenceControllerOptions) {
  const owners = new Map<PresentationOwnerRef, Owner>();
  const writers = new Map<PresentationOwnerWriter, Owner>();
  const sources = new WeakSet<object>();
  const subscriptions = new Set<() => void>();
  const reasons = new Set<string>();
  let declaration: PresencePresentationDeclaration | null = null;
  let sink: PresencePresentationSink | null = null;
  let view = -1;
  let disposed = false;
  let operation = 0;
  const requireOwner = (writer: PresentationOwnerWriter) => {
    const owner = writers.get(writer);
    if (disposed || !owner) throw new Error('[feedback.presence] Unknown or retired owner writer');
    return owner;
  };
  const active = (owner: Owner) =>
    !!owner.frame?.attempt && owner.frame.completion === 'presentation';
  const isCurrent = (writer: PresentationOwnerWriter, receipt: PresentationReceipt) => {
    const owner = writers.get(writer),
      frame = owner?.frame;
    return (
      !disposed &&
      !!owner &&
      owner.pending === receipt &&
      !!frame?.attempt &&
      owner.ref === receipt.owner &&
      owner.binding === receipt.viewBinding &&
      frame.revision === receipt.ownerRevision &&
      owner.targetRevision === receipt.targetRevision &&
      frame.attempt.ownerEpoch === receipt.attempt.ownerEpoch &&
      frame.attempt.phaseAttempt === receipt.attempt.phaseAttempt
    );
  };
  const finish = (
    owner: Owner,
    binding: PresentationViewBinding,
    outcome: PresentationOutcome,
    revision: number,
    targetRevision: number
  ) => {
    const frame = owner.frame;
    if (
      disposed ||
      !frame?.attempt ||
      frame.revision !== revision ||
      owner.targetRevision !== targetRevision ||
      owner.binding !== binding
    )
      return;
    if (owner.pending && isCurrent(owner.writer, owner.pending)) return;
    const recipe = declaration;
    const receipt: PresentationReceipt = Object.freeze({
      owner: owner.ref,
      attempt: frame.attempt,
      viewBinding: binding,
      ownerRevision: revision,
      targetRevision,
      channels: Object.freeze([
        ...(recipe?.closed.translate ? ['translate' as const] : []),
        ...(recipe?.closed.opacity !== undefined ? ['opacity' as const] : []),
      ]),
      outcome,
    });
    reasons.add(outcome);
    owner.pending = receipt;
    // Publication may synchronously acknowledge before Transition installs its phase.
    // Keep the receipt live until actual identity retirement, not callback return.
    options.dispatch(() => {
      if (isCurrent(owner.writer, receipt))
        owner.callback?.(options.callbackContext(), Object.freeze({ receipt }));
    });
  };
  const resolve = (
    endpoint: PresencePresentationDeclaration['closed']
  ): ResolvedPresenceEndpoint | null => {
    let translate: Translation | undefined;
    if (endpoint.translate) {
      if (Array.isArray(endpoint.translate)) translate = endpoint.translate as Translation;
      else {
        const selection =
          endpoint.translate as import('@proto.ui/core').FiniteSelection<Translation>;
        const value = selection.source.get();
        if (typeof value !== 'string' || !Object.hasOwn(selection.cases, value)) return null;
        translate = selection.cases[value];
      }
    }
    return Object.freeze({
      ...(translate ? { translate } : {}),
      ...(endpoint.opacity !== undefined ? { opacity: endpoint.opacity } : {}),
    });
  };
  const release = (advance = true) => {
    if (advance) operation++;
    const old = sink,
      oldView = view;
    sink = null;
    for (const owner of owners.values()) {
      owner.binding = null;
      owner.pending = null;
      owner.targetKey = null;
    }
    old?.release(oldView);
  };
  const facade = {
    registerSource(source: object) {
      options.setup('feedback.presence.registerSource');
      sources.add(source);
    },
    owner(): PresenceOwnerDeclaration<any> {
      options.setup('def.feedback.presence.owner');
      const ref = Object.freeze({}) as PresentationOwnerRef,
        writer = Object.freeze({}) as PresentationOwnerWriter;
      const owner: Owner = {
        ref,
        writer,
        frame: null,
        callback: null,
        binding: null,
        targetRevision: 0,
        targetKey: null,
        pending: null,
      };
      owners.set(ref, owner);
      writers.set(writer, owner);
      return Object.freeze({
        ref,
        writer,
        onCompletionRequest(callback: Owner['callback']) {
          options.setup('def.feedback.presence.owner.onCompletionRequest');
          if (typeof callback !== 'function' || owner.callback)
            throw new Error('[feedback.presence] One completion receiver is required');
          owner.callback = callback;
        },
      });
    },
    publish(writer: PresentationOwnerWriter, value: PresentationOwnerFrame) {
      options.runtime('run.feedback.presence.publish');
      const owner = requireOwner(writer);
      const frame = snapshotPresentationOwnerFrame(value);
      if (frame.owner !== owner.ref || (owner.frame && frame.revision <= owner.frame.revision))
        throw new Error('[feedback.presence] Foreign owner or nonmonotonic revision');
      owner.pending = null;
      owner.frame = frame;
      options.invalidate();
    },
    isCurrent,
    settle(writer: PresentationOwnerWriter, outcome: PresentationOutcome) {
      options.runtime('run.feedback.presence.settle');
      const owner = requireOwner(writer);
      if (!active(owner)) return;
      if (declaration?.owner === owner.ref && sink) {
        sink.settle(outcome);
        return;
      }
      owner.binding ??= Object.freeze({}) as PresentationViewBinding;
      finish(
        owner,
        owner.binding,
        outcome === 'finished' ? 'missing-capability' : outcome,
        owner.frame!.revision,
        owner.targetRevision
      );
    },
  };
  return {
    facade,
    declare(value: PresencePresentationDeclaration) {
      options.setup('def.feedback.style.presence');
      if (disposed || declaration)
        throw new Error('[feedback.presence] One declaration per surface');
      const copy = snapshotPresencePresentation(value);
      if (!owners.has(copy.owner)) throw new Error('[feedback.presence] Unknown owner reference');
      const sourceSet = new Set<State<string>>();
      for (const endpoint of [copy.closed, copy.entered]) {
        if (endpoint.translate && !Array.isArray(endpoint.translate)) {
          const source = (
            endpoint.translate as import('@proto.ui/core').FiniteSelection<Translation>
          ).source;
          if (!sources.has(source))
            throw new Error('[feedback.presence] Unknown selection State reference');
          sourceSet.add(source as State<string>);
        }
      }
      const installed: (() => void)[] = [];
      try {
        for (const source of sourceSet) {
          const off = options.watch(source, options.invalidate);
          installed.push(off);
          subscriptions.add(off);
        }
      } catch (error) {
        for (const off of installed) {
          subscriptions.delete(off);
          off();
        }
        throw error;
      }
      declaration = copy;
      options.invalidate();
      return () => {
        options.setup('def.feedback.style.presence:dispose');
        if (declaration !== copy) return;
        declaration = null;
        for (const off of installed) {
          subscriptions.delete(off);
          off();
        }
        options.invalidate();
      };
    },
    get declared() {
      return !!declaration;
    },
    commit(style: StyleHandle, epoch: number, revision: number) {
      if (disposed || !declaration) return false;
      const owner = owners.get(declaration.owner)!;
      if (!owner.frame) {
        options.fallback(style);
        return true;
      }
      const op = ++operation,
        recipe = declaration,
        ownerFrame = owner.frame;
      if (epoch !== view) {
        release(false);
        if (disposed || operation !== op || declaration !== recipe || owner.frame !== ownerFrame)
          return true;
        view = epoch;
      }
      const current = () =>
        !disposed && operation === op && declaration === recipe && owner.frame === ownerFrame;
      const closed = resolve(declaration.closed),
        entered = resolve(declaration.entered);
      if (!current()) return true;
      const targetKey = JSON.stringify([closed, entered, recipe.easing]);
      if (targetKey !== owner.targetKey) {
        owner.targetKey = targetKey;
        owner.targetRevision++;
        owner.pending = null;
      }
      const targetRevision = owner.targetRevision;
      const nextSink = options.sink();
      if (!current()) return true;
      if (nextSink !== sink) {
        const old = sink;
        sink = null;
        owner.binding = null;
        owner.pending = null;
        old?.release(view);
        if (!current()) return true;
        sink = nextSink;
      }
      if (!closed || !entered || !sink) {
        sink?.cancel();
        if (!current()) return true;
        options.fallback(style);
        if (!current()) return true;
        if (active(owner)) {
          owner.binding ??= Object.freeze({}) as PresentationViewBinding;
          finish(
            owner,
            owner.binding,
            !closed || !entered ? 'unresolved-input' : 'missing-capability',
            owner.frame.revision,
            targetRevision
          );
        }
        return true;
      }
      const frame = owner.frame,
        sinkAtCommit = sink;
      sink.commit(
        Object.freeze({
          view: epoch,
          revision,
          targetRevision,
          style,
          owner: frame,
          closed,
          entered,
          easing: declaration.easing,
          bind(binding: PresentationViewBinding) {
            if (
              !disposed &&
              sink === sinkAtCommit &&
              owner.frame === frame &&
              owner.targetRevision === targetRevision
            )
              owner.binding = binding;
          },
          complete(binding: PresentationViewBinding, outcome: PresentationOutcome) {
            if (sink === sinkAtCommit)
              finish(owner, binding, outcome, frame.revision, targetRevision);
          },
        })
      );
      return true;
    },
    release,
    dispose() {
      if (disposed) return;
      disposed = true;
      let failed = false;
      let error: unknown;
      const cleanup = (callback: () => void) => {
        try {
          callback();
        } catch (failure) {
          if (!failed) {
            failed = true;
            error = failure;
          }
        }
      };
      const unsubs = [...subscriptions];
      subscriptions.clear();
      declaration = null;
      cleanup(release);
      for (const off of unsubs) cleanup(off);
      owners.clear();
      writers.clear();
      if (failed) throw error;
    },
    diagnostics: () => Object.freeze([...reasons, ...(sink?.diagnostics?.() ?? [])]),
  };
}
