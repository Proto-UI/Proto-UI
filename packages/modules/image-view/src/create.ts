import type {
  ImageViewA11yMode,
  ImageViewFit,
  ImageViewHandle,
  ImageViewPatch,
  ImageViewSnapshot,
  ImageViewStatus,
  ImageViewStatusChange,
  MountPhase,
  PrototypeModuleDeclaration,
  RunHandle,
} from '@proto.ui/core';
import { getModuleDeclaration } from '@proto.ui/core';
import {
  createModule,
  defineModule,
  ModuleBase,
  type ModuleFactoryArgs,
} from '@proto.ui/module-base';
import type { PropsBaseType } from '@proto.ui/types';
import {
  IMAGE_VIEW_HOST_CAP,
  IMAGE_VIEW_RUN_IN_CALLBACK_CAP,
  type ImageViewHost,
  type ImageViewHostCompletion,
  type ImageViewHostLease,
} from './caps';
import { IMAGE_VIEW_DECLARATION, type ImageViewDeclaration } from './declaration';
import type { ImageViewFacade, ImageViewModule, ImageViewPort } from './types';

const EMPTY_PATCH: ImageViewPatch = Object.freeze({});

type Listener = {
  callback: (run: RunHandle<PropsBaseType>, event: ImageViewStatusChange) => void;
};

export class ImageViewModuleImpl extends ModuleBase {
  private readonly prototypeName: string;
  private readonly declaration: ImageViewDeclaration | null;
  private declared = false;
  private initialized = false;
  private requestedSource = '';
  private source = '';
  private alternativeText = '';
  private a11yMode: ImageViewA11yMode = 'informative';
  private fit: ImageViewFit = 'contain';
  private loadingStatus: ImageViewStatus = 'idle';
  private generation = 0;
  private patch: ImageViewPatch = EMPTY_PATCH;
  private listeners: Listener[] = [];
  private host: ImageViewHost | null = null;
  private lease: ImageViewHostLease | null = null;
  private attachmentEpoch = 0;
  private lastHostedGeneration: number | null = null;
  private lastDiagnostic = '';

  constructor(
    caps: ModuleFactoryArgs['caps'],
    prototypeName: string,
    declarations: readonly PrototypeModuleDeclaration[]
  ) {
    super(caps);
    this.prototypeName = prototypeName;
    this.declaration =
      getModuleDeclaration({ modules: declarations }, IMAGE_VIEW_DECLARATION)?.config ?? null;
    if (this.declaration) {
      this.requestedSource = this.declaration.source;
      this.alternativeText = this.declaration.alternativeText;
      this.a11yMode = this.declaration.a11yMode;
      this.fit = this.declaration.fit;
      this.source = this.validatedSource();
      if (this.source) {
        this.generation = 1;
        this.loadingStatus = 'loading';
      }
      this.refreshHost();
    }
  }

  declare<P extends PropsBaseType>(): ImageViewHandle<P> {
    this.sys.ensureSetup('imageView.declare');
    if (!this.declaration) {
      throw new Error(
        `[ImageView] ${this.prototypeName} requires a static image-view declaration.`
      );
    }
    if (this.declared) {
      throw new Error(`[ImageView] ${this.prototypeName} may declare one image view.`);
    }
    this.declared = true;
    return {
      on: (type, callback) => this.on(type, callback),
      sync: (patch) => this.sync(patch),
      snapshot: () => this.snapshot(),
    };
  }

  private on<P extends PropsBaseType>(
    type: 'loadingStatusChange',
    callback: (run: RunHandle<P>, event: ImageViewStatusChange) => void
  ): () => void {
    this.sys.ensureSetup('imageView.on');
    const listener: Listener = {
      callback: callback as (run: RunHandle<PropsBaseType>, event: ImageViewStatusChange) => void,
    };
    this.listeners = this.listeners.concat(listener);
    return () => {
      this.listeners = this.listeners.filter((candidate) => candidate !== listener);
    };
  }

  private sync(next: ImageViewPatch): void {
    this.sys.ensureCallback('imageView.sync');
    const { loadingStatus: _moduleOwnedStatus, ...portableNext } = next;
    this.patch = Object.freeze({ ...this.patch, ...portableNext });

    if (!this.initialized) {
      this.requestedSource = portableNext.source ?? this.requestedSource;
      this.alternativeText = portableNext.alternativeText ?? this.alternativeText;
      this.a11yMode = portableNext.a11yMode ?? this.a11yMode;
      this.fit = portableNext.fit ?? this.fit;
      this.initialized = true;
    } else {
      if (typeof portableNext.source === 'string') this.requestedSource = portableNext.source;
      if (typeof portableNext.alternativeText === 'string') {
        this.alternativeText = portableNext.alternativeText;
      }
      if (portableNext.a11yMode) this.a11yMode = portableNext.a11yMode;
      if (portableNext.fit) this.fit = portableNext.fit;
    }

    const source = this.validatedSource();
    if (source !== this.source) {
      this.source = source;
      this.generation += 1;
      this.transition(source ? 'loading' : 'idle');
    }
    this.syncLease();
  }

  snapshot(): ImageViewSnapshot | null {
    return this.declared
      ? Object.freeze({
          source: this.source,
          loadingStatus: this.loadingStatus,
          fit: this.fit,
        })
      : null;
  }

  protected override onCapsEpoch(): void {
    this.disposeLease();
    this.refreshHost();
    this.attachLease();
  }

  override onMountPhase(phase: MountPhase, epoch: number): void {
    super.onMountPhase(phase, epoch);
    if (phase === 'mounted') {
      this.refreshHost();
      this.attachLease();
      return;
    }
    if (phase === 'unmounting' || phase === 'detached') this.disposeLease();
  }

