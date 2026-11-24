import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const TERMS_SECTIONS = [
  'Section 1 — Overview: These terms govern your access to the workspace API, component packages, and documentation services.',
  'Section 2 — Account Responsibilities: Keep project credentials and access tokens confidential and rotate them regularly.',
  'Section 3 — Acceptable Use: Do not disrupt shared infrastructure, attempt unauthorized access, or automate abusive traffic.',
  'Section 4 — Availability: Scheduled maintenance windows are announced in advance, and critical updates are rolled out incrementally.',
  'Section 5 — Privacy & Telemetry: Operational diagnostics exclude personal content and respect workspace opt-out settings.',
  'Section 6 — Intellectual Property: You retain full ownership of all applications and design tokens authored in your workspace.',
  'Section 7 — Updates: Material changes take effect after notice is published in the workspace release notes.',
  'Section 8 — Support: Reach out through the repository issue tracker for bug reports and compatibility questions.',
];

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-dialog-root',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-dialog-trigger',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            props: { variant: 'outline' },
            children: ['Scrollable Content'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-dialog-mask',
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-dialog-content',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-dialog-header',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-dialog-title',
                children: ['Scrollable Content'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-dialog-description',
                children: ['Long content scrolls cleanly while the dialog header stays in view.'],
              },
            ],
          },
          {
            kind: 'box',
            className: 'max-h-[50vh] overflow-y-auto pr-2 grid gap-3 text-sm leading-relaxed text-muted-foreground',
            children: TERMS_SECTIONS.map((paragraph) => ({
              kind: 'box' as const,
              children: [paragraph],
            })),
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-dialog-close-icon',
          },
        ],
      },
    ],
  },
});
