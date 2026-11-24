import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-tabs-root',
    className: 'w-[420px] max-w-full',
    props: { defaultValue: 'general', activationMode: 'manual' },
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-list',
        props: { loop: true, a11yLabel: 'Manual activation settings' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-tabs-trigger',
            props: { value: 'general' },
            children: ['General'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tabs-trigger',
            props: { value: 'security' },
            children: ['Security'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tabs-trigger',
            props: { value: 'integrations' },
            children: ['Integrations'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-content',
        props: { value: 'general', keepMounted: true },
        children: [
          'Arrow keys move focus with looping enabled. Press Enter or Space to switch panels.',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-content',
        props: { value: 'security', keepMounted: true },
        children: ['Panels with keepMounted remain in the tree while hidden.'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-content',
        props: { value: 'integrations', keepMounted: true },
        children: ['Connect webhooks, OAuth apps, and automated CI notifications.'],
      },
    ],
  },
});
