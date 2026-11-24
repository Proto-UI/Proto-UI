import type { DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

function choiceCard(title: string, description: string, defaultChecked: boolean): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'brutalist-field-root',
    className:
      'relative flex flex-row items-center justify-between gap-4 rounded-base border-2 border-black bg-secondary-background p-4 shadow-[4px_4px_0_0_#000]',
    children: [
      {
        kind: 'box',
        className: 'flex min-w-0 flex-1 flex-col gap-1',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-label',
            className: "after:absolute after:inset-0 after:content-['']",
            children: [title],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-description',
            children: [description],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-field-switch',
        className: 'relative z-10 shrink-0',
        props: { defaultChecked },
        children: [{ kind: 'proto', prototypeId: 'brutalist-switch-thumb' }],
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-sm gap-4',
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
} satisfies DemoSpec;