  dispose(): void {
    this.disposeLease();
    this.listeners = [];
    this.declared = false;
  }

  private refreshHost(): void {
    this.host = this.caps.has(IMAGE_VIEW_HOST_CAP) ? this.caps.get(IMAGE_VIEW_HOST_CAP) : null;
  }

  private attachLease(): void {
    this.disposeLease();
    if (!this.host || !this.declared || this.mountPhase !== 'mounted') return;

    if (this.source && this.lastHostedGeneration === this.generation) {
      this.generation += 1;
      this.transition('loading');
    }

    const host = this.host;
    const generation = this.generation;
    const attachmentEpoch = ++this.attachmentEpoch;
    const initialPatch = this.effectivePatch();
    this.lastHostedGeneration = generation;
    const lease = host.attach({
      generation,
      patch: initialPatch,
      onStatusChange: (change) => this.receive(change, attachmentEpoch),
    });

    if (
      attachmentEpoch !== this.attachmentEpoch ||
      this.host !== host ||
      this.mountPhase !== 'mounted'
    ) {
      lease.dispose();
      return;
    }

    this.lease = lease;
    if (generation !== this.generation || initialPatch.loadingStatus !== this.loadingStatus) {
      this.syncLease();
    }
  }

  private disposeLease(): void {
    this.attachmentEpoch += 1;
    this.lease?.dispose();
    this.lease = null;
  }

  private effectivePatch(): ImageViewPatch {
    return Object.freeze({
      ...this.patch,
      source: this.source,
      alternativeText: this.a11yMode === 'decorative' ? '' : this.alternativeText,
      a11yMode: this.a11yMode,
      fit: this.fit,
      loadingStatus: this.loadingStatus,
    });
  }

  private syncLease(): void {
    if (!this.lease) return;
    this.lastHostedGeneration = this.generation;
    this.lease.update({
      generation: this.generation,
      patch: this.effectivePatch(),
    });
  }

  private receive(change: ImageViewHostCompletion, attachmentEpoch: number): void {
    if (attachmentEpoch !== this.attachmentEpoch) return;
    if (change.generation !== this.generation) return;
    if (!this.source) return;
    if (this.loadingStatus === 'loaded' || this.loadingStatus === 'error') return;
    this.transition(change.status);
    this.syncLease();
  }

  private transition(status: ImageViewStatus): void {
    if (status === this.loadingStatus) return;
    const currentRun = this.sys.getCallbackCtx() as RunHandle<PropsBaseType> | undefined;
    if (
      this.listeners.length > 0 &&
      !currentRun &&
      !this.caps.has(IMAGE_VIEW_RUN_IN_CALLBACK_CAP)
    ) {
      throw new Error(
        `[ImageView] ${this.prototypeName} requires IMAGE_VIEW_RUN_IN_CALLBACK_CAP to dispatch loadingStatusChange outside callback scope.`
      );
    }

    const event: ImageViewStatusChange = Object.freeze({
      source: this.source,
      previousStatus: this.loadingStatus,
      status,
    });
    this.loadingStatus = status;

    const dispatch = (run: RunHandle<PropsBaseType>) => {
      for (const listener of [...this.listeners]) listener.callback(run, event);
    };
    if (currentRun) {
      dispatch(currentRun);
      return;
    }
    if (this.listeners.length === 0) return;

    this.caps.get(IMAGE_VIEW_RUN_IN_CALLBACK_CAP)(() => {
      const run = this.sys.getCallbackCtx() as RunHandle<PropsBaseType> | undefined;
      if (!run) {
        throw new Error(
          `[ImageView] ${this.prototypeName} received an invalid IMAGE_VIEW_RUN_IN_CALLBACK_CAP implementation that did not enter callback scope.`
        );
      }
      dispatch(run);
    });
  }

  private validatedSource(): string {
    if (!this.requestedSource) {
      this.lastDiagnostic = '';
      return '';
    }
    const hasAlternative = this.alternativeText.trim().length > 0;
    const valid =
      (this.a11yMode === 'informative' && hasAlternative) ||
      (this.a11yMode === 'decorative' && !hasAlternative);
    if (valid) {
      this.lastDiagnostic = '';
      return this.requestedSource;
    }

    const diagnostic = `${this.a11yMode}:${this.requestedSource}:${this.alternativeText}`;
    if (diagnostic !== this.lastDiagnostic) {
      this.lastDiagnostic = diagnostic;
      console.warn(
        `[ImageView] ${this.prototypeName} rejected contradictory or missing accessibility input; source failed closed to idle.`
      );
    }
    return '';
  }
}

export function createImageViewModule(ctx: ModuleFactoryArgs): ImageViewModule {
  const { init, caps, deps } = ctx;
  return createModule<'image-view', 'instance', ImageViewFacade, ImageViewPort>({
    name: 'image-view',
    scope: 'instance',
    init,
    caps,
    deps,
    build: ({ init, caps }) => {
      const impl = new ImageViewModuleImpl(caps, init.prototypeName, init.declarations);
      return {
        facade: {
          declare: () => impl.declare(),
        },
        hooks: {
          onMountPhase: (phase, epoch) => impl.onMountPhase(phase, epoch),
          dispose: () => impl.dispose(),
        },
        port: {
          isDeclared: () => impl.snapshot() !== null,
          getSnapshot: () => impl.snapshot(),
        },
      };
    },
  }) as ImageViewModule;
}

export const ImageViewModuleDef = defineModule({
  name: 'image-view',
  resourceOwnership: 'mixed',
  create: createImageViewModule,
});
