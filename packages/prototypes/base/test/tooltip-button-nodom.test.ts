// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { definePrototype, type A11ySemanticObjectSnapshot, type Prototype } from '@proto.ui/core';
import { executeWithHost, type RuntimeHost } from '@proto.ui/runtime';
import { A11Y_PROJECT_CAP } from '@proto.ui/module-a11y';
import {
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import {
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { EXPOSE_STATE_SET_EXPOSES_CAP } from '@proto.ui/module-expose-state';
import {
  FOCUS_BLUR_CAP,
  FOCUS_INSTANCE_TOKEN_CAP,
  FOCUS_PARENT_CAP,
  FOCUS_REQUEST_FOCUS_CAP,
  FOCUS_ROOT_TARGET_CAP,
  FOCUS_SET_FOCUSABLE_CAP,
} from '@proto.ui/module-focus';
import { asButton, type ButtonExposes, type ButtonProps } from '../src/button';
import { tooltipContent, tooltipRoot, tooltipTrigger, useTooltipTrigger } from '../src/tooltip';

type NativeNode = {
  id: string;
  target: EventTarget;
  parent: NativeNode | null;
  proto: Prototype<any>;
  focusable: boolean;
  focused: boolean;
  exposes: Record<string, any> | null;
  a11y: A11ySemanticObjectSnapshot | null;
  emitted: Array<{ key: string; payload: unknown }>;
  rawProps: Record<string, unknown>;
  updateProps(next: Record<string, unknown>): void;
  focus(): void;
  blur(): void;
  unmount(): void;
};

function createNativeTree() {
  const globalTarget = new EventTarget();
  const nodes = new Set<NativeNode>();
  let activeNode: NativeNode | null = null;

  const focusNode = (next: NativeNode | null) => {
    if (activeNode === next) return;
    const prev = activeNode;
    activeNode = next;
    if (prev) {
      prev.focused = false;
      prev.target.dispatchEvent(new Event('host:blur'));
    }
    if (next) {
      next.focused = true;
      next.target.dispatchEvent(new Event('host:focus'));
    }
  };

  function mount(
    id: string,
    proto: Prototype<any>,
    parent: NativeNode | null,
    initialProps: Record<string, unknown> = {}
  ): NativeNode {
    const target = new EventTarget();
    const node: NativeNode = {
      id,
      target,
      parent,
      proto,
      focusable: false,
      focused: false,
      exposes: null,
      a11y: null,
      emitted: [],
      rawProps: { ...initialProps },
      updateProps() {},
      focus() {
        if (!node.focusable) return;
        focusNode(node);
      },
      blur() {
        if (activeNode === node) focusNode(null);
      },
      unmount() {},
    };
    nodes.add(node);

    const getParent = (instance: unknown) => (instance as NativeNode | null)?.parent ?? null;
    const getPrototype = (instance: unknown) => (instance as NativeNode | null)?.proto ?? null;

    const host: RuntimeHost<any> = {
      prototypeName: proto.name,
      getRawProps: () => node.rawProps,
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        task();
      },
      scheduleDelay(ms, task) {
        const id = setTimeout(task, ms);
        return { cancel: () => clearTimeout(id) };
      },
      onRuntimeReady(wiring) {
        wiring.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, node],
          [CONTEXT_PARENT_CAP, getParent],
        ]);
        wiring.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, node],
          [ANATOMY_PARENT_CAP, getParent],
          [ANATOMY_GET_PROTO_CAP, getPrototype],
          [ANATOMY_ROOT_TARGET_CAP, (instance: unknown) => (instance as NativeNode).target],
        ]);
        wiring.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => target],
          [EVENT_GLOBAL_TARGET_CAP, () => globalTarget],
        ]);
        wiring.attach('expose-state', [
          [EXPOSE_STATE_SET_EXPOSES_CAP, (next: Record<string, unknown>) => (node.exposes = next)],
        ]);
        wiring.attach('expose-event', [
          [
            EXPOSE_EVENT_SINK_CAP,
            (key: string, payload?: unknown) => node.emitted.push({ key, payload }),
          ],
        ]);
        wiring.attach('as-trigger', [
          [AS_TRIGGER_INSTANCE_CAP, target],
          [
            AS_TRIGGER_PARENT_CAP,
            (instance: unknown) =>
              [...nodes].find((n) => n.target === instance)?.parent?.target ?? null,
          ],
          [
            AS_TRIGGER_GET_PROTO_CAP,
            (instance: unknown) => [...nodes].find((n) => n.target === instance)?.proto ?? null,
          ],
        ]);
        wiring.attach('a11y', [
          [A11Y_PROJECT_CAP, (snapshot: A11ySemanticObjectSnapshot) => (node.a11y = snapshot)],
        ]);
        wiring.attach('focus', [
          [FOCUS_ROOT_TARGET_CAP, () => target],
          [FOCUS_INSTANCE_TOKEN_CAP, node],
          [FOCUS_PARENT_CAP, getParent],
          [
            FOCUS_SET_FOCUSABLE_CAP,
            (_target: unknown, enabled: boolean) => {
              node.focusable = enabled;
              if (!enabled && activeNode === node) focusNode(null);
            },
          ],
          [
            FOCUS_REQUEST_FOCUS_CAP,
            () => {
              if (!node.focusable) return false;
              focusNode(node);
              return true;
            },
          ],
          [
            FOCUS_BLUR_CAP,
            () => {
              if (activeNode === node) focusNode(null);
            },
          ],
        ]);
      },
    };

    const session = executeWithHost(proto as any, host);
    node.updateProps = (next) => {
      node.rawProps = { ...node.rawProps, ...next };
      session.controller.applyRawProps(node.rawProps as any);
    };
    node.unmount = () => {
      if (activeNode === node) focusNode(null);
      session.invokeUnmounted();
      nodes.delete(node);
    };
    return node;
  }

  return {
    mount,
    cleanup() {
      for (const node of [...nodes].reverse()) node.unmount();
    },
  };
}

