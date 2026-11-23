import {
  createBrowserCompilerClient,
  type BrowserCompilerClient,
} from '../../../../../packages/compiler/src/browser/client';
import type {
  BrowserCompileRequest,
  BrowserCompilerBuild,
} from '../../../../../packages/compiler/src/browser/protocol';
import type { BrowserSourceAsset } from '../../../../../scripts/compiler/browser-assets';
import { CompiledRevisionSession, type RevisionState } from './compiled-revision-session';
import {
  mountCompiledPreview,
  type BrowserTargetAssets,
  type CompiledPreviewItem,
} from './compiled-preview-sandbox';

const profiles = new Set([
  'web-component-source-v1',
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
]);

/** One optional compiler session inside the existing RuntimeBox. */
export class BrowserCompilerPanel extends HTMLElement {
  private lifetime?: AbortController;
  private session?: CompiledRevisionSession;
  private client?: BrowserCompilerClient;
  private source?: BrowserSourceAsset;
  private generated: Record<string, string> = {};
  private files: Record<string, string> = {};
  private revisionNumber = 0;
  private generation = 0;
  private debounce?: ReturnType<typeof setTimeout>;
  private bound = false;
  private retirement: Promise<void> = Promise.resolve();
  private targets = new Map<string, BrowserTargetAssets>();
  private eventCount = 0;
  private messages(en: string, zh: string) {
    return this.dataset.language === 'zh' ? zh : en;
  }
  private element<T extends Element>(selector: string) {
    return this.querySelector<T>(selector)!;
  }
  private get panel() {
    return this.element<HTMLDetailsElement>('[data-compiler-panel]');
  }
  private get target() {
    return this.element<HTMLSelectElement>('[data-compiler-target]');
  }
  private get sourceFile() {
    return this.element<HTMLSelectElement>('[data-source-file]');
  }
  private get sourceText() {
    return this.element<HTMLTextAreaElement>('[data-source-text]');
  }
  private get status() {
    return this.element<HTMLElement>('[data-compiler-status]');
  }

  connectedCallback() {
    if (!this.bound) {
      this.bound = true;
      this.panel.addEventListener('toggle', () => {
        if (this.panel.open) void this.open();
        else void this.close();
      });
      this.element('[data-compiler-run]').addEventListener('click', () => {
        clearTimeout(this.debounce);
        void this.run();
      });
      this.element('[data-compiler-cancel]').addEventListener('click', () => {
        void this.close();
        this.status.textContent = this.messages(
          'Cancelled. Compile to start a fresh session.',
          '已取消。点击编译可启动新会话。'
        );
      });
      this.target.addEventListener('change', () => {
        this.changed();
      });
      this.sourceFile.addEventListener('change', () => {
        this.sourceText.value = this.files[this.sourceFile.value] ?? '';
      });
      this.sourceText.addEventListener('input', () => {
        this.files[this.sourceFile.value] = this.sourceText.value;
        this.changed();
      });
      this.element('[data-generated-file]').addEventListener('change', () =>
        this.renderGenerated()
      );
    }
    if (this.panel.open) void this.open();
  }
  disconnectedCallback() {
    void this.close();
  }

  private async json<T>(url: string, signal: AbortSignal): Promise<T> {
    const response = await fetch(url, { signal, credentials: 'omit' });
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return (await response.json()) as T;
  }

