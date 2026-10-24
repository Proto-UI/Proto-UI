import { definePrototype, tw } from '../../../../core/src';
import { AdaptToWebComponent } from '../../src';
let setups = 0,
  renders = 0,
  parentRenders = 0;
const child = definePrototype({
  name: 'owned-caller-evidence-child',
  setup(def) {
    setups++;
    const first = def.feedback.style.declareDecoration(),
      second = def.feedback.style.declareDecoration();
    const active = def.state.bool('active', false);
    def.feedback.style.use(tw('block p-4'));
    def.feedback.style.to(first).use(tw('block h-4 w-16 bg-black opacity-50'));
    def.feedback.style.to(second).use(tw('block h-4 w-16 bg-black'));
    def.rule({
      when: (w) => w.state(active).eq(true),
      intent: (i) => i.feedback.style.to(first).use(tw('bg-white opacity-100')),
    });
    def.event.on('host:click', () => active.set(!active.get()));
    def.event.on('key.down', (_run, e) => {
      if (e.key === 'F2') {
        e.control.requestDefaultActionPrevention();
        active.set(!active.get());
      }
    });
    return (r) => {
      renders++;
      return [r.decoration(first), r.el('section', r.slot()), r.decoration(second)];
    };
  },
});
const parent = definePrototype({
  name: 'owned-caller-evidence-parent',
  setup() {
    return (r) => {
      parentRenders++;
      return r.el('section', r.slot());
    };
  },
});
AdaptToWebComponent(child);
AdaptToWebComponent(parent);
const main = document.querySelector('main')!;
const outer = document.createElement(parent.name) as HTMLElement & { update(): void };
const host = document.createElement(child.name);
const input = document.createElement('input');
input.id = 'caller-editor';
input.value = 'preserve selection';
input.setAttribute('aria-label', 'Caller editor');
const button = document.createElement('button');
button.id = 'caller-toggle';
button.textContent = 'Toggle decoration';
input.addEventListener('keydown', (e) => {
  if (e.key === 'F3') {
    e.preventDefault();
    outer.update();
  }
});
host.append(input, button);
outer.append(host);
main.append(outer);
await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const expectedLeaves = [...host.querySelectorAll<HTMLElement>('[data-pui-owned-decoration]')];
const originalRenders = renders;
(window as any).decorationWebEvidence = {
  get leaves() {
    return [...host.querySelectorAll<HTMLElement>('[data-pui-owned-decoration]')];
  },
  dispose() {
    outer.remove();
  },
  snapshot() {
    const leaves: HTMLElement[] = this.leaves;
    return {
      framework: 'wc',
      setups,
      renders,
      originalRenders,
      parentRenders,
      stable:
        leaves.length === expectedLeaves.length && leaves.every((n, i) => n === expectedLeaves[i]),
      callerStable: host.querySelector('#caller-editor') === input && main.contains(host),
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
