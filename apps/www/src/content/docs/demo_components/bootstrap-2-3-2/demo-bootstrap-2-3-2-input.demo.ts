import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-md flex-col gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex flex-col gap-2',
        children: [
          { kind: 'box', className: 'text-sm font-medium', children: ['Project name'] },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-input-root',
            props: {
              defaultValue: 'Proto UI',
              placeholder: 'Name this project',
              ariaLabel: 'Project name',
              name: 'project-name',
              maxLength: 80,
            },
          },
          {
            kind: 'box',
            className: 'text-xs text-muted-foreground',
            children: ['Value, editing, and IME stay with Base Input.'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-2',
        children: [
          { kind: 'box', className: 'text-sm font-medium', children: ['Disabled'] },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-input-root',
            props: {
              defaultValue: 'This field is disabled.',
              disabled: true,
              ariaLabel: 'Disabled project name',
            },
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-2',
        children: [
          { kind: 'box', className: 'text-sm font-medium', children: ['Read only'] },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-input-root',
            props: {
              defaultValue: 'This field is read only.',
              readOnly: true,
              ariaLabel: 'Read-only project name',
            },
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
