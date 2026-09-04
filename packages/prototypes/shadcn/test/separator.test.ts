import { describe, expect, expectTypeOf, it } from 'vitest';
import { styleContains } from '../../test-utils/style';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import separatorRoot, { shadcnSeparatorRoot } from '../src/separator';
import type { ShadcnSeparatorRootProps } from '../src/separator';

type HasAsChild<Props> = 'asChild' extends keyof Props ? true : false;

AdaptToWebComponent(separatorRoot);

/**
 * Web-host lowering of the two orientation rules. These tokens are evidence that
 * the inherited orientation state reaches the style projection; they are not a
 * portable guarantee of this projection.
 */
const WEB_GEOMETRY_TOKENS = [
  'data-[orientation=horizontal]:h-px',
  'data-[orientation=horizontal]:w-full',
  'data-[orientation=vertical]:h-full',
  'data-[orientation=vertical]:w-px',
];

const UNSCOPED_GEOMETRY_TOKENS = ['h-px', 'w-full', 'h-full', 'w-px'];

describe('prototypes/shadcn: separator', () => {
  it('exposes the Root projection through exact package entries', () => {
    // T-SHADCN-SEPARATOR-0001-CASE-EXPORTS
    expect(shadcnSeparatorRoot).toBe(separatorRoot);
    expect(separatorRoot.name).toBe('shadcn-separator-root');
  });

  it('omits asChild from public props and never substitutes an authored element', async () => {
    // T-SHADCN-SEPARATOR-0001-CASE-AS-CHILD-OMISSION
    expectTypeOf<HasAsChild<ShadcnSeparatorRootProps>>().toEqualTypeOf<false>();

    const el = document.createElement('shadcn-separator-root');
    const candidate = document.createElement('div');
    candidate.dataset.asChildCandidate = '';
    setElementProps(el, { asChild: true } as any);
    el.appendChild(candidate);
    document.body.appendChild(el);
    await Promise.resolve();
    await Promise.resolve();

    expect(el.isConnected).toBe(true);
    expect(el.contains(candidate)).toBe(false);
    expect(el.innerHTML).toBe('');
    el.remove();
  });

  it('inherits decorative defaults and projects the upstream surface', async () => {
    // T-SHADCN-SEPARATOR-0001-CASE-DEFAULTS
    const el = document.createElement('shadcn-separator-root');
    document.body.appendChild(el);
    await Promise.resolve();
    await Promise.resolve();

    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.hasAttribute('role')).toBe(false);
    expect(el.hasAttribute('aria-orientation')).toBe(false);

    for (const token of ['shrink-0', 'bg-border']) {
      expect(styleContains(el, token)).toBe(true);
    }
    el.remove();
  });

  it('inherits dynamic semantic state and reprojects accessible orientation', async () => {
    // T-SHADCN-SEPARATOR-0001-CASE-DYNAMIC-SEMANTICS
    const el = document.createElement('shadcn-separator-root');
    document.body.appendChild(el);
    await Promise.resolve();

    setElementProps(el, { decorative: false, orientation: 'vertical' });
    await Promise.resolve();
    await Promise.resolve();

    expect(el.getAttribute('role')).toBe('separator');
    expect(el.getAttribute('aria-orientation')).toBe('vertical');
    expect(el.getAttribute('aria-hidden')).toBe('false');

    setElementProps(el, { decorative: false, orientation: 'horizontal' });
    await Promise.resolve();
    await Promise.resolve();

    expect(el.getAttribute('aria-orientation')).toBe('horizontal');
    el.remove();
  });

  it('stays contentless and adds no interaction surface', async () => {
    // T-SHADCN-SEPARATOR-0001-CASE-PASSIVE-BOUNDARY
    const el = document.createElement('shadcn-separator-root');
    el.innerHTML = '<span data-authored-child>hidden by decorative semantics</span>';
    document.body.appendChild(el);
    await Promise.resolve();
    await Promise.resolve();

    expect(el.querySelector('[data-authored-child]')).toBeNull();
    expect(el.innerHTML).toBe('');
    expect(el.hasAttribute('tabindex')).toBe(false);
    for (const token of ['pointer-events-none', 'outline-none', 'cursor-pointer']) {
      expect(styleContains(el, token)).toBe(false);
    }
    el.remove();
  });

  it('lowers both orientation rules into conditional web geometry', async () => {
    // T-SHADCN-SEPARATOR-0001-CASE-WEB-GEOMETRY-EVIDENCE
    const el = document.createElement('shadcn-separator-root');
    document.body.appendChild(el);
    await Promise.resolve();
    await Promise.resolve();

    for (const token of WEB_GEOMETRY_TOKENS) {
      expect(styleContains(el, token)).toBe(true);
    }
    for (const token of UNSCOPED_GEOMETRY_TOKENS) {
      expect(styleContains(el, token)).toBe(false);
    }
    el.remove();
  });
});
