type StyleClaim = {
  before: string;
  priority: string;
  written: string;
  writtenPriority: string;
  revision: number;
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
  let normalizer: CSSStyleDeclaration | undefined;
  const matches = (name: string, record: StyleClaim) =>
    target.style.getPropertyValue(name) === record.written &&
    target.style.getPropertyPriority(name) === record.writtenPriority;
  const isCurrent = () =>
    !lost &&
    Array.from(fields).every(
      ([name, record]) => currentOwners.get(name) === record && matches(name, record)
    );
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
          revision: 0,
        };
        fields.set(name, record);
        currentOwners.set(name, record);
      }
      record.written = written;
      record.writtenPriority = '';
      record.revision++;
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
      const snapshot = Array.from(fields, ([name, record]) => ({
        name,
        record,
        written: record.written,
        priority: record.writtenPriority,
        revision: record.revision,
        suspended: false,
      }));
      const uninterrupted = () =>
        current() &&
        !lost &&
        snapshot.every(
          ({ name, record, revision }) =>
            fields.get(name) === record &&
            currentOwners.get(name) === record &&
            record.revision === revision &&
            matches(name, record)
        );
      const fullyRestored = () =>
        uninterrupted() &&
        snapshot.every(
          ({ record, written, priority }) =>
            record.written === written && record.writtenPriority === priority
        );
      const project = (name: string, value: string, priority: string) => {
        if (value) target.style.setProperty(name, value, priority);
        else target.style.removeProperty(name);
      };
      let result: T | undefined;
      let failed = false;
      let failure: unknown;
      try {
        for (const entry of snapshot) {
          if (!uninterrupted()) break;
          if (
            entry.record.written === entry.record.before &&
            entry.record.writtenPriority === entry.record.priority
          )
            continue;
          entry.record.written = entry.record.before;
          entry.record.writtenPriority = entry.record.priority;
          entry.revision = ++entry.record.revision;
          entry.suspended = true;
          if (completion) completion.changed = true;
          project(entry.name, entry.record.written, entry.record.writtenPriority);
        }
        if (uninterrupted()) result = read();
      } catch (error) {
        failed = true;
        failure = error;
      } finally {
        for (const entry of snapshot) {
          if (!entry.suspended) continue;
          if (!uninterrupted()) break;
          entry.record.written = entry.written;
          entry.record.writtenPriority = entry.priority;
          entry.revision = ++entry.record.revision;
          try {
            project(entry.name, entry.written, entry.priority);
          } catch (error) {
            if (!failed) {
              failed = true;
              failure = error;
            }
          }
        }
        if (completion) completion.restored = fullyRestored();
      }
      if (failed) throw failure;
      return fullyRestored() ? result : undefined;
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
    target.style.getPropertyPriority(name) === claim.writtenPriority
  );
}
