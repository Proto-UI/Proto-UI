import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-md flex-col gap-4 p-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-surface-root',
        props: { variant: 'solid', elevation: 'raised' },
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-1 p-4',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-text-root',
                props: { tone: 'inherit', size: 'sm', weight: 'bold' },
                children: ['Inherited foreground contrast'],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-text-root',
                props: { tone: 'inherit', size: 'xs' },
                children: [
                  'Text with tone="inherit" adapts cleanly inside solid or accent shells.',
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center justify-between gap-3',
        children: [
          {
            kind: 'box',
            ref: 'brutalistFadeBtnWrap',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-button',
                props: { variant: 'secondary', size: 'sm' },
                children: ['Toggle Scrim Fade'],
              },
            ],
          },
          {
            kind: 'box',
            ref: 'brutalistFadeStatus',
            className: 'text-xs font-mono',
            children: ['transitionState: entered'],
          },
        ],
      },
      {
        kind: 'proto',
        ref: 'brutalistFadeOverlay',
        prototypeId: 'brutalist-surface-root',
        surfaceStyle: { '--pui-surface-transition-duration': '200ms' },
        props: {
          variant: 'scrim',
          border: 'none',
          fade: true,
          transitionState: 'entered',
        },
        children: [
          {
            kind: 'box',
            className: 'p-4 text-sm font-bold text-white',
            children: ['Fade-enabled scrim surface (200ms)'],
          },
        ],
      },
    ],
  },
  setup(ctx) {
    let visible = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const setPhase = (phase: 'entering' | 'entered' | 'leaving' | 'closed') => {
      ctx.api.setProps('brutalistFadeOverlay', { transitionState: phase });
      if (ctx.refs.brutalistFadeStatus) {
        ctx.refs.brutalistFadeStatus.textContent = `transitionState: ${phase}`;
      }
    };
    const onToggle = () => {
      if (timer) clearTimeout(timer);
      visible = !visible;
      if (visible) {
        setPhase('closed');
        timer = setTimeout(() => {
          setPhase('entering');
          timer = setTimeout(() => setPhase('entered'), 200);
        }, 20);
      } else {
        setPhase('leaving');
        timer = setTimeout(() => setPhase('closed'), 200);
      }
    };
    const trigger = ctx.refs.brutalistFadeBtnWrap;
    trigger?.addEventListener('click', onToggle);
    return () => {
      if (timer) clearTimeout(timer);
      trigger?.removeEventListener('click', onToggle);
    };
  },
} satisfies DemoSpec;
