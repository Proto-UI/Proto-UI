import { afterEach, expect, it, vi } from 'vitest';
import { installPopoverDomProbe, startPopoverDomProbe } from './popover-public-dom-probe';
import type { Locator, Page } from 'playwright-core';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function fixture(shadow = false) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = shadow ? host.attachShadow({ mode: 'open' }) : host;
  const trigger = document.createElement('button');
  trigger.setAttribute('aria-controls', 'test-panel');
  root.append(trigger);
  const panel = document.createElement('div');
  panel.id = 'test-panel';
  panel.setAttribute('role', 'dialog');
  root.append(panel);
  const close = document.createElement('div');
  close.setAttribute('role', 'button');
  close.textContent = 'Close';
  panel.append(close);
  return { trigger, panel, close };
}
it('records public geometry and relation without copying text, IDs, URL or input values', () => {
  const { trigger, panel, close } = fixture();
  trigger.textContent = 'private-string https://secret.invalid/';
  panel.style.backgroundImage = 'url(https://secret.invalid/key)';
  const focus = vi.spyOn(close, 'focus');
  const click = vi.spyOn(close, 'click');
  const probe = installPopoverDomProbe(trigger);
  probe.mark('root32.beforeTriggerPointer');
  const result = probe.stop();
  const saved = JSON.stringify(result);
  expect(result.samples.length).toBeGreaterThanOrEqual(3);
  expect(saved).toContain('scrollY');
  expect(saved).toContain('viewportIntersection');
  expect(saved).not.toMatch(/private-string|secret.invalid|test-panel|Close|background-image/);
  expect(focus).not.toHaveBeenCalled();
  expect(click).not.toHaveBeenCalled();
  expect(result.observerErrors).toEqual([]);
  expect(result.stopped).toBe(true);
});
it('resolves open shadow targets and observes replacement identity', () => {
  const { trigger, panel, close } = fixture(true);
  const probe = installPopoverDomProbe(trigger);
  probe.mark('before');
  close.remove();
  const next = document.createElement('div');
  next.setAttribute('role', 'button');
  next.textContent = 'Close';
  panel.append(next);
  probe.mark('after');
  const result = probe.stop();
  const before = result.samples.find((x) => x.phase === 'before') as any;
  const after = result.samples.find((x) => x.phase === 'after') as any;
  expect(before.snapshot.elements.close.node.key).not.toBe(after.snapshot.elements.close.node.key);
  expect(after.snapshot.elements.panel.rootHost).not.toBeNull();
});
it('bounds samples preserving initial and terminal evidence, and reports loss', () => {
  const { trigger } = fixture();
  const probe = installPopoverDomProbe(trigger, { maxSamples: 8 });
  for (let i = 0; i < 40; i++) probe.mark(`step-${i}`);
  const result = probe.stop();
  expect(result.samples).toHaveLength(8);
  expect(result.droppedSamples).toBe(34);
  expect(result.samples[0].reason).toBe('installed');
  expect(result.samples.at(-1)?.reason).toBe('finished');
});
it('removes listeners and observers, rejects samples after stop', async () => {
  const { trigger } = fixture();
  const removed = vi.spyOn(document, 'removeEventListener');
  const probe = installPopoverDomProbe(trigger);
  const first = probe.stop();
  document.dispatchEvent(new Event('scroll'));
  probe.mark('after-stop');
  await Promise.resolve();
  const second = probe.stop();
  expect(second.samples).toEqual(first.samples);
  expect(removed).toHaveBeenCalled();
});
it('captures focus/scroll/resize events without invoking input methods', () => {
  const { trigger, close } = fixture();
  const probe = installPopoverDomProbe(trigger);
  close.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
  document.dispatchEvent(new Event('scroll'));
  window.dispatchEvent(new Event('resize'));
  const result = probe.stop();
  const reasons = result.samples.map((x) => x.reason);
  expect(reasons).toEqual(expect.arrayContaining(['focusin', 'scroll', 'resize']));
});
it('does not propagate installation or finalization failures to the original journey', async () => {
  const trigger = {
    evaluateHandle: vi.fn().mockRejectedValue(new Error('private error URL')),
  } as unknown as Locator;
  const probe = await startPopoverDomProbe({} as Page, trigger);
  await expect(probe.mark('test')).resolves.toBeUndefined();
  expect(await probe.finish()).toEqual({ observerErrors: ['probe-installation-failed'] });
  const handle = {
    evaluate: vi.fn().mockRejectedValue(new Error('private')),
    dispose: vi.fn().mockResolvedValue(undefined),
  };
  const next = await startPopoverDomProbe(
    {} as Page,
    { evaluateHandle: vi.fn().mockResolvedValue(handle) } as unknown as Locator
  );
  await next.mark('test');
  const result = await next.finish();
  expect(result.observerErrors).toEqual(['probe-marker-failed', 'probe-finalization-failed']);
  expect(handle.dispose).toHaveBeenCalledOnce();
});

