import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHiddenFirstActivation, isFirstActivationVisible } from './hidden-first-activation';

const releases: Array<() => void> = [];
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  for (const release of releases.splice(0)) release();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function fixture(onActivate?: (root: HTMLElement) => void) {
  const owner = document.createElement('section');
  owner.style.display = 'none';
  const roots = Array.from({ length: 4 }, () => document.createElement('div'));
  owner.append(...roots);
  document.body.append(owner);
  const activate = vi.fn(onActivate);
  const gate = createHiddenFirstActivation(document, activate);
  releases.push(() => gate.dispose());
  for (const root of roots) gate.add(root);
  return { owner, roots, activate, gate };
}

describe('first-activation pure-read batches', () => {
  it('stops at the hidden ancestor without computing styles for its descendants', () => {
    const { owner, roots } = fixture();
    const read = vi.spyOn(window, 'getComputedStyle');
    expect(isFirstActivationVisible(roots[0]!)).toBe(false);
    expect(read.mock.calls.some(([element]) => element === owner)).toBe(true);
    expect(read.mock.calls.some(([element]) => roots.some((root) => root === element))).toBe(false);
  });

  it('reads each shared ancestor once per real observer delivery while all roots stay hidden', async () => {
    const { owner, roots, activate } = fixture();
    await settle();
    const read = vi.spyOn(window, 'getComputedStyle');
    owner.style.color = 'red';
    await settle();
    expect(read.mock.calls.filter(([element]) => element === owner)).toHaveLength(1);
    expect(read.mock.calls.some(([element]) => roots.some((root) => root === element))).toBe(false);
    expect(activate).not.toHaveBeenCalled();

    read.mockClear();
    owner.style.color = 'blue';
    await settle();
    expect(read.mock.calls.filter(([element]) => element === owner)).toHaveLength(1);
    owner.style.display = 'block';
    await vi.waitFor(() => expect(activate).toHaveBeenCalledTimes(roots.length));
  });

  it('does not reuse pre-activation visibility after a callback hides later roots', async () => {
    const h = fixture((root) => {
      if (root === h.roots[0]) h.owner.style.display = 'none';
    });
    h.owner.style.display = 'block';
    await vi.waitFor(() => expect(h.activate).toHaveBeenCalledTimes(1));
    await settle();
    expect(h.activate.mock.calls.map(([root]) => root)).toEqual([h.roots[0]]);
    h.owner.style.display = 'block';
    await vi.waitFor(() => expect(h.activate).toHaveBeenCalledTimes(4));
  });

  it('rechecks connection and new pending roots after reentrant activation writes', async () => {
    const late = document.createElement('div');
    const h = fixture((root) => {
      if (root !== h.roots[0]) return;
      h.roots[1]!.remove();
      h.owner.style.display = 'none';
      h.owner.append(late);
      h.gate.add(late);
    });
    h.owner.style.display = 'block';
    await vi.waitFor(() => expect(h.activate).toHaveBeenCalledTimes(1));
    await settle();
    expect(h.activate.mock.calls.some(([root]) => root === h.roots[1])).toBe(false);
    expect(h.activate.mock.calls.some(([root]) => root === late)).toBe(false);
    h.owner.style.display = 'block';
    await vi.waitFor(() => expect(h.activate).toHaveBeenCalledTimes(4));
    expect(h.activate.mock.calls.some(([root]) => root === h.roots[1])).toBe(false);
    expect(h.activate.mock.calls.some(([root]) => root === late)).toBe(true);
  });

  it('resamples a fresh visibility batch on each resize frame', async () => {
    const h = fixture();
    let narrow = true;
    const getComputedStyle = window.getComputedStyle.bind(window);
    const read = vi
      .spyOn(window, 'getComputedStyle')
      .mockImplementation((element, pseudo) =>
        element === h.owner
          ? ({ display: narrow ? 'none' : 'block' } as CSSStyleDeclaration)
          : getComputedStyle(element, pseudo)
      );
    window.dispatchEvent(new Event('resize'));
    await vi.waitFor(() =>
      expect(read.mock.calls.filter(([element]) => element === h.owner)).toHaveLength(1)
    );
    expect(h.activate).not.toHaveBeenCalled();
    narrow = false;
    window.dispatchEvent(new Event('resize'));
    await vi.waitFor(() => expect(h.activate).toHaveBeenCalledTimes(4));
  });
});
