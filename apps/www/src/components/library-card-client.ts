import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { libraryCardPrototypes, libraryActionProps } from './library-card-prototypes';
import { withNativeContentLease } from './PrototypePreviewer/native-content-lease';
import { bindNativeLinkFacts } from './site-native-link-facts';

const bound = new WeakSet<HTMLElement>();
const releases = new WeakMap<ParentNode, () => void>();
export function initLibraryCards(scope: ParentNode = document) {
  if (releases.has(scope)) return releases.get(scope)!;
  const cleanup: Array<() => void> = [];
  const parts = [...scope.querySelectorAll<HTMLElement>('[data-library-part]')];
  // Supply props before definition upgrades connected elements. Default-first
  // painting would otherwise briefly change radius, weight and elevation.
  for (const element of parts) {
    if (bound.has(element)) continue;
    setElementProps(element, JSON.parse(element.dataset.libraryProps ?? '{}'));
    bound.add(element);
  }
  for (const [part, prototype] of Object.entries(libraryCardPrototypes)) {
    const tag = `wc-library-${part}`;
    if (!customElements.get(tag))
      withNativeContentLease(document.documentElement, () => {
        customElements.define(
          tag,
          AdaptToWebComponent(prototype, {
            register: false,
            registerAs: tag,
            getProps: (element) => JSON.parse(element.dataset.libraryProps ?? '{}'),
          })
        );
      });
  }
  for (const link of scope.querySelectorAll<HTMLAnchorElement>('a[data-library-action]')) {
    if (bound.has(link)) continue;
    bound.add(link);
    const surface = link.querySelector<HTMLElement>('[data-library-part]')!;
    cleanup.push(
      bindNativeLinkFacts(link, (facts) =>
        setElementProps(surface, { ...libraryActionProps, ...facts })
      )
    );
    cleanup.push(() => bound.delete(link));
  }
  const release = () => {
    cleanup.forEach((fn) => fn());
    releases.delete(scope);
  };
  releases.set(scope, release);
  return release;
}
