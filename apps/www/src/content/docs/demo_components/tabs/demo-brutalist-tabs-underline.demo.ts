export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-tabs-root',
    className: 'w-[420px] max-w-full',
    props: { defaultValue: 'overview' },
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-tabs-list',
        props: { appearance: 'underline' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-tabs-trigger',
            props: { value: 'overview', appearance: 'underline' },
            children: ['Overview'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-tabs-trigger',
            props: { value: 'analytics', appearance: 'underline' },
            children: ['Analytics'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-tabs-trigger',
            props: { value: 'reports', appearance: 'underline' },
            children: ['Reports'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-tabs-content',
        props: { value: 'overview' },
        children: ['High-contrast underline navigation using bold DM Sans heading labels.'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-tabs-content',
        props: { value: 'analytics' },
        children: ['Compare weekly traffic, conversion milestones, and active cohorts.'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-tabs-content',
        props: { value: 'reports' },
        children: ['Export CSV and PDF summaries for quarterly reviews.'],
      },
    ],
  },
};
