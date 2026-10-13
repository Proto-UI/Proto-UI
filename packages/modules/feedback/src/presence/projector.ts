import type {
  PresentationOutcome,
  PresentationViewBinding,
  StyleHandle,
  Translation,
} from '@proto.ui/core';
import { createResidentMotionSampler } from '../motion/sampler';
import type {
  PresencePresentationFrame,
  PresencePresentationSink,
  ResolvedPresenceEndpoint,
} from './sink';
export type PresenceSample = Readonly<{ translate?: readonly [number, number]; opacity?: number }>;
export type PresenceEnvironment = Readonly<{
  preference: 'reduce' | 'no-preference' | 'unknown';
  visible: boolean;
  width: number | null;
  height: number | null;
  rootFontPx: number | null;
  supported: readonly ('translate' | 'opacity')[];
}>;
export type PresencePresentationHost = {
  readonly binding: PresentationViewBinding;
  now(): number;
  environment(): PresenceEnvironment;
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
  return Object.freeze([translation[0], translation[1], endpoint.opacity ?? 1]);
}
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
  let pendingTick = false;
  let pendingFrameTick: { frame: PresencePresentationFrame; token: number } | null = null;
  let pendingSettlement: {
    frame: PresencePresentationFrame;
    token: number;
    outcome: PresentationOutcome;
  } | null = null;
  let completedTarget: number | null = null;
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
    token: number
  ) => {
    if (!current(candidate, token) || (completed && completedTarget === candidate.targetRevision))
      return;
    completed = true;
    completedTarget = candidate.targetRevision;
    reasons.add(reason);
    try {
      host.release();
    } catch {
      reason = 'projection-failed';
      reasons.add(reason);
    }
    if (!current(candidate, token)) return;
    if (candidate.owner.attempt) candidate.complete(host.binding, reason);
  };
  const settle = (outcome: PresentationOutcome): boolean => {
    if (!frame || retired) return false;
    if (commitDepth) {
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
    const env = host.environment();
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
    if (commitDepth) {
      pendingTick = true;
      if (fromFrame) pendingFrameTick = { frame, token: generation };
      return;
    }
    if (preparedFrame !== frame) return;
    const candidate = frame,
      token = generation;
    // This first host profile only admits neutral entered modulation. General
    // typed declarations remain representable and receive explicit diagnostics.
    const enteredNeutral =
      (candidate.entered.opacity === undefined || candidate.entered.opacity === 1) &&
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
      try {
        host.release();
      } catch {
        reasons.add('projection-failed');
      }
      if (candidate.owner.attempt) complete(candidate, 'unsupported-endpoint', failedToken);
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
    const env = host.environment();
    if (!current(candidate, token)) return;
    if (env.preference !== 'no-preference') {
      settle(env.preference === 'reduce' ? 'reduced-motion' : 'unknown-preference');
      return;
    }
    if (!env.visible) {
      settle('hidden');
      return;
    }
    const channels = [
      ...(candidate.closed.translate ? ['translate'] : []),
      ...(candidate.closed.opacity !== undefined ? ['opacity'] : []),
    ];
    if (channels.some((channel) => !env.supported.includes(channel as 'translate' | 'opacity'))) {
      settle('missing-capability');
      return;
    }
    const endpoint =
      candidate.owner.phase === 'leaving' || candidate.owner.phase === 'closed'
        ? candidate.closed
        : candidate.entered;
    const next = vector(endpoint, env);
    const initial = vector(candidate.closed, env);
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
      if (animated && completedTarget !== candidate.targetRevision) {
        complete(candidate, accepted ? 'finished' : 'projection-failed', token);
      } else {
        try {
          host.release();
        } catch {
          reasons.add('projection-failed');
        }
      }
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
      sampler.target(
        acknowledged ?? (candidate.owner.phase === 'entering' ? initial : next),
        now,
        false
      );
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
            if (next.owner.attempt) complete(next, 'projection-failed', generation);
            else {
              try {
                host.release();
              } catch {
                reasons.add('projection-failed');
              }
            }
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
        if (!commitDepth) {
          const settlement = pendingSettlement;
          const delivered = pendingFrameTick;
          const requested = pendingTick;
          pendingSettlement = null;
          pendingFrameTick = null;
          pendingTick = false;
          if (settlement && currentSettlement(settlement) && preparedFrame === frame)
            settle(settlement.outcome);
          else if (requested) tick(!!delivered && current(delivered.frame, delivered.token));
        }
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
      host.release();
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
        host.release();
      }
    },
    diagnostics: () => [...reasons],
  };
}
