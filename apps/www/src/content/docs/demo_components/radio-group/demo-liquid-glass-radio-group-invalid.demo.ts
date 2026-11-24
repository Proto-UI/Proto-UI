import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

function option(value: string, label: string): DemoNode {
  const key = `lg-invalid-${value}`;
  return {
    kind: 'box',
    className: 'flex items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-radio-group-item',
        ref: key,
        props: { value },
        associations: { controlLabel: key },
        children: [{ kind: 'proto', prototypeId: 'liquid-glass-radio-group-indicator' }],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-label-root',
        ref: `${key}-label`,
        associations: { controlLabel: key },
        props: { naming: true, activation: true },
        className: 'text-sm font-medium leading-none',
        children: [label],
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex w-full justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'box',
        className: 'w-full max-w-xs',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-field-root',
            ref: 'liquidInvalidField',
            props: {
              invalid: true,
              errors: ['Please choose a notification preference before continuing.'],
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-field-label',
                ref: 'liquidInvalidLabel',
                children: ['Notification Preferences'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-field-description',
                ref: 'liquidInvalidDescription',
                children: ['Choose how you want to receive notifications.'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-radio-group-root',
                ref: 'liquidInvalidGroup',
                props: { a11yLabel: 'Notification Preferences', defaultValue: 'email' },
                children: [
                  option('email', 'Email only'),
                  option('sms', 'SMS only'),
                  option('both', 'Both Email & SMS'),
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-field-error',
                ref: 'liquidInvalidError',
              },
            ],
          },
        ],
      },
    ],
  },
} as unknown as DemoSpec;
