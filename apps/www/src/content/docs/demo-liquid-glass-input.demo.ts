import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'w-full max-w-xl rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'box',
        className: 'grid min-w-0 gap-4 rounded-2xl bg-background/95 p-5 shadow-sm',
        children: [
          {
            kind: 'box',
            className: 'grid min-w-0 gap-2',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-label-root',
                associations: { controlLabel: 'lg-input-editable' },
                children: ['Display name'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-input-root',
                associations: { controlLabel: 'lg-input-editable' },
                props: {
                  defaultValue: 'Jordan Lee',
                  placeholder: 'Enter your display name',
                },
              },
            ],
          },
          {
            kind: 'box',
            className: 'grid min-w-0 gap-2',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-label-root',
                associations: { controlLabel: 'lg-input-disabled' },
                children: ['Account email'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-input-root',
                associations: { controlLabel: 'lg-input-disabled' },
                props: {
                  defaultValue: 'jordan@example.com',
                  inputMode: 'email',
                  disabled: true,
                },
              },
            ],
          },
          {
            kind: 'box',
            className: 'grid min-w-0 gap-2',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-label-root',
                associations: { controlLabel: 'lg-input-readonly' },
                children: ['Workspace URL'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-input-root',
                associations: { controlLabel: 'lg-input-readonly' },
                props: {
                  defaultValue: 'https://app.example.com/acme',
                  inputMode: 'url',
                  readOnly: true,
                },
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
