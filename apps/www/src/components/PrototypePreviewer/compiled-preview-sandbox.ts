import type {
  BrowserCompileResult,
  BrowserPreviewArtifact,
} from '../../../../../packages/compiler/src/browser/protocol';

export interface CompiledPreviewItem {
  props: Record<string, unknown>;
  text?: string;
}
export interface BrowserTargetAssets {
  format: 2;
  target: 'react';
  modules: Record<string, string>;
  previewRuntime: string;
  versions: Record<string, string>;
  artifactSha256: string;
}
export interface CompiledPreviewMount {
  readonly frame: HTMLIFrameElement;
  readonly ready: Promise<void>;
  dispose(): Promise<void>;
}

const safeJSON = (value: unknown) =>
  JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');

/** Serialize a document with a separately bundled static preview application. */
export function compiledPreviewDocument(
  preview: BrowserPreviewArtifact,
  target: BrowserTargetAssets,
  revision: string,
  token: string,
  items: readonly CompiledPreviewItem[]
): string {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(token) || /<\/script/i.test(target.previewRuntime))
    throw new Error('Invalid isolated preview document input.');
  const doc = document.implementation.createHTMLDocument('Compiled preview');
  const csp = doc.createElement('meta');
  csp.httpEquiv = 'Content-Security-Policy';
  csp.content =
    "default-src 'none'; script-src 'nonce-" +
    token +
    "' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; child-src 'none';";
  const charset = doc.createElement('meta');
  charset.setAttribute('charset', 'utf-8');
  const style = doc.createElement('style');
  style.textContent =
    'body{margin:0;font:14px/1.5 system-ui,sans-serif;color:#202124;background:transparent}#stage{display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;min-height:150px;padding:16px;box-sizing:border-box}#stage>[data-preview-item]{padding:8px 16px;border:1px solid #adb5bd;border-radius:6px}';
  doc.head.prepend(charset, csp);
  doc.head.append(style);
  const stage = doc.createElement('div');
  stage.id = 'stage';
  const input = doc.createElement('script');
  input.id = 'preview-input';
  input.type = 'application/json';
  input.textContent = safeJSON({ preview, target, revision, token, items });
  const runtime = doc.createElement('script');
  runtime.type = 'module';
  // The inert document is serialized into srcdoc; preserve the nonce as an
  // attribute because its IDL property is not serialized in an inert document.
  runtime.setAttribute('nonce', token);
  runtime.textContent = target.previewRuntime;
  doc.body.append(stage, input, runtime);
  return '<!doctype html>' + doc.documentElement.outerHTML;
}

export function mountCompiledPreview(
  host: HTMLElement,
  result: Extract<BrowserCompileResult, { ok: true }>,
  target: BrowserTargetAssets,
  items: readonly CompiledPreviewItem[],
  onFailure: (error: Error) => void,
  onEvent?: (name: string, index: number) => void
): CompiledPreviewMount {
  if (
    !result.preview ||
    result.preview.format !== 2 ||
    target.format !== 2 ||
    target.target !== result.output.target
  )
    throw new Error('Preview artifact and selected target do not match.');
  const window = host.ownerDocument.defaultView!;
  const frame = host.ownerDocument.createElement('iframe');
  const token = window.crypto.randomUUID().replaceAll('-', '');
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.referrerPolicy = 'no-referrer';
  frame.title = `Compiled preview · ${result.revision}`;
  frame.style.cssText = 'width:100%;height:190px;border:0;display:block;';
  let disposed = false,
    readySettled = false,
    listenerReady = false,
    disposeSent = false,
    retirePromise: Promise<void> | undefined;
  let finishRetirement: (() => void) | undefined;
  let cleanupError: Error | undefined;
  let rejectReady!: (error: Error) => void, resolveReady!: () => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const readyDeadline = window.setTimeout(() => {
    if (!disposed) {
      const error = new Error('Preview mount exceeded its 10-second deadline.');
      rejectReady(error);
      onFailure(error);
    }
  }, 10_000);
  const sendRetirement = () => {
    if (!disposed || !listenerReady || !finishRetirement || disposeSent) return;
    const current = frame.contentWindow;
    if (!current) return;
    disposeSent = true;
    current.postMessage({ type: 'dispose', token, revision: result.revision }, '*');
  };
  const listener = (event: MessageEvent) => {
    if (event.source !== frame.contentWindow || event.origin !== 'null') return;
    const message = event.data;
    if (!message || message.token !== token || message.revision !== result.revision) return;
    if (message.type === 'preview-listener-ready') {
      listenerReady = true;
      sendRetirement();
      return;
    }
    if (message.type === 'cleanup-error') {
      cleanupError = new Error(String(message.message));
      return;
    }
    if (message.type === 'disposed') {
      finishRetirement?.();
      return;
    }
    if (disposed) return;
    if (
      message.type === 'preview-event' &&
      result.preview!.events.includes(message.name) &&
      Number.isInteger(message.index) &&
      message.index >= 0 &&
      message.index < items.length
    )
      onEvent?.(message.name, message.index);
    if (message.type === 'preview-ready' && message.target === target.target) {
      readySettled = true;
      window.clearTimeout(readyDeadline);
      resolveReady();
    }
    if (message.type === 'preview-error') {
      const error = new Error(String(message.message));
      window.clearTimeout(readyDeadline);
      rejectReady(error);
      onFailure(error);
    }
  };
  window.addEventListener('message', listener);
  frame.srcdoc = compiledPreviewDocument(result.preview, target, result.revision, token, items);
  host.replaceChildren(frame);
  return {
    frame,
    ready,
    dispose() {
      if (retirePromise) return retirePromise;
      disposed = true;
      window.clearTimeout(readyDeadline);
      if (!readySettled) rejectReady(new DOMException('Preview was retired.', 'AbortError'));
      frame.hidden = true;
      retirePromise = new Promise<void>((resolve, reject) => {
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          finishRetirement = undefined;
          window.clearTimeout(timeout);
          window.removeEventListener('message', listener);
          frame.remove();
          if (cleanupError) reject(cleanupError);
          else resolve();
        };
        const timeout = window.setTimeout(() => {
          cleanupError ??= new Error(
            'Preview cleanup acknowledgement exceeded its 250-millisecond deadline.'
          );
          finish();
        }, 250);
        finishRetirement = finish;
        sendRetirement();
      });
      return retirePromise;
    },
  };
}
