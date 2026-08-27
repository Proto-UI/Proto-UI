import { AdapterIds, type PublicRuntimeId } from './PrototypePreviewer/runtimes/registry';

export const PREFERRED_ADAPTER_KEY = 'preferred-prototypes-adapter';
export const DEFAULT_ADAPTER: PublicRuntimeId = 'wc';
export const PREFERRED_ADAPTER_EVENT = 'proto-adapter:change';

export type PreferredAdapterChangeDetail = Readonly<{
  adapter: PublicRuntimeId;
}>;

export function isRuntimeId(value: unknown): value is PublicRuntimeId {
  return typeof value === 'string' && AdapterIds.includes(value as PublicRuntimeId);
}

const initializedDocuments = new WeakSet<Document>();

function supportsAdapter(select: HTMLSelectElement, adapter: PublicRuntimeId): boolean {
  return Array.from(select.options).some((option) => option.value === adapter);
}

function preferredAdapter(doc: Document): PublicRuntimeId | null {
  try {
    const stored = doc.defaultView?.localStorage.getItem(PREFERRED_ADAPTER_KEY);
    return isRuntimeId(stored) ? stored : null;
  } catch {
    return null;
  }
}

function initializeAdapterSelect(select: HTMLSelectElement): void {
  if (select.dataset.adapterSelectInit === '1') return;
  select.dataset.adapterSelectInit = '1';

  const stored = preferredAdapter(select.ownerDocument);
  if (stored && supportsAdapter(select, stored)) {
    select.value = stored;
  } else if (supportsAdapter(select, DEFAULT_ADAPTER)) {
    select.value = DEFAULT_ADAPTER;
  } else if (select.options.length > 0) {
    select.selectedIndex = 0;
  }

  select.addEventListener('change', () => {
    const adapter = select.value;
    if (!isRuntimeId(adapter)) return;
    try {
      select.ownerDocument.defaultView?.localStorage.setItem(PREFERRED_ADAPTER_KEY, adapter);
    } catch {
      // Storage can be unavailable without disabling the in-document preference channel.
    }
    select.ownerDocument.dispatchEvent(
      new CustomEvent<PreferredAdapterChangeDetail>(PREFERRED_ADAPTER_EVENT, {
        detail: { adapter },
      })
    );
  });
}

function synchronizeAdapterSelects(doc: Document, adapter: PublicRuntimeId): void {
  const selects = doc.querySelectorAll<HTMLSelectElement>('[data-adapter-select] select');
  for (const select of selects) {
    if (!supportsAdapter(select, adapter) || select.value === adapter) continue;
    select.value = adapter;
    if (select.closest('[data-previewer-id]')) {
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}

export function initAdapterSelects(root: ParentNode): void {
  const selects = root.querySelectorAll<HTMLSelectElement>('[data-adapter-select] select');
  for (const select of selects) initializeAdapterSelect(select);

  const node = root as Node;
  const doc = node.nodeType === 9 ? (root as Document) : node.ownerDocument;
  if (!doc || initializedDocuments.has(doc)) return;
  initializedDocuments.add(doc);
  doc.addEventListener(PREFERRED_ADAPTER_EVENT, (event) => {
    const adapter = (event as CustomEvent<PreferredAdapterChangeDetail>).detail?.adapter;
    if (isRuntimeId(adapter)) synchronizeAdapterSelects(doc, adapter);
  });
}
