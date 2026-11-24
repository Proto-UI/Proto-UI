import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const PROFILES = [
  { id: 'rhea', label: 'rhea' },
  { id: 'luma', label: 'luma' },
  { id: 'nova', label: 'nova' },
  { id: 'lyra', label: 'lyra' },
  { id: 'new-york-v4', label: 'new-york-v4' },
] as const;

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-3 p-2',
    children: PROFILES.map(({ id, label }) => ({
      kind: 'box' as const,
      className: 'flex flex-wrap items-center gap-2',
      children: [
        {
          kind: 'box' as const,
          className: 'w-28 text-xs font-mono opacity-75',
          children: [label],
        },
        {
          kind: 'proto' as const,
          prototypeId: 'shadcn-surface-root',
          props: { actionProfile: id, variant: 'solid' },
          children: [
            {
              kind: 'box' as const,
              className: 'px-3 py-1.5 text-xs font-medium',
              children: ['Primary'],
            },
          ],
        },
        {
          kind: 'proto' as const,
          prototypeId: 'shadcn-surface-root',
          props: { actionProfile: id, variant: 'secondary' },
          children: [
            {
              kind: 'box' as const,
              className: 'px-3 py-1.5 text-xs font-medium',
              children: ['Secondary'],
            },
          ],
        },
        {
          kind: 'proto' as const,
          prototypeId: 'shadcn-surface-root',
          props: { actionProfile: id, variant: 'outline' },
          children: [
            {
              kind: 'box' as const,
              className: 'px-3 py-1.5 text-xs font-medium',
              children: ['Outline'],
            },
          ],
        },
        {
          kind: 'proto' as const,
          prototypeId: 'shadcn-surface-root',
          props: { actionProfile: id, variant: 'outline', focusVisible: true },
          children: [
            {
              kind: 'box' as const,
              className: 'px-3 py-1.5 text-xs font-medium',
              children: ['Focused'],
            },
          ],
        },
      ],
    })),
  },
} satisfies DemoSpec);
