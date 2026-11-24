import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid justify-items-start gap-3 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-menubar-root',
        props: { a11yLabel: 'Application menu' },
        ref: 'root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-menubar-trigger',
            props: { value: 'file' },
            children: ['File'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-menubar-content',
            props: { value: 'file', a11yLabel: 'File menu' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: { value: 'new-tab', textValue: 'New Tab' },
                children: ['New Tab'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: { value: 'new-window', textValue: 'New Window' },
                children: ['New Window'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: { value: 'incognito', textValue: 'New Incognito Window', disabled: true },
                children: ['New Incognito Window'],
              },
              {
                kind: 'box',
                className: 'my-1 h-px bg-border',
                attrs: { role: 'separator' },
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: { value: 'print', textValue: 'Print' },
                children: ['Print...'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-menubar-trigger',
            props: { value: 'edit' },
            children: ['Edit'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-menubar-content',
            props: { value: 'edit', a11yLabel: 'Edit menu' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: { value: 'undo', textValue: 'Undo' },
                children: ['Undo'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: { value: 'redo', textValue: 'Redo' },
                children: ['Redo'],
              },
              {
                kind: 'box',
                className: 'my-1 h-px bg-border',
                attrs: { role: 'separator' },
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: { value: 'cut', textValue: 'Cut' },
                children: ['Cut'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: { value: 'copy', textValue: 'Copy' },
                children: ['Copy'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: { value: 'paste', textValue: 'Paste' },
                children: ['Paste'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-menubar-trigger',
            props: { value: 'view' },
            children: ['View'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-menubar-content',
            props: { value: 'view', a11yLabel: 'View menu' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: { value: 'reload', textValue: 'Reload', inset: true },
                children: ['Reload'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
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
                className: 'my-1 h-px bg-border',
                attrs: { role: 'separator' },
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: { value: 'fullscreen', textValue: 'Toggle Fullscreen', inset: true },
                children: ['Toggle Fullscreen'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: { value: 'sidebar', textValue: 'Hide Sidebar', inset: true },
                children: ['Hide Sidebar'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-menubar-trigger',
            props: { value: 'profiles' },
            children: ['Profiles'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-menubar-content',
            props: { value: 'profiles', a11yLabel: 'Profiles menu' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: { value: 'andy', textValue: 'Andy' },
                children: ['Andy'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: { value: 'benoit', textValue: 'Benoit' },
                children: ['Benoit'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: { value: 'luis', textValue: 'Luis' },
                children: ['Luis'],
              },
              {
                kind: 'box',
                className: 'my-1 h-px bg-border',
                attrs: { role: 'separator' },
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: { value: 'add-profile', textValue: 'Add Profile', inset: true },
                children: ['Add Profile...'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
