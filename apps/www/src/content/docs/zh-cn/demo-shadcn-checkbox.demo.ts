import { withShadcnRheaDemo } from '../shadcn-demo-style';
import { shadcnCheckboxDemoChildren } from '../../../components/PrototypePreviewer/shadcn-checkbox-composition';
import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const [termsControl, termsLabel] = shadcnCheckboxDemoChildren({
  associationKey: 'shadcn-checkbox-hero-terms',
  label: ['Accept terms and conditions'],
  controlProps: { defaultChecked: false },
});

const [descControl, descLabel] = shadcnCheckboxDemoChildren({
  associationKey: 'shadcn-checkbox-hero-desc',
  label: ['Accept terms and conditions'],
  controlProps: { defaultChecked: true },
});

const [disabledControl, disabledLabel] = shadcnCheckboxDemoChildren({
  associationKey: 'shadcn-checkbox-hero-disabled',
  label: ['Enable notifications'],
  controlProps: { disabled: true },
});

const [cardControl, cardLabel] = shadcnCheckboxDemoChildren({
  associationKey: 'shadcn-checkbox-hero-card',
  label: ['Enable notifications'],
  controlProps: { defaultChecked: true },
});

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-sm flex-col gap-5',
    children: [
      {
        kind: 'box',
        className: 'flex items-center gap-3',
        children: [termsControl, termsLabel],
      },
      {
        kind: 'box',
        className: 'flex items-start gap-3',
        children: [
          descControl,
          {
            kind: 'box',
            className: 'grid gap-1.5 leading-none',
            children: [
              descLabel,
              {
                kind: 'box',
                className: 'text-sm text-muted-foreground',
                children: ['By clicking this checkbox, you agree to the terms and conditions.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center gap-3 opacity-60',
        children: [disabledControl, disabledLabel],
      },
      {
        kind: 'box',
        className:
          'flex items-start gap-3 rounded-lg border border-border bg-card p-3 shadow-xs transition-colors',
        children: [
          cardControl,
          {
            kind: 'box',
            className: 'grid gap-1.5 leading-none',
            children: [
              cardLabel,
              {
                kind: 'box',
                className: 'text-sm text-muted-foreground',
                children: ['You can enable or disable notifications at any time.'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
