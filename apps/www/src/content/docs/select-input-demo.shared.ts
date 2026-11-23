import type { DemoNode, DemoSpec } from '../../components/PrototypePreviewer/demo-types';

/** A normal scrollable Select recipe. Pointer facts and focus/value arbitration
 * stay in the public Select protocol; the consumer only chooses owner policy. */
export function createSelectInputDemo(family: string): DemoSpec {
  type Proto = Extract<DemoNode, { kind: 'proto' }>;
  const part = (
    name: string,
    ref: string,
    props: Record<string, unknown> = {},
    children: Proto['children'] = []
  ): Proto => ({
    kind: 'proto',
    prototypeId: `${family}-select-${name}`,
    ref,
    props,
    children,
    ...(family === 'base'
      ? {
          className:
            name === 'trigger'
              ? 'inline-flex w-64 items-center rounded border bg-background px-3 py-2'
              : name === 'item'
                ? 'block rounded px-3 py-2 outline-none'
                : 'block',
        }
      : {}),
  });
  const values = [
    'alpha',
    'beta',
    'gamma',
    'disabled',
    ...Array.from({ length: 14 }, (_, index) => `option-${index + 5}`),
  ];
  const items = values.map((value, index) =>
    part(
      'item',
      `item${index}`,
      { value, textValue: value, disabled: index === 3 },
      family === 'brutalist' ? [value] : [part('item-text', `text${index}`, {}, [value])]
    )
  );
  const viewport = part('viewport', 'selectViewport', {}, items);
  viewport.surfaceStyle = { maxHeight: '180px', overflowY: 'auto', touchAction: 'pan-y' };
  const content = part(
    'content',
    'selectContent',
    { position: 'popper', align: 'start' },
    family === 'brutalist' ? items : [part('surface', 'selectSurface', {}, [viewport])]
  );
  content.surfaceStyle = {
    width: '280px',
    ...(family === 'brutalist'
      ? { maxHeight: '180px', overflowY: 'auto', touchAction: 'pan-y' }
      : {}),
  };
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'grid gap-4 p-4',
      children: [
        {
          kind: 'box',
          className: 'text-sm text-muted-foreground',
          children: [
            'Move the mouse after keyboard navigation; touch-scroll the popup, close it and reopen. Focus may move without changing the selected value. · 键盘导航后移动鼠标，也可触摸滚动、关闭后重开；焦点移动不等于选择值改变。',
          ],
        },
        part('root', 'select', { defaultValue: 'alpha' }, [
          part('trigger', 'selectTrigger', {}, [part('value', 'selectValue')]),
          content,
        ]),
        {
          kind: 'proto',
          prototypeId: `${family}-button`,
          ref: 'toggleRefusal',
          children: ['Toggle controlled refusal · 切换受控拒绝'],
          ...(family === 'base' ? { className: 'w-fit rounded border px-3 py-2' } : {}),
        },
        {
          kind: 'box',
          ref: 'selectPolicy',
          className: 'font-mono text-xs',
          children: ['owner=uncontrolled value=alpha'],
        },
        {
          kind: 'box',
          ref: 'selectRequests',
          className: 'font-mono text-xs',
          children: ['No value proposal · 尚无值提案'],
        },
      ],
    },
    setup({ api, refs }) {
      let alive = true,
        refuses = false,
        proposals = 0;
      api.setProps('select', {
        onValueChange: (event: { value: string }) => {
          if (!alive) return;
          refs.selectRequests.textContent = `proposals=${++proposals} requested=${event.value}`;
          refs.selectPolicy.textContent = `owner=${refuses ? 'controlled-refusal' : 'uncontrolled'} value=${api.call('select', 'value.get')}`;
        },
      });
      api.setProps('toggleRefusal', {
        onClick: () => {
          if (!alive) return;
          refuses = !refuses;
          if (refuses) api.setProps('select', { value: api.call('select', 'value.get') });
          else api.removeProps?.('select', ['value']);
          refs.selectPolicy.textContent = `owner=${refuses ? 'controlled-refusal' : 'uncontrolled'} value=${api.call('select', 'value.get')}`;
        },
      });
      return () => {
        alive = false;
      };
    },
  };
}
