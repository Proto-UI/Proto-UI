import { defineAsHook, definePrototype } from '@proto.ui/core';
import { createRuntimeInstance } from '@proto.ui/runtime';
import { describe, expect, it } from 'vitest';

type CaptureView = {
  stateHandles?: Record<string, unknown>;
  getState?: (key: string) => unknown;
};

function observeProjection(kind: 'plain-data' | 'reentrant-getter') {
  const events: string[] = [];
  const replacementBag: Record<string, unknown> = {};
  const replacementGetState = (key: string) => replacementBag[key];
  let setupCalls = 0;
  let projectorCalls = 0;
  let callFacts: () => CaptureView;
  let captured: CaptureView | undefined;
  let reentered: CaptureView | undefined;
  let originalBag: Record<string, unknown> | undefined;
  let originalExpanded: unknown;
  let originalGetState: CaptureView['getState'];
  let returned: CaptureView | undefined;
  let cachedAfterProjection: CaptureView | undefined;
  let returnedExpanded: unknown;
  let returnedGetExpanded: unknown;

  // This value is created outside projectHandle. It receives no result
  // parameter or explicit alias from the projector.
  const external =
    kind === 'plain-data'
      ? { stateHandles: null, getState: null, marker: 'external' }
      : {
          get marker() {
            events.push('external:getter');
            reentered = callFacts();
            // The real Core once cache exposes the raw Result while its
            // projectHandle call has not assigned callerResult yet.
            reentered.stateHandles = replacementBag;
            reentered.getState = replacementGetState;
            events.push('external:replaced-capture');
            return 'external';
          },
        };

  callFacts = defineAsHook({
    name: 'projector-reentry-facts-' + kind,
    setup(def) {
      setupCalls++;
      def.state.bool('expanded', false);
    },
    projectHandle(result) {
      projectorCalls++;
      events.push('projector:enter');
      captured = result as unknown as CaptureView;
      originalBag = captured.stateHandles;
      originalExpanded = originalBag?.expanded;
      originalGetState = captured.getState;
      // This is the exact overwrite order whose unknown-spread case must
      // not be treated as a general noninterference proof.
      const projection = { ...external, ...result };
      events.push('projector:return');
      return projection as unknown as CaptureView;
    },
  });

  const proto = definePrototype({
    name: 'projector-reentry-consumer-' + kind,
    setup(def) {
      replacementBag.expanded = def.state.bool('replacement', false);
      returned = callFacts();
      returnedExpanded = returned.stateHandles?.expanded;
      returnedGetExpanded = returned.getState?.('expanded');
      cachedAfterProjection = callFacts();
    },
  });
  const instance = createRuntimeInstance(proto);
  try {
    return {
      events,
      setupCalls,
      projectorCalls,
      captured,
      reentered,
      originalBag,
      originalExpanded,
      originalGetState,
      replacementBag,
      replacementGetState,
      returned,
      returnedExpanded,
      returnedGetExpanded,
      cachedAfterProjection,
    };
  } finally {
    instance.dispose();
  }
}

describe('real Core/Runtime projector reentry', () => {
  it('restores capture fields after a closed data-only object spread', () => {
    const seen = observeProjection('plain-data');

    expect(seen.setupCalls).toBe(1);
    expect(seen.projectorCalls).toBe(1);
    expect(seen.originalExpanded).toBeDefined();
    expect(Object.isFrozen(seen.originalBag)).toBe(true);
    expect(seen.reentered).toBeUndefined();
    expect(seen.returned?.stateHandles).toBe(seen.originalBag);
    expect(seen.returned?.getState).toBe(seen.originalGetState);
    expect(seen.returnedExpanded).toBe(seen.originalExpanded);
    expect(seen.returnedGetExpanded).toBe(seen.originalExpanded);
    expect(seen.cachedAfterProjection).toBe(seen.returned);
    expect(seen.events).toEqual(['projector:enter', 'projector:return']);
  });

  it('lets an external getter reach the current Result through same-name reentry', () => {
    const seen = observeProjection('reentrant-getter');

    expect(seen.setupCalls).toBe(1);
    expect(seen.projectorCalls).toBe(1);
    expect(seen.originalExpanded).toBeDefined();
    expect(Object.isFrozen(seen.originalBag)).toBe(true);
    expect(seen.reentered).toBe(seen.captured);
    expect(seen.returned).not.toBe(seen.captured);
    expect(seen.returned?.stateHandles).toBe(seen.replacementBag);
    expect(seen.returned?.getState).toBe(seen.replacementGetState);
    expect(seen.returnedExpanded).toBe(seen.replacementBag.expanded);
    expect(seen.returnedGetExpanded).toBe(seen.replacementBag.expanded);
    expect(seen.returnedExpanded).not.toBe(seen.originalExpanded);
    expect(seen.cachedAfterProjection).toBe(seen.returned);
    expect(seen.events).toEqual([
      'projector:enter',
      'external:getter',
      'external:replaced-capture',
      'projector:return',
    ]);
  });
});
