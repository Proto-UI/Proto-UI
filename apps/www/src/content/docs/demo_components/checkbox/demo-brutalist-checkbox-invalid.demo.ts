import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-sm',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-field-root',
        ref: 'brutalistInvalidField',
        props: { invalid: true, required: true },
        children: [
          {
            kind: 'box',
            className: 'flex items-center gap-3',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-field-checkbox',
                ref: 'brutalistInvalidCheckbox',
                props: { defaultChecked: false },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-checkbox-indicator',
                    ref: 'brutalistInvalidInd',
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-field-label',
                ref: 'brutalistInvalidLabel',
                children: ['Accept terms and conditions'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-error',
            ref: 'brutalistInvalidError',
            children: ['You must accept the terms and conditions before continuing.'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
