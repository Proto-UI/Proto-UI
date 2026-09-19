import {
  createDefaultWebColorSchemeSource,
  createDefaultWebMetaGetter,
} from '@proto.ui/adapter-base';
import { tw } from '@proto.ui/core';
import { EFFECTS_CAP } from '@proto.ui/module-feedback';
import { RULE_META_COLOR_SCHEME_SOURCE_CAP, RULE_META_GET_CAP } from '@proto.ui/module-rule-meta';
import { createRuntimeSession } from '@proto.ui/runtime';
import { commitChildren } from '../../../../../packages/adapters/web-component/src/commit';
import { createOwnedTwTokenApplier } from '../../../../../packages/adapters/web-component/src/feedback-style';
import { createWebEffectsPort } from '../../../../../packages/adapters/web-component/src/runtime/effects-port';

/** Observe the native registration/release operations used by the default document source. */
export function installColorSchemeResourceProbe() {
  const NativeObserver = window.MutationObserver;
  const nativeMatchMedia = window.matchMedia;
  const rootObservers = new Set<MutationObserver>();
  const mediaRecords = new Map<
    MediaQueryList,
    {
      listeners: Map<EventListenerOrEventListenerObject, Set<boolean>>;
      restore(): void;
    }
  >();
  let observerStarts = 0;
  let listenerStarts = 0;

  class CountedObserver extends NativeObserver {
    override observe(target: Node, options?: MutationObserverInit) {
      super.observe(target, options);
      if (target !== document.documentElement) return;
      const attributes =
        options?.attributes === true ||
        (options?.attributes === undefined &&
          (options?.attributeFilter !== undefined || options?.attributeOldValue !== undefined));
      const watchesTheme =
        attributes &&
        (!options?.attributeFilter ||
          options.attributeFilter.some((name) => name === 'class' || name === 'data-theme'));
      if (watchesTheme) {
        if (!rootObservers.has(this)) observerStarts++;
        rootObservers.add(this);
      } else rootObservers.delete(this);
    }

    override disconnect() {
      super.disconnect();
      rootObservers.delete(this);
    }
  }

  const matchMedia: typeof window.matchMedia = function (this: Window, query) {
    const media = nativeMatchMedia.call(this, query);
    if (!/^\(\s*prefers-color-scheme\s*:\s*dark\s*\)$/.test(query) || mediaRecords.has(media))
      return media;
    const add = media.addEventListener;
    const remove = media.removeEventListener;
    const ownAdd = Object.getOwnPropertyDescriptor(media, 'addEventListener');
    const ownRemove = Object.getOwnPropertyDescriptor(media, 'removeEventListener');
    const listeners = new Map<EventListenerOrEventListenerObject, Set<boolean>>();

    // Keep the original callback and options in the native EventTarget. The source
    // uses ordinary change listeners and explicitly removes them on final release.
    media.addEventListener = function (
      this: MediaQueryList,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions
    ) {
      add.call(this, type, listener as EventListener, options);
      if (
        this !== media ||
        type !== 'change' ||
        !listener ||
        (typeof options === 'object' && options.signal?.aborted)
      )
        return;
      const capture = typeof options === 'boolean' ? options : (options?.capture ?? false);
      const captures = listeners.get(listener) ?? new Set<boolean>();
      if (!captures.has(capture)) listenerStarts++;
      captures.add(capture);
      listeners.set(listener, captures);
    } as typeof media.addEventListener;
    media.removeEventListener = function (
      this: MediaQueryList,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions
    ) {
      remove.call(this, type, listener as EventListener, options);
      if (this !== media || type !== 'change' || !listener) return;
      const capture = typeof options === 'boolean' ? options : (options?.capture ?? false);
      const captures = listeners.get(listener);
      captures?.delete(capture);
      if (captures?.size === 0) listeners.delete(listener);
    } as typeof media.removeEventListener;
    mediaRecords.set(media, {
      listeners,
      restore() {
        if (ownAdd) Object.defineProperty(media, 'addEventListener', ownAdd);
        else delete (media as Partial<MediaQueryList>).addEventListener;
        if (ownRemove) Object.defineProperty(media, 'removeEventListener', ownRemove);
        else delete (media as Partial<MediaQueryList>).removeEventListener;
      },
    });
    return media;
  };
  window.MutationObserver = CountedObserver;
  window.matchMedia = matchMedia;

  return {
    snapshot() {
      let colorSchemeListeners = 0;
      for (const record of mediaRecords.values()) {
        for (const captures of record.listeners.values()) colorSchemeListeners += captures.size;
      }
      return {
        rootObservers: rootObservers.size,
        colorSchemeListeners,
        observerStarts,
        listenerStarts,
      };
    },
    restore() {
      if (window.MutationObserver === CountedObserver) window.MutationObserver = NativeObserver;
      if (window.matchMedia === matchMedia) window.matchMedia = nativeMatchMedia;
      for (const record of mediaRecords.values()) record.restore();
      mediaRecords.clear();
      rootObservers.clear();
    },
  };
}

