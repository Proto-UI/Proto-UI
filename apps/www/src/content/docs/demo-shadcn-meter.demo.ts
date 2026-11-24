import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from './shadcn-demo-style';

const PRESETS = [
  { ref: 'optimal', value: 32, valueText: '32 GB / 100 GB' },
  { ref: 'suboptimal', value: 68, valueText: '68 GB / 100 GB' },
  { ref: 'critical', value: 92, valueText: '92 GB / 100 GB' },
] as const;

const BASE_PROPS = {
  min: 0,
  max: 100,
  low: 50,
  high: 80,
  optimum: 20,
} as const;

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'mx-auto grid w-full max-w-md min-w-0 gap-4 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-meter-root',
        ref: 'meter',
        props: { ...BASE_PROPS, value: 32, valueText: '32 GB / 100 GB' },
        children: [
          {
            kind: 'box',
            className: 'flex w-full items-center justify-between gap-2',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-meter-label',
                children: ['Storage used'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-meter-value',
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-meter-track',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-meter-indicator',
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: 'optimal',
            props: { variant: 'outline', size: 'sm' },
            children: ['Optimal (32%)'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: 'suboptimal',
            props: { variant: 'outline', size: 'sm' },
            children: ['Warning (68%)'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: 'critical',
            props: { variant: 'outline', size: 'sm' },
            children: ['Critical (92%)'],
          },
        ],
      },
    ],
  },
  setup({ api }) {
    for (const preset of PRESETS) {
      api.setProps(preset.ref, {
        onClick: () => {
          api.setProps('meter', {
            ...BASE_PROPS,
            value: preset.value,
            valueText: preset.valueText,
          });
        },
      });
    }
  },
};

export default withShadcnRheaDemo(demo);
