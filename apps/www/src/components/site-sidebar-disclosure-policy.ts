/* Compatibility portions adapted from @astrojs/starlight 0.35.3.
 * Source: https://github.com/withastro/starlight/tree/@astrojs/starlight@0.35.3/packages/starlight
 * MIT License
 *
 * Copyright (c) 2023 [Astro contributors](https://github.com/withastro/starlight/graphs/contributors)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
/** Application persistence for native details; never a second disclosure or
 * current-link controller. No keyboard interpretation, focus or scroll writes. */
export type SidebarPolicyEntry = {
  type: 'link' | 'group';
  href?: string;
  label?: string;
  entries?: SidebarPolicyEntry[];
  collapsed?: boolean;
};

/** Canonical route identity survives translated labels and sibling reordering.
 * An anchor route change deliberately invalidates that group lineage. */
export function sidebarGroupIdentities(
  entries: readonly SidebarPolicyEntry[],
  locales: readonly string[]
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const canonical = (href: string): string => {
    if (!href.startsWith('/') || href.startsWith('//')) throw new Error('Non-local Sidebar anchor');
    const path = href.split(/[?#]/, 1)[0]!.split('/').filter(Boolean);
    if (locales.includes(path[0]!)) path.shift();
    return '/' + path.join('/');
  };
  const firstLink = (nodes: readonly SidebarPolicyEntry[]): string | undefined => {
    for (const entry of nodes) {
      if (entry.type === 'link' && entry.href) return canonical(entry.href);
      const nested = entry.entries && firstLink(entry.entries);
      if (nested) return nested;
    }
  };
  const visit = (nodes: readonly SidebarPolicyEntry[], ancestors: string[]) => {
    for (const entry of nodes) {
      if (entry.type !== 'group') continue;
      const anchor = firstLink(entry.entries ?? []);
      if (!anchor) throw new Error('Sidebar group has no canonical route');
      const lineage = [...ancestors, anchor];
      const id = JSON.stringify(lineage);
      if (seen.has(id)) throw new Error(`Duplicate Sidebar group identity: ${id}`);
      seen.add(id);
      result.push(id);
      visit(entry.entries ?? [], lineage);
    }
  };
  visit(entries, []);
  return result;
}

function canonicalSidebarRoute(href: string, locales: readonly string[]): string {
  if (!href.startsWith('/') || href.startsWith('//')) return '';
  const segments = href.split(/[?#]/, 1)[0]!.split('/').filter(Boolean);
  if (locales.includes(segments[0]!)) segments.shift();
  return '/' + segments.join('/');
}
function isUiLibrariesGroup(entry: SidebarPolicyEntry, locales: readonly string[]): boolean {
  const routes: string[] = [];
  const collect = (entries: readonly SidebarPolicyEntry[]) => {
    for (const child of entries) {
      if (child.type === 'link') routes.push(canonicalSidebarRoute(child.href ?? '', locales));
      else collect(child.entries ?? []);
    }
  };
  collect(entry.entries ?? []);
  return (
    routes.length > 0 &&
    routes.every((route) => route === '/ui-libraries' || route.startsWith('/ui-libraries/'))
  );
}
/** Scope is authored canonical routes, never translated group labels or position. */
export function sidebarManagedGroups(
  entries: readonly SidebarPolicyEntry[],
  locales: readonly string[]
): boolean[] {
  const mask: boolean[] = [];
  const visit = (nodes: readonly SidebarPolicyEntry[]) => {
    for (const entry of nodes)
      if (entry.type === 'group') {
        mask.push(isUiLibrariesGroup(entry, locales));
        visit(entry.entries ?? []);
      }
  };
  visit(entries);
  return mask;
}
export function collapsedSidebar<T extends SidebarPolicyEntry>(
  entries: readonly T[],
  locales: readonly string[] = []
): T[] {
  return entries.map((entry) =>
    entry.type === 'group'
      ? {
          ...entry,
          ...(isUiLibrariesGroup(entry, locales) ? { collapsed: true } : {}),
          entries: collapsedSidebar(entry.entries ?? [], locales),
        }
      : { ...entry }
  );
}
/** Compatibility with @astrojs/starlight 0.35.3 utils/navigation.ts getSidebarHash
 * (MIT, withastro/starlight). This public-data hash is NOT identity or security.
 * Retain the existing SidebarPersistState session writer; no private import. */
export function legacySidebarHash(entries: readonly SidebarPolicyEntry[]): string {
  const identity = (nodes: readonly SidebarPolicyEntry[]): string =>
    nodes
      .map((entry) =>
        entry.type === 'group'
          ? (entry.label ?? '') + identity(entry.entries ?? [])
          : (entry.label ?? '') + (entry.href ?? '')
      )
      .join('');
  const text = identity(entries);
  let hash = 0;
  for (let index = 0; index < text.length; index++)
    hash = (hash << 5) - hash + text.charCodeAt(index);
  return (hash >>> 0).toString(36).padStart(7, '0');
}

/** Native policy bootstrap lease: read-only layout arbitration; never a second
 * disclosure owner. Pending default actions must settle before reveal decides. */
export type SidebarRevealIntent = 'none' | 'pending' | 'manual';
export type SidebarDisclosureLease = {
  dispose(): void;
  readIntent(): SidebarRevealIntent;
  afterSettled(callback: (status: 'settled' | 'retired') => void): () => void;
};
export function sidebarDisclosureLease(boundary: HTMLElement): SidebarDisclosureLease | undefined {
  const root = boundary.matches('[data-site-sidebar-policy]')
    ? boundary
    : boundary.querySelector<HTMLElement>('[data-site-sidebar-policy]');
  if (
    !root?.isConnected ||
    !boundary.contains(root) ||
    root.dataset.siteSidebarPolicyRoute !== root.ownerDocument.defaultView?.location.pathname
  )
    return;
  const value = (root as HTMLElement & { [key: symbol]: unknown })[
    Symbol.for('proto-ui.site-sidebar-disclosure.v1')
  ] as Partial<SidebarDisclosureLease> | undefined;
  if (
    typeof value?.readIntent !== 'function' ||
    typeof value.dispose !== 'function' ||
    typeof value.afterSettled !== 'function'
  )
    return;
  return value as SidebarDisclosureLease;
}
export function sidebarHasCurrentManualIntent(boundary: HTMLElement): boolean {
  return sidebarDisclosureLease(boundary)?.readIntent() === 'manual';
}
