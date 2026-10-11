import { describe, expect, it, vi } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '../src';
import type { VisualFeedbackFrame } from '@proto.ui/module-feedback';

let id = 0;
describe('custom visual provider acquisition transaction', () => {
  it('never allocates a provider for a view whose initial render fails', () => {
    const failure = new Error('initial render failed');
    const factory = vi.fn();
    const Constructor = AdaptToWebComponent(
      definePrototype({
        name: `visual-acquisition-render-failure-${++id}`,
        setup(def) {
          def.feedback.style.use(tw('bg-background'));
          return () => {
            throw failure;
          };
        },
      }),
      { createVisualSink: factory }
    );
    const host = new Constructor();
    let caught: unknown;
    try {
      document.body.append(host);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(failure);
    expect(factory).not.toHaveBeenCalled();
    host.remove();
  });

  it.each([new Error('provider commit failed'), undefined, 0])(
    'retires a failed final commit exactly once (%s)',
    (failure) => {
      const release = vi.fn();
      const commit = vi.fn(() => {
        throw failure;
      });
      const factory = vi.fn(() => ({ commit, release }));
      const Constructor = AdaptToWebComponent(
        definePrototype({
          name: `visual-acquisition-commit-failure-${++id}`,
          setup(def) {
            def.feedback.style.use(tw('bg-background'));
            return () => null;
          },
        }),
        { createVisualSink: factory }
      );
      const host = new Constructor();
      let threw = false;
      let caught: unknown;
      try {
        document.body.append(host);
      } catch (error) {
        threw = true;
        caught = error;
      }
      expect(threw).toBe(true);
      expect(caught).toBe(failure);
      expect(factory).toHaveBeenCalledOnce();
      expect(commit).toHaveBeenCalledOnce();
      expect(release).toHaveBeenCalledOnce();
      host.remove();
      expect(release).toHaveBeenCalledOnce();
    }
  );
});

it('commits one synchronous acquisition frame and immediately forwards a later empty style', async () => {
  const frames: VisualFeedbackFrame[] = [];
  const release = vi.fn();
  const Constructor = AdaptToWebComponent(
    definePrototype({
      name: `visual-acquisition-later-empty-${++id}`,
      setup(def) {
        def.props.define({ active: { type: 'boolean', default: true } });
        def.rule({
          when: (w) => w.prop('active').eq(true),
          intent: (i) => i.feedback.style.use(tw('bg-background')),
        });
        return () => null;
      },
    }),
    {
      createVisualSink: () => ({
        commit: (frame) => {
          frames.push(frame);
        },
        release,
      }),
    }
  );
  const host = new Constructor();
  document.body.append(host);
  expect(frames).toHaveLength(1);
  expect(frames[0].style.tokens).toContain('bg-background');
  setElementProps(host, { active: false });
  expect(frames.length).toBeGreaterThan(1);
  expect(frames.at(-1)!.style.tokens).toEqual([]);
  host.remove();
  await vi.waitFor(() => expect(release).toHaveBeenCalledOnce());
});

it('preserves a falsy provider factory failure', () => {
  const factory = vi.fn(() => {
    throw undefined;
  });
  const Constructor = AdaptToWebComponent(
    definePrototype({
      name: `visual-acquisition-factory-failure-${++id}`,
      setup(def) {
        def.feedback.style.use(tw('bg-background'));
        return () => null;
      },
    }),
    { createVisualSink: factory }
  );
  const host = new Constructor();
  let threw = false;
  let caught: unknown = 'not thrown';
  try {
    document.body.append(host);
  } catch (error) {
    threw = true;
    caught = error;
  }
  expect(threw).toBe(true);
  expect(caught).toBeUndefined();
  expect(factory).toHaveBeenCalledOnce();
  host.remove();
});

it('applies ordinary style synchronously when the provider returns null', () => {
  const factory = vi.fn(() => null);
  const Constructor = AdaptToWebComponent(
    definePrototype({
      name: `visual-acquisition-null-provider-${++id}`,
      setup(def) {
        def.feedback.style.use(tw('bg-background'));
        return () => null;
      },
    }),
    { createVisualSink: factory }
  );
  const host = new Constructor();
  document.body.append(host);
  expect(factory).toHaveBeenCalledOnce();
  expect(host.getAttribute('data-pui-style')).toContain('bg-background');
  host.remove();
});