  private async open(): Promise<void> {
    if (this.lifetime || !this.isConnected || !this.panel.open) return;
    const lifetime = (this.lifetime = new AbortController());
    const generation = ++this.generation;
    this.renderState({ phase: 'idle', revision: String(this.revisionNumber) });
    this.status.textContent = this.messages('Loading browser compiler…', '正在加载浏览器编译器…');
    this.element<HTMLButtonElement>('[data-compiler-cancel]').disabled = false;
    try {
      // Closing retires a session asynchronously. A new Worker/session must not
      // bypass that retirement or silently recover from a failed cleanup.
      await this.retirement;
      if (generation !== this.generation || lifetime.signal.aborted) return;
      const [bundleResponse, build, source] = await Promise.all([
        fetch('/compiler-assets/compiler.js', { signal: lifetime.signal, credentials: 'omit' }),
        this.json<BrowserCompilerBuild>('/compiler-assets/build.json', lifetime.signal),
        this.json<BrowserSourceAsset>(
          `/compiler-assets/source/${encodeURIComponent(this.dataset.prototypeId ?? '')}.json`,
          lifetime.signal
        ),
      ]);
      if (!bundleResponse.ok) throw new Error(`Compiler bundle: ${bundleResponse.status}`);
      if (
        source.format !== 1 ||
        source.id !== this.dataset.prototypeId ||
        typeof source.files?.[source.entry] !== 'string'
      )
        throw new Error('The prototype source binding is invalid.');
      if (!this.source) {
        this.source = source;
        this.files = { ...source.files };
        this.sourceFile.replaceChildren(
          ...Object.keys(this.files).map((file) => new Option(file, file))
        );
        this.sourceFile.value = source.entry;
        this.sourceText.value = this.files[source.entry];
      }
      const client = await createBrowserCompilerClient(await bundleResponse.text(), build, {
        signal: lifetime.signal,
      });
      if (generation !== this.generation || lifetime.signal.aborted) {
        client.dispose();
        return;
      }
      this.client = client;
      this.dataset.compilerSha256 = client.build.compilerSha256;
      this.session = new CompiledRevisionSession({
        compile: async (request) => (await client.compile(request)).result,
        prepare: async (result) => {
          const profile = result.output.profile;
          let target = this.targets.get(profile);
          if (!target) {
            target = await this.json<BrowserTargetAssets>(
              `/compiler-assets/targets/${profile}.json`,
              lifetime.signal
            );
            this.targets.set(profile, target);
          }
          const asset = target;
          for (const dependency of result.output.dependencies) {
            if (
              dependency.role !== 'target' ||
              asset.versions[dependency.name] !== dependency.version
            )
              throw new Error(
                `Preview dependency does not match the generated target: ${dependency.name}@${dependency.version}.`
              );
          }
          const digest = [
            ...new Uint8Array(
              await crypto.subtle.digest(
                'SHA-256',
                new TextEncoder().encode(JSON.stringify(asset.modules))
              )
            ),
          ]
            .map((value) => value.toString(16).padStart(2, '0'))
            .join('');
          if (digest !== asset.modulesSha256)
            throw new Error('Preview target artifact digest mismatch.');
          const items = JSON.parse(
            this.dataset.items ?? '[{"props":{},"text":"Preview"}]'
          ) as CompiledPreviewItem[];
          return () => {
            this.dataset.targetSha256 = asset.modulesSha256;
            return mountCompiledPreview(
              this.element('[data-compiled-preview]'),
              result,
              asset,
              items,
              (error) => this.session?.fail(result.revision, error),
              (name, index) => {
                this.dataset.eventCount = String(++this.eventCount);
                this.element('[data-compiler-events]').textContent =
                  `${name} · ${this.messages('item', '项目')} ${index + 1} · ${this.eventCount}`;
              }
            );
          };
        },
        state: (state) => {
          if (generation === this.generation) this.renderState(state);
        },
        disposeCompiler: () => client.dispose(),
      });
      await this.run();
    } catch (error) {
      if (generation !== this.generation || lifetime.signal.aborted) return;
      this.renderState({
        phase: 'failed',
        revision: '',
        message: String(error instanceof Error ? error.message : error),
      });
    }
  }

