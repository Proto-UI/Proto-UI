import { expect, it } from 'vitest';
import { tw, type PresentationOwnerRef, type PresentationViewBinding } from '@proto.ui/core';
import {
  createPresencePresentationProjector,
  type PresenceEnvironment,
  type PresenceSample,
} from '../src/presence/projector';
import type { PresencePresentationFrame } from '../src/presence/sink';
const zero = { px: 0, rootText: 0, ownBox: 0 };
function fixture() {
  let time = 0,
    id = 0,
    visible = true,
    resolved = false,
    resolveOnProject = true;
  const frames = new Map<number, () => void>();
  const calls: { kind: string; sample?: PresenceSample; phase?: string }[] = [];
  const outcomes: string[] = [];
  let onProject: ((sample: PresenceSample) => boolean) | null = null;
  let invalidate = () => {};
  const sink = createPresencePresentationProjector({
    binding: {} as PresentationViewBinding,
    now: () => time,
    environment(): PresenceEnvironment {
      calls.push({ kind: 'environment' });
      return {
        preference: 'no-preference',
        visible,
        width: resolved ? 320 : null,
        height: resolved ? 192 : null,
        rootFontPx: 16,
        supported: ['translate'],
      };
    },
    project(_style, sample, current) {
      calls.push({ kind: 'project', sample });
      const result = onProject?.(sample) ?? true;
      if (result && current() && resolveOnProject) resolved = true;
      return result;
    },
    subscribe(cb) {
      invalidate = cb;
      return () => {};
    },
    requestFrame(cb) {
      const ticket = ++id;
      frames.set(ticket, cb);
      return ticket;
    },
    cancelFrame(ticket) {
      frames.delete(ticket as number);
    },
    release() {
      calls.push({ kind: 'release' });
    },
  });
  const frame = (
    revision: number,
    phase: 'closed' | 'entering' = 'entering'
  ): PresencePresentationFrame => ({
    view: 1,
    revision,
    targetRevision: revision,
    style: tw(phase === 'closed' ? 'hidden' : 'flex'),
    owner: {
      owner: {} as PresentationOwnerRef,
      revision,
      phase,
      attempt: phase === 'closed' ? null : { ownerEpoch: 1, phaseAttempt: revision },
      completion: 'presentation',
      durationMs: 500,
      timeoutMs: 1000,
    },
    closed: { translate: [zero, { ...zero, ownBox: 1 }] },
    entered: { translate: [zero, zero] },
    easing: [0.32, 0.72, 0, 1],
    bind() {},
    complete(_binding, outcome) {
      outcomes.push(`${revision}:${outcome}`);
    },
  });
  return {
    sink,
    calls,
    outcomes,
    frames,
    frame,
    invalidate: () => invalidate(),
    setVisible(v: boolean) {
      visible = v;
    },
    keepUnresolved() {
      resolveOnProject = false;
    },
    setResolved(v: boolean) {
      resolved = v;
    },
    setProject(fn: typeof onProject) {
      onProject = fn;
    },
    advance(t: number) {
      time = t;
      const pending = [...frames.values()];
      frames.clear();
      for (const cb of pending) cb();
    },
  };
}
it('projects a semantic baseline before resolving an intrinsic cold-enter ownBox', () => {
  const f = fixture();
  f.sink.commit(f.frame(1));
  expect(f.calls[0]).toEqual({ kind: 'project', sample: {} });
  expect(f.outcomes).toEqual([]);
  expect(f.calls.filter((c) => c.sample?.translate).at(-1)?.sample?.translate).toEqual([0, 192]);
  f.advance(16);
  f.advance(116);
  expect(f.calls.filter((c) => c.sample?.translate).at(-1)?.sample?.translate?.[1]).toBeLessThan(
    192
  );
  f.advance(516);
  expect(f.outcomes).toEqual(['1:finished']);
});
it('attempts hidden closed semantic settlement even when transient units stay unresolved', () => {
  const f = fixture();
  f.setVisible(false);
  f.keepUnresolved();
  f.sink.commit(f.frame(1, 'closed'));
  expect(f.calls[0]).toEqual({ kind: 'project', sample: {} });
  expect(f.outcomes).toEqual([]);
  expect(f.sink.diagnostics?.()).toContain('projection-failed');
  expect(f.frames.size).toBe(0);
});
it('keeps environment invalidation and RAF from repeating semantic preparation', () => {
  const f = fixture();
  f.sink.commit(f.frame(1));
  f.invalidate();
  f.advance(16);
  f.advance(116);
  expect(f.calls.filter((c) => c.kind === 'project' && !c.sample?.translate)).toHaveLength(1);
});
it('lets synchronous replacement during preparation win without acknowledging the old attempt', () => {
  const f = fixture();
  let replace = true;
  f.setProject((sample) => {
    if (replace && !sample.translate) {
      replace = false;
      f.sink.commit(f.frame(2));
    }
    return true;
  });
  f.sink.commit(f.frame(1));
  f.advance(16);
  f.advance(516);
  expect(f.outcomes).toEqual(['2:finished']);
});
it('does not resume preparation after synchronous physical retirement', () => {
  const f = fixture();
  f.setProject(() => {
    f.sink.release(1);
    return true;
  });
  f.sink.commit(f.frame(1));
  expect(f.outcomes).toEqual([]);
  expect(f.frames.size).toBe(0);
  expect(f.calls.filter((c) => c.kind === 'environment')).toHaveLength(0);
});
it.each([false, 0, undefined])(
  'settles a refused or thrown preparation without recursive projection (%s)',
  (value) => {
    const f = fixture();
    f.setProject(() => {
      if (value === false) return false;
      throw value;
    });
    f.sink.commit(f.frame(1));
    expect(f.outcomes).toEqual(['1:projection-failed']);
    expect(f.frames.size).toBe(0);
    expect(f.calls.filter((c) => c.kind === 'project')).toHaveLength(1);
  }
);

