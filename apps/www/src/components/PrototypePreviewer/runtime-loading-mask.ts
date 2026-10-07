import {
  applyProjectionThemeSurfaceStyle,
  resolveProjectionThemeSurfaceStyle,
  watchProjectionThemeSurfaceStyle,
} from './projection-theme';
import { renderDemo } from './demo-renderer';
import { loadPrototypes } from './prototype-modules';
import type { DemoRenderResult, DemoSetupContext, DemoSpec } from './demo-types';
import type { SiteLibraryFamily } from '../site-library-family';
import type { RuntimeId } from './runtimes/ids';

export type RuntimeLoadingState = 'loading' | 'ready' | 'error';
const names = { wc: 'Web Components', react: 'React', vue: 'Vue', vue2: 'Vue 2' } as const;

/** A Website composition of real public atoms, on a stable WC lane. It does not
 * depend on, lock, or remount the framework that the reader is switching to. */
export function createRuntimeLoadingMask(options: {
  root: HTMLElement;
  content: HTMLElement;
  status?: HTMLElement | null;
  family(): SiteLibraryFamily;
  retry(): void;
  cancel(): void;
  restoreFocus?(origin: Element): void;
}) {
  const { root, content, status } = options;
  const document = root.ownerDocument;
  const zh = root.dataset.locale === 'zh-cn' || document.documentElement.lang.startsWith('zh');
  const mount = document.createElement('div');
  mount.dataset.runtimeLoadingMask = '';
  mount.hidden = true;
  Object.assign(mount.style, {
    position: 'absolute',
    inset: '0',
    zIndex: '2',
    pointerEvents: 'none',
  });
  const position = root.style.position;
  if (!position) root.style.position = 'relative';
  root.append(mount);
  let alive = true;
  let state: RuntimeLoadingState = 'ready';
  let target: RuntimeId = 'wc';
  let cancellable = false;
  let activeFamily: SiteLibraryFamily | null = null;
  let rendered: DemoRenderResult | undefined;
  let stopTheme: (() => void) | undefined;
  let context: DemoSetupContext | undefined;
  let pending: Promise<void> | undefined;
  let revision = 0;

  const sync = () => {
    if (!alive || !context) return;
    root.dataset.runtimeMaskReady = 'true';
    if (state === 'ready') {
      mount.hidden = true;
      mount.dataset.state = state;
      return;
    }
    const refs = context.refs;
    const loading = state === 'loading';
    const message = loading
      ? zh
        ? `正在切换到 ${names[target]}…`
        : `Switching to ${names[target]}…`
      : zh
        ? '切换未完成'
        : 'The switch could not finish';
    refs.title.textContent = message;
    refs.detail.textContent = loading
      ? zh
        ? '请稍候，正在准备这个交互示例。'
        : 'Please wait while this interactive example gets ready.'
      : zh
        ? '可用的内容已保留。可以重试，或返回当前示例。'
        : 'Available content is retained. Retry, or return to the current example.';
    refs.retry.textContent = zh ? '重试' : 'Retry';
    refs.cancel.textContent = loading
      ? zh
        ? '取消切换'
        : 'Cancel switch'
      : zh
        ? '返回示例'
        : 'Return to example';
    refs.retryBox.hidden = loading;
    refs.retryBox.style.display = loading ? 'none' : 'block';
    refs.cancelBox.hidden = !cancellable;
    refs.cancelBox.style.display = cancellable ? 'block' : 'none';
    refs.scrim.style.display = loading ? 'block' : 'none';
    mount.hidden = false;
    mount.dataset.state = state;
    mount.dataset.targetRuntime = target;
    root.dataset.runtimeMaskReady = 'true';
    // The pre-existing live status stays outside the busy content. Avoid a
    // second announcement from the visual Text atoms, without hiding actions.
    refs.title.setAttribute('aria-hidden', 'true');
    refs.detail.setAttribute('aria-hidden', 'true');
    if (status) status.textContent = message;
  };

  const prepare = (): Promise<void> => {
    if (!alive) return Promise.resolve();
    const family = options.family();
    if (context && activeFamily === family) {
      sync();
      return Promise.resolve();
    }
    if (pending) return pending;
    const currentRevision = ++revision;
    pending = (async () => {
      const ids = [`${family}-surface-root`, `${family}-text-root`, `${family}-button`];
      await loadPrototypes(ids);
      if (!alive || currentRevision !== revision) return;
      await rendered?.destroy();
      stopTheme?.();
      stopTheme = undefined;
      applyProjectionThemeSurfaceStyle(mount, resolveProjectionThemeSurfaceStyle(family, root));
      stopTheme = watchProjectionThemeSurfaceStyle(family, root, (theme) => {
        if (alive && currentRevision === revision) applyProjectionThemeSurfaceStyle(mount, theme);
      });
      context = undefined;
      const button = (ref: 'retry' | 'cancel') => ({
        kind: 'box' as const,
        ref: `${ref}Box`,
        children: [
          {
            kind: 'proto' as const,
            prototypeId: `${family}-button`,
            ref,
            props: { variant: family === 'brutalist' ? 'surface' : 'outline' },
            surfaceStyle: {
              minWidth: '0',
              maxWidth: '100%',
              height: 'auto',
              minHeight: '2.25rem',
              whiteSpace: 'normal',
              padding: '0.5rem 0.75rem',
            },
            children: [ref],
          },
        ],
      });
      const demo: DemoSpec = {
        type: 'demo',
        root: {
          kind: 'box',
          ref: 'frame',
          attrs: { role: 'group', 'aria-label': zh ? '示例切换状态' : 'Preview switch status' },
          children: [
            {
              kind: 'proto',
              prototypeId: `${family}-surface-root`,
              ref: 'scrim',
              props: { variant: 'scrim', radius: 'default', border: 'none' },
              surfaceStyle: {
                position: 'absolute',
                inset: '0',
                opacity: '0.16',
                pointerEvents: 'auto',
              },
              children: [],
            },
            {
              kind: 'proto',
              prototypeId: `${family}-surface-root`,
              ref: 'panel',
              props: { variant: 'outline', radius: 'default', border: 'all', elevation: 'raised' },
              surfaceStyle: {
                position: 'sticky',
                top: 'calc(var(--sl-nav-height, 5rem) + 1rem)',
                margin: '1rem auto',
                maxHeight: 'calc(100dvh - var(--sl-nav-height, 5rem) - 2rem)',
                overflowY: 'auto',
                display: 'grid',
                gap: '0.75rem',
                width: 'min(100%, 24rem)',
                minWidth: '0',
                padding: '1.25rem',
                pointerEvents: 'auto',
              },
              children: [
                {
                  kind: 'proto',
                  prototypeId: `${family}-text-root`,
                  ref: 'title',
                  props: { size: 'base', weight: 'semibold', leading: 'normal' },
                  surfaceStyle: { display: 'block', minWidth: '0', overflowWrap: 'anywhere' },
                  children: [''],
                },
                {
                  kind: 'proto',
                  prototypeId: `${family}-text-root`,
                  ref: 'detail',
                  props: { size: 'sm', tone: 'muted', leading: 'relaxed' },
                  surfaceStyle: { display: 'block', minWidth: '0', overflowWrap: 'anywhere' },
                  children: [''],
                },
                { kind: 'box', ref: 'actions', children: [button('retry'), button('cancel')] },
              ],
            },
          ],
        },
        setup(next) {
          context = next;
          Object.assign(next.refs.frame.style, {
            position: 'absolute',
            inset: '0',
            display: 'block',
            padding: '1rem',
            pointerEvents: 'none',
          });
          Object.assign(next.refs.actions.style, {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
          });
          next.refs.scrim.setAttribute('aria-hidden', 'true');
          const retry = (event: Event) => {
            if (event instanceof CustomEvent && alive && state === 'error') options.retry();
          };
          const cancel = (event: Event) => {
            if (event instanceof CustomEvent && alive && cancellable && state !== 'ready')
              options.cancel();
          };
          next.refs.retry.addEventListener('click', retry);
          next.refs.cancel.addEventListener('click', cancel);
          return () => {
            next.refs.retry.removeEventListener('click', retry);
            next.refs.cancel.removeEventListener('click', cancel);
          };
        },
      };
      rendered = await renderDemo({
        runtime: 'wc',
        host: mount,
        demo,
        isCurrent: () => alive && currentRevision === revision,
      });
      if (!alive || currentRevision !== revision) {
        await rendered.destroy();
        return;
      }
      activeFamily = family;
      sync();
    })()
      .catch((error) => {
        // The original native/live status remains a readable failure fallback.
        delete root.dataset.runtimeMaskReady;
        mount.hidden = true;
        console.error('[Runtime loading mask] Public atom preparation failed.', error);
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  };
  void prepare();
  return {
    get ready() {
      return pending ?? Promise.resolve();
    },
    setState(next: RuntimeLoadingState, runtime: RuntimeId, canCancel = false) {
      if (!alive) return;
      const focus = document.activeElement;
      const ownedFocus = focus && mount.contains(focus);
      state = next;
      target = runtime;
      cancellable = canCancel;
      content.setAttribute('aria-busy', String(next === 'loading'));
      if (next === 'ready') mount.hidden = true;
      sync();
      if (next === 'loading' && ownedFocus && context) {
        if (cancellable) context.refs.cancel.focus({ preventScroll: true });
        else {
          context.refs.frame.tabIndex = -1;
          context.refs.frame.focus({ preventScroll: true });
        }
      }
      if (next !== 'ready') void prepare();
      if (next === 'ready' && ownedFocus) options.restoreFocus?.(focus);
    },
    async destroy() {
      if (!alive) return;
      alive = false;
      revision++;
      stopTheme?.();
      stopTheme = undefined;
      await pending;
      await rendered?.destroy();
      mount.remove();
      delete root.dataset.runtimeMaskReady;
      if (!position && root.style.position === 'relative') root.style.position = '';
    },
  };
}
