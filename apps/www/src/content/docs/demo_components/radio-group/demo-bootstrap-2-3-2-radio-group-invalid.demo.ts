import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

function option(value: string, label: string): DemoNode {
  const key = `bs-invalid-${value}`;
  return {
    kind: 'box',
    className: 'flex items-center gap-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-radio-group-item',
        ref: key,
        props: { value },
        associations: { controlLabel: key },
        children: [{ kind: 'proto', prototypeId: 'bootstrap-2-3-2-radio-group-indicator' }],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-label-root',
        ref: `${key}-label`,
        associations: { controlLabel: key },
        props: { naming: true, activation: true },
        className: 'text-destructive',
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
        prototypeId: 'bootstrap-2-3-2-field-root',
        ref: 'bootstrapInvalidField',
        props: {
          invalid: true,
          errors: ['Please choose a notification preference before continuing.'],
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-field-label',
            ref: 'bootstrapInvalidLabel',
            children: ['Notification Preferences'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-field-description',
            ref: 'bootstrapInvalidDescription',
            children: ['Choose how you want to receive notifications.'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-radio-group-root',
            ref: 'bootstrapInvalidGroup',
            props: { a11yLabel: 'Notification Preferences', defaultValue: 'email' },
            children: [
              option('email', 'Email only'),
              option('sms', 'SMS only'),
              option('both', 'Both Email & SMS'),
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-field-error',
            ref: 'bootstrapInvalidError',
          },
        ],
      },
    ],
  },
} as unknown as DemoSpec;
