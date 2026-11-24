import { withShadcnRheaDemo } from '../../shadcn-demo-style';

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
        props: { variant: 'line' },
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
        children: ['Summary of active projects, milestones, and team velocity.'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-content',
        props: { value: 'analytics' },
        children: ['Weekly active sessions, retention cohorts, and funnel trends.'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-content',
        props: { value: 'reports' },
        children: ['Scheduled exports and audit snapshots ready for download.'],
      },
    ],
  },
});
