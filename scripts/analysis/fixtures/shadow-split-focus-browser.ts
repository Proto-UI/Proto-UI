import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { asFocusable } from '@proto.ui/hooks';
import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';
import type { ShadowStyleArtifactV1 } from '../../../packages/adapters/web-component/src/shadow-style-artifact';

// C-HOST-SURFACE-PROJECTION-0001 C/D/E: real focus ownership plus
// runtime/rule removal and owner-generation replay, not manual DOM token writes.
export function mount(artifact: ShadowStyleArtifactV1) {
  const elements = new Map<string, HTMLElement>();
  for (const split of [false, true]) {
    for (const mode of ['plain', 'ring-only', 'patch', 'rule', 'descendant']) {
      const key = `${split ? 'split' : 'light'}-${mode}`;
      const proto = definePrototype({
        name: `focus-probe-${key}`,
        setup(def) {
          asFocusable().configure({ disabled: false });
          const active = def.state.bool('probe.active', false);
          def.expose('active', active);
          def.feedback.style.use(tw('inline-flex p-2'));
          if (mode === 'ring-only') def.feedback.style.use(tw('ring-3'));
          if (mode === 'rule') {
            def.rule({
              when: (w) => w.state(active).eq(true),
              intent: (i) => i.feedback.style.use(tw('outline-none ring-3')),
            });
          }
          let run!: RunHandle<any>;
          def.lifecycle.onCreated((r) => {
            run = r;
          });
          def.expose('controls', {
            patch: () => run.feedback.style.patch(tw('outline-none ring-3')),
            clear: () => run.feedback.style.clearPatch(),
            activate: (value: boolean) => active.set(value),
            present: (value: boolean) => run.lifecycle.setPresent(value),
          });
          return (r) => r.slot();
        },
      });
      const C = AdaptToWebComponent(proto, {
        shadow: split ? { mode: 'open', presentation: 'split', styleArtifact: artifact } : false,
      });
      const before = document.createElement('button');
      before.id = `before-${key}`;
      before.textContent = 'Before';
      const el = new C();
      el.id = key;
      el.textContent = key;
      if (mode === 'descendant') {
        const childProto = definePrototype({
          name: `focus-probe-child-${key}`,
          setup(def) {
            def.feedback.style.use(tw('outline-none'));
            return (r) => r.slot();
          },
        });
        const Child = AdaptToWebComponent(childProto, {
          shadow: split ? { mode: 'open', presentation: 'split', styleArtifact: artifact } : false,
        });
        const child = new Child();
        child.dataset.probeChild = '';
        child.textContent = 'Styled nested Root';
        el.replaceChildren(child);
      }
      document.body.append(before, el);
      elements.set(key, el);
    }
  }
  return {
    call(key: string, method: string, value?: boolean) {
      const el = elements.get(key)! as HTMLElement & { getExposes(): any };
      el.getExposes().controls[method](value);
    },
    remove(key: string) {
      elements.get(key)!.remove();
    },
    reconnect(key: string) {
      document.getElementById(`before-${key}`)!.after(elements.get(key)!);
    },
  };
}
