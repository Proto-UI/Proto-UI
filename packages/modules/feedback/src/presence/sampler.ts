import type { PresentationChannel } from '@proto.ui/core';
import { createResidentMotionSampler, type MotionVector } from '../motion/sampler';
import type { PresencePresentationFrame } from './sink';

/** Optional channel curves share timing authority but keep their own reversal state. */
export function createPresenceMotionSampler(frame: PresencePresentationFrame) {
  const groups: readonly (readonly [PresentationChannel, number, number])[] = [
    ['translate', 0, 2],
    ['opacity', 2, 3],
    ['top', 3, 4],
    ['blockSize', 4, 5],
  ];
  const config = { durationMs: frame.owner.durationMs, easing: frame.easing };
  // Preserve the original coupled-vector shortening for existing declarations.
  if (!frame.channelEasing || !Object.keys(frame.channelEasing).length)
    return createResidentMotionSampler(config);
  const samplers = groups.map(([channel]) =>
    createResidentMotionSampler({
      ...config,
      easing: frame.channelEasing?.[channel] ?? frame.easing,
    })
  );
  const join = (values: (MotionVector | null)[]): MotionVector | null =>
    values.some((value) => value === null) ? null : Object.freeze(values.flat() as number[]);
  return {
    target(next: MotionVector, now: number, animate = true, presented?: MotionVector) {
      return join(
        samplers.map((sampler, index) => {
          const [, start, end] = groups[index];
          return sampler.target(next.slice(start, end), now, animate, presented?.slice(start, end));
        })
      );
    },
    sample: (now: number) => join(samplers.map((sampler) => sampler.sample(now))),
    settle: (now: number) => join(samplers.map((sampler) => sampler.settle(now))),
    get active() {
      return samplers.some((sampler) => sampler.active);
    },
    dispose() {
      for (const sampler of samplers) sampler.dispose();
    },
  };
}
