import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const terms = [
  'These terms govern your use of the workspace, including access to shared documents, project files, and collaboration tools.',
  'You are responsible for the content you upload and for ensuring that your team has the appropriate permissions to view or edit it.',
  'We may update features or limits as the service evolves. When those changes materially affect your workflow, we will notify workspace administrators.',
  "By continuing, you agree to keep your account credentials secure and to follow your organization's acceptable use policies.",
] as const;

export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-card-root',
    className: 'w-full max-w-sm',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-card-header',
        props: { divider: true },
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-1',
            children: [
              {
                kind: 'box',
                className: 'font-heading text-base font-bold leading-snug',
                children: ['Terms of Service'],
              },
              {
                kind: 'box',
                className: 'text-sm text-muted-foreground',
                children: ['Review the terms before accepting the agreement.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-card-content',
        children: [
          {
            kind: 'box',
            className: 'max-h-40 space-y-3 overflow-y-auto text-sm leading-relaxed',
            children: terms.map((paragraph) => ({
              kind: 'box' as const,
              children: [paragraph],
            })),
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-card-footer',
        props: { divider: true },
        className: 'justify-end gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            props: { variant: 'surface', size: 'sm' },
            children: ['Decline'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            props: { variant: 'solid', size: 'sm' },
            children: ['Accept'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