it('discovers a newly materialized portal at synchronous focus before mutation delivery', () => {
  const { trigger, panel } = fixture();
  panel.remove();
  const probe = installPopoverDomProbe(trigger);
  document.body.append(panel);
  panel.lastElementChild!.dispatchEvent(
    new FocusEvent('focusin', { bubbles: true, composed: true })
  );
  const result = probe.stop();
  const focus = result.samples.find((x) => x.reason === 'focusin') as any;
  expect(focus.snapshot.elements.panel).not.toBeNull();
  expect(focus.snapshot.elements.close).not.toBeNull();
});
it('invalid sample limits remain bounded and custom properties cannot leak URL values', () => {
  const { trigger, panel } = fixture();
  panel.style.setProperty('--proto-ui-available-width', 'url(https://secret.invalid)');
  panel.style.setProperty('--proto-ui-available-height', '500px');
  const probe = installPopoverDomProbe(trigger, { maxSamples: NaN });
  for (let i = 0; i < 280; i++) probe.mark('sample');
  const result = probe.stop();
  expect(result.samples).toHaveLength(256);
  expect(JSON.stringify(result)).not.toContain('secret.invalid');
  const last = result.samples.at(-1) as any;
  expect(last.snapshot.elements.panel.availableSpace).toEqual({ width: null, height: 500 });
});

it('serializes the transformed installer without a module closure', () => {
  const { trigger } = fixture(true);
  // Playwright ships the function body to another realm. A direct unit import
  // alone would miss a reference to a module-scoped helper or compiler shim.
  const serialized = new Function(
    `return (${installPopoverDomProbe.toString()});`
  )() as typeof installPopoverDomProbe;
  const probe = serialized(trigger);
  probe.mark('serialized');
  const result = probe.stop();
  expect(result.observerErrors).toEqual([]);
  expect(result.samples.some((sample) => sample.phase === 'serialized')).toBe(true);
  expect(() => JSON.parse(JSON.stringify(result))).not.toThrow();
});

it('retains the deep active element and composed event path in an open shadow root', () => {
  const { trigger, close } = fixture(true);
  close.tabIndex = 0;
  const probe = installPopoverDomProbe(trigger);
  close.focus();
  const result = probe.stop();
  const sample = result.samples.find((entry) => entry.reason === 'focusin') as any;
  const closeKey = sample.snapshot.elements.close.node.key;
  expect(sample.snapshot.activeChain.at(-1).key).toBe(closeKey);
  expect(sample.detail.composedPath[0].key).toBe(closeKey);
  expect(sample.detail.eventTimeStamp).toEqual(expect.any(Number));
  expect(sample.snapshotEnd).toBeGreaterThanOrEqual(sample.at);
});

it('keeps missing target status distinct from connected geometry', () => {
  const { trigger, panel } = fixture();
  panel.remove();
  const probe = installPopoverDomProbe(trigger);
  const result = probe.stop();
  const snapshot = result.samples.at(-1)?.snapshot as any;
  expect(snapshot.elements.trigger.node.connected).toBe(true);
  expect(snapshot.elements.panel).toBeNull();
  expect(snapshot.elements.close).toBeNull();
  expect(snapshot.missingTargets).toEqual({
    panel: 'not-found-open-shadow-only',
    close: 'not-found-open-shadow-only',
  });
});