const TooltipButton = definePrototype<ButtonProps, ButtonExposes>({
  name: 'nodom-tooltip-button',
  setup() {
    asButton();
    useTooltipTrigger();
  },
});

const DisabledTooltipButton = definePrototype<ButtonProps, ButtonExposes>({
  name: 'nodom-tooltip-disabled-button',
  setup(def) {
    asButton();
    def.props.setDefaults({ disabled: true });
    useTooltipTrigger();
  },
});

describe('prototypes/base: tooltip + button no-DOM native host mounting', () => {
  const trees: Array<ReturnType<typeof createNativeTree>> = [];

  afterEach(() => {
    while (trees.length > 0) trees.pop()!.cleanup();
    vi.useRealTimers();
  });

  it('mounts Tooltip + Button with zero DOM globals and preserves single focus owner and describedBy relation', async () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
    expect(typeof HTMLElement).toBe('undefined');

    vi.useFakeTimers();
    const tree = createNativeTree();
    trees.push(tree);

    const root = tree.mount('root', tooltipRoot, null, { openDelay: 0, closeDelay: 0 });
    const button = tree.mount('button', TooltipButton, root);
    const content = tree.mount('content', tooltipContent, root);

    expect(button.focusable).toBe(true);
    expect(content.focusable).toBe(false);
    expect(button.a11y?.role).toBe('button');
    expect(root.exposes?.open.get()).toBe(false);

    // Focus opens the tooltip and projects the describedBy relation to the content part.
    button.focus();
    await vi.advanceTimersByTimeAsync(0);
    expect(root.exposes?.open.get()).toBe(true);
    expect(button.a11y?.relations?.describedBy?.length).toBeGreaterThan(0);

    // Blur closes the tooltip and clears describedBy.
    button.blur();
    await vi.advanceTimersByTimeAsync(0);
    expect(root.exposes?.open.get()).toBe(false);
    expect(button.a11y?.relations?.describedBy ?? []).toHaveLength(0);

    // Pointer hover also opens, and disabling the root closes and blocks focusability.
    button.target.dispatchEvent(new Event('pointer.enter'));
    await vi.advanceTimersByTimeAsync(0);
    expect(root.exposes?.open.get()).toBe(true);

    root.updateProps({ disabled: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(root.exposes?.open.get()).toBe(false);
  });

  it('preserves command-owned disabled default and mounts standalone trigger without DOM globals', () => {
    expect(typeof HTMLElement).toBe('undefined');

    const tree = createNativeTree();
    trees.push(tree);

    const root = tree.mount('root', tooltipRoot, null, { openDelay: 0, closeDelay: 0 });
    const disabledButton = tree.mount('disabled-button', DisabledTooltipButton, root);
    expect(disabledButton.exposes?.disabled.get()).toBe(true);
    expect(disabledButton.focusable).toBe(false);

    const standaloneRoot = tree.mount('standalone-root', tooltipRoot, null, {
      openDelay: 0,
      closeDelay: 0,
    });
    const trigger = tree.mount('standalone-trigger', tooltipTrigger, standaloneRoot);
    expect(trigger.focusable).toBe(true);
  });
});
