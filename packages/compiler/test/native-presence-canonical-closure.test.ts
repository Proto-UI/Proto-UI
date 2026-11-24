// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { webPresenceArtifacts } from '../src/native-support/web-presence';
import { loadSupport, typecheckSupport } from './native-support-evidence';

describe('canonical native Presence helper closure', () => {
  it('typechecks the actual emitted host module graph without repository source imports', () => {
    expect(typecheckSupport(webPresenceArtifacts())).toBe('');
  }, 30_000);

  it('loads the emitted host and preserves independent top and block-size sampling', () => {
    const load = loadSupport(webPresenceArtifacts());
    expect(typeof load('.proto-ui/presence/web-v1.ts').createWebPresencePresentationSink).toBe(
      'function'
    );
    const create = load('.proto-ui/presence/channel-sampler-v1.ts').createPresenceMotionSampler;
    if (typeof create !== 'function') throw new Error('Missing emitted channel sampler factory');
    const sampler = create({
      owner: { durationMs: 300 },
      easing: [0, 0, 1, 1],
      channelEasing: { top: [0, 0, 0.58, 1], blockSize: [0, 0, 1, 1] },
    });
    sampler.target([0, 0, 0, -250, 0], 0, false);
    sampler.target([0, 0, 1, 100, 200], 0);
    const sample = sampler.sample(150);
    expect(sample).toHaveLength(5);
    expect(sample.slice(0, 2)).toEqual([0, 0]);
    expect(sample[2]).toBeCloseTo(0.5, 12);
    expect(sample[3]).toBeCloseTo(-250 + 350 * 0.684643187, 5);
    expect(sample[4]).toBeCloseTo(100, 8);
    expect(sampler.sample(300)).toEqual([0, 0, 1, 100, 200]);
    sampler.dispose();
    expect(sampler.active).toBe(false);
  });
});
