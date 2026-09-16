import { describe, expect, it, vi } from 'vitest';
import { tw } from '@proto.ui/core';
import { createReactEffectsPort } from '../../react/src/runtime/effects-port';
import { createVueEffectsPort } from '../../vue/src/runtime/effects-port';
import { createVue2EffectsPort } from '../../vue2/src/runtime/effects-port';
import { createWebEffectsPort } from '../../web-component/src/runtime/effects-port';
import { createOwnedTwTokenApplier } from '../../web-component/src/feedback-style';

describe('Feedback visual sink conformance', () => {
  it.each([
    ['react', createReactEffectsPort],
    ['vue', createVueEffectsPort],
    ['vue2', createVue2EffectsPort],
  ] as const)('T-FEEDBACK-0001-CASE-SINK: %s queues latest result until flush', (_name, create) => {
    const project = vi.fn();
    const effects = create(project);
    effects.queueStyle(tw('opacity-25'));
    effects.queueStyle(tw('opacity-100'));
    expect(project).not.toHaveBeenCalled();
    effects.requestFlush();
    expect(project).toHaveBeenCalledTimes(1);
    expect(project).toHaveBeenLastCalledWith(['opacity-100']);
    effects.queueStyle(tw(''));
    effects.requestFlush();
    expect(project).toHaveBeenLastCalledWith([]);
  });

  it('T-FEEDBACK-0001-CASE-SINK: Web Component replaces only its owned output at flush', () => {
    const host = document.createElement('div');
    host.className = 'user-feedback-class';
    host.setAttribute('data-pui-style', 'external-token');
    const child = document.createElement('span');
    host.append(child);
    const effects = createWebEffectsPort(createOwnedTwTokenApplier(host));
    effects.queueStyle(tw('opacity-25'));
    effects.queueStyle(tw('opacity-100'));
    expect(host.getAttribute('data-pui-style')).toBe('external-token');
    effects.requestFlush();
    expect(host.getAttribute('data-pui-style')).toBe('external-token opacity-100');
    effects.queueStyle(tw(''));
    effects.requestFlush();
    expect(host.getAttribute('data-pui-style')).toBe('external-token');
    expect(host.className).toBe('user-feedback-class');
    expect(host.firstChild).toBe(child);
  });
});
