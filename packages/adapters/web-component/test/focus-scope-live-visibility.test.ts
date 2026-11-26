import { afterEach, describe, expect, it, vi } from 'vitest';
import { sampleWebComponentScopeTargets } from '../src/focus-scope-targets';

const originalCheck = Object.getOwnPropertyDescriptor(Element.prototype, 'checkVisibility');

afterEach(() => {
  vi.restoreAllMocks();
  if (originalCheck) Object.defineProperty(Element.prototype, 'checkVisibility', originalCheck);
  else Reflect.deleteProperty(Element.prototype, 'checkVisibility');
  document.body.replaceChildren();
});

function nativeCheck(value: Element['checkVisibility'] | undefined) {
  Object.defineProperty(Element.prototype, 'checkVisibility', {
    configurable: true,
    value,
  });
}

function fixture() {
  const outside = document.createElement('div');
  const scope = document.createElement('div');
  const button = document.createElement('button');
  button.tabIndex = 0;
  scope.append(button);
  outside.append(scope);
  document.body.append(outside);
  return { outside, scope, button };
}

describe('WC fresh native external-ancestor visibility', () => {
  it('uses a positive native fact without sampling each external ancestor style', () => {
    const { outside, scope, button } = fixture();
    const check = vi.fn(function (this: Element) {
      expect(this).toBe(scope);
      return true;
    });
    nativeCheck(check);
    const reads = vi.spyOn(window, 'getComputedStyle');

    expect(sampleWebComponentScopeTargets(scope).targets).toEqual([button]);
    expect(check).toHaveBeenCalledOnce();
    expect(reads.mock.calls.some(([element]) => element === outside)).toBe(false);
    // Eligible descendants still get their own complete live style checks.
    expect(reads.mock.calls.some(([element]) => element === button)).toBe(true);
  });

  it('does not let an instance member impersonate the owning realm method', () => {
    const { outside, scope } = fixture();
    outside.style.display = 'none';
    const member = vi.fn(() => true);
    Object.defineProperty(scope, 'checkVisibility', { value: member, configurable: true });
    nativeCheck(() => false);

    expect(sampleWebComponentScopeTargets(scope).targets).toEqual([]);
    expect(member).not.toHaveBeenCalled();
  });

  it('keeps the style fallback when the native fact is negative', () => {
    const { outside, scope } = fixture();
    outside.style.contentVisibility = 'hidden';
    nativeCheck(() => false);

    expect(sampleWebComponentScopeTargets(scope).targets).toEqual([]);
    outside.style.contentVisibility = 'visible';
    expect(sampleWebComponentScopeTargets(scope).targets).toHaveLength(1);
  });

  it('keeps display:contents descendants when the native box check is negative', () => {
    const { scope, button } = fixture();
    scope.style.display = 'contents';
    nativeCheck(() => false);

    expect(sampleWebComponentScopeTargets(scope).targets).toEqual([button]);
  });

  it('keeps the original fallback in a realm without checkVisibility', () => {
    const { outside, scope, button } = fixture();
    nativeCheck(undefined);
    outside.style.display = 'none';
    expect(sampleWebComponentScopeTargets(scope).targets).toEqual([]);
    outside.style.display = 'block';
    expect(sampleWebComponentScopeTargets(scope).targets).toEqual([button]);
  });

  it.each(['inert', 'hidden'] as const)(
    'checks the native %s boundary before any positive visibility shortcut',
    (attribute) => {
      const { outside, scope } = fixture();
      outside.setAttribute(attribute, '');
      const check = vi.fn(() => true);
      nativeCheck(check);

      expect(sampleWebComponentScopeTargets(scope).targets).toEqual([]);
      expect(check).not.toHaveBeenCalled();
    }
  );

  it('keeps the closed-details barrier ahead of the native box check', () => {
    const { outside, scope } = fixture();
    const details = document.createElement('details');
    details.append(document.createElement('summary'), outside);
    document.body.append(details);
    const check = vi.fn(() => true);
    nativeCheck(check);

    expect(sampleWebComponentScopeTargets(scope).targets).toEqual([]);
    expect(check).not.toHaveBeenCalled();
  });

  it('keeps the first summary branch of closed details eligible', () => {
    const { outside, scope, button } = fixture();
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.append(outside);
    details.append(summary);
    document.body.append(details);
    nativeCheck(() => true);

    expect(sampleWebComponentScopeTargets(scope).targets).toEqual([button]);
  });

  it('does not turn visibility inheritance into a subtree pruning rule', () => {
    const { outside, scope, button } = fixture();
    outside.style.visibility = 'hidden';
    button.style.visibility = 'visible';
    nativeCheck(() => true);

    expect(sampleWebComponentScopeTargets(scope).targets).toEqual([button]);
  });
});
