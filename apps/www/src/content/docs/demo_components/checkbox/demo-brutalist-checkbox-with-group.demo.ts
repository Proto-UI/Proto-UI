import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const items = [
  { id: 'hard-disks', label: 'Hard disks', defaultChecked: true },
  { id: 'external-disks', label: 'External disks', defaultChecked: true },
  { id: 'cds-dvds', label: 'CDs, DVDs, and iPods', defaultChecked: false },
  { id: 'connected-servers', label: 'Connected servers', defaultChecked: false },
];

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-sm flex-col gap-3',
    children: [
      {
        kind: 'box',
        className: 'grid gap-1',
        children: [
          {
            kind: 'box',
            className: 'font-heading text-sm font-bold',
            children: ['Show these items on the desktop:'],
          },
          {
            kind: 'box',
            className: 'font-sans text-xs font-medium opacity-75',
            children: ['Select the items you want to show on the desktop.'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-3 pt-1',
        children: items.map((item) => {
          const key = `brutalist-group-${item.id}`;
          return {
            kind: 'box' as const,
            className: 'flex items-center gap-3',
            children: [
              {
                kind: 'proto' as const,
                prototypeId: 'brutalist-checkbox-root',
                ref: `group-${item.id}`,
                props: { defaultChecked: item.defaultChecked },
                associations: { controlLabel: key },
                children: [
                  {
                    kind: 'proto' as const,
                    prototypeId: 'brutalist-checkbox-indicator',
                    ref: `groupInd-${item.id}`,
                  },
                ],
              },
              {
                kind: 'proto' as const,
                prototypeId: 'brutalist-label-root',
                ref: `groupLabel-${item.id}`,
                props: { naming: true, activation: true },
                associations: { controlLabel: key },
                children: [item.label],
              },
            ],
          };
        }),
      },
    ],
  },
} satisfies DemoSpec;
