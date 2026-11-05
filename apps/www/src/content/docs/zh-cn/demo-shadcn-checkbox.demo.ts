import { withShadcnRheaDemo } from '../shadcn-demo-style';
import { shadcnCheckboxDemoChildren } from '../../../components/PrototypePreviewer/shadcn-checkbox-composition';
import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const examples = [
  { label: 'Unchecked', props: { defaultChecked: false } },
  { label: 'Checked', props: { defaultChecked: true } },
  { label: 'Mixed', props: { defaultIndeterminate: true } },
  { label: 'Disabled', props: { disabled: true, defaultChecked: true } },
  { label: 'Tab here for the focus ring', props: { defaultChecked: false } },
];

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-col gap-3',
    children: examples.map(({ label, props }, index) => ({
      kind: 'box',
      className: 'flex items-center gap-2',
      children: shadcnCheckboxDemoChildren({
        associationKey: `shadcn-checkbox-${index}`,
        label: [label],
        controlProps: props,
      }),
    })),
  },
} satisfies DemoSpec);
