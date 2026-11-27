import path from 'node:path';
import type { Prototype, StyleHandle } from '@proto.ui/core';
import { createRuntimeSession, type RuntimeHost, type RuntimeSession } from '@proto.ui/runtime';
import {
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import {
  AS_TRIGGER_GET_GROUP_EVENT_TARGET_CAP,
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_MERGE_GROUP_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import {
  createExposeStateWebNameMap,
  createExposeStateWebNativeVariantPolicy,
  EXPOSE_STATE_WEB_MAP_CAP,
  HOST_ELEMENT_CAP,
  type ExposeStateWebPort,
} from '@proto.ui/module-expose-state-web';
import {
  MATERIAL_PAINT_RESERVATION_CAP,
  OWNED_DECORATION_CAP,
  type FeedbackFacade,
} from '@proto.ui/module-feedback';
import {
  NATIVE_LINK_HOST_CAP,
  NATIVE_LINK_RUN_IN_CALLBACK_CAP,
} from '@proto.ui/module-native-link';
import type { RulePort } from '@proto.ui/module-rule';
import {
  RULE_EXPOSE_STATE_WEB_NATIVE_VARIANT_POLICY_CAP,
  type RuleExposeStateWebNativeVariantPolicy,
} from '@proto.ui/module-rule-expose-state-web';

const FAMILY_LOADERS: Record<string, () => Promise<Record<string, unknown>>> = {
  shadcn: () => import('../../packages/prototypes/shadcn/src/index.js'),
  brutalist: () => import('../../packages/prototypes/brutalist/src/index.js'),
  'bootstrap-2-3-2': () => import('../../packages/prototypes/bootstrap-2-3-2/src/index.js'),
  'liquid-glass': () => import('../../packages/prototypes/liquid-glass/src/index.js'),
};

export const SELECTABLE_ATTRIBUTE = /^data-[a-zA-Z0-9-]+$/;

export type RuntimeStyleClosureResult = {
  mountedCount: number;
  unmounted: string[];
  invalidAttrs: string[];
  tokensByPrototype: Map<string, string[]>;
  tokens: string[];
};

function createHeadlessHostElement(): HTMLElement {
  const attrs = new Map<string, string>();
  const styles = new Map<string, { value: string; priority: string }>();
  return {
    getAttribute: (name: string) => (attrs.has(name) ? attrs.get(name)! : null),
    setAttribute: (name: string, value: string) => {
      attrs.set(name, String(value));
    },
    removeAttribute: (name: string) => {
      attrs.delete(name);
    },
    style: {
      getPropertyValue: (name: string) => styles.get(name)?.value ?? '',
      getPropertyPriority: (name: string) => styles.get(name)?.priority ?? '',
      setProperty: (name: string, value: string, priority = '') => {
        styles.set(name, { value: String(value), priority });
      },
      removeProperty: (name: string) => {
        const prev = styles.get(name)?.value ?? '';
        styles.delete(name);
        return prev;
      },
    },
  } as unknown as HTMLElement;
}

export function isPrototypeValue(value: unknown): value is Prototype<any> {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as Prototype<any>).name === 'string' &&
    typeof (value as Prototype<any>).setup === 'function'
  );
}

export function collectExportedPrototypes(mod: Record<string, unknown>): Prototype<any>[] {
  const seen = new Set<Prototype<any>>();
  const protos: Prototype<any>[] = [];
  for (const value of Object.values(mod)) {
    if (!isPrototypeValue(value) || seen.has(value)) continue;
    seen.add(value);
    protos.push(value);
  }
  return protos.sort((a, b) => a.name.localeCompare(b.name));
}

function extractTwTokens(handle: StyleHandle | undefined): string[] {
  if (!handle || handle.kind !== 'tw') return [];
  return [...handle.tokens];
}

/**
 * Execute prototypes through the real headless `@proto.ui/runtime` +
 * `RuleExposeStateWebModule` lowering pipeline and collect every live
 * exposed state attribute, static/lowered style token, and RuleIR style token.
 */
