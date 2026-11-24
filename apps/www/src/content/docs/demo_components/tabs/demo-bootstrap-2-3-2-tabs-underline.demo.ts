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
        props: { appearance: 'underline' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-tabs-trigger',
            props: { value: 'overview', appearance: 'underline' },
            children: ['Overview'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-tabs-trigger',
            props: { value: 'analytics', appearance: 'underline' },
            children: ['Analytics'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-tabs-trigger',
            props: { value: 'reports', appearance: 'underline' },
            children: ['Reports'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tabs-content',
        props: { value: 'overview' },
        children: [
          'Lightweight underline tabs retaining Bootstrap 2.3.2 typography and focus outlines.',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tabs-content',
        props: { value: 'analytics' },
        children: ['Monitor page views, bounce rates, and weekly referral sources.'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tabs-content',
        props: { value: 'reports' },
        children: ['Export monthly snapshots in CSV or JSON format.'],
      },
    ],
  },
};
