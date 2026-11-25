import type { DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

function meterRow(
  label: string,
  props: {
    value: number;
    min: number;
    max: number;
    low: number;
    high: number;
    optimum: number;
    valueText: string;
  }
): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'liquid-glass-meter-root',
    props,
    children: [
      {
        kind: 'box',
        className: 'flex w-full items-center justify-between gap-2',
        children: [
          { kind: 'proto', prototypeId: 'liquid-glass-meter-label', children: [label] },
          { kind: 'proto', prototypeId: 'liquid-glass-meter-value' },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-meter-track',
        children: [{ kind: 'proto', prototypeId: 'liquid-glass-meter-indicator' }],
      },
    ],
  };
}

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full',
    children: [
      {
        kind: 'box',
        className: 'mx-auto grid w-full max-w-md min-w-0 gap-5',
        children: [
          meterRow('Disk usage (optimal)', {
            value: 32,
            min: 0,
            max: 100,
            low: 50,
            high: 80,
            optimum: 20,
            valueText: '32%',
          }),
          meterRow('Disk usage (suboptimal)', {
            value: 68,
            min: 0,
            max: 100,
            low: 50,
            high: 80,
            optimum: 20,
            valueText: '68%',
          }),
          meterRow('Disk usage (critical)', {
            value: 92,
            min: 0,
            max: 100,
            low: 50,
            high: 80,
            optimum: 20,
            valueText: '92%',
          }),
          meterRow('Battery charge (higher is better)', {
            value: 88,
            min: 0,
            max: 100,
            low: 25,
            high: 60,
            optimum: 95,
            valueText: '88%',
          }),
        ],
      },
    ],
  },
};

export default demo;
