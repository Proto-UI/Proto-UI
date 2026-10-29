import {
  definePrototype,
  type RendererHandle,
  type SvgFactories,
  type TemplateChildren,
  tw,
} from '@proto.ui/core';
import { asDropdownTrigger } from '@proto.ui/prototypes-base/dropdown';
import type { ShadcnDropdownTriggerExposes, ShadcnDropdownTriggerProps } from './types';
import { SHADCN_STYLE_IDS } from '../style-scope';
import { setupMenuStyle } from './visual';
import {
  SHADCN_ACTION_RADIUS,
  SHADCN_ACTION_SIZES,
  SHADCN_ACTION_TEXT,
  SHADCN_ACTION_FOCUS,
  SHADCN_BUTTON_OUTLINE,
  SHADCN_BUTTON_OUTLINE_HOVER,
} from '../button/profiles';

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
  renderer: Pick<RendererHandle<ShadcnDropdownTriggerProps>, 'svg'>,
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

const dropdownTrigger = definePrototype<ShadcnDropdownTriggerProps, ShadcnDropdownTriggerExposes>({
  name: 'shadcn-dropdown-trigger',
  modules: asDropdownTrigger.modules,
  setup(def) {
    // P-SHADCN-DROPDOWN-MENU-TRIGGER-INDICATOR-EXTENSION
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

    // P-SHADCN-DROPDOWN-MENU-TRIGGER-BASE-INHERITANCE,
    // P-SHADCN-DROPDOWN-MENU-TRIGGER-CURRENT-BASE-DEVIATIONS
    const buttonState = asDropdownTrigger().stateHandles;
    if (!buttonState) {
      throw new Error('[shadcn-dropdown-trigger] Dropdown Trigger must project command states.');
    }
    const { disabled, hovered, focusVisible, pressed } = buttonState;
    const style = setupMenuStyle(def, 'nova');
    // Cataloged Proto extension: upstream Trigger is headless. Reuse only
    // finite outline paint, never asButton or another interaction owner.
    def.feedback.style.use(
      tw(
        'inline-flex items-center justify-center border outline-none select-none transition-colors'
      )
    );
    for (const id of SHADCN_STYLE_IDS) {
      const body =
        id === 'new-york-v4'
          ? 'h-9 gap-2 px-4 text-sm font-medium border-border bg-background shadow-xs'
          : `${SHADCN_ACTION_SIZES[`${id}-default`]} ${SHADCN_ACTION_TEXT[id]} ${SHADCN_BUTTON_OUTLINE[id]}`;
      def.rule({
        when: (w) => w.state(style).eq(id),
        intent: (i) => i.feedback.style.use(tw(SHADCN_ACTION_RADIUS[id], body)),
      });
      def.rule({
        when: (w) =>
          w.all(w.state(style).eq(id), w.any(w.state(hovered).eq(true), w.state(pressed).eq(true))),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              id === 'new-york-v4'
                ? 'bg-accent text-accent-foreground'
                : SHADCN_BUTTON_OUTLINE_HOVER[id]
            )
          ),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(id), w.state(focusVisible).eq(true)),
        intent: (i) => i.feedback.style.use(tw(SHADCN_ACTION_FOCUS[id])),
      });
    }

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

/** P-SHADCN-DROPDOWN-MENU-TRIGGER-DIRECT-ENTRY; parity is bounded by P-SHADCN-DROPDOWN-MENU-TRIGGER-COMPATIBILITY-SUBSET. */

export default dropdownTrigger;
