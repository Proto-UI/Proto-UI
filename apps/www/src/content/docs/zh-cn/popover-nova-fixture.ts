import type { JSHandle, Page } from 'playwright-core';
import type * as DemoRenderer from '../../../components/PrototypePreviewer/demo-renderer';
import type * as DemoTypes from '../../../components/PrototypePreviewer/demo-types';
import type * as PrototypeModules from '../../../components/PrototypePreviewer/prototype-modules';
import type * as ProjectionTheme from '../../../components/PrototypePreviewer/projection-theme';
import type * as RuntimePreviewSurface from '../../../components/PrototypePreviewer/runtime-preview-surface';
import type * as AdapterBase from '@proto.ui/adapter-base';

export interface PopoverNovaFixture {
  publicProfile: unknown;
  fixtureProfile: unknown;
  destroy(): Promise<void>;
}
export type PopoverNovaFixtureHandle = JSHandle<PopoverNovaFixture>;

// The public demo selects Rhea. Retain the historical Nova oracle on a separate
// ordinary consumer of that DemoSpec, following the AlertDialog layout fixture.
export async function mountPopoverNova(page: Page, runtime: 'wc' | 'react' | 'vue' | 'vue2') {
  return page.evaluateHandle(async (runtime) => {
    const browserImport = new Function('url', 'return import(url)') as (
      url: string
    ) => Promise<unknown>;
    const { renderDemo } = (await browserImport(
      '/src/components/PrototypePreviewer/demo-renderer.ts'
    )) as typeof DemoRenderer;
    const { default: original } = (await browserImport(
      '/src/content/docs/demo-shadcn-popover.demo.ts'
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
    const { registerWebPortalDestination } = (await browserImport(
      '/@id/@proto.ui/adapter-base'
    )) as typeof AdapterBase;
    if (
      original.root.kind !== 'proto' ||
      original.root.prototypeId !== 'shadcn-style-scope' ||
      original.root.props?.styleProfile !== 'rhea'
    )
      throw new Error('Public Popover demo must retain its Rhea scope.');
    const root = structuredClone(original.root);
    root.props = { ...root.props, styleProfile: 'nova' };
    const scene = root.children?.[0];
    if (!scene || typeof scene === 'string' || scene.kind !== 'box' || !scene.children)
      throw new Error('Popover fixture requires the authored layout box.');
    const outsideIndex = scene.children.findIndex(
      (child) =>
        typeof child !== 'string' && child.kind === 'proto' && child.prototypeId === 'shadcn-button'
    );
    if (outsideIndex < 0) throw new Error('Popover fixture outside control missing.');
    scene.ref = '__popover_nova_scene__';
    // Keep native sequential focus after the portaled Close and before the
    // authored outside control. The preview shell's default outlet follows all
    // demo children, which would put the outside control before Close.
    scene.children.splice(outsideIndex, 0, {
      kind: 'box',
      ref: '__popover_nova_outlet__',
      className: 'contents',
    });
    const previewer = document.querySelector<HTMLElement>(
      '[data-previewer-id][data-demo-id="demo-shadcn-popover"]'
    );
    if (!previewer) throw new Error('Public Popover preview missing.');
    const host = document.createElement('div');
    host.dataset.popoverNovaFixture = '';
    host.style.cssText = 'width: calc(100% - 32px); margin: 16px; min-width: 0';
    document.body.append(host);
    const surface = createRuntimePreviewSurface(
      {
        ...original,
        root,
        setup(context) {
          const cleanup = original.setup?.(context);
          const unregister = registerWebPortalDestination(
            context.refs.__popover_nova_scene__,
            context.refs.__popover_nova_outlet__
          );
          return () => {
            try {
              unregister();
            } finally {
              cleanup?.();
            }
          };
        },
      },
      'shadcn',
      resolveProjectionThemeSurfaceStyle('shadcn', previewer),
      runtime
    );
    const ids = new Set<string>();
    collectPrototypeIds(surface.demo.root, ids);
    let view: DemoTypes.DemoRenderResult | undefined;
    try {
      await loadPrototypes([...ids]);
      view = await renderDemo({ host, demo: surface.demo, runtime });
      await surface.ready;
      // Hit probes use viewport coordinates and do not scroll implicitly.
      host.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    } catch (error) {
      await view?.destroy();
      host.remove();
      throw error;
    }
    const mounted = view;
    return {
      publicProfile: original.root.props.styleProfile,
      fixtureProfile: root.props.styleProfile,
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
