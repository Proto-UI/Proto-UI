import { expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { selectRoot, SELECT_CONTEXT } from '../src/select';
import { drawerRoot, drawerContent } from '../src/drawer';
import { DRAWER_CONTEXT, DRAWER_CONTENT_CONTEXT } from '../src/drawer/shared';
import { createRuntimeSession } from '@proto.ui/runtime';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import {
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
  AS_TRIGGER_GET_PROTO_CAP,
} from '@proto.ui/module-as-trigger';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';

// Real Runtime sessions with deterministic host scheduling. Explicit lifecycle
// calls exercise terminal disposal/remount; no browser timing or geometry claim.
function runtimeHarness() {
  const parents = new Map<any, any>(),
    protos = new Map<any, any>();
  const actions: string[] = [];
  function make(proto: any, parent: any = null, props: any = {}) {
    const listeners = new Map<string, Set<any>>();
    const target = {
      addEventListener(type: string, fn: any) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      },
      removeEventListener(type: string, fn: any) {
        listeners.get(type)?.delete(fn);
      },
      dispatchEvent(event: Event) {
        for (const fn of [...(listeners.get(event.type) ?? [])]) fn(event);
        return true;
      },
    } as unknown as EventTarget;
    parents.set(target, parent);
    protos.set(target, proto);
    let exposes: any;
    const session = createRuntimeSession(proto, {
      prototypeName: proto.name,
      getRawProps: () => props,
      schedule: (fn) => fn(),
      scheduleDelay: (ms, fn) => {
        const id = setTimeout(fn, ms);
        return { cancel: () => clearTimeout(id) };
      },
      commit: (_c, s) => s?.done(),
      onRuntimeReady(w) {
        w.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, target],
          [ANATOMY_PARENT_CAP, (t: any) => parents.get(t) ?? null],
          [ANATOMY_GET_PROTO_CAP, (t: any) => protos.get(t)],
          [ANATOMY_ROOT_TARGET_CAP, (t: any) => t],
        ]);
        w.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, target],
          [CONTEXT_PARENT_CAP, (t: any) => parents.get(t) ?? null],
        ]);
        w.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => target],
          [EVENT_GLOBAL_TARGET_CAP, () => target],
        ]);
        w.attach('as-trigger', [
          [AS_TRIGGER_INSTANCE_CAP, target],
          [AS_TRIGGER_PARENT_CAP, (t: any) => parents.get(t) ?? null],
          [AS_TRIGGER_GET_PROTO_CAP, (t: any) => protos.get(t)],
        ]);
        w.attach('expose-state', [
          [
            EXPOSES_RECORD_SINK_CAP,
            (x: any) => {
              exposes = x;
            },
          ],
        ]);
        w.attach('expose-event', [
          [
            EXPOSE_EVENT_SINK_CAP,
            (name: string) => {
              actions.push(name);
            },
          ],
        ]);
      },
    });
    return {
      session,
      target,
      get exposes() {
        return exposes;
      },
    };
  }

  return {
    make,
    actions,
  };
}

type Part = ReturnType<ReturnType<typeof runtimeHarness>['make']>;
const modes = ['dispose', 'unmount', 'remount'] as const;
const valueRequest = (part: Part, value: string, textValue = value.toUpperCase()) =>
  part.session.invokeInCallbackScope(() =>
    part.exposes.requestValue({ value, textValue, reason: 'programmatic' })
  );
const openRequest = (part: Part, open: boolean) =>
  part.session.invokeInCallbackScope(() =>
    part.exposes.requestOpen({ open, reason: 'programmatic', focusReason: 'programmatic' })
  );
const snapRequest = (part: Part, value: number, reason = 'programmatic') =>
  part.session.invokeInCallbackScope(() => part.exposes.requestSnapPoint(value, reason));
const axis = (part: Part, phase: string, totalDelta: number) =>
  part.session.invokeInCallbackScope(() => part.exposes.__onAxisInput({ phase, totalDelta }));
const watch = (part: Part, name: string, callback: (next: unknown) => void) =>
  part.exposes[name].subscribe((event: any) => {
    if (event.type === 'next') callback(event.next);
  });
const snapEvents = (h: ReturnType<typeof runtimeHarness>) =>
  h.actions.filter((name) => name === 'snapPointChange');
const contentProps = { snapPoints: [0.25, 0.5, 1], enterDuration: 0, leaveDuration: 0 };

