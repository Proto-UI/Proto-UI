import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-4',
    children: [
      {
        kind: 'box',
        className: 'grid grid-cols-1 gap-3 sm:grid-cols-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-surface-root',
            props: { variant: 'outline', material: 'auto', hovered: true },
            children: [
              {
                kind: 'box',
                className: 'p-3 text-sm',
                children: ['Glass · hovered specular edge'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-surface-root',
            props: { variant: 'outline', material: 'auto', pressed: true },
            children: [
              {
                kind: 'box',
                className: 'p-3 text-sm',
                children: ['Glass · pressed shadow compression'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-surface-root',
            props: { variant: 'outline', material: 'auto', focusVisible: true },
            children: [
              { kind: 'box', className: 'p-3 text-sm', children: ['Glass · keyboard focus ring'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-surface-root',
            props: { variant: 'outline', material: 'opaque', current: true },
            children: [
              { kind: 'box', className: 'p-3 text-sm', children: ['Opaque · current selection'] },
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
            ref: 'lgFadeBtnWrap',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-button',
                props: { variant: 'secondary', size: 'sm' },
                children: ['Toggle Scrim Fade'],
              },
            ],
          },
          {
            kind: 'box',
            ref: 'lgFadeStatus',
            className: 'text-xs font-mono opacity-80',
            children: ['transitionState: entered'],
          },
        ],
      },
      {
        kind: 'proto',
        ref: 'lgFadeScrim',
        prototypeId: 'liquid-glass-surface-root',
        surfaceStyle: { '--pui-surface-transition-duration': '240ms' },
        props: {
          variant: 'scrim',
          border: 'none',
          fade: true,
          transitionState: 'entered',
        },
        children: [
          {
            kind: 'box',
            className: 'p-4 text-sm font-medium text-white',
            children: ['Scrim stays standard opaque-dimming paint with fade support.'],
          },
        ],
      },
    ],
  },
  setup(ctx) {
    let visible = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const setPhase = (phase: 'entering' | 'entered' | 'leaving' | 'closed') => {
      ctx.api.setProps('lgFadeScrim', { transitionState: phase });
      if (ctx.refs.lgFadeStatus) {
        ctx.refs.lgFadeStatus.textContent = `transitionState: ${phase}`;
      }
    };
    const onToggle = () => {
      if (timer) clearTimeout(timer);
      visible = !visible;
      if (visible) {
        setPhase('closed');
        timer = setTimeout(() => {
          setPhase('entering');
          timer = setTimeout(() => setPhase('entered'), 240);
        }, 20);
      } else {
        setPhase('leaving');
        timer = setTimeout(() => setPhase('closed'), 240);
      }
    };
    const trigger = ctx.refs.lgFadeBtnWrap;
    trigger?.addEventListener('click', onToggle);
    return () => {
      if (timer) clearTimeout(timer);
      trigger?.removeEventListener('click', onToggle);
    };
  },
} satisfies DemoSpec;
