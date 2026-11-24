import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-sm',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-input-root',
        props: {
          placeholder: 'Enter text',
          ariaLabel: 'Text input',
        },
      },
    ],
  },
} satisfies DemoSpec);