for (const boundary of ['value', 'textValue', 'context', 'open', 'open-context'] as const) {
  it.each(modes)(`Select ${boundary} notification yields after %s`, async (mode) => {
    const h = runtimeHarness();
    const root = h.make(selectRoot);
    const isOpen = boundary.startsWith('open');
    let armed = false,
      retired = false;
    const pending: Promise<void>[] = [];
    const retire = () => {
      if (!armed || retired) return;
      retired = true;
      pending.push(root.session[mode === 'dispose' ? 'dispose' : 'unmount']());
      if (mode === 'remount') {
        pending.push(root.session.mount());
        if (isOpen) openRequest(root, false);
        else valueRequest(root, 'new', 'New');
      }
    };
    const observer = h.make(
      definePrototype({
        name: `select-retirement-${boundary}-${mode}`,
        setup(def) {
          def.context.subscribe(SELECT_CONTEXT, () => {
            if (boundary.endsWith('context')) retire();
          });
        },
      }),
      root.target
    );
    await root.session.mount();
    await observer.session.mount();
    const off = boundary.endsWith('context') ? () => {} : watch(root, boundary, retire);
    armed = true;
    try {
      expect(() =>
        expect(isOpen ? openRequest(root, true) : valueRequest(root, 'old')).toBe(true)
      ).not.toThrow();
      expect(retired).toBe(true);
      expect(h.actions).toEqual(mode === 'remount' ? [isOpen ? 'openChange' : 'valueChange'] : []);
      if (mode === 'remount') {
        if (isOpen) expect(root.exposes.open.get()).toBe(false);
        else {
          expect(root.exposes.value.get()).toBe('new');
          expect(root.exposes.textValue.get()).toBe('New');
        }
      }
    } finally {
      off();
      await Promise.all(pending);
      await observer.session.dispose();
      await root.session.dispose();
    }
  });
}

for (const boundary of ['snapPoint', 'dragProgress', 'offsetPercentage', 'context'] as const) {
  it.each(modes)(`Drawer ${boundary} notification yields after %s`, async (mode) => {
    const h = runtimeHarness();
    const root = h.make(drawerRoot, null, { defaultOpen: true });
    const content = h.make(drawerContent, root.target, contentProps);
    let armed = false,
      retired = false;
    const pending: Promise<void>[] = [];
    const retire = () => {
      if (!armed || retired) return;
      retired = true;
      pending.push(content.session[mode === 'dispose' ? 'dispose' : 'unmount']());
      if (mode === 'remount') {
        pending.push(content.session.mount());
        snapRequest(content, 0.25, 'new');
      }
    };
    const observer = h.make(
      definePrototype({
        name: `drawer-retirement-${boundary}-${mode}`,
        setup(def) {
          def.context.subscribe(DRAWER_CONTENT_CONTEXT, () => {
            if (boundary === 'context') retire();
          });
        },
      }),
      content.target
    );
    await root.session.mount();
    await content.session.mount();
    await observer.session.mount();
    const off = boundary === 'context' ? () => {} : watch(content, boundary, retire);
    armed = true;
    try {
      expect(() => snapRequest(content, 0.5, 'old')).not.toThrow();
      expect(retired).toBe(true);
      expect(snapEvents(h)).toEqual(mode === 'remount' ? ['snapPointChange'] : []);
      if (mode === 'remount') {
        expect(content.exposes.snapPoint.get()).toBe(0.25);
        expect(content.exposes.dragProgress.get()).toBe(0.25);
        expect(content.exposes.offsetPercentage.get()).toBe(75);
      }
    } finally {
      off();
      await Promise.all(pending);
      await observer.session.dispose();
      await content.session.dispose();
      await root.session.dispose();
    }
  });
}