  private changed() {
    const revision = String(++this.revisionNumber);
    if (this.session) this.session.invalidate(revision);
    else this.renderState({ phase: 'idle', revision });
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.run(), 250);
  }

  private async run(): Promise<void> {
    if (!this.panel.open || !this.isConnected) return;
    if (!this.session || !this.source) {
      await this.open();
      return;
    }
    if (!profiles.has(this.target.value)) throw new Error('Unsupported browser preview target.');
    const revision = String(++this.revisionNumber);
    const request: BrowserCompileRequest = {
      format: 1,
      revision,
      source: this.files[this.source.entry],
      preview: true,
      options: {
        fileName: this.source.entry,
        exportName: this.source.exportName,
        profile: this.target.value as BrowserCompileRequest['options']['profile'],
        files: { ...this.files },
        sourceImports: this.source.sourceImports,
      },
    };
    await this.session.compile(request);
  }

  private renderState(state: RevisionState) {
    this.dataset.compilerPhase = state.phase;
    this.dataset.compilerRevision = state.revision;
    const diagnostics = this.element<HTMLElement>('[data-compiler-diagnostics]');
    diagnostics.hidden = true;
    diagnostics.textContent = '';
    if (state.phase !== 'ready') {
      delete this.dataset.requestSha256;
      delete this.dataset.targetSha256;
      this.eventCount = 0;
      this.dataset.eventCount = '0';
      this.element('[data-compiler-events]').textContent = '';
      this.generated = {};
      this.element<HTMLSelectElement>('[data-generated-file]').replaceChildren();
      this.element('[data-generated-text]').textContent = '';
    }
    const revision = state.revision ? ` · r${state.revision}` : '';
    if (state.phase === 'idle')
      this.status.textContent =
        this.messages('Source changed; waiting to compile', '源码已修改，等待编译') + revision;
    if (state.phase === 'compiling')
      this.status.textContent =
        this.messages('Compiling in WebAssembly', '正在 WebAssembly 中编译') + revision;
    if (state.phase === 'mounting')
      this.status.textContent =
        this.messages('Opening generated preview', '正在打开生成预览') + revision;
    if (state.phase === 'disposed')
      this.status.textContent = this.messages('Compiler session closed.', '编译会话已关闭。');
    if (state.phase === 'failed') {
      this.status.textContent =
        this.messages('Compilation or preview failed', '编译或预览失败') + revision;
      diagnostics.hidden = false;
      diagnostics.textContent =
        state.result?.ok === false && state.result.phase === 'compile'
          ? state.result.diagnostics.map((entry) => JSON.stringify(entry, null, 2)).join('\n')
          : state.message;
      // Transport/VM/mount failure gets a fresh Worker on the next attempt.
      // Ordinary compiler diagnostics keep the healthy VM and its bounded cache.
      if (!state.result || (!state.result.ok && state.result.phase === 'host')) {
        const failedGeneration = ++this.generation;
        void this.retireSession().catch((error) => {
          if (failedGeneration === this.generation)
            diagnostics.textContent += `\n${this.messages('Preview retirement', '预览清理')}: ${String(error)}`;
        });
      }
    }
    if (state.phase === 'ready') {
      this.status.textContent =
        this.messages('Compiled preview ready', '编译预览已就绪') + revision;
      this.dataset.requestSha256 = state.result.requestSha256;
      this.generated = Object.fromEntries([
        ['entry.ts', state.result.output.code],
        ...(state.result.output.supportingFiles ?? []).map((file) => [file.path, file.contents]),
      ]);
      this.element<HTMLSelectElement>('[data-generated-file]').replaceChildren(
        ...Object.keys(this.generated).map((file) => new Option(file, file))
      );
      this.renderGenerated();
    }
  }
  private renderGenerated() {
    this.element('[data-generated-text]').textContent =
      this.generated[this.element<HTMLSelectElement>('[data-generated-file]').value] ?? '';
  }
  private retireSession(): Promise<void> {
    const session = this.session;
    this.session = undefined;
    this.client?.dispose();
    this.client = undefined;
    this.lifetime?.abort();
    this.lifetime = undefined;
    if (session) {
      let retiring: Promise<void>;
      try {
        retiring = session.dispose();
      } catch (error) {
        retiring = Promise.reject(error);
      }
      this.retirement = Promise.all([this.retirement, retiring]).then(() => undefined);
      // Retain the failure for every subsequent open/close even while no caller
      // is awaiting it. A failed owner is never treated as successfully retired.
      void this.retirement.catch(() => {});
    }
    return this.retirement;
  }
  private async close() {
    clearTimeout(this.debounce);
    const generation = ++this.generation;
    this.element<HTMLButtonElement>('[data-compiler-cancel]').disabled = true;
    try {
      await this.retireSession();
    } catch (error) {
      if (generation === this.generation)
        this.renderState({
          phase: 'failed',
          revision: String(this.revisionNumber),
          message: String(error),
        });
      return;
    }
    if (generation === this.generation)
      this.renderState({ phase: 'disposed', revision: String(this.revisionNumber) });
  }
}
if (!customElements.get('pui-browser-compiler'))
  customElements.define('pui-browser-compiler', BrowserCompilerPanel);
