export interface Preferences {
  displayName: string;
}

const storageKey = 'consumer-study-preferences';

export function readPreferences(): Preferences {
  const stored = localStorage.getItem(storageKey);
  if (stored === null) return { displayName: 'Taylor' };
  const value: unknown = JSON.parse(stored);
  if (value === null || typeof value !== 'object' || !('displayName' in value) || typeof value.displayName !== 'string') {
    throw new Error('Stored preferences have an invalid display name');
  }
  return { displayName: value.displayName };
}

export async function savePreferences(preferences: Preferences, options: { fail: boolean }): Promise<Preferences> {
  const next = { displayName: preferences.displayName.trim() };
  if (!next.displayName) throw new Error('Enter a display name');
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, 600);
  await promise;
  if (options.fail) throw new Error('Injected storage error');
  localStorage.setItem(storageKey, JSON.stringify(next));
  return next;
}