for (const boundary of ['start', 'progress', 'offset', 'context', 'end', 'snap-end'] as const) {
  it.each(modes)(`Drawer axis ${boundary} yields after %s`, async (mode) => {
    const h = runtimeHarness();
    const root = h.make(drawerRoot, null, { defaultOpen: true });
    const content = h.make(drawerContent, root.target, contentProps);
    let armed = false,
      retired = false;
    const pending: Promise<void>[] = [];
    const retire = () => {
      if (!armed || retired) return;
      retired = true;
      pending.push(content.session[mode === 'dispose' ? 'dispose' : 'unmount']());
      if (mode === 'remount') {
        pending.push(content.session.mount());
        axis(content, 'start', -0.1);
      }
    };
    const observer = h.make(
      definePrototype({
        name: `drawer-axis-retirement-${boundary}-${mode}`,
        setup(def) {
          def.context.subscribe(DRAWER_CONTENT_CONTEXT, () => {
            if (boundary === 'context') retire();
          });
        },
      }),
      content.target
    );
    await root.session.mount();
    await content.session.mount();
    await observer.session.mount();
    const state =
      boundary === 'start' || boundary === 'end'
        ? 'dragging'
        : boundary === 'progress'
          ? 'dragProgress'
          : boundary === 'snap-end'
            ? 'snapPoint'
            : 'offsetPercentage';
    const off =
      boundary === 'context'
        ? () => {}
        : watch(content, state, (next) => {
            if (boundary !== 'end' || next === false) retire();
          });
    try {
      armed = boundary === 'start';
      expect(() => axis(content, 'start', 0)).not.toThrow();
      armed = true;
      if (boundary !== 'start') expect(() => axis(content, 'end', -0.5)).not.toThrow();
      expect(retired).toBe(true);
      expect(snapEvents(h)).toEqual([]);
      if (mode === 'remount') {
        expect(content.exposes.dragging.get()).toBe(true);
        expect(content.exposes.dragProgress.get()).toBe(boundary === 'snap-end' ? 0.45 : 0.9);
      }
    } finally {
      off();
      await Promise.all(pending);
      await observer.session.dispose();
      await content.session.dispose();
      await root.session.dispose();
    }
  });
}

it.each(['uncontrolled', 'controlled', 'disabled', 'nested'])(
  'Select retains %s selection and repeated-request semantics',
  async (mode) => {
    const h = runtimeHarness();
    const root = h.make(
      selectRoot,
      null,
      mode === 'controlled' ? { value: 'owner' } : { disabled: mode === 'disabled' }
    );
    await root.session.mount();
    let nested = false;
    const off = watch(root, 'value', () => {
      if (mode !== 'nested' || nested) return;
      nested = true;
      valueRequest(root, 'new', 'New');
    });
    try {
      expect(valueRequest(root, 'first')).toBe(mode !== 'disabled');
      expect(root.exposes.value.get()).toBe(
        mode === 'disabled'
          ? ''
          : mode === 'controlled'
            ? 'owner'
            : mode === 'nested'
              ? 'new'
              : 'first'
      );
      expect(root.exposes.textValue.get()).toBe(
        mode === 'nested' ? 'New' : mode === 'uncontrolled' ? 'FIRST' : ''
      );
      expect(h.actions).toEqual(mode === 'disabled' ? [] : ['valueChange']);
      expect(valueRequest(root, 'second')).toBe(mode !== 'disabled');
      expect(root.exposes.value.get()).toBe(
        mode === 'disabled' ? '' : mode === 'controlled' ? 'owner' : 'second'
      );
      expect(h.actions).toHaveLength(mode === 'disabled' ? 0 : 2);
    } finally {
      off();
      await root.session.dispose();
    }
  }
);
it.each(['uncontrolled', 'controlled', 'disabled', 'intrinsic', 'nested'])(
  'Drawer retains %s snap and repeated-request semantics',
  async (mode) => {
    const h = runtimeHarness();
    const root = h.make(drawerRoot, null, { defaultOpen: true, disabled: mode === 'disabled' });
    const content = h.make(drawerContent, root.target, {
      ...(mode === 'intrinsic' ? { enterDuration: 0, leaveDuration: 0 } : contentProps),
      ...(mode === 'controlled' ? { snapPoint: 1 } : {}),
    });
    await root.session.mount();
    await content.session.mount();
    let nested = false;
    const off = watch(content, 'snapPoint', () => {
      if (mode !== 'nested' || nested) return;
      nested = true;
      snapRequest(content, 0.25, 'new');
    });
    try {
      snapRequest(content, 0.5, 'first');
      expect(content.exposes.snapPoint.get()).toBe(
        mode === 'uncontrolled' ? 0.5 : mode === 'nested' ? 0.25 : 1
      );
      expect(content.exposes.dragProgress.get()).toBe(content.exposes.snapPoint.get());
      expect(snapEvents(h)).toHaveLength(['disabled', 'intrinsic'].includes(mode) ? 0 : 1);
      snapRequest(content, 0.9, 'second');
      expect(content.exposes.snapPoint.get()).toBe(1);
      expect(snapEvents(h)).toHaveLength(
        ['disabled', 'intrinsic'].includes(mode) ? 0 : mode === 'controlled' ? 1 : 2
      );
    } finally {
      off();
      await content.session.dispose();
      await root.session.dispose();
    }
  }
);

