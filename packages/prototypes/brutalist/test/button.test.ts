import { describe, expect, it } from 'vitest';
import type { RuntimeHost } from '@proto.ui/runtime';
import { executeWithHost } from '@proto.ui/runtime';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import { RULE_META_GET_CAP } from '@proto.ui/module-rule-meta';
import {
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';
import button from '../src/button';

const SOLID_PAIRS: Record<string, { bg: string; fg: string }> = {
  main: { bg: 'bg-main', fg: 'text-main-foreground' },
  mint: { bg: 'bg-mint', fg: 'text-mint-foreground' },
  lavender: { bg: 'bg-lavender', fg: 'text-lavender-foreground' },
  coral: { bg: 'bg-coral', fg: 'text-coral-foreground' },
  sky: { bg: 'bg-sky', fg: 'text-sky-foreground' },
};

const SIZE_TYPOGRAPHY = new Set(['text-sm', 'text-xs', 'text-base']);

function colorTextTokens(tokens: string[]): string[] {
  return tokens.filter((t) => t.startsWith('text-') && !SIZE_TYPOGRAPHY.has(t));
}

function createButtonHost(
  rawPropsRef: { current: Record<string, unknown> },
  colorSchemeRef: { current: 'light' | 'dark' } = { current: 'light' }
) {
  const rootTarget = new EventTarget();
  const globalTarget = new EventTarget();
  const host: RuntimeHost<any> = {
    prototypeName: 'x-brutalist-button',
    getRawProps() {
      return rawPropsRef.current as any;
    },
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(wiring) {
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => rootTarget],
        [EVENT_GLOBAL_TARGET_CAP, () => globalTarget],
      ]);
      wiring.attach('as-trigger', [
        [AS_TRIGGER_INSTANCE_CAP, rootTarget],
        [AS_TRIGGER_PARENT_CAP, () => null],
        [AS_TRIGGER_GET_PROTO_CAP, () => null],
      ]);
      wiring.attach('rule-meta', [
        [
          RULE_META_GET_CAP,
          (key: string) => (key === 'colorScheme' ? colorSchemeRef.current : null),
        ],
      ]);
    },
  };
  return { host, rootTarget, globalTarget };
}

