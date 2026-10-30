// packages/runtime/src/kernel/kernel.ts
import {
  createRendererPrimitives,
  snapshotOwnedTemplateBlueprint,
  Phase,
  Prototype,
  RendererHandle,
  RenderFn,
  RenderReadHandle,
  RunHandle,
  TemplateChildren,
  type AsHookRuntime,
} from '@proto.ui/core';
import { PropsBaseType } from '@proto.ui/types';
import {
  createDefHandle,
  createLifecycleRegistry,
  createRunHandle,
  LifecycleRegistry,
  type EventCallbacksSink,
} from './handles';
import type { RuleFacade } from '@proto.ui/module-rule';
import type { ModuleOrchestratorFacadeView } from '../orchestrator/module-orchestrator/types';
import type { PropsFacade } from '@proto.ui/module-props';
import type { FeedbackFacade } from '@proto.ui/module-feedback';
import type { ContextFacade } from '@proto.ui/module-context';
import type { AnatomyFacade } from '@proto.ui/module-anatomy';
import type { ExecPhase } from '@proto.ui/module-base';
import { attachAsHookRuntime } from './as-hook';
import { createViewIntent, type RuntimeViewIntent } from './view-intent';
import { createViewOperations } from './view-operation';

export type Kernel<P extends PropsBaseType> = {
  getPhase(): Phase;
  setPhase(p: Phase): void;

  lifecycle: LifecycleRegistry<P>;
  viewIntent: RuntimeViewIntent;
  viewOperations: ReturnType<typeof createViewOperations>;
  rules: RuleFacade<P>;

  run: RunHandle<P>;
  read: RenderReadHandle<P>;
  renderer: RendererHandle<P>;
  renderFn: RenderFn;

  /** Preserve the caller's execution phase when rendering returns or throws. */
  renderOnce(): TemplateChildren;
};

export type CreateKernelOptions = {
  allowRunUpdate?: boolean;
  onPhaseChange?: (p: ExecPhase) => void;
  asHook?: {
    projectState?: <T>(state: T) => T;
    enterSetup?: (ctx: { def: object; rt: AsHookRuntime }) => void;
    exitSetup?: () => void;
  };
};

