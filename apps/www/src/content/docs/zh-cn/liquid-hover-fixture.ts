import type {
  DemoChild,
  DemoNode,
  DemoRuntimeApi,
  DemoSpec,
} from '../../../components/PrototypePreviewer/demo-types';

/** Test application composition only. All interaction and material are the real prototypes. */
export const LIQUID_HOVER_PARTS = [
  'button',
  'toggle',
  'submit',
  'reset',
  'accordion',
  'collapsible',
  'select',
  'dropdown',
] as const;
export type LiquidHoverPart = (typeof LIQUID_HOVER_PARTS)[number];
export const LIQUID_HOVER_NEGATIVES = [
  'source-edge',
  'authored-before',
  'neighbor',
  'clipped-source',
] as const;
export type HoverRequest = { kind: string; detail: unknown };

export function liquidHoverDemo(
  part: LiquidHoverPart,
  capture: (api: DemoRuntimeApi) => void,
  requests: HoverRequest[],
  blocked = false
): DemoSpec {
  const atom = (
    name: string,
    ref: string,
    props: Record<string, unknown> = {},
    children: DemoChild[] = []
  ): DemoNode => ({ kind: 'proto', prototypeId: `liquid-glass-${name}`, ref, props, children });
  const slot: DemoNode = {
    kind: 'box',
    tag: 'span',
    attrs: { 'data-liquid-hover-slot': '' },
    children: [part === 'submit' ? 'Submit' : part === 'reset' ? 'Reset' : `Glass ${part}`],
  };
  // Layout is application-owned and transparent. The inset keeps the material's
  // expanded idle carrier away from the Accordion Item's actual painted border.
  const inset = (children: DemoChild[]): DemoNode => ({
    kind: 'box',
    className: 'liquid-hover-inset',
    children,
  });
  let root: DemoNode;
  if (part === 'button' || part === 'toggle')
    root = atom(part, 'subject', part === 'toggle' ? { active: false } : {}, [slot]);
  else if (part === 'submit' || part === 'reset')
    root = atom('form-root', 'owner', { ariaLabel: `Native ${part} evidence` }, [
      atom(`form-${part}`, 'subject', {}, [slot]),
    ]);
  else if (part === 'accordion')
    root = atom(
      'accordion-root',
      'owner',
      {
        openItems: blocked ? ['item'] : [],
        allowEmpty: !blocked,
      },
      [
        atom('accordion-item', 'item', { value: 'item' }, [
          atom('accordion-heading', 'heading', { level: 3 }, [
            inset([atom('accordion-trigger', 'subject', {}, [slot])]),
          ]),
          atom('accordion-content', 'content', {}, ['Owned accordion content']),
        ]),
      ]
    );
  else if (part === 'collapsible')
    root = atom('collapsible-root', 'owner', { open: false }, [
      atom('collapsible-trigger', 'subject', {}, [slot]),
      atom('collapsible-content', 'content', {}, ['Owned disclosure content']),
    ]);
  else if (part === 'select')
    root = atom('select-root', 'owner', { open: false, value: 'one' }, [
      atom('select-trigger', 'subject', {}, [slot]),
      atom('select-content', 'content', {}, [
        atom('select-surface', 'surface', {}, [
          atom('select-viewport', 'viewport', {}, [
            atom('select-item', 'option', { value: 'one', textValue: 'One' }, [
              atom('select-item-text', 'optionText', {}, ['One']),
            ]),
          ]),
        ]),
      ]),
    ]);
  else
    root = atom(`${part}-root`, 'owner', { open: false }, [
      atom(`${part}-trigger`, 'subject', {}, [slot]),
      atom(`${part}-content`, 'content', {}, [
        atom(`${part}-item`, 'option', { value: 'one', textValue: 'One' }, ['One']),
      ]),
    ]);
  return {
    type: 'demo',
    root: { kind: 'box', className: 'liquid-hover-layout', children: [root] },
    setup({ api }) {
      capture(api);
      const event =
        part === 'button'
          ? 'Click'
          : part === 'toggle'
            ? 'ActiveChange'
            : part === 'submit'
              ? 'Submit'
              : part === 'reset'
                ? 'Reset'
                : 'OpenChange';
      api.setProps(part === 'button' || part === 'toggle' ? 'subject' : 'owner', {
        [`on${event}`]: (detail: unknown) => requests.push({ kind: event, detail }),
      });
    },
  };
}

