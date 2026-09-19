import { definePrototype, tw, HOST_ELEMENT_CAP, type OwnedStateHandle } from '@proto.ui/core';
import { createRuntimeSession } from '@proto.ui/runtime';
import { EFFECTS_CAP, type FeedbackPort } from '@proto.ui/module-feedback';
import { RULE_META_GET_CAP } from '@proto.ui/module-rule-meta';
import { createSplitRuntimePilot } from '../../../packages/adapters/web-component/test/fixtures/shadow-split-runtime';
import { createOwnedTwTokenApplier } from '../../../packages/adapters/web-component/src/feedback-style';
import { commitChildren } from '../../../packages/adapters/web-component/src/commit';
import type { ShadowStyleArtifactV1 } from '../../../packages/adapters/web-component/src/shadow-style-artifact';

// Run inside Chromium, bundled from repository sources. No production Adapter activation.
export async function run(artifact: ShadowStyleArtifactV1, documentCss: string) {
  const style = document.createElement('style');
  style.textContent = documentCss;
  document.head.append(style);
  const geometry = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  };
  const samples: unknown[] = [];
  for (const initial of [false, true]) {
    const create = (split: boolean) => {
      const row = document.createElement('div');
      row.style.cssText =
        'display:flex;width:240px;align-items:flex-start;font-size:16px;--pui-primary:rgb(20, 40, 60)';
      const host = document.createElement('x-runtime-probe');
      const peer = document.createElement('div');
      peer.style.cssText = 'flex:1 1 0%;min-width:0';
      peer.textContent = 'Peer';
      row.append(host, peer);
      document.body.append(row);
      let active!: OwnedStateHandle<boolean>;
      let scheme: 'light' | 'dark' = 'light';
      const listeners = new Set<() => void>();
      const proto = definePrototype({
        name: 'split-browser-pilot',
        setup(def) {
          active = def.state.bool('pilot.active', initial);
          def.expose('active', active);
          def.feedback.style.use(tw('block flex-1 min-w-0 p-2 border-2 text-xs bg-primary'));
          def.rule({
            when: (w) => w.state(active).eq(true),
            intent: (i) => i.feedback.style.use(tw('p-4 border text-lg')),
          });
          def.rule({
            when: (w) => w.meta('colorScheme').eq('dark'),
            intent: (i) => i.feedback.style.use(tw('p-8')),
          });
          return (r) => r.el('span', {}, 'Hello');
        },
      });
      let surface = host;
      const read = () => ({
        host: geometry(host),
        surface: geometry(surface),
        peer: geometry(peer),
        font: getComputedStyle(surface).fontSize,
        padding: getComputedStyle(surface).paddingLeft,
      });
      const commits: ReturnType<typeof read>[] = [];
      if (split) {
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
          onCommit: () => commits.push(read()),
        });
        surface = pilot.resources.surface.element;
        return {
          host,
          surface,
          read,
          commits,
          mount: pilot.mount,
          detach: pilot.detach,
          setActive(value: boolean) {
            pilot.session.invokeInCallbackScope(() => active.set(value));
          },
          dark() {
            scheme = 'dark';
            listeners.forEach((cb) => cb());
          },
          patch(token: string) {
            pilot.session.invokeInCallbackScope(() => pilot.feedback.patchStyle(tw(token)));
          },
          clear() {
            pilot.session.invokeInCallbackScope(() => pilot.feedback.clearStylePatch());
          },
          async dispose() {
            await pilot.dispose();
            const clean =
              host.shadowRoot!.childNodes.length === 0 &&
              !host.hasAttribute('data-pui-split-root-style');
            row.remove();
            return clean;
          },
        };
      }
      const applier = createOwnedTwTokenApplier(host);
      const session = createRuntimeSession(proto, {
        prototypeName: proto.name,
        getRawProps: () => ({}),
        schedule: (task) => task(),
        commit(children, signal) {
          commitChildren(host, children, { mode: 'light' });
          commits.push(read());
          signal?.done();
        },
        onRuntimeReady(wiring) {
          wiring.attach('feedback', [
            [
              EFFECTS_CAP,
              {
                queueStyle(h: { tokens: string[] }) {
                  applier.apply(h.tokens);
                },
                requestFlush() {},
              },
            ],
          ]);
          wiring.attach('expose-state-web', [[HOST_ELEMENT_CAP, host]]);
          wiring.attach('rule-meta', [[RULE_META_GET_CAP, () => scheme]]);
        },
      });
      const feedback = session.caps.getPort<FeedbackPort>('feedback')!;
      return {
        host,
        surface,
        read,
        commits,
        mount: () => session.mount(),
        detach: () => session.unmount(),
        setActive(value: boolean) {
          session.invokeInCallbackScope(() => active.set(value));
        },
        dark() {
          scheme = 'dark';
          document.documentElement.classList.add('dark');
        },
        patch(token: string) {
          session.invokeInCallbackScope(() => feedback.patchStyle(tw(token)));
        },
        clear() {
          session.invokeInCallbackScope(() => feedback.clearStylePatch());
        },
        async dispose() {
          await session.dispose();
          applier.clear();
          row.remove();
          return true;
        },
      };
    };
    document.documentElement.classList.remove('dark');
    const collapsed = create(false),
      split = create(true);
    const sample = (phase: string) =>
      samples.push({ initial, phase, collapsed: collapsed.read(), split: split.read() });
    await collapsed.mount();
    await split.mount();
    samples.push({
      initial,
      phase: 'first-commit',
      collapsed: collapsed.commits[0],
      split: split.commits[0],
    });
    sample('mounted');
    collapsed.setActive(!initial);
    split.setActive(!initial);
    sample('state-update');
    collapsed.dark();
    split.dark();
    sample('dark-update');
    collapsed.patch('text-sm');
    split.patch('text-sm');
    sample('font-patch');
    const before = JSON.stringify(split.read());
    let rejection = '';
    try {
      split.patch('translate-x-2');
    } catch (error) {
      rejection = String(error);
    }
    if (!rejection.includes('runtime token') || before !== JSON.stringify(split.read()))
      throw new Error('Atomic runtime rejection failed');
    collapsed.clear();
    split.clear();
    sample('patch-clear');
    await collapsed.detach();
    await split.detach();
    collapsed.patch('border');
    split.patch('border');
    await collapsed.mount();
    await split.mount();
    sample('remount');
    // Uninherited document selectors cannot paint the actual inner div.
    const hostile = document.createElement('style');
    hostile.textContent = 'div[data-pui-split-surface] { background: rgb(255, 0, 0) !important; }';
    document.head.append(hostile);
    if (getComputedStyle(split.surface).backgroundColor !== 'rgb(20, 40, 60)')
      throw new Error('Inner paint/theme isolation failed');
    if (
      getComputedStyle(split.host).backgroundColor !== 'rgba(0, 0, 0, 0)' ||
      getComputedStyle(split.host).borderLeftColor !== 'rgba(0, 0, 0, 0)'
    )
      throw new Error('Host paints duplicate background/border');
    hostile.remove();
    if (!(await split.dispose()) || !(await collapsed.dispose()))
      throw new Error('Terminal cleanup failed');
  }
  return samples;
}
