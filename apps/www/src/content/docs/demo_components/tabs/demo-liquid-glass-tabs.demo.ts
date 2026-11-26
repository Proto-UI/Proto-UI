import type { DemoChild } from '../../../../components/PrototypePreviewer/demo-types';

function glassPanel(title: string, description: string, detail: string): DemoChild {
  return {
    kind: 'box',
    className: 'rounded-2xl border border-border/60 bg-background/80 p-5 text-foreground shadow-sm',
    children: [
      { kind: 'box', className: 'text-base font-semibold tracking-tight', children: [title] },
      { kind: 'box', className: 'mt-1 text-sm text-muted-foreground', children: [description] },
      { kind: 'box', className: 'mt-3 text-sm text-foreground', children: [detail] },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-[468px]',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-tabs-root',
        className: 'w-full',
        props: { defaultValue: 'overview' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tabs-list',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-tabs-trigger',
                props: { value: 'overview' },
                children: ['Overview'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-tabs-trigger',
                props: { value: 'analytics' },
                children: ['Analytics'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-tabs-trigger',
                props: { value: 'reports' },
                children: ['Reports'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-tabs-trigger',
                props: { value: 'settings' },
                children: ['Settings'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tabs-indicator',
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tabs-content',
            props: { value: 'overview' },
            children: [
              glassPanel(
                'Overview',
                'Key project metrics floating cleanly beneath the capsule Liquid Glass tab bar.',
                'You have 12 active projects and 3 pending tasks.'
              ),
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tabs-content',
            props: { value: 'analytics' },
            children: [
              glassPanel(
                'Analytics',
                'Track engagement trends and retention over the current release window.',
                'Page views are up 25% compared to last month.'
              ),
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tabs-content',
            props: { value: 'reports' },
            children: [
              glassPanel(
                'Reports',
                'Prepare structured exports without stacking glass surfaces onto content panels.',
                'You have 5 reports ready to export.'
              ),
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tabs-content',
            props: { value: 'settings' },
            children: [
              glassPanel(
                'Settings',
                'Adjust appearance, reduced-transparency fallback, and notification rules.',
                'Liquid Glass automatically adapts to reduced transparency and contrast preferences.'
              ),
            ],
          },
        ],
      },
    ],
  },
};
