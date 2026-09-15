import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { definePrototype, tw } from '@proto.ui/core';
import button from '@proto.ui/prototypes-shadcn/button';
import { switchRoot, switchThumb } from '@proto.ui/prototypes-shadcn/switch';

// D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001 I/J/O: diagnostics supplement, never
// replace, the complete official prototypes below. No production measurements.
// Dynamic border widths are a separate rejected recipe: used border rounding
// cannot be represented by continuously interpolated compensation margins.
const sizing = definePrototype({
  name: 's2-sizing-probe',
  setup(def) {
    def.props.define({ large: { type: 'boolean', empty: 'fallback' } });
    def.props.setDefaults({ large: false });
    def.feedback.style.use(
      tw('flex w-32 h-8 p-2 border bg-primary transition-all duration-200 ease-in-out')
    );
    def.rule({
      when: (w) => w.prop('large').eq(true),
      intent: (i) => i.feedback.style.use(tw('w-64 h-16 p-4')),
    });
  },
});
const hitProbe = definePrototype({
  name: 's2-hit-probe',
  setup(def) {
    def.feedback.style.use(tw('block w-32 h-8 pointer-events-none'));
  },
});
const hintProbe = definePrototype({
  name: 's2-hint-probe',
  setup(def) {
    def.feedback.style.use(tw('block w-32 h-8 will-change-transform'));
  },
});
const motionHitProbe = definePrototype({
  name: 's2-motion-hit-probe',
  setup(def) {
    def.feedback.style.use(tw('block w-32 h-8 translate-x-[calc(100%_-_2px)]'));
  },
});
type Pair = {
  kind: string;
  split: boolean;
  host: any;
  row: HTMLElement;
  peer: HTMLElement;
  thumb?: any;
  text: HTMLElement;
};
const pairs: Pair[] = [];
export function mount(artifact: any, css: string) {
  document.documentElement.classList.add('light');
  const style = document.createElement('style');
  style.textContent =
    css +
    '\nbody { font:16px/normal Arial; margin:20px; --pui-primary:rgb(30,60,90); --pui-primary-foreground:white; --pui-background:white; --pui-foreground:black; --pui-input:gray; --pui-border:gray; --pui-ring:blue; --radius-lg:8px; --radius-md:6px; }';
  document.head.append(style);
  for (const [kind, proto] of [
    ['button', button],
    ['switch', switchRoot],
    ['sizing', sizing],
    ['hit', hitProbe],
    ['hint', hintProbe],
    ['motion-hit', motionHitProbe],
  ] as const) {
    for (const split of [false, true]) {
      const shadow = split
        ? { mode: 'open' as const, presentation: 'split' as const, styleArtifact: artifact }
        : false;
      const Root = AdaptToWebComponent(proto, { registerAs: `s2-${kind}-${split}`, shadow });
      const host = new Root();
      host.id = `${kind}-${split}`;
      const row = document.createElement('div');
      row.style.cssText =
        'display:flex;width:400px;align-items:flex-start;gap:10px;margin-bottom:12px';
      const peer = document.createElement('span');
      peer.textContent = 'Peer';
      const text = document.createElement('span');
      text.textContent = kind === 'button' ? 'Save changes' : '';
      if (kind !== 'switch') host.append(text);
      let thumb: any;
      if (kind === 'switch') {
        const Thumb = AdaptToWebComponent(switchThumb, { registerAs: `s2-thumb-${split}`, shadow });
        thumb = new Thumb();
        host.append(thumb);
      }
      if (kind === 'hit') {
        host.tabIndex = 0;
        text.textContent = 'Consumer override';
        text.style.pointerEvents = 'auto';
      }
      if (kind === 'hint') {
        // Maker-owned fixed content probes will-change's containing block and
        // stacking context without an actual Root transform declaration.
        text.style.cssText =
          'position:fixed;left:0;top:0;width:8px;height:8px;background:red;z-index:-1';
      }
      row.append(host, peer);
      document.body.append(row);
      pairs.push({ kind, split, host, row, peer, thumb, text });
    }
  }
}
export async function change(kind: string, props: Record<string, unknown>) {
  for (const p of pairs.filter((p) => p.kind === kind)) {
    setElementProps(p.host, props);
    p.host.update();
  }
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
export async function press(kind: string, down: boolean) {
  for (const p of pairs.filter((p) => p.kind === kind)) {
    p.host.dispatchEvent(
      new PointerEvent(down ? 'pointerdown' : 'pointerup', {
        pointerId: 1,
        button: 0,
        bubbles: true,
        composed: true,
      })
    );
  }
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
export function sample() {
  return pairs.map((p) => {
    const h = p.host.getBoundingClientRect(),
      r = p.row.getBoundingClientRect();
    const surface = p.split ? p.host.shadowRoot.querySelector('[part="surface"]') : p.host;
    const s = surface.getBoundingClientRect(),
      computed = getComputedStyle(surface);
    const thumbSurface =
      p.thumb && (p.split ? p.thumb.shadowRoot.querySelector('[part="surface"]') : p.thumb);
    const t = p.thumb?.getBoundingClientRect(),
      ts = thumbSurface?.getBoundingClientRect();
    const text = p.text.getBoundingClientRect();
    return {
      kind: p.kind,
      split: p.split,
      geometry: {
        width: h.width,
        height: h.height,
        x: h.x - r.x,
        y: h.y - r.y,
        surfaceWidth: s.width,
        surfaceHeight: s.height,
        surfaceX: s.x - h.x,
        surfaceY: s.y - h.y,
        peerX: p.peer.getBoundingClientRect().x - r.x,
        flowWidth: p.host.offsetWidth,
        flowHeight: p.host.offsetHeight,
        textX: p.kind === 'switch' ? 0 : text.x - h.x,
        textY: p.kind === 'switch' ? 0 : text.y - h.y,
        thumbX: t ? t.x - h.x : 0,
        thumbY: t ? t.y - h.y : 0,
        thumbWidth: t?.width ?? 0,
        thumbSurfaceX: ts ? ts.x - t.x : 0,
        thumbSurfaceWidth: ts?.width ?? 0,
      },
      paint: {
        background: computed.backgroundColor,
        color: computed.color,
        opacity: computed.opacity,
        border: computed.borderLeftWidth,
        padding: computed.paddingLeft,
        font: computed.fontSize,
      },
      transform: getComputedStyle(p.host).transform,
      surfaceTransform: getComputedStyle(surface).transform,
      thumbTransform: p.thumb ? getComputedStyle(p.thumb).transform : null,
      thumbSurfaceTransform: thumbSurface ? getComputedStyle(thumbSurface).transform : null,
      duration: getComputedStyle(p.host).transitionDuration,
      checked: p.host.getAttribute('aria-checked'),
      pressed: p.host.hasAttribute('data-pressed'),
      pointer: getComputedStyle(p.host).pointerEvents,
      surfacePointer: computed.pointerEvents,
      willChange: p.thumb ? getComputedStyle(p.thumb).willChange : null,
      retainedText: p.kind === 'switch' || p.text.parentNode === p.host,
    };
  });
}
export function hitChecks() {
  return pairs
    .filter((p) => p.kind === 'hit')
    .map((p) => {
      const rect = p.text.getClientRects()[0];
      const target = document.elementFromPoint(rect.x + 5, rect.y + rect.height / 2);
      // Supply native focus intent after initialization: this diagnostic has no
      // asFocusable hook. Test pointer CSS, not an invented default focus policy.
      p.host.tabIndex = 0;
      p.host.focus();
      return {
        split: p.split,
        override: target === p.text,
        keyboardFocusable: document.activeElement === p.host,
        target: target?.tagName,
        active: document.activeElement?.tagName,
      };
    });
}
export function boundaryHits(kind: string) {
  return pairs
    .filter((p) => p.kind === kind)
    .map((p) => {
      const h = p.host.getBoundingClientRect(),
        r = p.row.getBoundingClientRect();
      const contains = (target: Element | null) => target === p.host || p.host.contains(target);
      return {
        split: p.split,
        center: contains(document.elementFromPoint(h.x + h.width / 2, h.y + h.height / 2)),
        oldEdge: contains(
          document.elementFromPoint(
            kind === 'button' ? h.x + h.width / 2 : r.x + 0.05,
            kind === 'button' ? r.y + 0.05 : h.y + h.height / 2
          )
        ),
      };
    });
}
export function hintChecks() {
  return pairs
    .filter((p) => p.kind === 'hint')
    .map((p) => {
      const h = p.host.getBoundingClientRect(),
        t = p.text.getBoundingClientRect();
      return {
        split: p.split,
        x: t.x - h.x,
        y: t.y - h.y,
        willChange: getComputedStyle(p.host).willChange,
        paintX: t.x + 4,
        paintY: t.y + 4,
      };
    });
}
