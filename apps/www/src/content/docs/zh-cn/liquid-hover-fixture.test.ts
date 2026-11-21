import { describe, expect, it, vi } from 'vitest';
import {
  assertDemoSpec,
  type DemoNode,
  type DemoRuntimeApi,
} from '../../../components/PrototypePreviewer/demo-types';
import {
  LIQUID_HOVER_PARTS,
  LIQUID_HOVER_NEGATIVES,
  isLiquidHoverContactBoundaryFallback,
  liquidHoverDemo,
  liquidHoverContextCapture,
  assertLiquidHoverContextReframeEligibility,
  liquidHoverContextReframe,
  liquidHoverRemoveProp,
  type HoverRequest,
} from './liquid-hover-fixture';

function walk(
  node: DemoNode,
  ancestry: string[] = []
): Array<{ node: DemoNode; ancestry: string[] }> {
  const next = node.kind === 'proto' ? [...ancestry, node.prototypeId] : ancestry;
  return [
    { node, ancestry },
    ...('children' in node ? (node.children ?? []) : []).flatMap((child) =>
      typeof child === 'string' ? [] : walk(child, next)
    ),
  ];
}
describe('Liquid hover first-party fixture composition (source only)', () => {
  it('keeps the eight-part slice and explicit carrier-negative controls', () => {
    expect(LIQUID_HOVER_PARTS).toEqual([
      'button',
      'toggle',
      'submit',
      'reset',
      'accordion',
      'collapsible',
      'select',
      'dropdown',
    ]);
    expect(LIQUID_HOVER_NEGATIVES).toEqual([
      'source-edge',
      'authored-before',
      'neighbor',
      'clipped-source',
    ]);
  });
  for (const part of LIQUID_HOVER_PARTS)
    it(`${part}: one real subject with required ancestry and outward requests only`, () => {
      const capture = vi.fn();
      const setProps = vi.fn();
      const requests: HoverRequest[] = [];
      const api: DemoRuntimeApi = { call: vi.fn(), getExposes: vi.fn(), setProps };
      const demo = liquidHoverDemo(part, capture, requests);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const nodes = walk(demo.root);
      const targets = nodes.filter(({ node }) => node.kind === 'proto' && node.ref === 'subject');
      expect(targets).toHaveLength(1);
      const { node, ancestry } = targets[0];
      expect(node.kind === 'proto' && node.prototypeId).toBe(
        `liquid-glass-${part === 'button' || part === 'toggle' ? part : part === 'submit' || part === 'reset' ? `form-${part}` : `${part}-trigger`}`
      );
      expect(ancestry).toEqual(
        part === 'button' || part === 'toggle'
          ? []
          : part === 'submit' || part === 'reset'
            ? ['liquid-glass-form-root']
            : part === 'accordion'
              ? [
                  'liquid-glass-accordion-root',
                  'liquid-glass-accordion-item',
                  'liquid-glass-accordion-heading',
                ]
              : [`liquid-glass-${part}-root`]
      );
      expect(
        nodes.filter(
          ({ node }) => node.kind === 'box' && node.attrs?.['data-liquid-hover-slot'] === ''
        )
      ).toHaveLength(1);
      demo.setup!({ api, refs: {}, host: {} as HTMLElement });
      expect(capture).toHaveBeenCalledWith(api);
      expect(setProps).toHaveBeenCalledTimes(1);
      const [ref, patch] = setProps.mock.calls[0];
      expect(ref).toBe(part === 'button' || part === 'toggle' ? 'subject' : 'owner');
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
      expect(Object.keys(patch)).toEqual([`on${event}`]);
      patch[`on${event}`]({ value: 'observed' });
      expect(requests).toEqual([{ kind: event, detail: { value: 'observed' } }]);
      expect(api.call).not.toHaveBeenCalled();
      expect(api.getExposes).not.toHaveBeenCalled();
    });
  it('models Accordion collapseBlocked through real Root policy, never a trigger stub', () => {
    const demo = liquidHoverDemo('accordion', () => {}, [], true);
    const owner = walk(demo.root).find(
      ({ node }) => node.kind === 'proto' && node.ref === 'owner'
    )!.node;
    expect(owner.kind === 'proto' && owner.props).toEqual({
      openItems: ['item'],
      allowEmpty: false,
    });
  });
});

