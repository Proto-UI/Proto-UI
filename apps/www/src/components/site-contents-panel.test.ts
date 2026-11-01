// @vitest-environment happy-dom
// App composition/lease tests with a deliberately synthetic Dialog host.
// Real public focus, scroll lock, portal and paint require the browser journey.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DemoNode, DemoRuntimeApi, DemoSpec } from './PrototypePreviewer/demo-types';
import type { ProjectionMaterializerOptions } from './PrototypePreviewer/projection-materializer';
import { contentsPanelParticipant } from './site-contents-panel';
import { siteContentsNavigation } from './site-header-disclosure';

const rendered = vi.hoisted(() => ({
  fail: false,
  holdLeave: false,
  missingFacts: false,
  demos: [] as DemoSpec[],
  finishes: [] as Array<() => void>,
  retire: [] as Array<() => void>,
  order: [] as string[],
}));
vi.mock('./PrototypePreviewer/projection-materializer', () => ({
  async materializeProjectionCandidate(
    request: { generation: number },
    options: ProjectionMaterializerOptions
  ) {
    if (rendered.fail) throw new Error('owned test preparation failure');
    const demo = options.content!.demo;
    rendered.demos.push(demo);
    const host = document.createElement('div');
    host.dataset.projectionGenerationState = 'staging';
    host.inert = true;
    options.mount.append(host);
    let panel: HTMLElement | undefined;
    let onOpenChange: ((detail: { open: boolean }) => void) | undefined;
    let slotId = '';
    const walk = (node: DemoNode | string) => {
      if (typeof node === 'string' || node.kind === 'text') return;
      if (node.kind === 'box' && node.attrs?.['data-site-contents-slot'])
        slotId = node.attrs['data-site-contents-slot'];
      node.children?.forEach(walk);
    };
    walk(demo.root);
    const fact = (initial: boolean) => {
      let value = initial;
      const listeners = new Set<(event: { type: 'next'; next: boolean }) => void>();
      return {
        get: () => value,
        subscribe(listener: (event: { type: 'next'; next: boolean }) => void) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        set(next: boolean) {
          if (next === value) return;
          value = next;
          for (const listener of listeners) listener({ type: 'next', next });
        },
      };
    };
    const open = fact(false),
      isPresent = fact(false);
    const instance = { getExposes: () => ({ open, isPresent }) };
    const finish = () => {
      if (open.get()) return;
      rendered.order.push('public-isPresent-false');
      isPresent.set(false);
      rendered.order.push(
        panel?.querySelector('nav.docs-sidebar')
          ? 'tree-still-in-retiring-view'
          : 'tree-returned-before-detach'
      );
      panel?.remove();
      panel = undefined;
    };
    rendered.finishes.push(finish);
    let instanceListener:
      | Parameters<NonNullable<DemoRuntimeApi['subscribePublicInstances']>>[1]
      | undefined;
    const api: DemoRuntimeApi = {
      call() {},
      getExposes() {
        return rendered.missingFacts ? undefined : instance.getExposes();
      },
      getPublicInstance() {
        return rendered.missingFacts ? undefined : instance;
      },
      subscribePublicInstances(_refs, listener) {
        instanceListener = listener;
        listener({ 'contents-panel': rendered.missingFacts ? undefined : instance }, 1);
        return () => {
          instanceListener = undefined;
        };
      },
      setProps(ref, props) {
        if (ref !== 'contents-dialog') return;
        if (props.onOpenChange) onOpenChange = props.onOpenChange as typeof onOpenChange;
        if (!Object.hasOwn(props, 'open')) return;
        if (props.open && !panel) {
          open.set(true);
          isPresent.set(true);
          panel = document.createElement('div');
          // Synthetic shadow-boundary counterexample, NOT a real WC Dialog.
          // A light-DOM slot cannot closest() the role surface in its shadow.
          const surface = document.createElement('div');
          surface.id = `owned-test-dialog-${request.generation}`;
          surface.setAttribute('role', 'dialog');
          surface.append(document.createElement('slot'));
          panel.attachShadow({ mode: 'open' }).append(surface);
          const slot = document.createElement('div');
          slot.dataset.siteContentsSlot = slotId;
          panel.append(slot);
          document.body.append(panel);
        } else if (props.open) open.set(true);
        else if (open.get()) {
          open.set(false);
          rendered.order.push('public-close-call-exited');
          if (!rendered.holdLeave) queueMicrotask(finish);
        }
      },
    };
    const cleanup = demo.setup?.({ host, refs: {}, api });
    const retire = () => {
      instanceListener?.({ 'contents-panel': undefined }, 2);
      if (typeof cleanup === 'function') cleanup();
      panel?.remove();
      panel = undefined;
      host.remove();
    };
    rendered.retire.push(retire);
    return {
      host,
      scope: host,
      activate() {
        host.dataset.projectionGenerationState = 'active';
        host.inert = false;
      },
      setLocked(locked: boolean) {
        host.inert = locked;
      },
      setThemeSurfaceStyle() {},
      testDismiss() {
        onOpenChange?.({ open: false });
      },
      dispose: retire,
    };
  },
}));

