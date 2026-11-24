import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import { shadcnCheckboxDemoChildren } from '../../../../components/PrototypePreviewer/shadcn-checkbox-composition';
import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const desktopItems = [
  { id: 'hard-disks', label: 'Hard disks', defaultChecked: true },
  { id: 'external-disks', label: 'External disks', defaultChecked: true },
  { id: 'cds-dvds', label: 'CDs, DVDs, and iPods', defaultChecked: false },
  { id: 'connected-servers', label: 'Connected servers', defaultChecked: false },
];

export default withShadcnRheaDemo({
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
            className: 'text-sm font-medium',
            children: ['Show these items on the desktop:'],
          },
          {
            kind: 'box',
            className: 'text-sm text-muted-foreground',
            children: ['Select the items you want to show on the desktop.'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-3 pt-1',
        children: desktopItems.map((item) => ({
          kind: 'box' as const,
          className: 'flex items-center gap-3',
          children: shadcnCheckboxDemoChildren({
            associationKey: `shadcn-checkbox-group-${item.id}`,
            label: [item.label],
            controlProps: { defaultChecked: item.defaultChecked },
          }),
        })),
      },
    ],
  },
} satisfies DemoSpec);
