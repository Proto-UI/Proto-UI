import { expect, it } from 'vitest';
import { createRuntimeSession, type RuntimeHost } from '@proto.ui/runtime';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import { RULE_META_GET_CAP } from '@proto.ui/module-rule-meta';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import {
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';
import button from '../src/button';

// Separate pinned profiles: Rhea/Luma 25af02b1 and explicit New York 02cad611.
// Neither profile may accept the other profile's hover palette.
// This exercises the real prototype and inherited Button states, not copied rules.
async function fixture(
  initialScheme: 'light' | 'dark' = 'light',
  disabled = false,
  styleProfile: 'new-york' | 'rhea' | 'luma' = 'rhea'
) {
  let colorScheme = initialScheme;
  let raw: Record<string, unknown> = { variant: 'ghost', disabled, styleProfile };
  const root = new EventTarget();
  const global = new EventTarget();
  const clicks: string[] = [];
  const host: RuntimeHost<any> = {
    prototypeName: button.name,
    getRawProps: () => raw,
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(wiring) {
      wiring.attach('context', [
        [CONTEXT_INSTANCE_TOKEN_CAP, root],
        [CONTEXT_PARENT_CAP, () => null],
      ]);
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => root],
        [EVENT_GLOBAL_TARGET_CAP, () => global],
      ]);
      wiring.attach('as-trigger', [
        [AS_TRIGGER_INSTANCE_CAP, root],
        [AS_TRIGGER_PARENT_CAP, () => null],
        [AS_TRIGGER_GET_PROTO_CAP, () => null],
      ]);
      wiring.attach('rule-meta', [
        [RULE_META_GET_CAP, (key: string) => (key === 'colorScheme' ? colorScheme : undefined)],
      ]);
      wiring.attach('expose-event', [[EXPOSE_EVENT_SINK_CAP, (key: string) => clicks.push(key)]]);
    },
  };
  const session = createRuntimeSession(button, host);
  await session.mount();
  return {
    session,
    clicks,
    emit: (type: string) => root.dispatchEvent(new CustomEvent(type)),
    global: (type: string) => global.dispatchEvent(new CustomEvent(type)),
    scheme: (next: 'light' | 'dark') => (colorScheme = next),
    props(next: Record<string, unknown>) {
      raw = next;
      session.controller.applyRawProps(next);
    },
    tokens: () => session.controller.getRuleStyleTokens(),
  };
}

function expectRest(tokens: readonly string[]) {
  for (const token of [
    'bg-accent',
    'bg-accent/50',
    'text-accent-foreground',
    'bg-muted',
    'bg-muted/50',
  ])
    expect(tokens).not.toContain(token);
}

it.each(['light', 'dark'] as const)(
  'ghost %s hover enters and leaves the pinned Rhea/Luma muted recipe',
  async (scheme) => {
    const ctx = await fixture(scheme);
    try {
      expectRest(ctx.tokens());
      ctx.emit('pointer.enter');
      expect(ctx.tokens()).toContain(scheme === 'dark' ? 'bg-muted/50' : 'bg-muted');
      expect(ctx.tokens()).toContain('text-foreground');
      expect(ctx.tokens()).not.toContain('bg-accent');
      expect(ctx.tokens().includes('bg-muted/50')).toBe(scheme === 'dark');
      ctx.emit('pointer.leave');
      expectRest(ctx.tokens());
    } finally {
      await ctx.session.dispose();
    }
  }
);

it('re-evaluates dark and light while the same ghost remains hovered', async () => {
  const ctx = await fixture();
  try {
    ctx.emit('pointer.enter');
    expect(ctx.tokens()).toContain('bg-muted');
    ctx.scheme('dark');
    expect(ctx.tokens()).toContain('bg-muted/50');
    ctx.scheme('light');
    expect(ctx.tokens()).not.toContain('bg-muted/50');
    expect(ctx.tokens()).toContain('text-foreground');
  } finally {
    await ctx.session.dispose();
  }
});

