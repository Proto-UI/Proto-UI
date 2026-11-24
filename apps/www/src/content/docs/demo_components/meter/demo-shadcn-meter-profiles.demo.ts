import type { DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const PROFILES = [
  { id: 'rhea', label: 'Rhea (default docs)', value: 64, valueText: '64%' },
  { id: 'luma', label: 'Luma', value: 64, valueText: '64%' },
  { id: 'lyra', label: 'Lyra', value: 64, valueText: '64%' },
  { id: 'sera', label: 'Sera', value: 64, valueText: '64%' },
] as const;

function profileMeter(profile: (typeof PROFILES)[number]): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'shadcn-style-scope',
    className: 'contents',
    props: { styleProfile: profile.id },
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-meter-root',
        props: {
          value: profile.value,
          min: 0,
          max: 100,
          low: 70,
          high: 90,
          optimum: 20,
          valueText: profile.valueText,
        },
        children: [
          {
            kind: 'box',
            className: 'flex w-full items-center justify-between gap-2',
            children: [
              { kind: 'proto', prototypeId: 'shadcn-meter-label', children: [profile.label] },
              { kind: 'proto', prototypeId: 'shadcn-meter-value' },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-meter-track',
            children: [{ kind: 'proto', prototypeId: 'shadcn-meter-indicator' }],
          },
        ],
      },
    ],
  };
}

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'mx-auto grid w-full max-w-md min-w-0 gap-5 p-4',
    children: PROFILES.map(profileMeter),
  },
};

export default withShadcnRheaDemo(demo);
