import type { Prototype } from '@proto.ui/core';
import type { WebComponentAdapterConstructor } from '@proto.ui/adapter-web-component';

const marker = 'data-library-style-seed';
const style = 'data-pui-style';
const readTokens = (element: HTMLElement) =>
  (element.getAttribute(style) ?? '').split(/\s+/).filter(Boolean);
const writeTokens = (element: HTMLElement, tokens: string[]) => {
  if (tokens.length) element.setAttribute(style, tokens.join(' '));
  else element.removeAttribute(style);
};

/** The Library's server renderer owns this explicit seed. Retire that
 * contribution before the Adapter acquires its first physical view, so later
 * Rule changes can replace it. Ordinary external tokens remain unowned here.
 * This is consumer markup bookkeeping, not general Adapter hydration.
 */
export function withLibraryStyleSeed<T extends Prototype<any, any>>(
  Adapter: WebComponentAdapterConstructor<T>
): WebComponentAdapterConstructor<T> {
  const connect: unknown = Reflect.get(Adapter.prototype, 'connectedCallback');
  if (typeof connect !== 'function') throw new Error('Library Adapter has no connection hook');
  const acquired = new WeakSet<HTMLElement>();
  return class extends Adapter {
    connectedCallback() {
      if (acquired.has(this)) {
        Reflect.apply(connect, this, []);
        return;
      }
      acquired.add(this);
      const serialized = this.getAttribute(marker);
      let seed: unknown;
      try {
        seed = serialized === null ? null : JSON.parse(serialized);
      } catch {
        seed = null;
      }
      const declared =
        Array.isArray(seed) &&
        seed.every((token) => typeof token === 'string' && token.length > 0 && !/\s/.test(token))
          ? new Set<string>(seed)
          : null;
      const original = readTokens(this);
      const removed = declared ? original.filter((token) => declared.has(token)) : [];
      if (removed.length)
        writeTokens(
          this,
          original.filter((token) => !declared!.has(token))
        );
      try {
        Reflect.apply(connect, this, []);
        if (declared && this.getAttribute(marker) === serialized) this.removeAttribute(marker);
      } catch (error) {
        acquired.delete(this);
        // Restore only our withdrawn contribution. A failing/reentrant host
        // may have added external tokens; never replace its whole attribute.
        if (removed.length && this.getAttribute(marker) === serialized) {
          writeTokens(this, [...new Set([...readTokens(this), ...removed])]);
        }
        throw error;
      }
    }
  };
}
