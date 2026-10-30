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
import toggle from '../src/toggle';
import path from 'node:path';
import { collectProtoStyleTokens } from '../../../cli/src/services/prototype-style-tokens';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
  renderProtoShadowSplitStyleArtifact,
} from '../../../cli/src/services/proto-style-css';
import { SHADCN_STYLE_TOKENS } from '../../../cli/src/generated/shadcn-style-tokens';

async function fixture(
  initialScheme: 'light' | 'dark' = 'light',
  initial: Record<string, unknown> = {}
) {
  let colorScheme = initialScheme;
  let raw: Record<string, unknown> = initial;
  const root = new EventTarget();
  const global = new EventTarget();
  const clicks: string[] = [];
  const host: RuntimeHost<any> = {
    prototypeName: toggle.name,
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
  const session = createRuntimeSession(toggle, host);
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

// Independent expected recipe, read from shadcn-ui/ui 02cad61166c4c20edbc8a3f71bd720eed4c1f49b
// apps/v4/registry/new-york-v4/ui/toggle.tsx (blob0291f01cff0429bbf2fb3575a15867556cc88a89).
// Upstream source is reference-only; no upstream React/Radix implementation is executed.
it.each([
  ['default', 'h-9', 'min-w-9', 'px-2', '2.25rem'],
  ['sm', 'h-8', 'min-w-8', 'px-1.5', '2rem'],
  ['lg', 'h-10', 'min-w-10', 'px-2.5', '2.5rem'],
])(
  'New York %s dimensions retain exact height/minimum width and horizontal padding',
  async (size, height, minimum, padding, rem) => {
    const ctx = await fixture('light', { size });
    try {
      for (const token of [height, minimum, padding]) expect(ctx.tokens()).toContain(token);
      expect(ctx.tokens()).not.toContain('border');
      expect(ctx.tokens()).not.toContain('rounded-lg');
      const css = renderProtoStyleTokenCss([height, minimum, padding]);
      expect(css).toContain(`height: ${rem};`);
      expect(css).toContain(`min-width: ${rem};`);
      expect(css).not.toContain('Unsupported Proto UI style tokens');
    } finally {
      await ctx.session.dispose();
    }
  }
);

for (const scheme of ['light', 'dark'] as const) {
  it.each(['default', 'outline'])(
    'New York ' + scheme + ' %s hover and active palettes follow the pinned recipe',
    async (variant) => {
      const ctx = await fixture(scheme, { variant });
      try {
        expect(ctx.tokens()).toContain('bg-transparent');
        expect(ctx.tokens().includes('border-input')).toBe(variant === 'outline');
        expect(ctx.tokens().includes('shadow-xs')).toBe(variant === 'outline');
        ctx.emit('pointer.enter');
        expect(ctx.tokens()).toContain(variant === 'outline' ? 'bg-accent' : 'bg-muted');
        expect(ctx.tokens()).toContain(
          variant === 'outline' ? 'text-accent-foreground' : 'text-muted-foreground'
        );
        ctx.emit('press.commit');
        expect(ctx.tokens()).toContain('bg-accent');
        expect(ctx.tokens()).toContain('text-accent-foreground');
        expect(ctx.tokens()).not.toContain('bg-muted');
        expect(ctx.tokens()).not.toContain('text-muted-foreground');
        expect(ctx.clicks).toEqual(['activeChange']);
        ctx.emit('pointer.leave');
        expect(ctx.tokens()).toContain('bg-accent');
        ctx.props({ variant, active: true, disabled: true });
        expect(ctx.tokens()).toContain('bg-accent');
        expect(ctx.tokens()).toContain('opacity-50');
        expect(ctx.tokens()).toContain('pointer-events-none');
        ctx.emit('press.commit');
        expect(ctx.clicks).toEqual(['activeChange']);
      } finally {
        await ctx.session.dispose();
      }
    }
  );
}

it('restores default sizing/variant after omission and retains the theme-independent active recipe', async () => {
  const ctx = await fixture('light', { variant: 'outline', size: 'lg', active: true });
  try {
    ctx.scheme('dark');
    expect(ctx.tokens()).toContain('bg-accent');
    expect(ctx.tokens()).not.toContain('bg-input/50');
    ctx.props({ active: false });
    expect(ctx.tokens()).toContain('h-9');
    expect(ctx.tokens()).toContain('px-2');
    expect(ctx.tokens()).not.toContain('shadow-xs');
    expect(ctx.tokens()).not.toContain('border-input');
    expect(ctx.tokens()).not.toContain('bg-accent');
  } finally {
    await ctx.session.dispose();
  }
});

it('closes the real Toggle source through the existing physical style translator', async () => {
  const tokens = (await collectProtoStyleTokens(
    path.resolve('packages/prototypes/shadcn/src/toggle')
  )) as string[];
  expect(SHADCN_STYLE_TOKENS).toEqual(expect.arrayContaining(tokens));
  for (const css of [
    renderProtoStyleTokenCss(tokens),
    renderProtoShadowStyleTokenCss(tokens),
    renderProtoShadowSplitStyleArtifact(tokens).cssText,
  ]) {
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('color: var(--pui-muted-foreground);');
    expect(css).toContain('background-color: var(--pui-accent);');
    expect(css).toContain('color: var(--pui-accent-foreground);');
    expect(css).toContain('transition-property: color, box-shadow;');
  }
});