export async function collectFamilyRuntimeStyleClosure(
  prototypes: readonly Prototype<any>[],
  options?: {
    nativeVariantPolicy?: RuleExposeStateWebNativeVariantPolicy;
  }
): Promise<RuntimeStyleClosureResult> {
  const nativeVariantPolicy =
    options?.nativeVariantPolicy ?? createExposeStateWebNativeVariantPolicy;
  const parentOf = new Map<object, object | null>();
  const protoByToken = new Map<object, Prototype<any>>();
  const mounted: Array<{ proto: Prototype<any>; token: object; session: RuntimeSession<any> }> = [];

  const fieldRootProto = prototypes.find((proto) => proto.name.endsWith('-field-root'));
  let chainTail: object | null = null;
  let remaining = [...prototypes];
  const lastErrors = new Map<string, string>();
  let seq = 0;

  const tryMount = async (proto: Prototype<any>, parentToken: object | null) => {
    const hostEl = createHeadlessHostElement();
    const token = { id: `${proto.name}#${++seq}` };
    parentOf.set(token, parentToken);
    protoByToken.set(token, proto);
    let session: RuntimeSession<any> | null = null;
    try {
      const host: RuntimeHost<any> = {
        prototypeName: proto.name,
        commit(_children, signal) {
          signal?.done();
        },
        schedule(task) {
          task();
        },
        scheduleDelay() {
          return { cancel() {} };
        },
        getRawProps() {
          return { value: 'item-1' };
        },
        onRuntimeReady(wiring) {
          wiring.attach('anatomy', [
            [ANATOMY_INSTANCE_TOKEN_CAP, token],
            [ANATOMY_PARENT_CAP, (t: object) => parentOf.get(t) ?? null],
            [ANATOMY_GET_PROTO_CAP, (t: object) => protoByToken.get(t) ?? null],
            [ANATOMY_ROOT_TARGET_CAP, () => hostEl],
          ]);
          wiring.attach('as-trigger', [
            [AS_TRIGGER_INSTANCE_CAP, token],
            [AS_TRIGGER_PARENT_CAP, (t: object) => parentOf.get(t) ?? null],
            [AS_TRIGGER_GET_PROTO_CAP, (t: object) => protoByToken.get(t) ?? null],
            [AS_TRIGGER_MERGE_GROUP_CAP, () => {}],
            [AS_TRIGGER_GET_GROUP_EVENT_TARGET_CAP, () => new EventTarget()],
          ]);
          const eventTarget = new EventTarget();
          wiring.attach('event', [
            [EVENT_ROOT_TARGET_CAP, () => eventTarget],
            [EVENT_GLOBAL_TARGET_CAP, () => eventTarget],
          ]);
          wiring.attach('context', [
            [CONTEXT_INSTANCE_TOKEN_CAP, token],
            [CONTEXT_PARENT_CAP, (t: object) => parentOf.get(t) ?? null],
          ]);
          wiring.attach('feedback', [
            [OWNED_DECORATION_CAP, true],
            [MATERIAL_PAINT_RESERVATION_CAP, true],
          ]);
          wiring.attach('native-link', [
            [
              NATIVE_LINK_HOST_CAP,
              {
                attach: () => ({
                  update: () => {},
                  dispose: () => {},
                }),
              },
            ],
            [NATIVE_LINK_RUN_IN_CALLBACK_CAP, (cb: () => void) => cb()],
          ]);
          wiring.attach('expose-state-web', [
            [HOST_ELEMENT_CAP, hostEl],
            [EXPOSE_STATE_WEB_MAP_CAP, createExposeStateWebNameMap],
          ]);
          wiring.attach('rule-expose-state-web', [
            [RULE_EXPOSE_STATE_WEB_NATIVE_VARIANT_POLICY_CAP, nativeVariantPolicy],
          ]);
        },
      };

      session = createRuntimeSession(proto, host);
      await session.mount();
      return { proto, token, session };
    } catch (error) {
      if (session) {
        try {
          await session.dispose();
        } catch {}
      }
      parentOf.delete(token);
      protoByToken.delete(token);
      throw error;
    }
  };

  try {
    for (let pass = 0; pass < 8 && remaining.length > 0; pass++) {
      const nextRemaining: Prototype<any>[] = [];
      let progressed = false;

      for (const proto of remaining) {
        try {
          const entry = await tryMount(proto, chainTail);
          mounted.push(entry);
          chainTail = entry.token;
          lastErrors.delete(proto.name);
          progressed = true;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes('Field permits one control in each Root') && fieldRootProto) {
            try {
              const freshField = await tryMount(fieldRootProto, chainTail);
              mounted.push(freshField);
              const entry = await tryMount(proto, freshField.token);
              mounted.push(entry);
              lastErrors.delete(proto.name);
              progressed = true;
              continue;
            } catch (retryError) {
              lastErrors.set(
                proto.name,
                retryError instanceof Error ? retryError.message : String(retryError)
              );
              nextRemaining.push(proto);
              continue;
            }
          }
          lastErrors.set(proto.name, message);
          nextRemaining.push(proto);
        }
      }

      remaining = nextRemaining;
      if (!progressed) break;
    }

    const invalidAttrs: string[] = [];
    const tokensByPrototype = new Map<string, string[]>();
    const allTokens = new Set<string>();

    for (const { proto, session } of mounted) {
      const hub = session.caps;
      const exposeStateWeb = hub.getPort<ExposeStateWebPort>('expose-state-web');
      const rulePort = hub.getPort<RulePort<any>>('rule');
      const feedbackFacade = (hub.getFacades() as { feedback?: FeedbackFacade }).feedback;

      const exposedMap = exposeStateWeb?.getExposedStateMap();
      if (exposedMap) {
        for (const binding of exposedMap.values()) {
          if (binding.attr && !SELECTABLE_ATTRIBUTE.test(binding.attr)) {
            invalidAttrs.push(`${proto.name}: ${binding.key} -> ${binding.attr}`);
          }
        }
      }

      const tokens = new Set<string>();
      for (const token of extractTwTokens(feedbackFacade?.style.exportMerged())) {
        tokens.add(token);
        allTokens.add(token);
      }
      if (rulePort) {
        for (const rule of rulePort.exportIR()) {
          if (rule.intent.kind !== 'ops') continue;
          for (const op of rule.intent.ops) {
            if (op.kind !== 'feedback.style.use') continue;
            for (const handle of op.handles) {
              for (const token of extractTwTokens(handle)) {
                tokens.add(token);
                allTokens.add(token);
              }
            }
          }
        }
      }
      tokensByPrototype.set(proto.name, [...tokens].sort());
    }

    return {
      mountedCount: tokensByPrototype.size,
      unmounted: remaining.map(
        (proto) => `${proto.name}: ${lastErrors.get(proto.name) ?? 'unknown'}`
      ),
      invalidAttrs,
      tokensByPrototype,
      tokens: [...allTokens].sort(),
    };
  } finally {
    for (let i = mounted.length - 1; i >= 0; i--) {
      try {
        await mounted[i]!.session.dispose();
      } catch {}
    }
  }
}

export async function collectFamilyRuntimeTokensFromRoot(familyRoot: string): Promise<string[]> {
  const segments = path.resolve(familyRoot).split(path.sep);
  const len = segments.length;
  if (
    len < 4 ||
    segments[len - 4] !== 'packages' ||
    segments[len - 3] !== 'prototypes' ||
    segments[len - 1] !== 'src'
  ) {
    return [];
  }
  const familyName = segments[len - 2]!;
  const loader = FAMILY_LOADERS[familyName];
  if (!loader) return [];
  const mod = await loader();
  const prototypes = collectExportedPrototypes(mod);
  if (prototypes.length === 0) return [];
  const result = await collectFamilyRuntimeStyleClosure(prototypes);
  if (result.unmounted.length > 0) {
    throw new Error(
      `Runtime style closure failed to mount prototypes in ${familyRoot}:\n${result.unmounted.join('\n')}`
    );
  }
  if (result.invalidAttrs.length > 0) {
    throw new Error(
      `Runtime style closure found unselectable exposed state attributes in ${familyRoot}:\n${result.invalidAttrs.join('\n')}`
    );
  }
  return result.tokens;
}