it.each(['normal', 'source-error'])(
  'Drawer terminal release preserves a reentrant successor admission (%s)',
  async (mode) => {
    const h = runtimeHarness();
    const root = h.make(drawerRoot, null, { defaultOpen: true });
    const content = h.make(drawerContent, root.target, contentProps);
    let armed = false,
      replaced = false;
    let lease: number | undefined;
    const sentinel = new Error('release observer source error');
    const observer = h.make(
      definePrototype({
        name: `drawer-release-successor-${mode}`,
        setup(def) {
          def.context.subscribe(DRAWER_CONTEXT, (_run, next) => {
            if (!armed || replaced || next.contentAdmitted) return;
            replaced = true;
            root.session.invokeInCallbackScope(() => {
              lease = root.exposes.__admitContent('successor');
            });
            // Terminal ownership is already withdrawn even if release's Context
            // notification temporarily reenters the old Content callback.
            snapRequest(content, 0.25, 'obsolete-release-reentry');
            axis(content, 'start', -0.1);
            if (mode === 'source-error') throw sentinel;
          });
        },
      }),
      root.target
    );
    await root.session.mount();
    await content.session.mount();
    await observer.session.mount();
    let obsoleteSnapWrites = 0;
    const off = watch(content, 'snapPoint', () => {
      if (armed) obsoleteSnapWrites++;
    });
    armed = true;
    try {
      const terminal = content.session.dispose();
      if (mode === 'source-error') await expect(terminal).rejects.toBe(sentinel);
      else await terminal;
      expect(replaced).toBe(true);
      expect(obsoleteSnapWrites).toBe(0);
      expect(snapEvents(h)).toEqual([]);
      root.session.invokeInCallbackScope(() => {
        expect(root.exposes.__admitContent('successor')).toBe(lease);
        expect(() => root.exposes.__admitContent('unrelated')).toThrow('Only one live Content');
        root.exposes.__releaseContent('successor', lease);
      });
      const replacement = h.make(drawerContent, root.target, contentProps);
      await replacement.session.mount();
      try {
        snapRequest(replacement, 0.25, 'new-owner');
        axis(replacement, 'start', -0.2);
        expect(replacement.exposes.open.get()).toBe(true);
        expect(replacement.exposes.dragging.get()).toBe(true);
        expect(replacement.exposes.dragProgress.get()).toBe(0.2);
        expect(snapEvents(h)).toEqual(['snapPointChange']);
      } finally {
        await replacement.session.dispose();
      }
    } finally {
      off();
      await observer.session.dispose();
      await root.session.dispose();
    }
  }
);

it.each(['snapPoint', 'dragProgress', 'offsetPercentage'])(
  'Drawer %s retirement cannot alter a newly created Content',
  async (boundary) => {
    const h = runtimeHarness();
    const root = h.make(drawerRoot, null, { defaultOpen: true });
    const content = h.make(drawerContent, root.target, contentProps);
    await root.session.mount();
    await content.session.mount();
    let replacement: Part | undefined;
    const pending: Promise<void>[] = [];
    const off = watch(content, boundary, () => {
      if (replacement) return;
      pending.push(content.session.dispose());
      replacement = h.make(drawerContent, root.target, contentProps);
      pending.push(replacement.session.mount());
      snapRequest(replacement, 0.25, 'new-owner');
      axis(replacement, 'start', -0.2);
    });
    try {
      expect(() => snapRequest(content, 0.5, 'old-owner')).not.toThrow();
      await Promise.all(pending);
      expect(replacement).toBeDefined();
      expect(replacement!.exposes.open.get()).toBe(true);
      expect(replacement!.exposes.snapPoint.get()).toBe(0.25);
      expect(replacement!.exposes.dragging.get()).toBe(true);
      expect(replacement!.exposes.dragProgress.get()).toBe(0.2);
      expect(snapEvents(h)).toEqual(['snapPointChange']);
    } finally {
      off();
      await replacement?.session.dispose();
      await content.session.dispose();
      await root.session.dispose();
    }
  }
);

