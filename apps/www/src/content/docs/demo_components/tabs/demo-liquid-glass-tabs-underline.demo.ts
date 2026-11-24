export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'w-full max-w-[468px] rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
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
            props: { appearance: 'underline' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-tabs-trigger',
                props: { value: 'overview', appearance: 'underline' },
                children: ['Overview'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-tabs-trigger',
                props: { value: 'analytics', appearance: 'underline' },
                children: ['Analytics'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-tabs-trigger',
                props: { value: 'reports', appearance: 'underline' },
                children: ['Reports'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tabs-content',
            props: { value: 'overview' },
            children: [
              'Underline appearance omits the glass track for lightweight secondary navigation.',
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tabs-content',
            props: { value: 'analytics' },
            children: ['Track active users and retention curves across platforms.'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tabs-content',
            props: { value: 'reports' },
            children: ['Download quarterly summaries and automated digests.'],
          },
        ],
      },
    ],
  },
};
