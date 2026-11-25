type StyleClaim = {
  before: string;
  priority: string;
  written: string;
  writtenPriority: string;
};
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
  let revision = 0;
  let normalizer: CSSStyleDeclaration | undefined;
  const matches = (name: string, record: StyleClaim) =>
    target.style.getPropertyValue(name) === record.written &&
    target.style.getPropertyPriority(name) === record.writtenPriority;
  const isCurrent = () => {
    if (lost) return false;
    for (const [name, record] of fields) {
      if (currentOwners.get(name) !== record || !matches(name, record)) return false;
    }
    return true;
  };
  const project = (name: string, value: string, priority: string) => {
    if (value) target.style.setProperty(name, value, priority);
    else target.style.removeProperty(name);
  };
  return {
    isCurrent,
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
          writtenPriority: '',
        };
        fields.set(name, record);
        currentOwners.set(name, record);
      }
      record.written = written;
      record.writtenPriority = '';
      revision++;
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
    /** Measure authored styles synchronously without releasing claim identity.
     * A setter can reenter and replace even an equal-valued claim. Only the
     * uninterrupted snapshot may put its projected values back. */
    withBaseline<T>(
      read: () => T,
      current: () => boolean,
      completion?: { changed: boolean; restored: boolean }
    ): T | undefined {
      if (completion) {
        completion.changed = false;
        completion.restored = false;
      }
      if (!current() || !isCurrent()) return undefined;
      // Any write on this lease changes the measurement inputs, including
      // a new field that was absent when the measurement began.
      let expectedRevision = revision;
      const uninterrupted = () => current() && revision === expectedRevision && isCurrent();
      const suspended: { name: string; record: StyleClaim; value: string; priority: string }[] = [];
      let result: T | undefined;
      let failure: { error: unknown } | undefined;
      let restored = false;
      try {
        for (const [name, record] of fields) {
          if (!uninterrupted()) break;
          if (record.written === record.before && record.writtenPriority === record.priority)
            continue;
          suspended.push({ name, record, value: record.written, priority: record.writtenPriority });
          record.written = record.before;
          record.writtenPriority = record.priority;
          expectedRevision = ++revision;
          if (completion) completion.changed = true;
          project(name, record.written, record.writtenPriority);
        }
        if (uninterrupted()) result = read();
      } catch (error) {
        failure = { error };
      } finally {
        let resumed = 0;
        for (const { name, record, value, priority } of suspended) {
          if (!uninterrupted()) break;
          record.written = value;
          record.writtenPriority = priority;
          expectedRevision = ++revision;
          resumed++;
          try {
            project(name, value, priority);
          } catch (error) {
            failure ??= { error };
          }
        }
        restored = resumed === suspended.length && uninterrupted();
        if (completion) completion.restored = restored;
      }
      if (failure) throw failure.error;
      return restored ? result : undefined;
    },
    restore() {
      if (fields.size) revision++;
      for (const [name, record] of fields) {
        if (currentOwners.get(name) !== record) continue;
        currentOwners.delete(name);
        if (matches(name, record)) project(name, record.before, record.priority);
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
    target.style.getPropertyPriority(name) === claim.writtenPriority
  );
}
