import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full min-w-0 items-center justify-center p-6',
    children: [
      {
        kind: 'box',
        className: 'flex w-full max-w-sm min-w-0 flex-col gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-progress-root',
            ref: 'progress',
            props: { indeterminate: true, min: 0, max: 100 },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-progress-label',
                children: [
                  { kind: 'box', tag: 'span', ref: 'statusLabel', children: ['Loading package…'] },
                ],
              },
              { kind: 'proto', prototypeId: 'bootstrap-2-3-2-progress-value' },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-progress-track',
                children: [{ kind: 'proto', prototypeId: 'bootstrap-2-3-2-progress-indicator' }],
              },
            ],
          },
          {
            kind: 'box',
            className: 'flex items-center gap-2',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-button',
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
          if (refs.statusLabel) refs.statusLabel.textContent = 'Loading package…';
        } else {
          api.setProps('progress', {
            indeterminate: false,
            value: 68,
            min: 0,
            max: 100,
            valueText: '68%',
          });
          if (refs.statusLabel) refs.statusLabel.textContent = 'Loading package';
        }
      },
    });
  },
} satisfies DemoSpec;
