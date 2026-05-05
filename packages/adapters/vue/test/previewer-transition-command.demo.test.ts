import { describe, expect, it, vi } from 'vitest';
import { VueAny } from './utils/vue';

import { loadPrototypes } from '../../../../apps/www/src/components/PrototypePreviewer/prototype-modules';
import commandDemo from '../../../../apps/www/src/content/docs/zh-cn/demo-base-transition-command.demo';

vi.mock('../../../../apps/www/src/components/PrototypePreviewer/runtimes/vue-runtime', () => ({
  loadVue: vi.fn(async () => VueAny),
}));

async function flushFrames(times = 2) {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  await Promise.resolve();
}

function clickRef(host: HTMLElement, ref: string) {
  const el = host.querySelector(`[data-demo-ref="${ref}"]`) as HTMLElement | null;
  expect(el).not.toBeNull();
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

// Source of truth is the prototype's reflected attribute, not the demo's
// stateLabel textContent. The demo updates the label through a
// MutationObserver subscribed to `data-transition-state` changes, but
// happy-dom's MutationObserver callback dispatch isn't reliably aligned
// with rAF/microtask flushes — under load we routinely observed the
// attribute already at the new state while the label was still stale,
// which made the previous label-based assertion flake at ~40-50% locally.
// Reading the attribute directly tests the state machine itself, which is
// what this test cares about; the demo-renderer's label binding has its
// own coverage in the previewer/demo-renderer tests.
function getTransitionState(host: HTMLElement) {
  const el = host.querySelector('[data-transition-state]') as HTMLElement | null;
  return el?.getAttribute('data-transition-state') ?? '';
}

// Poll until the prototype reaches `target`, then return the current state
// for the caller's expect(). The earlier version drove every transition step
// with a fixed `flushFrames(3)` and a direct equality check, which was racy:
// every Vue→presence→adapter step takes a variable number of rAFs, so a
// single fixed wait flaked at ~40% locally with failures spread across all
// four assertions, matching different micro-task vs rAF interleavings rather
// than a single broken step. All four labels we wait for ('entered',
// 'leaving', 'closed', 'entering') are stable in command mode (no
// auto-advance), so polling can only end on the target — it cannot overshoot
// to a later state.
async function waitForState(host: HTMLElement, target: string, maxFrames = 32) {
  for (let i = 0; i < maxFrames && getTransitionState(host) !== target; i++) {
    await flushFrames(1);
  }
  return getTransitionState(host);
}

describe('PrototypePreviewer demo-renderer / vue command transition', () => {
  it('re-enters from closed with one Enter click', async () => {
    await loadPrototypes(['base-transition']);

    const { renderDemo } =
      await import('../../../../apps/www/src/components/PrototypePreviewer/demo-renderer');

    const host = document.createElement('div');
    document.body.appendChild(host);

    const session = await renderDemo({
      runtime: 'vue',
      demo: commandDemo as any,
      host,
    });

    try {
      await flushFrames(4);

      // Normalize initial appear/open flow: entering -> entered.
      clickRef(host, 'completeBtn');
      expect(await waitForState(host, 'entered')).toBe('entered');

      // entered -> leaving -> closed, then wait for soft-unmount to settle.
      clickRef(host, 'leaveBtn');
      expect(await waitForState(host, 'leaving')).toBe('leaving');

      clickRef(host, 'completeBtn');
      expect(await waitForState(host, 'closed')).toBe('closed');

      // A single Enter click should be enough to reach entering.
      clickRef(host, 'enterBtn');
      expect(await waitForState(host, 'entering')).toBe('entering');
      expect(host.querySelector('[data-demo-ref="transition"]')).not.toBeNull();
    } finally {
      await session.destroy();
      host.remove();
    }
  });
});
