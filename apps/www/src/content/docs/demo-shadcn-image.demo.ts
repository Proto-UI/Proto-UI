import type { DemoSetupContext, DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { IMAGE_ASSETS, actionButton, imageNode } from './image-demo.shared';
import { withShadcnRheaDemo } from './shadcn-demo-style';

const SCENES = {
  landscape: {
    source: IMAGE_ASSETS.landscape,
    alternativeText: 'Mountain ridge bathed in morning sunlight',
    caption: 'Mountain Ridge — 16:9 Landscape',
  },
  portrait: {
    source: IMAGE_ASSETS.portrait,
    alternativeText: 'Tall alpine evergreen framed in portrait orientation',
    caption: 'Alpine Study — Portrait Framing',
  },
} as const;

const heroDemo: DemoSpec = {
  type: 'demo',
  setup({ refs, api }: DemoSetupContext) {
    const selectScene = (key: keyof typeof SCENES) => {
      const scene = SCENES[key];
      api.setProps('heroImage', {
        source: scene.source,
        a11yMode: 'informative',
        alternativeText: scene.alternativeText,
        fit: 'cover',
        radius: 'default',
      });
      if (refs.sceneCaption) refs.sceneCaption.textContent = scene.caption;
    };

    api.setProps('showLandscape', {
      size: 'sm',
      variant: 'outline',
      onClick: () => selectScene('landscape'),
    });
    api.setProps('showPortrait', {
      size: 'sm',
      variant: 'outline',
      onClick: () => selectScene('portrait'),
    });
  },
  root: {
    kind: 'box',
    className: 'flex w-full max-w-md flex-col gap-3 p-4',
    children: [
      {
        kind: 'box',
        className: 'overflow-hidden rounded-xl border border-border bg-muted',
        children: [
          imageNode(
            'shadcn',
            'heroImage',
            {
              source: SCENES.landscape.source,
              a11yMode: 'informative',
              alternativeText: SCENES.landscape.alternativeText,
              fit: 'cover',
              radius: 'default',
            },
            { width: '100%', height: '220px' }
          ),
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center justify-between gap-2',
        children: [
          {
            kind: 'box',
            ref: 'sceneCaption',
            className: 'text-sm text-muted-foreground',
            children: [SCENES.landscape.caption],
          },
          {
            kind: 'box',
            className: 'flex items-center gap-2',
            children: [
              actionButton('shadcn', 'showLandscape', 'Landscape', {
                size: 'sm',
                variant: 'outline',
              }),
              actionButton('shadcn', 'showPortrait', 'Portrait', {
                size: 'sm',
                variant: 'outline',
              }),
            ],
          },
        ],
      },
    ],
  },
};

export default withShadcnRheaDemo(heroDemo);
