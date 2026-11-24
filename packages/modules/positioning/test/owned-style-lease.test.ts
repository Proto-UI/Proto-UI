import { afterEach, describe, expect, it, vi } from 'vitest';
import { ownStyles } from '../src/web/owned-style-lease';

afterEach(() => document.body.replaceChildren());

describe('owned style measurement transactions', () => {
  it.each([false, true])(
    'certifies the entire restored snapshot after a setter throws (second field fails: %s)',
    (secondFails) => {
      const element = document.createElement('div');
      element.style.setProperty('--width', '100px');
      element.style.setProperty('--height', '200px');
      const lease = ownStyles(element);
      lease.write('--width', '300px');
      lease.write('--height', '400px');
      const firstFailure = new Error('width setter failed after writing');
      const secondFailure = new Error('height setter failed before writing');
      const set = element.style.setProperty.bind(element.style);
      const writes = vi
        .spyOn(element.style, 'setProperty')
        .mockImplementation((name, value, priority) => {
          if (secondFails && name === '--height' && value === '400px') throw secondFailure;
          set(name, value, priority);
          if (name === '--width' && value === '300px') throw firstFailure;
        });
      const completion = { changed: false, restored: false };
      expect(() =>
        lease.withBaseline(
          () => 1000,
          () => true,
          completion
        )
      ).toThrow(firstFailure);
      expect(element.style.getPropertyValue('--width')).toBe('300px');
      expect(element.style.getPropertyValue('--height')).toBe(secondFails ? '200px' : '400px');
      expect(completion).toEqual({ changed: true, restored: !secondFails });
      writes.mockRestore();
      lease.restore();
    }
  );

  it('restores a projected value after a throwing measurement and keeps authored priority for disposal', () => {
    const element = document.createElement('div');
    element.style.setProperty('--height', '77px', 'important');
    const lease = ownStyles(element);
    lease.write('--height', '234px');
    const completion = { changed: false, restored: false };
    const failure = new Error('measurement failed');
    expect(() =>
      lease.withBaseline(
        () => {
          expect(element.style.getPropertyValue('--height')).toBe('77px');
          expect(element.style.getPropertyPriority('--height')).toBe('important');
          expect(lease.isCurrent()).toBe(true);
          throw failure;
        },
        () => true,
        completion
      )
    ).toThrow(failure);
    expect(element.style.getPropertyValue('--height')).toBe('234px');
    expect(element.style.getPropertyPriority('--height')).toBe('');
    expect(lease.isCurrent()).toBe(true);
    expect(completion).toEqual({ changed: true, restored: true });
    lease.restore();
    expect(element.style.getPropertyValue('--height')).toBe('77px');
    expect(element.style.getPropertyPriority('--height')).toBe('important');
  });

  it.each(['both', 'height'] as const)(
    'does not resume after a style callback hands %s fields to an equal-valued successor',
    (handoff) => {
      class ReentrantMeasurement extends HTMLElement {
        static observedAttributes = ['style'];
        changed?: () => void;
        attributeChangedCallback() {
          this.changed?.();
        }
      }
      const tag = `positioning-style-transaction-successor-${handoff}`;
      if (!customElements.get(tag)) customElements.define(tag, ReentrantMeasurement);
      const element = document.createElement(tag) as ReentrantMeasurement;
      document.body.append(element);
      element.style.setProperty('--height', '77px', 'important');
      element.style.setProperty('--width', '50px');
      const first = ownStyles(element);
      first.write('--width', '123px');
      first.write('--height', '234px');
      let successor: ReturnType<typeof ownStyles> | undefined;
      element.changed = () => {
        if (successor || element.style.getPropertyValue('--height') !== '77px') return;
        successor = ownStyles(element);
        successor.write('--height', '234px');
        if (handoff === 'both') successor.write('--width', '123px');
      };
      const measure = vi.fn(() => ({ width: 50, height: 77 }));
      const completion = { changed: false, restored: false };
      expect(first.withBaseline(measure, () => true, completion)).toBeUndefined();
      expect(completion).toEqual({ changed: true, restored: false });
      expect(measure).not.toHaveBeenCalled();
      expect(first.isCurrent()).toBe(false);
      expect(successor?.isCurrent()).toBe(true);
      expect(element.style.getPropertyValue('--height')).toBe('234px');
      expect(element.style.getPropertyValue('--width')).toBe(handoff === 'both' ? '123px' : '50px');
      first.restore();
      expect(element.style.getPropertyValue('--height')).toBe('234px');
      successor!.restore();
      expect(element.style.getPropertyValue('--height')).toBe('77px');
      expect(element.style.getPropertyPriority('--height')).toBe('important');
      expect(element.style.getPropertyValue('--width')).toBe('50px');
    }
  );

  it('does not restore over a newer write on the same claim or a disposed generation', () => {
    const element = document.createElement('div');
    const lease = ownStyles(element);
    lease.write('--height', '234px');
    const completion = { changed: false, restored: false };
    expect(
      lease.withBaseline(
        () => {
          lease.write('--height', '345px');
          return 1000;
        },
        () => true,
        completion
      )
    ).toBeUndefined();
    expect(completion).toEqual({ changed: true, restored: false });
    expect(element.style.getPropertyValue('--height')).toBe('345px');
    let live = true;
    expect(
      lease.withBaseline(
        () => {
          live = false;
          lease.restore();
          return 1000;
        },
        () => live,
        completion
      )
    ).toBeUndefined();
    expect(completion).toEqual({ changed: true, restored: false });
    expect(element.style.getPropertyValue('--height')).toBe('');
  });

  it('does not certify any suspension for an empty or unchanged claim set', () => {
    const element = document.createElement('div');
    element.style.setProperty('--height', '77px');
    const lease = ownStyles(element);
    const completion = { changed: true, restored: true };
    expect(
      lease.withBaseline(
        () => 1000,
        () => true,
        completion
      )
    ).toBe(1000);
    expect(completion).toEqual({ changed: false, restored: true });
    lease.write('--height', '77px');
    const writes = vi.spyOn(element.style, 'setProperty');
    expect(
      lease.withBaseline(
        () => 1000,
        () => true,
        completion
      )
    ).toBe(1000);
    expect(completion).toEqual({ changed: false, restored: true });
    expect(writes).not.toHaveBeenCalled();
    lease.restore();
  });
});
