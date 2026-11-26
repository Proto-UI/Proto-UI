import type { DemoSetupContext, DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { IMAGE_ASSETS, actionButton, imageNode } from './image-demo.shared';

const SCENES = [
  {
    source: IMAGE_ASSETS.landscape,
    alternativeText: 'Alpine ridge landscape displayed in the neutral content layer',
    label: 'Alpine Ridge',
  },
  {
    source: IMAGE_ASSETS.portrait,
    alternativeText: 'Botanical portrait displayed in the neutral content layer',
    label: 'Evergreen Study',
  },
] as const;

/**
 * Showcases Apple Liquid Glass HIG hierarchy: the Image stays optically neutral
 * in the content layer (concentric `radius="xl"` inside a `rounded-2xl` stage),
 * while floating `regular` and `prominent` Liquid Glass Buttons sit directly
 * above the photo without stacking glass on glass.
 */
export default {
  type: 'demo',
  setup({ refs, api }: DemoSetupContext) {
    let index = 0;

    const applyScene = (nextIndex: number) => {
      index = nextIndex % SCENES.length;
      const scene = SCENES[index]!;
      api.setProps('heroPhoto', {
        source: scene.source,
        a11yMode: 'informative',
        alternativeText: scene.alternativeText,
        fit: 'cover',
        radius: 'xl',
      });
      if (refs.sceneLabel) refs.sceneLabel.textContent = scene.label;
    };

    api.setProps('toggleScene', {
      variant: 'regular',
      material: 'auto',
      onClick: () => applyScene(index + 1),
    });
    api.setProps('resetScene', {
      variant: 'prominent',
      material: 'auto',
      onClick: () => applyScene(0),
    });
  },
  root: {
    kind: 'box',
    className: 'w-full max-w-lg',
    children: [
      {
        kind: 'box',
        className: 'relative overflow-hidden rounded-xl',
        children: [
          imageNode(
            'liquid-glass',
            'heroPhoto',
            {
              source: SCENES[0].source,
              a11yMode: 'informative',
              alternativeText: SCENES[0].alternativeText,
              fit: 'cover',
              radius: 'xl',
            },
            { width: '100%', height: '240px' }
          ),
          {
            kind: 'box',
            className:
              'absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 p-3',
            children: [
              {
                kind: 'box',
                ref: 'sceneLabel',
                className:
                  'rounded-full bg-background/85 px-3 py-1 text-xs font-medium text-foreground',
                children: [SCENES[0].label],
              },
              {
                kind: 'box',
                className: 'flex items-center gap-2',
                children: [
                  actionButton('liquid-glass', 'toggleScene', 'Switch Photo', {
                    variant: 'regular',
                    material: 'auto',
                  }),
                  actionButton('liquid-glass', 'resetScene', 'Featured', {
                    variant: 'prominent',
                    material: 'auto',
                  }),
                ],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
