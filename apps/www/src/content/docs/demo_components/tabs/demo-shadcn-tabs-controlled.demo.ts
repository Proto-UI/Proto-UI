import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const TABS = ['overview', 'analytics', 'reports'] as const;

export default withShadcnRheaDemo({
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
            prototypeId: 'shadcn-button',
            ref: 'ctrl-overview',
            props: { variant: 'outline', size: 'sm' },
            children: ['Overview'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: 'ctrl-analytics',
            props: { variant: 'outline', size: 'sm' },
            children: ['Analytics'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: 'ctrl-reports',
            props: { variant: 'outline', size: 'sm' },
            children: ['Reports'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-root',
        ref: 'controlledTabs',
        props: { value: 'overview' },
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
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tabs-content',
            props: { value: 'overview' },
            children: ['Controlled overview panel synchronized with external actions.'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tabs-content',
            props: { value: 'analytics' },
            children: ['Controlled analytics panel updated through value and valueChange.'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tabs-content',
            props: { value: 'reports' },
            children: ['Controlled reports panel driven by external state.'],
          },
        ],
      },
      {
        kind: 'box',
        ref: 'controlledStatus',
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
      api.setProps('controlledTabs', { value: next });
      refs.controlledStatus.textContent = `Selected tab: ${next}`;
    };
    api.setProps('controlledTabs', {
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
      api.setProps(`ctrl-${value}`, { onClick: () => setTab(value) });
    }
    return () => {
      disposed = true;
    };
  },
} satisfies DemoSpec);
