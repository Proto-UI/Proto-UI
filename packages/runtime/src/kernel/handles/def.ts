// packages/runtime/src/kernel/handles/def.ts
import {
  type DefHandle,
  type ProtoEventCallback,
  type RunHandle,
  type StyleHandle,
} from '@proto.ui/core';
import { getAsHookRuntime } from '@proto.ui/core/internal';
import { illegalPhase } from '../guard';
import type { RuleSpec, RuleFacade } from '@proto.ui/module-rule';
import type {
  EventTypeV0,
  ExposeEventSpec,
  HostEventListenerOptions,
  PropsBaseType,
} from '@proto.ui/types';
import type { ModuleOrchestratorFacadeView } from '../../orchestrator/module-orchestrator/types';
import type { FeedbackFacade } from '@proto.ui/module-feedback';
import type { PropsFacade } from '@proto.ui/module-props';
import type { EventChannelFacade } from '@proto.ui/module-event';
import type { ExposeEventFacade } from '@proto.ui/module-expose-event';
import type { StateFacade } from '@proto.ui/module-state';
import type { StateInteractionFacade } from '@proto.ui/module-state-interaction';
import type { StateAccessibilityFacade } from '@proto.ui/module-state-accessibility';
import type { A11yFacade } from '@proto.ui/module-a11y';
import type { ContextFacade } from '@proto.ui/module-context';
import { createExposeEventDeclaration, type ExposeFacade } from '@proto.ui/module-expose';
import type { AnatomyFacade } from '@proto.ui/module-anatomy';
import { RuntimeEventCallbacks } from '../event';

export type LifecycleKind = 'created' | 'mounted' | 'updated' | 'unmounted' | 'beforeDispose';

export interface LifecycleRegistry<P extends PropsBaseType> {
  created: Array<(run: RunHandle<P>) => void>;
  mounted: Array<(run: RunHandle<P>) => void>;
  updated: Array<(run: RunHandle<P>) => void>;
  unmounted: Array<(run: RunHandle<P>) => void>;
  beforeDispose: Array<(run: RunHandle<P>) => void>;
}

export interface DefRuntimeState {
  getPhase(): 'setup' | 'render' | 'callback' | 'unknown';
  prototypeName: string;
}

export interface EventCallbacksSink<P extends PropsBaseType> {
  setEventCallbacks(callbacks: RuntimeEventCallbacks<P>): void;
}

export function createLifecycleRegistry<P extends PropsBaseType>(): LifecycleRegistry<P> {
  return { created: [], mounted: [], updated: [], unmounted: [], beforeDispose: [] };
}

