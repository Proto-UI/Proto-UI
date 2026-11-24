import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-sm',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-field-root',
        ref: 'invalidField',
        props: { invalid: true, required: true },
        children: [
          {
            kind: 'box',
            className: 'flex items-center gap-3',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-field-checkbox',
                ref: 'invalidCheckbox',
                props: { defaultChecked: false },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-checkbox-indicator',
                    ref: 'invalidIndicator',
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-field-label',
                ref: 'invalidLabel',
                children: ['Accept terms and conditions'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-error',
            ref: 'invalidError',
            children: ['You must accept the terms and conditions before continuing.'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
