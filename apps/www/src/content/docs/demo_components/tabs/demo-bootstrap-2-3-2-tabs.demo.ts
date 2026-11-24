import type { DemoChild } from '../../../../components/PrototypePreviewer/demo-types';

function bootstrapPanel(title: string, summary: string, detail: string): DemoChild {
  return {
    kind: 'box',
    className: 'rounded border border-border bg-background p-4 text-foreground',
    children: [
      { kind: 'box', className: 'font-semibold', children: [title] },
      { kind: 'box', className: 'mt-1 text-muted-foreground', children: [summary] },
      { kind: 'box', className: 'mt-3', children: [detail] },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'bootstrap-2-3-2-tabs-root',
    className: 'w-[420px] max-w-full',
    props: { defaultValue: 'overview' },
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tabs-list',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-tabs-trigger',
            props: { value: 'overview' },
            children: ['Overview'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-tabs-trigger',
            props: { value: 'analytics' },
            children: ['Analytics'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-tabs-trigger',
            props: { value: 'reports' },
            children: ['Reports'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-tabs-trigger',
            props: { value: 'settings' },
            children: ['Settings'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tabs-indicator',
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tabs-content',
        props: { value: 'overview' },
        children: [
          bootstrapPanel(
            'Overview',
            'Review active projects and recent team activity.',
            'You have 12 active projects and 3 pending tasks.'
          ),
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tabs-content',
        props: { value: 'analytics' },
        children: [
          bootstrapPanel(
            'Analytics',
            'Track traffic and user engagement across releases.',
            'Page views are up 25% compared to last month.'
          ),
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tabs-content',
        props: { value: 'reports' },
        children: [
          bootstrapPanel(
            'Reports',
            'Download archived exports and compliance summaries.',
            'You have 5 reports ready to export.'
          ),
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tabs-content',
        props: { value: 'settings' },
        children: [
          bootstrapPanel(
            'Settings',
            'Configure notifications, roles, and display defaults.',
            'Changes apply immediately across your workspace.'
          ),
        ],
      },
    ],
  },
};
