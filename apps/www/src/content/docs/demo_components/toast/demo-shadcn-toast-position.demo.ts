import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { setToastCopy } from './toast-copy';

const POSITIONS = [
  ['top-left', 'Top Left'],
  ['top-center', 'Top Center'],
  ['top-right', 'Top Right'],
  ['bottom-left', 'Bottom Left'],
  ['bottom-center', 'Bottom Center'],
  ['bottom-right', 'Bottom Right'],
] as const;

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid gap-3 p-4',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-2',
        children: [
          ...POSITIONS.map(([pos, label]) => ({
            kind: 'proto' as const,
            prototypeId: 'shadcn-button',
            ref: `btn-${pos}`,
            props: { variant: 'outline', size: 'sm' },
            children: [label],
          })),
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: 'dismissAll',
            props: { variant: 'ghost', size: 'sm' },
            children: ['Dismiss All'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-toast-viewport',
        previewTheme: 'portal',
        ref: 'viewport',
        props: { a11yLabel: 'Positioned notifications', position: 'bottom-right' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-toast-root',
            ref: 'toast',
            props: { defaultOpen: false, duration: 4000, type: 'info' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-toast-title',
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    ref: 'title-copy',
                    dynamicChildren: { prototypeIds: [] },
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-toast-description',
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    ref: 'description-copy',
                    dynamicChildren: { prototypeIds: [] },
                  },
                ],
              },
              {
                kind: 'box',
                className: 'flex items-center gap-2 pt-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-toast-close',
                    children: ['Dismiss'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  setup({ api }) {
    let revision = 0;
    for (const [pos, label] of POSITIONS) {
      api.setProps(`btn-${pos}`, {
        async onClick() {
          const request = ++revision;
          const committed = await setToastCopy(
            api,
            `Toast (${label})`,
            `Viewport position set to "${pos}".`
          );
          if (!committed || request !== revision) return;
          api.setProps('viewport', { position: pos });
          api.call('toast', 'openToast');
        },
      });
    }
    api.setProps('dismissAll', {
      onClick() {
        revision++;
        api.call('viewport', 'dismissAll');
      },
    });
    return () => {
      revision++;
    };
  },
} satisfies DemoSpec);
