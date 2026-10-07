import { describe, expect, it } from 'vitest';
import { definePrototype, tw, type OwnedStateHandle } from '@proto.ui/core';
import { renderProtoShadowSplitStyleArtifact } from '../../../cli/src/services/proto-style-css';
import { createSplitRuntimePilot } from './fixtures/shadow-split-runtime';

describe('private split WC Runtime integration', () => {
  it('projects before commit, lowers Rule state/meta, replays detached patches, and releases owner resources', async () => {
    let checked!: OwnedStateHandle<boolean>;
    let setupCount = 0;
    let scheme: 'light' | 'dark' = 'light';
    const listeners = new Set<() => void>();
    const proto = definePrototype({
      name: 'split-runtime-pilot',
      setup(def) {
        setupCount++;
        checked = def.state.bool('pilot.checked', false);
        def.expose('checked', checked);
        def.feedback.style.use(tw('flex w-full p-2 text-xs bg-primary'));
        def.rule({
          when: (w) => w.state(checked).eq(true),
          intent: (i) => i.feedback.style.use(tw('p-4 text-lg')),
        });
        def.rule({
          when: (w) => w.meta('colorScheme').eq('dark'),
          intent: (i) => i.feedback.style.use(tw('border-2')),
        });
        return (r) => r.el('span', {}, 'content');
      },
    });
    const artifact = renderProtoShadowSplitStyleArtifact([
      'flex',
      'w-full',
      'p-2',
      'text-xs',
      'bg-primary',
      'data-[pilot-checked]:p-4',
      'data-[pilot-checked]:text-lg',
      'dark:border-2',
      'p-8',
    ]);
    const host = document.createElement('x-split-runtime');
    document.body.append(host);
    const commits: string[] = [];
    const pilot = createSplitRuntimePilot({
      host,
      proto,
      artifact,
      colorSchemeSource: {
        get: () => scheme,
        subscribe(cb) {
          listeners.add(cb);
          return () => {
            listeners.delete(cb);
          };
        },
      },
      onCommit() {
        commits.push(host.getAttribute('data-pui-split-root-style') ?? 'MISSING');
      },
    });
    const { surface } = pilot.resources;
    const style = pilot.root.querySelector('style');
    expect(style).not.toBeNull();
    await pilot.mount();
    expect(commits[0]).toContain('p-2');
    // Before mounted-time lowering, Runtime evaluates active Rules directly.
    expect(host.getAttribute('data-pui-split-root-style')).toContain(
      'data-[pilot-checked]:text-lg'
    );
    expect(surface.element.textContent).toBe('content');
    expect(host.hasAttribute('data-pilot-checked')).toBe(false);
    pilot.session.invokeInCallbackScope(() => checked.set(true));
    expect(host.hasAttribute('data-pilot-checked')).toBe(true);
    expect(surface.element.hasAttribute('data-pilot-checked')).toBe(false);
    scheme = 'dark';
    listeners.forEach((cb) => cb());
    expect(host.getAttribute('data-pui-color-scheme')).toBe('dark');
    expect(pilot.resources.getMeta('colorScheme')).toBe('dark');
    await pilot.detach();
    expect(pilot.root.contains(style)).toBe(true);
    expect(pilot.root.contains(surface.element)).toBe(true);
    expect(surface.element.childNodes.length).toBe(0);
    expect(host.hasAttribute('data-pui-split-root-style')).toBe(false);
    pilot.session.invokeInCallbackScope(() => pilot.feedback.patchStyle(tw('p-8')));
    await pilot.mount();
    expect(setupCount).toBe(1);
    expect(commits.at(-1)).toContain('p-8');
    expect(pilot.root.querySelector('style')).toBe(style);
    const before = [host.outerHTML, surface.element.outerHTML];
    expect(() =>
      pilot.session.invokeInCallbackScope(() => pilot.feedback.patchStyle(tw('translate-x-2')))
    ).toThrow(/runtime token.*translate-x-2/);
    expect([host.outerHTML, surface.element.outerHTML]).toEqual(before);
    pilot.session.invokeInCallbackScope(() => pilot.feedback.clearStylePatch());
    expect(host.getAttribute('data-pui-split-root-style')).not.toContain('p-8');
    await pilot.dispose();
    expect(pilot.root.childNodes.length).toBe(0);
    expect(host.hasAttribute('data-pui-color-scheme')).toBe(false);
    expect(listeners.size).toBe(0);
    const next = createSplitRuntimePilot({ host, proto, artifact });
    await next.mount();
    expect(setupCount).toBe(2);
    expect(next.resources.surface.element).not.toBe(surface.element);
    await next.dispose();
    host.remove();
  });
});
