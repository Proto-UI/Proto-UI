import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-tabs-root',
    className: 'w-[420px] max-w-full',
    props: { defaultValue: 'home' },
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-list',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-tabs-trigger',
            props: { value: 'home' },
            children: ['Home'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tabs-trigger',
            props: { value: 'settings', disabled: true },
            children: ['Disabled'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-content',
        props: { value: 'home' },
        children: [
          'Disabled triggers are skipped during keyboard navigation and cannot be activated.',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-content',
        props: { value: 'settings' },
        children: ['Workspace settings require administrator permissions.'],
      },
    ],
  },
});
