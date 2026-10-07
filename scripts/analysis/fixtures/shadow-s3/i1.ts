import {
  AdaptToWebComponent,
  setElementProps,
  type ShadowStyleArtifactV1,
} from '@proto.ui/adapter-web-component';
import { definePrototype, tw } from '@proto.ui/core';

// D-STYLE-ROLE Q/R and C-LIFECYCLE-0008: style-only hiding must not own presence/a11y.
export function mount(artifact: ShadowStyleArtifactV1) {
  let current = { hide: false, present: true, patch: false, offset: false };
  const pairs: Array<{
    host: HTMLElement;
    row: HTMLElement;
    peer: HTMLElement;
    button: HTMLButtonElement;
    before: HTMLButtonElement;
    after: HTMLButtonElement;
    counts: { setup: number; mount: number; unmount: number; click: number };
  }> = [];
  for (const split of [false, true]) {
    const counts = { setup: 0, mount: 0, unmount: 0, click: 0 };
    const proto = definePrototype<{
      hide: boolean;
      present: boolean;
      patch: boolean;
      offset: boolean;
    }>({
      name: 'i1-probe',
      setup(def) {
        counts.setup++;
        def.props.define({
          hide: { type: 'boolean' },
          present: { type: 'boolean' },
          patch: { type: 'boolean' },
          offset: { type: 'boolean' },
        });
        def.props.setDefaults({ hide: false, present: true, patch: false, offset: false });
        def.feedback.style.use(
          tw('block relative w-32 h-16 p-2 border-2 mt-2 mr-2 mb-2 ml-2 bg-black z-50')
        );
        def.rule({
          when: (w) => w.prop('hide').eq(true),
          intent: (i) => i.feedback.style.use(tw('hidden')),
        });
        def.rule({
          when: (w) => w.prop('offset').eq(true),
          intent: (i) => i.feedback.style.use(tw('left-2 top-1')),
        });
        def.rule({
          when: (w) => w.meta('colorScheme').eq('dark'),
          intent: (i) => i.feedback.style.use(tw('hidden')),
        });
        def.props.watch(['present', 'patch'], (run, next) => {
          if (next.patch) run.feedback.style.patch(tw('hidden'));
          else run.feedback.style.clearPatch();
          run.lifecycle.setPresent(next.present);
        });
        def.lifecycle.onMounted(() => {
          counts.mount++;
        });
        def.lifecycle.onUnmounted(() => {
          counts.unmount++;
        });
        return (r) => r.el('div', {}, [r.el('span', {}, 'Owned'), r.slot()]);
      },
    });
    const C = AdaptToWebComponent(proto, {
      registerAs: `i1-probe-${split}`,
      shadow: split ? { mode: 'open', presentation: 'split', styleArtifact: artifact } : false,
    });
    const host = new C();
    host.id = `i1-${split}`;
    const row = document.createElement('div');
    row.style.cssText =
      'display:flex;width:400px;gap:10px;align-items:flex-start;position:relative;margin-bottom:12px';
    const peer = document.createElement('div');
    peer.textContent = 'Peer';
    peer.style.cssText = 'width:30px;height:20px';
    const button = document.createElement('button');
    button.textContent = `I1 action ${split}`;
    button.style.cssText = 'position:absolute;left:25%;top:4px;width:80px;height:22px';
    button.addEventListener('click', () => counts.click++);
    host.append(button);
    const before = document.createElement('button'),
      after = document.createElement('button');
    before.textContent = `Before ${split}`;
    after.textContent = `After ${split}`;
    before.id = `before-${split}`;
    after.id = `after-${split}`;
    const blocker = document.createElement('div');
    blocker.setAttribute('aria-hidden', 'true');
    blocker.style.cssText = 'position:absolute;left:0;top:0;width:160px;height:80px;z-index:40';
    row.append(host, peer, blocker);
    document.body.append(before, row, after);
    pairs.push({ host, row, peer, button, before, after, counts });
  }
  const sample = () =>
    pairs.map(({ host, row, peer, button, counts }) => {
      const h = host.getBoundingClientRect(),
        r = row.getBoundingClientRect(),
        b = button.getBoundingClientRect();
      const surface = host.shadowRoot?.querySelector<HTMLElement>('[part="surface"]') ?? host;
      const owned = surface.querySelector('span')!;
      const o = owned?.getBoundingClientRect();
      const css = getComputedStyle(host);
      return {
        geometry: {
          width: h.width,
          height: h.height,
          x: h.x - r.x,
          y: h.y - r.y,
          peerX: peer.getBoundingClientRect().x - r.x,
          buttonX: b.x - h.x,
          buttonY: b.y - h.y,
          ownedX: o ? o.x - h.x : 0,
          ownedY: o ? o.y - h.y : 0,
        },
        display: css.display,
        position: css.position,
        z: css.zIndex,
        surfacePosition: getComputedStyle(surface).position,
        nativeHidden: host.hasAttribute('hidden'),
        ariaHidden: host.getAttribute('aria-hidden'),
        detached: host.hasAttribute('data-pui-view-detached'),
        slotOwned: host.contains(button),
        counts: { ...counts },
      };
    });
  return {
    sample,
    // Explicit native test probe, not Template style delivery: default WC
    // ignores template tw handles without its internal resolver configured.
    decorateOwnedProbe() {
      pairs.forEach(({ host }) => {
        const span = (host.shadowRoot ?? host).querySelector('span');
        if (span) span.style.cssText = 'position:absolute;right:0;bottom:0;width:8px;height:8px';
      });
    },
    set(props: Record<string, boolean>) {
      current = { ...current, ...props };
      pairs.forEach((p) => {
        setElementProps(p.host, current);
        (p.host as HTMLElement & { update?(): void }).update?.();
      });
    },
    move() {
      pairs.forEach((p) => p.row.append(p.host, p.peer));
    },
    dispose() {
      pairs.forEach((p) => {
        p.host.remove();
        p.row.remove();
        p.before.remove();
        p.after.remove();
      });
    },
  };
}
