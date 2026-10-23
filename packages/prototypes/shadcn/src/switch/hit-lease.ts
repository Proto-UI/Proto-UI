/** Private lifecycle glue for the family-owned visual acquisition lease. */
export function createSwitchHitLease(shouldAcquire: () => boolean, register: () => () => void) {
  let current: (() => void) | null = null;
  let acquiring = false;
  const release = () => {
    const previous = current;
    current = null;
    previous?.();
  };
  const sync = () => {
    if (!shouldAcquire()) {
      release();
      return;
    }
    if (current || acquiring) return;
    acquiring = true;
    let acquired: (() => void) | undefined;
    try {
      acquired = register();
    } finally {
      acquiring = false;
    }
    // Host materialization is synchronous but may reenter user-provided host
    // callbacks. Never publish a lease whose source retired during acquisition.
    if (shouldAcquire()) current = acquired;
    else acquired();
  };
  return { sync, release };
}
