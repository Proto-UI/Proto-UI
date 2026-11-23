import { afterEach, expect, it } from 'vitest';
import { button } from '@proto.ui/prototypes-base/button';
import { renderDemo } from '../src/components/PrototypePreviewer/demo-renderer';
import { registerPrototype } from '../src/components/PrototypePreviewer/registry';
import { observeRecipeInput } from '../../../scripts/analysis/fixtures/recipe-input-observation';
import {
  assertNativeRecipeInputs,
  partitionRecipeInputs,
} from '../../../scripts/analysis/recipe-input-verification.mjs';

class RecipeButton extends HTMLElement {
  getExposes() {
    return {};
  }
}
customElements.define('recipe-observation-button', RecipeButton);
registerPrototype(button.name, button);
afterEach(() => document.body.replaceChildren());

function fixture() {
  const root = document.createElement('recipe-observation-button');
  root.setAttribute('data-pui-root', '');
  root.setAttribute('data-demo-ref', 'known-button');
  document.body.append(root);
  const inputs: ReturnType<typeof observeRecipeInput>[] = [];
  const roots = new Set([root]);
  for (const type of ['click', 'keydown', 'input'])
    root.addEventListener(type, (event) => inputs.push(observeRecipeInput(event, roots)));
  return { root, roots, inputs };
}

it('records a declared WC click:void CustomEvent separately without calling it native input', () => {
  const { root, inputs } = fixture();
  root.dispatchEvent(new CustomEvent('click', { bubbles: true, cancelable: true }));
  expect(inputs[0]).toMatchObject({
    type: 'click',
    eventClass: 'CustomEvent',
    channel: 'outward-signal',
    target: 'known-button',
    carrier: 'wc-expose-click-void',
  });
  // Happy DOM omits isTrusted; it must never become a true native receipt.
  expect(inputs[0].trusted).not.toBe(true);
  expect(partitionRecipeInputs(inputs)).toEqual({
    nativeInputs: [],
    outwardSignals: inputs,
    unclassifiedEvents: [],
  });
  expect(() => assertNativeRecipeInputs(inputs)).toThrow('at least one trusted native input');
});

it('rejects a synthetic MouseEvent from the same legitimate WC owner', () => {
  const { root, inputs } = fixture();
  root.dispatchEvent(new CustomEvent('click', { bubbles: true, cancelable: true }));
  root.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  expect(inputs[1]).toMatchObject({ eventClass: 'MouseEvent', channel: 'physical-input' });
  expect(inputs[1].trusted).not.toBe(true);
  expect(partitionRecipeInputs(inputs).nativeInputs).toEqual([inputs[1]]);
  expect(() => assertNativeRecipeInputs(inputs)).toThrow(
    'fixture never dispatches synthetic input'
  );
});

it('does not exempt a CustomEvent with another payload, type, target or retired owner', () => {
  const { root, roots, inputs } = fixture();
  root.dispatchEvent(
    new CustomEvent('click', { detail: { unexpected: true }, bubbles: true, cancelable: true })
  );
  root.dispatchEvent(new CustomEvent('keydown', { bubbles: true, cancelable: true }));
  const child = document.createElement('span');
  root.append(child);
  child.dispatchEvent(new CustomEvent('click', { bubbles: true, cancelable: true }));
  roots.clear();
  root.dispatchEvent(new CustomEvent('click', { bubbles: true, cancelable: true }));
  expect(inputs.map((event) => event.channel)).toEqual(Array(4).fill('unclassified'));
  expect(() => assertNativeRecipeInputs(inputs)).toThrow(
    'all recorded events have a known physical or outward source'
  );
});

it('preserves synthetic keyboard and input as failures, including a generic click Event', () => {
  const { root, inputs } = fixture();
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  root.dispatchEvent(new InputEvent('input', { bubbles: true }));
  root.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
  expect(inputs.map(({ channel }) => channel)).toEqual([
    'physical-input',
    'physical-input',
    'unclassified',
  ]);
  expect(inputs.every((event) => !event.trusted)).toBe(true);
  expect(() => assertNativeRecipeInputs(inputs)).toThrow();
});

it('observes the real WC Button bridge while still rejecting its synthetic source click', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const roots = new Set<HTMLElement>();
  const inputs: ReturnType<typeof observeRecipeInput>[] = [];
  let buttonRoot!: HTMLElement;
  let callbacks = 0;
  host.addEventListener('click', (event) => inputs.push(observeRecipeInput(event, roots)), true);
  const view = await renderDemo({
    runtime: 'wc',
    host,
    demo: {
      type: 'demo',
      root: { kind: 'proto', prototypeId: button.name, ref: 'button', children: ['Real Button'] },
      setup({ api, refs }) {
        buttonRoot = refs.button;
        roots.add(buttonRoot);
        api.setProps('button', { onClick: () => callbacks++ });
      },
    },
  });
  try {
    buttonRoot.click();
    expect(callbacks).toBe(1);
    const partition = partitionRecipeInputs(inputs);
    expect(partition.unclassifiedEvents).toEqual([]);
    expect(partition.outwardSignals).toHaveLength(1);
    expect(partition.outwardSignals[0]).toMatchObject({
      type: 'click',
      eventClass: 'CustomEvent',
      carrier: 'wc-expose-click-void',
    });
    expect(partition.nativeInputs).toHaveLength(1);
    expect(partition.nativeInputs[0].trusted).not.toBe(true);
    expect(() => assertNativeRecipeInputs(inputs)).toThrow(
      'fixture never dispatches synthetic input'
    );
  } finally {
    await view.destroy();
  }
});