let participant: ReturnType<typeof contentsPanelParticipant>;
let navigation: ReturnType<typeof siteContentsNavigation>;
const candidates: Array<{ dispose(): void | Promise<void> }> = [];
afterEach(async () => {
  rendered.holdLeave = false;
  participant?.dispose();
  rendered.finishes.forEach((finish) => finish());
  navigation?.destroy();
  for (const candidate of candidates.splice(0)) await candidate.dispose();
  document.body.replaceChildren();
  document.body.removeAttribute('data-mobile-menu-expanded');
  document.body.removeAttribute('data-site-contents-dialog');
  rendered.fail = false;
  rendered.missingFacts = false;
  rendered.retire.length = 0;
  rendered.holdLeave = false;
  rendered.finishes.length = 0;
  rendered.order.length = 0;
  rendered.demos.length = 0;
  vi.restoreAllMocks();
});
function fixture() {
  const media = Object.assign(new EventTarget(), { matches: false }) as MediaQueryList;
  vi.spyOn(window, 'matchMedia').mockReturnValue(media);
  document.body.innerHTML = `<header><div data-site-contents-command aria-expanded="false"><button data-site-contents-fallback>Contents</button></div></header><div data-site-contents-panel-mount data-contents-title="目录" data-contents-close="关闭目录"></div><section data-home><span data-before></span><nav class="docs-sidebar" aria-label="Documentation"><div id="starlight__sidebar"><details data-policy-id="canonical"><summary>UI Libraries</summary><a href="#article" aria-current="page">Current</a></details></div></nav><main id="article"></main></section>`;
  const header = document.querySelector('header')!;
  const tree = document.querySelector<HTMLElement>('nav.docs-sidebar')!;
  const main = document.querySelector('main')!;
  const home = document.querySelector('[data-home]')!;
  const details = tree.querySelector('details')!;
  navigation = siteContentsNavigation(document)!;
  participant = contentsPanelParticipant(header)!;
  return { tree, main, home, details, media, command: header.querySelector('button')! };
}
async function settle() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}
const request = (generation = 1) => ({
  generation,
  selection: { runtimeId: 'wc', projectionFamilyId: 'shadcn' },
});
async function publish(generation = 1) {
  const commit = request(generation);
  const candidate = await participant!.materialize(commit);
  candidates.push(candidate);
  candidate.activate();
  const publication = participant!.prepareCommit(commit);
  publication.publish();
  return { candidate, publication };
}