export function createKernel<P extends PropsBaseType>(
  proto: Prototype<P>,
  modules: ModuleOrchestratorFacadeView,
  opt?: CreateKernelOptions & { eventSink?: EventCallbacksSink<P> }
): Kernel<P> {
  let phase: ExecPhase = 'unknown';
  const setPhase = (p: ExecPhase) => {
    phase = p;
    opt?.onPhaseChange?.(p);
  };

  const st = {
    prototypeName: proto.name,
    getPhase: () => phase,
  };

  const lifecycle = createLifecycleRegistry<P>();
  const viewIntent = createViewIntent(st);
  const viewOperations = createViewOperations(st);
  const rules = modules.getFacades()['rule'] as RuleFacade<P>;

  const def = createDefHandle<P>(st, lifecycle, rules, modules, opt?.eventSink);
  const asHookRuntime = attachAsHookRuntime(def, st, proto, opt?.asHook);

  // ----------------
  // setup
  // ----------------
  setPhase('setup');
  opt?.asHook?.enterSetup?.({ def, rt: asHookRuntime });
  let maybeRender: RenderFn | void;
  try {
    maybeRender = proto.setup(def);
  } finally {
    opt?.asHook?.exitSetup?.();
  }
  const defaultRender: RenderFn = (renderer) => [renderer.slot()];
  let renderFn: RenderFn = defaultRender;
  if (typeof maybeRender === 'function') {
    renderFn = maybeRender;
  } else if (typeof maybeRender !== 'undefined') {
    throw new Error(
      `[Prototype] setup() must return render function or void, got: ${typeof maybeRender}.`
    );
  }
  setPhase('unknown');

  // ----------------
  // run handle
  // ----------------
  let runUpdateImpl: (() => void) | undefined = undefined;
  if (opt?.allowRunUpdate) {
    runUpdateImpl = () => {
      throw new Error(`[Runtime] run.update() is not wired yet.`);
    };
  }

  // NOTE: createRunHandle only depends on the facade view.
  const run = createRunHandle<P>(
    () => {
      if (!runUpdateImpl) {
        throw new Error(`[Runtime] run.update() is not supported in host-free execution.`);
      }
      runUpdateImpl();
    },
    modules,
    (present) => viewIntent.setPresent(present),
    () => viewOperations.capture()
  );

  // ----------------
  // read / renderer
  // ----------------
  const facades = modules.getFacades();
  const propsFacade = facades['props'] as PropsFacade<P>;
  const contextFacade = facades['context'] as ContextFacade;
  const anatomyFacade = facades['anatomy'] as AnatomyFacade | undefined;

  const read: RenderReadHandle<P> = {
    props: propsFacade as any,
    context: {
      read: (key) => contextFacade.read(key),
      tryRead: (key) => contextFacade.tryRead(key),
    },
    anatomy: {
      has: (family, role) => {
        if (!anatomyFacade) throw new Error(`[Anatomy] module unavailable`);
        return anatomyFacade.has(family, role);
      },
      parts: ((family: any, options: any) => {
        if (!anatomyFacade) throw new Error(`[Anatomy] module unavailable`);
        return anatomyFacade.parts(family, options as any);
      }) as RenderReadHandle<P>['anatomy']['parts'],
      partsOf: ((family: any, role: any, options: any) => {
        if (!anatomyFacade) throw new Error(`[Anatomy] module unavailable`);
        return anatomyFacade.partsOf(family, role, options as any);
      }) as RenderReadHandle<P>['anatomy']['partsOf'],
      descendantsOf: (family, ancestor, role) => {
        if (!anatomyFacade) throw new Error(`[Anatomy] module unavailable`);
        return anatomyFacade.descendantsOf(family, ancestor, role);
      },
      order: {
        version: ((family: any, options: any) => {
          if (!anatomyFacade) throw new Error(`[Anatomy] module unavailable`);
          return anatomyFacade.order.version(family, options as any);
        }) as RenderReadHandle<P>['anatomy']['order']['version'],
        parts: ((family: any, options: any) => {
          if (!anatomyFacade) throw new Error(`[Anatomy] module unavailable`);
          return anatomyFacade.order.parts(family, options as any);
        }) as RenderReadHandle<P>['anatomy']['order']['parts'],
        partsOf: ((family: any, role: any, options: any) => {
          if (!anatomyFacade) throw new Error(`[Anatomy] module unavailable`);
          return anatomyFacade.order.partsOf(family, role, options as any);
        }) as RenderReadHandle<P>['anatomy']['order']['partsOf'],
        indexOfSelf: ((family: any, role: any, options: any) => {
          if (!anatomyFacade) throw new Error(`[Anatomy] module unavailable`);
          return anatomyFacade.order.indexOfSelf(family, role, options as any);
        }) as RenderReadHandle<P>['anatomy']['order']['indexOfSelf'],
        prevOfSelf: ((family: any, role: any, options: any) => {
          if (!anatomyFacade) throw new Error(`[Anatomy] module unavailable`);
          return anatomyFacade.order.prevOfSelf(family, role, options as any);
        }) as RenderReadHandle<P>['anatomy']['order']['prevOfSelf'],
        nextOfSelf: ((family: any, role: any, options: any) => {
          if (!anatomyFacade) throw new Error(`[Anatomy] module unavailable`);
          return anatomyFacade.order.nextOfSelf(family, role, options as any);
        }) as RenderReadHandle<P>['anatomy']['order']['nextOfSelf'],
      },
    },
  };

  const { el, slot, r, svg, decoration } = createRendererPrimitives();
  const renderer: RendererHandle<P> = { el, slot, r, svg, decoration, read };

  // ----------------
  // render
  // ----------------
  const renderOnce = () => {
    const previousPhase = phase;
    setPhase('render');
    try {
      const feedback = modules.getFacades()['feedback'] as FeedbackFacade;
      const guarded = feedback?.style.hasDecorationTargets?.() ?? false;
      const lease = guarded ? feedback.style.captureDecorationLease() : undefined;
      const rendered = renderFn(renderer);
      const children = guarded ? snapshotOwnedTemplateBlueprint(rendered) : rendered;
      if (guarded && feedback.style.captureDecorationLease() !== lease)
        throw new Error('[Template] stale owned blueprint lease');
      const targets: import('@proto.ui/core').OwnedDecorationTarget[] = [];
      const visit = (node: any): void => {
        if (Array.isArray(node)) {
          for (const n of node) visit(n);
          return;
        }
        if (!node || typeof node !== 'object') return;
        if (node.type?.kind === 'decoration') {
          if (
            Object.keys(node).some((k) => k !== 'type') ||
            Object.keys(node.type).some((k) => k !== 'kind' && k !== 'target')
          )
            throw new Error('[Template] decoration must be an empty owned leaf');
          targets.push(node.type.target);
        } else visit(node.children);
      };
      visit(children);
      if (feedback?.style.validateDecorationTemplate)
        feedback.style.validateDecorationTemplate(targets);
      else if (targets.length) throw new Error('[Template] owned-decoration unsupported');
      return children;
    } finally {
      setPhase(previousPhase);
    }
  };

  return {
    getPhase: () => phase,
    setPhase: (p) => setPhase(p as any),

    lifecycle,
    viewIntent,
    viewOperations,
    rules,

    run,
    read,
    renderer,
    renderFn,

    renderOnce,
  };
}
