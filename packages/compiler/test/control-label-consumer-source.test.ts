// @vitest-environment happy-dom
import { createControlLabelRef, type InstanceAssociations } from '@proto.ui/core';
import Vue2 from '../../adapters/vue2/node_modules/vue';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  cleanupConsumers,
  cleanupOutputs,
  CONTROL_LABEL_PROFILES,
  mountControlLabelConsumer,
  pointerClick,
  state,
  type ExecutionKind,
  type TargetKind,
  type WebTarget,
} from './control-label-consumer-fixture';

afterEach(cleanupConsumers);
afterAll(cleanupOutputs);
const targets = Object.keys(CONTROL_LABEL_PROFILES) as WebTarget[];
const compositions: readonly [ExecutionKind, ExecutionKind][] = [
  ['compiled', 'compiled'],
  ['compiled', 'runtime'],
  ['runtime', 'compiled'],
];
const targetKinds: TargetKind[] = ['button', 'toggle'];

describe('real Vue2 observed association input', () => {
  it.each(compositions)(
    '%s Label + %s target accepts genuine observer metadata and rebinds',
    async (labelExecution, targetExecution) => {
      const associations = Vue2.observable({ controlLabel: createControlLabelRef() });
      expect(Object.hasOwn(associations, '__ob__')).toBe(true);
      const control = await mountControlLabelConsumer(
        'vue2',
        'button',
        targetExecution,
        associations
      );
      const label = await mountControlLabelConsumer('vue2', 'label', labelExecution, associations);
      await control.flush();
      expect(control.root.getAttribute('aria-labelledby')).toBe(label.root.id);
      await label.run(() => pointerClick(label.root));
      expect(control.signals).toEqual(['click']);
      const next = Vue2.observable({ controlLabel: createControlLabelRef() });
      await label.setAssociations(next);
      expect(control.root.hasAttribute('aria-labelledby')).toBe(false);
      await label.run(() => pointerClick(label.root));
      expect(control.signals).toEqual(['click']);
      await control.setAssociations(next);
      expect(control.root.getAttribute('aria-labelledby')).toBe(label.root.id);
      await label.run(() => pointerClick(label.root));
      expect(control.signals).toEqual(['click', 'click']);
      await label.setAssociations(Vue2.observable({}));
      expect(control.root.hasAttribute('aria-labelledby')).toBe(false);
    }
  );

  for (const execution of ['compiled', 'runtime'] as const) {
    it.each(['forged-observer', 'unknown-key'] as const)(
      `${execution} rejects %s without weakening Core's key boundary`,
      async (kind) => {
        const value = { controlLabel: createControlLabelRef() };
        const input =
          kind === 'unknown-key'
            ? Vue2.observable({ ...value, extra: true })
            : Object.defineProperty(value, '__ob__', { value: { value }, enumerable: false });
        const errors: unknown[] = [];
        const previous = Vue2.config.errorHandler;
        Vue2.config.errorHandler = (error) => {
          errors.push(error);
        };
        try {
          try {
            await mountControlLabelConsumer(
              'vue2',
              'label',
              execution,
              input as InstanceAssociations
            );
          } catch (error) {
            errors.push(error);
          }
          expect(
            errors.some(
              (error) =>
                error instanceof TypeError &&
                /association.*(?:key|__ob__|extra)/i.test(error.message)
            ),
            errors.map(String).join('\n')
          ).toBe(true);
        } finally {
          await cleanupConsumers();
          Vue2.config.errorHandler = previous;
        }
      }
    );
  }
});

// A positive control separates a broken host fixture from a compiler regression.
// It uses the same actual framework mount path and input sequence as the matrix.
describe.each(targets)('runtime harness positive control: %s', (target) => {
  it.each(targetKinds)('connects and activates the real Runtime %s', async (kind) => {
    const associations = Object.freeze({ controlLabel: createControlLabelRef() });
    const control = await mountControlLabelConsumer(target, kind, 'runtime', associations);
    const label = await mountControlLabelConsumer(target, 'label', 'runtime', associations);
    await control.flush();
    expect(control.root.getAttribute('aria-labelledby')).toBe(label.root.id);
    expect(label.root.id).not.toBe('');
    await label.run(() => pointerClick(label.root));
    expect(control.signals).toEqual(kind === 'button' ? ['click'] : [{ active: true }]);
    expect(document.activeElement).toBe(control.root);
    if (kind === 'toggle') expect(state(control.handle, 'active')).toBe(true);
  });
});

