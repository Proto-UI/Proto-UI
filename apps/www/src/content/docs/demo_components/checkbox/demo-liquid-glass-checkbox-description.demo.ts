import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const descKey = 'lg-checkbox-desc';
const cardKey = 'lg-checkbox-card';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-md',
    children: [
      {
        kind: 'box',
        className: 'grid gap-4',
        children: [
          {
            kind: 'box',
            className: 'flex items-start gap-3',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-checkbox-root',
                ref: 'lgDescCheck',
                props: { defaultChecked: true },
                associations: { controlLabel: descKey },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-checkbox-indicator',
                    ref: 'lgDescInd',
                  },
                ],
              },
              {
                kind: 'box',
                className: 'grid gap-0.5 leading-snug',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-label-root',
                    ref: 'lgDescLabel',
                    props: { naming: true, activation: true },
                    associations: { controlLabel: descKey },
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
          {
            kind: 'box',
            className: 'flex items-start gap-3',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-checkbox-root',
                ref: 'lgCardCheck',
                props: { defaultChecked: false },
                associations: { controlLabel: cardKey },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-checkbox-indicator',
                    ref: 'lgCardInd',
                  },
                ],
              },
              {
                kind: 'box',
                className: 'grid gap-0.5 leading-snug',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-label-root',
                    ref: 'lgCardLabel',
                    props: { naming: true, activation: true },
                    associations: { controlLabel: cardKey },
                    children: ['Enable notifications'],
                  },
                  {
                    kind: 'box',
                    className: 'text-xs text-muted-foreground',
                    children: ['You can enable or disable notifications at any time.'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
