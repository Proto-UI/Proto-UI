import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCopyCommandDemo, initCopyCommand, type SiteCopyCommand } from './site-copy-command';
import { createCopyController } from './site-copy-controller';
import { initSiteCopyCommands, readCopyText } from './site-copy-client';
import { applySiteLibraryFamily, resolveSiteLibraryFamily } from './site-library-family';

vi.mock('./PrototypePreviewer/projection-theme', () => ({
  resolveProjectionThemeSurfaceStyle: () => ({
    '--pui-background': '#fff',
    '--pui-foreground': '#111',
  }),
  applyProjectionThemeSurfaceStyle: () => {},
  watchProjectionThemeSurfaceStyle: (
    _family: unknown,
    _root: unknown,
    change: (theme: Record<string, string>) => void
  ) => {
    change({ '--pui-background': '#fff', '--pui-foreground': '#111' });
    return () => {};
  },
}));
vi.mock('./PrototypePreviewer/projection-materializer', async (original) => {
  const actual = await original<typeof import('./PrototypePreviewer/projection-materializer')>();
  return {
    ...actual,
    materializeProjectionCandidate: async (
      request: Parameters<typeof actual.materializeProjectionCandidate>[0],
      options: Parameters<typeof actual.materializeProjectionCandidate>[1]
    ) => {
      const { runtimeId, projectionFamilyId } = request.selection;
      faults.calls.push({ runtime: runtimeId, family: projectionFamilyId, owner: options.ownerId });
      await faults.before?.(runtimeId, projectionFamilyId);
      if (runtimeId !== 'wc') throw Error('fixture unavailable runtime');
      if (faults.wcFailures > 0) {
        faults.wcFailures -= 1;
        throw Error('fixture first WC failure');
      }
      const candidate = await actual.materializeProjectionCandidate(request, options);
      faults.completed.push({ owner: options.ownerId, host: candidate.host });
      return candidate;
    },
  };
});
const mounted: SiteCopyCommand[] = [];
const releases: Array<() => void> = [];
const settle = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
const faults = vi.hoisted(() => ({
  wcFailures: 0,
  calls: [] as Array<{ runtime: string; family: string; owner: string }>,
  completed: [] as Array<{ owner: string; host: HTMLElement }>,
  before: null as null | ((runtime: string, family: string) => Promise<void> | void),
}));
afterEach(async () => {
  for (const release of releases.splice(0)) release();
  for (const handle of mounted.splice(0)) await handle.destroy();
  document.body.innerHTML = '';
  delete document.documentElement.dataset.siteLibraryFamily;
  localStorage.clear();
  faults.calls.length = 0;
  faults.completed.length = 0;
  faults.wcFailures = 0;
  faults.before = null;
  vi.restoreAllMocks();
});
function fixture() {
  document.body.innerHTML = '<div data-site-copy></div><input id="elsewhere">';
  const root = document.querySelector<HTMLElement>('[data-site-copy]')!;
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  return { root, writeText };
}