// C-CONTROL-LABEL-0001 DOMAIN/NAME/ACTIVATION/FOCUS/OWNED-NAME. The source
// fixture publishes ordinary modules; only the App Maker's public factory ref
// crosses their output-directory/framework/runtime boundaries.
describe.each(targets)('ordinary Control Label %s consumers', (target) => {
  describe.each(compositions)('%s Label + %s target', (labelExecution, targetExecution) => {
    it.each(targetKinds)(
      'names %s, activates exactly once and preserves disabled/controlled ownership',
      async (kind) => {
        const associations = Object.freeze({ controlLabel: createControlLabelRef() });
        const control = await mountControlLabelConsumer(
          target,
          kind,
          targetExecution,
          associations
        );
        const label = await mountControlLabelConsumer(
          target,
          'label',
          labelExecution,
          associations
        );
        await control.flush();
        expect(label.root.id).not.toBe('');
        expect(control.root.getAttribute('aria-labelledby')).toBe(label.root.id);
        expect(control.root.hasAttribute('aria-label')).toBe(false);
        expect(label.root.hasAttribute('tabindex')).toBe(false);
        expect(label.root.getAttribute('role')).not.toBe('button');
        expect(control.root.hasAttribute('instanceAssociations')).toBe(false);
        expect(control.root.getAttribute('role')).toBe('button');
        await label.run(() => pointerClick(label.root));
        expect(document.activeElement).toBe(control.root);
        expect(state(control.handle, 'focused')).toBe(true);
        expect(state(control.handle, 'pressed')).toBe(false);
        expect(control.signals).toEqual(kind === 'button' ? ['click'] : [{ active: true }]);
        if (kind === 'toggle') {
          expect(state(control.handle, 'active')).toBe(true);
          expect(control.root.getAttribute('aria-pressed')).toBe('true');
          // The owner refuses the proposed change by keeping the supplied value false.
          await control.setProps({ active: false });
          await label.run(() => pointerClick(label.root));
          expect(control.signals).toEqual([{ active: true }, { active: true }]);
          expect(state(control.handle, 'active')).toBe(false);
          expect(control.root.getAttribute('aria-pressed')).toBe('false');
        }
        await control.setProps({ disabled: true, ...(kind === 'toggle' ? { active: false } : {}) });
        control.root.blur();
        const accepted = [...control.signals];
        await label.run(() => pointerClick(label.root));
        expect(control.signals).toEqual(accepted);
        expect(document.activeElement).not.toBe(control.root);
        expect(state(control.handle, 'focused')).toBe(false);
        expect(control.root.getAttribute('aria-labelledby')).toBe(label.root.id);
        const retiredLabel = label.root;
        await label.close();
        await control.flush();
        expect(control.root.hasAttribute('aria-labelledby')).toBe(false);
        await control.run(() => pointerClick(retiredLabel));
        expect(control.signals).toEqual(accepted);
      }
    );
  });

  it.each(targetKinds)(
    'retires the %s request when focus synchronously detaches its Label',
    async (kind) => {
      const associations = Object.freeze({ controlLabel: createControlLabelRef() });
      const control = await mountControlLabelConsumer(target, kind, 'compiled', associations);
      const label = await mountControlLabelConsumer(target, 'label', 'compiled', associations);
      const physicalLabel = label.root;
      const onFocus = () => physicalLabel.remove();
      control.root.addEventListener('focus', onFocus);
      try {
        await label.run(() => pointerClick(physicalLabel));
        expect(control.signals).toEqual([]);
        if (kind === 'toggle') expect(state(control.handle, 'active')).toBe(false);
        expect(control.root.hasAttribute('aria-labelledby')).toBe(false);
      } finally {
        control.root.removeEventListener('focus', onFocus);
        // Restore the externally removed node before its framework owns disposal.
        label.host.append(physicalLabel);
        await label.flush();
      }
    }
  );

  it('withdraws naming independently of activation, then revokes the old reference on replacement', async () => {
    const first = Object.freeze({ controlLabel: createControlLabelRef() });
    const second = Object.freeze({ controlLabel: createControlLabelRef() });
    const control = await mountControlLabelConsumer(target, 'button', 'compiled', first);
    const label = await mountControlLabelConsumer(target, 'label', 'compiled', first);
    await label.setProps({ naming: false, activation: true });
    expect(control.root.hasAttribute('aria-labelledby')).toBe(false);
    await label.run(() => pointerClick(label.root));
    expect(control.signals).toEqual(['click']);
    await label.setProps({ naming: true, activation: false });
    expect(control.root.getAttribute('aria-labelledby')).toBe(label.root.id);
    await label.run(() => pointerClick(label.root));
    expect(control.signals).toEqual(['click']);
    await label.setProps({});
    await label.setAssociations(second);
    expect(control.root.hasAttribute('aria-labelledby')).toBe(false);
    await label.run(() => pointerClick(label.root));
    expect(control.signals).toEqual(['click']);
    await control.setAssociations(second);
    expect(control.root.getAttribute('aria-labelledby')).toBe(label.root.id);
    await label.run(() => pointerClick(label.root));
    expect(control.signals).toEqual(['click', 'click']);
  });

  it('does not infer a pair from matching content or sibling position', async () => {
    const control = await mountControlLabelConsumer(
      target,
      'button',
      'compiled',
      Object.freeze({ controlLabel: createControlLabelRef() })
    );
    const label = await mountControlLabelConsumer(
      target,
      'label',
      'compiled',
      Object.freeze({ controlLabel: createControlLabelRef() })
    );
    expect(control.root.hasAttribute('aria-labelledby')).toBe(false);
    await label.run(() => pointerClick(label.root));
    expect(control.signals).toEqual([]);
  });
});
