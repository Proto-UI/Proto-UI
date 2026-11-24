import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'min-w-0 grid justify-items-start gap-3 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-menubar-root',
        props: { a11yLabel: 'Workspace menu' },
        ref: 'root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-menubar-trigger',
            props: { value: 'file' },
            children: ['File'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-menubar-content',
            props: { value: 'file', a11yLabel: 'File menu' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-menubar-item',
                props: { value: 'new-tab', textValue: 'New Tab' },
                children: [
                  'New Tab',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs tracking-widest opacity-70',
                    attrs: { 'aria-hidden': 'true' },
                    children: ['⌘T'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-menubar-item',
                props: { value: 'new-window', textValue: 'New Window' },
                children: [
                  'New Window',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs tracking-widest opacity-70',
                    attrs: { 'aria-hidden': 'true' },
                    children: ['⌘N'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-menubar-item',
                props: { value: 'incognito', textValue: 'New Private Window', disabled: true },
                children: ['New Private Window'],
              },
              {
                kind: 'box',
                className: '-mx-1 my-1 h-px bg-border',
                attrs: { role: 'separator' },
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-menubar-item',
                props: { value: 'print', textValue: 'Print' },
                children: [
                  'Print...',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs tracking-widest opacity-70',
                    attrs: { 'aria-hidden': 'true' },
                    children: ['⌘P'],
                  },
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-menubar-trigger',
            props: { value: 'edit' },
            children: ['Edit'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-menubar-content',
            props: { value: 'edit', a11yLabel: 'Edit menu' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-menubar-item',
                props: { value: 'undo', textValue: 'Undo' },
                children: ['Undo'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-menubar-item',
                props: { value: 'redo', textValue: 'Redo' },
                children: ['Redo'],
              },
              {
                kind: 'box',
                className: '-mx-1 my-1 h-px bg-border',
                attrs: { role: 'separator' },
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-menubar-item',
                props: { value: 'cut', textValue: 'Cut' },
                children: ['Cut'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-menubar-item',
                props: { value: 'copy', textValue: 'Copy' },
                children: ['Copy'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-menubar-item',
                props: { value: 'paste', textValue: 'Paste' },
                children: ['Paste'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-menubar-trigger',
            props: { value: 'view' },
            children: ['View'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-menubar-content',
            props: { value: 'view', a11yLabel: 'View menu' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-menubar-item',
                props: { value: 'reload', textValue: 'Reload', inset: true },
                children: ['Reload'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-menubar-item',
                props: {
                  value: 'force-reload',
                  textValue: 'Force Reload',
                  inset: true,
                  disabled: true,
                },
                children: ['Force Reload'],
              },
              {
                kind: 'box',
                className: '-mx-1 my-1 h-px bg-border',
                attrs: { role: 'separator' },
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-menubar-item',
                props: { value: 'fullscreen', textValue: 'Enter Full Screen', inset: true },
                children: ['Enter Full Screen'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-menubar-item',
                props: { value: 'sidebar', textValue: 'Hide Sidebar', inset: true },
                children: ['Hide Sidebar'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-menubar-trigger',
            props: { value: 'profiles' },
            children: ['Profiles'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-menubar-content',
            props: { value: 'profiles', a11yLabel: 'Profiles menu' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-menubar-item',
                props: { value: 'andy', textValue: 'Andy' },
                children: ['Andy'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-menubar-item',
                props: { value: 'benoit', textValue: 'Benoit' },
                children: ['Benoit'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-menubar-item',
                props: { value: 'luis', textValue: 'Luis' },
                children: ['Luis'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