describe('real WC Copy command composition', () => {
  it('uses actual family Button/Lucide/LiveRegion, filters native duplication and keeps a stable name', async () => {
    const { root, writeText } = fixture();
    const handle = initCopyCommand(root, () => '<&\n');
    mounted.push(handle);
    await handle.ready;
    const button = root.querySelector<HTMLElement>('[data-demo-ref="copy-button"]')!;
    expect(button.tagName).toContain('SHADCN-BUTTON');
    expect(button.getAttribute('role')).toBe('button');
    expect(root.querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
    expect(root.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    expect(button.textContent).toBe('Copy code');
    expect(button.hasAttribute('aria-expanded')).toBe(false);
    // The real WC Adapter translates the native click into its outward signal.
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(writeText).toHaveBeenCalledTimes(1);
    button.dispatchEvent(new CustomEvent('click', { bubbles: true }));
    await settle();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith('<&\n');
    expect(button.textContent).toBe('Copy code');
    expect(button.dataset.copyState).toBe('success');
    expect(root.querySelector('[role="status"]')?.textContent).toBe('Copied');
    expect(initCopyCommand(root, () => 'wrong')).toBe(handle);
  }, 15000);
  it('remounts family while pending and delivers settlement only to the current view', async () => {
    const { root, writeText } = fixture();
    let done!: () => void;
    writeText.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          done = resolve;
        })
    );
    const handle = initCopyCommand(root, () => 'payload');
    mounted.push(handle);
    await handle.ready;
    const old = root.querySelector<HTMLElement>('[data-demo-ref="copy-button"]')!;
    old.dispatchEvent(new CustomEvent('click'));
    await settle();
    document.documentElement.dataset.siteLibraryFamily = 'brutalist';
    await vi.waitFor(() => expect(root.dataset.copyFamily).toBe('brutalist'));
    const current = root.querySelector<HTMLElement>('[data-demo-ref="copy-button"]')!;
    expect(current).not.toBe(old);
    expect(current.tagName).toContain('BRUTALIST-BUTTON');
    expect(current.getAttribute('aria-disabled')).toBe('false');
    current.click();
    expect(writeText).toHaveBeenCalledTimes(1);
    done();
    await settle();
    expect(current.dataset.copyState).toBe('success');
    expect(current.getAttribute('aria-disabled')).toBe('false');
    old.dispatchEvent(new CustomEvent('click'));
    await settle();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(old.isConnected).toBe(false);
  });
  it('retains its prior truthful runtime on candidate failure, without stealing newer focus', async () => {
    const { root, writeText } = fixture();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const handle = initCopyCommand(root, () => 'payload');
    mounted.push(handle);
    await handle.ready;
    const button = root.querySelector<HTMLElement>('[data-demo-ref="copy-button"]')!;
    button.focus();
    document.dispatchEvent(
      new CustomEvent('proto-adapter:change', { detail: { adapter: 'react' } })
    );
    document.querySelector<HTMLInputElement>('#elsewhere')!.focus();
    await vi.waitFor(() => expect(root.dataset.copyView).toBe('retained'));
    expect(root.dataset.copyRuntime).toBe('wc');
    expect(document.activeElement?.id).toBe('elsewhere');
    button.dispatchEvent(new CustomEvent('click'));
    await settle();
    expect(writeText).toHaveBeenCalledTimes(1);
  });
  it('uses only the embedded previewer committed runtime, not an uncommitted preference', async () => {
    const { root } = fixture();
    const previewer = Object.assign(document.createElement('div'), {
      __previewer__: { getCurrentRuntime: () => 'wc' },
    });
    previewer.dataset.previewerId = 'fixture';
    root.before(previewer);
    previewer.append(root);
    previewer.__previewer__ = { getCurrentRuntime: () => 'wc' };
    localStorage.setItem('preferred-prototypes-adapter', 'react');
    const handle = initCopyCommand(root, () => 'payload');
    mounted.push(handle);
    await handle.ready;
    expect(root.dataset.copyRuntime).toBe('wc');
    document.dispatchEvent(new CustomEvent('proto-adapter:change', { detail: { adapter: 'vue' } }));
    await settle();
    expect(root.dataset.copyRuntime).toBe('wc');
  });
  it('removes listeners on double disposal and allows one fresh initialization', async () => {
    const { root, writeText } = fixture();
    const handle = initCopyCommand(root, () => 'payload');
    await handle.ready;
    const old = root.querySelector<HTMLElement>('[data-demo-ref="copy-button"]')!;
    await handle.destroy();
    await handle.destroy();
    old.dispatchEvent(new CustomEvent('click'));
    expect(writeText).not.toHaveBeenCalled();
    const next = initCopyCommand(root, () => 'new');
    mounted.push(next);
    await next.ready;
    expect(root.querySelectorAll('[data-demo-ref="copy-button"]')).toHaveLength(1);
  });
});

