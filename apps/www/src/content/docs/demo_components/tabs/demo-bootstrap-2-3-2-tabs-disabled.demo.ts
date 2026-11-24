export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'bootstrap-2-3-2-tabs-root',
    className: 'w-[420px] max-w-full',
    props: { defaultValue: 'home' },
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tabs-list',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-tabs-trigger',
            props: { value: 'home' },
            children: ['Home'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-tabs-trigger',
            props: { value: 'settings', disabled: true },
            children: ['Disabled'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tabs-content',
        props: { value: 'home' },
        children: [
          'Disabled tabs use muted #999 text in light mode and are skipped by roving focus.',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tabs-content',
        props: { value: 'settings' },
        children: ['Settings are unavailable for read-only members.'],
      },
    ],
  },
};
