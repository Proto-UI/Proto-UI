import { createModule, defineModule, ModuleBase } from '@proto.ui/module-base';
import type { ModuleFactoryArgs } from '@proto.ui/module-base';
import type { ImageViewPatch, ImageViewSnapshot, ImageViewStatus, ImageViewStatusChange, Unsubscribe } from '@proto.ui/core';
import { getModuleDeclaration } from '@proto.ui/core';
import { IMAGE_VIEW_HOST_CAP, IMAGE_VIEW_RUN_IN_CALLBACK_CAP, type ImageViewHost, type ImageViewHostLease } from './caps';
import { IMAGE_VIEW_DECLARATION } from './declaration';
import type { ImageViewFacade, ImageViewModule, ImageViewPort } from './types';
import type { PropsBaseType } from '@proto.ui/types';

const EMPTY_PATCH: ImageViewPatch = Object.freeze({});

type Listener = {
  callback: (event: ImageViewStatusChange) => void;
};

export class ImageViewModuleImpl extends ModuleBase {
  private readonly prototypeName: string;
  private readonly supported: boolean;
  private declared = false;
  private initialized = false;
  private source = '';
  private alternativeText = '';
  private fit: 'contain' | 'cover' | 'fill' = 'contain';
  private loadingStatus: ImageViewStatus = 'idle';
  private generation = 0;
  private patch: ImageViewPatch = EMPTY_PATCH;
  private listeners: Listener[] = [];
  private host: ImageViewHost | null = null;
  private lease: ImageViewHostLease | null = null;

  constructor(
    caps: ModuleFactoryArgs['caps'],
    prototypeName: string,
    declarations: readonly import('@proto.ui/core').PrototypeModuleDeclaration[]
  ) {
    super(caps);
    this.prototypeName = prototypeName;
    this.supported = declarations.some(
      (d) => d.token === IMAGE_VIEW_DECLARATION
    );
  }

  declare<P extends PropsBaseType>(): import('@proto.ui/core').ImageViewHandle<P> {
    if (!this.supported) throw new Error('[ImageView] module not declared for this prototype');
    this.declared = true;
    return {
      on: (type, callback) => this.on(type, callback),
      sync: (patch) => this.sync(patch),
      snapshot: () => this.snapshot(),
    };
  }

  private on(type: 'loadingStatusChange', callback: (event: ImageViewStatusChange) => void): Unsubscribe {
    const listener: Listener = { callback };
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  private sync(next: ImageViewPatch): void {
    this.sys.ensureCallback('imageView.sync');
    if (!this.initialized) {
      this.source = next.source ?? '';
      this.alternativeText = next.alternativeText ?? '';
      this.fit = next.fit ?? 'contain';
      this.initialized = true;
    }
    const sourceChanged = typeof next.source === 'string' && next.source !== this.source;
    this.patch = Object.freeze({ ...this.patch, ...next });
    if (typeof next.source === 'string') this.source = next.source;
    if (typeof next.alternativeText === 'string') this.alternativeText = next.alternativeText;
    if (typeof next.fit === 'string') this.fit = next.fit;
    if (sourceChanged) {
      this.generation++;
      this.loadingStatus = 'loading';
    }
    this.syncLease();
  }

  snapshot(): ImageViewSnapshot | null {
    return this.declared
      ? Object.freeze({ source: this.source, loadingStatus: this.loadingStatus, fit: this.fit })
      : null;
  }

  protected override onCapsEpoch(): void {
    this.refreshHost();
    this.attachLease();
  }

  override onMountPhase(phase: import('@proto.ui/core').MountPhase, epoch: number): void {
    super.onMountPhase(phase, epoch);
    if (phase === 'mounted') {
      this.refreshHost();
      this.attachLease();
      return;
    }
    if (phase === 'unmounting' || phase === 'detached') this.disposeLease();
  }

  dispose(): void {
    this.listeners = [];
  }

  private refreshHost(): void {
    this.host = this.caps.has(IMAGE_VIEW_HOST_CAP) ? this.caps.get(IMAGE_VIEW_HOST_CAP) : null;
  }

  private attachLease(): void {
    if (!this.host || this.lease || !this.declared) return;
    this.lease = this.host.attach({
      patch: this.patch,
      onStatusChange: (change) => this.receive(change),
    });
  }

  private disposeLease(): void {
    this.lease?.dispose();
    this.lease = null;
  }

  private effectivePatch(): ImageViewPatch {
    return Object.freeze({
      ...this.patch,
      source: this.source,
      alternativeText: this.alternativeText,
      fit: this.fit,
      loadingStatus: this.loadingStatus,
    });
  }

  private syncLease(): void {
    this.lease?.update(this.effectivePatch());
  }

  private receive(change: ImageViewStatusChange): void {
    // Only accept status from current generation
    if (change.source !== this.source) return;
    const previousStatus = this.loadingStatus;
    this.loadingStatus = change.status;
    const runInCallback = this.caps.has(IMAGE_VIEW_RUN_IN_CALLBACK_CAP)
      ? this.caps.get(IMAGE_VIEW_RUN_IN_CALLBACK_CAP)
      : (callback: () => void) => callback();
    runInCallback(() => {
      for (const listener of this.listeners) {
        listener.callback({ ...change, previousStatus });
      }
    });
    this.syncLease();
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
