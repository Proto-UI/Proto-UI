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
        prototypeId: 'shadcn-field-root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-label',
            children: ['Username'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-control',
            props: {
              placeholder: 'Enter your username',
              autoComplete: 'username',
            },
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-description',
            children: ['Choose a unique username for your account.'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
