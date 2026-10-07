import { AdaptToWebComponent, setElementProps } from '../../../packages/adapters/web-component/src';
import { BrutalistBadgeRoot } from '../../../packages/prototypes/brutalist/src/badge';
import checkboxRoot from '../../../packages/prototypes/shadcn/src/checkbox/root.proto';
import { createSplitRuntimePilot } from '../../../packages/adapters/web-component/test/fixtures/shadow-split-runtime';
import type { ShadowStyleArtifactV1 } from '../../../packages/adapters/web-component/src/shadow-style-artifact';

export async function run(
  artifacts: { badge: ShadowStyleArtifactV1; checkbox: ShadowStyleArtifactV1 },
  css: string
) {
  document.documentElement.classList.remove('dark');
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  const samples: unknown[] = [];
  const flush = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };
  for (const kind of ['badge', 'checkbox'] as const) {
    const proto = kind === 'badge' ? BrutalistBadgeRoot : checkboxRoot;
    const Constructor = AdaptToWebComponent(proto, {
      registerAs: `x-collapsed-${kind}`,
      schedule: (task) => task(),
    });
    const createRow = () => {
      const row = document.createElement('p');
      row.style.cssText =
        'font:16px/normal Arial;--pui-canary:rgb(250,200,0);--pui-canary-foreground:rgb(0,0,0);--pui-sky:rgb(100,200,250);--pui-sky-foreground:rgb(0,0,0);--pui-coral:rgb(255,100,100);--pui-coral-foreground:rgb(0,0,0);--pui-foreground:rgb(0,0,0);--pui-primary:rgb(30,60,90);--pui-primary-foreground:rgb(255,255,255);--pui-input:rgb(90,90,90)';
      const reference = document.createElement('span');
      reference.textContent = 'Reference';
      row.append(reference);
      document.body.append(row);
      return { row, reference };
    };
    const light = createRow(),
      shadow = createRow();
    const collapsed = new Constructor();
    const host = document.createElement(`x-split-${kind}`);
    if (kind === 'badge') {
      collapsed.textContent = 'Badge text';
      host.textContent = 'Badge text';
    }
    light.row.append(collapsed);
    shadow.row.append(host);
    let props: Record<string, unknown> = {};
    const pilot = createSplitRuntimePilot({
      host,
      proto,
      artifact: artifacts[kind],
      webModules: true,
      getRawProps: () => props,
    });
    try {
      await pilot.mount();
      await flush();
      const surface = pilot.resources.surface.element;
      const read = (
        element: HTMLElement,
        inner: HTMLElement,
        row: HTMLElement,
        ref: HTMLElement
      ) => {
        const rect = element.getBoundingClientRect(),
          innerRect = inner.getBoundingClientRect();
        const computed = getComputedStyle(inner);
        return {
          width: rect.width,
          height: rect.height,
          innerWidth: innerRect.width,
          innerHeight: innerRect.height,
          baselineOffset: rect.top - ref.getBoundingClientRect().top,
          rowHeight: row.getBoundingClientRect().height,
          background: computed.backgroundColor,
          border: computed.borderLeftWidth,
          color: computed.color,
          font: computed.fontSize,
          shadow: computed.boxShadow,
          opacity: computed.opacity,
          cursor: computed.cursor,
          role: element.getAttribute('role'),
          checked: element.getAttribute('aria-checked'),
          disabled: element.getAttribute('aria-disabled'),
        };
      };
      const capture = (phase: string) =>
        samples.push({
          kind,
          phase,
          boundaryDisplays: {
            collapsed: getComputedStyle(collapsed).display,
            split: getComputedStyle(host).display,
          },
          collapsed: read(collapsed, collapsed, light.row, light.reference),
          split: read(host, surface, shadow.row, shadow.reference),
        });
      capture('initial');
      const updates =
        kind === 'badge'
          ? [{ tone: 'info' }, { tone: 'danger' }, {}]
          : [{ checked: true }, { checked: false }, { disabled: true }];
      for (const next of updates) {
        props = next;
        setElementProps(collapsed, next);
        collapsed.update();
        pilot.session.controller.applyRawProps(next);
        pilot.session.controller.update();
        await flush();
        capture(JSON.stringify(next));
      }
      if (kind === 'badge') {
        const slot = surface.querySelector('slot');
        if (!slot || slot.assignedNodes()[0] !== host.firstChild)
          throw new Error('Badge native slot lost consumer content');
      }
    } finally {
      await pilot.dispose();
      collapsed.remove();
      light.row.remove();
      shadow.row.remove();
      await flush();
    }
  }
  return samples;
}
