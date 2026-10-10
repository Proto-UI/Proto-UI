import type { NativeLinkSnapshot } from '@proto.ui/core';
import type { NativeLinkHost, NativeLinkHostLease } from './caps';
import { normalizeNativeLinkConfig } from './config';

export function resolveWebNativeLinkLocalName(): 'a' {
  return 'a';
}
const owners = new WeakMap<HTMLAnchorElement, NativeLinkHostLease>();

/** Never navigates synthetically or exposes the physical target to a Prototype. */
export function createWebNativeLinkHost(getTarget: () => HTMLAnchorElement | null): NativeLinkHost {
  return {
    attach(connection) {
      const anchor = getTarget();
      if (!anchor || anchor.localName !== 'a')
        throw new Error('[NativeLink] physical anchor target is unavailable.');
      owners.get(anchor)?.dispose();
      let disposed = false;
      let config: NativeLinkSnapshot;
      const pending = new Set<ReturnType<typeof setTimeout>>();
      const names = ['href', 'target', 'rel', 'aria-disabled', 'tabindex'] as const;
      const before = new Map<string, string | null>(
        names.map((name) => [name, anchor.getAttribute(name)])
      );
      const projected = new Map<string, string | null>();
      const write = (name: string, value: string | null) => {
        if (!projected.has(name)) before.set(name, anchor.getAttribute(name));
        projected.set(name, value);
        if (value === null) anchor.removeAttribute(name);
        else anchor.setAttribute(name, value);
      };
      const restore = (name: string) => {
        if (!projected.has(name)) return;
        if (anchor.getAttribute(name) === projected.get(name)) {
          const value = before.get(name) ?? null;
          if (value === null) anchor.removeAttribute(name);
          else anchor.setAttribute(name, value);
        }
        projected.delete(name);
      };
      const apply = (next: NativeLinkSnapshot) => {
        const normalized = normalizeNativeLinkConfig(next);
        if (
          !config ||
          config.href !== normalized.href ||
          config.target !== normalized.target ||
          config.rel !== normalized.rel ||
          config.disabled !== normalized.disabled
        ) {
          config = normalized;
        }
        write('href', !config.disabled && config.href ? config.href : null);
        write('target', config.target || null);
        write('rel', config.rel || null);
        if (config.disabled) {
          write('aria-disabled', 'true');
          write('tabindex', '-1');
        } else {
          restore('aria-disabled');
          restore('tabindex');
        }
      };
      const activate = (event: MouseEvent) => {
        if (disposed || owners.get(anchor) !== lease) return;
        // Do not report activation of a nested independently owned link.
        const nearestAnchor = event
          .composedPath()
          .find((node) => (node as Element)?.localName === 'a');
        if (nearestAnchor && nearestAnchor !== anchor) return;
        if (config.disabled || !config.href) {
          event.preventDefault();
          return;
        }
        if (
          event.defaultPrevented ||
          (event.type === 'click' ? event.button !== 0 : event.button !== 1)
        )
          return;
        const snapshot = config;
        const observation = Object.freeze({
          href: snapshot.href,
          target: snapshot.target,
          rel: snapshot.rel,
          modified:
            event.button === 1 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey,
        });
        // Observe in a later task after the browser's activation default. A consumer closing its
        // menu must not remove href before navigation runs. No router is involved.
        const timer = setTimeout(() => {
          pending.delete(timer);
          if (
            !disposed &&
            !event.defaultPrevented &&
            owners.get(anchor) === lease &&
            config === snapshot
          ) {
            connection.onNavigate(observation);
          }
        }, 0);
        pending.add(timer);
      };
      const lease: NativeLinkHostLease = {
        update(next) {
          if (!disposed) apply(next);
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          for (const timer of pending) clearTimeout(timer);
          pending.clear();
          anchor.removeEventListener('click', activate);
          anchor.removeEventListener('auxclick', activate);
          if (owners.get(anchor) !== lease) return;
          owners.delete(anchor);
          for (const name of names) restore(name);
        },
      };
      owners.set(anchor, lease);
      anchor.addEventListener('click', activate);
      anchor.addEventListener('auxclick', activate);
      apply(connection.config);
      return lease;
    },
  };
}