describe('Copy source and page lifetime', () => {
  it.each(['react', 'vue', 'vue2'] as const)(
    'revokes %s framework callbacks and carries the complete prop bag',
    async (runtime) => {
      const { root, writeText } = fixture();
      const owner = createCopyController({ readText: () => 'payload', writeText });
      const button = document.createElement('div');
      const feedback = document.createElement('div');
      root.append(button, feedback);
      let active = false;
      const setProps = vi.fn();
      const demo = createCopyCommandDemo(root, owner, runtime, 'brutalist', () => active);
      const cleanup = demo.setup!({
        host: root,
        refs: { 'copy-button': button, 'copy-feedback': feedback },
        api: { setProps, call() {}, getExposes: () => ({}) },
      });
      await settle();
      const bag = setProps.mock.calls.find(([ref]) => ref === 'copy-button')![1];
      expect(bag).toMatchObject({
        variant: 'surface',
        size: 'icon',
        disabled: false,
        onClick: expect.any(Function),
      });
      bag.onClick();
      expect(writeText).not.toHaveBeenCalled();
      active = true;
      bag.onClick();
      await settle();
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(feedback.textContent).toBe('Copied');
      if (typeof cleanup === 'function') cleanup();
      bag.onClick();
      await settle();
      expect(writeText).toHaveBeenCalledTimes(1);
      owner.dispose();
    }
  );
  it('reads exact highlighted raw text, manager selection and empty EC payload independently', () => {
    document.body.innerHTML =
      '<figure data-code-shell><div data-site-copy></div><pre class="proto-previewer__code"><code data-raw-code="&lt;&amp;">wrong</code></pre></figure><figure data-install-command-card><div data-site-copy></div><pre data-command-panel="npm" hidden><code data-command>npm</code></pre><pre data-command-panel="pnpm"><code data-command>pnpm</code></pre></figure><div data-site-copy data-site-copy-text=""></div>';
    const roots = [...document.querySelectorAll<HTMLElement>('[data-site-copy]')];
    expect(roots.map(readCopyText)).toEqual(['<&', 'pnpm', '']);
  });
  it('double init, removal and Astro replacement revoke the exact old page owners', async () => {
    const { root, writeText } = fixture();
    root.dataset.siteCopyText = 'payload';
    const dispose = initSiteCopyCommands();
    releases.push(dispose);
    expect(initSiteCopyCommands()).toBe(dispose);
    await vi.waitFor(() => expect(root.dataset.copyView).toBe('ready'));
    const button = root.querySelector<HTMLElement>('[data-demo-ref="copy-button"]')!;
    root.remove();
    await vi.waitFor(() => expect(root.querySelector('.site-copy-mount')).toBeNull());
    button.dispatchEvent(new CustomEvent('click'));
    expect(writeText).not.toHaveBeenCalled();
    document.dispatchEvent(new Event('astro:before-swap'));
    dispose();
  });
});

