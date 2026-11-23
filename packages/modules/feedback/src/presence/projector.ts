import type {
  PresentationOutcome,
  PresentationViewBinding,
  StyleHandle,
  Translation,
  PresentationChannel,
} from '@proto.ui/core';
import { createResidentMotionSampler } from '../motion/sampler';
import type {
  PresencePresentationFrame,
  PresencePresentationSink,
  ResolvedPresenceEndpoint,
} from './sink';
export type PresenceSample = Readonly<{
  translate?: readonly [number, number];
  opacity?: number;
  blockSize?: number;
}>;
export type PresenceEnvironment = Readonly<{
  preference: 'reduce' | 'no-preference' | 'unknown';
  visible: boolean;
  width: number | null;
  height: number | null;
  rootFontPx: number | null;
  intrinsicBlockSize?: number | null;
  supported: readonly PresentationChannel[];
}>;
export type PresencePresentationHost = {
  readonly binding: PresentationViewBinding;
  now(): number;
  environment(channels?: readonly PresentationChannel[]): PresenceEnvironment;
  subscribe(callback: () => void): () => void;
  requestFrame(callback: () => void): unknown;
  cancelFrame(ticket: unknown): void;
  project(style: StyleHandle, sample: PresenceSample, current: () => boolean): boolean;
  release(): void;
};
const same = (a: readonly number[] | null, b: readonly number[]) =>
  !!a && a.length === b.length && a.every((n, i) => n === b[i]);
const attemptKey = (f: PresencePresentationFrame) =>
  `${f.view}:${f.owner.attempt?.ownerEpoch}:${f.owner.attempt?.phaseAttempt}:${f.owner.phase}`;
