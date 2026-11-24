import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-sm items-center gap-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-input-root',
        props: {
          placeholder: 'Search...',
          inputMode: 'search',
          enterKeyHint: 'search',
          ariaLabel: 'Search',
        },
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        children: ['Search'],
      },
    ],
  },
} satisfies DemoSpec);
