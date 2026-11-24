import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-md flex-col gap-3 p-2',
    children: [
      {
        kind: 'box',
        className: 'flex items-center justify-between gap-3',
        children: [
          {
            kind: 'box',
            ref: 'fadeTriggerWrap',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-button',
                props: { variant: 'outline', size: 'sm' },
                children: ['Toggle Fade'],
              },
            ],
          },
          {
            kind: 'box',
            ref: 'fadeStatus',
            className: 'text-xs font-mono opacity-75',
            children: ['transitionState: entered'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'relative overflow-hidden rounded-xl border border-border p-5',
        children: [
          {
            kind: 'box',
            className: 'text-xs opacity-70',
            children: ['Underlying panel remains mounted; fade controls visual opacity only.'],
          },
          {
            kind: 'proto',
            ref: 'fadeOverlay',
            prototypeId: 'shadcn-surface-root',
            className: 'mt-3 block',
            surfaceStyle: { '--pui-surface-transition-duration': '240ms' },
            props: {
              variant: 'scrim',
              radius: 'md',
              border: 'none',
              fade: true,
              transitionState: 'entered',
            },
            children: [
              {
                kind: 'box',
                className: 'p-4 text-sm font-medium text-white',
                children: ['Transition-driven scrim surface (240ms)'],
              },
            ],
          },
        ],
      },
    ],
  },
  setup(ctx) {
    let visible = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const setPhase = (phase: 'entering' | 'entered' | 'leaving' | 'closed') => {
      ctx.api.setProps('fadeOverlay', { transitionState: phase });
      if (ctx.refs.fadeStatus) {
        ctx.refs.fadeStatus.textContent = `transitionState: ${phase}`;
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
    const trigger = ctx.refs.fadeTriggerWrap;
    trigger?.addEventListener('click', onToggle);
    return () => {
      if (timer) clearTimeout(timer);
      trigger?.removeEventListener('click', onToggle);
    };
  },
} satisfies DemoSpec);
