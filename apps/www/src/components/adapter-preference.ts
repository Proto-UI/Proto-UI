import { AdapterIds, type PublicRuntimeId } from './PrototypePreviewer/runtimes/registry';
import { selectValue, setSelectValue, type SiteSelectRoot } from './site-shadcn-controls';

export const PREFERRED_ADAPTER_KEY = 'preferred-prototypes-adapter';
export const DEFAULT_ADAPTER: PublicRuntimeId = 'wc';
export const PREFERRED_ADAPTER_EVENT = 'proto-adapter:change';

export type PreferredAdapterChangeDetail = Readonly<{
  adapter: PublicRuntimeId;
}>;

export function isRuntimeId(value: unknown): value is PublicRuntimeId {
  return typeof value === 'string' && AdapterIds.includes(value as PublicRuntimeId);
}

type AdapterSelectControl = HTMLSelectElement | SiteSelectRoot;

const initializedDocuments = new WeakSet<Document>();
const lastKnownAdapterValues = new WeakMap<AdapterSelectControl, string>();

function isNativeSelect(control: AdapterSelectControl): control is HTMLSelectElement {
  return control instanceof HTMLSelectElement;
}

function supportsAdapter(control: AdapterSelectControl, adapter: PublicRuntimeId): boolean {
  if (isNativeSelect(control)) {
    return Array.from(control.options).some((option) => option.value === adapter);
  }
  return Array.from(control.querySelectorAll<HTMLElement>('wc-shadcn-select-item')).some(
    (item) => item.dataset.value === adapter
  );
}

function readControlValue(control: AdapterSelectControl): string {
  return isNativeSelect(control) ? control.value : selectValue(control);
}

function writeControlValue(control: AdapterSelectControl, value: string): void {
  if (isNativeSelect(control)) {
    control.value = value;
  } else {
    setSelectValue(control, value);
  }
}

function preferredAdapter(doc: Document): PublicRuntimeId | null {
  try {
    const stored = doc.defaultView?.localStorage.getItem(PREFERRED_ADAPTER_KEY);
    return isRuntimeId(stored) ? stored : null;
  } catch {
    return null;
  }
}

function initializeAdapterSelect(select: AdapterSelectControl): void {
  if (select.dataset.adapterSelectInit === '1') return;
  select.dataset.adapterSelectInit = '1';

  const stored = preferredAdapter(select.ownerDocument);
  let initialValue = readControlValue(select);
  if (stored && supportsAdapter(select, stored)) {
    writeControlValue(select, stored);
    initialValue = stored;
  } else if (supportsAdapter(select, DEFAULT_ADAPTER)) {
    writeControlValue(select, DEFAULT_ADAPTER);
    initialValue = DEFAULT_ADAPTER;
  } else if (isNativeSelect(select) && select.options.length > 0) {
    select.selectedIndex = 0;
    initialValue = select.value;
  }
  lastKnownAdapterValues.set(select, initialValue);

  const handleChange = (event: Event) => {
    const detail = (event as CustomEvent<{ value?: unknown }>).detail;
    const adapter = typeof detail?.value === 'string' ? detail.value : readControlValue(select);
    if (!isRuntimeId(adapter)) return;
    const previousValue = lastKnownAdapterValues.get(select) ?? readControlValue(select);
    if (!isNativeSelect(select) && previousValue === adapter) return;
    lastKnownAdapterValues.set(select, adapter);
    writeControlValue(select, adapter);
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
  };

  select.addEventListener(isNativeSelect(select) ? 'change' : 'valueChange', handleChange);
}

function synchronizeAdapterSelects(doc: Document, adapter: PublicRuntimeId): void {
  const selects: AdapterSelectControl[] = [
    ...doc.querySelectorAll<HTMLSelectElement>('[data-adapter-select] select'),
    ...doc.querySelectorAll<SiteSelectRoot>(
      '[data-adapter-select] wc-shadcn-select-root[data-adapter-select-root]'
    ),
  ];
  for (const select of selects) {
    if (!supportsAdapter(select, adapter)) continue;
    if (readControlValue(select) === adapter) {
      lastKnownAdapterValues.set(select, adapter);
      continue;
    }
    writeControlValue(select, adapter);
    lastKnownAdapterValues.set(select, adapter);
    if (select.closest('[data-previewer-id]')) {
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}

export function initAdapterSelects(root: ParentNode): void {
  const selects: AdapterSelectControl[] = [
    ...root.querySelectorAll<HTMLSelectElement>('[data-adapter-select] select'),
    ...root.querySelectorAll<SiteSelectRoot>(
      '[data-adapter-select] wc-shadcn-select-root[data-adapter-select-root]'
    ),
  ];
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
