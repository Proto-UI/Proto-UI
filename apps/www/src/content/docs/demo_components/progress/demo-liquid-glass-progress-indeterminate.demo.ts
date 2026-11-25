import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full min-w-0 items-center justify-center',
    children: [
      {
        kind: 'box',
        className: 'flex w-full max-w-sm min-w-0 flex-col gap-4',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-progress-root',
            ref: 'progress',
            props: { indeterminate: true, min: 0, max: 100 },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-progress-label',
                children: [
                  { kind: 'box', tag: 'span', ref: 'statusLabel', children: ['Preparing backup…'] },
                ],
              },
              { kind: 'proto', prototypeId: 'liquid-glass-progress-value' },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-progress-track',
                children: [{ kind: 'proto', prototypeId: 'liquid-glass-progress-indicator' }],
              },
            ],
          },
          {
            kind: 'box',
            className: 'flex items-center gap-2',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-button',
                ref: 'toggleMode',
                props: {},
                children: ['Toggle determinate (68%)'],
              },
            ],
          },
        ],
      },
    ],
  },
  setup({ api, refs }) {
    let indeterminate = true;
    api.setProps('toggleMode', {
      onClick: () => {
        indeterminate = !indeterminate;
        if (indeterminate) {
          api.setProps('progress', { indeterminate: true, min: 0, max: 100, valueText: '' });
          if (refs.statusLabel) refs.statusLabel.textContent = 'Preparing backup…';
        } else {
          api.setProps('progress', {
            indeterminate: false,
            value: 68,
            min: 0,
            max: 100,
            valueText: '68%',
          });
          if (refs.statusLabel) refs.statusLabel.textContent = 'Preparing backup';
        }
      },
    });
  },
} satisfies DemoSpec;