describe('initial projection recovery', () => {
  it('keeps the real WC control focused while pending and suppresses repeated native writes', async () => {
    const { root, writeText } = fixture();
    let finish!: () => void;
    writeText.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const handle = initCopyCommand(root, () => 'payload');
    mounted.push(handle);
    await handle.ready;
    const button = root.querySelector<HTMLElement>('[data-demo-ref="copy-button"]')!;
    const idleGlyph = button.querySelector('svg')!.innerHTML;
    button.focus();
    button.click();
    await settle();
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-disabled')).toBe('false');
    expect(button.dataset.copyState).toBe('pending');
    expect(button.textContent).toBe('Copy code');
    expect(root.querySelector('[role="status"]')?.textContent).toBe('Copying');
    expect(button.querySelector('svg')!.innerHTML).not.toBe(idleGlyph);
    button.click();
    button.click();
    expect(writeText).toHaveBeenCalledTimes(1);
    finish();
    await settle();
    expect(document.activeElement).toBe(button);
    expect(button.dataset.copyState).toBe('success');
    expect(writeText).toHaveBeenCalledTimes(1);
  }, 15000);
  it('restarts at the latest WC selection after the initial React failure', async () => {
    const { root, writeText } = fixture();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('preferred-prototypes-adapter', 'react');
    const handle = initCopyCommand(root, () => 'payload');
    mounted.push(handle);
    await handle.ready;
    expect(root.dataset.copyView).toBe('unavailable');
    const owner = handle.owner;
    document.dispatchEvent(new CustomEvent('proto-adapter:change', { detail: { adapter: 'wc' } }));
    await settle();
    // Discriminates the reported guard failure and retrying the obsolete React input.
    expect(faults.calls.map((call) => call.runtime)).toEqual(['react', 'wc']);
    expect(faults.calls[1].owner).not.toBe(faults.calls[0].owner);
    await vi.waitFor(() => expect(root.dataset.copyView).toBe('ready'), { timeout: 15000 });
    expect(root.dataset.copyRuntime).toBe('wc');
    expect(handle.owner).toBe(owner);
    expect(writeText).not.toHaveBeenCalled();
    root.querySelector<HTMLElement>('[data-demo-ref="copy-button"]')!.click();
    await settle();
    expect(writeText).toHaveBeenCalledTimes(1);
  }, 20000);

  it('retries the same selection after a transient first failure', async () => {
    const { root } = fixture();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    faults.wcFailures = 1;
    const handle = initCopyCommand(root, () => 'payload');
    mounted.push(handle);
    await handle.ready;
    expect(root.dataset.copyView).toBe('unavailable');
    handle.refresh();
    await settle();
    expect(faults.calls.map((call) => call.runtime)).toEqual(['wc', 'wc']);
    await vi.waitFor(() => expect(root.dataset.copyView).toBe('ready'), { timeout: 15000 });
    expect(root.querySelectorAll('[data-demo-ref="copy-button"]')).toHaveLength(1);
  }, 20000);

  it('lets newer requests supersede a restart and isolates its late cleanup from the next attempt', async () => {
    const { root, writeText } = fixture();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('preferred-prototypes-adapter', 'react');
    const handle = initCopyCommand(root, () => 'payload');
    mounted.push(handle);
    await handle.ready;
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    let delayOnce = true;
    faults.before = (runtime) => {
      if (runtime === 'wc' && delayOnce) {
        delayOnce = false;
        return delayed;
      }
    };
    try {
      document.dispatchEvent(
        new CustomEvent('proto-adapter:change', { detail: { adapter: 'wc' } })
      );
      await settle();
      const slowOwner = faults.calls.at(-1)!.owner;
      document.dispatchEvent(
        new CustomEvent('proto-adapter:change', { detail: { adapter: 'vue' } })
      );
      await settle();
      expect(faults.calls.at(-1)?.runtime).toBe('vue');
      await vi.waitFor(() => expect(errors).toHaveBeenCalledTimes(2));
      expect(root.dataset.copyView).toBe('unavailable');
      document.documentElement.dataset.siteLibraryFamily = 'brutalist';
      document.dispatchEvent(
        new CustomEvent('proto-adapter:change', { detail: { adapter: 'wc' } })
      );
      await vi.waitFor(() => expect(root.dataset.copyFamily).toBe('brutalist'), { timeout: 15000 });
      const current = root.querySelector<HTMLElement>(
        '[data-projection-generation-state="active"] [data-demo-ref="copy-button"]'
      )!;
      const currentOwner = current.getAttribute('data-projection-owner');
      expect(currentOwner).not.toBe(slowOwner);
      current.click();
      await settle();
      expect(writeText).toHaveBeenCalledTimes(1);
      release();
      await vi.waitFor(
        () =>
          expect(faults.completed.some((candidate) => candidate.owner === slowOwner)).toBe(true),
        { timeout: 15000 }
      );
      const retiredHost = faults.completed.find((candidate) => candidate.owner === slowOwner)!.host;
      await vi.waitFor(() => expect(retiredHost.isConnected).toBe(false));
      await vi.waitFor(
        () => expect(root.querySelectorAll('[data-projection-generation-host]')).toHaveLength(1),
        { timeout: 15000 }
      );
      expect(current.isConnected).toBe(true);
      expect(root.dataset.copyRuntime).toBe('wc');
      expect(root.dataset.copyView).toBe('ready');
      expect(writeText).toHaveBeenCalledTimes(1);
    } finally {
      release();
    }
  }, 20000);
});

