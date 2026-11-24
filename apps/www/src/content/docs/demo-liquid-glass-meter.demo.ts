import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

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
    className:
      'w-full rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'box',
        className:
          'mx-auto grid w-full max-w-md min-w-0 gap-4 rounded-xl border border-border bg-background/85 p-5 shadow-xs',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-meter-root',
            ref: 'meter',
            props: { ...BASE_PROPS, value: 32, valueText: '32 GB / 100 GB' },
            children: [
              {
                kind: 'box',
                className: 'flex w-full items-center justify-between gap-2',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-meter-label',
                    children: ['Storage used'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-meter-value',
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-meter-track',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-meter-indicator',
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
                prototypeId: 'liquid-glass-button',
                ref: 'optimal',
                children: ['Optimal (32%)'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-button',
                ref: 'suboptimal',
                children: ['Warning (68%)'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-button',
                ref: 'critical',
                children: ['Critical (92%)'],
              },
            ],
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

export default demo;
