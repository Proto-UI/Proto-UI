import { describe, expect, it } from 'vitest';
import type { A11ySemanticObjectSnapshot, Prototype } from '@proto.ui/core';
import type { ProtoAdapterExposes } from '@proto.ui/adapter-base';
import type { RuntimeHost } from '@proto.ui/runtime';
import { executeWithHost } from '@proto.ui/runtime';
import {
  FOCUS_REQUEST_FOCUS_CAP,
  FOCUS_ROOT_TARGET_CAP,
  FOCUS_SET_FOCUSABLE_CAP,
} from '@proto.ui/module-focus';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import {
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';
import { A11Y_PROJECT_CAP } from '@proto.ui/module-a11y';
import { EXPOSE_STATE_SET_EXPOSES_CAP } from '@proto.ui/module-expose-state';
import toggle from '../src/toggle';
import type { BrutalistToggleExposes, BrutalistToggleProps } from '../src/toggle';

type TogglePrototype = Prototype<BrutalistToggleProps, BrutalistToggleExposes> & {
  __asHooks?: Array<{ name: string; mode?: string }>;
};
type ToggleRuntimeExposes = ProtoAdapterExposes<typeof toggle>;

type ToggleContext = {
  rootTarget: EventTarget;
  globalTarget: EventTarget;
  activeChanges: Array<{ active: boolean }>;
  a11ySnapshots: A11ySemanticObjectSnapshot[];
  applyRawProps(next: BrutalistToggleProps): void;
  getExposes(): ToggleRuntimeExposes;
  host: RuntimeHost<BrutalistToggleProps>;
};

function createToggleContext(initialRaw: BrutalistToggleProps = {}): ToggleContext {
  let rawProps: BrutalistToggleProps = { ...initialRaw };
  const rootTarget = new EventTarget();
  const globalTarget = new EventTarget();
  const activeChanges: Array<{ active: boolean }> = [];
  const a11ySnapshots: A11ySemanticObjectSnapshot[] = [];
  let exposes: ToggleRuntimeExposes | null = null;

  const host: RuntimeHost<BrutalistToggleProps> = {
    prototypeName: 'brutalist-toggle-test',
    getRawProps: () => rawProps,
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
      wiring.attach('expose-event', [
        [
          EXPOSE_EVENT_SINK_CAP,
          (key: string, payload: unknown) => {
            if (key === 'activeChange') activeChanges.push(payload as { active: boolean });
          },
        ],
      ]);
      wiring.attach('focus', [
        [FOCUS_ROOT_TARGET_CAP, () => rootTarget],
        [FOCUS_SET_FOCUSABLE_CAP, () => undefined],
        [FOCUS_REQUEST_FOCUS_CAP, () => undefined],
      ]);
      wiring.attach('as-trigger', [
        [AS_TRIGGER_INSTANCE_CAP, rootTarget],
        [AS_TRIGGER_PARENT_CAP, () => null],
        [AS_TRIGGER_GET_PROTO_CAP, () => null],
      ]);
      wiring.attach('a11y', [
        [A11Y_PROJECT_CAP, (snapshot: A11ySemanticObjectSnapshot) => a11ySnapshots.push(snapshot)],
      ]);
      wiring.attach('expose-state', [
        [
          EXPOSE_STATE_SET_EXPOSES_CAP,
          (next: Record<string, unknown>) => {
            exposes = next as ToggleRuntimeExposes;
          },
        ],
      ]);
    },
  };

  return {
    rootTarget,
    globalTarget,
    activeChanges,
    a11ySnapshots,
    applyRawProps(next) {
      rawProps = { ...next };
    },
    getExposes() {
      if (!exposes) throw new Error('Toggle exposes were not projected.');
      return exposes;
    },
    host,
  };
}

function executeToggle(initialRaw: BrutalistToggleProps = {}) {
  const context = createToggleContext(initialRaw);
  const runtime = executeWithHost(toggle, context.host);
  return { context, ...runtime };
}