export const createDefHandle = <P extends PropsBaseType, E = Record<string, unknown>>(
  st: DefRuntimeState,
  life: LifecycleRegistry<P>,
  rules: RuleFacade<P>,
  modules: ModuleOrchestratorFacadeView,
  eventSink?: EventCallbacksSink<P>
): DefHandle<P, E> => {
  const recordCaptured = (
    def: DefHandle<P, E>,
    kind: 'props' | 'state' | 'context' | 'event' | 'feedback',
    entry: unknown
  ) => {
    const rt = getAsHookRuntime(def as object);
    rt?.recordCaptured(kind, entry);
  };
  const registerStateHandle = (def: DefHandle<P, E>, handle: unknown) => {
    const rt = getAsHookRuntime(def as object);
    const name = (handle as any)?.__stateName;
    rt?.registerStateName(name, (handle as any)?.__stateId);
  };

  const facades = modules.getFacades();
  const feedback = facades['feedback'] as FeedbackFacade;
  const props = facades['props'] as PropsFacade<P>;

  const state = facades['state'] as StateFacade;
  const stateInteraction = facades['state-interaction'] as StateInteractionFacade | undefined;
  const stateAccessibility = facades['state-accessibility'] as StateAccessibilityFacade | undefined;
  const a11y = facades['a11y'] as A11yFacade | undefined;
  const context = facades['context'] as ContextFacade;
  const expose = facades['expose'] as ExposeFacade;
  const anatomy = facades['anatomy'] as AnatomyFacade | undefined;

  const eventFacade = facades['event'] as EventChannelFacade;
  const exposeEventFacade = facades['expose-event'] as ExposeEventFacade;
  const eventCallbacks = new RuntimeEventCallbacks<P>();
  eventSink?.setEventCallbacks(eventCallbacks);

  const ensureSetup = (op: string) => {
    const phase = st.getPhase();
    if (phase !== 'setup') {
      illegalPhase(op, st.prototypeName, phase, `Use 'run' inside runtime callbacks, not 'def'.`);
    }
  };

  const def: DefHandle<P, E> = {
    lifecycle: {
      onCreated(cb) {
        ensureSetup(`def.lifecycle.onCreated`);
        life.created.push(cb);
      },
      onMounted(cb) {
        ensureSetup(`def.lifecycle.onMounted`);
        life.mounted.push(cb);
      },
      onUpdated(cb) {
        ensureSetup(`def.lifecycle.onUpdated`);
        life.updated.push(cb);
      },
      onUnmounted(cb) {
        ensureSetup(`def.lifecycle.onUnmounted`);
        life.unmounted.push(cb);
      },
      onBeforeDispose(cb) {
        ensureSetup(`def.lifecycle.onBeforeDispose`);
        life.beforeDispose.push(cb);
      },
    },

    props: {
      define(specMap) {
        ensureSetup(`def.props.define`);
        props.define(specMap);
        recordCaptured(def, 'props', { op: 'define', specMap });
      },
      setDefaults(partial) {
        ensureSetup(`def.props.setDefaults`);
        props.setDefaults(partial);
        recordCaptured(def, 'props', { op: 'setDefaults', partial });
      },

      // Wrap user callback so module-props does NOT depend on RunHandle type.
      watch(keys, cb) {
        ensureSetup(`def.props.watch`);
        const off = props.watch(keys as any, (ctx, next, prev, info) =>
          (cb as any)(ctx as RunHandle<P>, next, prev, info)
        );
        recordCaptured(def, 'props', { op: 'watch', keys: [...keys], off });
        return off;
      },
      watchAll(cb) {
        ensureSetup(`def.props.watchAll`);
        const off = props.watchAll((ctx, next, prev, info) =>
          (cb as any)(ctx as RunHandle<P>, next, prev, info)
        );
        recordCaptured(def, 'props', { op: 'watchAll', off });
        return off;
      },
      watchRaw(keys, cb) {
        ensureSetup(`def.props.watchRaw`);
        const off = props.watchRaw(keys as any, (ctx, next, prev, info) =>
          (cb as any)(ctx as RunHandle<P>, next, prev, info)
        );
        recordCaptured(def, 'props', { op: 'watchRaw', keys: [...keys], off });
        return off;
      },
      watchRawAll(cb) {
        ensureSetup(`def.props.watchRawAll`);
        const off = props.watchRawAll((ctx, next, prev, info) =>
          (cb as any)(ctx as RunHandle<P>, next, prev, info)
        );
        recordCaptured(def, 'props', { op: 'watchRawAll', off });
        return off;
      },
    },

    feedback: {
      style: {
        use: (...handles: StyleHandle[]) => {
          ensureSetup(`def.feedback.style.use`);
          const unUse = feedback.style.use(...handles);
          recordCaptured(def, 'feedback', unUse);
          return () => {
            ensureSetup(`def.feedback.style.use:unUse`);
            unUse();
          };
        },
      },
    },

    expose: (() => {
      const fn = (key: any, value: any) => {
        ensureSetup('def.expose');
        expose.expose(key as any, value as any);
        recordCaptured(def, 'context', { op: 'expose', key, value });
      };

      fn.event = (key: string, spec?: ExposeEventSpec) => {
        ensureSetup('def.expose.event');
        expose.expose(key, createExposeEventDeclaration(spec));
        exposeEventFacade.registerExposeEvent(key, spec);
        recordCaptured(def, 'event', { op: 'expose.event', key, spec });
      };

      fn.state = (key: string, handle: any) => {
        ensureSetup('def.expose.state');
        expose.expose(key, handle);
        recordCaptured(def, 'state', { op: 'expose.state', key, handle });
      };

      fn.value = (key: string, value: any) => {
        ensureSetup('def.expose.value');
        expose.expose(key, value);
        recordCaptured(def, 'context', { op: 'expose.value', key, value });
      };

      fn.method = (key: string, fnValue: any) => {
        ensureSetup('def.expose.method');
        expose.expose(key, fnValue);
        recordCaptured(def, 'context', { op: 'expose.method', key, fn: fnValue });
      };

      return fn;
    })(),

    rule: (spec: RuleSpec<P>) => {
      ensureSetup('def.rule');
      const handle = rules.rule(spec);
      recordCaptured(def, 'context', { op: 'rule', handle, off: () => handle.dispose() });
      return handle;
    },

    event: {
      on: ((
        type: EventTypeV0,
        cb: ProtoEventCallback<P, unknown>,
        options?: HostEventListenerOptions
      ) => {
        ensureSetup(`def.event.on`);
        const token = eventFacade.on(type as `host:${string}`, options);
        eventCallbacks.register((token as any).id, cb);
        const off = () => {
          const id = (token as any)?.id;
          if (typeof id === 'string' && id) {
            eventCallbacks.remove(id);
          }
        };
        recordCaptured(def, 'event', { token, off });
        return token;
      }) as DefHandle<P>['event']['on'],

      onGlobal: ((
        type: EventTypeV0,
        cb: ProtoEventCallback<P, unknown>,
        options?: HostEventListenerOptions
      ) => {
        ensureSetup(`def.event.onGlobal`);
        const token = eventFacade.onGlobal(type as `host:${string}`, options);
        eventCallbacks.register((token as any).id, cb);
        const off = () => {
          const id = (token as any)?.id;
          if (typeof id === 'string' && id) {
            eventCallbacks.remove(id);
          }
        };
        recordCaptured(def, 'event', { token, off });
        return token;
      }) as DefHandle<P>['event']['onGlobal'],

      off: (token) => {
        ensureSetup(`def.event.off`);
        const id = (token as any)?.id;
        if (typeof id === 'string' && id) {
          eventCallbacks.remove(id);
        }
        eventFacade.off(token);
        recordCaptured(def, 'event', { op: 'off', token });
      },
    },

    state: {
      bool(semantic, defaultValue) {
        ensureSetup('def.state.bool');
        const handle = state.bool(semantic, defaultValue);
        registerStateHandle(def, handle);
        recordCaptured(def, 'state', handle);
        return handle;
      },
      fromInteraction(name) {
        ensureSetup('def.state.fromInteraction');
        if (!stateInteraction) {
          throw new Error(`[StateInteraction] module unavailable for state: ${String(name)}`);
        }
        const handle = stateInteraction.get(name as any) as any;
        registerStateHandle(def, handle);
        recordCaptured(def, 'state', handle);
        return handle;
      },
      fromAccessibility(name) {
        ensureSetup('def.state.fromAccessibility');
        if (!stateAccessibility) {
          throw new Error(`[StateAccessibility] module unavailable for state: ${String(name)}`);
        }
        const handle = stateAccessibility.get(name as any) as any;
        registerStateHandle(def, handle);
        recordCaptured(def, 'state', handle);
        return handle;
      },
      enum(semantic, defaultValue, spec) {
        ensureSetup('def.state.enum');
        const handle = state.enum(semantic, defaultValue, spec);
        registerStateHandle(def, handle);
        recordCaptured(def, 'state', handle);
        return handle;
      },
      string(semantic, defaultValue, spec) {
        ensureSetup('def.state.string');
        const handle = state.string(semantic, defaultValue, spec);
        registerStateHandle(def, handle);
        recordCaptured(def, 'state', handle);
        return handle;
      },
      numberRange(semantic, defaultValue, spec) {
        ensureSetup('def.state.numberRange');
        const handle = state.numberRange(semantic, defaultValue, spec);
        registerStateHandle(def, handle);
        recordCaptured(def, 'state', handle);
        return handle;
      },
      numberDiscrete(semantic, defaultValue, spec) {
        ensureSetup('def.state.numberDiscrete');
        const handle = state.numberDiscrete(semantic, defaultValue, spec);
        registerStateHandle(def, handle);
        recordCaptured(def, 'state', handle);
        return handle;
      },
    },

    context: {
      provide(key, defaultValue) {
        ensureSetup('def.context.provide');
        context.provide(key, defaultValue);
        recordCaptured(def, 'context', { op: 'provide', key });
      },
      subscribe(key, cb) {
        ensureSetup('def.context.subscribe');
        if (!cb) {
          const off = context.subscribe(key);
          recordCaptured(def, 'context', { op: 'subscribe', key, off });
          return off;
        }
        const off = context.subscribe(key, (ctx, next, prev) =>
          cb(ctx as RunHandle<P>, next, prev)
        );
        recordCaptured(def, 'context', { op: 'subscribe', key, hasCallback: true, off });
        return off;
      },
      trySubscribe(key, cb) {
        ensureSetup('def.context.trySubscribe');
        if (!cb) {
          const off = context.trySubscribe(key);
          recordCaptured(def, 'context', { op: 'trySubscribe', key, off });
          return off;
        }
        const off = context.trySubscribe(key, (ctx, next, prev) =>
          cb(ctx as RunHandle<P>, next, prev)
        );
        recordCaptured(def, 'context', { op: 'trySubscribe', key, hasCallback: true, off });
        return off;
      },
    },

    anatomy: {
      claim(family, decl) {
        ensureSetup('def.anatomy.claim');
        if (!anatomy) throw new Error(`[Anatomy] module unavailable`);
        anatomy.claim(family, decl);
      },
      subscribeParts(family, role, onChange) {
        ensureSetup('def.anatomy.subscribeParts');
        if (!anatomy) throw new Error(`[Anatomy] module unavailable`);
        return anatomy.subscribeParts(family, role, (ctx, parts) =>
          onChange(ctx as RunHandle<P>, parts)
        );
      },
    },

    a11y: {
      id(target) {
        ensureSetup('def.a11y.id');
        if (!a11y) throw new Error(`[A11y] module unavailable.`);
        a11y.id(target);
        recordCaptured(def, 'context', { op: 'a11y.id', target });
      },
      role(role) {
        ensureSetup('def.a11y.role');
        if (!a11y) throw new Error(`[A11y] module unavailable.`);
        a11y.role(role);
        recordCaptured(def, 'context', { op: 'a11y.role', role });
      },
      name(value) {
        ensureSetup('def.a11y.name');
        if (!a11y) throw new Error(`[A11y] module unavailable.`);
        a11y.name(value);
        recordCaptured(def, 'context', { op: 'a11y.name', value });
      },
      nameFromContent() {
        ensureSetup('def.a11y.nameFromContent');
        if (!a11y) throw new Error(`[A11y] module unavailable.`);
        a11y.nameFromContent();
        recordCaptured(def, 'context', { op: 'a11y.nameFromContent' });
      },
      description(value) {
        ensureSetup('def.a11y.description');
        if (!a11y) throw new Error(`[A11y] module unavailable.`);
        a11y.description(value);
        recordCaptured(def, 'context', { op: 'a11y.description', value });
      },
      state(key, handle) {
        ensureSetup('def.a11y.state');
        if (!a11y) throw new Error(`[A11y] module unavailable.`);
        a11y.state(key, handle);
        recordCaptured(def, 'state', { op: 'a11y.state', key, handle });
      },
      action(key, spec) {
        ensureSetup('def.a11y.action');
        if (!a11y) throw new Error(`[A11y] module unavailable.`);
        a11y.action(key, spec);
        recordCaptured(def, 'event', { op: 'a11y.action', key, spec });
      },
      relation(key, spec) {
        ensureSetup('def.a11y.relation');
        if (!a11y) throw new Error(`[A11y] module unavailable.`);
        a11y.relation(key, spec);
        recordCaptured(def, 'context', { op: 'a11y.relation', key, spec });
      },
      tree(patch) {
        ensureSetup('def.a11y.tree');
        if (!a11y) throw new Error(`[A11y] module unavailable.`);
        a11y.tree(patch);
        recordCaptured(def, 'context', { op: 'a11y.tree', patch });
      },
    },
  };

  return def;
};
