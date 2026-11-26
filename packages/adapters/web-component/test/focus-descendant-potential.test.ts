import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasWebComponentScopeDescendant } from '../src/focus-scope-targets';
import { isWebComponentNativeFocusCandidate as nativeCandidate } from '../src/native-focus-candidate';

const originalCheck = Object.getOwnPropertyDescriptor(Element.prototype, 'checkVisibility');

afterEach(() => {
  vi.restoreAllMocks();
  if (originalCheck) Object.defineProperty(Element.prototype, 'checkVisibility', originalCheck);
  else Reflect.deleteProperty(Element.prototype, 'checkVisibility');
  document.body.replaceChildren();
});

function fixture(contents: string) {
  const outside = document.createElement('div');
  const scope = document.createElement('div');
  scope.innerHTML = contents;
  outside.append(scope);
  document.body.append(outside);
  return { outside, scope };
}

function check(value = true) {
  const method = vi.fn(() => value);
  Object.defineProperty(Element.prototype, 'checkVisibility', {
    configurable: true,
    value: method,
  });
  return method;
}

describe('WC descendant existence before native style sampling', () => {
  it('projects a text/decorative-only entry without forcing native visibility or style', () => {
    const { scope } = fixture('<span>Label</span><svg><path d="M0 0L1 1" /></svg>');
    const native = check();
    const reads = vi.spyOn(window, 'getComputedStyle');
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(false);
    expect(native).not.toHaveBeenCalled();
    expect(reads).not.toHaveBeenCalled();
  });

  it('takes a fresh candidate set after append, eligibility changes and removal', () => {
    const { scope } = fixture('<span>Label</span>');
    const native = check();
    const button = document.createElement('button');
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(false);
    scope.append(button);
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(true);
    button.setAttribute('tabindex', '-1');
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(false);
    button.removeAttribute('tabindex');
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(true);
    button.remove();
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(false);
    expect(native).toHaveBeenCalledTimes(2);
  });

  it.each(['hidden', 'inert'] as const)('keeps the external %s barrier', (attribute) => {
    const { outside, scope } = fixture('<button>Inside</button>');
    const native = check();
    outside.setAttribute(attribute, '');
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(false);
    expect(native).not.toHaveBeenCalled();
    outside.removeAttribute(attribute);
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(true);
  });

  it('keeps negative native visibility and display:contents fallback behavior', () => {
    const { outside, scope } = fixture('<button>Inside</button>');
    const native = check(false);
    scope.style.display = 'contents';
    outside.style.display = 'none';
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(false);
    outside.style.display = 'block';
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(true);
    expect(native).toHaveBeenCalledTimes(2);
  });

  it('keeps visibility overrides and opacity out of subtree pruning', () => {
    const { outside, scope } = fixture('<button style="visibility:visible">Inside</button>');
    check();
    outside.style.visibility = 'hidden';
    outside.style.opacity = '0';
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(true);
    scope.querySelector('button')!.style.visibility = 'hidden';
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(false);
  });

  it('keeps disabled and hidden native input exclusions in the complete sampler', () => {
    const { scope } = fixture('<input type="hidden"><button disabled>Disabled</button>');
    check();
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(false);
    scope.querySelector('button')!.disabled = false;
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(true);
  });

  it('keeps the closed-details branch decision in the complete sampler', () => {
    const { scope } = fixture(
      '<details><summary>Summary</summary><button>Hidden</button></details>'
    );
    check();
    const details = scope.querySelector('details')!;
    details.querySelector('summary')!.setAttribute('tabindex', '-1');
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(false);
    details.open = true;
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(true);
  });

  it('retains nested open roots and their negative host scope boundary', () => {
    const { scope } = fixture('<div id="owner"></div>');
    check();
    const owner = scope.querySelector<HTMLElement>('#owner')!;
    owner.attachShadow({ mode: 'open' }).innerHTML = '<button>Inside</button>';
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(true);
    owner.setAttribute('tabindex', '-1');
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(false);
    owner.removeAttribute('tabindex');
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(true);
  });

  it('retains actual slot assignment and fallback candidates', () => {
    const { scope } = fixture('<button slot="content">Assigned</button>');
    check();
    scope.attachShadow({ mode: 'open' }).innerHTML =
      '<slot name="content"><button>Fallback</button></slot>';
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(true);
    scope.querySelector('button')!.remove();
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(true);
    scope.shadowRoot!.querySelector('button')!.remove();
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(false);
  });

  it('retains explicit SVG tabindex and editing-host candidates', () => {
    const { scope } = fixture('<svg><rect tabindex="0" /></svg>');
    check();
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(true);
    scope.innerHTML = '<div contenteditable="plaintext-only">Editable</div>';
    expect(hasWebComponentScopeDescendant(scope, nativeCandidate)).toBe(true);
  });

  it('reuses a pure native predicate only inside one fresh synchronous sample', () => {
    const { scope } = fixture('<div id="custom"></div>');
    check();
    const custom = scope.querySelector<HTMLElement>('#custom')!;
    let enabled = true;
    const predicate = vi.fn((element: HTMLElement) => element === custom && enabled);
    expect(hasWebComponentScopeDescendant(scope, predicate)).toBe(true);
    expect(predicate.mock.calls.filter(([element]) => element === custom)).toHaveLength(1);
    enabled = false;
    expect(hasWebComponentScopeDescendant(scope, predicate)).toBe(false);
    expect(predicate.mock.calls.filter(([element]) => element === custom)).toHaveLength(2);
  });

  it('preserves an effectful custom predicate call order and result', () => {
    const { scope } = fixture('<span id="leaf">Label</span>');
    scope.id = 'scope';
    check();
    const calls: string[] = [];
    const predicate = (element: HTMLElement) => {
      calls.push(element.id);
      return calls.length === 1;
    };
    expect(hasWebComponentScopeDescendant(scope, predicate)).toBe(false);
    expect(calls).toEqual(['scope', 'leaf']);
  });

  it.each(['hidden', 'inert', 'display'] as const)(
    'does not call a custom predicate before the existing %s early return',
    (boundary) => {
      const { outside, scope } = fixture('<span>Label</span>');
      check(false);
      if (boundary === 'hidden') scope.hidden = true;
      else if (boundary === 'inert') outside.setAttribute('inert', '');
      else outside.style.display = 'none';
      const predicate = vi.fn(() => {
        throw new Error('custom predicate must remain uncalled');
      });
      expect(hasWebComponentScopeDescendant(scope, predicate)).toBe(false);
      expect(predicate).not.toHaveBeenCalled();
    }
  );

  it('keeps DOM changes made by a custom predicate in the original traversal', () => {
    const { scope } = fixture('<span id="leaf">Label</span>');
    scope.id = 'scope';
    check();
    const added = document.createElement('div');
    added.id = 'added';
    const calls: string[] = [];
    const predicate = (element: HTMLElement) => {
      calls.push(element.id);
      if (element === scope) scope.append(added);
      return element === added;
    };
    expect(hasWebComponentScopeDescendant(scope, predicate)).toBe(true);
    expect(calls).toEqual(['scope', 'leaf', 'added']);
  });

  it.each(['wrapper', 'bound'] as const)(
    'keeps an Adapter predicate %s on the original complete path',
    (kind) => {
      const { scope } = fixture('<span>Label</span>');
      const native = check();
      const reads = vi.spyOn(window, 'getComputedStyle');
      const predicate =
        kind === 'wrapper'
          ? (element: HTMLElement) => nativeCandidate(element)
          : nativeCandidate.bind(undefined);
      expect(hasWebComponentScopeDescendant(scope, predicate)).toBe(false);
      expect(native).toHaveBeenCalledOnce();
      expect(reads.mock.calls.some(([element]) => element === scope)).toBe(true);
    }
  );
});