it('coalesces the identical frame reentered during semantic preparation', () => {
  const f = fixture();
  const frame = f.frame(1);
  f.setProject((sample) => {
    if (!sample.translate) f.sink.commit(frame);
    return true;
  });
  f.sink.commit(frame);
  expect(f.calls.filter((c) => c.kind === 'project' && !c.sample?.translate)).toHaveLength(1);
  f.advance(16);
  f.advance(516);
  expect(f.outcomes).toEqual(['1:finished']);
});
it('defers synchronous environment notification until the current style flush returns', () => {
  const f = fixture();
  f.sink.commit(f.frame(1));
  f.setProject((sample) => {
    if (!sample.translate) {
      f.setResolved(false);
      f.invalidate();
    }
    return true;
  });
  f.sink.commit(f.frame(2));
  expect(f.outcomes).toEqual([]);
  f.advance(16);
  f.advance(516);
  expect(f.outcomes).toEqual(['2:finished']);
});
it('preserves the last acknowledged sample through a same-attempt semantic style commit', () => {
  const f = fixture();
  const first = f.frame(1);
  f.sink.commit(first);
  f.advance(16);
  f.advance(116);
  const before = f.calls.filter((c) => c.sample?.translate).at(-1)?.sample?.translate;
  f.sink.commit({ ...first, revision: 2, style: tw('flex', 'bg-background') });
  expect(f.calls.filter((c) => c.sample?.translate).at(-1)?.sample?.translate).toEqual(before);
  f.advance(516);
  expect(f.outcomes).toEqual(['1:finished']);
});
it('keeps replacement authoritative when a refused preparation cleanup reenters', () => {
  const f = fixture();
  let once = true;
  f.setProject((sample) => {
    if (once && !sample.translate) {
      once = false;
      f.sink.commit(f.frame(2));
      return false;
    }
    return true;
  });
  f.sink.commit(f.frame(1));
  f.advance(16);
  f.advance(516);
  expect(f.outcomes).toEqual(['2:finished']);
});