describe('prototypes/brutalist: toggle', () => {
  it('projects its direct entry and Base Toggle contract exactly once', () => {
    // T-BRUTALIST-TOGGLE-0001-CASE-1
    const { context, invokeUnmounted } = executeToggle();
    const hooks = (toggle as TogglePrototype).__asHooks ?? [];

    expect(toggle.name).toBe('brutalist-toggle');
    expect(hooks.filter((hook) => hook.name === 'as-toggle')).toEqual([
      expect.objectContaining({ name: 'as-toggle', mode: 'once' }),
    ]);
    expect(context.getExposes().active.get()).toBe(false);
    expect(context.a11ySnapshots.at(-1)).toMatchObject({
      role: 'button',
      name: { kind: 'content' },
      states: { pressed: false, disabled: false },
      actions: { activate: { event: 'activeChange' } },
    });

    invokeUnmounted();
  });

  it('co-selects the active background and foreground pair', () => {
    // T-BRUTALIST-TOGGLE-0001-CASE-2
    const { context, controller, invokeUnmounted } = executeToggle({ defaultActive: false });

    context.rootTarget.dispatchEvent(new CustomEvent('press.commit'));
    const tokens = controller.getRuleStyleTokens();

    expect(context.getExposes().active.get()).toBe(true);
    expect(tokens).toContain('bg-main');
    expect(tokens).toContain('text-main-foreground');
    expect(context.activeChanges).toEqual([{ active: true }]);
    expect(context.a11ySnapshots.at(-1)).toMatchObject({
      states: { pressed: true, disabled: false },
    });

    invokeUnmounted();
  });

  it('uses a persistent inset frame as the active non-color signal', () => {
    // T-BRUTALIST-TOGGLE-0001-CASE-7
    const { context, controller, invokeUnmounted } = executeToggle({ defaultActive: true });
    const tokens = controller.getRuleStyleTokens();

    expect(context.getExposes().active.get()).toBe(true);
    expect(tokens).toContain('shadow-[inset_0_0_0_2px_#000,3px_3px_0_0_#000]');

    invokeUnmounted();
  });

  it.each([
    ['default', ['h-10', 'min-w-10', 'px-3', 'text-sm'], ['h-9', 'h-12']],
    ['sm', ['h-9', 'min-w-9', 'px-2.5', 'text-xs'], ['h-10', 'h-12']],
    ['lg', ['h-12', 'min-w-12', 'px-4', 'text-base'], ['h-10', 'h-9']],
  ] as const)('maps size %s to one dimension-token set', (size, present, absent) => {
    // T-BRUTALIST-TOGGLE-0001-CASE-3
    const { controller, invokeUnmounted } = executeToggle({ size });
    const tokens = controller.getRuleStyleTokens();

    for (const token of present) expect(tokens).toContain(token);
    for (const token of absent) expect(tokens).not.toContain(token);

    invokeUnmounted();
  });

  it('restores reactive defaults without resetting owned active state', () => {
    // T-BRUTALIST-TOGGLE-0001-CASE-4
    const { context, controller, invokeUnmounted } = executeToggle();
    expect(context.getExposes().active.get()).toBe(false);

    context.rootTarget.dispatchEvent(new CustomEvent('press.commit'));
    expect(context.getExposes().active.get()).toBe(true);

    context.applyRawProps({ size: 'lg', disabled: true });
    controller.applyRawProps({ size: 'lg', disabled: true });
    expect(controller.getRuleStyleTokens()).toEqual(
      expect.arrayContaining(['h-12', 'opacity-50', 'pointer-events-none'])
    );
    expect(context.getExposes().disabled.get()).toBe(true);

    context.applyRawProps({});
    controller.applyRawProps({});
    const restoredTokens = controller.getRuleStyleTokens();
    expect(restoredTokens).toContain('h-10');
    expect(restoredTokens).not.toContain('h-12');
    expect(restoredTokens).not.toContain('opacity-50');
    expect(context.getExposes().disabled.get()).toBe(false);
    expect(context.getExposes().active.get()).toBe(true);

    invokeUnmounted();
  });

  it('keeps square borders, a hard shadow, and flat paired fills', () => {
    // T-BRUTALIST-TOGGLE-0001-CASE-5
    const { controller, invokeUnmounted } = executeToggle();
    const tokens = controller.getRuleStyleTokens();

    expect(tokens).toEqual(
      expect.arrayContaining([
        'rounded-none',
        'border-2',
        'border-black',
        'bg-secondary-background',
        'text-foreground',
        'shadow-[3px_3px_0_0_#000]',
      ])
    );
    for (const forbidden of ['rounded-lg', 'shadow-lg', 'backdrop-blur', 'bg-gradient-to-r']) {
      expect(tokens).not.toContain(forbidden);
    }

    invokeUnmounted();
  });

  it('activates hover, press, focus-visible, and disabled rules from real states', () => {
    // T-BRUTALIST-TOGGLE-0001-CASE-6
    const { context, controller, invokeUnmounted } = executeToggle();

    context.rootTarget.dispatchEvent(new CustomEvent('pointer.enter'));
    let tokens = controller.getRuleStyleTokens();
    expect(context.getExposes().hovered.get()).toBe(true);
    expect(tokens).toEqual(
      expect.arrayContaining(['-translate-x-px', '-translate-y-px', 'shadow-[4px_4px_0_0_#000]'])
    );

    context.rootTarget.dispatchEvent(new CustomEvent('pointer.down'));
    tokens = controller.getRuleStyleTokens();
    expect(context.getExposes().pressed.get()).toBe(true);
    expect(tokens).toEqual(
      expect.arrayContaining(['translate-x-px', 'translate-y-px', 'shadow-none'])
    );
    context.rootTarget.dispatchEvent(new CustomEvent('pointer.up'));
    expect(context.getExposes().pressed.get()).toBe(false);

    context.globalTarget.dispatchEvent(new CustomEvent('key.down'));
    context.rootTarget.dispatchEvent(new CustomEvent('host:focus'));
    tokens = controller.getRuleStyleTokens();
    expect(context.getExposes().focusVisible.get()).toBe(true);
    expect(tokens).toEqual(
      expect.arrayContaining(['ring-2', 'ring-ring', 'ring-offset-2', 'ring-offset-background'])
    );

    const eventCount = context.activeChanges.length;
    context.applyRawProps({ disabled: true });
    controller.applyRawProps({ disabled: true });
    context.rootTarget.dispatchEvent(new CustomEvent('pointer.enter'));
    context.rootTarget.dispatchEvent(new CustomEvent('pointer.down'));
    context.rootTarget.dispatchEvent(new CustomEvent('press.commit'));
    tokens = controller.getRuleStyleTokens();
    expect(context.getExposes().disabled.get()).toBe(true);
    expect(context.getExposes().hovered.get()).toBe(false);
    expect(context.getExposes().pressed.get()).toBe(false);
    expect(context.activeChanges).toHaveLength(eventCount);
    expect(tokens).toEqual(
      expect.arrayContaining(['pointer-events-none', 'opacity-50', 'rounded-none'])
    );

    invokeUnmounted();
  });

  it('gives press precedence over hover and outer active elevation', () => {
    // T-BRUTALIST-TOGGLE-0001-CASE-8
    const { context, controller, invokeUnmounted } = executeToggle();

    context.rootTarget.dispatchEvent(new CustomEvent('pointer.enter'));
    context.rootTarget.dispatchEvent(new CustomEvent('pointer.down'));
    let tokens = controller.getRuleStyleTokens();
    expect(context.getExposes().hovered.get()).toBe(true);
    expect(context.getExposes().pressed.get()).toBe(true);
    expect(tokens).toEqual(
      expect.arrayContaining(['translate-x-px', 'translate-y-px', 'shadow-none'])
    );
    expect(tokens).not.toContain('-translate-x-px');
    expect(tokens).not.toContain('-translate-y-px');
    expect(tokens).not.toContain('shadow-[4px_4px_0_0_#000]');

    context.rootTarget.dispatchEvent(new CustomEvent('pointer.leave'));
    expect(context.getExposes().hovered.get()).toBe(false);
    expect(context.getExposes().pressed.get()).toBe(false);

    context.rootTarget.dispatchEvent(new CustomEvent('press.commit'));
    context.rootTarget.dispatchEvent(new CustomEvent('pointer.down'));
    tokens = controller.getRuleStyleTokens();
    expect(context.getExposes().active.get()).toBe(true);
    expect(context.getExposes().pressed.get()).toBe(true);
    expect(tokens).toContain('shadow-[inset_0_0_0_2px_#000]');
    expect(tokens).not.toContain('shadow-[inset_0_0_0_2px_#000,3px_3px_0_0_#000]');

    context.rootTarget.dispatchEvent(new CustomEvent('pointer.leave'));
    tokens = controller.getRuleStyleTokens();
    expect(tokens).toContain('shadow-[inset_0_0_0_2px_#000,3px_3px_0_0_#000]');

    invokeUnmounted();
  });
});
