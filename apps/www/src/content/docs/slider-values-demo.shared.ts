import type {
  DemoNode,
  DemoChild,
  DemoSetupContext,
  DemoSpec,
} from '@/components/PrototypePreviewer/demo-types';

const exposeGet = (handle: unknown): unknown => {
  const h = handle as { get?: () => unknown; state?: { get?: () => unknown } } | undefined;
  return h?.get ? h.get() : h?.state?.get?.();
};

const display = (value: unknown): string =>
  Array.isArray(value) ? value.join(' – ') : value == null ? '—' : String(value);

/**
 * Slider Values is the additive multi-thumb draft: Root is the sole value and
 * logical-completion owner, each editable slot needs exactly one live Thumb,
 * Track is structural only, and there is no pointer drag session. The demo
 * composes all six parts with explicit indexed Thumbs and exercises the real
 * public methods (requestThumbValue, requestKeyboardValue, resetValue) plus
 * the union-valued valueChange/valueCommit events — never a faked pointer.
 */
export function createSliderValuesDemo(family: string): DemoSpec {
  const component = 'slider-values';
  const part = (
    role: 'root' | 'track' | 'thumb' | 'indicator' | 'label' | 'value',
    ref: string | undefined,
    props: Record<string, unknown>,
    children: DemoChild[] = []
  ): DemoNode => ({
    kind: 'proto',
    prototypeId: `${family}-${component}-${role}`,
    ...(ref ? { ref } : {}),
    props,
    children,
  });
  const thumb = (index: number, ariaLabel: string): DemoNode =>
    part('thumb', undefined, { index, ariaLabel });
  const button = (ref: string, label: string): DemoNode => ({
    kind: 'proto',
    prototypeId: `${family}-button`,
    ref,
    props: {},
    children: [label],
  });
  const readout = (label: string, ref: string, initial: string): DemoNode => ({
    kind: 'box',
    className: 'flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground',
    children: [label, { kind: 'box', ref, children: [initial] }],
  });
  return {
    type: 'demo',
    setup({ refs, api }: DemoSetupContext) {
      const renderRange = () => {
        if (refs.rangeDisplay)
          refs.rangeDisplay.textContent = display(api.call('range', 'getDisplayValue'));
        if (refs.rangeValues) {
          const values = exposeGet(api.getExposes('range')?.values);
          const active = exposeGet(api.getExposes('range')?.activeIndex);
          refs.rangeValues.textContent = `values=${display(values)} activeIndex=${String(active ?? -1)}`;
        }
      };
      const recordCommit = (event: { value: number | readonly number[] }) => {
        if (refs.commitLog) refs.commitLog.textContent = `commit ${display(event.value)}`;
        renderRange();
      };
      api.setProps('range', { onValueCommit: recordCommit });
      api.setProps('requestLow', {
        onClick: () => {
          api.call('range', 'requestThumbValue', 0, 15);
          renderRange();
        },
      });
      api.setProps('requestHigh', {
        onClick: () => {
          api.call('range', 'requestThumbValue', 1, 85);
          renderRange();
        },
      });
      api.setProps('nudgeThumb0', {
        onClick: () => {
          api.call('range', 'requestKeyboardValue', 0, 'ArrowRight');
          renderRange();
        },
      });
      api.setProps('nudgeThumb1', {
        onClick: () => {
          api.call('range', 'requestKeyboardValue', 1, 'ArrowLeft');
          renderRange();
        },
      });
      api.setProps('resetRange', {
        onClick: () => {
          api.call('range', 'resetValue');
          renderRange();
        },
      });
      const frame = requestAnimationFrame(renderRange);
      // Controlled root: the owner accepts every proposal by writing the
      // union-valued payload back through props. setProps patches, so the
      // callback persists without re-registration.
      api.setProps('controlled', {
        onValueChange: (event: { value: number | readonly number[] }) => {
          api.setProps('controlled', { value: event.value });
          if (refs.controlledDisplay)
            refs.controlledDisplay.textContent = display(event.value);
        },
      });
      return () => cancelAnimationFrame(frame);
    },
    root: {
      kind: 'box',
      className: 'grid w-full min-w-0 max-w-full gap-6 p-4',
      children: [
        part(
          'root',
          'range',
          {
            defaultValue: [20, 80],
            min: 0,
            max: 100,
            step: 5,
            minStepsBetweenValues: 1,
            ariaLabel: 'Price range · 价格范围',
          },
          [
            part('label', undefined, {}, ['Price range · 价格范围']),
            part('track', undefined, {}, [
              part('indicator', undefined, {}),
              thumb(0, 'Minimum price · 最低价格'),
              thumb(1, 'Maximum price · 最高价格'),
            ]),
            part('value', undefined, {}),
          ]
        ),
        {
          kind: 'box',
          className: 'flex flex-wrap gap-2',
          children: [
            button('requestLow', 'Thumb 0 → 15'),
            button('requestHigh', 'Thumb 1 → 85'),
            button('nudgeThumb0', 'Keyboard +1 step · 键盘加一档'),
            button('nudgeThumb1', 'Keyboard −1 step · 键盘减一档'),
            button('resetRange', 'Reset · 重置'),
          ],
        },
        readout('display:', 'rangeDisplay', '20 – 80'),
        readout('exposes:', 'rangeValues', 'values=20 – 80 activeIndex=-1'),
        {
          kind: 'box',
          ref: 'commitLog',
          className: 'min-h-5 font-mono text-xs text-muted-foreground',
          children: ['valueCommit events appear here · 提交事件显示在此'],
        },
        {
          kind: 'box',
          className: 'text-xs text-muted-foreground',
          children: [
            'Controlled owner accepts keyboard proposals · 受控所有者接受键盘提案',
          ],
        },
        part(
          'root',
          'controlled',
          {
            value: [30, 70],
            min: 0,
            max: 100,
            step: 10,
            thumbCollisionBehavior: 'none',
            ariaLabel: 'Controlled range · 受控范围',
          },
          [
            part('label', undefined, {}, ['Controlled range · 受控范围']),
            part('track', undefined, {}, [
              part('indicator', undefined, {}),
              thumb(0, 'Lower bound · 下界'),
              thumb(1, 'Upper bound · 上界'),
            ]),
            part('value', undefined, {}),
          ]
        ),
        readout('owner value:', 'controlledDisplay', '30 – 70'),
        {
          kind: 'box',
          className: 'text-xs text-muted-foreground',
          children: [
            'No pointer drag is simulated: Track stays structural and edits flow only through keyboard or the public request methods.',
          ],
        },
      ],
    },
  };
}
