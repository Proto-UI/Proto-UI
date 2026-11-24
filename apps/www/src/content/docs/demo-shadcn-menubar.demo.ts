import { withShadcnRheaDemo } from './shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid justify-items-start gap-3 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-menubar-root',
        props: {
          a11yLabel: 'Project commands',
          styleProfile: 'rhea',
        },
        ref: 'root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-menubar-trigger',
            props: { value: 'file' },
            children: ['File'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-menubar-content',
            props: { value: 'file', a11yLabel: 'File commands' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'new', textValue: 'New document' },
                ref: 'new',
                children: ['New document'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'open', textValue: 'Open document' },
                ref: 'open',
                children: ['Open document'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'incognito', textValue: 'New incognito window', disabled: true },
                children: ['New incognito window'],
              },
              {
                kind: 'box',
                className: '-mx-1 my-1 h-px bg-border',
                attrs: { role: 'separator' },
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'print', textValue: 'Print' },
                ref: 'print',
                children: [
                  'Print...',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs tracking-widest text-muted-foreground',
                    attrs: { 'aria-hidden': 'true' },
                    children: ['⌘P'],
                  },
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-menubar-trigger',
            props: { value: 'edit' },
            children: ['Edit'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-menubar-content',
            props: { value: 'edit', a11yLabel: 'Edit commands' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'undo', textValue: 'Undo' },
                ref: 'undo',
                children: ['Undo'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'redo', textValue: 'Redo' },
                ref: 'redo',
                children: ['Redo'],
              },
              {
                kind: 'box',
                className: '-mx-1 my-1 h-px bg-border',
                attrs: { role: 'separator' },
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'cut', textValue: 'Cut' },
                ref: 'cut',
                children: ['Cut'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'copy', textValue: 'Copy' },
                ref: 'copy',
                children: ['Copy'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'paste', textValue: 'Paste' },
                ref: 'paste',
                children: ['Paste'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-menubar-trigger',
            props: { value: 'view' },
            children: ['View'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-menubar-content',
            props: { value: 'view', a11yLabel: 'View commands' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'reload', textValue: 'Reload', inset: true },
                ref: 'reload',
                children: [
                  'Reload',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs tracking-widest text-muted-foreground',
                    attrs: { 'aria-hidden': 'true' },
                    children: ['⌘R'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
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
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'fullscreen', textValue: 'Toggle Fullscreen', inset: true },
                ref: 'fullscreen',
                children: ['Toggle Fullscreen'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'sidebar', textValue: 'Hide Sidebar', inset: true },
                ref: 'sidebar',
                children: ['Hide Sidebar'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-menubar-trigger',
            props: { value: 'profiles' },
            children: ['Profiles'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-menubar-content',
            props: { value: 'profiles', a11yLabel: 'Profile commands' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'andy', textValue: 'Andy' },
                ref: 'andy',
                children: ['Andy'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'benoit', textValue: 'Benoit' },
                ref: 'benoit',
                children: ['Benoit'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'luis', textValue: 'Luis' },
                ref: 'luis',
                children: ['Luis'],
              },
              {
                kind: 'box',
                className: '-mx-1 my-1 h-px bg-border',
                attrs: { role: 'separator' },
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'add-profile', textValue: 'Add Profile', inset: true },
                ref: 'add-profile',
                children: ['Add Profile...'],
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
        children: ['Ready'],
      },
    ],
  },
  setup({ refs, api }) {
    for (const ref of [
      'new',
      'open',
      'print',
      'undo',
      'redo',
      'cut',
      'copy',
      'paste',
      'reload',
      'fullscreen',
      'sidebar',
      'andy',
      'benoit',
      'luis',
      'add-profile',
    ]) {
      api.setProps(ref, {
        onSelect: (detail: { value: string }) => {
          refs.status.textContent = `${detail.value} selected`;
        },
      });
    }
  },
} satisfies DemoSpec);
