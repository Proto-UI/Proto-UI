import { afterEach, describe, expect, it, vi } from 'vitest';
import { initCodeSurface, initSiteCodeSurfaces, type CodeSurfaceHandle } from './site-code-surface';
import { BRUTALIST_THEME } from '../../../../packages/prototypes/brutalist/src/theme';
import { WEBSITE_SHADCN_THEME_TOKENS } from './PrototypePreviewer/projection-theme';

// The actual four adapters/frameworks render. Only their remote CDN loader is
// replaced with installed packages; this is not hosted-network/pixel evidence.
vi.mock('./PrototypePreviewer/runtimes/react-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/react/package.json');
  return {
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
vi.mock('./PrototypePreviewer/runtimes/vue-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/apps/www/package.json');
  return { loadVue: async () => require('vue') };
});
vi.mock('./PrototypePreviewer/runtimes/vue2-runtime', async (original) => {
  const current = await original<typeof import('./PrototypePreviewer/runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/vue2/package.json');
  return { ...current, loadVue2: async () => require('vue') };
});
const faults = vi.hoisted(() => ({ reject: '', delay: null as null | (() => Promise<void>) }));
vi.mock('./PrototypePreviewer/projection-materializer', async (original) => {
  const actual = await original<typeof import('./PrototypePreviewer/projection-materializer')>();
  return {
    ...actual,
    materializeProjectionCandidate: async (
      ...args: Parameters<typeof actual.materializeProjectionCandidate>
    ) => {
      await faults.delay?.();
      if (args[0].selection.runtimeId === faults.reject)
        throw Error('fixture materialization failure');
      return actual.materializeProjectionCandidate(...args);
    },
  };
});
const handles: CodeSurfaceHandle[] = [];
const releases: Array<() => void> = [];
afterEach(async () => {
  for (const release of releases.splice(0)) release();
  for (const handle of handles.splice(0)) await handle.destroy();
  document.body.replaceChildren();
  localStorage.clear();
  document.documentElement.removeAttribute('style');
  document.querySelectorAll('[data-code-surface-fixture]').forEach((node) => node.remove());
  delete document.documentElement.dataset.siteLibraryFamily;
  delete document.documentElement.dataset.theme;
  faults.reject = '';
  faults.delay = null;
  vi.restoreAllMocks();
});
function fixture() {
  for (const name of WEBSITE_SHADCN_THEME_TOKENS)
    document.documentElement.style.setProperty(
      `--pui-${name}`,
      name.startsWith('radius') ? '12px' : '#f4f4f5'
    );
  // HappyDOM does not inherit custom properties into generated descendants.
  // A fixture stylesheet declares the input map directly on all test nodes;
  // actual resolution/watchers/adapters remain real. This proves no CSS paint.
  const style = document.createElement('style');
  style.dataset.codeSurfaceFixture = '';
  style.textContent = `* { ${WEBSITE_SHADCN_THEME_TOKENS.map((name) => `--pui-${name}: ${name.startsWith('radius') ? '12px' : '#f4f4f5'};`).join(' ')} }`;
  document.head.append(style);
  document.body.innerHTML =
    '<figure data-site-code-surface="frame"><pre tabindex="0"><code>  const source = "&lt;&amp;";\n</code></pre><button id="command">Command</button></figure>';
  const root = document.querySelector<HTMLElement>('figure')!;
  return {
    root,
    pre: root.querySelector('pre')!,
    code: root.querySelector('code')!,
    button: root.querySelector('button')!,
  };
}
describe('actual passive CodeSurface projection', () => {
  it.each(['wc', 'react', 'vue', 'vue2'])(
    '%s preserves source, selection and native command/focus ownership across family changes',
    async (runtime) => {
      const { root, pre, code, button } = fixture();
      localStorage.setItem('preferred-prototypes-adapter', runtime);
      button.focus();
      const click = vi.fn();
      button.addEventListener('click', click);
      const range = document.createRange();
      range.selectNodeContents(code);
      document.getSelection()!.addRange(range);
      const handle = initCodeSurface(root);
      handles.push(handle);
      await handle.ready;
      expect(root.dataset.codeSurfaceRuntime).toBe(runtime);
      const paint = root.querySelector('[data-pui-style]')!;
      expect(paint.getAttribute('data-pui-style')).toContain('bg-muted');
      expect(paint.hasAttribute('role')).toBe(false);
      expect(paint.hasAttribute('tabindex')).toBe(false);
      expect(root.querySelector('pre')).toBe(pre);
      expect(root.querySelector('code')).toBe(code);
      expect(document.activeElement).toBe(button);
      expect(document.getSelection()!.toString()).toContain('const source');
      document.documentElement.dataset.siteLibraryFamily = 'brutalist';
      await vi.waitFor(() => expect(root.dataset.codeSurfaceFamily).toBe('brutalist'));
      expect(root.querySelector('[data-pui-style]')).not.toBe(paint);
      expect(root.querySelector('code')).toBe(code);
      expect(document.activeElement).toBe(button);
      const brutalistPaint = root.querySelector<HTMLElement>('[data-pui-style]')!;
      document.documentElement.dataset.theme = 'dark';
      await vi.waitFor(() =>
        expect(brutalistPaint.style.getPropertyValue('--pui-background')).toBe(
          BRUTALIST_THEME.dark.background
        )
      );
      expect(root.querySelector('[data-pui-style]')).toBe(brutalistPaint);
      expect(root.querySelector('code')).toBe(code);
      button.click();
      expect(click).toHaveBeenCalledTimes(1);
      expect(root.querySelectorAll('button')).toHaveLength(1);
      expect(root.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
      await handle.destroy();
      expect(root.querySelector('.site-code-surface-mount')).toBeNull();
      expect(code.textContent).toBe('  const source = "<&";\n');
    },
    20000
  );
  it('retains truthful runtime on failure, retries initial failure, and ignores late completion after disposal', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { root, code, button } = fixture();
    faults.reject = 'wc';
    const handle = initCodeSurface(root);
    handles.push(handle);
    await handle.ready;
    expect(root.dataset.codeSurfaceView).toBe('unavailable');
    expect(code.isConnected).toBe(true);
    faults.reject = '';
    handle.refresh();
    await vi.waitFor(() => expect(root.dataset.codeSurfaceView).toBe('ready'));
    const paint = root.querySelector('[data-pui-style]');
    faults.reject = 'react';
    button.focus();
    document.dispatchEvent(
      new CustomEvent('proto-adapter:change', { detail: { adapter: 'react' } })
    );
    await vi.waitFor(() => expect(root.dataset.codeSurfaceView).toBe('retained'));
    expect(root.dataset.codeSurfaceRuntime).toBe('wc');
    expect(root.querySelector('[data-pui-style]')).toBe(paint);
    expect(document.activeElement).toBe(button);
    faults.reject = '';
    let resolve!: () => void;
    faults.delay = () =>
      new Promise<void>((done) => {
        resolve = done;
      });
    document.dispatchEvent(new CustomEvent('proto-adapter:change', { detail: { adapter: 'vue' } }));
    await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
    const disposed = handle.destroy();
    resolve();
    await disposed;
    expect(root.querySelector('.site-code-surface-mount')).toBeNull();
    expect(root.dataset.codeSurfaceRuntime).toBeUndefined();
    expect(root.querySelector('code')).toBe(code);
  });
  it('follows embedded committed runtime rather than uncommitted preference', async () => {
    const { root } = fixture();
    let committedRuntime: string = 'wc';
    const previewer = Object.assign(document.createElement('section'), {
      __previewer__: { getCurrentRuntime: () => committedRuntime },
    });
    previewer.dataset.previewerId = 'fixture';
    root.before(previewer);
    previewer.append(root);
    localStorage.setItem('preferred-prototypes-adapter', 'react');
    const handle = initCodeSurface(root);
    handles.push(handle);
    await handle.ready;
    document.dispatchEvent(new CustomEvent('proto-adapter:change', { detail: { adapter: 'vue' } }));
    expect(root.dataset.codeSurfaceRuntime).toBe('wc');
    committedRuntime = 'vue';
    previewer.dispatchEvent(new CustomEvent('runtime:changed'));
    await vi.waitFor(() => expect(root.dataset.codeSurfaceRuntime).toBe('vue'));
  });
  it('bounds observer scans, initializes once, cleans removed roots, and permits a fresh page lifetime', async () => {
    const { root } = fixture();
    const release = initSiteCodeSurfaces();
    releases.push(release);
    expect(initSiteCodeSurfaces()).toBe(release);
    await vi.waitFor(() => expect(root.dataset.codeSurfaceView).toBe('ready'));
    expect(root.querySelectorAll('.site-code-surface-mount')).toHaveLength(1);
    root.remove();
    await vi.waitFor(() => expect(root.querySelector('.site-code-surface-mount')).toBeNull());
    release();
    document.body.append(root);
    releases.push(initSiteCodeSurfaces());
    await vi.waitFor(() => expect(root.dataset.codeSurfaceView).toBe('ready'));
    expect(root.querySelectorAll('.site-code-surface-mount')).toHaveLength(1);
  });
  it.each(
    ['wc', 'react', 'vue', 'vue2'].flatMap((runtime) =>
      ['startup', 'replacement'].map((phase) => ({ runtime, phase }))
    )
  )(
    '$runtime/$phase: late removed-owner cleanup preserves the reinserted source and new projection',
    async ({ runtime, phase }) => {
      const { root, pre, code, button } = fixture();
      localStorage.setItem('preferred-prototypes-adapter', runtime);
      const gate = (() => {
        let resolve!: () => void;
        const promise = new Promise<void>((done) => {
          resolve = done;
        });
        releases.push(resolve);
        return { promise, resolve };
      })();
      const delayed = vi.fn(() => gate.promise);
      if (phase === 'startup') faults.delay = delayed;
      releases.push(initSiteCodeSurfaces());
      const first = initCodeSurface(root);
      handles.push(first);
      if (phase === 'replacement') {
        await first.ready;
        faults.delay = delayed;
        document.documentElement.dataset.siteLibraryFamily = 'brutalist';
      }
      await vi.waitFor(() => expect(delayed).toHaveBeenCalledOnce());
      faults.delay = null;
      const oldMount = root.querySelector('.site-code-surface-mount')!;
      const destroy = vi.spyOn(first, 'destroy');
      root.remove();
      await vi.waitFor(() => expect(destroy).toHaveBeenCalledOnce());
      const oldCleanup = destroy.mock.results[0].value as Promise<void>;
      document.body.append(root);
      await vi.waitFor(() =>
        expect(
          [...root.querySelectorAll('.site-code-surface-mount')].some((mount) => mount !== oldMount)
        ).toBe(true)
      );
      const next = initCodeSurface(root);
      expect(next).not.toBe(first);
      handles.push(next);
      await next.ready;
      const mount = [...root.querySelectorAll('.site-code-surface-mount')].find(
        (mount) => mount !== oldMount
      )!;
      const paint = mount.querySelector('[data-pui-style]')!;
      const source = code.textContent;
      const click = vi.fn();
      button.addEventListener('click', click);
      button.focus();
      const range = document.createRange();
      range.selectNodeContents(code);
      document.getSelection()!.addRange(range);
      const expectedFamily = phase === 'replacement' ? 'brutalist' : 'shadcn';
      const assertNewOwner = () => {
        expect(oldMount.isConnected).toBe(false);
        expect(oldMount.contains(code)).toBe(false);
        expect([...root.children]).toEqual([mount, pre, button]);
        expect(root.querySelectorAll('.site-code-surface-mount')).toHaveLength(1);
        expect(root.querySelector('[data-pui-style]')).toBe(paint);
        expect(root.querySelector('code')).toBe(code);
        expect(code.parentElement).toBe(pre);
        expect(code.textContent).toBe(source);
        expect(root.dataset.codeSurfaceRuntime).toBe(runtime);
        expect(root.dataset.codeSurfaceFamily).toBe(expectedFamily);
        expect(root.dataset.codeSurfaceView).toBe('ready');
        expect(document.activeElement).toBe(button);
        expect(document.getSelection()!.toString()).toContain('const source');
      };
      assertNewOwner();
      gate.resolve();
      await oldCleanup;
      assertNewOwner();
      expect(initCodeSurface(root)).toBe(next);
      button.click();
      expect(click).toHaveBeenCalledOnce();
    },
    20000
  );
});
