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
        props: {
          invalid: true,
          errors: ['This field contains validation errors.'],
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-label',
            children: ['Invalid Input'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-control',
            props: {
              defaultValue: 'sk-invalid',
              placeholder: 'Error',
            },
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-error',
            children: ['This field contains validation errors.'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
