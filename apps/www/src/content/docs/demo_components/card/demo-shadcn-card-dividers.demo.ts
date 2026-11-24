import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const terms = [
  'These terms govern your use of the workspace, including access to shared documents, project files, and collaboration tools.',
  'You are responsible for the content you upload and for ensuring that your team has the appropriate permissions to view or edit it.',
  'We may update features or limits as the service evolves. When those changes materially affect your workflow, we will notify workspace administrators.',
  "By continuing, you agree to keep your account credentials secure and to follow your organization's acceptable use policies.",
] as const;

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-card-root',
    className: 'w-full max-w-sm',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-card-header',
        props: { divider: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            props: { size: 'base', weight: 'medium', tone: 'inherit' },
            children: ['Terms of Service'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            props: { size: 'sm', tone: 'muted' },
            children: ['Review the terms before accepting the agreement.'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-card-content',
        children: [
          {
            kind: 'box',
            className:
              'max-h-40 space-y-3 overflow-y-auto text-sm leading-relaxed text-muted-foreground',
            children: terms.map((paragraph) => ({
              kind: 'box' as const,
              children: [paragraph],
            })),
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-card-footer',
        props: { divider: true },
        className: 'justify-end gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            props: { variant: 'outline', size: 'sm' },
            children: ['Decline'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            props: { size: 'sm' },
            children: ['Accept'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
