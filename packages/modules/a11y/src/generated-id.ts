export type GeneratedIdLease = Readonly<{ dispose(): void }>;

type GeneratedIdAuthority = Readonly<{
  version: 1;
  own(element: Element, id: string, baseline: string | null): GeneratedIdLease;
  retain(element: Element, id: string): GeneratedIdLease | null;
}>;

/** Shared physical ID lifetime only; it neither resolves nor admits semantic refs. */
function generatedIdAuthority(): GeneratedIdAuthority {
  const key = Symbol.for('@proto.ui/a11y/generated-id/v1');
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
  if (descriptor) {
    const service = descriptor.value as GeneratedIdAuthority | undefined;
    if (
      descriptor.get ||
      descriptor.set ||
      descriptor.configurable ||
      descriptor.writable ||
      !service ||
      !Object.isFrozen(service) ||
      service.version !== 1 ||
      typeof service.own !== 'function' ||
      typeof service.retain !== 'function'
    )
      throw new TypeError('[A11y] incompatible same-realm generated-ID ABI; expected v1');
    return service;
  }
  type Entry = { baseline: string | null; owners: Set<object> };
  const entries = new WeakMap<Element, Map<string, Entry>>();
  const lease = (element: Element, id: string, entry: Entry): GeneratedIdLease => {
    const owner = {};
    entry.owners.add(owner);
    return Object.freeze({
      dispose() {
        if (!entry.owners.delete(owner) || entry.owners.size) return;
        const byId = entries.get(element);
        if (byId?.get(id) !== entry) return;
        // Clear ownership before host writes can reenter with a successor.
        byId.delete(id);
        if (!byId.size) entries.delete(element);
        if (element.getAttribute('id') !== id) return;
        try {
          if (entry.baseline === null) element.removeAttribute('id');
          else element.setAttribute('id', entry.baseline);
        } catch (error) {
          // Preserve generated provenance for a later acquisition if the host
          // refused cleanup. Do not replace a successor's independently installed receipt.
          try {
            if (
              element.getAttribute('id') === id &&
              !entry.owners.size &&
              !entries.get(element)?.has(id)
            ) {
              let retry = entries.get(element);
              if (!retry) entries.set(element, (retry = new Map()));
              retry.set(id, entry);
            }
          } catch {
            /* Preserve the original host cleanup failure. */
          }
          throw error;
        }
      },
    });
  };
  const service: GeneratedIdAuthority = Object.freeze({
    version: 1 as const,
    own(element: Element, id: string, baseline: string | null) {
      const current = element.getAttribute('id');
      if (!id || (current !== id && current !== baseline))
        throw new Error('[A11y] generated-ID ownership requires the current physical baseline');
      let byId = entries.get(element);
      if (!byId) entries.set(element, (byId = new Map()));
      let entry = byId.get(id);
      if (!entry) byId.set(id, (entry = { baseline, owners: new Set() }));
      // Publish the receipt before the physical write: a synchronous host reaction
      // may install a successor which must retain this generated ID, never mistake it for authored data.
      const receipt = lease(element, id, entry);
      try {
        if (current !== id) element.setAttribute('id', id);
        if (element.getAttribute('id') !== id)
          throw new Error('[A11y] generated-ID write was superseded by the host');
        return receipt;
      } catch (error) {
        try {
          receipt.dispose();
        } catch {
          /* The acquisition failure remains primary. */
        }
        throw error;
      }
    },
    retain(element: Element, id: string) {
      if (!id || element.getAttribute('id') !== id) return null;
      const entry = entries.get(element)?.get(id);
      return entry ? lease(element, id, entry) : null;
    },
  });
  Object.defineProperty(globalThis, key, { value: service });
  return service;
}

export function ownGeneratedId(
  element: Element,
  id: string,
  baseline: string | null
): GeneratedIdLease {
  return generatedIdAuthority().own(element, id, baseline);
}

export function retainGeneratedId(element: Element, id: string): GeneratedIdLease | null {
  return generatedIdAuthority().retain(element, id);
}
