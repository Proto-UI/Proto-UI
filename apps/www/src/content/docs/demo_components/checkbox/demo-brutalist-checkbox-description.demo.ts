import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const key = 'brutalist-checkbox-desc';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-sm items-start gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-checkbox-root',
        ref: 'descCheckbox',
        props: { defaultChecked: true },
        associations: { controlLabel: key },
        children: [{ kind: 'proto', prototypeId: 'brutalist-checkbox-indicator', ref: 'descInd' }],
      },
      {
        kind: 'box',
        className: 'grid gap-1 leading-snug',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-label-root',
            ref: 'descLabel',
            props: { naming: true, activation: true },
            associations: { controlLabel: key },
            children: ['Accept terms and conditions'],
          },
          {
            kind: 'box',
            className: 'font-sans text-xs font-medium opacity-75',
            children: ['By clicking this checkbox, you agree to the terms and conditions.'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