describe('Install Copy route and fixture input ordering', () => {
  it('follows the nearest family after delayed route synchronization and repeated commits', async () => {
    const { root, writeText } = fixture();
    const frame = document.createElement('div');
    frame.dataset.siteFamilyScope = '';
    root.before(frame);
    const card = document.createElement('figure');
    card.dataset.installCommandCard = '';
    frame.append(card);
    card.append(root);
    applySiteLibraryFamily(document, 'shadcn');
    const handle = initCopyCommand(root, () => 'npx @proto.ui/cli@latest add wc shadcn-button');
    mounted.push(handle);
    await handle.ready;
    root.querySelector<HTMLElement>('[data-demo-ref="copy-button"]')!.click();
    await settle();
    expect(writeText).toHaveBeenCalledTimes(1);
    const routeSync = () =>
      applySiteLibraryFamily(
        document,
        resolveSiteLibraryFamily('/zh-cn/ui-libraries/shadcn/button/')
      );
    document.addEventListener('astro:page-load', routeSync);
    try {
      // Discriminating fixture control: a later real PageFrame route write is
      // allowed to replace a test's global family injection. It is not evidence
      // that the Copy consumer lost its subscription.
      applySiteLibraryFamily(document, 'brutalist');
      document.dispatchEvent(new Event('astro:page-load'));
      await vi.waitFor(() => expect(root.dataset.copyFamily).toBe('shadcn'), { timeout: 15000 });
      expect(frame.dataset.siteLibraryFamily).toBe('shadcn');
      applySiteLibraryFamily(document, 'brutalist');
      await vi.waitFor(() => expect(root.dataset.copyFamily).toBe('brutalist'), { timeout: 15000 });
      expect(root.dataset.copyView).toBe('ready');
      expect(root.querySelectorAll('[data-demo-ref="copy-button"]')).toHaveLength(1);
      expect(writeText).toHaveBeenCalledTimes(1);
      routeSync();
      await vi.waitFor(() => expect(root.dataset.copyFamily).toBe('shadcn'), { timeout: 15000 });
      card.dataset.siteLibraryFamily = 'brutalist';
      await vi.waitFor(
        () =>
          expect(
            root.dataset.copyFamily,
            JSON.stringify({
              connected: root.isConnected,
              cardConnected: card.isConnected,
              currentPreference: localStorage.getItem('preferred-prototypes-adapter'),
              frameFamily: frame.dataset.siteLibraryFamily,
              cardFamily: card.dataset.siteLibraryFamily,
              nearest: root.closest<HTMLElement>('[data-site-library-family]')?.dataset
                .siteLibraryFamily,
              calls: faults.calls,
              view: root.dataset.copyView,
              candidates: faults.completed.map(({ host }) => ({
                connected: host.isConnected,
                state: host.dataset.projectionGenerationState,
                family: host.dataset.projectionFamily,
              })),
            })
          ).toBe('brutalist'),
        { timeout: 15000 }
      );
      routeSync();
      await settle();
      expect(root.dataset.copyFamily).toBe('brutalist');
      delete card.dataset.siteLibraryFamily;
      await vi.waitFor(() => expect(root.dataset.copyFamily).toBe('shadcn'), { timeout: 15000 });
    } finally {
      document.removeEventListener('astro:page-load', routeSync);
    }
  }, 25000);
});
