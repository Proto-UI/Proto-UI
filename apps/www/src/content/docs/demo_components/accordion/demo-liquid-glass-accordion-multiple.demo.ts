import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    ref: 'lgMultipleStage',
    className:
      'min-w-0 w-full max-w-lg mx-auto rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    materialStage: { mountRef: 'lgMultipleStageFlow', overlayRef: 'lgMultipleStageOverlay' },
    children: [
      {
        kind: 'box',
        ref: 'lgMultipleStageFlow',
        className: 'grid grid-cols-1 min-w-0 gap-4',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-accordion-root',
            props: { mode: 'multiple', defaultOpenItems: ['notifications'] },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-accordion-item',
                props: { value: 'notifications' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-accordion-heading',
                    props: { level: 3 },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-accordion-trigger',
                        children: ['Notification Settings'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-accordion-content',
                    children: [
                      'Enable email alerts for account updates or push notifications for mobile devices.',
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-accordion-item',
                props: { value: 'privacy' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-accordion-heading',
                    props: { level: 3 },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-accordion-trigger',
                        children: ['Privacy & Security'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-accordion-content',
                    children: [
                      'Configure two-factor authentication, review active sessions, and manage connected devices.',
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-accordion-item',
                props: { value: 'billing' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-accordion-heading',
                    props: { level: 3 },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-accordion-trigger',
                        children: ['Billing & Subscription'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-accordion-content',
                    children: [
                      'Review payment history, download invoices, or update your subscription tier.',
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      { kind: 'box', ref: 'lgMultipleStageOverlay', children: [] },
    ],
  },
};

export default demo;
