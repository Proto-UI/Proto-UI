import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const BUTTON_PROFILES = ['rhea', 'nova', 'vega', 'maia', 'lyra', 'luma', 'new-york-v4'] as const;

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full min-w-0 gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-2',
        attrs: { role: 'group', 'aria-label': 'Button style profile' },
        children: BUTTON_PROFILES.map((profile) => ({
          kind: 'proto' as const,
          prototypeId: 'shadcn-button',
          ref: `select-${profile}`,
          props: { variant: 'outline', size: 'sm' },
          children: [profile],
        })),
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-style-scope',
        ref: 'previewScope',
        className: 'contents',
        props: { styleProfile: 'rhea' },
        children: [
          {
            kind: 'box',
            className: 'flex flex-wrap items-center gap-3 rounded-lg border border-border p-4',
            children: [
              { kind: 'proto', prototypeId: 'shadcn-button', children: ['Primary'] },
              {
                kind: 'proto',
                prototypeId: 'shadcn-button',
                props: { variant: 'outline' },
                children: ['Outline'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-button',
                props: { variant: 'secondary' },
                children: ['Secondary'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-button',
                props: { variant: 'destructive' },
                children: ['Delete'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        ref: 'activeProfile',
        className: 'text-sm text-muted-foreground',
        attrs: { role: 'status', 'aria-live': 'polite' },
        children: ['Active styleProfile: rhea'],
      },
    ],
  },
  setup({ refs, api }) {
    for (const profile of BUTTON_PROFILES) {
      api.setProps(`select-${profile}`, {
        onClick: () => {
          api.setProps('previewScope', { styleProfile: profile });
          refs.activeProfile.textContent = `Active styleProfile: ${profile}`;
        },
      });
    }
  },
} satisfies DemoSpec);
