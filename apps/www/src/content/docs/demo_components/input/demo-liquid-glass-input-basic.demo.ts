import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-sm',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-input-root',
        props: {
          placeholder: 'Enter text',
          ariaLabel: 'Text input',
        },
      },
    ],
  },
} satisfies DemoSpec;
