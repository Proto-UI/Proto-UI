import {
  createViewEpochOwner,
  createEventGate,
  createWebProtoEventRouter,
  type HostWiring,
  type WiringSpec,
} from '@proto.ui/adapter-base';
import { HOST_ELEMENT_CAP, type Prototype } from '@proto.ui/core';
import { EFFECTS_CAP, type FeedbackPort } from '@proto.ui/module-feedback';
import { RULE_META_GET_CAP } from '@proto.ui/module-rule-meta';
import type { ShadowStyleArtifactV1 } from '../../src/shadow-style-artifact';
import type { ShadowColorSchemeSource } from '../../src/shadow-color-scheme-environment';
import { createShadowOwnerShell } from '../../src/shadow-owner-shell';
import { createShadowSplitResources } from '../../src/shadow-split-resources';
import { createShadowSplitEffectsPort } from '../../src/shadow-split-effects';
import { createWebComponentHostSession } from '../../src/runtime/session';
import { installDefaultHostDisplay } from '../../src/host-display';
import {
  createWebComponentModules,
  createWebComponentOwnerModules,
} from '../../src/runtime/modules';
import {
  createLogicalInstance,
  markProtoInstance,
  unbindProtoInstance,
  bindLogicalEventTarget,
  unbindLogicalEventTarget,
  resolveLogicalTriggerEventRouteForTarget,
} from '../../src/platform/instance-tree';

/** Private evidence harness: real WC session/commit/view owner and optional Web module/router wiring.
 * It is not a second Adapter or evidence of full module/profile conformance. */
export function createSplitRuntimePilot(args: {
  host: HTMLElement;
  proto: Prototype<any>;
  artifact: ShadowStyleArtifactV1;
  colorSchemeSource?: ShadowColorSchemeSource;
  onCommit?: () => void;
  /** Exercise composed prototypes with the actual WC cap builders and native input router. */
  webModules?: boolean;
  getRawProps?: () => Record<string, unknown>;
}) {
  const { host, proto, artifact } = args;
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  const shell = createShadowOwnerShell(root);
  const resources = createShadowSplitResources({
    host,
    shell,
    artifact,
    colorSchemeSource: args.colorSchemeSource,
    baseGetMeta: () => undefined,
  });
  const hostDisplay = installDefaultHostDisplay(host, { displayOwner: 'presentation' });
  const owner = createViewEpochOwner<any>({ prototypeName: proto.name });
  const rawPropsSource = { get: args.getRawProps ?? (() => ({})), subscribe: () => () => {} };
  const instanceToken = createLogicalInstance(proto);
  let currentEventGate: ReturnType<typeof createEventGate> | undefined;
  if (args.webModules) markProtoInstance(host, proto, instanceToken);
  const moduleArgs = {
    el: host,
    instanceToken,
    rawPropsSource,
    getMeta: resources.getMeta,
    textControlTarget: null,
    imageViewTarget: null,
    setExposes() {},
    runInCallbackScope: (fn: () => void) => {
      owner.session?.invokeInCallbackScope(fn);
    },
  };
  const modules: WiringSpec = {
    ...(args.webModules ? createWebComponentOwnerModules(moduleArgs) : {}),
    'expose-state-web': () => [[HOST_ELEMENT_CAP, host]],
    'rule-meta': () => [[RULE_META_GET_CAP, resources.getMeta]],
  };
  const createSession = (wiring: HostWiring) =>
    createWebComponentHostSession({
      proto,
      tagName: proto.name,
      shadow: true,
      host,
      root,
      shadowViewTarget: resources.surface,
      schedule: (task) => task(),
      rawPropsSource,
      textControlTarget: null,
      imageViewTarget: null,
      wiring,
      eventGate: {
        enable: () => {
          currentEventGate?.enable();
          args.onCommit?.();
        },
        disable: () => currentEventGate?.disable(),
        dispose: () => owner.disposeView(),
      },
      router: { dispose() {} },
      getSlotProjector: () => null,
      ensureSlotProjector() {
        throw new Error('Shadow pilot must never use Light DOM projection');
      },
      clearSlotProjector() {},
      initialMount: 'manual',
    });
  let session: ReturnType<typeof createSession>;
  try {
    session = owner.initialize({ modules, createSession }) as typeof session;
  } catch (error) {
    resources.dispose();
    hostDisplay.disconnect();
    if (args.webModules) unbindProtoInstance(host);
    throw error;
  }
  return {
    host,
    root,
    resources,
    session,
    feedback: session.caps.getPort<FeedbackPort>('feedback')!,
    async mount() {
      const effects = createShadowSplitEffectsPort({
        host,
        surface: resources.surface.element,
        artifact,
        prototypeName: proto.name,
      });
      const eventGate = createEventGate();
      currentEventGate = eventGate;
      const router = args.webModules
        ? createWebProtoEventRouter({
            rootEl: host,
            instanceToken,
            resolveSemanticEventRoute: resolveLogicalTriggerEventRouteForTarget,
            globalEl: window,
            isEnabled: () => eventGate.isEnabled(),
          })
        : undefined;
      if (router) bindLogicalEventTarget(instanceToken, router.rootTarget);
      const disposeInput = () => {
        eventGate.dispose();
        if (router) {
          unbindLogicalEventTarget(instanceToken, router.rootTarget);
          router.dispose();
        }
        if (currentEventGate === eventGate) currentEventGate = undefined;
      };
      try {
        owner.attachView({
          modules: {
            ...modules,
            ...(args.webModules
              ? createWebComponentModules({
                  ...moduleArgs,
                  effectsPort: effects,
                  router: router!,
                  isViewReady: () => true,
                  subscribeTargetReady: () => () => {},
                  retryTargetReady() {},
                })
              : {}),
            feedback: () => [[EFFECTS_CAP, effects]],
          },
          createSession,
          disposeView() {
            disposeInput();
            try {
              effects.dispose();
            } finally {
              resources.surface.clearRenderedChildren();
            }
          },
        });
        await session.mount();
      } catch (error) {
        disposeInput();
        await owner.detachView();
        throw error;
      }
    },
    detach: () => owner.detachView(),
    async dispose() {
      try {
        await owner.dispose();
      } finally {
        try {
          resources.dispose();
        } finally {
          hostDisplay.disconnect();
        }
        if (args.webModules) unbindProtoInstance(host);
      }
    },
  };
}
