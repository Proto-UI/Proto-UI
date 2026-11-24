import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import { shadcnCheckboxDemoChildren } from '../../../../components/PrototypePreviewer/shadcn-checkbox-composition';
import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const [disabledUncheckedControl, disabledUncheckedLabel] = shadcnCheckboxDemoChildren({
  associationKey: 'shadcn-checkbox-disabled-off',
  label: ['Enable notifications'],
  controlProps: { disabled: true, defaultChecked: false },
});

const [disabledCheckedControl, disabledCheckedLabel] = shadcnCheckboxDemoChildren({
  associationKey: 'shadcn-checkbox-disabled-on',
  label: ['Audit logging enabled (locked)'],
  controlProps: { disabled: true, defaultChecked: true },
});

const [readOnlyControl, readOnlyLabel] = shadcnCheckboxDemoChildren({
  associationKey: 'shadcn-checkbox-readonly',
  label: ['Read-only consent (focusable, cannot toggle)'],
  controlProps: { readOnly: true, defaultChecked: true },
});

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-sm flex-col gap-3.5',
    children: [
      {
        kind: 'box',
        className: 'flex items-center gap-3 opacity-60',
        children: [disabledUncheckedControl, disabledUncheckedLabel],
      },
      {
        kind: 'box',
        className: 'flex items-center gap-3 opacity-60',
        children: [disabledCheckedControl, disabledCheckedLabel],
      },
      {
        kind: 'box',
        className: 'flex items-center gap-3',
        children: [readOnlyControl, readOnlyLabel],
      },
    ],
  },
} satisfies DemoSpec);