// Independent review counterexamples retained as regression coverage.
it('does not measure or acknowledge while the semantic preparation is still on stack when settle reenters', () => {
  const f = fixture();
  let once = true;
  let observed: unknown;
  f.setProject((sample) => {
    if (once && !sample.translate) {
      once = false;
      f.sink.settle('deadline');
      observed = {
        environments: f.calls.filter((c) => c.kind === 'environment').length,
        outcomes: [...f.outcomes],
      };
    }
    return true;
  });
  f.sink.commit(f.frame(1));
  expect(observed).toEqual({ environments: 0, outcomes: [] });
  expect(f.outcomes).toEqual(['1:deadline']);
  expect(f.frames.size).toBe(0);
});
it('preserves a cold-start frame delivery deferred through semantic preparation', () => {
  const f = fixture();
  const first = f.frame(1);
  f.sink.commit(first);
  let once = true;
  f.setProject((sample) => {
    if (once && !sample.translate) {
      once = false;
      f.advance(16);
    }
    return true;
  });
  f.sink.commit({ ...first, revision: 2, style: tw('flex', 'bg-background') });
  expect(f.frames.size).toBeGreaterThan(0);
  f.advance(516);
  expect(f.outcomes).toEqual(['1:finished']);
});
it('does not complete an initially entered no-attempt hidden frame', () => {
  const f = fixture();
  f.setVisible(false);
  const frame = f.frame(1);
  f.sink.commit({ ...frame, owner: { ...frame.owner, phase: 'entered', attempt: null } });
  expect(f.outcomes).toEqual([]);
});

it('drops a deferred settlement when preparation replaces its logical attempt', () => {
  const f = fixture();
  let once = true;
  f.setProject((sample) => {
    if (once && !sample.translate) {
      once = false;
      f.sink.settle('deadline');
      f.sink.commit(f.frame(2));
    }
    return true;
  });
  f.sink.commit(f.frame(1));
  f.advance(16);
  f.advance(516);
  expect(f.outcomes).toEqual(['2:finished']);
});
it('does not consume queued settlement or environment after a rejected preparation', () => {
  const f = fixture();
  f.setProject(() => {
    f.sink.settle('deadline');
    return false;
  });
  f.sink.commit(f.frame(1));
  expect(f.outcomes).toEqual(['1:projection-failed']);
  expect(f.calls.filter((c) => c.kind === 'environment')).toHaveLength(0);
  expect(f.frames.size).toBe(0);
});
it('requests a fresh cold acknowledgement after a queued delivery is superseded', () => {
  const f = fixture();
  const first = f.frame(1);
  f.sink.commit(first);
  let once = true;
  f.setProject((sample) => {
    if (once && !sample.translate) {
      once = false;
      f.advance(16);
      f.sink.commit({ ...first, revision: 3, style: tw('flex', 'border') });
    }
    return true;
  });
  f.sink.commit({ ...first, revision: 2, style: tw('flex', 'bg-background') });
  expect(f.frames.size).toBe(1);
  expect(f.outcomes).toEqual([]);
  f.advance(32);
  f.advance(532);
  expect(f.outcomes).toEqual(['1:finished']);
});

it('keeps a deferred logical deadline across a same-attempt semantic frame replacement', () => {
  const f = fixture();
  const first = f.frame(1);
  let once = true;
  f.setProject((sample) => {
    if (once && !sample.translate) {
      once = false;
      f.sink.settle('deadline');
      f.sink.commit({ ...first, revision: 2, style: tw('flex', 'bg-background') });
    }
    return true;
  });
  f.sink.commit(first);
  expect(f.outcomes).toEqual(['1:deadline']);
  expect(f.frames.size).toBe(0);
});

it('settles the latest same-attempt endpoint revision under its original deadline', () => {
  const f = fixture();
  const source = f.frame(1);
  const first: PresencePresentationFrame = {
    ...source,
    owner: { ...source.owner, phase: 'leaving' },
  };
  let once = true;
  f.setProject((sample) => {
    if (once && !sample.translate) {
      once = false;
      f.sink.settle('deadline');
      f.sink.commit({
        ...first,
        revision: 2,
        targetRevision: 2,
        closed: { translate: [zero, { ...zero, ownBox: 0.5 }] },
      });
    }
    return true;
  });
  f.sink.commit(first);
  expect(f.outcomes).toEqual(['1:deadline']);
  expect(f.calls.filter((c) => c.sample?.translate).at(-1)?.sample?.translate).toEqual([0, 96]);
  expect(f.frames.size).toBe(0);
});
