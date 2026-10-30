import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as drawer from '../../src/drawer';
import { definePrototype } from '@proto.ui/core';
import { asScrollSurface } from '@proto.ui/hooks';
import { asDrawerContent } from '../../../base/src/drawer';

/** Real family source fixture. No upstream implementation or demo-local animation. */
export function createDrawerPresenceFixture(
  options: Parameters<typeof AdaptToWebComponent>[1] = {}
) {
  for (const proto of [drawer.drawerRoot, drawer.drawerContent, drawer.drawerMask])
    AdaptToWebComponent(proto, options);
  const root = document.createElement(drawer.drawerRoot.name) as HTMLElement;
  const content = document.createElement(drawer.drawerContent.name) as HTMLElement;
  const mask = document.createElement(drawer.drawerMask.name) as HTMLElement;
  setElementProps(root, { open: false });
  setElementProps(content, { side: 'bottom', maxExtent: { unit: 'logical', value: 200 } });
  content.textContent = 'Drawer presentation evidence';
  root.append(mask, content);
  document.body.append(root);
  const surface = (el: HTMLElement) =>
    (el.shadowRoot?.querySelector('[part="surface"]') ?? el) as HTMLElement;
  const style = () => {
    Object.assign(surface(content).style, {
      width: '320px',
      height: '200px',
      boxSizing: 'border-box',
      background: '#fff',
    });
    Object.assign(surface(mask).style, {
      width: '800px',
      height: '600px',
      boxSizing: 'border-box',
    });
  };
  const sample = () => {
    const c = surface(content),
      m = surface(mask);
    return {
      time: performance.now(),
      contentPhase: (content as any).getExposes().transitionState.get(),
      maskPhase: (mask as any).getExposes().transitionState.get(),
      translate: c.style.getPropertyValue('translate'),
      opacity: getComputedStyle(m).opacity,
      rect: c.getBoundingClientRect().toJSON(),
      detached: content.hasAttribute('data-pui-view-detached'),
      contentSurfaceIsHost: c === content,
    };
  };
  return {
    root,
    content,
    mask,
    style,
    sample,
    target(open: boolean) {
      setElementProps(root, { open });
    },
    side(side: 'top' | 'bottom' | 'left' | 'right') {
      setElementProps(content, { side, maxExtent: { unit: 'logical', value: 200 } });
    },
  };
}

/** Test-only observation/request ports around unchanged family setup; no host style overrides. */
export function createDrawerScrollFixture(options: Parameters<typeof AdaptToWebComponent>[1] = {}) {
  const contentPrototype = definePrototype({
    ...drawer.drawerContent,
    setup(def) {
      const render = drawer.drawerContent.setup(def);
      const scroll = asScrollSurface();
      const acceptedSide = asDrawerContent().acceptedSide;
      def.expose.method('__testAcceptedSide', () => acceptedSide.read());
      def.expose.method('__testScrollSnapshot', () => scroll.getSnapshot());
      def.expose.method('__testScrollTo', (position: number) =>
        scroll.request({ kind: 'to', axis: 'vertical', position })
      );
      return render;
    },
  });
  for (const prototype of [drawer.drawerRoot, contentPrototype, drawer.drawerMask])
    AdaptToWebComponent(prototype, options);
  const root = document.createElement(drawer.drawerRoot.name);
  const content = document.createElement(contentPrototype.name);
  const mask = document.createElement(drawer.drawerMask.name);
  setElementProps(root, { open: false });
  setElementProps(content, { side: 'bottom', maxExtent: { unit: 'root-text', value: 12.5 } });
  const first = document.createElement('button');
  first.textContent = 'Scroll start';
  first.id = 'drawer-scroll-start';
  const long = document.createElement('div');
  long.textContent = 'Long slotted content';
  long.style.height = '1000px';
  long.style.flexShrink = '0';
  long.style.width = '1600px';
  const last = document.createElement('button');
  last.textContent = 'Scroll end';
  last.id = 'drawer-scroll-end';
  content.append(first, long, last);
  root.append(mask, content);
  document.body.append(root);
  const surface = () =>
    (content.shadowRoot?.querySelector('[part="surface"]') ?? content) as HTMLElement;
  return {
    root,
    content,
    open() {
      setElementProps(root, { open: true });
    },
    side(side: 'left' | 'bottom') {
      setElementProps(content, { side, maxExtent: { unit: 'root-text', value: 12.5 } });
    },
    request(position: number) {
      return (content as any).getExposes().__testScrollTo(position);
    },
    sample() {
      const target = surface(),
        style = getComputedStyle(target);
      const surfaceRect = target.getBoundingClientRect(),
        longRect = long.getBoundingClientRect();
      const probeX = surfaceRect.right + 8;
      const probeY =
        (Math.max(surfaceRect.top, longRect.top) + Math.min(surfaceRect.bottom, longRect.bottom)) /
        2;
      const hit = document.elementFromPoint(probeX, probeY);
      const clipProbe = {
        x: probeX,
        y: probeY,
        withinViewport: probeX >= 0 && probeY >= 0 && probeX < innerWidth && probeY < innerHeight,
        hitPresent: hit !== null,
        childExtends: longRect.right > probeX,
        childCoversY:
          longRect.top < probeY &&
          longRect.bottom > probeY &&
          surfaceRect.top < probeY &&
          surfaceRect.bottom > probeY,
        clipped: hit !== null && !content.contains(hit),
      };
      return {
        phase: (content as any).getExposes().transitionState.get(),
        acceptedSide: (content as any).getExposes().__testAcceptedSide(),
        facts: (content as any).getExposes().__testScrollSnapshot(),
        hostRect: content.getBoundingClientRect().toJSON(),
        surfaceRect: target.getBoundingClientRect().toJSON(),
        scrollTop: target.scrollTop,
        scrollHeight: target.scrollHeight,
        clientHeight: target.clientHeight,
        hostScrollTop: content.scrollTop,
        isHost: target === content,
        clipProbe,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        border: style.borderTopWidth,
        background: style.backgroundColor,
        firstRect: first.getBoundingClientRect().toJSON(),
        lastRect: last.getBoundingClientRect().toJSON(),
      };
    },
  };
}