it('removes ghost-only dark paint on variant replacement and prop omission', async () => {
  const ctx = await fixture('dark');
  try {
    ctx.emit('pointer.enter');
    expect(ctx.tokens()).toContain('bg-muted/50');
    ctx.props({ variant: 'outline' });
    expect(ctx.tokens()).not.toContain('bg-muted/50');
    expect(ctx.tokens()).toContain('bg-input/30');
    ctx.props({});
    expect(ctx.tokens()).toContain('bg-primary/80');
    expect(ctx.tokens()).not.toContain('bg-primary/90');
    expect(ctx.tokens()).not.toContain('bg-muted/50');
    expect(ctx.tokens()).not.toContain('text-foreground');
    ctx.props({ variant: 'ghost' });
    expect(ctx.tokens()).toContain('bg-muted/50');
  } finally {
    await ctx.session.dispose();
  }
});

it.each(['light', 'dark'] as const)(
  'retains inherited disabled suppression and transient cleanup in %s',
  async (scheme) => {
    const ctx = await fixture(scheme, true);
    try {
      ctx.emit('pointer.enter');
      ctx.emit('press.commit');
      expectRest(ctx.tokens());
      expect(ctx.clicks).toEqual([]);
      ctx.props({ variant: 'ghost', disabled: false });
      ctx.emit('pointer.enter');
      expect(ctx.tokens()).toContain('text-foreground');
      ctx.props({ variant: 'ghost', disabled: true });
      expectRest(ctx.tokens());
      expect(ctx.tokens()).toContain('opacity-50');
      ctx.emit('press.commit');
      expect(ctx.clicks).toEqual([]);
    } finally {
      await ctx.session.dispose();
    }
  }
);

it('preserves inherited focus, press and exactly one click without changing paint ownership', async () => {
  const ctx = await fixture('dark');
  try {
    ctx.global('key.down');
    ctx.emit('host:focus');
    expect(ctx.tokens()).toContain('ring-3');
    expectRest(ctx.tokens());
    ctx.emit('pointer.enter');
    ctx.emit('pointer.down');
    expect(ctx.tokens()).toContain('translate-y-px');
    expect(ctx.tokens()).toContain('bg-muted/50');
    ctx.emit('press.commit');
    expect(ctx.clicks).toEqual(['click']);
    expect(ctx.tokens()).not.toContain('translate-y-px');
    ctx.emit('pointer.cancel');
    expectRest(ctx.tokens());
  } finally {
    await ctx.session.dispose();
  }
});

it('does not retain ghost hover paint across a real unmount and remount', async () => {
  const ctx = await fixture('dark');
  try {
    ctx.emit('pointer.enter');
    expect(ctx.tokens()).toContain('bg-muted/50');
    await ctx.session.unmount();
    await ctx.session.mount();
    expectRest(ctx.tokens());
    ctx.emit('pointer.enter');
    expect(ctx.tokens()).toContain('bg-muted/50');
  } finally {
    await ctx.session.dispose();
  }
});

it.each(['light', 'dark'] as const)(
  'explicit New York %s retains the fixed accent recipe and profile replacement',
  async (scheme) => {
    const ctx = await fixture(scheme, false, 'new-york');
    try {
      expectRest(ctx.tokens());
      ctx.emit('pointer.enter');
      expect(ctx.tokens()).toContain(scheme === 'dark' ? 'bg-accent/50' : 'bg-accent');
      expect(ctx.tokens()).toContain('text-accent-foreground');
      expect(ctx.tokens()).not.toContain('bg-muted');
      expect(ctx.tokens()).not.toContain('bg-muted/50');
      for (const styleProfile of ['rhea', 'luma', 'new-york'] as const) {
        ctx.props({ styleProfile, variant: 'ghost' });
        expect(ctx.tokens()).toContain(
          styleProfile === 'new-york'
            ? scheme === 'dark'
              ? 'bg-accent/50'
              : 'bg-accent'
            : scheme === 'dark'
              ? 'bg-muted/50'
              : 'bg-muted'
        );
        expect(ctx.tokens()).not.toContain(
          styleProfile === 'new-york' ? 'bg-muted/50' : 'bg-accent/50'
        );
      }
      ctx.emit('pointer.leave');
      expectRest(ctx.tokens());
      ctx.props({ styleProfile: 'new-york', variant: 'ghost', disabled: true });
      ctx.emit('pointer.enter');
      expectRest(ctx.tokens());
      expect(ctx.tokens()).toContain('pointer-events-none');
    } finally {
      await ctx.session.dispose();
    }
  }
);
