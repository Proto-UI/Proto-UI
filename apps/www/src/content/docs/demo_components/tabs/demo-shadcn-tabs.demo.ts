import type { DemoChild } from '../../../../components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

function panelCard(title: string, description: string, body: string): DemoChild {
  return {
    kind: 'box',
    className: 'rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm',
    children: [
      {
        kind: 'box',
        className: 'grid gap-1.5',
        children: [
          {
            kind: 'box',
            className: 'text-base font-semibold leading-none tracking-tight',
            children: [title],
          },
          { kind: 'box', className: 'text-sm text-muted-foreground', children: [description] },
        ],
      },
      {
        kind: 'box',
        className: 'mt-4 text-sm text-muted-foreground',
        children: [body],
      },
    ],
  };
}

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-tabs-root',
    className: 'w-[420px] max-w-full',
    props: { defaultValue: 'overview' },
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-list',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-tabs-trigger',
            props: { value: 'overview' },
            children: ['Overview'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tabs-trigger',
            props: { value: 'analytics' },
            children: ['Analytics'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tabs-trigger',
            props: { value: 'reports' },
            children: ['Reports'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tabs-trigger',
            props: { value: 'settings' },
            children: ['Settings'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-indicator',
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-content',
        props: { value: 'overview' },
        children: [
          panelCard(
            'Overview',
            'View your key metrics and recent project activity. Track progress across all your active projects.',
            'You have 12 active projects and 3 pending tasks.'
          ),
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-content',
        props: { value: 'analytics' },
        children: [
          panelCard(
            'Analytics',
            'Track performance and user engagement metrics. Monitor trends and identify growth opportunities.',
            'Page views are up 25% compared to last month.'
          ),
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-content',
        props: { value: 'reports' },
        children: [
          panelCard(
            'Reports',
            'Generate and download your detailed reports. Export data in multiple formats for analysis.',
            'You have 5 reports ready and available to export.'
          ),
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-content',
        props: { value: 'settings' },
        children: [
          panelCard(
            'Settings',
            'Manage your account preferences and options. Customize your experience to fit your needs.',
            'Configure notifications, security, and themes.'
          ),
        ],
      },
    ],
  },
});
