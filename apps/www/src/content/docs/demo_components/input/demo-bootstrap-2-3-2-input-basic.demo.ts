import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-sm flex-col items-start',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-input-root',
        props: {
          placeholder: 'Type something...',
          ariaLabel: 'Basic input',
        },
      },
    ],
  },
} satisfies DemoSpec;
