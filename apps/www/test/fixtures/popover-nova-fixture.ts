import type { JSHandle, Page } from 'playwright-core';
import type * as DemoRenderer from '../../src/components/PrototypePreviewer/demo-renderer';
import type * as DemoTypes from '../../src/components/PrototypePreviewer/demo-types';
import type * as PrototypeModules from '../../src/components/PrototypePreviewer/prototype-modules';
import type * as ProjectionTheme from '../../src/components/PrototypePreviewer/projection-theme';
import type * as RuntimePreviewSurface from '../../src/components/PrototypePreviewer/runtime-preview-surface';
import type * as AdapterBase from '@proto.ui/adapter-base';

export interface PopoverNovaFixture {
  publicProfile: unknown;
  fixtureProfile: unknown;
  destroy(): Promise<void>;
}
export type PopoverNovaFixtureHandle = JSHandle<PopoverNovaFixture>;

// The public demo selects Rhea. Retain the historical Nova oracle on a separate
// ordinary consumer of the public prototypes, independent of the docs composition.
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
    // This fixture owns the minimal Nova consumer exercised by the title and
    // command-density contracts. The public Rhea demo can evolve independently
    // (for example, to a form with additional focusable controls).
    const root = {
      kind: 'proto',
      prototypeId: 'shadcn-style-scope',
      className: 'contents',
      props: { styleProfile: 'nova' },
      children: [
        {
          kind: 'box',
          ref: '__popover_nova_scene__',
          className: 'flex min-w-0 flex-wrap gap-4 p-4',
          children: [
            {
              kind: 'proto',
              prototypeId: 'shadcn-popover-root',
              ref: 'root',
              props: { a11yLabel: 'Popover' },
              children: [
                {
                  kind: 'proto',
                  prototypeId: 'shadcn-popover-trigger',
                  children: ['Open Popover'],
                },
                {
                  kind: 'proto',
                  prototypeId: 'shadcn-popover-content',
                  props: { enterDuration: 0, leaveDuration: 0 },
                  children: [
                    {
                      kind: 'proto',
                      prototypeId: 'shadcn-popover-title',
                      children: ['Popover settings'],
                    },
                    {
                      kind: 'proto',
                      prototypeId: 'shadcn-popover-description',
                      children: [
                        'Tab between the trigger and content, then move to the outside control. Outside focus closes without moving focus back.',
                      ],
                    },
                    {
                      kind: 'proto',
                      prototypeId: 'shadcn-popover-close',
                      children: ['Close'],
                    },
                  ],
                },
              ],
            },
            // Native sequential focus must pass from the portaled Close to the
            // outside control, rather than using the preview's trailing outlet.
            {
              kind: 'box',
              ref: '__popover_nova_outlet__',
              className: 'contents',
            },
            {
              kind: 'proto',
              prototypeId: 'shadcn-button',
              children: ['Outside focus target'],
            },
          ],
        },
      ],
    } satisfies DemoTypes.DemoSpec['root'];
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
        type: 'demo',
        root,
        setup(context) {
          return registerWebPortalDestination(
            context.refs.__popover_nova_scene__,
            context.refs.__popover_nova_outlet__
          );
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
