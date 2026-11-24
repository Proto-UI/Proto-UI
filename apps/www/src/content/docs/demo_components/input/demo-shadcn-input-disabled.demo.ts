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
        props: { disabled: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-label',
            children: ['Email'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-control',
            props: {
              placeholder: 'Email',
              inputMode: 'email',
              disabled: true,
            },
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-description',
            children: ['This field is currently disabled.'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
