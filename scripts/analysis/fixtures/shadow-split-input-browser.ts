import { AdaptToWebComponent, setElementProps } from '../../../packages/adapters/web-component/src';
import checkboxRoot from '../../../packages/prototypes/shadcn/src/checkbox/root.proto';
import { createSplitRuntimePilot } from '../../../packages/adapters/web-component/test/fixtures/shadow-split-runtime';
import type { ShadowStyleArtifactV1 } from '../../../packages/adapters/web-component/src/shadow-style-artifact';
import { createHostSurfaceProjection } from '@proto.ui/adapter-base';
import { bindElementSurfaceProjection } from '../../../packages/adapters/web-component/src/props';

// Test-only CE owner: deliberately not a public Adapter or a second production wiring.
// Reuses the private pilot's WC session/modules/router; native control specializations
// and public customization remain outside this checkbox-root evidence.
export async function setup(artifact: ShadowStyleArtifactV1, css: string) {
  const styles = document.createElement('style');
  styles.textContent = css;
  document.head.append(styles);
  document.body.style.cssText =
    '--pui-primary:rgb(30,60,90);--pui-primary-foreground:white;--pui-input:gray;--pui-ring:rgb(0,100,255);font:16px Arial';
  let pilot: ReturnType<typeof createSplitRuntimePilot> | undefined;
  let mount = Promise.resolve();
  let generation = 0;
  let disconnectVersion = 0;
  let rawProps: Record<string, unknown> = {};
  const commits: { marker: string | null; style: boolean; surface: boolean }[] = [];
  class SplitCheckbox extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }
    connectedCallback() {
      disconnectVersion++;
      if (pilot) return;
      generation++;
      pilot = createSplitRuntimePilot({
        host: this,
        proto: checkboxRoot,
        artifact,
        webModules: true,
        getRawProps: () => rawProps,
        onCommit: () =>
          commits.push({
            marker: this.getAttribute('data-pui-color-scheme'),
            style: !!this.shadowRoot?.querySelector('style'),
            surface: !!this.shadowRoot?.querySelector('[data-pui-split-surface]'),
          }),
      });
      mount = pilot.mount();
    }
    disconnectedCallback() {
      const version = ++disconnectVersion;
      queueMicrotask(() => {
        if (this.isConnected || version !== disconnectVersion) return;
        const previous = pilot;
        pilot = undefined;
        mount = previous?.dispose() ?? Promise.resolve();
      });
    }
  }
  customElements.define('x-input-split', SplitCheckbox);
  const Collapsed = AdaptToWebComponent(checkboxRoot, {
    registerAs: 'x-input-collapsed',
    schedule: (task) => task(),
  });
  const collapsed = new Collapsed();
  const split = new SplitCheckbox();
  if (split.shadowRoot!.childNodes.length || split.hasAttribute('data-pui-color-scheme'))
    throw new Error('constructor resource side effect');
  const counts = { collapsed: 0, split: 0 };
  for (const [kind, host] of [
    ['collapsed', collapsed],
    ['split', split],
  ] as const) {
    host.id = kind;
    // P-BASE-CHECKBOX-ACCESSIBLE-NAME uses content, not a fixture-supplied aria-label override.
    const content = document.createElement('span');
    content.textContent = 'Accept terms';
    host.append(content);
    host.addEventListener('checkedChange', () => counts[kind]++);
    const row = document.createElement('section');
    row.style.cssText = 'margin:20px;display:flex;align-items:center;gap:20px';
    const before = document.createElement('button');
    before.id = `before-${kind}`;
    before.textContent = 'Before';
    const after = document.createElement('button');
    after.textContent = 'After';
    row.append(before, host, after);
    document.body.append(row);
  }
  const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  // First animation frame after connection, not merely the first Template callback.
  const firstFrame = frame().then(() => read('split'));
  await mount;
  function read(kind: 'collapsed' | 'split') {
    const host = kind === 'split' ? split : collapsed;
    const surface = kind === 'split' ? pilot?.resources.surface.element : host;
    const computed = surface && getComputedStyle(surface);
    const rect = surface?.getBoundingClientRect();
    return {
      width: host.getBoundingClientRect().width,
      height: host.getBoundingClientRect().height,
      innerWidth: rect?.width,
      innerHeight: rect?.height,
      background: computed?.backgroundColor,
      shadow: computed?.boxShadow,
      opacity: computed?.opacity,
      focused: document.activeElement === host,
      focusVisible: host.hasAttribute('data-focus-visible'),
      role: host.getAttribute('role'),
      checked: host.getAttribute('aria-checked'),
      disabled: host.getAttribute('aria-disabled'),
      name: host.getAttribute('aria-label'),
      events: counts[kind],
    };
  }
  return {
    firstFrame: await firstFrame,
    commits,
    read,
    async customizationProbe() {
      // Observations for the unresolved customization gate, not a support guarantee.
      const surface = pilot!.resources.surface.element;
      const unbind = bindElementSurfaceProjection(
        split,
        createHostSurfaceProjection<HTMLElement>(split, surface)
      );
      const css = document.createElement('style');
      css.textContent = '.consumer-paint { background: rgb(200, 0, 200); }';
      document.head.append(css);
      const before = read('split');
      try {
        setElementProps(split, { surfaceClassName: 'consumer-paint' });
        await frame();
        const classOnly = read('split');
        const classDelivered = surface.classList.contains('consumer-paint');
        setElementProps(split, { surfaceStyle: { backgroundColor: 'rgb(200, 0, 200)' } });
        await frame();
        const paint = read('split');
        setElementProps(split, { surfaceStyle: { padding: '32px' } });
        await frame();
        const metric = read('split');
        setElementProps(split, {});
        await frame();
        return { before, classDelivered, classOnly, paint, metric, restored: read('split') };
      } finally {
        setElementProps(split, {});
        unbind();
        css.remove();
      }
    },
    async disable(kind: 'collapsed' | 'split') {
      if (kind === 'collapsed') {
        setElementProps(collapsed, { disabled: true });
        collapsed.update();
      } else {
        rawProps = { disabled: true };
        pilot!.session.controller.applyRawProps(rawProps);
        pilot!.session.controller.update();
      }
      await frame();
    },
    async lifecycleAndSlot() {
      const current = pilot!;
      const surface = current.resources.surface.element;
      const slot = surface.querySelector('slot');
      if (!slot || slot.assignedNodes()[0] !== split.firstChild)
        throw new Error('default slot missing');
      const replacement = document.createElement('span');
      replacement.textContent = 'New content';
      split.replaceChildren(replacement);
      await frame();
      if (slot.assignedNodes()[0] !== replacement) throw new Error('slot reassignment failed');
      if (
        surface.hasAttribute('role') ||
        surface.hasAttribute('tabindex') ||
        surface.hasAttribute('aria-checked')
      )
        throw new Error('surface acquired semantic ownership');
      const row = split.parentElement!;
      row.append(split);
      await frame();
      if (pilot !== current || generation !== 1) throw new Error('move recreated owner');
      split.remove();
      await frame();
      await mount;
      const before = counts.split;
      split.click();
      if (
        counts.split !== before ||
        split.shadowRoot!.childNodes.length ||
        split.hasAttribute('data-pui-color-scheme')
      )
        throw new Error('terminal resources/input leaked');
      rawProps = {};
      row.append(split);
      await mount;
      await frame();
      if (
        pilot === current ||
        Number(generation) !== 2 ||
        pilot!.resources.surface.element === surface
      )
        throw new Error('reconnect did not renew generation');
      return {
        generation,
        slotReassigned: true,
        ownerRetainedOnMove: true,
        terminalInputRevoked: true,
      };
    },
  };
}
