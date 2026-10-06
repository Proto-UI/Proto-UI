import { describe, expect, it, vi } from 'vitest';
import { definePrototype, type Prototype } from '@proto.ui/core';
import { asFocusEntry, asFocusable, asFocusScope } from '@proto.ui/hooks';

type Mounted = {
  root: HTMLElement;
  getExposes(): any;
  act(callback: () => void): Promise<void>;
  unmount(): Promise<void>;
};

// Real framework/Adapter/Focus, with only host rejection and frame delivery
// controlled. HC-FOCUS-TARGET-0001-C and C-AS-FOCUSABLE-0001-G require both
// bounded same-intent replay and a fresh budget for a newer explicit intent.
export function focusIntentRetryConformance(
  adapter: string,
  tree: {
    getLogicalEventRouteSurfaceForTarget(target: HTMLElement): any;
    markProtoInstance(target: HTMLElement, proto: Prototype<any>, token: any): any;
    createLogicalInstance(proto: Prototype<any>): any;
    unbindProtoInstance(token: any, target: HTMLElement): any;
    registerNativeFocusReadiness(
      token: any,
      readiness: { isReady(): boolean; subscribe(fn: () => void): () => void }
    ): () => void;
  },
  mount: (proto: Prototype<any, any>) => Promise<Mounted>
) {
  describe(`${adapter}: stable focus intent retry identity`, () => {
    it.each([
      'entry disable',
      'blur',
      'explicit no target',
      'new target',
      'scope-rejected target',
      'keep pending',
    ] as const)('releases a cancelled entry owner lease: %s', async (action) => {
      const proto = definePrototype({
        name: `cancel-entry-owner-${adapter}-${action.replaceAll(' ', '-')}`,
        setup(def) {
          const target = asFocusable();
          const entry = asFocusEntry();
          entry.configure({ strategy: 'descendant-first', fallback: 'none' });
          def.expose.method('focusRoot', () => target.focus());
          def.expose.method('entry', () => entry.focus({ preventScroll: true }));
          def.expose.method('cancel', () => {
            if (action === 'keep pending') return;
            if (action === 'entry disable') entry.setDisabled(true);
            else if (action === 'blur') target.blur();
            else if (action === 'new target' || action === 'scope-rejected target') target.focus();
            else entry.focus();
          });
          return (r) => r.el('button', 'Waiting descendant');
        },
      });
      const mounted = await mount(proto);
      const blocker =
        action === 'scope-rejected target'
          ? await mount(
              definePrototype({
                name: `cancel-entry-blocker-${adapter}`,
                setup(def) {
                  const scope = asFocusScope();
                  scope.configure({ trap: true, entry: 'manual' });
                  def.expose.method('activate', () => scope.activate());
                  return (r) => r.el('button', 'Scope blocker');
                },
              })
            )
          : undefined;
      const child = mounted.root.querySelector('button')!;
      const owner = tree.createLogicalInstance(proto);
      tree.markProtoInstance(child, proto, owner);
      const listeners = new Set<() => void>();
      let ready = false;
      const release = tree.registerNativeFocusReadiness(owner, {
        isReady: () => ready,
        subscribe: (fn) => {
          listeners.add(fn);
          return () => {
            listeners.delete(fn);
          };
        },
      });
      const focus = vi.spyOn(mounted.root, 'focus');
      try {
        await mounted.act(() => mounted.getExposes().focusRoot());
        await mounted.act(() => mounted.getExposes().entry());
        expect(listeners.size).toBe(1);
        const stale = [...listeners];
        if (action === 'explicit no target') child.disabled = true;
        if (blocker) await blocker.act(() => blocker.getExposes().activate());
        await mounted.act(() => mounted.getExposes().cancel());
        expect(listeners.size).toBe(action === 'keep pending' ? 1 : 0);
        const before = focus.mock.calls.length;
        ready = true;
        await mounted.act(() => stale.forEach((fn) => fn()));
        expect(focus.mock.calls.length).toBe(before);
        if (action === 'keep pending') {
          expect(document.activeElement).toBe(child);
          expect(listeners.size).toBe(0);
        }
      } finally {
        focus.mockRestore();
        release();
        tree.unbindProtoInstance(owner, child);
        await blocker?.unmount();
        await mounted.unmount();
      }
    });

    for (const kind of ['entry', 'native', 'programmatic'] as const) {
      it.each(['omitted', 'reused'] as const)(
        `${kind} renews only explicit intent with %s options`,
        async (optionsMode) => {
          const sharedOptions =
            optionsMode === 'reused' ? Object.freeze({ preventScroll: true }) : undefined;
          const proto = definePrototype({
            name: `retry-${adapter}-${kind}-${optionsMode}`,
            setup(def) {
              const target = asFocusable();
              def.expose.state('focused', target.focused);
              const entry = asFocusEntry();
              entry.configure({ strategy: 'descendant-first', fallback: 'none' });
              def.expose.method('request', () => {
                if (kind === 'entry') entry.focus(sharedOptions);
                else if (kind === 'native') target.focusSelf(sharedOptions);
                else target.focus(sharedOptions);
              });
              return (r) => r.el('button', 'Requested descendant');
            },
          });
          const mounted = await mount(proto);
          const frames: FrameRequestCallback[] = [];
          const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
            frames.push(callback);
            return frames.length;
          });
          const target = kind === 'entry' ? mounted.root.querySelector('button')! : mounted.root;
          const nativeFocus = target.focus.bind(target);
          let rejected = true;
          let rejectNext = false;
          let throwNext = false;
          const attempts: boolean[] = [];
          const focus = vi.spyOn(target, 'focus').mockImplementation((options) => {
            if (throwNext) {
              throwNext = false;
              throw new Error('controlled native focus failure');
            }
            const reject = rejected || rejectNext;
            rejectNext = false;
            attempts.push(!reject);
            if (!reject) nativeFocus(options);
          });
          const flushFrames = async () => {
            for (let round = 0; frames.length && round < 12; round++) {
              const callbacks = frames.splice(0);
              await mounted.act(() => callbacks.forEach((callback) => callback(performance.now())));
            }
            expect(frames).toHaveLength(0);
          };
          try {
            await mounted.act(() => mounted.getExposes().request());
            await flushFrames();
            expect(attempts).toEqual([false, false, false, false]);
            expect(document.activeElement).not.toBe(target);
            attempts.length = 0;
            const beforeThrow = focus.mock.calls.length;
            throwNext = true;
            await expect(mounted.act(() => mounted.getExposes().request())).rejects.toThrow(
              'controlled native focus failure'
            );
            expect(focus).toHaveBeenCalledTimes(beforeThrow + 1);
            expect(mounted.getExposes().focused.get()).toBe(false);
            expect(frames).toHaveLength(0);
            expect(document.activeElement).not.toBe(target);
            rejected = false;
            rejectNext = true;
            await mounted.act(() => mounted.getExposes().request());
            await flushFrames();
            expect(attempts).toEqual([false, true]);
            expect(document.activeElement).toBe(target);
            await mounted.act(() => target.blur());
            attempts.length = 0;
            rejected = true;
            await mounted.act(() => mounted.getExposes().request());
            await flushFrames();
            expect(attempts).toEqual([false, false, false, false]);
            // Supersede before queued work delivers. Old callbacks cannot extend
            // the newer intent's initial attempt plus three retries.
            attempts.length = 0;
            await mounted.act(() => {
              mounted.getExposes().request();
              mounted.getExposes().request();
            });
            await flushFrames();
            expect(attempts).toEqual([false, false, false, false, false]);
          } finally {
            focus.mockRestore();
            raf.mockRestore();
            await mounted.unmount();
          }
        }
      );
    }

    for (const kind of ['entry', 'native', 'programmatic'] as const) {
      it.each(['omitted', 'reused'] as const)(
        `retires queued ${kind} frames when surface readiness succeeds with %s options`,
        async (optionsMode) => {
          const options =
            optionsMode === 'reused' ? Object.freeze({ preventScroll: true }) : undefined;
          const proto = definePrototype({
            name: `retry-${adapter}-completed-${kind}-${optionsMode}`,
            setup(def) {
              const target = asFocusable();
              const entry = asFocusEntry();
              entry.configure({ strategy: 'descendant-first', fallback: 'none' });
              def.expose.method('request', () => {
                if (kind === 'entry') entry.focus(options);
                else if (kind === 'native') target.focusSelf(options);
                else target.focus(options);
              });
              return (r) => r.el('button', 'Completed request target');
            },
          });
          const mounted = await mount(proto);
          const currentTarget = () =>
            kind === 'entry' ? mounted.root.querySelector('button')! : mounted.root;
          const frames: FrameRequestCallback[] = [];
          const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
            frames.push(callback);
            return frames.length;
          });
          const nativeFocus = HTMLElement.prototype.focus;
          let accept = false;
          const attempts: { accepted: boolean; options: FocusOptions | undefined }[] = [];
          const focus = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
            this: HTMLElement,
            forwarded?: FocusOptions
          ) {
            if (this === currentTarget()) {
              attempts.push({ accepted: accept, options: forwarded });
              if (!accept) return;
            }
            nativeFocus.call(this, forwarded);
          });
          const flushFrames = async () => {
            for (let round = 0; frames.length && round < 12; round++) {
              const callbacks = frames.splice(0);
              await mounted.act(() => callbacks.forEach((callback) => callback(performance.now())));
            }
            expect(frames).toHaveLength(0);
          };
          try {
            await mounted.act(() => mounted.getExposes().request());
            expect(attempts).toEqual([{ accepted: false, options }]);
            expect(frames.length).toBeGreaterThan(0);
            expect(document.activeElement).not.toBe(currentTarget());

            // Publish one actual platform surface-readiness notification before
            // the already queued two-frame layout retry is delivered. Avoid
            // framework commits that emit extra, unrelated readiness signals.
            accept = true;
            await mounted.act(() => {
              const root = mounted.root;
              const token = tree.getLogicalEventRouteSurfaceForTarget(root);
              expect(token).not.toBeNull();
              tree.markProtoInstance(root, proto, token);
            });
            expect(document.activeElement).toBe(currentTarget());
            expect(attempts.find((attempt) => attempt.accepted)).toEqual({
              accepted: true,
              options,
            });
            const completedAttempts = attempts.slice();
            await flushFrames();
            // Replaying the stale frame would re-project a focused root with
            // no request options, discarding the completed preventScroll policy.
            expect(attempts).toEqual(completedAttempts);

            // Completion cancellation must leave a later explicit request with
            // its own full allowance and the same caller-supplied options.
            await mounted.act(() => currentTarget().blur());
            attempts.length = 0;
            accept = false;
            await mounted.act(() => mounted.getExposes().request());
            await flushFrames();
            expect(attempts).toEqual(
              Array.from({ length: 4 }, () => ({ accepted: false, options }))
            );
            expect(document.activeElement).not.toBe(currentTarget());
          } finally {
            focus.mockRestore();
            raf.mockRestore();
            await mounted.unmount();
          }
        }
      );
    }

    it.each(['entry', 'native', 'programmatic'] as const)(
      'preserves an exhausted %s layout budget across ordinary same-view commits',
      async (kind) => {
        let run: any;
        const proto = definePrototype({
          name: `retry-${adapter}-ordinary-commit-${kind}`,
          setup(def) {
            const target = asFocusable();
            const entry = asFocusEntry();
            entry.configure({ strategy: 'descendant-first', fallback: 'none' });
            def.lifecycle.onCreated((value) => {
              run = value;
            });
            def.expose.method('request', () => {
              if (kind === 'entry') entry.focus();
              else if (kind === 'native') target.focusSelf();
              else target.focus();
            });
            def.expose.method('update', () => run.update());
            return (r) => r.el('button', 'Rejected through unrelated commits');
          },
        });
        const mounted = await mount(proto);
        const root = mounted.root;
        const currentTarget = () =>
          kind === 'entry' ? mounted.root.querySelector('button')! : mounted.root;
        const frames: FrameRequestCallback[] = [];
        const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
          frames.push(callback);
          return frames.length;
        });
        const focus = HTMLElement.prototype.focus;
        let attempts = 0;
        let accept = false;
        const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
          this: HTMLElement,
          options?: FocusOptions
        ) {
          if (this !== currentTarget()) {
            focus.call(this, options);
            return;
          }
          attempts++;
          if (accept) focus.call(this, options);
        });
        const flushFrames = async () => {
          for (let round = 0; frames.length && round < 12; round++) {
            const callbacks = frames.splice(0);
            await mounted.act(() => callbacks.forEach((callback) => callback(performance.now())));
          }
          expect(frames).toHaveLength(0);
        };
        try {
          await mounted.act(() => mounted.getExposes().request());
          await flushFrames();
          expect(attempts).toBe(4);
          for (let update = 0; update < 3; update++) {
            await mounted.act(() => mounted.getExposes().update());
            expect(mounted.root).toBe(root);
            // A commit can make a direct readiness attempt. It cannot replenish
            // the three-frame budget for the same pending intent/view epoch.
            expect(frames).toHaveLength(0);
          }
          attempts = 0;
          await mounted.act(() => mounted.getExposes().request());
          await flushFrames();
          expect(attempts).toBe(4);
          accept = true;
          await mounted.act(() => mounted.getExposes().request());
          expect(document.activeElement).toBe(currentTarget());
        } finally {
          focusSpy.mockRestore();
          raf.mockRestore();
          await mounted.unmount();
        }
      }
    );

    it.each(['entry', 'native', 'programmatic'] as const)(
      'ignores old-view frames after a retained replacement and a newer %s intent',
      async (kind) => {
        let run: any;
        const proto = definePrototype({
          name: `retry-${adapter}-retained-${kind}`,
          setup(def) {
            const target = asFocusable();
            def.expose.state('focused', target.focused);
            const entry = asFocusEntry();
            entry.configure({ strategy: 'descendant-first', fallback: 'none' });
            def.lifecycle.onCreated((value) => {
              run = value;
            });
            def.expose.method('request', () => {
              if (kind === 'entry') entry.focus();
              else if (kind === 'native') target.focusSelf();
              else target.focus();
            });
            def.expose('view', {
              hide: () => run.lifecycle.setPresent(false),
              show: () => run.lifecycle.setPresent(true),
            });
            return (r) => r.el('button', 'Replacement target');
          },
        });
        const mounted = await mount(proto);
        const currentTarget = () =>
          kind === 'entry' ? mounted.root.querySelector('button')! : mounted.root;
        const frames: FrameRequestCallback[] = [];
        const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
          frames.push(callback);
          return frames.length;
        });
        const oldFocus = vi.spyOn(currentTarget(), 'focus').mockImplementation(() => {});
        let nextFocus: ReturnType<typeof vi.spyOn> | undefined;
        try {
          await mounted.act(() => mounted.getExposes().request());
          expect(frames.length).toBeGreaterThan(0);
          await mounted.act(() => mounted.getExposes().view.hide());
          oldFocus.mockRestore();
          await mounted.act(() => mounted.getExposes().view.show());
          await mounted.act(() => {});
          const replacement = currentTarget();
          await mounted.act(() => replacement.blur());
          nextFocus = vi.spyOn(replacement, 'focus').mockImplementation(() => {});
          await mounted.act(() => mounted.getExposes().request());
          for (let round = 0; frames.length && round < 16; round++) {
            const callbacks = frames.splice(0);
            await mounted.act(() => callbacks.forEach((callback) => callback(performance.now())));
          }
          expect({ attempts: nextFocus.mock.calls.length, queued: frames.length }).toEqual({
            attempts: 4,
            queued: 0,
          });
        } finally {
          oldFocus.mockRestore();
          nextFocus?.mockRestore();
          raf.mockRestore();
          await mounted.unmount();
        }
      }
    );

    for (const kind of ['entry', 'native', 'programmatic'] as const)
      it.each(['omitted', 'reused'] as const)(
        `keeps the same exhausted ${kind} intent bounded across retained replacements with %s options`,
        async (optionsMode) => {
          const options =
            optionsMode === 'reused' ? Object.freeze({ preventScroll: true }) : undefined;
          let run: any;
          const proto = definePrototype({
            name: `retry-${adapter}-same-retained-${kind}-${optionsMode}`,
            setup(def) {
              const target = asFocusable();
              const entry = asFocusEntry();
              entry.configure({ strategy: 'descendant-first', fallback: 'none' });
              def.lifecycle.onCreated((value) => {
                run = value;
              });
              def.expose.method('request', () => {
                if (kind === 'entry') entry.focus(options);
                else if (kind === 'native') target.focusSelf(options);
                else target.focus(options);
              });
              def.expose('view', {
                hide: () => run.lifecycle.setPresent(false),
                show: () => run.lifecycle.setPresent(true),
              });
              return (r) => r.el('button', 'Same retained intent');
            },
          });
          const mounted = await mount(proto);
          const frames: FrameRequestCallback[] = [];
          const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
            frames.push(callback);
            return frames.length;
          });
          const nativeFocus = HTMLElement.prototype.focus;
          let attempts = 0,
            accept = false;
          const focus = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
            this: HTMLElement,
            options?: FocusOptions
          ) {
            const root = mounted.root;
            if (root && (this === root || root.contains(this))) {
              attempts++;
              if (!accept) return;
            }
            nativeFocus.call(this, options);
          });
          const drain = async () => {
            for (let i = 0; frames.length && i < 12; i++) {
              const current = frames.splice(0);
              await mounted.act(() => current.forEach((cb) => cb(performance.now())));
            }
            expect(frames).toHaveLength(0);
          };
          try {
            await mounted.act(() => mounted.getExposes().request());
            await drain();
            expect(attempts).toBe(4);
            for (let cycle = 0; cycle < 3; cycle++) {
              await mounted.act(() => mounted.getExposes().view.hide());
              await mounted.act(() => mounted.getExposes().view.show());
              await mounted.act(() => {});
              // A newly ready physical view may try the existing intent directly.
              // It must not allocate another frame allowance for that same intent.
              const beforeLayout = attempts;
              await drain();
              expect(attempts).toBe(beforeLayout);
            }
            attempts = 0;
            await mounted.act(() => mounted.getExposes().request());
            await drain();
            expect(attempts).toBe(4);
            accept = true;
            await mounted.act(() => mounted.getExposes().request());
            const target = kind === 'entry' ? mounted.root.querySelector('button')! : mounted.root;
            expect(document.activeElement).toBe(target);
          } finally {
            focus.mockRestore();
            raf.mockRestore();
            await mounted.unmount();
          }
        }
      );

    it.each(['entry', 'native', 'programmatic'] as const)(
      'creates a fresh %s allowance for a new terminal instance',
      async (kind) => {
        let setups = 0;
        const proto = definePrototype({
          name: `retry-${adapter}-new-owner-${kind}`,
          setup(def) {
            const identity = ++setups,
              target = asFocusable(),
              entry = asFocusEntry();
            entry.configure({ strategy: 'descendant-first', fallback: 'none' });
            def.expose.method('identity', () => identity);
            def.expose.method('request', () => {
              if (kind === 'entry') entry.focus();
              else if (kind === 'native') target.focusSelf();
              else target.focus();
            });
            return (r) => r.el('button', 'Fresh owner');
          },
        });
        for (let owner = 1; owner <= 2; owner++) {
          const mounted = await mount(proto),
            frames: FrameRequestCallback[] = [];
          const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
            frames.push(cb);
            return frames.length;
          });
          const target = kind === 'entry' ? mounted.root.querySelector('button')! : mounted.root;
          const focus = vi.spyOn(target, 'focus').mockImplementation(() => {});
          try {
            expect(mounted.getExposes().identity()).toBe(owner);
            await mounted.act(() => mounted.getExposes().request());
            for (let i = 0; frames.length && i < 12; i++) {
              const current = frames.splice(0);
              await mounted.act(() => current.forEach((cb) => cb(performance.now())));
            }
            expect(focus).toHaveBeenCalledTimes(4);
            expect(frames).toHaveLength(0);
          } finally {
            focus.mockRestore();
            raf.mockRestore();
            await mounted.unmount();
          }
        }
      }
    );

    for (const outcome of ['older-accepted', 'older-rejected'] as const)
      it(`${adapter}: ${outcome} does not mutate newer request budget`, async () => {
        const proto = definePrototype({
          name: `review-postfocus-${adapter}-${outcome}`,
          setup(def) {
            const f = asFocusable(),
              entry = asFocusEntry();
            entry.configure({ strategy: 'descendant-first', fallback: 'none' });
            def.expose.method('root', () => f.focus());
            def.expose.method('child', () => entry.focus());
            return (r) => r.el('button', 'Newer child intent');
          },
        });
        const m = await mount(proto),
          root = m.root,
          child = root.querySelector('button')!;
        const frames: FrameRequestCallback[] = [];
        const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
          frames.push(cb);
          return frames.length;
        });
        let nested = false,
          childAttempts = 0;
        const nativeRoot = root.focus.bind(root);
        const rootSpy = vi.spyOn(root, 'focus').mockImplementation((options) => {
          if (outcome === 'older-accepted' && !nested) {
            nested = true;
            m.getExposes().child();
          }
          nativeRoot(options);
        });
        const childSpy = vi.spyOn(child, 'focus').mockImplementation(() => {
          childAttempts++;
          if (outcome === 'older-rejected' && !nested) {
            nested = true;
            m.getExposes().root();
          }
        });
        try {
          await m.act(() =>
            outcome === 'older-accepted' ? m.getExposes().root() : m.getExposes().child()
          );
          const before = childAttempts,
            queued = frames.length;
          for (let i = 0; frames.length && i < 12; i++) {
            const c = frames.splice(0);
            await m.act(() => c.forEach((f) => f(performance.now())));
          }
          const replay = childAttempts - before;
          expect(frames.length).toBe(0);
          if (outcome === 'older-accepted') expect(replay).toBe(3);
          else expect(queued).toBe(0);
        } finally {
          rootSpy.mockRestore();
          childSpy.mockRestore();
          raf.mockRestore();
          await m.unmount();
        }
      });
    it('keeps descendant rejection bounded while the independent root stays focused', async () => {
      const proto = definePrototype({
        name: `retry-${adapter}-dual-role-root`,
        setup(def) {
          const target = asFocusable();
          const entry = asFocusEntry();
          entry.configure({ strategy: 'descendant-first', fallback: 'none' });
          def.expose.method('focusRoot', () => target.focus());
          def.expose.method('enter', () => entry.focus());
          return (r) => r.el('button', 'Rejected descendant');
        },
      });
      const mounted = await mount(proto);
      await mounted.act(() => mounted.getExposes().focusRoot());
      expect(document.activeElement).toBe(mounted.root);
      const frames: FrameRequestCallback[] = [];
      const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        frames.push(callback);
        return frames.length;
      });
      const focus = vi
        .spyOn(mounted.root.querySelector('button')!, 'focus')
        .mockImplementation(() => {});
      try {
        await mounted.act(() => mounted.getExposes().enter());
        for (let round = 0; frames.length && round < 12; round++) {
          const callbacks = frames.splice(0);
          await mounted.act(() => callbacks.forEach((callback) => callback(performance.now())));
        }
        expect({ attempts: focus.mock.calls.length, queued: frames.length }).toEqual({
          attempts: 4,
          queued: 0,
        });
        expect(document.activeElement).toBe(mounted.root);
      } finally {
        focus.mockRestore();
        raf.mockRestore();
        await mounted.unmount();
      }
    });

    for (const kind of ['programmatic', 'native', 'entry'] as const) {
      for (const cancel of [false, true]) {
        it(`preserves queued ${kind} layout retry through a readiness burst; cancel=${cancel}`, async () => {
          const options = Object.freeze({ reason: 'keyboard' as const, preventScroll: true });
          const proto = definePrototype({
            name: `retry-burst-${adapter}-${kind}-${cancel}`,
            setup(def) {
              const target = asFocusable();
              const entry = asFocusEntry();
              entry.configure({ strategy: 'descendant-first', fallback: 'none' });
              def.expose.method('request', () => {
                if (kind === 'entry') entry.focus(options);
                else if (kind === 'native') target.focusSelf(options);
                else target.focus(options);
              });
              def.expose.method('cancel', () => target.blur());
              return (r) => r.el('button', 'Delayed physical acquisition');
            },
          });
          const mounted = await mount(proto);
          const target = kind === 'entry' ? mounted.root.querySelector('button')! : mounted.root;
          const nativeFocus = target.focus.bind(target);
          const frames: FrameRequestCallback[] = [];
          const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => {
            frames.push(fn);
            return frames.length;
          });
          let accepts = false;
          const attempts: Array<{ accepted: boolean; options: FocusOptions | undefined }> = [];
          const focus = vi.spyOn(target, 'focus').mockImplementation((forwarded) => {
            attempts.push({ accepted: accepts, options: forwarded });
            if (accepts) nativeFocus(forwarded);
          });
          try {
            await mounted.act(() => mounted.getExposes().request());
            expect(attempts).toHaveLength(1);
            // Real surface notifications can precede physical acquisition in a
            // portal/Transition commit. They are replays, not new intent or cancellation.
            for (let i = 0; i < 8; i++) {
              await mounted.act(() => {
                const token = tree.getLogicalEventRouteSurfaceForTarget(mounted.root);
                tree.markProtoInstance(mounted.root, proto, token);
              });
            }
            expect(document.activeElement).not.toBe(target);
            const beforeLayout = attempts.length;
            if (cancel) await mounted.act(() => mounted.getExposes().cancel());
            accepts = true;
            for (let i = 0; frames.length && i < 12; i++) {
              const pending = frames.splice(0);
              await mounted.act(() => pending.forEach((fn) => fn(performance.now())));
            }
            expect(frames).toHaveLength(0);
            if (cancel) {
              expect(attempts).toHaveLength(beforeLayout);
              expect(document.activeElement).not.toBe(target);
            } else {
              expect(document.activeElement).toBe(target);
              expect(attempts.slice(beforeLayout)).toEqual([
                { accepted: true, options: { preventScroll: true } },
              ]);
            }
          } finally {
            focus.mockRestore();
            raf.mockRestore();
            await mounted.unmount();
          }
        });
      }
    }
  });
}