/** Withdraw a real authored key; an undefined patch is still a provided value. */
export function liquidHoverRemoveProp(api: DemoRuntimeApi, ref: string, name: string) {
  if (!api.removeProps) throw new Error('Hover fixture requires authored-prop withdrawal');
  api.removeProps(ref, [name]);
}

/** Test-only screenshot geometry, not material sampling or input geometry. */
export function liquidHoverContextCapture(
  subject: { x: number; y: number; width: number; height: number },
  viewport: { width: number; height: number },
  paintOutset = 0
) {
  if (
    ![...Object.values(subject), ...Object.values(viewport), paintOutset].every(Number.isFinite) ||
    subject.width <= 0 ||
    subject.height <= 0 ||
    viewport.width <= 0 ||
    viewport.height <= 0 ||
    paintOutset < 0
  )
    throw new Error('Invalid screenshot context geometry');
  const margin = Math.max(32, Math.ceil(paintOutset) + 16);
  const left = Math.max(0, Math.floor(subject.x - margin));
  const top = Math.max(0, Math.floor(subject.y - margin));
  const right = Math.min(viewport.width, Math.ceil(subject.x + subject.width + margin));
  const bottom = Math.min(viewport.height, Math.ceil(subject.y + subject.height + margin));
  if (right <= left || bottom <= top) throw new Error('Screenshot context is outside the viewport');
  return {
    margin,
    subject,
    viewport,
    clip: { x: left, y: top, width: right - left, height: bottom - top },
    fullyPadded:
      left <= subject.x - margin &&
      top <= subject.y - margin &&
      right >= subject.x + subject.width + margin &&
      bottom >= subject.y + subject.height + margin,
  };
}

/** Fail closed before test-only framing can move any input or material geometry. */
export function assertLiquidHoverContextReframeEligibility(state: {
  boundary: string;
  hovered: unknown;
  pressed: unknown;
  focused: unknown;
  focusVisible: unknown;
  contact: unknown;
  quality: unknown;
  carrier: unknown;
}): void {
  if (
    ![
      'idle',
      'policy-idle',
      'negative-idle',
      'collapse-blocked',
      'reenabled-subject',
      'reenabled-item',
      'reenabled-owner',
    ].includes(state.boundary) ||
    state.hovered !== false ||
    state.pressed !== false ||
    state.focused !== false ||
    state.focusVisible !== false ||
    !(
      state.contact === 'rest' ||
      (state.contact === null && state.quality === 'opaque-fallback' && state.carrier === null)
    )
  )
    throw new Error('Screenshot context reframe requires a verified idle boundary');
}

/**
 * Pure scrollBy delta for screenshot framing only; it does not scroll or assert
 * that the browser applied the plan. The caller must resample and check padding.
 */
export function liquidHoverContextReframe(
  context: ReturnType<typeof liquidHoverContextCapture>,
  state: Parameters<typeof assertLiquidHoverContextReframeEligibility>[0]
): { needed: boolean; delta: { x: number; y: number } } {
  if (context.fullyPadded) return { needed: false, delta: { x: 0, y: 0 } };
  assertLiquidHoverContextReframeEligibility(state);
  const { subject, viewport, margin } = context;
  if (subject.width + 2 * margin > viewport.width || subject.height + 2 * margin > viewport.height)
    throw new Error('Screenshot context cannot fit required padding in the viewport');
  return {
    needed: true,
    delta: {
      x:
        subject.x < margin || subject.x + subject.width + margin > viewport.width
          ? subject.x + subject.width / 2 - viewport.width / 2
          : 0,
      y:
        subject.y < margin || subject.y + subject.height + margin > viewport.height
          ? subject.y + subject.height / 2 - viewport.height / 2
          : 0,
    },
  };
}
