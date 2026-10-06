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

describe('prototypes/shadcn: button', () => {
  it('maps variant/size/disabled props to rule style tokens', () => {
    let rawProps: Record<string, unknown> = {
      variant: 'default',
      size: 'default',
      disabled: false,
    };

    const rootTarget = new EventTarget();
    const globalTarget = new EventTarget();

    const host: RuntimeHost<any> = {
      prototypeName: 'x-shadcn-button-style',
      getRawProps() {
        return rawProps as any;
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
      },
    };

    const { controller } = executeWithHost(button as any, host as any);

    // T-SHADCN-BUTTON-0001-CASE-IDENTITY-AND-INHERITANCE:
    // the current projection installs asButton and declares no negative patch.
    expect(button.name).toBe('shadcn-button');
    expect((button as any).__asHooks).toContainEqual(
      expect.objectContaining({ name: 'as-button', mode: 'once' })
    );

    let tokens = controller.getRuleStyleTokens();
    expect(tokens).toContain('bg-primary');
    expect(tokens).not.toContain('border-border');
    expect(tokens).toContain('h-8');
    expect(tokens).not.toContain('opacity-50');

    rawProps = { variant: 'destructive', size: 'lg', disabled: true };
    controller.applyRawProps(rawProps as any);
    tokens = controller.getRuleStyleTokens();
    expect(tokens).toContain('bg-destructive/10');
    expect(tokens).toContain('h-9');
    expect(tokens).toContain('opacity-50');

    rawProps = { variant: 'outline', size: 'default', disabled: false };
    controller.applyRawProps(rawProps as any);
    tokens = controller.getRuleStyleTokens();
    expect(tokens).toContain('border-border');

    rawProps = { wrap: true, size: 'default' };
    controller.applyRawProps(rawProps as any);
    tokens = controller.getRuleStyleTokens();
    expect(tokens).toContain('whitespace-normal');
    expect(tokens).toContain('min-h-8');
    expect(tokens).toContain('max-w-full');
    expect(tokens).not.toContain('h-8');
    expect(tokens).not.toContain('whitespace-nowrap');
    rawProps = { wrap: true, size: 'icon' };
    controller.applyRawProps(rawProps as any);
    tokens = controller.getRuleStyleTokens();
    expect(tokens).toContain('size-8');
    expect(tokens).not.toContain('whitespace-normal');

    rawProps = {};
    controller.applyRawProps(rawProps as any);
    tokens = controller.getRuleStyleTokens();
    expect(tokens).toContain('bg-primary');
    expect(tokens).not.toContain('border-border');
    expect(tokens).toContain('h-8');
    expect(tokens).not.toContain('opacity-50');
  });

  it('derives hover/focus/press style rules from asButton state handles', () => {
    const rootTarget = new EventTarget();
    const globalTarget = new EventTarget();

    const host: RuntimeHost<any> = {
      prototypeName: 'x-shadcn-button-interaction',
      getRawProps() {
        return {
          variant: 'default',
          size: 'default',
          disabled: false,
        } as any;
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
      },
    };

    const { controller } = executeWithHost(button as any, host as any);

    rootTarget.dispatchEvent(new CustomEvent('pointer.enter'));
    let tokens = controller.getRuleStyleTokens();
    expect(tokens).toContain('bg-primary/80');

    globalTarget.dispatchEvent(new CustomEvent('key.down'));
    rootTarget.dispatchEvent(new CustomEvent('host:focus'));
    tokens = controller.getRuleStyleTokens();
    expect(tokens).toContain('ring-3');
    expect(tokens).toContain('border-ring');

    rootTarget.dispatchEvent(new CustomEvent('pointer.down'));
    tokens = controller.getRuleStyleTokens();
    expect(tokens).toContain('translate-y-px');
    expect(tokens).not.toContain('ring-3');
  });

  it('applies dark-mode meta rules for variants that shadcn styles specially', () => {
    let colorScheme: 'light' | 'dark' = 'light';
    const rootTarget = new EventTarget();
    const globalTarget = new EventTarget();

    const host: RuntimeHost<any> = {
      prototypeName: 'x-shadcn-button-dark',
      getRawProps() {
        return {
          variant: 'outline',
          size: 'default',
          disabled: false,
        } as any;
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
          [RULE_META_GET_CAP, (key: string) => (key === 'colorScheme' ? colorScheme : undefined)],
        ]);
      },
    };

    const { controller } = executeWithHost(button as any, host as any);

    let tokens = controller.getRuleStyleTokens();
    expect(tokens).not.toContain('border-input');

    colorScheme = 'dark';
    tokens = controller.getRuleStyleTokens();
    expect(tokens).toContain('border-input');
    expect(tokens).toContain('bg-input/30');
  });
});
