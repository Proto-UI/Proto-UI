import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import { shadcnCheckboxDemoChildren } from '../../../../components/PrototypePreviewer/shadcn-checkbox-composition';
import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const [control, label] = shadcnCheckboxDemoChildren({
  associationKey: 'shadcn-checkbox-desc-terms',
  label: ['Accept terms and conditions'],
  controlProps: { defaultChecked: true },
});

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-sm items-start gap-3',
    children: [
      control,
      {
        kind: 'box',
        className: 'grid gap-1.5 leading-none',
        children: [
          label,
          {
            kind: 'box',
            className: 'text-sm text-muted-foreground',
            children: ['By clicking this checkbox, you agree to the terms and conditions.'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
