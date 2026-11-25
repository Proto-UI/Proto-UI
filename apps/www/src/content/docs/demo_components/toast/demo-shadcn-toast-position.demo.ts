import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

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
                ref: 'title',
                children: ['Event has been created'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-toast-description',
                ref: 'desc',
                children: ['Positioned at bottom-right'],
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
  setup({ refs, api }) {
    const cleanups: Array<() => void> = [];
    for (const [pos, label] of POSITIONS) {
      const btn = refs[`btn-${pos}`];
      const onClick = () => {
        api.setProps('viewport', { position: pos });
        refs.title.textContent = `Toast (${label})`;
        refs.desc.textContent = `Viewport position set to "${pos}".`;
        const toastExposes = api.getExposes('toast') as { openToast?: () => void } | null;
        toastExposes?.openToast?.();
      };
      btn.addEventListener('click', onClick);
      cleanups.push(() => btn.removeEventListener('click', onClick));
    }
    const onDismissAll = () => {
      const vpExposes = api.getExposes('viewport') as { dismissAll?: () => void } | null;
      vpExposes?.dismissAll?.();
    };
    refs.dismissAll.addEventListener('click', onDismissAll);
    cleanups.push(() => refs.dismissAll.removeEventListener('click', onDismissAll));
    return () => {
      for (const fn of cleanups) fn();
    };
  },
} satisfies DemoSpec);
