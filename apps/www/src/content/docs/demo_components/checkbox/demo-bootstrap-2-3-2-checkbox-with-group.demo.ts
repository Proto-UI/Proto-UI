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
        className: 'grid gap-0.5',
        children: [
          {
            kind: 'box',
            className: 'text-sm font-medium',
            children: ['Show these items on the desktop:'],
          },
          {
            kind: 'box',
            className: 'text-xs text-muted-foreground',
            children: ['Select the items you want to show on the desktop.'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-2.5 pt-1',
        children: items.map((item) => {
          const key = `bs232-group-${item.id}`;
          return {
            kind: 'box' as const,
            className: 'flex items-center gap-2.5',
            children: [
              {
                kind: 'proto' as const,
                prototypeId: 'bootstrap-2-3-2-checkbox-root',
                ref: `bsGroup-${item.id}`,
                props: { defaultChecked: item.defaultChecked },
                associations: { controlLabel: key },
                children: [
                  {
                    kind: 'proto' as const,
                    prototypeId: 'bootstrap-2-3-2-checkbox-indicator',
                    ref: `bsGroupInd-${item.id}`,
                  },
                ],
              },
              {
                kind: 'proto' as const,
                prototypeId: 'bootstrap-2-3-2-label-root',
                ref: `bsGroupLabel-${item.id}`,
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
