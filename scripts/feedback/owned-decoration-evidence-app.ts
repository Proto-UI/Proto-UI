import { definePrototype, tw } from '../../packages/core/src';
import { AdaptToWebComponent } from '../../packages/adapters/web-component/src';

let renders = 0;
const proto = definePrototype({
  name: 'owned-decoration-native-proof',
  setup(def) {
    const first = def.feedback.style.declareDecoration();
    const second = def.feedback.style.declareDecoration();
    const active = def.state.bool('active', false);
    def.feedback.style.use(tw('block p-4'));
    def.feedback.style.to(first).use(tw('block h-4 w-16 bg-black opacity-50'));
    def.feedback.style.to(second).use(tw('block h-4 w-16 bg-black'));
    def.rule({
      when: (w) => w.state(active).eq(true),
      intent: (i) => i.feedback.style.to(first).use(tw('bg-white opacity-100')),
    });
    def.event.on('host:click', () => active.set(!active.get()));
    def.event.on('key.down', (_run, event) => {
      if (event.key === 'F2') {
        event.control.requestDefaultActionPrevention();
        active.set(!active.get());
      }
    });
    return (r) => {
      renders++;
      return [r.decoration(first), r.el('section', r.slot()), r.decoration(second)];
    };
  },
});
AdaptToWebComponent(proto);
const host = document.createElement(proto.name) as HTMLElement & { update(): void };
const input = document.createElement('input');
input.id = 'caller-editor';
input.value = 'preserve selection';
input.setAttribute('aria-label', 'Caller editor');
const button = document.createElement('button');
button.id = 'caller-toggle';
button.textContent = 'Toggle decoration';
host.append(input, button);
document.querySelector('main')!.append(host);
const leaves = [...host.querySelectorAll<HTMLElement>('[data-pui-owned-decoration]')];
const original = [...host.childNodes];
const inputParent = input.parentNode;
(window as any).decorationEvidence = {
  host,
  input,
  button,
  leaves,
  snapshot() {
    return {
      renders,
      stable:
        original.every((n, i) => host.childNodes[i] === n) &&
        original.length === host.childNodes.length,
      callerParentStable: input.parentNode === inputParent,
      value: input.value,
      selection: [input.selectionStart, input.selectionEnd, input.selectionDirection],
      focus: document.activeElement?.id,
      hostTokens: host.getAttribute('data-pui-style'),
      leaves: leaves.map((node) => ({
        tokens: node.getAttribute('data-pui-style'),
        color: getComputedStyle(node).backgroundColor,
        opacity: getComputedStyle(node).opacity,
        width: node.getBoundingClientRect().width,
        height: node.getBoundingClientRect().height,
        hidden: node.getAttribute('aria-hidden'),
        inert: node.hasAttribute('inert'),
        tabIndex: node.tabIndex,
        pointer: getComputedStyle(node).pointerEvents,
        children: node.childNodes.length,
      })),
    };
  },
};
document.documentElement.dataset.ready = 'true';
