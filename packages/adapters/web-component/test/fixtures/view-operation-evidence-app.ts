import { definePrototype, type RunHandle, type ViewOperation } from '@proto.ui/core';
import { AdaptToWebComponent } from '../../src/adapt';
import { withWebComponentOwnedRelocation } from '../../src/owned-relocation';

// This fixture is placed in test/fixtures; imports below use its final location.
const cases = [
  'remove-root',
  'remove-source',
  'unrelated-reinsert',
  'terminal-replacement',
  'owned-transport',
  'nested-author-remove',
  'second-reconnect',
  'aborted-transport',
] as const;
const results: unknown[] = [];
const main = document.querySelector('main')!;
for (const [index, name] of cases.entries()) {
  const events: Array<{ phase: string; connected: boolean; path: string[]; disposals: number }> =
    [];
  let run!: RunHandle<any>;
  let disposals = 0;
  const proto = definePrototype({
    name: `view-operation-native-${index}`,
    setup(def) {
      def.lifecycle.onCreated((value) => {
        run = value;
      });
      def.lifecycle.onBeforeDispose(() => {
        disposals++;
      });
      def.expose('capture', () => run.lifecycle.captureViewOperation());
      return (r) => r.el('span', name);
    },
  });
  let source!: HTMLElement & { getExposes(): { capture(): ViewOperation | null } };
  let tracing = true;
  const snapshot = (phase: string) => {
    // Do not query validity in traces: that could latch an intermediate state.
    if (!tracing) return;
    const path: string[] = [];
    for (let node: Node | null = source; node; node = node.parentNode) {
      path.push(node instanceof Element ? `${node.localName}#${node.id}` : node.nodeName);
    }
    events.push({ phase, connected: source.isConnected, path, disposals });
  };
  // CE definitions save lifecycle callback references at registration. Wrap the
  // actual Adapter constructor before the same native define call, not afterward.
  const ownDefine = Object.getOwnPropertyDescriptor(customElements, 'define');
  const nativeDefine = customElements.define;
  let observedDefinition = false;
  Object.defineProperty(customElements, 'define', {
    configurable: true,
    writable: true,
    value: function (
      this: CustomElementRegistry,
      tag: string,
      constructor: CustomElementConstructor,
      options?: ElementDefinitionOptions
    ) {
      if (tag === proto.name) {
        if (observedDefinition) throw new Error('Duplicate fixture definition');
        observedDefinition = true;
        for (const method of ['connectedCallback', 'disconnectedCallback']) {
          const descriptor = Object.getOwnPropertyDescriptor(constructor.prototype, method);
          if (!descriptor || typeof descriptor.value !== 'function')
            throw new Error(`Missing Adapter callback ${method}`);
          const original = descriptor.value;
          Object.defineProperty(constructor.prototype, method, {
            ...descriptor,
            value: function (this: HTMLElement, ...args: unknown[]) {
              snapshot(`${method}:before`);
              try {
                return Reflect.apply(original, this, args);
              } finally {
                snapshot(`${method}:after`);
              }
            },
          });
        }
      }
      return Reflect.apply(nativeDefine, this, [tag, constructor, options]);
    },
  });
  try {
    AdaptToWebComponent(proto, { schedule: (task) => task() });
  } finally {
    if (ownDefine) Object.defineProperty(customElements, 'define', ownDefine);
    else delete (customElements as any).define;
  }
  if (!observedDefinition) throw new Error('Adapter did not register the observed constructor');
  source = document.createElement(proto.name) as typeof source;
  const root = document.createElement('section');
  root.id = `source-root-${index}`;
  const destination = document.createElement('aside');
  destination.id = `destination-${index}`;
  root.append(source);
  main.append(root, destination);
  const capture = () => source.getExposes().capture();
  const operation = capture()!;
  const initialReactions = events.splice(0);
  const checks: Array<{ label: string; actual: unknown; expected: unknown }> = [];
  const check = (label: string, actual: unknown, expected: unknown) => {
    checks.push({ label, actual, expected });
    if (actual !== expected)
      throw new Error(`${name}: ${label}: expected ${expected}, received ${actual}`);
  };
  let failure: string | null = null;
  try {
    check(
      'initial-connect-observed',
      initialReactions.map((event) => event.phase).join(','),
      'connectedCallback:before,connectedCallback:after'
    );
    check('initial-current', operation.isCurrent(), true);
    if (name === 'remove-root' || name === 'remove-source') {
      (name === 'remove-root' ? root : source).remove();
      check('before-deferred-retirement', disposals, 0);
      check('withdrawn', operation.isCurrent(), false);
    } else if (name === 'unrelated-reinsert') {
      source.remove();
      root.append(source);
      check('connected-again', source.isConnected, true);
      check('no-retirement-yet', disposals, 0);
      check('old-invalid', operation.isCurrent(), false);
      check('new-current', capture()?.isCurrent(), true);
    } else if (name === 'terminal-replacement') {
      source.remove();
      for (let turn = 0; turn < 6; turn++) await Promise.resolve();
      check('terminal-retired', disposals, 1);
      root.append(source);
      check('old-invalid-without-intermediate-query', operation.isCurrent(), false);
      check('new-owner-current', capture()?.isCurrent(), true);
    } else if (name === 'aborted-transport') {
      const error = new Error('abort-before-mutation');
      let caught: unknown;
      try {
        withWebComponentOwnedRelocation([source], destination, () => {
          throw error;
        });
      } catch (value) {
        caught = value;
      }
      check('original-error', caught === error, true);
      check('unmoved', source.parentElement === root, true);
      check('still-current', operation.isCurrent(), true);
    } else {
      withWebComponentOwnedRelocation([source], destination, () => {
        snapshot('before-first-append');
        destination.append(source);
        snapshot('after-first-append');
        if (name === 'nested-author-remove') {
          check('legitimate-first-move', operation.isCurrent(), true);
          source.remove();
          destination.append(source);
        } else if (name === 'second-reconnect') {
          // No intermediate validity query: historical rejection cannot revive.
          destination.append(source);
        }
      });
      snapshot('after-transport-finally');
      check('destination', source.parentElement === destination, true);
      check('no-retirement-yet', disposals, 0);
      check('final-current', operation.isCurrent(), name === 'owned-transport');
    }
    const repeat =
      name === 'aborted-transport'
        ? 0
        : name === 'nested-author-remove' || name === 'second-reconnect'
          ? 2
          : 1;
    const removedOnly = name === 'remove-root' || name === 'remove-source';
    const expectedPhases = Array.from({ length: repeat }, () =>
      removedOnly
        ? ['disconnectedCallback:before', 'disconnectedCallback:after']
        : [
            'disconnectedCallback:before',
            'disconnectedCallback:after',
            'connectedCallback:before',
            'connectedCallback:after',
          ]
    ).flat();
    check(
      'complete-native-reaction-sequence',
      events
        .filter((event) => event.phase.includes('Callback:'))
        .map((event) => event.phase)
        .join(','),
      expectedPhases.join(',')
    );
  } catch (error) {
    failure = String(error);
  } finally {
    tracing = false;
    root.remove();
    destination.remove();
    source.remove();
    for (let turn = 0; turn < 6; turn++) await Promise.resolve();
  }
  const result = { name, pass: failure === null, failure, checks, initialReactions, events };
  results.push(result);
  const line = document.createElement('p');
  line.textContent = `${result.pass ? 'PASS' : 'FAIL'} ${name}${failure ? `: ${failure}` : ''}`;
  main.append(line);
}
(window as any).viewOperationEvidence = { cases: [...cases], results };
document.documentElement.dataset.ready = 'true';
