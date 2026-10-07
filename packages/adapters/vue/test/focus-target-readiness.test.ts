import { afterEach, describe, expect, it } from 'vitest';
import { createA11ySemanticObjectRef, definePrototype } from '@proto.ui/core';
import {
  FOCUS_ROOT_TARGET_CAP,
  FOCUS_REQUEST_FOCUS_CAP,
  FOCUS_BLUR_CAP,
  type FocusRequestKind,
} from '@proto.ui/module-focus';
import { A11Y_PROJECT_CAP, type A11yProjector } from '@proto.ui/module-a11y';
import { createVueModules } from '../src/runtime/modules';
import {
  createLogicalInstance,
  markProtoInstance,
  unbindProtoInstance,
  registerNativeFocusReadiness,
} from '../src/platform/instance-tree';

afterEach(() => document.body.replaceChildren());

describe('Vue Focus target readiness', () => {
  it('withholds focus acquisition without hiding the connected target from blur and projection', () => {
    const prototype = definePrototype({ name: 'vue-focus-readiness-control', setup() {} });
    const instanceToken = createLogicalInstance(prototype);
    const target = document.createElement('div');
    target.tabIndex = 0;
    document.body.append(target);
    markProtoInstance(target, prototype, instanceToken);
    let effectsReady = true;
    let focusReady = false;
    const args = {
      el: target,
      instanceToken,
      router: { rootTarget: new EventTarget(), globalTarget: window },
      emit() {},
      rawPropsSource: { debugName: 'readiness-test', get: () => ({}), subscribe: () => () => {} },
      effectsPort: { queueStyle() {}, requestFlush() {}, flushNow() {} },
      getMeta: () => undefined,
      setExposes() {},
      runInCallbackScope: (fn: () => void) => fn(),
      isViewReady: () => effectsReady,
      isEntryAcquisitionReady: () => focusReady,
      getCurrentElement: () => target,
      subscribeTargetReady: () => () => {},
      retryTargetReady() {},
    };
    const releaseReadiness = registerNativeFocusReadiness(instanceToken, {
      isReady: () => focusReady,
      subscribe: () => () => {},
    });
    const modules = createVueModules(args);
    const getTarget = new Map(modules.focus({ prototypeName: prototype.name })).get(
      FOCUS_ROOT_TARGET_CAP
    ) as () => HTMLElement | null;
    try {
      // This controlled temporal split is the reported native boundary: the
      // physical target exists, but a host:focus event would still be dropped.
      expect(getTarget()).toBe(target);
      const caps = new Map(modules.focus({ prototypeName: prototype.name }));
      const request = caps.get(FOCUS_REQUEST_FOCUS_CAP) as (
        target: HTMLElement,
        options: undefined,
        kind: FocusRequestKind
      ) => boolean;
      const blur = caps.get(FOCUS_BLUR_CAP) as (target: HTMLElement) => void;
      expect(request(target, undefined, 'native')).toBe(false);
      expect(request(target, undefined, 'entry')).toBe(false);
      expect(document.activeElement).not.toBe(target);
      expect(request(target, undefined, 'programmatic')).toBe(true);
      expect(document.activeElement).toBe(target);
      blur(getTarget()!);
      expect(document.activeElement).not.toBe(target);
      const project = new Map(modules.a11y({ prototypeName: prototype.name })).get(
        A11Y_PROJECT_CAP
      ) as A11yProjector;
      project({
        role: 'button',
        objectRef: createA11ySemanticObjectRef(),
        name: { kind: 'text', value: 'Readiness control' },
        states: {},
        relations: {},
        actions: {},
      });
      expect(target.getAttribute('role')).toBe('button');
      expect(target.getAttribute('aria-label')).toBe('Readiness control');
      project.dispose?.();
      focusReady = true;
      expect(request(target, undefined, 'native')).toBe(true);
      expect(document.activeElement).toBe(target);
      expect(getTarget()).toBe(target);
      effectsReady = false;
      expect(getTarget()).toBeNull();
      effectsReady = true;
      target.remove();
      expect(getTarget()).toBeNull();
    } finally {
      releaseReadiness();
      unbindProtoInstance(target);
    }
  });
});
