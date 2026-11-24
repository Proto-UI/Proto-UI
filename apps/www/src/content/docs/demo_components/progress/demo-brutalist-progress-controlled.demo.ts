import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full min-w-0 items-center justify-center p-6',
    children: [
      {
        kind: 'box',
        className: 'flex w-full max-w-sm min-w-0 flex-col gap-4',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-progress-root',
            ref: 'progress',
            props: { value: 50, min: 0, max: 100, valueText: '50%' },
            children: [
              { kind: 'proto', prototypeId: 'brutalist-progress-label', children: ['Completion'] },
              { kind: 'proto', prototypeId: 'brutalist-progress-value' },
              {
                kind: 'proto',
                prototypeId: 'brutalist-progress-track',
                children: [{ kind: 'proto', prototypeId: 'brutalist-progress-indicator' }],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-slider-root',
            ref: 'slider',
            props: { value: 50, min: 0, max: 100, step: 1, ariaLabel: 'Progress value' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-slider-track',
                children: [
                  { kind: 'proto', prototypeId: 'brutalist-slider-indicator' },
                  { kind: 'proto', prototypeId: 'brutalist-slider-thumb' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  setup({ api }) {
    api.setProps('slider', {
      onValueChange: (event: number | { value?: number }) => {
        const raw = typeof event === 'number' ? event : event?.value;
        if (typeof raw !== 'number' || !Number.isFinite(raw)) return;
        const next = Math.round(raw);
        api.setProps('slider', { value: next });
        api.setProps('progress', { value: next, min: 0, max: 100, valueText: `${next}%` });
      },
    });
  },
} satisfies DemoSpec;
