// packages/runtime/src/kernel/handles/run.ts
import { PropsBaseType } from '@proto.ui/types';
import type { ModuleOrchestratorFacadeView } from '../../orchestrator/module-orchestrator/types';
import { RunHandle } from '@proto.ui/core';
import { PropsFacade } from '@proto.ui/module-props';
import { ContextFacade } from '@proto.ui/module-context';
import { ExposeEventFacade } from '@proto.ui/module-expose-event';
import { AnatomyFacade } from '@proto.ui/module-anatomy';
import { FeedbackFacade } from '@proto.ui/module-feedback';
import type { RuleMetaFacade } from '@proto.ui/module-rule-meta';

export const createRunHandle = <P extends PropsBaseType>(
  update: RunHandle<P>['update'],
  moduleHub: ModuleOrchestratorFacadeView,
  setPresent: RunHandle<P>['lifecycle']['setPresent']
): RunHandle<P> => {
  const facades = moduleHub.getFacades();
  const props = facades['props'] as PropsFacade<P>;
  const context = facades['context'] as ContextFacade;
  const exposeEvent = facades['expose-event'] as ExposeEventFacade;
  const anatomy = facades['anatomy'] as AnatomyFacade | undefined;
  const feedback = facades['feedback'] as FeedbackFacade;
  const meta = facades['rule-meta'] as RuleMetaFacade | undefined;

  return {
    update,
    lifecycle: {
      setPresent,
    },
    meta: meta
      ? {
          get: (key) => meta.get(key),
        }
      : undefined,
    props: {
      get: () => props.get(),
      getRaw: () => props.getRaw(),
      isProvided: (k: string) => props.isProvided(k),
    },
    context: {
      read: (key) => context.read(key),
      tryRead: (key) => context.tryRead(key),
      update: (key, next) => context.update(key, next),
      tryUpdate: (key, next) => context.tryUpdate(key, next),
    },
    expose: {
      emit: (key, payload, options) => exposeEvent.emit(key, payload, options),
    },
    feedback: {
      style: {
        patch: (...handles) => feedback.style.patch(...handles),
        suppress: (...handles) => feedback.style.suppress(...handles),
        clearPatch: () => feedback.style.clearPatch(),
      },
    },
    anatomy: {
      has: (family, role) => {
        if (!anatomy) throw new Error(`[Anatomy] module unavailable`);
        return anatomy.has(family, role);
      },
      parts: ((family: any, options: any) => {
        if (!anatomy) throw new Error(`[Anatomy] module unavailable`);
        return anatomy.parts(family, options as any);
      }) as RunHandle<P>['anatomy']['parts'],
      partsOf: ((family: any, role: any, options: any) => {
        if (!anatomy) throw new Error(`[Anatomy] module unavailable`);
        return anatomy.partsOf(family, role, options as any);
      }) as RunHandle<P>['anatomy']['partsOf'],
      order: {
        version: ((family: any, options: any) => {
          if (!anatomy) throw new Error(`[Anatomy] module unavailable`);
          return anatomy.order.version(family, options as any);
        }) as RunHandle<P>['anatomy']['order']['version'],
        parts: ((family: any, options: any) => {
          if (!anatomy) throw new Error(`[Anatomy] module unavailable`);
          return anatomy.order.parts(family, options as any);
        }) as RunHandle<P>['anatomy']['order']['parts'],
        partsOf: ((family: any, role: any, options: any) => {
          if (!anatomy) throw new Error(`[Anatomy] module unavailable`);
          return anatomy.order.partsOf(family, role, options as any);
        }) as RunHandle<P>['anatomy']['order']['partsOf'],
        indexOfSelf: ((family: any, role: any, options: any) => {
          if (!anatomy) throw new Error(`[Anatomy] module unavailable`);
          return anatomy.order.indexOfSelf(family, role, options as any);
        }) as RunHandle<P>['anatomy']['order']['indexOfSelf'],
        prevOfSelf: ((family: any, role: any, options: any) => {
          if (!anatomy) throw new Error(`[Anatomy] module unavailable`);
          return anatomy.order.prevOfSelf(family, role, options as any);
        }) as RunHandle<P>['anatomy']['order']['prevOfSelf'],
        nextOfSelf: ((family: any, role: any, options: any) => {
          if (!anatomy) throw new Error(`[Anatomy] module unavailable`);
          return anatomy.order.nextOfSelf(family, role, options as any);
        }) as RunHandle<P>['anatomy']['order']['nextOfSelf'],
      },
    },
  };
};
