import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-4 p-2',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-surface-root',
            props: { actionProfile: 'button', variant: 'secondary' },
            children: ['Default .btn'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-surface-root',
            props: { actionProfile: 'button', variant: 'secondary', hovered: true },
            children: ['Hovered .btn'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-surface-root',
            props: { actionProfile: 'button', variant: 'secondary', pressed: true },
            children: ['Pressed .btn'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-surface-root',
            props: { actionProfile: 'button', variant: 'solid' },
            children: ['Primary'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-surface-root',
            props: { actionProfile: 'button', variant: 'solid', focusVisible: true },
            children: ['Focused Primary'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center justify-between gap-3',
        children: [
          {
            kind: 'box',
            ref: 'bsFadeBtnWrap',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-button',
                props: { variant: 'default', size: 'sm' },
                children: ['Toggle Fade'],
              },
            ],
          },
          {
            kind: 'box',
            ref: 'bsFadeStatus',
            className: 'text-xs font-mono opacity-75',
            children: ['transitionState: entered'],
          },
        ],
      },
      {
        kind: 'proto',
        ref: 'bsFadePanel',
        prototypeId: 'bootstrap-2-3-2-surface-root',
        surfaceStyle: { '--pui-surface-transition-duration': '220ms' },
        props: {
          variant: 'accent',
          fade: true,
          transitionState: 'entered',
        },
        children: [
          {
            kind: 'box',
            className: 'px-4 py-3 text-sm',
            children: ['Passive fade panel responding to Transition phases.'],
          },
        ],
      },
    ],
  },
  setup(ctx) {
    let visible = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const setPhase = (phase: 'entering' | 'entered' | 'leaving' | 'closed') => {
      ctx.api.setProps('bsFadePanel', { transitionState: phase });
      if (ctx.refs.bsFadeStatus) {
        ctx.refs.bsFadeStatus.textContent = `transitionState: ${phase}`;
      }
    };
    const onToggle = () => {
      if (timer) clearTimeout(timer);
      visible = !visible;
      if (visible) {
        setPhase('closed');
        timer = setTimeout(() => {
          setPhase('entering');
          timer = setTimeout(() => setPhase('entered'), 220);
        }, 20);
      } else {
        setPhase('leaving');
        timer = setTimeout(() => setPhase('closed'), 220);
      }
    };
    const trigger = ctx.refs.bsFadeBtnWrap;
    trigger?.addEventListener('click', onToggle);
    return () => {
      if (timer) clearTimeout(timer);
      trigger?.removeEventListener('click', onToggle);
    };
  },
} satisfies DemoSpec;
