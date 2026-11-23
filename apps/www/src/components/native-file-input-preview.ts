import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { nativeFileInput } from '@proto.ui/prototypes-base/native-file-input';

// This page demonstrates the real public prototype on an explicit native root.
// It is a React Adapter example; Compiler consumer evidence is a separate scope.
const NativeFileInput = createReactAdapter(React)(nativeFileInput, { rootTag: 'input' });
const mounted = new Map<HTMLElement, Root>();
const documents = new WeakSet<Document>();

function Picker({
  label,
  disabled = false,
  required = false,
  onFiles,
}: {
  label: string;
  disabled?: boolean;
  required?: boolean;
  onFiles(names: readonly string[]): void;
}) {
  const host = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const input = host.current?.querySelector<HTMLInputElement>('input[data-pui-root]');
    if (!input) throw new Error('[NativeFileInputPreview] The native input root is missing.');
    // Only browser-owned file mechanics cross this bridge. The prototype owns
    // naming, accessibility, focus participation and accepted policy states.
    if (input.type !== 'file') input.type = 'file';
    input.multiple = true;
    input.disabled = disabled;
    input.required = required;
    const changed = () => onFiles(Array.from(input.files ?? [], (file) => file.name));
    input.addEventListener('change', changed);
    return () => input.removeEventListener('change', changed);
  }, [disabled, required, onFiles]);
  return React.createElement(
    'div',
    { ref: host },
    React.createElement('p', { className: 'native-file-preview__label' }, label),
    React.createElement(NativeFileInput, { ariaLabel: label, disabled, required })
  );
}

function Preview({ chinese }: { chinese: boolean }) {
  const [names, setNames] = React.useState<readonly string[]>([]);
  const ignoreFiles = React.useCallback(() => {}, []);
  const status = names.length
    ? (chinese ? '已选择：' : 'Selected: ') + names.join(', ')
    : chinese
      ? '尚未选择文件。此预览不会上传文件。'
      : 'No files selected. This preview does not upload files.';
  return React.createElement(
    'div',
    { className: 'native-file-preview__examples' },
    React.createElement(Picker, {
      label: chinese ? '选择文件（必填，可多选）' : 'Choose files (required, multiple)',
      required: true,
      onFiles: setNames,
    }),
    React.createElement(Picker, {
      label: chinese ? '不可用的文件输入' : 'Unavailable file input',
      disabled: true,
      onFiles: ignoreFiles,
    }),
    React.createElement('p', { role: 'status', className: 'native-file-preview__status' }, status)
  );
}

export function initNativeFileInputPreviews(doc: Document) {
  if (!documents.has(doc)) {
    documents.add(doc);
    doc.addEventListener('astro:before-swap', () => {
      for (const [element, root] of mounted) {
        if (element.ownerDocument !== doc) continue;
        root.unmount();
        mounted.delete(element);
      }
    });
  }
  for (const element of doc.querySelectorAll<HTMLElement>('[data-native-file-preview]')) {
    if (mounted.has(element)) continue;
    const root = createRoot(element);
    mounted.set(element, root);
    root.render(React.createElement(Preview, { chinese: element.dataset.locale === 'zh-cn' }));
  }
}