for (const boundary of ['dragging', 'dragProgress', 'context'] as const) {
  it.each(['dispose', 'remount'] as const)(
    `Drawer cancel ${boundary} yields after %s`,
    async (mode) => {
      const h = runtimeHarness();
      const root = h.make(drawerRoot, null, { defaultOpen: true });
      const content = h.make(drawerContent, root.target, contentProps);
      let armed = false,
        retired = false;
      const pending: Promise<void>[] = [];
      const retire = () => {
        if (!armed || retired) return;
        retired = true;
        pending.push(content.session[mode === 'dispose' ? 'dispose' : 'unmount']());
        if (mode === 'remount') {
          pending.push(content.session.mount());
          axis(content, 'start', -0.2);
        }
      };
      const observer = h.make(
        definePrototype({
          name: `drawer-cancel-retirement-${boundary}-${mode}`,
          setup(def) {
            def.context.subscribe(DRAWER_CONTENT_CONTEXT, () => {
              if (boundary === 'context') retire();
            });
          },
        }),
        content.target
      );
      await root.session.mount();
      await content.session.mount();
      await observer.session.mount();
      const off = boundary === 'context' ? () => {} : watch(content, boundary, retire);
      try {
        axis(content, 'start', -0.3);
        armed = true;
        expect(() => axis(content, 'cancel', 0)).not.toThrow();
        expect(retired).toBe(true);
        if (mode === 'remount') {
          expect(content.exposes.dragging.get()).toBe(true);
          expect(content.exposes.dragProgress.get()).toBe(0.8);
        }
        expect(snapEvents(h)).toEqual([]);
      } finally {
        off();
        await Promise.all(pending);
        await observer.session.dispose();
        await content.session.dispose();
        await root.session.dispose();
      }
    }
  );
}

it.each(['value', 'textValue', 'open', 'snapPoint', 'dragProgress', 'offsetPercentage'])(
  'Live %s subscriber errors propagate unchanged',
  async (boundary) => {
    const h = runtimeHarness();
    const isSelect = ['value', 'textValue', 'open'].includes(boundary);
    const root = h.make(
      isSelect ? selectRoot : drawerRoot,
      null,
      isSelect ? {} : { defaultOpen: true }
    );
    const part = isSelect ? root : h.make(drawerContent, root.target, contentProps);
    await root.session.mount();
    if (!isSelect) await part.session.mount();
    const sentinel = new Error(`source-${boundary}`);
    const off = watch(part, boundary, () => {
      throw sentinel;
    });
    try {
      expect(() =>
        isSelect
          ? boundary === 'open'
            ? openRequest(part, true)
            : valueRequest(part, 'next')
          : snapRequest(part, 0.5)
      ).toThrow(sentinel);
      expect(
        h.actions.filter((name) => ['openChange', 'valueChange', 'snapPointChange'].includes(name))
      ).toEqual([]);
    } finally {
      off();
      if (!isSelect) await part.session.dispose();
      await root.session.dispose();
    }
  }
);
it.each(['select-value', 'select-open', 'drawer-snap'])(
  'Live %s Context subscriber errors propagate unchanged',
  async (boundary) => {
    const h = runtimeHarness();
    const isSelect = boundary.startsWith('select');
    const root = h.make(
      isSelect ? selectRoot : drawerRoot,
      null,
      isSelect ? {} : { defaultOpen: true }
    );
    const part = isSelect ? root : h.make(drawerContent, root.target, contentProps);
    const sentinel = new Error(`context-source-${boundary}`);
    let armed = false;
    const observer = h.make(
      definePrototype({
        name: `retirement-source-error-${boundary}`,
        setup(def) {
          const fail = () => {
            if (armed) throw sentinel;
          };
          if (isSelect) def.context.subscribe(SELECT_CONTEXT, fail);
          else def.context.subscribe(DRAWER_CONTENT_CONTEXT, fail);
        },
      }),
      part.target
    );
    await root.session.mount();
    if (!isSelect) await part.session.mount();
    await observer.session.mount();
    armed = true;
    try {
      expect(() =>
        isSelect
          ? boundary === 'select-open'
            ? openRequest(part, true)
            : valueRequest(part, 'next')
          : snapRequest(part, 0.5)
      ).toThrow(sentinel);
      expect(
        h.actions.filter((name) => ['openChange', 'valueChange', 'snapPointChange'].includes(name))
      ).toEqual([]);
    } finally {
      armed = false;
      await observer.session.dispose();
      if (!isSelect) await part.session.dispose();
      await root.session.dispose();
    }
  }
);