describe('Contents single native tree/public Dialog composition boundary', () => {
  it('declares public family Dialog parts and Rhea scope without private Transition/focus props', async () => {
    fixture();
    await publish();
    const demo = rendered.demos[0]!;
    expect(demo.root).toMatchObject({
      prototypeId: 'shadcn-dialog-root',
      props: { styleProfile: 'rhea', open: false },
    });
    const serialized = JSON.stringify(demo.root);
    for (const part of ['mask', 'content', 'title', 'close'])
      expect(serialized).toContain(`shadcn-dialog-${part}`);
    expect(serialized).not.toMatch(/focusEntry|enterDuration|leaveDuration|tabindex|aria-modal/);
    expect(readFileSync('apps/www/src/components/site-contents-panel.ts', 'utf8')).not.toContain(
      'onAfterLeave'
    );
  });

  it('opens a lazy slot, moves exactly the original nav, and restores its original sibling and disclosure identity', async () => {
    const { tree, main, home, details, command } = fixture();
    details.open = true;
    let trustedPolicyCount = 0;
    tree.addEventListener('owned-policy-probe', () => trustedPolicyCount++);
    await publish();
    expect(tree.parentElement).toBe(home);
    navigation!.toggle();
    expect(tree.parentElement?.dataset.siteContentsSlot).toBeTruthy();
    expect(document.querySelectorAll('nav.docs-sidebar')).toHaveLength(1);
    expect(tree.querySelector('details')).toBe(details);
    expect(details.open).toBe(true);
    expect(tree.querySelector('a')?.getAttribute('aria-current')).toBe('page');
    expect(command.getAttribute('aria-controls')).toBe('starlight__sidebar');
    expect(command.getAttribute('aria-haspopup')).toBe('dialog');
    tree.dispatchEvent(new Event('owned-policy-probe'));
    navigation!.close();
    await settle();
    expect(tree.parentElement).toBe(home);
    expect(tree.nextSibling).toBe(main);
    expect(tree.hasAttribute('data-site-contents-dialog-tree')).toBe(false);
    expect(details.open).toBe(true);
    expect(trustedPolicyCount).toBe(1); // Listener retained, not a native-toggle claim.
  });

  it('delegates Escape and outside policy exclusively while a public view is published', async () => {
    const { command } = fixture();
    await publish();
    navigation!.toggle();
    const escape = new KeyboardEvent('keyup', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(escape);
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(escape.defaultPrevented).toBe(false);
    expect(command.getAttribute('aria-expanded')).toBe('true');
    // This unit deliberately does not emulate public Dialog dismissal.
    navigation!.close();
    expect(command.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps only one tree through replacement and ignores retired-generation cleanup', async () => {
    const { tree, details } = fixture();
    const first = await publish(1);
    navigation!.toggle();
    details.open = true;
    await publish(2);
    await settle();
    const parent = tree.parentElement;
    expect(parent?.dataset.siteContentsSlot).toContain('-2');
    await first.candidate.dispose();
    expect(tree.parentElement).toBe(parent);
    expect(tree.querySelector('details')).toBe(details);
    expect(details.open).toBe(true);
    expect(document.querySelectorAll('nav.docs-sidebar')).toHaveLength(1);
  });

  it('retains the in-flow tree after preparation failure and restores a live prior view on publication rollback', async () => {
    const { tree, home } = fixture();
    rendered.fail = true;
    await expect(participant!.materialize(request())).rejects.toThrow(
      'owned test preparation failure'
    );
    expect(tree.parentElement).toBe(home);
    navigation!.toggle();
    expect(document.body.hasAttribute('data-site-contents-dialog')).toBe(false);
    rendered.fail = false;
    rendered.missingFacts = false;
    rendered.retire.length = 0;
    await publish(1);
    const second = await publish(2);
    second.publication.rollback();
    await settle();
    expect(tree.parentElement?.dataset.siteContentsSlot).toContain('-1');
    await second.candidate.dispose();
    expect(tree.parentElement?.dataset.siteContentsSlot).toContain('-1');
  });

  it('preserves modified native links, closes same-page history changes, and returns the desktop scroll state', async () => {
    const { tree, details, media, home } = fixture();
    tree.scrollTop = 83;
    await publish();
    navigation!.toggle();
    details
      .querySelector('a')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    expect(document.body.hasAttribute('data-mobile-menu-expanded')).toBe(true);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(document.body.hasAttribute('data-mobile-menu-expanded')).toBe(false);
    Object.assign(media, { matches: true });
    media.dispatchEvent(new Event('change'));
    await settle();
    expect(tree.parentElement).toBe(home);
    expect(tree.scrollTop).toBe(83);
  });

  it('retains the native lease until public leave completion and returns it before renderer detach', async () => {
    const { tree, home } = fixture();
    const { candidate } = await publish();
    navigation!.toggle();
    rendered.holdLeave = true;
    navigation!.close();
    await settle();
    expect(tree.parentElement).not.toBe(home);
    let disposed = false;
    const disposal = candidate.dispose().then(() => {
      disposed = true;
    });
    await settle();
    expect(disposed).toBe(false);
    rendered.finishes[0]!();
    await disposal;
    expect(tree.parentElement).toBe(home);
    expect(rendered.order).toEqual([
      'public-close-call-exited',
      'public-isPresent-false',
      'tree-returned-before-detach',
    ]);
    // This proves app lease sequencing only, not native FocusScope behavior.
  });

  it('fails preparation without public facts without hiding or borrowing the only native tree', async () => {
    const { tree, home } = fixture();
    rendered.missingFacts = true;
    await expect(participant!.materialize(request())).rejects.toThrow(
      'public open/presence facts are unavailable'
    );
    expect(tree.parentElement).toBe(home);
    expect(document.body.hasAttribute('data-site-contents-dialog')).toBe(false);
  });

  it('returns a stranded lease after public instance retirement and rejects disposal instead of hanging', async () => {
    const { tree, home } = fixture();
    const { candidate } = await publish();
    navigation!.toggle();
    rendered.holdLeave = true;
    navigation!.close();
    await settle();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    rendered.retire[0]!();
    await settle();
    await expect(candidate.dispose()).rejects.toThrow('public instance disappeared');
    candidates.splice(candidates.indexOf(candidate), 1);
    expect(tree.parentElement).toBe(home);
    expect(document.body.hasAttribute('data-site-contents-dialog')).toBe(false);
    expect(error).toHaveBeenCalled();
  });

  it('keeps shared header SSR recipe, no-JS reachability and no legacy footer/body-lock paint', () => {
    const read = (p: string) => readFileSync(`apps/www/src/${p}`, 'utf8');
    const command = read('components/SiteContentsCommand.astro');
    const live = read('components/site-contents-command.ts');
    const frame = read('components/override/PageFrame.astro');
    const sidebar = read('components/override/Sidebar.astro');
    const header = read('components/override/Header.astro');
    expect(command).toContain('headerButtonProps(family)');
    expect(command).toContain('snapshotStartupStyle(`${family}-button`, buttonProps)');
    expect(live).toContain('headerButtonProps(family)');
    expect(frame).toMatch(
      /<noscript>[\s\S]*?\.mobile-sidebar-pane[\s\S]*?display: flex !important/
    );
    expect(frame).toContain('.docs-sidebar[data-site-contents-dialog-tree]');
    expect(frame).not.toMatch(/body\[data-mobile-menu-expanded\][\s\S]{0,40}overflow: hidden/);
    expect(sidebar).not.toContain('MobileMenuFooter');
    expect(sidebar.match(/<SidebarSublist /g)).toHaveLength(1);
    for (const retained of ['<ThemeToggle', '<LanguageSelect', '<SocialIcons'])
      expect(header).toContain(retained);
  });
});
