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
        props: { a11yLabel: 'View preferences' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-menubar-trigger',
            props: { value: 'view' },
            children: ['View'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-menubar-content',
            props: { value: 'view', a11yLabel: 'View options' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: {
                  value: 'bookmarks',
                  textValue: 'Always Show Bookmarks Bar',
                  closeOnSelect: false,
                },
                ref: 'bookmarks',
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    ref: 'bookmarksMark',
                    className: 'inline-block w-4 text-center',
                    attrs: { 'aria-hidden': 'true' },
                    children: [''],
                  },
                  'Always Show Bookmarks Bar',
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: {
                  value: 'urls',
                  textValue: 'Always Show Full URLs',
                  closeOnSelect: false,
                },
                ref: 'urls',
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    ref: 'urlsMark',
                    className: 'inline-block w-4 text-center',
                    attrs: { 'aria-hidden': 'true' },
                    children: ['✓'],
                  },
                  'Always Show Full URLs',
                ],
              },
              {
                kind: 'box',
                className: 'my-1 h-px bg-border',
                attrs: { role: 'separator' },
              },
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
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-menubar-trigger',
            props: { value: 'admin', disabled: true },
            children: ['Admin'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-menubar-content',
            props: { value: 'admin', a11yLabel: 'Admin options' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: { value: 'audit', textValue: 'Audit log' },
                children: ['Audit log'],
              },
            ],
          },
        ],
      },
    ],
  },
  setup({ refs, api }) {
    let showBookmarks = false;
    let showUrls = true;
    api.setProps('bookmarks', {
      onSelect: () => {
        showBookmarks = !showBookmarks;
        refs.bookmarksMark.textContent = showBookmarks ? '✓' : '';
      },
    });
    api.setProps('urls', {
      onSelect: () => {
        showUrls = !showUrls;
        refs.urlsMark.textContent = showUrls ? '✓' : '';
      },
    });
  },
} satisfies DemoSpec;
