// packages/runtime/src/instance/instance.ts
import type { Prototype, RunHandle, TemplateChildren } from '@proto.ui/core';
import { enterActiveAsHookContext, exitActiveAsHookContext } from '@proto.ui/core/internal';
import type { PropsBaseType } from '@proto.ui/types';

import { FeedbackModuleDef } from '@proto.ui/module-feedback';
import { PropsModuleDef } from '@proto.ui/module-props';
import { EventModuleDef } from '@proto.ui/module-event';
import { ExposeModuleDef } from '@proto.ui/module-expose';
import { ExposeEventModuleDef } from '@proto.ui/module-expose-event';
import { AnatomyModuleDef } from '@proto.ui/module-anatomy';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import { ExposeStateModuleDef } from '@proto.ui/module-expose-state';
import { ExposeStateWebModuleDef } from '@proto.ui/module-expose-state-web';
import { RuleExposeStateWebModuleDef } from '@proto.ui/module-rule-expose-state-web';
import { RuleMetaModuleDef } from '@proto.ui/module-rule-meta';
import { RuleModuleDef } from '@proto.ui/module-rule';
import { StateModuleDef, type StatePort } from '@proto.ui/module-state';
import { StateInteractionModuleDef } from '@proto.ui/module-state-interaction';
import { StateAccessibilityModuleDef } from '@proto.ui/module-state-accessibility';
import { A11yModuleDef } from '@proto.ui/module-a11y';
import { CollectionModuleDef } from '@proto.ui/module-collection';
import { ContextModuleDef } from '@proto.ui/module-context';
import type { ContextPort } from '@proto.ui/module-context';
import { AsTriggerModuleDef } from '@proto.ui/module-as-trigger';
import { FocusModuleDef } from '@proto.ui/module-focus';
import { BoundaryModuleDef } from '@proto.ui/module-boundary';
import { HitParticipationModuleDef } from '@proto.ui/module-hit-participation';
import { OverlayModuleDef } from '@proto.ui/module-overlay';
import { PositioningModuleDef } from '@proto.ui/module-positioning';
import { ScrollModuleDef } from '@proto.ui/module-scroll';
import { PresenceModuleDef } from '@proto.ui/module-presence';
import { __RUN_TEST_SYS, TestSysModuleDef, type TestSysPort } from '@proto.ui/module-test-sys';
import { TextControlModuleDef } from '@proto.ui/module-text-control';
import { ImageViewModuleDef } from '@proto.ui/module-image-view';

import type { ModuleOrchestrator } from '../orchestrator/module-orchestrator';
import { RuntimeModuleOrchestrator } from '../orchestrator/module-orchestrator';
import type { ExecPhase } from '@proto.ui/module-base';
import { __RT_EVENT_CALLBACKS } from '../kernel/event';

import { CallbackScope } from './execute/callback-scope';
import { createKernel, type Kernel } from '../kernel';
import { createAsHookStateProjector } from '../kernel/as-hook';

export type RuntimeInstance<P extends PropsBaseType> = {
  kernel: Kernel<P>;
  moduleHub: ModuleOrchestrator;
  callbackScope: CallbackScope<P>;

  renderOnce(): TemplateChildren;

  /**
   * Run lifecycle callbacks in callback phase (sync props + dispatch watches + ctx).
   * This is the only correct entrance for lifecycle callbacks.
   */
  runLifecycle(kind: keyof Kernel<P>['lifecycle']): void;

  dispose(): void;
};

export function createRuntimeInstance<P extends PropsBaseType>(
  proto: Prototype<P>,
  opt?: {
    allowRunUpdate?: boolean;
    onModulesReady?: (hub: ModuleOrchestrator) => void;
  }
): RuntimeInstance<P> {
  // stable phase ref for SYS_CAP.execPhase() during module setup/runtime checks
  let phaseRef: ExecPhase = 'unknown';
  const getPhase = () => phaseRef;

  const moduleHub = new RuntimeModuleOrchestrator(
    { prototypeName: proto.name, declarations: proto.modules, getPhase },
    [
      AsTriggerModuleDef,
      RuleModuleDef,
      RuleMetaModuleDef,
      FeedbackModuleDef,
      PropsModuleDef,
      EventModuleDef,
      ExposeModuleDef,
      ExposeEventModuleDef,
      AnatomyModuleDef,
      ExposeStateModuleDef,
      ExposeStateWebModuleDef,
      RuleExposeStateWebModuleDef,
      StateModuleDef,
      StateInteractionModuleDef,
      StateAccessibilityModuleDef,
      A11yModuleDef,
      CollectionModuleDef,
      ContextModuleDef,
      FocusModuleDef,
      TextControlModuleDef,
      ImageViewModuleDef,
      BoundaryModuleDef,
      HitParticipationModuleDef,
      PositioningModuleDef,
      ScrollModuleDef,
      OverlayModuleDef,
      PresenceModuleDef,
      TestSysModuleDef,
    ]
  );

  opt?.onModulesReady?.(moduleHub);

  const kernel = createKernel<P>(proto, moduleHub, {
    allowRunUpdate: opt?.allowRunUpdate,
    onPhaseChange: (p) => {
      phaseRef = p;
    },
    asHook: {
      projectState: createAsHookStateProjector<P>(moduleHub.getPort('state')),
      enterSetup: ({ def, rt }) => {
        enterActiveAsHookContext({
          def: def as any,
          rt,
          facades: moduleHub.getFacades(),
          ports: moduleHub.getPorts(),
        });
      },
      exitSetup: () => {
        exitActiveAsHookContext();
      },
    },
    eventSink: {
      setEventCallbacks: (callbacks) => {
        (moduleHub as any)[__RT_EVENT_CALLBACKS] = callbacks;
      },
    },
  });

  // align once (after setup ends kernel is typically "unknown")
  phaseRef = kernel.getPhase() as any;

  const callbackScope = new CallbackScope<P>(
    () => kernel.getPhase() as ExecPhase,
    (p) => kernel.setPhase(p as any),
    moduleHub
  );
  const statePort = moduleHub.getPort<StatePort>('state');
  statePort?.setCallbackDispatcher?.((fn) => {
    callbackScope.runNoSync(kernel.run, () => fn(kernel.run));
  });
  const contextPort = moduleHub.getPort<ContextPort>('context');
  contextPort?.setCallbackDispatcher?.((fn) => {
    callbackScope.runNoSync(kernel.run, () => fn(kernel.run));
  });
  const anatomyPort = moduleHub.getPort<AnatomyPort>('anatomy');
  anatomyPort?.setOrderCallbackDispatcher?.((fn) => {
    callbackScope.runNoSync(kernel.run, () => fn(kernel.run));
  });

  // add test-sys to run handle, for contract tests
  const testSys = moduleHub.getPort<TestSysPort>('test-sys');
  if (testSys) {
    Object.defineProperty(kernel.run as any, __RUN_TEST_SYS, {
      value: testSys,
      enumerable: false,
      configurable: false,
      writable: false,
    });
  }

  const renderOnce = () => kernel.renderOnce();

  const runLifecycle = (kind: keyof Kernel<P>['lifecycle']) => {
    callbackScope.run(kernel.run, () => {
      for (const cb of kernel.lifecycle[kind] as Array<(run: RunHandle<P>) => void>) {
        cb(kernel.run);
      }
    });
  };

  const dispose = () => {
    moduleHub.dispose();
  };

  return {
    kernel,
    moduleHub,
    callbackScope,
    renderOnce,
    runLifecycle,
    dispose,
  };
}
