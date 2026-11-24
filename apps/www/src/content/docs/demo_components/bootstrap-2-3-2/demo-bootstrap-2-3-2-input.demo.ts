import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-md flex-col gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex flex-col gap-1',
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
            children: ['Shown in navigation headers and workspace links.'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-1',
        children: [
          { kind: 'box', className: 'text-sm font-medium', children: ['Disabled'] },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-input-root',
            props: {
              defaultValue: 'Archived workspace',
              disabled: true,
              ariaLabel: 'Disabled project name',
            },
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-1',
        children: [
          { kind: 'box', className: 'text-sm font-medium', children: ['Read only'] },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-input-root',
            props: {
              defaultValue: 'https://example.com/proto-ui',
              readOnly: true,
              inputMode: 'url',
              ariaLabel: 'Read-only workspace URL',
            },
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
