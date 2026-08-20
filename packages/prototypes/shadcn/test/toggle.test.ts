import { describe, expect, it } from 'vitest';
import type { A11ySemanticObjectSnapshot } from '@proto.ui/core';
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
import toggle from '../src/toggle';

describe('prototypes/shadcn: toggle', () => {
  it('maps variant, size, active and disabled to style tokens', () => {
    let rawProps: Record<string, unknown> = {
      variant: 'default',
      size: 'default',
      defaultActive: false,
      disabled: false,
    };

    const rootTarget = new EventTarget();
    const globalTarget = new EventTarget();
    const activeChanges: Array<{ active: boolean }> = [];
    const a11ySnapshots: A11ySemanticObjectSnapshot[] = [];

    const host: RuntimeHost<any> = {
      prototypeName: 'x-shadcn-toggle-style',
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
          [
            A11Y_PROJECT_CAP,
            (snapshot: A11ySemanticObjectSnapshot) => {
              a11ySnapshots.push(snapshot);
            },
          ],
        ]);
      },
    };

    const { controller } = executeWithHost(toggle as any, host as any);

    // T-SHADCN-TOGGLE-0001-CASE-IDENTITY-AND-INHERITANCE:
    // the current projection installs asToggle and declares no negative patch.
    expect(toggle.name).toBe('shadcn-toggle');
    expect((toggle as any).__asHooks).toContainEqual(
      expect.objectContaining({ name: 'as-toggle', mode: 'once' })
    );

    let tokens = controller.getRuleStyleTokens();
    expect(tokens).toContain('h-8');
    expect(tokens).toContain('bg-transparent');
    expect(tokens).toContain('text-foreground');

    rootTarget.dispatchEvent(new CustomEvent('press.commit'));
    tokens = controller.getRuleStyleTokens();
    expect(tokens).toContain('bg-muted');
    expect(tokens).toContain('text-foreground');
    expect(tokens).not.toContain('bg-muted/60');
    expect(tokens).not.toContain('text-muted-foreground');
    expect(activeChanges).toEqual([{ active: true }]);
    expect(a11ySnapshots.at(-1)).toMatchObject({
      role: 'button',
      states: { pressed: true, disabled: false },
    });

    rawProps = { variant: 'outline', size: 'sm', defaultActive: false, disabled: true };
    controller.applyRawProps(rawProps as any);
    tokens = controller.getRuleStyleTokens();
    expect(tokens).toContain('border-input');
    expect(tokens).toContain('h-7');
    expect(tokens).toContain('opacity-50');
    expect(tokens).not.toContain('bg-accent');
    expect(tokens).not.toContain('text-accent-foreground');
  });
});
