import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoNode } from '../../../../components/PrototypePreviewer/demo-types';

function option(value: string, label: string): DemoNode {
  const key = `invalid-${value}`;
  return {
    kind: 'box',
    className: 'flex items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-radio-group-item',
        ref: key,
        props: { value },
        associations: { controlLabel: key },
        children: [{ kind: 'proto', prototypeId: 'shadcn-radio-group-indicator' }],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-label-root',
        ref: `${key}-label`,
        associations: { controlLabel: key },
        className: 'text-sm font-normal leading-none text-destructive',
        children: [label],
      },
    ],
  };
}

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-xs p-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-field-root',
        ref: 'invalidField',
        props: {
          invalid: true,
          errors: ['Please choose a notification preference before continuing.'],
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-label',
            ref: 'invalidFieldLabel',
            children: ['Notification Preferences'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-description',
            ref: 'invalidFieldDescription',
            children: ['Choose how you want to receive notifications.'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-radio-group',
            ref: 'invalidRadioGroup',
            props: { a11yLabel: 'Notification Preferences', defaultValue: 'email' },
            children: [
              option('email', 'Email only'),
              option('sms', 'SMS only'),
              option('both', 'Both Email & SMS'),
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-error',
            ref: 'invalidFieldError',
          },
        ],
      },
    ],
  },
});
