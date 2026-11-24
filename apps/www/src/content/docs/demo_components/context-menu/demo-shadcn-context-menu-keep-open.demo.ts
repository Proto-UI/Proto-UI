import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 items-center justify-center p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-context-menu-root',
        props: { closeOnItemCommit: false },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-context-menu-trigger',
            className:
              'flex h-36 w-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground',
            children: ['Right click to toggle options'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-context-menu-content',
            className: 'w-56',
            children: [
              {
                kind: 'box',
                className: 'px-2 py-1 text-xs font-medium text-muted-foreground',
                children: ['Appearance'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-context-menu-item',
                ref: 'bookmarks',
                props: { value: 'bookmarks', textValue: 'Show Bookmarks Bar' },
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    ref: 'markBookmarks',
                    className: 'inline-block w-4 text-center text-xs',
                    children: ['✓'],
                  },
                  'Show Bookmarks Bar',
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-context-menu-item',
                ref: 'urls',
                props: { value: 'urls', textValue: 'Show Full URLs' },
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    ref: 'markUrls',
                    className: 'inline-block w-4 text-center text-xs',
                    children: [''],
                  },
                  'Show Full URLs',
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-context-menu-item',
                ref: 'devtools',
                props: { value: 'devtools', textValue: 'Show Developer Tools' },
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    ref: 'markDevtools',
                    className: 'inline-block w-4 text-center text-xs',
                    children: ['✓'],
                  },
                  'Show Developer Tools',
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  setup({ refs, api }) {
    const state = { bookmarks: true, urls: false, devtools: true };
    const entries: Array<[keyof typeof state, string]> = [
      ['bookmarks', 'markBookmarks'],
      ['urls', 'markUrls'],
      ['devtools', 'markDevtools'],
    ];
    for (const [key, markRef] of entries) {
      api.setProps(key, {
        onSelect: () => {
          state[key] = !state[key];
          if (refs[markRef]) refs[markRef].textContent = state[key] ? '✓' : '';
        },
      });
    }
  },
} satisfies DemoSpec);