describe('prototypes/brutalist: button', () => {
  // T-BRUTALIST-BUTTON-0001-CASE-1 / P-BRUTALIST-BUTTON-ENTRY, P-BRUTALIST-BUTTON-BASE-INHERITANCE
  it('exposes the direct brutalist-button entry and inherits Base Button as-hook', () => {
    const rawPropsRef = { current: {} as Record<string, unknown> };
    const { host } = createButtonHost(rawPropsRef);
    executeWithHost(button as any, host as any);

    expect(button.name).toBe('brutalist-button');
    expect((button as any).__asHooks).toContainEqual(
      expect.objectContaining({ name: 'as-button', mode: 'once' })
    );
  });

  // T-BRUTALIST-BUTTON-0001-CASE-2 / P-BRUTALIST-BUTTON-DEFAULTS, P-BRUTALIST-BUTTON-SIZE-PROP
  it('defaults to solid/main/default and restores defaults when props are removed', () => {
    const rawPropsRef: { current: Record<string, unknown> } = {
      current: { variant: 'surface', color: 'mint', size: 'lg', disabled: true },
    };
    const { host } = createButtonHost(rawPropsRef);
    const { controller } = executeWithHost(button as any, host as any);

    let tokens = controller.getRuleStyleTokens();
    expect(tokens).toContain('bg-secondary-background');
    expect(tokens).toContain('h-12');
    expect(tokens).toContain('opacity-50');

    rawPropsRef.current = {};
    controller.applyRawProps(rawPropsRef.current as any);
    tokens = controller.getRuleStyleTokens();
    expect(tokens).toContain('bg-main');
    expect(tokens).toContain('text-main-foreground');
    expect(tokens).toContain('h-10');
    expect(tokens).not.toContain('opacity-50');
    expect(tokens).not.toContain('bg-secondary-background');
  });

  // T-BRUTALIST-BUTTON-0001-CASE-3 / P-BRUTALIST-BUTTON-COLOR-PROP, P-BRUTALIST-BUTTON-PAIR-INVARIANT
  it('pairs every solid color with its intended foreground token', () => {
    const rawPropsRef: { current: Record<string, unknown> } = {
      current: { variant: 'solid', color: 'main', size: 'default' },
    };
    const { host } = createButtonHost(rawPropsRef);
    const { controller } = executeWithHost(button as any, host as any);

    for (const [color, pair] of Object.entries(SOLID_PAIRS)) {
      rawPropsRef.current = { variant: 'solid', color, size: 'default' };
      controller.applyRawProps(rawPropsRef.current as any);
      const tokens = controller.getRuleStyleTokens();
      expect(tokens).toContain(pair.bg);
      expect(tokens).toContain(pair.fg);
      expect(colorTextTokens(tokens)).toEqual([pair.fg]);
    }
  });

  // T-BRUTALIST-BUTTON-0001-CASE-4 / P-BRUTALIST-BUTTON-VARIANT-PROP
  it('projects surface and destructive fills with paired foregrounds', () => {
    const rawPropsRef: { current: Record<string, unknown> } = {
      current: { variant: 'surface', size: 'sm' },
    };
    const { host } = createButtonHost(rawPropsRef);
    const { controller } = executeWithHost(button as any, host as any);

    let tokens = controller.getRuleStyleTokens();
    expect(tokens).toContain('bg-secondary-background');
    expect(tokens).toContain('text-foreground');
    expect(tokens).toContain('h-9');
    expect(tokens).not.toContain('bg-main');

    rawPropsRef.current = { variant: 'destructive', size: 'icon' };
    controller.applyRawProps(rawPropsRef.current as any);
    tokens = controller.getRuleStyleTokens();
    expect(tokens).toContain('bg-destructive');
    expect(tokens).toContain('text-destructive-foreground');
    expect(tokens).toContain('size-10');
  });

  // T-BRUTALIST-BUTTON-0001-CASE-5 / P-BRUTALIST-BUTTON-VISUAL-GRAMMAR
  it('keeps square geometry, black structural border, and hard offset shadow', () => {
    const rawPropsRef = { current: { variant: 'solid', color: 'main' } as Record<string, unknown> };
    const { host } = createButtonHost(rawPropsRef);
    const { controller } = executeWithHost(button as any, host as any);
    const tokens = controller.getRuleStyleTokens();

    expect(tokens).toContain('rounded-none');
    expect(tokens).toContain('border-2');
    expect(tokens).toContain('border-black');
    expect(tokens).toContain('shadow-[3px_3px_0_0_#000]');
    expect(tokens).not.toContain('rounded-lg');
    expect(tokens).not.toContain('shadow-lg');
  });

  // T-BRUTALIST-BUTTON-0001-CASE-6 / P-BRUTALIST-BUTTON-INTERACTION
  it('derives hover press focus-visible and disabled styling from Base Button state', () => {
    const rawPropsRef = {
      current: { variant: 'solid', color: 'main', size: 'default', disabled: false },
    };
    const { host, rootTarget, globalTarget } = createButtonHost(rawPropsRef);
    const { controller } = executeWithHost(button as any, host as any);

    rootTarget.dispatchEvent(new CustomEvent('pointer.enter'));
    let tokens = controller.getRuleStyleTokens();
    expect(tokens).toContain('shadow-[4px_4px_0_0_#000]');
    expect(tokens).toContain('-translate-x-px');
    expect(tokens).toContain('-translate-y-px');

    rootTarget.dispatchEvent(new CustomEvent('pointer.down'));
    tokens = controller.getRuleStyleTokens();
    expect(tokens).toContain('translate-x-px');
    expect(tokens).toContain('translate-y-px');
    expect(tokens).toContain('shadow-none');

    rootTarget.dispatchEvent(new CustomEvent('pointer.up'));
    rootTarget.dispatchEvent(new CustomEvent('pointer.leave'));

    // Keyboard focus path: key.down then host:focus sets focusVisible.
    globalTarget.dispatchEvent(new CustomEvent('key.down'));
    rootTarget.dispatchEvent(new CustomEvent('host:focus'));
    tokens = controller.getRuleStyleTokens();
    expect(tokens).toContain('ring-2');
    expect(tokens).toContain('ring-ring');
    expect(tokens).toContain('ring-offset-2');

    rawPropsRef.current = { variant: 'solid', color: 'main', size: 'default', disabled: true };
    controller.applyRawProps(rawPropsRef.current as any);
    tokens = controller.getRuleStyleTokens();
    expect(tokens).toContain('pointer-events-none');
    expect(tokens).toContain('opacity-50');
    expect(tokens).toContain('bg-main');
    expect(tokens).toContain('text-main-foreground');
  });

  // T-BRUTALIST-BUTTON-0001-CASE-7 / P-BRUTALIST-BUTTON-LIGHT-DARK, P-BRUTALIST-BUTTON-PAIR-INVARIANT
  it('keeps solid accent pairs identical under light and dark colorScheme meta', () => {
    const colorSchemeRef = { current: 'light' as 'light' | 'dark' };
    const rawPropsRef: { current: Record<string, unknown> } = {
      current: { variant: 'solid', color: 'mint', size: 'default' },
    };
    const { host } = createButtonHost(rawPropsRef, colorSchemeRef);
    const { controller } = executeWithHost(button as any, host as any);

    const lightTokens = controller.getRuleStyleTokens();
    expect(lightTokens).toContain('bg-mint');
    expect(lightTokens).toContain('text-mint-foreground');
    expect(lightTokens).not.toContain('text-foreground');

    colorSchemeRef.current = 'dark';
    const darkTokens = controller.getRuleStyleTokens();
    expect(darkTokens).toContain('bg-mint');
    expect(darkTokens).toContain('text-mint-foreground');
    expect(colorTextTokens(darkTokens)).toEqual(['text-mint-foreground']);
  });

  // T-BRUTALIST-BUTTON-0001-CASE-9 / P-BRUTALIST-BUTTON-SIZE-PROP
  it('maps every size option to the expected dimension tokens', () => {
    const rawPropsRef: { current: Record<string, unknown> } = {
      current: { size: 'default' },
    };
    const { host } = createButtonHost(rawPropsRef);
    const { controller } = executeWithHost(button as any, host as any);

    const expected: Record<string, string> = {
      default: 'h-10',
      sm: 'h-9',
      lg: 'h-12',
      icon: 'size-10',
    };
    for (const [size, token] of Object.entries(expected)) {
      rawPropsRef.current = { size };
      controller.applyRawProps(rawPropsRef.current as any);
      expect(controller.getRuleStyleTokens()).toContain(token);
    }
  });
});
