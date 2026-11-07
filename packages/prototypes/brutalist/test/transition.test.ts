import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import transition, { transition as namedTransition, brutalistTransition } from '../src/transition';
import type { BrutalistTransitionExposes, BrutalistTransitionProps } from '../src/transition';
import * as BrutalistPackage from '../src';
import * as TransitionEntry from '../src/transition';

type ExposingElement = HTMLElement & { getExposes(): Record<string, any> };

// Flat/fade boundary: endpoint opacity is the whole family motion vocabulary.
const FORBIDDEN_MOTION_TOKENS = [
  'animate-in',
  'animate-out',
  'zoom-in-95',
  'zoom-out-95',
  'fade-in-0',
  'fade-out-0',
  'transition-all',
  'transition-transform',
  'transition-opacity',
];

AdaptToWebComponent(transition as any);

async function settle(): Promise<void> {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
}

async function waitFor(assertion: () => void): Promise<void> {
  await vi.waitFor(assertion, { timeout: 3000 });
}

async function mount(props: Record<string, unknown> = {}) {
  const element = document.createElement(transition.name) as ExposingElement;
  const card = document.createElement('div');
  card.id = 'authored-content';
  card.textContent = 'Presence';
  element.appendChild(card);
  setElementProps(element, props as any);
  document.body.appendChild(element);
  await settle();
  return { element, card };
}

function mockReducedMotion(matchesReduce: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: matchesReduce && query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        onchange: null,
        dispatchEvent: () => true,
      }) as MediaQueryList
  );
}

function noMotionTokens(element: Element) {
  for (const token of FORBIDDEN_MOTION_TOKENS) {
    expect(styleContains(element, token), token).toBe(false);
  }
}

afterEach(async () => {
  document.body.replaceChildren();
  await settle();
  vi.restoreAllMocks();
});

describe('prototypes/brutalist: transition', () => {
  it('exports exactly the admitted Transition value and Base types through family and package entries', () => {
    expect(namedTransition).toBe(transition);
    expect(brutalistTransition).toBe(transition);
    expect(transition.name).toBe('brutalist-transition');
    // One authored entry; no second semantic owner or cross-family alias.
    expect(Object.keys(TransitionEntry).sort()).toEqual([
      'brutalistTransition',
      'default',
      'transition',
    ]);
    const packageValues = new Map(Object.entries(BrutalistPackage));
    expect(packageValues.get('brutalistTransition')).toBe(transition);
    expect(packageValues.get('transition')).toBe(transition);
    expectTypeOf<BrutalistTransitionProps['open']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<keyof BrutalistTransitionExposes>().not.toEqualTypeOf<never>();
  });

  it('keeps the Base phase machine: appears, enters, leaves, and completes through real controls', async () => {
    const { element, card } = await mount({ defaultOpen: true, appear: true });

    const exposes = element.getExposes();
    expect(exposes.isPresent.get()).toBe(true);
    await waitFor(() => {
      expect(['entering', 'entered']).toContain(exposes.transitionState.get());
    });
    await waitFor(() => {
      expect(exposes.transitionState.get()).toBe('entered');
    });
    expect(element.querySelector('#authored-content')).toBe(card);
    expect(styleContains(element, 'opacity-100')).toBe(true);
    noMotionTokens(element);

    exposes.controls.leave();
    await waitFor(() => {
      expect(exposes.transitionState.get()).toBe('closed');
    });
    expect(exposes.isPresent.get()).toBe(false);
    // Closed withdraws the view and its style intents; the endpoint opacity-0
    // was observable during leaving, and no motion tokens ever appear.
    expect(element.getAttribute('data-pui-style')).toBe(null);

    exposes.controls.enter();
    await waitFor(() => {
      expect(exposes.transitionState.get()).toBe('entering');
    });
    expect(styleContains(element, 'opacity-100')).toBe(true);
    noMotionTokens(element);
    // Complete advances a live attempt without a second owner.
    exposes.controls.complete();
    await waitFor(() => {
      expect(exposes.transitionState.get()).toBe('entered');
    });
    expect(element.querySelector('#authored-content')).toBe(card);
  });

  it('emits the Base phase events and stays a transparent host without semantic roles', async () => {
    const { element } = await mount();
    const seen: string[] = [];
    for (const name of ['beforeEnter', 'afterEnter', 'beforeLeave', 'afterLeave']) {
      element.addEventListener(name, () => seen.push(name));
    }

    const exposes = element.getExposes();
    exposes.controls.enter();
    await waitFor(() => {
      expect(exposes.transitionState.get()).toBe('entered');
    });
    exposes.controls.leave();
    await waitFor(() => {
      expect(exposes.transitionState.get()).toBe('leaving');
    });
    // Endpoint fade-out is visible while the view is still present.
    expect(exposes.isPresent.get()).toBe(true);
    expect(styleContains(element, 'opacity-0')).toBe(true);
    noMotionTokens(element);
    await waitFor(() => {
      expect(exposes.transitionState.get()).toBe('closed');
    });

    expect(seen).toEqual(
      expect.arrayContaining(['beforeEnter', 'afterEnter', 'beforeLeave', 'afterLeave'])
    );
    expect(element.hasAttribute('role')).toBe(false);
  });

  it('collapses phase durations under reduced motion without inventing replacement motion', async () => {
    mockReducedMotion(true);
    const { element } = await mount({ defaultOpen: true, appear: true });
    const exposes = element.getExposes();

    await waitFor(() => {
      expect(exposes.transitionState.get()).toBe('entered');
    });
    exposes.controls.leave();
    // Zero-duration scheduling still drives beforeLeave → leaving → closed.
    await waitFor(() => {
      expect(exposes.transitionState.get()).toBe('closed');
    });
    expect(exposes.isPresent.get()).toBe(false);
    expect(element.getAttribute('data-pui-style')).toBe(null);
  });

  it('keeps controlled open authoritative and preserves child identity across attempts', async () => {
    const { element, card } = await mount({ open: true });
    const exposes = element.getExposes();
    await waitFor(() => {
      expect(exposes.transitionState.get()).toBe('entered');
    });

    setElementProps(element, { open: false } as any);
    await waitFor(() => {
      expect(exposes.transitionState.get()).toBe('closed');
    });

    setElementProps(element, { open: true } as any);
    await waitFor(() => {
      expect(exposes.transitionState.get()).toBe('entered');
    });
    expect(element.querySelector('#authored-content')).toBe(card);
  });
});