describe('native screenshot context retains outer visual evidence', () => {
  const viewport = { width: 800, height: 600 };
  it('keeps at least 32 CSS pixels around a normal subject', () => {
    const result = liquidHoverContextCapture({ x: 100, y: 100, width: 160, height: 48 }, viewport);
    expect(result.clip).toEqual({ x: 68, y: 68, width: 224, height: 112 });
    expect(result.fullyPadded).toBe(true);
  });
  it('includes the expanded material footprint and reports viewport clipping honestly', () => {
    const result = liquidHoverContextCapture(
      { x: 20, y: 100, width: 160, height: 48 },
      viewport,
      30
    );
    expect(result.margin).toBe(46);
    expect(result.clip).toEqual({ x: 0, y: 54, width: 226, height: 140 });
    expect(result.fullyPadded).toBe(false);
  });
  it('rejects empty and nonfinite evidence rectangles', () => {
    expect(() =>
      liquidHoverContextCapture({ x: 900, y: 100, width: 100, height: 48 }, viewport)
    ).toThrow('outside');
    expect(() =>
      liquidHoverContextCapture({ x: 100, y: 100, width: NaN, height: 48 }, viewport)
    ).toThrow('Invalid');
  });
});

describe('pure screenshot context reframe planning', () => {
  const viewport = { width: 800, height: 600 };
  const idle = {
    boundary: 'policy-idle',
    hovered: false,
    pressed: false,
    focused: false,
    focusVisible: false,
    contact: 'rest',
    quality: 'self-optical',
    carrier: { marker: 'contact-v1' },
  };
  const clipped = () =>
    liquidHoverContextCapture({ x: 200, y: 20, width: 160, height: 48 }, viewport, 30);

  it.each([
    {
      part: 'Accordion',
      subject: { x: 249, y: 0.28125, width: 334, height: 50 },
      outset: 28,
      margin: 44,
      deltaY: -524.71875,
    },
    {
      part: 'Collapsible',
      subject: { x: 800, y: 0.28125, width: 416, height: 46 },
      outset: 35,
      margin: 51,
      deltaY: -526.71875,
    },
  ])('$part: preserves the recorded top-edge failure and plans full padding', (sample) => {
    // Recorded native geometry; this is mathematical framing evidence, not a browser rerun.
    const original = liquidHoverContextCapture(
      sample.subject,
      { width: 1440, height: 1100 },
      sample.outset
    );
    expect(original.margin).toBe(sample.margin);
    expect(original.fullyPadded).toBe(false);
    const plan = liquidHoverContextReframe(original, idle);
    expect(plan).toEqual({ needed: true, delta: { x: 0, y: sample.deltaY } });
    const framed = liquidHoverContextCapture(
      {
        ...sample.subject,
        x: sample.subject.x - plan.delta.x,
        y: sample.subject.y - plan.delta.y,
      },
      original.viewport,
      sample.outset
    );
    expect(framed.margin).toBe(sample.margin);
    expect(framed.fullyPadded).toBe(true);
    expect(original.fullyPadded).toBe(false);
  });

  it.each([
    { edge: 'top', x: 200, y: 20, delta: { x: 0, y: -256 } },
    { edge: 'bottom', x: 200, y: 550, delta: { x: 0, y: 274 } },
    { edge: 'left', x: 20, y: 200, delta: { x: -300, y: 0 } },
    { edge: 'right', x: 620, y: 200, delta: { x: 300, y: 0 } },
    { edge: 'top-left', x: 20, y: 20, delta: { x: -300, y: -256 } },
  ])('centers only the insufficiently padded axes at the $edge edge', ({ x, y, delta }) => {
    const subject = { x, y, width: 160, height: 48 };
    const original = liquidHoverContextCapture(subject, viewport, 30);
    expect(original.fullyPadded).toBe(false);
    const plan = liquidHoverContextReframe(original, idle);
    expect(plan).toEqual({ needed: true, delta });
    const framed = liquidHoverContextCapture(
      { ...subject, x: x - plan.delta.x, y: y - plan.delta.y },
      viewport,
      30
    );
    expect(framed.margin).toBe(46);
    expect(framed.fullyPadded).toBe(true);
  });

  it('does not move, mutate, or require an input-state observation when already padded', () => {
    const subject = Object.freeze({ x: 200, y: 200, width: 160, height: 48 });
    const context = Object.freeze(liquidHoverContextCapture(subject, viewport, 30));
    const unobserved = new Proxy({} as Parameters<typeof liquidHoverContextReframe>[1], {
      get() {
        throw new Error('A no-op must not read or invent input state');
      },
    });
    expect(liquidHoverContextReframe(context, unobserved)).toEqual({
      needed: false,
      delta: { x: 0, y: 0 },
    });
    expect(context.subject).toBe(subject);
    expect(subject).toEqual({ x: 200, y: 200, width: 160, height: 48 });
  });

  it('accepts an exact fit without reducing the required margin', () => {
    const subject = { x: 40, y: 40, width: 708, height: 508 };
    const context = liquidHoverContextCapture(subject, viewport, 30);
    const plan = liquidHoverContextReframe(context, idle);
    expect(context.fullyPadded).toBe(false);
    expect(plan).toEqual({ needed: true, delta: { x: -6, y: -6 } });
    const framed = liquidHoverContextCapture(
      { ...subject, x: subject.x - plan.delta.x, y: subject.y - plan.delta.y },
      viewport,
      30
    );
    expect(framed.margin).toBe(46);
    expect(framed.fullyPadded).toBe(true);
  });

  it.each([
    { width: 709, height: 48 },
    { width: 160, height: 509 },
  ])('rejects an impossible padded viewport for $width x $height', (size) => {
    const context = liquidHoverContextCapture({ x: 0, y: 0, ...size }, viewport, 30);
    expect(context.fullyPadded).toBe(false);
    expect(() => liquidHoverContextReframe(context, idle)).toThrow('cannot fit required padding');
    expect(context.margin).toBe(46);
  });

  const idleBoundaries = [
    'idle',
    'policy-idle',
    'negative-idle',
    'collapse-blocked',
    'reenabled-subject',
    'reenabled-item',
    'reenabled-owner',
  ];
  it.each(idleBoundaries)('allows the verified resting state at %s', (boundary) => {
    const state = { ...idle, boundary };
    expect(() => assertLiquidHoverContextReframeEligibility(state)).not.toThrow();
    expect(liquidHoverContextReframe(clipped(), state).needed).toBe(true);
  });

  it.each(idleBoundaries)('allows verified no-carrier opaque fallback at %s', (boundary) => {
    const state = {
      ...idle,
      boundary,
      contact: null,
      quality: 'opaque-fallback',
      carrier: null,
    };
    expect(() => assertLiquidHoverContextReframeEligibility(state)).not.toThrow();
    expect(liquidHoverContextReframe(clipped(), state).needed).toBe(true);
  });

  it.each([
    { quality: 'self-optical', carrier: null },
    { quality: 'unknown', carrier: null },
    { quality: undefined, carrier: null },
    { quality: null, carrier: null },
    { quality: 'opaque-fallback', carrier: undefined },
    { quality: 'opaque-fallback', carrier: false },
    { quality: 'opaque-fallback', carrier: { marker: 'contact-v1' } },
  ])('rejects null contact without a verified no-carrier fallback: %j', (observation) => {
    const state = { ...idle, contact: null, ...observation };
    expect(() => assertLiquidHoverContextReframeEligibility(state)).toThrow('verified idle');
    expect(() => liquidHoverContextReframe(clipped(), state)).toThrow('verified idle');
  });

  it.each(['active', 'held', 'drag', 'dragging', undefined])(
    'never infers rest from opaque fallback when contact is %j',
    (contact) => {
      const state = { ...idle, contact, quality: 'opaque-fallback', carrier: null };
      expect(() => assertLiquidHoverContextReframeEligibility(state)).toThrow('verified idle');
      expect(() => liquidHoverContextReframe(clipped(), state)).toThrow('verified idle');
    }
  );

  it.each([
    '',
    'hover',
    'down',
    'held',
    'held-leave',
    'held-reenter',
    'drag',
    'focus-visible',
    'source-restored',
    'disabled-subject',
    'reenabled-heading',
    'reenabled-subject-extra',
    'policy-idle-extra',
    'idle ',
    'unknown',
  ])('rejects an ineligible or unknown boundary %j even if states appear idle', (boundary) => {
    const state = { ...idle, boundary };
    expect(() => assertLiquidHoverContextReframeEligibility(state)).toThrow('verified idle');
    expect(() => liquidHoverContextReframe(clipped(), state)).toThrow('verified idle');
  });

  for (const field of ['hovered', 'pressed', 'focused', 'focusVisible'] as const)
    it.each([true, undefined, null, 0, '', 'false'])(
      `rejects ${field}=%j rather than treating it as an observed false`,
      (value) => {
        const state = { ...idle, [field]: value };
        expect(() => assertLiquidHoverContextReframeEligibility(state)).toThrow('verified idle');
        expect(() => liquidHoverContextReframe(clipped(), state)).toThrow('verified idle');
      }
    );

  it.each(['active', 'held', 'drag', 'dragging', 'settling', 'unknown', undefined, null, false])(
    'rejects non-rest or unobserved contact %j',
    (contact) => {
      const state = { ...idle, contact };
      expect(() => assertLiquidHoverContextReframeEligibility(state)).toThrow('verified idle');
      expect(() => liquidHoverContextReframe(clipped(), state)).toThrow('verified idle');
    }
  );
});

