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
});
