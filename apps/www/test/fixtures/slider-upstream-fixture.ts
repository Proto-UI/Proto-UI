import type { JSHandle, Page } from 'playwright-core';
import type * as DemoRenderer from '../../src/components/PrototypePreviewer/demo-renderer';
import type * as DemoTypes from '../../src/components/PrototypePreviewer/demo-types';
import type * as PrototypeModules from '../../src/components/PrototypePreviewer/prototype-modules';
import type * as ProjectionTheme from '../../src/components/PrototypePreviewer/projection-theme';
import type * as RuntimePreviewSurface from '../../src/components/PrototypePreviewer/runtime-preview-surface';

export interface SliderUpstreamFixture {
  publicProfile: unknown;
  fixtureProfile: unknown;
  cases: string[];
  destroy(): Promise<void>;
}
export type SliderUpstreamFixtureHandle = JSHandle<SliderUpstreamFixture>;

// The public preview now owns two entries. Keep the historical six-scenario
// acceptance on an explicit ordinary consumer of those same public prototypes.
export async function mountSliderUpstream(page: Page, runtime: 'wc' | 'react' | 'vue' | 'vue2') {
  return page.evaluateHandle(async (runtime) => {
    const browserImport = new Function('url', 'return import(url)') as (
      url: string
    ) => Promise<unknown>;
    const { renderDemo } = (await browserImport(
      '/src/components/PrototypePreviewer/demo-renderer.ts'
    )) as typeof DemoRenderer;
    const { default: original } = (await browserImport(
      '/src/content/docs/demo-shadcn-slider.demo.ts'
    )) as { default: DemoTypes.DemoSpec };
    const { createRuntimePreviewSurface } = (await browserImport(
      '/src/components/PrototypePreviewer/runtime-preview-surface.ts'
    )) as typeof RuntimePreviewSurface;
    const { resolveProjectionThemeSurfaceStyle } = (await browserImport(
      '/src/components/PrototypePreviewer/projection-theme.ts'
    )) as typeof ProjectionTheme;
    const { collectPrototypeIds } = (await browserImport(
      '/src/components/PrototypePreviewer/demo-types.ts'
    )) as typeof DemoTypes;
    const { loadPrototypes } = (await browserImport(
      '/src/components/PrototypePreviewer/prototype-modules.ts'
    )) as typeof PrototypeModules;
    if (
      original.root.kind !== 'proto' ||
      original.root.prototypeId !== 'shadcn-style-scope' ||
      original.root.props?.styleProfile !== 'rhea'
    )
      throw new Error('Public Slider demo must retain its Rhea scope.');
    const root = structuredClone(original.root);
    const scene = root.children?.[0];
    if (!scene || typeof scene === 'string' || scene.kind !== 'box' || !scene.children)
      throw new Error('Slider fixture requires the authored layout box.');
    const nodes = (node: DemoTypes.DemoNode): DemoTypes.DemoNode[] => [
      node,
      ...(node.kind === 'text'
        ? []
        : (node.children ?? []).flatMap((child) =>
            typeof child === 'string' ? [] : nodes(child)
          )),
    ];
    const entry = (ref: string) => {
      const row = scene.children!.find(
        (child) =>
          typeof child !== 'string' &&
          child.kind === 'box' &&
          nodes(child).some((node) => node.kind === 'proto' && node.ref === ref)
      );
      if (!row || typeof row === 'string' || row.kind !== 'box')
        throw new Error(`Public Slider entry missing: ${ref}`);
      return row;
    };
    if (
      nodes(root).filter(
        (node) => node.kind === 'proto' && node.prototypeId === 'shadcn-slider-root'
      ).length !== 2
    )
      throw new Error('Public Slider fixture source must contain exactly two entries.');
    const scalar = entry('volume-root');
    const field = entry('field-root');
    const row = (
      name: string,
      source: typeof scalar,
      title: string,
      props: Record<string, unknown> = {}
    ): DemoTypes.DemoNode => {
      const row = structuredClone(source);
      row.ref = `${name}-case`;
      for (const node of nodes(row)) {
        if (node.kind !== 'text' && node.ref)
          node.ref = node.ref.replace(/^(volume|field)-/, `${name}-`);
      }
      const control = nodes(row).find(
        (node) => node.kind === 'proto' && node.prototypeId === 'shadcn-slider-root'
      );
      if (!control || control.kind !== 'proto')
        throw new Error(`Slider fixture root missing: ${name}`);
      control.props = { ...control.props, ...props };
      const label = row.children?.[0];
      if (label && typeof label !== 'string' && label.kind === 'box') label.children = [title];
      // Ordinary layout for the existing vertical height contract and for
      // unclipped native Thumb corners; no component paint or state is forced.
      row.children = row.children?.map<DemoTypes.DemoChild>((child) =>
        typeof child !== 'string' && nodes(child).includes(control)
          ? {
              kind: 'box',
              className: name === 'vertical' ? 'h-40 w-7' : 'w-full py-2',
              children: [child],
            }
          : child
      );
      return row;
    };
    const cases = ['horizontal', 'disabled', 'readonly', 'rtl', 'field', 'vertical'];
    scene.children = [
      row('horizontal', scalar, 'Volume'),
      row('disabled', scalar, 'Disabled', { disabled: true }),
      row('readonly', scalar, 'Read only', { readOnly: true }),
      row('rtl', scalar, 'RTL', { direction: 'rtl' }),
      row('field', field, 'Brightness (Field)'),
      row('vertical', scalar, 'Vertical', { orientation: 'vertical' }),
    ];
    const previewer = document.querySelector<HTMLElement>(
      '[data-previewer-id][data-demo-id="demo-shadcn-slider"]'
    );
    if (!previewer) throw new Error('Public Slider preview missing.');
    const host = document.createElement('div');
    host.dataset.sliderUpstreamFixture = '';
    host.style.cssText = 'width: calc(100% - 32px); margin: 16px; min-width: 0';
    document.body.append(host);
    let view: DemoTypes.DemoRenderResult | undefined;
    try {
      const surface = createRuntimePreviewSurface(
        { type: 'demo', root },
        'shadcn',
        resolveProjectionThemeSurfaceStyle('shadcn', previewer),
        runtime
      );
      const ids = new Set<string>();
      collectPrototypeIds(surface.demo.root, ids);
      await loadPrototypes([...ids]);
      view = await renderDemo({ host, demo: surface.demo, runtime });
      await surface.ready;
      host.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    } catch (error) {
      try {
        await view?.destroy();
      } finally {
        host.remove();
      }
      throw error;
    }
    const mounted = view;
    return {
      publicProfile: original.root.props.styleProfile,
      fixtureProfile: root.props?.styleProfile,
      cases,
      async destroy() {
        try {
          await mounted.destroy();
        } finally {
          host.remove();
        }
      },
    };
  }, runtime);
}