it('disconnects both observers and cancels the coalesced animation frame', () => {
  const { trigger, panel, close } = fixture();
  const resized = vi.spyOn(ResizeObserver.prototype, 'disconnect');
  const mutated = vi.spyOn(MutationObserver.prototype, 'disconnect');
  const unobserved = vi.spyOn(ResizeObserver.prototype, 'unobserve');
  const requested = vi.spyOn(window, 'requestAnimationFrame');
  const cancelled = vi.spyOn(window, 'cancelAnimationFrame');
  const probe = installPopoverDomProbe(trigger);
  document.dispatchEvent(new Event('scroll'));
  window.dispatchEvent(new Event('resize'));
  expect(requested).toHaveBeenCalledTimes(1);
  panel.remove();
  probe.mark('removed');
  expect(unobserved).toHaveBeenCalledWith(panel);
  expect(unobserved).toHaveBeenCalledWith(close);
  probe.stop();
  expect(resized).toHaveBeenCalledOnce();
  expect(mutated).toHaveBeenCalledOnce();
  expect(cancelled).toHaveBeenCalledWith(requested.mock.results[0].value);
});

it('continues listener cleanup after an observer disconnect failure', () => {
  const { trigger } = fixture();
  const removed = vi.spyOn(document, 'removeEventListener');
  const disconnected = vi
    .spyOn(ResizeObserver.prototype, 'disconnect')
    .mockImplementationOnce(() => {
      throw new Error('private disconnect failure');
    });
  const probe = installPopoverDomProbe(trigger);
  const result = probe.stop();
  expect(result.stopped).toBe(true);
  expect(result.observerErrors).toEqual(['resize-disconnect-failed']);
  expect(removed).toHaveBeenCalledTimes(6);
  expect(JSON.stringify(result)).not.toContain('private disconnect failure');
  // Complete the artificial failure's cleanup using the restored real method.
  disconnected.mockRestore();
  probe.stop();
});

it('does not replace a completed timeline when handle disposal rejects', async () => {
  const timeline = {
    schemaVersion: 'popover-public-dom-timeline-v1',
    timeOrigin: 0,
    samples: [],
    droppedSamples: 0,
    observerErrors: [],
    stopped: true,
    limit: 'test fixture',
  };
  const handle = {
    evaluate: vi.fn().mockResolvedValue(timeline),
    dispose: vi.fn().mockRejectedValue(new Error('private disposal failure')),
  };
  const probe = await startPopoverDomProbe(
    {} as Page,
    { evaluateHandle: vi.fn().mockResolvedValue(handle) } as unknown as Locator
  );
  await expect(probe.finish()).resolves.toEqual(timeline);
  expect(handle.dispose).toHaveBeenCalledOnce();
});

it('follows the public assignedSlot edge before the light-DOM parent', () => {
  const { trigger } = fixture();
  const host = trigger.parentElement!;
  const shadow = host.attachShadow({ mode: 'open' });
  const containingBlock = document.createElement('section');
  containingBlock.style.transform = 'translate(1px, 2px)';
  const slot = document.createElement('slot');
  containingBlock.append(slot);
  shadow.append(containingBlock);
  // HappyDOM 15 exposes assignedNodes but not Element.assignedSlot. Model only
  // that public native edge; this is not native slot/layout acceptance evidence.
  Object.defineProperty(trigger, 'assignedSlot', { value: slot });
  const probe = installPopoverDomProbe(trigger);
  const result = probe.stop();
  const snapshot = result.samples.at(-1)?.snapshot as any;
  const slotAncestor = snapshot.ancestors.find((entry: any) => entry.node.tag === 'slot');
  const containingAncestor = snapshot.ancestors.find((entry: any) => entry.node.tag === 'section');
  expect(slotAncestor).toBeDefined();
  expect(snapshot.elements.trigger.node.parent).toBe(slotAncestor.node.key);
  expect(containingAncestor.computed.transform).toBe('translate(1px, 2px)');
});
