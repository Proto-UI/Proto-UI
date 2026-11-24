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
        props: { value: '', loop: false, a11yLabel: 'Workspace settings' },
        ref: 'root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-menubar-trigger',
            props: { value: 'profiles' },
            children: ['Profiles'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-menubar-content',
            props: { value: 'profiles', a11yLabel: 'Switch profile' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: { value: 'Andy', textValue: 'Andy' },
                ref: 'andy',
                children: ['Andy'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: { value: 'Benoit', textValue: 'Benoit' },
                ref: 'benoit',
                children: ['Benoit'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: { value: 'Luis', textValue: 'Luis' },
                ref: 'luis',
                children: ['Luis'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-menubar-trigger',
            props: { value: 'theme' },
            children: ['Theme'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-menubar-content',
            props: { value: 'theme', a11yLabel: 'Choose theme' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: { value: 'Light', textValue: 'Light' },
                ref: 'light',
                children: ['Light'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: { value: 'Dark', textValue: 'Dark' },
                ref: 'dark',
                children: ['Dark'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-menubar-item',
                props: { value: 'System', textValue: 'System' },
                ref: 'system',
                children: ['System'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        ref: 'summary',
        className: 'text-xs text-muted-foreground',
        attrs: { 'aria-live': 'polite' },
        children: ['Profile: Benoit · Theme: System · Open: none'],
      },
    ],
  },
  setup({ refs, api }) {
    let openMenu = '';
    let activeProfile = 'Benoit';
    let activeTheme = 'System';
    const sync = () => {
      refs.summary.textContent = `Profile: ${activeProfile} · Theme: ${activeTheme} · Open: ${openMenu || 'none'}`;
    };
    api.setProps('root', {
      onValueChange: (detail: { value: string }) => {
        openMenu = detail.value;
        api.setProps('root', { value: openMenu });
        sync();
      },
    });
    for (const ref of ['andy', 'benoit', 'luis']) {
      api.setProps(ref, {
        onSelect: (detail: { value: string }) => {
          activeProfile = detail.value;
          sync();
        },
      });
    }
    for (const ref of ['light', 'dark', 'system']) {
      api.setProps(ref, {
        onSelect: (detail: { value: string }) => {
          activeTheme = detail.value;
          sync();
        },
      });
    }
  },
} satisfies DemoSpec;
