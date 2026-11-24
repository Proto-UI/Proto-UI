import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid justify-items-center gap-3 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-navigation-menu-root',
        ref: 'root',
        props: { value: '', a11yLabel: 'Controlled navigation' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-navigation-menu-trigger',
            props: { value: 'docs' },
            children: [
              'Docs',
              {
                kind: 'box',
                tag: 'span',
                className: 'text-[10px] leading-none',
                attrs: { 'aria-hidden': 'true' },
                children: ['▾'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-navigation-menu-content',
            props: { value: 'docs', a11yLabel: 'Documentation links' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-navigation-menu-link',
                ref: 'introLink',
                props: { href: '#getting-started', current: true },
                children: ['Getting started'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-navigation-menu-item',
                ref: 'copyCmd',
                props: { value: 'copy-install', textValue: 'Copy install command' },
                children: ['Copy install command'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-navigation-menu-trigger',
            props: { value: 'community' },
            children: [
              'Community',
              {
                kind: 'box',
                tag: 'span',
                className: 'text-[10px] leading-none',
                attrs: { 'aria-hidden': 'true' },
                children: ['▾'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-navigation-menu-content',
            props: { value: 'community', a11yLabel: 'Community links' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-navigation-menu-link',
                ref: 'discussionsLink',
                props: { href: '#discussions' },
                children: ['Discussions'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-navigation-menu-item',
                ref: 'reportIssue',
                props: { value: 'report-issue', textValue: 'Report an issue' },
                children: ['Report an issue'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center justify-center gap-2 text-xs',
        children: [
          {
            kind: 'box',
            tag: 'span',
            ref: 'openDocs',
            className: 'cursor-pointer rounded-[4px] border border-border px-2.5 py-1',
            attrs: { role: 'button', tabindex: '0' },
            children: ['Open Docs'],
          },
          {
            kind: 'box',
            tag: 'span',
            ref: 'closeAll',
            className: 'cursor-pointer rounded-[4px] border border-border px-2.5 py-1',
            attrs: { role: 'button', tabindex: '0' },
            children: ['Close'],
          },
          {
            kind: 'box',
            tag: 'span',
            ref: 'status',
            className: 'px-2 py-1 text-muted-foreground',
            attrs: { 'aria-live': 'polite' },
            children: ['Active panel: none'],
          },
        ],
      },
    ],
  },
  setup({ refs, api }) {
    const setPanel = (next: string, note: string) => {
      api.setProps('root', { value: next });
      refs.status.textContent = note;
    };
    api.setProps('root', {
      value: '',
      onValueChange: (detail: { value: string; reason: string }) => {
        setPanel(
          detail.value,
          detail.value ? `Active panel: ${detail.value}` : 'Active panel: none'
        );
      },
    });
    for (const ref of ['copyCmd', 'reportIssue']) {
      api.setProps(ref, {
        onSelect: (detail: { value: string }) => {
          refs.status.textContent = `Selected action: ${detail.value}`;
        },
      });
    }
    for (const ref of ['introLink', 'discussionsLink']) {
      api.setProps(ref, {
        onNavigate: (detail: { href: string }) => {
          refs.status.textContent = `Navigated to: ${detail.href}`;
        },
      });
    }
    const openDocs = () => setPanel('docs', 'Active panel: docs');
    const closeAll = () => setPanel('', 'Active panel: none');
    const onOpenKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDocs();
      }
    };
    const onCloseKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        closeAll();
      }
    };
    refs.openDocs.addEventListener('click', openDocs);
    refs.closeAll.addEventListener('click', closeAll);
    refs.openDocs.addEventListener('keydown', onOpenKey);
    refs.closeAll.addEventListener('keydown', onCloseKey);
    return () => {
      refs.openDocs.removeEventListener('click', openDocs);
      refs.closeAll.removeEventListener('click', closeAll);
      refs.openDocs.removeEventListener('keydown', onOpenKey);
      refs.closeAll.removeEventListener('keydown', onCloseKey);
    };
  },
} satisfies DemoSpec;
