import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoNode } from '@/components/PrototypePreviewer/demo-types';

function choiceCard(title: string, description: string, defaultChecked: boolean): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'shadcn-field-root',
    className:
      'relative flex flex-row items-center justify-between gap-4 rounded-lg border p-4 has-[[role=switch][aria-checked=true]]:border-primary has-[[role=switch][aria-checked=true]]:bg-accent',
    children: [
      {
        kind: 'box',
        className: 'flex min-w-0 flex-1 flex-col gap-1',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-label',
            className: "after:absolute after:inset-0 after:content-['']",
            children: [title],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-description',
            children: [description],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-field-switch',
        className: 'relative z-10 shrink-0',
        props: { defaultChecked },
        children: [{ kind: 'proto', prototypeId: 'shadcn-switch-thumb' }],
      },
    ],
  };
}

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-sm gap-3',
    children: [
      choiceCard(
        'Share across devices',
        'Focus is shared across devices, and turns off when you leave the app.',
        false
      ),
      choiceCard(
        'Enable notifications',
        'Receive notifications when focus mode is enabled or disabled.',
        true
      ),
    ],
  },
});
