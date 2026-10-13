import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as drawer from '../../src/drawer';

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
