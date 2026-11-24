import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

function option(value: string, label: string): DemoNode {
  const key = `brutalist-invalid-${value}`;
  return {
    kind: 'box',
    className: 'flex items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-radio-group-item',
        ref: key,
        props: { value },
        associations: { controlLabel: key },
        children: [{ kind: 'proto', prototypeId: 'brutalist-radio-group-indicator' }],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-label-root',
        ref: `${key}-label`,
        associations: { controlLabel: key },
        className: 'font-sans text-sm font-medium leading-none',
        children: [label],
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-xs p-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-field-root',
        ref: 'brutalistInvalidField',
        props: {
          invalid: true,
          errors: ['Please choose a notification preference before continuing.'],
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-label',
            ref: 'brutalistInvalidLabel',
            children: ['Notification Preferences'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-description',
            ref: 'brutalistInvalidDescription',
            children: ['Choose how you want to receive notifications.'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-radio-group',
            ref: 'brutalistInvalidGroup',
            props: { a11yLabel: 'Notification Preferences', defaultValue: 'email' },
            children: [
              option('email', 'Email only'),
              option('sms', 'SMS only'),
              option('both', 'Both Email & SMS'),
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-error',
            ref: 'brutalistInvalidError',
          },
        ],
      },
    ],
  },
} as unknown as DemoSpec;