/** Runtime + actual WC Effects/commit boundary, not an official Adapter target-replacement claim. */
export async function createColorSchemeSurfaceProbe(container: HTMLElement) {
  let target = document.createElement('div');
  target.dataset.colorSchemeSurface = 'current';
  container.append(target);
  let retired: HTMLElement | null = null;
  let renders = 0;
  let commits = 0;
  let disposed = false;
  let applier = createOwnedTwTokenApplier(target);
  const getter = createDefaultWebMetaGetter();
  const source = createDefaultWebColorSchemeSource(getter);
  if (!source) throw new Error('The colorScheme surface probe requires a document source.');
  const session = createRuntimeSession<{ enabled: boolean }>(
    {
      name: 'color-scheme-physical-surface-probe',
      setup(def) {
        def.props.define({ enabled: { type: 'boolean', default: true } });
        def.feedback.style.use(tw('bg-destructive/10'));
        def.rule({
          when: (w) => w.all(w.prop('enabled').eq(true), w.meta('colorScheme').eq('dark')),
          intent: (i) => i.feedback.style.use(tw('bg-destructive/20')),
        });
        return (renderer) => {
          renders++;
          return renderer.el('span', 'Retained Runtime template');
        };
      },
    },
    {
      prototypeName: 'color-scheme-physical-surface-probe',
      getRawProps: () => ({ enabled: true }),
      schedule: (task) => queueMicrotask(task),
      commit(children, signal) {
        commits++;
        commitChildren(target, children, { mode: 'light' });
        signal?.done();
      },
      onRuntimeReady(wiring) {
        wiring.attach('rule-meta', [
          [RULE_META_GET_CAP, getter],
          [RULE_META_COLOR_SCHEME_SOURCE_CAP, source],
        ]);
        wiring.attach('feedback', [[EFFECTS_CAP, createWebEffectsPort(applier)]]);
      },
    }
  );
  await session.mount();

  return {
    read() {
      return { epoch: session.mountEpoch, renders, commits, target, retired };
    },
    replace() {
      if (disposed) return;
      const next = document.createElement('div');
      next.dataset.colorSchemeSurface = 'current';
      commitChildren(next, session.children, { mode: 'light' });
      applier.clear();
      retired = target;
      retired.dataset.colorSchemeSurface = 'retired';
      retired.replaceWith(next);
      target = next;
      applier = createOwnedTwTokenApplier(target);
      session.caps.getWiring().attach('feedback', [[EFFECTS_CAP, createWebEffectsPort(applier)]]);
      // The physical host replays existing children without a Runtime update.
      // Notify its existing post-commit hooks to replay the retained style owner.
      session.caps.afterRenderCommit();
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      try {
        await session.dispose();
      } finally {
        applier.clear();
        target.remove();
        retired?.remove();
      }
    },
  };
}
