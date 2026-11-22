import type {
  BrowserCompileRequest,
  BrowserCompileResult,
} from '../../../../../packages/compiler/src/browser/protocol';

export interface RevisionOwner {
  ready: Promise<void>;
  dispose(): Promise<void>;
}
export type RevisionState =
  | { phase: 'idle' | 'compiling' | 'mounting' | 'disposed'; revision: string }
  | { phase: 'ready'; revision: string; result: Extract<BrowserCompileResult, { ok: true }> }
  | { phase: 'failed'; revision: string; result?: BrowserCompileResult; message: string };

/** An edit retires its old logical owner; it never transfers that owner's state. */
export class CompiledRevisionSession {
  private epoch = 0;
  private revision = '';
  private closed = false;
  private owner?: RevisionOwner;
  private retirement: Promise<void> = Promise.resolve();

  constructor(
    private readonly dependencies: {
      compile(request: BrowserCompileRequest): Promise<BrowserCompileResult>;
      prepare(result: Extract<BrowserCompileResult, { ok: true }>): Promise<() => RevisionOwner>;
      state(state: RevisionState): void;
      disposeCompiler(): void;
    }
  ) {}

  invalidate(revision: string): void {
    if (this.closed) return;
    this.epoch++;
    this.revision = revision;
    this.retire();
    this.dependencies.state({ phase: 'idle', revision });
  }

  async compile(request: BrowserCompileRequest): Promise<void> {
    if (this.closed) throw new DOMException('Compiler session was disposed.', 'AbortError');
    this.invalidate(request.revision);
    const epoch = this.epoch;
    const current = () => !this.closed && epoch === this.epoch;
    this.dependencies.state({ phase: 'compiling', revision: request.revision });
    try {
      const result = await this.dependencies.compile(request);
      if (!current()) return;
      if (!result.ok) {
        this.dependencies.state({
          phase: 'failed',
          revision: request.revision,
          result,
          message:
            result.phase === 'host'
              ? result.error.message
              : 'Source was not admitted by the compiler.',
        });
        return;
      }
      const mount = await this.dependencies.prepare(result);
      await this.retirement;
      if (!current()) return;
      this.dependencies.state({ phase: 'mounting', revision: request.revision });
      const owner = mount();
      this.owner = owner;
      await owner.ready;
      if (current())
        this.dependencies.state({ phase: 'ready', revision: request.revision, result });
    } catch (error) {
      if (!current()) return;
      this.retire();
      this.dependencies.state({
        phase: 'failed',
        revision: request.revision,
        message: String(error instanceof Error ? error.message : error),
      });
    }
  }

  fail(revision: string, error: Error): void {
    if (this.closed || this.revision !== revision) return;
    this.epoch++;
    this.retire();
    this.dependencies.state({ phase: 'failed', revision, message: error.message });
  }

  private retire(): void {
    const owner = this.owner;
    this.owner = undefined;
    if (owner) {
      let retiring: Promise<void>;
      try {
        retiring = owner.dispose();
      } catch (error) {
        retiring = Promise.reject(error);
      }
      this.retirement = Promise.all([this.retirement, retiring]).then(() => undefined);
      // Keep the rejection for the next activation/dispose caller, while that
      // caller may still be waiting for a long-running compiler response.
      void this.retirement.catch(() => undefined);
    }
  }

  async dispose(): Promise<void> {
    if (this.closed) return this.retirement;
    this.closed = true;
    this.epoch++;
    this.dependencies.disposeCompiler();
    this.retire();
    this.dependencies.state({ phase: 'disposed', revision: this.revision });
    await this.retirement;
  }
}
