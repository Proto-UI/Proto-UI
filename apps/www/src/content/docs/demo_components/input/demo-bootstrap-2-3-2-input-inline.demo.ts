import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-md items-start gap-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-input-root',
        props: {
          placeholder: 'Search...',
          inputMode: 'search',
          enterKeyHint: 'search',
          ariaLabel: 'Search',
        },
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        children: ['Search'],
      },
    ],
  },
} satisfies DemoSpec;
