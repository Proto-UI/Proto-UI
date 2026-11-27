import { afterEach, describe, expect, it, vi } from 'vitest';
import { initInstallCommandCards } from './install-command-card-client';

function fixture(id: string, tag = 'wc-shadcn-button'): HTMLElement {
  const card = document.createElement('figure');
  card.id = id;
  card.dataset.installCommandCard = '';
  card.dataset.activeManager = 'npm';
  card.innerHTML = `
    <${tag} data-manager-tab="npm" data-site-control-family="shadcn" aria-pressed="true">npm</${tag}>
    <${tag} data-manager-tab="pnpm" data-site-control-family="shadcn" aria-pressed="false">pnpm</${tag}>
    <pre data-command-panel="npm">npx @proto.ui/cli@0.2.0 --help</pre>
    <pre data-command-panel="pnpm" class="install-command-card__body--hidden" hidden>pnpm dlx @proto.ui/cli@0.2.0 --help</pre>`;
  document.body.append(card);
  return card;
}

afterEach(() => {
  document.dispatchEvent(new Event('astro:before-swap'));
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('InstallCommandCard navigation lifetime', () => {
  it('initializes new cards after navigation and ignores retired controls', () => {
    const first = fixture('before');
    initInstallCommandCards(document);
    const oldTab = first.querySelector<HTMLElement>('[data-manager-tab="pnpm"]')!;
    oldTab.dispatchEvent(new CustomEvent('click', { bubbles: true }));
    expect(first.dataset.activeManager).toBe('pnpm');
    document.dispatchEvent(new Event('astro:before-swap'));
    first.remove();
    const next = fixture('after');
    initInstallCommandCards(document);
    const newTab = next.querySelector<HTMLElement>('[data-manager-tab="pnpm"]')!;
    newTab.dispatchEvent(new CustomEvent('click', { bubbles: true }));
    expect(next.dataset.activeManager).toBe('pnpm');
    expect(next.querySelector<HTMLElement>('[data-command-panel="pnpm"]')!.hidden).toBe(false);
    expect(next.querySelector<HTMLElement>('[data-command-panel="npm"]')!.hidden).toBe(true);
    first.dataset.activeManager = 'retired';
    oldTab.dispatchEvent(new CustomEvent('click', { bubbles: true }));
    expect(first.dataset.activeManager).toBe('retired');
    expect(first.dataset.installCommandInit).toBeUndefined();
  });

  it.each(['wc-shadcn-button', 'wc-brutalist-button', 'wc-bootstrap-2-3-2-button'])(
    'accepts one outward activation from %s without consuming its native click',
    (tag) => {
      const card = fixture('projected', tag);
      const tab = card.querySelector<HTMLElement>('[data-manager-tab="pnpm"]')!;
      initInstallCommandCards(card);
      tab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(card.dataset.activeManager).toBe('npm');
      tab.dispatchEvent(new CustomEvent('click', { bubbles: true }));
      expect(card.dataset.activeManager).toBe('pnpm');
      expect(tab.getAttribute('aria-pressed')).toBe('true');
    }
  );

  it('keeps repeated page initialization idempotent and supports native controls', () => {
    const card = fixture('native', 'button');
    const tab = card.querySelector<HTMLElement>('[data-manager-tab="pnpm"]')!;
    const write = vi.spyOn(tab, 'setAttribute');
    for (let index = 0; index < 8; index++) initInstallCommandCards(document);
    tab.click();
    expect(card.dataset.activeManager).toBe('pnpm');
    expect(write.mock.calls.filter(([name]) => name === 'aria-pressed')).toHaveLength(1);
  });

  it('does not let a detached card change state before observer cleanup runs', () => {
    const card = fixture('detached');
    initInstallCommandCards(card);
    card.remove();
    card
      .querySelector<HTMLElement>('[data-manager-tab="pnpm"]')!
      .dispatchEvent(new CustomEvent('click', { bubbles: true }));
    expect(card.dataset.activeManager).toBe('npm');
  });

  it('does not select an unavailable command and preserves literal command text', () => {
    const card = fixture('unknown', 'button');
    const tab = card.querySelector<HTMLElement>('[data-manager-tab="pnpm"]')!;
    const command = card.querySelector<HTMLElement>('[data-command-panel="pnpm"]')!;
    command.textContent = 'pnpm dlx @proto.ui/cli@0.2.0 add wc base-button';
    tab.dataset.managerTab = 'missing';
    initInstallCommandCards(card);
    tab.click();
    expect(card.dataset.activeManager).toBe('npm');
    expect(command.textContent).toBe('pnpm dlx @proto.ui/cli@0.2.0 add wc base-button');
    expect(command.hidden).toBe(true);
  });

  it.each(['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'] as const)(
    'upgrades [data-install-managers] to real %s family Tabs without native scrollbar and tears down cleanly',
    async (family) => {
      const card = document.createElement('figure');
      card.id = `tabs-${family}`;
      card.dataset.installCommandCard = '';
      card.dataset.activeManager = 'npm';
      card.dataset.projectionFamily = family;
      card.innerHTML = `
        <div data-install-managers aria-label="Package manager">
          <button type="button" data-manager-tab="npm" aria-pressed="true">npm</button>
          <button type="button" data-manager-tab="pnpm" aria-pressed="false">pnpm</button>
        </div>
        <div id="p-npm" data-command-panel="npm"><pre class="install-command-card__body"><code data-command>npx @proto.ui/cli add</code></pre></div>
        <div id="p-pnpm" data-command-panel="pnpm" hidden><pre class="install-command-card__body"><code data-command>pnpm dlx @proto.ui/cli add</code></pre></div>`;
      document.body.append(card);
      initInstallCommandCards(card);
      const projectedRoot = card.querySelector<HTMLElement>(
        `[data-install-command-tabs-projection="${family}"]`
      );
      expect(projectedRoot?.tagName.toLowerCase()).toBe(`pui-install-command-${family}-tabs-root`);
      const list = projectedRoot?.querySelector<HTMLElement>('[role="tablist"]');
      expect(list?.tagName.toLowerCase()).toBe(`pui-install-command-${family}-tabs-list`);
      expect(list?.style.getPropertyValue('scrollbar-width')).toBe('none');
      const tabs = [...(projectedRoot?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])];
      expect(tabs.map((tab) => tab.dataset.managerTab)).toEqual(['npm', 'pnpm']);
      expect(card.querySelector<HTMLElement>('[data-install-managers]')?.hidden).toBe(true);

      projectedRoot!.dispatchEvent(new CustomEvent('valueChange', { detail: { value: 'pnpm' } }));
      await Promise.resolve();
      expect(card.dataset.activeManager).toBe('pnpm');
      expect(card.querySelector<HTMLElement>('[data-command-panel="pnpm"]')!.hidden).toBe(false);
      expect(card.querySelector<HTMLElement>('[data-command-panel="npm"]')!.hidden).toBe(true);

      document.dispatchEvent(new Event('astro:before-swap'));
      expect(card.querySelector('[data-install-command-tabs-projection]')).toBeNull();
      expect(card.querySelector<HTMLElement>('[data-install-managers]')?.hidden).toBe(false);
    }
  );
});
