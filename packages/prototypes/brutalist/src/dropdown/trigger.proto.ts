import {
  definePrototype,
  type RendererHandle,
  type SvgFactories,
  type TemplateChildren,
  tw,
} from '@proto.ui/core';
import { asDropdownTrigger } from '@proto.ui/prototypes-base/dropdown';
import type { BrutalistDropdownTriggerExposes, BrutalistDropdownTriggerProps } from './types';

const TRIGGER_BASE_TOKENS = [
  'inline-flex',
  'items-center',
  'justify-center',
  'gap-2',
  'rounded-none',
  'border-2',
  'border-black',
  'bg-main',
  'px-3',
  'py-1.5',
  'font-bold',
  'uppercase',
  'text-main-foreground',
  'shadow-[3px_3px_0_0_#000]',
  'outline-none',
  'select-none',
].join(' ');

const DEFAULT_INDICATOR_ICON = 'chevron-down';
const DEFAULT_INDICATOR_SIZE = 16;
const DEFAULT_INDICATOR_STROKE_WIDTH = 2;

type IndicatorIconShape = (svg: SvgFactories) => TemplateChildren;

const INDICATOR_ICON_SHAPES: Record<'chevron-down' | 'chevrons-up-down', IndicatorIconShape> = {
  'chevron-down': (svg) => svg.path({ d: 'm6 9 6 6 6-6' }),
  'chevrons-up-down': (svg) => [svg.path({ d: 'm7 15 5 5 5-5' }), svg.path({ d: 'm7 9 5-5 5 5' })],
};

function toPositiveNumber(value: unknown, fallback: number): number {
  if (typeof value !== 'number') return fallback;
  if (!Number.isFinite(value)) return fallback;
  if (value <= 0) return fallback;
  return value;
}

function renderIndicatorIcon(
  renderer: Pick<RendererHandle<any>, 'svg'>,
  options: {
    icon: 'chevron-down' | 'chevrons-up-down';
    size: number;
    strokeWidth: number;
  }
) {
  return renderer.svg.root(
    {
      viewBox: '0 0 24 24',
      width: options.size,
      height: options.size,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: options.strokeWidth,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },
    INDICATOR_ICON_SHAPES[options.icon](renderer.svg)
  );
}

const dropdownTrigger = definePrototype<
  BrutalistDropdownTriggerProps,
  BrutalistDropdownTriggerExposes
>({
  name: 'brutalist-dropdown-trigger',
  setup(def) {
    // P-BRUTALIST-DROPDOWN-MENU-TRIGGER-INDICATOR-PROP
    def.props.define({
      disabled: { type: 'boolean', empty: 'fallback' },
      indicator: { type: 'boolean', empty: 'fallback' },
      indicatorIcon: {
        type: 'enum',
        empty: 'fallback',
        options: ['chevron-down', 'chevrons-up-down'],
      },
      indicatorSize: { type: 'number', empty: 'fallback' },
      indicatorStrokeWidth: { type: 'number', empty: 'fallback' },
    });
    def.props.setDefaults({
      disabled: false,
      indicator: false,
      indicatorIcon: DEFAULT_INDICATOR_ICON,
      indicatorSize: DEFAULT_INDICATOR_SIZE,
      indicatorStrokeWidth: DEFAULT_INDICATOR_STROKE_WIDTH,
    });

    // P-BRUTALIST-DROPDOWN-MENU-TRIGGER-BASE-INHERITANCE
    const buttonState = asDropdownTrigger().stateHandles;
    if (!buttonState) {
      throw new Error('[brutalist-dropdown-trigger] Dropdown Trigger must project command states.');
    }
    const { disabled, hovered, focusVisible, pressed } = buttonState;

    // P-BRUTALIST-DROPDOWN-MENU-TRIGGER-PAIR-INVARIANT,
    // P-BRUTALIST-DROPDOWN-MENU-TRIGGER-VISUAL-GRAMMAR
    def.feedback.style.use(tw(TRIGGER_BASE_TOKENS));

    // P-BRUTALIST-DROPDOWN-MENU-TRIGGER-INTERACTION
    def.rule({
      when: (w) => w.state(hovered).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('-translate-x-px -translate-y-px shadow-[4px_4px_0_0_#000]')),
    });

    def.rule({
      when: (w) => w.state(pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw('translate-x-px translate-y-px shadow-none')),
    });

    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('outline-none ring-2 ring-ring ring-offset-2 ring-offset-background')
        ),
    });

    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
    });

    return (renderer) => {
      const props = renderer.read.props.get();
      const indicatorEnabled = props.indicator !== false;
      const indicatorIcon =
        props.indicatorIcon === 'chevrons-up-down' ? props.indicatorIcon : DEFAULT_INDICATOR_ICON;
      const indicatorSize = toPositiveNumber(props.indicatorSize, DEFAULT_INDICATOR_SIZE);
      const indicatorStrokeWidth = toPositiveNumber(
        props.indicatorStrokeWidth,
        DEFAULT_INDICATOR_STROKE_WIDTH
      );

      return [
        renderer.r.slot(),
        indicatorEnabled
          ? renderIndicatorIcon(renderer, {
              icon: indicatorIcon,
              size: indicatorSize,
              strokeWidth: indicatorStrokeWidth,
            })
          : null,
      ];
    };
  },
});

/** P-BRUTALIST-DROPDOWN-MENU-TRIGGER-ENTRY */

export default dropdownTrigger;
