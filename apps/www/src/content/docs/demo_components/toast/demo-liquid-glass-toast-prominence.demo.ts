import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const TIERS = [
  {
    key: 'regular',
    label: 'Regular',
    prominence: 'regular',
    material: 'auto',
    politeness: 'polite',
    title: 'AirDrop complete',
    description: 'Presentation.key saved to Downloads.',
  },
  {
    key: 'prominent',
    label: 'Prominent',
    prominence: 'prominent',
    material: 'auto',
    politeness: 'polite',
    title: 'Software update ready',
    description: 'Restart tonight to install the latest release.',
  },
  {
    key: 'destructive',
    label: 'Destructive',
    prominence: 'destructive',
    material: 'auto',
    politeness: 'assertive',
    title: 'Sync conflict',
    description: 'Unable to upload changes. Review your draft.',
  },
  {
    key: 'opaque',
    label: 'Opaque Fallback',
    prominence: 'regular',
    material: 'opaque',
    politeness: 'polite',
    title: 'Opaque surface',
    description: 'Uses solid fallback paint with liquid-glass opted out.',
  },
] as const;

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'min-w-0 w-full rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 flex flex-wrap items-center justify-center gap-2',
    children: [
      ...TIERS.map((item) => ({
        kind: 'proto' as const,
        prototypeId: 'liquid-glass-button',
        ref: `btn-${item.key}`,
        children: [item.label],
      })),
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-toast-viewport',
        previewTheme: 'portal',
        ref: 'viewport',
        props: {
          a11yLabel: 'Liquid Glass notifications',
        },
        children: TIERS.map((item) => ({
          kind: 'proto' as const,
          prototypeId: 'liquid-glass-toast-root',
          ref: `toast-${item.key}`,
          props: {
            defaultOpen: false,
            duration: 5000,
            prominence: item.prominence,
            material: item.material,
            politeness: item.politeness,
          },
          children: [
            {
              kind: 'box',
              className: 'flex items-start justify-between gap-4 min-w-0',
              children: [
                {
                  kind: 'box',
                  className: 'grid gap-1 min-w-0',
                  children: [
                    {
                      kind: 'proto',
                      prototypeId: 'liquid-glass-toast-title',
                      children: [item.title],
                    },
                    {
                      kind: 'proto',
                      prototypeId: 'liquid-glass-toast-description',
                      children: [item.description],
                    },
                  ],
                },
                {
                  kind: 'proto',
                  prototypeId: 'liquid-glass-toast-close',
                  children: ['Dismiss'],
                },
              ],
            },
          ],
        })),
      },
    ],
  },
  setup({ api }) {
    for (const item of TIERS) {
      api.setProps(`btn-${item.key}`, {
        onClick: () => {
          const openToast = api.getExposes(`toast-${item.key}`)?.openToast;
          if (typeof openToast === 'function') openToast();
        },
      });
    }
  },
} satisfies DemoSpec;