describe('hover fixture authored-prop withdrawal', () => {
  it('requests deletion through the preview capability without an undefined patch', () => {
    const api: DemoRuntimeApi = {
      call: vi.fn(),
      getExposes: vi.fn(),
      setProps: vi.fn(),
      removeProps: vi.fn(),
    };
    liquidHoverRemoveProp(api, 'subject', 'disabled');
    expect(api.removeProps).toHaveBeenCalledWith('subject', ['disabled']);
    expect(api.setProps).not.toHaveBeenCalled();
  });
  it('fails explicitly when an external preview API lacks the capability', () => {
    const api: DemoRuntimeApi = { call: vi.fn(), getExposes: vi.fn(), setProps: vi.fn() };
    expect(() => liquidHoverRemoveProp(api, 'subject', 'material')).toThrow(
      'authored-prop withdrawal'
    );
    expect(api.setProps).not.toHaveBeenCalled();
  });
});

describe('full contact footprint keeps specific source guards blocking', () => {
  it.each([
    ['source-edge', 'source-bounds-unavailable'],
    ['neighbor', 'source-overlapping-content'],
    ['accordion-tight', 'source-overlapping-content'],
  ])('%s accepts only its actual opaque fallback reason', (part, reason) => {
    expect(isLiquidHoverContactBoundaryFallback(part, { quality: 'opaque-fallback', reason })).toBe(
      true
    );
    for (const quality of ['self-optical', 'none', undefined])
      expect(isLiquidHoverContactBoundaryFallback(part, { quality, reason })).toBe(false);
    for (const wrongReason of [
      'rendered',
      'source-lost',
      'source-bounds-unavailable',
      'source-overlapping-content',
      undefined,
    ]) {
      if (wrongReason === reason) continue;
      expect(
        isLiquidHoverContactBoundaryFallback(part, {
          quality: 'opaque-fallback',
          reason: wrongReason,
        })
      ).toBe(false);
    }
  });
  it.each(['button', 'authored-before', 'clipped-source', 'neighbor-extra', ''])(
    'does not broaden the finite three-part contract to %j',
    (part) => {
      expect(
        isLiquidHoverContactBoundaryFallback(part, {
          quality: 'opaque-fallback',
          reason: 'source-overlapping-content',
        })
      ).toBe(false);
    }
  );
});
