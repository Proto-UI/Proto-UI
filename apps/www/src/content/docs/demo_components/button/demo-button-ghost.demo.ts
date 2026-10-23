import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export function createGhostDemo(styleProfile: 'new-york' | 'rhea') {
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'flex flex-wrap items-center gap-3',
      children: [
        {
          kind: 'proto',
          prototypeId: 'shadcn-button',
          ref: 'enabled',
          props: { styleProfile, variant: 'ghost' },
          children: ['Ghost'],
        },
        {
          kind: 'proto',
          prototypeId: 'shadcn-button',
          ref: 'disabled',
          props: { styleProfile, variant: 'ghost', disabled: true },
          children: ['Disabled ghost'],
        },
        {
          kind: 'box',
          ref: 'status',
          attrs: { role: 'status', 'aria-live': 'polite' },
          children: ['Enabled activations: 0; disabled activations: 0'],
        },
      ],
    },
    setup({ refs, api }) {
      let enabled = 0,
        disabled = 0;
      const update = () => {
        refs.status.textContent = `Enabled activations: ${enabled}; disabled activations: ${disabled}`;
      };
      // Public DemoRuntimeApi callback projection observes the Button outward
      // signal in all four renderers, not the browser's raw input click.
      api.setProps('enabled', {
        onClick: () => {
          enabled++;
          update();
        },
      });
      api.setProps('disabled', {
        onClick: () => {
          disabled++;
          update();
        },
      });
    },
  } satisfies DemoSpec;
}
// Public legacy example declares its identity; callers never inherit a modern default accidentally.
export default createGhostDemo('new-york');
