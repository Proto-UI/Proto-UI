import type { ControlLabelHost } from '@proto.ui/module-control-label';
import type {
  ControlLabelActivateMessage,
  ControlLabelPlan,
  ControlLabelViewMessage,
} from '@proto.ui/host-protocol';

let nextNativeLease = 0;

/** One wire identity for an opaque semantic object across this host connection. */
export function createNativeA11yLedger() {
  const ids = new WeakMap<object, string>();
  let next = 0;
  return (ref: object) => {
    let id = ids.get(ref);
    if (!id) ids.set(ref, (id = `native:a11y:${++next}`));
    return id;
  };
}

/** Scope objects belong to this host connection, never a logical parent session. */
export type NativeScopeLookup = ((key: string) => object) & {
  release(scope: object): void;
  size(): number;
};
export function createNativeScopeLedger(): NativeScopeLookup {
  const scopes = new Map<string, { identity: object; users: number }>();
  const keys = new WeakMap<object, string>();
  return Object.assign(
    (key: string) => {
      let scope = scopes.get(key);
      if (!scope) {
        scope = { identity: Object.freeze({}), users: 0 };
        scopes.set(key, scope);
        keys.set(scope.identity, key);
      }
      scope.users += 1;
      return scope.identity;
    },
    {
      release(identity: object) {
        const key = keys.get(identity);
        const scope = key === undefined ? undefined : scopes.get(key);
        if (scope?.identity !== identity) return;
        if (--scope.users === 0) scopes.delete(key!);
      },
      size: () => scopes.size,
    }
  );
}

export function createPeerControlLabelHost(options: {
  sessionId: string;
  epoch(): number;
  live(): boolean;
  scope: NativeScopeLookup;
  publish(plan: ControlLabelPlan | null): void;
}) {
  let current: {
    plan: ControlLabelPlan;
    revision: number;
    lastActivation: number;
    awaitingActionView: boolean;
    nativeIdentity: string | null;
    authoredName: boolean;
    view: { identity: object; scope: object } | null;
    onActivate(source: 'pointer' | 'accessibility'): void;
    onViewChange(): void;
  } | null = null;
  const host: ControlLabelHost = {
    attach(args) {
      if (current) throw new Error('one native ControlLabel lease per instance');
      const lease = {
        plan: {
          leaseId: `${options.sessionId}:label:${++nextNativeLease}`,
          kind: args.kind,
          activation: args.activation,
        } satisfies ControlLabelPlan,
        revision: -1,
        lastActivation: 0,
        awaitingActionView: false,
        nativeIdentity: null as string | null,
        authoredName: true,
        view: null as { identity: object; scope: object } | null,
        onActivate: args.onActivate,
        onViewChange: args.onViewChange,
      };
      current = lease;
      options.publish(lease.plan);
      return {
        view: () => (current === lease && options.live() ? lease.view : null),
        setActivation(activation) {
          if (current !== lease || lease.plan.activation === activation) return;
          // An unseen response from the old action policy can have a higher
          // view revision. A new opaque lease, not a revision threshold alone,
          // binds the response and any action to this option generation.
          lease.plan = {
            ...lease.plan,
            leaseId: `${options.sessionId}:label:${++nextNativeLease}`,
            activation,
          };
          lease.lastActivation = 0;
          lease.awaitingActionView = true;
          options.publish(lease.plan);
        },
        dispose() {
          if (current !== lease) return;
          current = null;
          if (lease.view) options.scope.release(lease.view.scope);
          lease.view = null;
          options.publish(null);
        },
      };
    },
  };
  return {
    host,
    plan: () => current?.plan ?? null,
    hasAuthoredName: () => (current?.view && options.live() ? current.authoredName : true),
    view(message: ControlLabelViewMessage) {
      const lease = current;
      if (
        !lease ||
        message.sessionId !== options.sessionId ||
        message.viewEpoch !== options.epoch() ||
        message.leaseId !== lease.plan.leaseId ||
        !Number.isSafeInteger(message.revision) ||
        message.revision <= lease.revision
      )
        return false;
      if (
        message.view &&
        (typeof message.view.identity !== 'string' ||
          !message.view.identity ||
          message.view.identity.length > 256 ||
          typeof message.view.scope !== 'string' ||
          !message.view.scope ||
          message.view.scope.length > 256 ||
          typeof message.view.authoredName !== 'boolean')
      )
        return false;
      lease.revision = message.revision;
      lease.awaitingActionView = false;
      const next = message.view;
      const previous = lease.view;
      const scope = next ? options.scope(next.scope) : null;
      lease.view =
        next && scope
          ? {
              identity:
                lease.nativeIdentity === next.identity && lease.view?.scope === scope
                  ? lease.view.identity
                  : Object.freeze({}),
              scope,
            }
          : null;
      if (previous) options.scope.release(previous.scope);
      lease.nativeIdentity = next?.identity ?? null;
      lease.authoredName = next?.authoredName !== false;
      lease.onViewChange();
      return true;
    },
    activate(message: ControlLabelActivateMessage) {
      const lease = current;
      if (
        !lease ||
        !lease.view ||
        !options.live() ||
        !lease.plan.activation ||
        lease.awaitingActionView ||
        lease.plan.kind !== 'label' ||
        message.sessionId !== options.sessionId ||
        message.viewEpoch !== options.epoch() ||
        message.leaseId !== lease.plan.leaseId ||
        message.viewRevision !== lease.revision ||
        !Number.isSafeInteger(message.sequence) ||
        message.sequence <= lease.lastActivation ||
        (message.source !== 'pointer' && message.source !== 'accessibility')
      )
        return false;
      lease.lastActivation = message.sequence;
      lease.onActivate(message.source);
      return true;
    },
    revoke() {
      const lease = current;
      if (!lease || !lease.view) return;
      options.scope.release(lease.view.scope);
      lease.view = null;
      lease.nativeIdentity = null;
      lease.onViewChange();
    },
  };
}
