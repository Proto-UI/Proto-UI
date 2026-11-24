type StyleClaim = { before: string; priority: string; written: string };
const styleOwners = new WeakMap<HTMLElement, Map<string, StyleClaim>>();

/** Claims are identity-owned across synchronous lease handoffs, not merely value-owned. */
export function ownStyles(target: HTMLElement) {
  const fields = new Map<string, StyleClaim>();
  let owners = styleOwners.get(target);
  if (!owners) {
    owners = new Map();
    styleOwners.set(target, owners);
  }
  const currentOwners = owners;
  let lost = false;
  let normalizer: CSSStyleDeclaration | undefined;
  const matches = (name: string, record: StyleClaim) =>
    target.style.getPropertyValue(name) === record.written &&
    target.style.getPropertyPriority(name) === '';
  return {
    isCurrent(): boolean {
      return (
        !lost &&
        Array.from(fields).every(
          ([name, record]) => currentOwners.get(name) === record && matches(name, record)
        )
      );
    },
    write(name: string, value: string): boolean {
      if (lost) return false;
      // setProperty can synchronously invoke a custom element's style callback.
      // Publish the browser-normalized claim first, so reentrant retirement
      // recognizes and restores the write before that callback returns.
      normalizer ??= target.ownerDocument.createElement('div').style;
      normalizer.removeProperty(name);
      normalizer.setProperty(name, value);
      const written = normalizer.getPropertyValue(name);
      if (value !== '' && written === '') return false;
      let record = fields.get(name);
      if (record && (currentOwners.get(name) !== record || !matches(name, record))) {
        lost = true;
        return false;
      }
      if (!record) {
        const prior = currentOwners.get(name);
        const inherit = prior && matches(name, prior);
        record = {
          before: inherit ? prior.before : target.style.getPropertyValue(name),
          priority: inherit ? prior.priority : target.style.getPropertyPriority(name),
          written: '',
        };
        fields.set(name, record);
        currentOwners.set(name, record);
      }
      record.written = written;
      target.style.setProperty(name, value);
      // A nested dispose or replacement must not be undone by this setter's
      // continuation, even when the successor wrote the same serialized value.
      if (fields.get(name) !== record || currentOwners.get(name) !== record) return false;
      if (!matches(name, record)) {
        lost = true;
        return false;
      }
      return true;
    },
    restore() {
      for (const [name, record] of fields) {
        if (currentOwners.get(name) !== record) continue;
        currentOwners.delete(name);
        if (!matches(name, record)) continue;
        if (record.before) target.style.setProperty(name, record.before, record.priority);
        else target.style.removeProperty(name);
      }
      fields.clear();
    },
  };
}

/** Whether this exact field is still held by a live internal geometry claim. */
export function hasOwnedStyle(target: HTMLElement, name: string): boolean {
  const claim = styleOwners.get(target)?.get(name);
  return (
    !!claim &&
    target.style.getPropertyValue(name) === claim.written &&
    target.style.getPropertyPriority(name) === ''
  );
}
