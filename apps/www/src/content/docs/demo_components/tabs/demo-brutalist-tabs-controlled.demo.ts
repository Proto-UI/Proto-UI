import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const TABS = ['overview', 'analytics', 'reports'] as const;

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-[420px] max-w-full gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-2',
        attrs: { role: 'group', 'aria-label': 'External tab controls' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            ref: 'brutalist-ctrl-overview',
            children: ['Overview'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            ref: 'brutalist-ctrl-analytics',
            children: ['Analytics'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            ref: 'brutalist-ctrl-reports',
            children: ['Reports'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-tabs-root',
        ref: 'brutalistControlledTabs',
        props: { value: 'overview' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-tabs-list',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-tabs-trigger',
                props: { value: 'overview' },
                children: ['Overview'],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-tabs-trigger',
                props: { value: 'analytics' },
                children: ['Analytics'],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-tabs-trigger',
                props: { value: 'reports' },
                children: ['Reports'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-tabs-content',
            props: { value: 'overview' },
            children: ['Controlled Overview tab synced with external Brutalist buttons.'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-tabs-content',
            props: { value: 'analytics' },
            children: ['Controlled Analytics tab updated via value and valueChange.'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-tabs-content',
            props: { value: 'reports' },
            children: ['Controlled Reports tab ready for export workflows.'],
          },
        ],
      },
      {
        kind: 'box',
        ref: 'brutalistControlledStatus',
        attrs: { role: 'status', 'aria-live': 'polite' },
        className: 'text-sm text-muted-foreground',
        children: ['Selected tab: overview'],
      },
    ],
  },
  setup({ refs, api }) {
    let current = 'overview';
    let disposed = false;
    const setTab = (next: string) => {
      if (disposed || !next || next === current) return;
      current = next;
      api.setProps('brutalistControlledTabs', { value: next });
      refs.brutalistControlledStatus.textContent = `Selected tab: ${next}`;
    };
    api.setProps('brutalistControlledTabs', {
      onValueChange: (payload: unknown) => {
        const next =
          typeof payload === 'string'
            ? payload
            : typeof (payload as { detail?: { value?: unknown } })?.detail?.value === 'string'
              ? (payload as { detail: { value: string } }).detail.value
              : typeof (payload as { value?: unknown })?.value === 'string'
                ? (payload as { value: string }).value
                : '';
        if (next) setTab(next);
      },
    });
    for (const value of TABS) {
      api.setProps(`brutalist-ctrl-${value}`, { onClick: () => setTab(value) });
    }
    return () => {
      disposed = true;
    };
  },
} satisfies DemoSpec;