function resolveTranslation(
  value: Translation,
  env: PresenceEnvironment
): readonly [number, number] | null {
  const result: number[] = [];
  for (let i = 0; i < 2; i++) {
    const v = value[i];
    const box = i === 0 ? env.width : env.height;
    if ((v.ownBox !== 0 && box === null) || (v.rootText !== 0 && env.rootFontPx === null))
      return null;
    const n = v.px + v.rootText * (env.rootFontPx ?? 0) + v.ownBox * (box ?? 0);
    if (!Number.isFinite(n)) return null;
    result.push(n);
  }
  return result as unknown as readonly [number, number];
}
function vector(
  endpoint: ResolvedPresenceEndpoint,
  env: PresenceEnvironment
): readonly number[] | null {
  const translation = endpoint.translate ? resolveTranslation(endpoint.translate, env) : [0, 0];
  if (!translation) return null;
  const size =
    endpoint.blockSize === 'intrinsic' ? env.intrinsicBlockSize : (endpoint.blockSize ?? 0);
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) return null;
  return Object.freeze([translation[0], translation[1], endpoint.opacity ?? 1, size]);
}
const channelsOf = (candidate: PresencePresentationFrame): PresentationChannel[] => [
  ...(candidate.closed.translate ? ['translate' as const] : []),
  ...(candidate.closed.opacity !== undefined ? ['opacity' as const] : []),
  ...(candidate.closed.blockSize !== undefined ? ['blockSize' as const] : []),
];
/** Neutral presentation only. No component state, layout or ViewIntent writer. */
export function createPresencePresentationProjector(
  host: PresencePresentationHost
): PresencePresentationSink {
  let frame: PresencePresentationFrame | null = null;
  let view: number | null = null;
  let key: string | null = null;
  let generation = 0;
  let operation = 0;
  let ticket: unknown = null;
  let retired = false;
  let off: (() => void) | null = null;
  let acknowledged: readonly number[] | null = null;
  let target: readonly number[] | null = null;
  let sampler: ReturnType<typeof createResidentMotionSampler> | null = null;
  let samplerConfig = '';
  let cold = true;
  let awaitingInitialFrame = false;
  let completed = false;
  let preparedFrame: PresencePresentationFrame | null = null;
  let preparingFrame: PresencePresentationFrame | null = null;
  let commitDepth = 0;
  let completionDepth = 0;
  let releasing = false;
  let pendingTick = false;
  let pendingFrameTick: { frame: PresencePresentationFrame; token: number } | null = null;
  let pendingSettlement: {
    frame: PresencePresentationFrame;
    token: number;
    outcome: PresentationOutcome;
  } | null = null;
  let completedTarget: number | null = null;
  let pendingCompletion: {
    frame: PresencePresentationFrame;
    token: number;
    outcome: PresentationOutcome;
    notify: boolean;
  } | null = null;
  const reasons = new Set<string>();
  const cancel = () => {
    const old = ticket;
    ticket = null;
    generation++;
    if (old !== null) {
      try {
        host.cancelFrame(old);
      } catch {
        reasons.add('cancellation-failed');
      }
    }
  };
  const current = (candidate: PresencePresentationFrame, token: number) =>
    !retired && frame === candidate && token === generation;
  const sameAttempt = (left: PresencePresentationFrame, right: PresencePresentationFrame) =>
    left.owner.owner === right.owner.owner && attemptKey(left) === attemptKey(right);
  const currentSettlement = (queued: NonNullable<typeof pendingSettlement>) =>
    !retired && !!frame && queued.token === generation && sameAttempt(queued.frame, frame);
  const releaseHost = () => {
    // A release may synchronously notify, cancel, or replace the current frame.
    // No nested operation can acquire a transient lease until it has returned.
    if (releasing) return;
    releasing = true;
    completionDepth++;
    try {
      host.release();
    } finally {
      completionDepth--;
      releasing = false;
    }
  };
  const render = (
    candidate: PresencePresentationFrame,
    value: readonly number[],
    token: number
  ) => {
    if (!current(candidate, token)) return false;
    const sample: PresenceSample = {
      ...(candidate.closed.translate ? { translate: [value[0], value[1]] as const } : {}),
      ...(candidate.closed.opacity !== undefined
        ? { opacity: Math.max(0, Math.min(1, value[2])) }
        : {}),
      ...(candidate.closed.blockSize !== undefined ? { blockSize: Math.max(0, value[3]) } : {}),
    };
    let accepted = false;
    try {
      accepted = host.project(candidate.style, sample, () => current(candidate, token));
    } catch {
      reasons.add('projection-failed');
    }
    if (!current(candidate, token)) return false;
    if (accepted) acknowledged = Object.freeze([...value]);
    return accepted;
  };
  const complete = (
    candidate: PresencePresentationFrame,
    reason: PresentationOutcome,
    token: number,
    notify = true
  ) => {
    if (!current(candidate, token) || (completed && completedTarget === candidate.targetRevision))
      return;
    if (completionDepth) {
      pendingCompletion = { frame: candidate, token, outcome: reason, notify };
      return;
    }
    completed = true;
    completedTarget = candidate.targetRevision;
    reasons.add(reason);
    // Release restores semantic layout, which can change after this endpoint
    // was applied. Its old sample is no longer the displayed transient owner.
    // Keep samples for active reversals, but seed the next attempt from its
    // current semantic endpoint and obtain a new cold-entry acknowledgement.
    acknowledged = null;
    target = null;
    sampler?.dispose();
    sampler = null;
    samplerConfig = '';
    cold = true;
    awaitingInitialFrame = false;
    completionDepth++;
    try {
      try {
        releaseHost();
      } catch {
        reason = 'projection-failed';
        reasons.add(reason);
      }
      // Semantic preparation may publish a newer revision during release. The
      // same attempt/target receives its sole receipt at that current revision;
      // a replacement attempt or target cannot inherit the old completion.
      const latest = frame;
      if (
        retired ||
        !latest ||
        token !== generation ||
        !sameAttempt(candidate, latest) ||
        latest.targetRevision !== candidate.targetRevision
      )
        return;
      if (preparedFrame !== latest) {
        reason = 'projection-failed';
        reasons.add(reason);
      }
      if (notify && latest.owner.attempt) latest.complete(host.binding, reason);
    } finally {
      completionDepth--;
      flushPendingWork();
    }
  };
  const settle = (outcome: PresentationOutcome): boolean => {
    if (!frame || retired) return false;
    if (completed && completedTarget === frame.targetRevision) return false;
    if (commitDepth || completionDepth) {
      if (!pendingSettlement || !currentSettlement(pendingSettlement))
        pendingSettlement = { frame, token: generation, outcome };
      // The finite synchronous preparation must unwind before any environment
      // read or completion. False does not claim endpoint application success.
      return false;
    }
    const op = ++operation;
    cancel();
    if (retired || operation !== op || !frame) return false;
    const candidate = frame,
      token = generation;
    if (!current(candidate, token)) return false;
    if (preparedFrame !== candidate) {
      complete(candidate, 'projection-failed', token);
      return false;
    }
    const env = host.environment(channelsOf(candidate));
    if (!current(candidate, token)) return false;
    const endpoint =
      candidate.owner.phase === 'leaving' || candidate.owner.phase === 'closed'
        ? candidate.closed
        : candidate.entered;
    const value = vector(endpoint, env);
    sampler?.dispose();
    sampler = null;
    samplerConfig = '';
    awaitingInitialFrame = false;
    const accepted = value !== null && render(candidate, value, token);
    if (!current(candidate, token)) return false;
    complete(candidate, accepted ? outcome : 'projection-failed', token);
    return accepted;
  };
  function flushPendingWork() {
    if (commitDepth || completionDepth) return;
    const completion = pendingCompletion;
    const settlement = pendingSettlement;
    const delivered = pendingFrameTick;
    const requested = pendingTick;
    pendingCompletion = null;
    pendingSettlement = null;
    pendingFrameTick = null;
    pendingTick = false;
    if (completion && current(completion.frame, completion.token))
      complete(completion.frame, completion.outcome, completion.token, completion.notify);
    else if (settlement && currentSettlement(settlement) && preparedFrame === frame)
      settle(settlement.outcome);
    else if (requested) tick(!!delivered && current(delivered.frame, delivered.token));
  }
  function schedule() {
    if (retired || !frame || ticket !== null || completed) return;
    const token = generation;
    try {
      const next = host.requestFrame(() => {
        if (retired || token !== generation) return;
        ticket = null;
        tick(true);
      });
      if (!retired && token === generation) ticket = next;
      else if (next != null) host.cancelFrame(next);
      if (next == null && token === generation) settle('scheduler-failed');
    } catch {
      settle('scheduler-failed');
    }
  }
  function tick(fromFrame = false) {
    if (retired || !frame) return;
    // A synchronous style flush may notify or replace this frame. Only the
    // latest fully prepared frame may consume dimensions or acknowledge paint.
    if (commitDepth || completionDepth) {
      pendingTick = true;
      if (fromFrame) pendingFrameTick = { frame, token: generation };
      return;
    }
    if (preparedFrame !== frame) return;
    const candidate = frame,
      token = generation;
    // Terminal semantic sizing is already restored. An environment notification
    // must not reacquire a lease or replay motion for the same endpoint target.
    if (completed && completedTarget === candidate.targetRevision) return;
    // This first host profile only admits neutral entered modulation. General
    // typed declarations remain representable and receive explicit diagnostics.
    const enteredNeutral =
      (candidate.entered.opacity === undefined || candidate.entered.opacity === 1) &&
      (candidate.closed.blockSize === undefined ||
        (candidate.closed.blockSize === 0 && candidate.entered.blockSize === 'intrinsic')) &&
      (!candidate.entered.translate ||
        candidate.entered.translate.every(
          (axis) => axis.px === 0 && axis.rootText === 0 && axis.ownBox === 0
        ));
    if (!enteredNeutral) {
      const op = ++operation;
      cancel();
      if (retired || operation !== op || frame !== candidate) return;
      const failedToken = generation;
      reasons.add('unsupported-endpoint');
      try {
        host.project(candidate.style, {}, () => current(candidate, failedToken));
      } catch {
        reasons.add('projection-failed');
      }
      if (!current(candidate, failedToken)) return;
      complete(candidate, 'unsupported-endpoint', failedToken, !!candidate.owner.attempt);
      return;
    }
    if (
      candidate.owner.completion === 'presentation' &&
      candidate.owner.timeoutMs !== null &&
      candidate.owner.durationMs >= candidate.owner.timeoutMs
    ) {
      settle('invalid-policy');
      return;
    }
    const env = host.environment(channelsOf(candidate));
    if (!current(candidate, token)) return;
    if (env.preference !== 'no-preference') {
      settle(env.preference === 'reduce' ? 'reduced-motion' : 'unknown-preference');
      return;
    }
    if (!env.visible) {
      settle('hidden');
      return;
    }
    const channels = channelsOf(candidate);
    if (channels.some((channel) => !env.supported.includes(channel))) {
      settle('missing-capability');
      return;
    }
    const endpoint =
      candidate.owner.phase === 'leaving' || candidate.owner.phase === 'closed'
        ? candidate.closed
        : candidate.entered;
    const next = vector(endpoint, env);
    // An initially visible view may never have published an entered frame.
    // Its first leave starts at the semantic entered endpoint, not its target.
    // Once a sample exists, leaving must not require fresh intrinsic geometry.
    const initial = vector(
      candidate.owner.phase === 'leaving' && acknowledged === null
        ? candidate.entered
        : candidate.closed,
      env
    );
    if (!next || !initial) {
      settle('unresolved-units');
      return;
    }
    const animated =
      candidate.owner.completion === 'presentation' &&
      !!candidate.owner.attempt &&
      (candidate.owner.phase === 'entering' || candidate.owner.phase === 'leaving');
    if (!animated || completed) {
      const accepted = render(candidate, next, token);
      if (!current(candidate, token)) return;
      if (!accepted) reasons.add('projection-failed');
      target = next;
      complete(candidate, accepted ? 'finished' : 'projection-failed', token, animated);
      return;
    }
    if (candidate.owner.durationMs === 0) {
      settle('zero-duration');
      return;
    }
    const now = host.now();
    const config = JSON.stringify([candidate.owner.durationMs, candidate.easing]);
    if (!sampler || samplerConfig !== config) {
      sampler?.dispose();
      sampler = createResidentMotionSampler({
        durationMs: candidate.owner.durationMs,
        easing: candidate.easing,
      });
      samplerConfig = config;
      sampler.target(acknowledged ?? initial, now, false);
    }
    if (cold && candidate.owner.phase === 'entering') {
      if (!awaitingInitialFrame) {
        if (!render(candidate, initial, token)) {
          if (current(candidate, token)) settle('projection-failed');
          return;
        }
        awaitingInitialFrame = true;
        target = next;
        schedule();
        return;
      }
      if (!fromFrame) {
        // A superseded deferred delivery cannot acknowledge this frame. If it
        // consumed the ticket, request a new current acknowledgement instead.
        schedule();
        return;
      }
      // A delivered presentation frame acknowledges the actual start sample.
      if (!render(candidate, acknowledged ?? initial, token)) {
        if (current(candidate, token)) settle('projection-failed');
        return;
      }
      cold = false;
      awaitingInitialFrame = false;
      sampler.target(next, now, true, acknowledged!);
      target = next;
      schedule();
      return;
    }
    cold = false;
    if (!same(target, next)) {
      sampler.target(next, now, true, acknowledged ?? undefined);
      target = next;
    }
    const sample = fromFrame ? sampler.sample(now) : acknowledged;
    if (sample && !render(candidate, sample, token)) {
      if (current(candidate, token)) settle('projection-failed');
      return;
    }
    if (!current(candidate, token)) return;
    if (!sampler.active) {
      if (!render(candidate, next, token)) {
        if (current(candidate, token)) settle('projection-failed');
        return;
      }
      complete(candidate, 'finished', token);
    } else schedule();
  }
  return {
    commit(next) {
      if (retired) return;
      if (preparingFrame === next) {
        pendingTick = true;
        return;
      }
      commitDepth++;
      try {
        const op = ++operation;
        if (view !== null && next.view !== view) {
          cancel();
          if (retired || operation !== op) return;
          acknowledged = null;
          target = null;
          sampler?.dispose();
          sampler = null;
          cold = true;
        }
        const changed = key !== attemptKey(next);
        if (changed) {
          cancel();
          if (retired || operation !== op) return;
          completed = false;
          awaitingInitialFrame = false;
        }
        view = next.view;
        if (frame !== next) preparedFrame = null;
        frame = next;
        key = attemptKey(next);
        next.bind(host.binding);
        if (retired || frame !== next || operation !== op) return;
        if (preparedFrame !== next) {
          const token = generation;
          const previousPreparation = preparingFrame;
          preparingFrame = next;
          let accepted = false;
          try {
            // Empty channels project only the semantic style. They do not lease
            // motion channels or update the last acknowledged display sample.
            accepted = host.project(next.style, {}, () => current(next, token));
          } catch {
            reasons.add('projection-failed');
          } finally {
            preparingFrame = previousPreparation;
          }
          if (!current(next, token) || operation !== op) return;
          if (!accepted) {
            reasons.add('projection-failed');
            cancel();
            if (retired || frame !== next || operation !== op) return;
            sampler?.dispose();
            sampler = null;
            samplerConfig = '';
            awaitingInitialFrame = false;
            complete(next, 'projection-failed', generation, !!next.owner.attempt);
            return;
          }
          preparedFrame = next;
        }
        if (!off) {
          const nextOff = host.subscribe(() => tick());
          if (retired || operation !== op) {
            nextOff();
            return;
          }
          off = nextOff;
        }
        if (operation === op) tick();
      } finally {
        commitDepth--;
        flushPendingWork();
      }
    },
    settle,
    cancel() {
      const op = ++operation;
      cancel();
      if (retired || operation !== op) return;
      frame = null;
      preparedFrame = null;
      sampler?.dispose();
      sampler = null;
      samplerConfig = '';
      acknowledged = null;
      target = null;
      cold = true;
      completed = false;
      awaitingInitialFrame = false;
      try {
        releaseHost();
      } finally {
        flushPendingWork();
      }
    },
    release(epoch) {
      if (view !== epoch || retired) return;
      retired = true;
      operation++;
      cancel();
      frame = null;
      preparedFrame = null;
      acknowledged = null;
      target = null;
      sampler?.dispose();
      sampler = null;
      try {
        off?.();
      } finally {
        off = null;
        try {
          releaseHost();
        } finally {
          flushPendingWork();
        }
      }
    },
    diagnostics: () => [...reasons],
  };
}
