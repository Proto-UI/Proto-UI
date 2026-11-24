import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import { shadcnCheckboxDemoChildren } from '../../../../components/PrototypePreviewer/shadcn-checkbox-composition';
import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const [termsControl, termsLabel] = shadcnCheckboxDemoChildren({
  associationKey: 'shadcn-checkbox-rtl-terms',
  label: ['قبول الشروط والأحكام'],
  controlProps: { defaultChecked: false },
});

const [descControl, descLabel] = shadcnCheckboxDemoChildren({
  associationKey: 'shadcn-checkbox-rtl-desc',
  label: ['قبول الشروط والأحكام'],
  controlProps: { defaultChecked: true },
});

const [disabledControl, disabledLabel] = shadcnCheckboxDemoChildren({
  associationKey: 'shadcn-checkbox-rtl-disabled',
  label: ['تفعيل الإشعارات'],
  controlProps: { disabled: true },
});

const [cardControl, cardLabel] = shadcnCheckboxDemoChildren({
  associationKey: 'shadcn-checkbox-rtl-card',
  label: ['تفعيل الإشعارات'],
  controlProps: { defaultChecked: true },
});

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    attrs: { dir: 'rtl' },
    className: 'flex w-full max-w-sm flex-col gap-4',
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
            className: 'grid gap-1 leading-snug',
            children: [
              descLabel,
              {
                kind: 'box',
                className: 'text-sm text-muted-foreground',
                children: ['بالنقر على هذا المربع، فإنك توافق على الشروط.'],
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
        className: 'flex items-start gap-3 rounded-lg border border-border bg-card p-3 shadow-xs',
        children: [
          cardControl,
          {
            kind: 'box',
            className: 'grid gap-1 leading-snug',
            children: [
              cardLabel,
              {
                kind: 'box',
                className: 'text-sm text-muted-foreground',
                children: ['يمكنك تفعيل أو إلغاء تفعيل الإشعارات في أي وقت.'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
