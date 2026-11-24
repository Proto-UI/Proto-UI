import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const COMMAND_LABELS: Record<string, string> = {
  undo: 'Undo last edit',
  redo: 'Redo edit',
  share: 'Share link copied',
  publish: 'Draft published',
};

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'min-w-0 w-full rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 grid justify-items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-toolbar-root',
        ref: 'root',
        props: {
          a11yLabel: 'Document actions',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toolbar-button',
            ref: 'undo',
            props: { value: 'undo' },
            children: ['Undo'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toolbar-button',
            ref: 'redo',
            props: { value: 'redo' },
            children: ['Redo'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toolbar-separator',
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toolbar-button',
            ref: 'share',
            props: { value: 'share' },
            children: ['Share'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toolbar-button',
            props: { value: 'paste', disabled: true },
            children: ['Paste'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toolbar-separator',
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toolbar-button',
            ref: 'publish',
            props: { value: 'publish', variant: 'prominent' },
            children: ['Publish'],
          },
        ],
      },
      {
        kind: 'box',
        ref: 'status',
        className: 'text-xs text-muted-foreground',
        attrs: {
          role: 'status',
          'aria-live': 'polite',
        },
        children: ['Use Arrow keys to navigate commands, or activate a button.'],
      },
    ],
  },
  setup({ refs, api }) {
    for (const ref of ['undo', 'redo', 'share', 'publish']) {
      api.setProps(ref, {
        onAction: (detail: { value: string }) => {
          refs.status.textContent = COMMAND_LABELS[detail.value] ?? detail.value;
        },
      });
    }
  },
} satisfies DemoSpec;
