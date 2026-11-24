import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full flex-col items-center justify-center gap-3 p-4',
    children: [
      {
        kind: 'box',
        className: 'w-full max-w-sm rounded-[var(--pui-radius-3xl)] border border-border bg-popover shadow-md',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-command-root',
            ref: 'root',
            props: { a11yLabel: 'Workspace commands' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-command-input-wrapper',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-input-shell',
                    props: { focusIndicator: 'none' },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-command-input',
                        props: {
                          placeholder: 'Filter workspace actions...',
                          a11yLabel: 'Filter workspace actions',
                        },
                      },
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-command-content',
                children: [
                  {
                    kind: 'box',
                    className: 'px-2 py-1.5 text-xs font-medium text-muted-foreground',
                    attrs: { 'aria-hidden': 'true' },
                    children: ['Quick Actions'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-command-item',
                    props: { value: 'new-file', textValue: 'New File', keywords: 'create document' },
                    children: [
                      { kind: 'box', tag: 'span', children: ['New File'] },
                      {
                        kind: 'box',
                        tag: 'span',
                        className: 'ml-auto font-mono text-xs tracking-widest text-muted-foreground',
                        children: ['⌘N'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-command-item',
                    props: { value: 'new-folder', textValue: 'New Folder', keywords: 'create directory' },
                    children: [
                      { kind: 'box', tag: 'span', children: ['New Folder'] },
                      {
                        kind: 'box',
                        tag: 'span',
                        className: 'ml-auto font-mono text-xs tracking-widest text-muted-foreground',
                        children: ['⇧⌘N'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-command-item',
                    props: {
                      value: 'archive',
                      textValue: 'Archive Workspace',
                      keywords: 'lock readonly',
                      disabled: true,
                    },
                    children: ['Archive Workspace'],
                  },
                  {
                    kind: 'box',
                    className: 'my-1 h-px bg-border',
                    attrs: { role: 'separator' },
                  },
                  {
                    kind: 'box',
                    className: 'px-2 py-1.5 text-xs font-medium text-muted-foreground',
                    attrs: { 'aria-hidden': 'true' },
                    children: ['Team'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-command-item',
                    props: { value: 'invite', textValue: 'Invite Members', keywords: 'share people' },
                    children: ['Invite Members'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-command-item',
                    props: { value: 'permissions', textValue: 'Manage Permissions', keywords: 'roles security' },
                    children: ['Manage Permissions'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-command-empty',
                    children: ['No results found.'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        ref: 'status',
        className: 'text-xs text-muted-foreground',
        attrs: { 'aria-live': 'polite' },
        children: ['Disabled commands are skipped during keyboard activation.'],
      },
    ],
  },
  setup({ refs, api }) {
    api.setProps('root', {
      onExecute: (detail: { value: string; textValue: string }) => {
        refs.status.textContent = `Last command: ${detail.textValue}`;
      },
    });
  },
} satisfies DemoSpec);
