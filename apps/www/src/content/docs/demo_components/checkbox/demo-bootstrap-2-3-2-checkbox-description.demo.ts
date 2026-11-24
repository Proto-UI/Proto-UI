import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const key = 'bs232-checkbox-desc';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-sm items-start gap-2.5',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-checkbox-root',
        ref: 'bsDescCheckbox',
        props: { defaultChecked: true },
        associations: { controlLabel: key },
        children: [
          { kind: 'proto', prototypeId: 'bootstrap-2-3-2-checkbox-indicator', ref: 'bsDescInd' },
        ],
      },
      {
        kind: 'box',
        className: 'grid gap-0.5 leading-snug',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-label-root',
            ref: 'bsDescLabel',
            props: { naming: true, activation: true },
            associations: { controlLabel: key },
            children: ['Accept terms and conditions'],
          },
          {
            kind: 'box',
            className: 'text-xs text-muted-foreground',
            children: ['By checking this box, you agree to the terms and conditions.'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
