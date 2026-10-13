import type { ScrollSurfaceHostAttachment } from '../caps';

const properties = ['overflow-x', 'overflow-y', 'scrollbar-width'] as const;
type Value = { value: string; priority: string };
const read = (style: CSSStyleDeclaration, name: string): Value => ({
  value: style.getPropertyValue(name),
  priority: style.getPropertyPriority(name),
});
const equal = (a: Value, b: Value) => a.value === b.value && a.priority === b.priority;
export class ScrollPolicyOwnershipError extends Error {
  readonly code = 'PUI_SCROLL_OWNERSHIP_CONFLICT';
  constructor() {
    super('[Scroll] scroll policy has a conflicting physical owner.');
  }
}
/** One atomic, guarded policy owner; it does not interpret CSS as Scroll intent. */
export function createScrollPolicyLease(target: HTMLElement) {
  const style = target.style;
  const original = new Map(properties.map((name) => [name, read(style, name)]));
  const originalAttribute = target.getAttribute('data-pui-scroll-projection');
  const owned = new Map<string, Value>();
  let ownedAttribute: string | null = null;
  let disposed = false;
  // Reject explicit inline shorthand and longhand owners before any projection.
  if (
    style.getPropertyValue('overflow') ||
    properties.some((name) => original.get(name)!.value) ||
    originalAttribute !== null
  )
    throw new ScrollPolicyOwnershipError();
  const valid = () =>
    !disposed &&
    properties.every((name) => equal(read(style, name), owned.get(name) ?? original.get(name)!)) &&
    target.getAttribute('data-pui-scroll-projection') === (ownedAttribute ?? originalAttribute);
  const release = () => {
    if (disposed) return;
    disposed = true;
    let failed = false;
    let failure: unknown;
    const attempt = (action: () => void) => {
      try {
        action();
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
      }
    };
    for (const name of properties)
      attempt(() => {
        const last = owned.get(name);
        if (!last || !equal(read(style, name), last)) return;
        const before = original.get(name)!;
        if (before.value) style.setProperty(name, before.value, before.priority);
        else style.removeProperty(name);
      });
    attempt(() => {
      if (
        ownedAttribute === null ||
        target.getAttribute('data-pui-scroll-projection') !== ownedAttribute
      )
        return;
      if (originalAttribute === null) target.removeAttribute('data-pui-scroll-projection');
      else target.setAttribute('data-pui-scroll-projection', originalAttribute);
    });
    owned.clear();
    ownedAttribute = null;
    if (failed) throw failure;
  };
  return {
    valid,
    project(connection: ScrollSurfaceHostAttachment) {
      if (!valid()) throw new ScrollPolicyOwnershipError();
      const values = [
        connection.config.axes === 'vertical' ? 'hidden' : 'auto',
        connection.config.axes === 'horizontal' ? 'hidden' : 'auto',
        connection.projection === 'composed' ? 'none' : 'auto',
      ];
      try {
        for (let i = 0; i < properties.length; i++) {
          const name = properties[i]!;
          style.setProperty(name, values[i]!);
          owned.set(name, read(style, name));
        }
        target.setAttribute('data-pui-scroll-projection', connection.projection);
        ownedAttribute = connection.projection;
      } catch (error) {
        try {
          release();
        } catch {
          /* preserve initiating projection error */
        }
        throw error;
      }
    },
    release,
  };
}
