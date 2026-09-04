import type {
  AnatomyPartView,
  MountPhase,
  OwnedStateHandle,
  ProtoPhase,
  ScrollComposedChromeBinding,
  ScrollAxes,
  ScrollAxisSnapshot,
  ScrollEndFollowRequestStatus,
  ScrollEndFollowState,
  ScrollResolvedProjection,
  ScrollSurfaceConfig,
  ScrollSurfaceConfigPatch,
  ScrollSurfaceHandle,
  ScrollSurfaceRequest,
  ScrollSurfaceSnapshot,
  Unsubscribe,
} from '@proto.ui/core';
import { illegalPhase } from '@proto.ui/core';
import { ModuleBase, type ModuleFactoryArgs } from '@proto.ui/module-base';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import type { ContextPort } from '@proto.ui/module-context';
import type { StateFacade, StatePort } from '@proto.ui/module-state';
import type { PropsBaseType } from '@proto.ui/types';
import {
  SCROLL_SURFACE_HOST_CAP,
  type ScrollComposedChromeHostBinding,
  type ScrollSurfaceHost,
  type ScrollSurfaceHostAttachment,
  type ScrollSurfaceHostLease,
} from './caps';
import { resolveScrollProjection } from './projection';

const EMPTY_AXIS: ScrollAxisSnapshot = Object.freeze({
  position: 0,
  visibleRatio: 1,
  canScrollBefore: false,
  canScrollAfter: false,
  atEnd: true,
});

const END_FOLLOW_OFF = Object.freeze({ mode: 'off' as const });

const DEFAULT_CONFIG: ScrollSurfaceConfig = Object.freeze({
  axes: 'both',
  projection: 'auto',
  endFollow: END_FOLLOW_OFF,
});

const clampRatio = (value: number) =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

export class ScrollModuleImpl extends ModuleBase {
  private config: ScrollSurfaceConfig = DEFAULT_CONFIG;
  private declared = false;
  private composedChromeBinding: ScrollComposedChromeBinding | null = null;
  private offAnatomyOrder: Unsubscribe | null = null;
  private offAnatomyTargets: Unsubscribe | null = null;
  private lease: ScrollSurfaceHostLease | null = null;
  private mounted = false;
  private leaseEpoch = 0;

  private readonly axesOwned: OwnedStateHandle<ScrollAxes>;
  private readonly scrollingOwned: OwnedStateHandle<boolean>;
  private readonly projectionOwned: OwnedStateHandle<ScrollResolvedProjection>;
  private readonly endFollowStateOwned: OwnedStateHandle<ScrollEndFollowState>;
  private readonly endFollowRequestStatusOwned: OwnedStateHandle<ScrollEndFollowRequestStatus>;
  private readonly horizontalPositionOwned: OwnedStateHandle<number>;
  private readonly horizontalVisibleOwned: OwnedStateHandle<number>;
  private readonly horizontalBeforeOwned: OwnedStateHandle<boolean>;
  private readonly horizontalAfterOwned: OwnedStateHandle<boolean>;
  private readonly horizontalAtEndOwned: OwnedStateHandle<boolean>;
  private readonly verticalPositionOwned: OwnedStateHandle<number>;
  private readonly verticalVisibleOwned: OwnedStateHandle<number>;
  private readonly verticalBeforeOwned: OwnedStateHandle<boolean>;
  private readonly verticalAfterOwned: OwnedStateHandle<boolean>;
  private readonly verticalAtEndOwned: OwnedStateHandle<boolean>;

  private readonly handle: ScrollSurfaceHandle<PropsBaseType>;

  constructor(
    caps: ModuleFactoryArgs['caps'],
    private readonly prototypeName: string,
    private readonly statePort: StatePort,
    stateFacade: StateFacade,
    private readonly anatomyPort: AnatomyPort,
    private readonly contextPort: ContextPort
  ) {
    super(caps);
    this.axesOwned = stateFacade.enum('@scroll/axes', 'both', {
      options: ['horizontal', 'vertical', 'both'] as const,
    });
    this.scrollingOwned = stateFacade.bool('@scroll/scrolling', false);
    this.projectionOwned = stateFacade.enum('@scroll/projection', 'unresolved', {
      options: ['unresolved', 'system', 'composed'] as const,
    });
    this.endFollowStateOwned = stateFacade.enum('@scroll/endFollowState', 'off', {
      options: ['off', 'pending', 'following', 'paused'] as const,
    });
    this.endFollowRequestStatusOwned = stateFacade.enum('@scroll/endFollowRequestStatus', 'idle', {
      options: ['idle', 'pending', 'applied', 'rejected'] as const,
    });
    this.horizontalPositionOwned = this.createRatio(stateFacade, '@scroll/horizontalPosition', 0);
    this.horizontalVisibleOwned = this.createRatio(
      stateFacade,
      '@scroll/horizontalVisibleRatio',
      1
    );
    this.horizontalBeforeOwned = stateFacade.bool('@scroll/horizontalCanScrollBefore', false);
    this.horizontalAfterOwned = stateFacade.bool('@scroll/horizontalCanScrollAfter', false);
    this.horizontalAtEndOwned = stateFacade.bool('@scroll/horizontalAtEnd', true);
    this.verticalPositionOwned = this.createRatio(stateFacade, '@scroll/verticalPosition', 0);
    this.verticalVisibleOwned = this.createRatio(stateFacade, '@scroll/verticalVisibleRatio', 1);
    this.verticalBeforeOwned = stateFacade.bool('@scroll/verticalCanScrollBefore', false);
    this.verticalAfterOwned = stateFacade.bool('@scroll/verticalCanScrollAfter', false);
    this.verticalAtEndOwned = stateFacade.bool('@scroll/verticalAtEnd', true);

    this.handle = {
      axes: this.observed(this.axesOwned),
      horizontal: {
        position: this.observed(this.horizontalPositionOwned),
        visibleRatio: this.observed(this.horizontalVisibleOwned),
        canScrollBefore: this.observed(this.horizontalBeforeOwned),
        canScrollAfter: this.observed(this.horizontalAfterOwned),
        atEnd: this.observed(this.horizontalAtEndOwned),
      },
      vertical: {
        position: this.observed(this.verticalPositionOwned),
        visibleRatio: this.observed(this.verticalVisibleOwned),
        canScrollBefore: this.observed(this.verticalBeforeOwned),
        canScrollAfter: this.observed(this.verticalAfterOwned),
        atEnd: this.observed(this.verticalAtEndOwned),
      },
      scrolling: this.observed(this.scrollingOwned),
      projection: this.observed(this.projectionOwned),
      endFollow: {
        state: this.observed(this.endFollowStateOwned),
        requestStatus: this.observed(this.endFollowRequestStatusOwned),
      },
      configure: (patch) => this.configure(patch),
      bindComposedChrome: (binding) => this.bindComposedChrome(binding),
      request: (request) => this.request(request),
      getSnapshot: () => this.getSnapshot(),
    };
  }

  private createRatio(stateFacade: StateFacade, semantic: string, value: number) {
    return stateFacade.numberRange(semantic, value, { min: 0, max: 1, clamp: true });
  }

  private observed<V>(handle: OwnedStateHandle<V>) {
    return this.statePort.createObservedHandle(handle) as never;
  }

  private ensureSetup(operation: string): void {
    this.sys?.ensureSetup(operation);
    if (!this.sys && this.protoPhase !== 'setup') {
      throw illegalPhase(operation, this.protoPhase, { prototypeName: this.prototypeName });
    }
  }

  getSurface<P extends PropsBaseType = PropsBaseType>(): ScrollSurfaceHandle<P> {
    this.declared = true;
    if (this.mounted) this.attach();
    return this.handle as ScrollSurfaceHandle<P>;
  }

  configure(patch: ScrollSurfaceConfigPatch): void {
    this.ensureSetup('asScrollSurface().configure');
    this.config = Object.freeze({
      ...this.config,
      ...patch,
      requireProjection:
        typeof patch.requireProjection === 'undefined'
          ? this.config.requireProjection
          : patch.requireProjection,
      endFollow:
        typeof patch.endFollow === 'undefined'
          ? this.config.endFollow
          : patch.endFollow.mode === 'while-at-end'
            ? Object.freeze({ mode: 'while-at-end', axis: patch.endFollow.axis })
            : END_FOLLOW_OFF,
    });
    this.set(this.axesOwned, this.config.axes);
  }

  bindComposedChrome(binding: ScrollComposedChromeBinding): void {
    this.ensureSetup('asScrollSurface().bindComposedChrome');
    if (this.composedChromeBinding && this.composedChromeBinding !== binding) {
      throw new Error('[Scroll] composed chrome may be bound only once per logical surface.');
    }
    this.composedChromeBinding = binding;
    if (!this.offAnatomyOrder) {
      const refresh = () => {
        if (!this.mounted || !this.lease) return;
        this.lease.update(this.createHostAttachment());
      };
      this.offAnatomyOrder = this.anatomyPort.subscribeOrder(binding.anatomy, refresh);
      this.offAnatomyTargets = this.anatomyPort.subscribeTargets(binding.anatomy, refresh);
    }
  }

  request(request: ScrollSurfaceRequest): void {
    if (!this.declared) return;
    const normalized =
      request.kind === 'to' || request.kind === 'control-drag'
        ? { ...request, position: clampRatio(request.position) }
        : request;
    if (!this.lease) {
      if (normalized.kind === 'to-end') {
        this.set(this.endFollowRequestStatusOwned, 'rejected');
      }
      return;
    }
    this.lease.request(normalized);
  }

  getConfig(): ScrollSurfaceConfig {
    return this.config;
  }

  getSnapshot(): ScrollSurfaceSnapshot {
    return Object.freeze({
      axes: this.axesOwned.get(),
      horizontal: Object.freeze({
        position: this.horizontalPositionOwned.get(),
        visibleRatio: this.horizontalVisibleOwned.get(),
        canScrollBefore: this.horizontalBeforeOwned.get(),
        canScrollAfter: this.horizontalAfterOwned.get(),
        atEnd: this.horizontalAtEndOwned.get(),
      }),
      vertical: Object.freeze({
        position: this.verticalPositionOwned.get(),
        visibleRatio: this.verticalVisibleOwned.get(),
        canScrollBefore: this.verticalBeforeOwned.get(),
        canScrollAfter: this.verticalAfterOwned.get(),
        atEnd: this.verticalAtEndOwned.get(),
      }),
      scrolling: this.scrollingOwned.get(),
      projection: this.projectionOwned.get(),
      endFollow: Object.freeze({
        state: this.endFollowStateOwned.get(),
        requestStatus: this.endFollowRequestStatusOwned.get(),
      }),
    });
  }

  protected override onCapsEpoch(): void {
    if (this.mounted && this.declared) this.attach();
  }

  override onMountPhase(phase: MountPhase, epoch: number): void {
    super.onMountPhase(phase, epoch);
    this.mounted = phase === 'mounted';
    if (phase === 'mounted') {
      if (this.declared) this.attach();
      return;
    }
    if (phase === 'detached') this.disconnect();
  }

  override onProtoPhase(phase: ProtoPhase): void {
    super.onProtoPhase(phase);
    if (phase === 'unmounted') this.disconnect();
    if (phase === 'unmounted') {
      this.offAnatomyOrder?.();
      this.offAnatomyOrder = null;
      this.offAnatomyTargets?.();
      this.offAnatomyTargets = null;
    }
  }

  private getHost(): ScrollSurfaceHost | null {
    return this.caps.has(SCROLL_SURFACE_HOST_CAP) ? this.caps.get(SCROLL_SURFACE_HOST_CAP) : null;
  }

  private attach(): void {
    const epoch = ++this.leaseEpoch;
    this.lease?.dispose();
    this.lease = null;
    const host = this.getHost();
    if (!host) {
      this.set(this.projectionOwned, 'unresolved');
      this.set(this.endFollowStateOwned, 'off');
      this.set(this.endFollowRequestStatusOwned, 'idle');
      return;
    }
    const projection = resolveScrollProjection(this.config, host.support, host.preference);
    this.set(this.projectionOwned, projection);
    this.lease = host.attach(this.createHostAttachment(epoch));
  }

  private createHostAttachment(epoch = this.leaseEpoch): ScrollSurfaceHostAttachment {
    const composedChrome = this.resolveComposedChrome();
    const attachment: ScrollSurfaceHostAttachment = {
      config: this.config,
      projection: this.projectionOwned.get() as Exclude<ScrollResolvedProjection, 'unresolved'>,
      onFacts: (snapshot) => {
        if (epoch !== this.leaseEpoch || !this.mounted) return;
        this.applySnapshot(snapshot);
      },
      ...(composedChrome ? { composedChrome } : {}),
    };
    return Object.freeze(attachment);
  }

  private resolveComposedChrome(): ScrollComposedChromeHostBinding | null {
    const binding = this.composedChromeBinding;
    if (!binding) return null;
    const anatomyScope = this.anatomyPort.resolveDomainScope(binding.anatomy);
    if (!anatomyScope) return null;
    const scope = this.contextPort.resolveScope(binding.scope, anatomyScope);
    if (!scope || scope !== anatomyScope) return null;
    const scrollbars = this.anatomyPort.order.partsOf(binding.anatomy, binding.scrollbarRole, {
      missing: 'empty',
    });
    const controls = scrollbars.flatMap((scrollbar) => {
      const thumb = this.anatomyPort.descendantsOf(
        binding.anatomy,
        scrollbar,
        binding.thumbRole
      )[0];
      if (!thumb) return [];
      const trackTarget = this.anatomyPort.resolvePartTarget(scrollbar);
      const thumbTarget = this.anatomyPort.resolvePartTarget(thumb);
      if (!trackTarget || !thumbTarget) return [];
      return [
        Object.freeze({
          getAxis: () => this.readControlAxis(scrollbar, binding.orientationExpose),
          trackTarget,
          thumbTarget,
        }),
      ];
    });
    return Object.freeze({ scope, controls: Object.freeze(controls) });
  }

  private readControlAxis(part: AnatomyPartView, exposeKey: string): 'horizontal' | 'vertical' {
    const exposed = part.getExpose(exposeKey) as
      | { get?: () => unknown }
      | { kind: 'state'; state?: { get?: () => unknown } }
      | null;
    let state: { get?: () => unknown } | null | undefined = exposed as {
      get?: () => unknown;
    } | null;
    if (exposed && 'kind' in exposed && exposed.kind === 'state') state = exposed.state;
    return state?.get?.() === 'horizontal' ? 'horizontal' : 'vertical';
  }

  private applySnapshot(snapshot: ScrollSurfaceSnapshot): void {
    this.set(this.axesOwned, snapshot.axes);
    this.applyAxis('horizontal', snapshot.horizontal);
    this.applyAxis('vertical', snapshot.vertical);
    this.set(this.scrollingOwned, snapshot.scrolling);
    this.set(this.projectionOwned, snapshot.projection);
    this.set(this.endFollowStateOwned, snapshot.endFollow.state);
    this.set(this.endFollowRequestStatusOwned, snapshot.endFollow.requestStatus);
  }

  private applyAxis(axis: 'horizontal' | 'vertical', snapshot: ScrollAxisSnapshot): void {
    const value = snapshot ?? EMPTY_AXIS;
    const handles =
      axis === 'horizontal'
        ? [
            this.horizontalPositionOwned,
            this.horizontalVisibleOwned,
            this.horizontalBeforeOwned,
            this.horizontalAfterOwned,
            this.horizontalAtEndOwned,
          ]
        : [
            this.verticalPositionOwned,
            this.verticalVisibleOwned,
            this.verticalBeforeOwned,
            this.verticalAfterOwned,
            this.verticalAtEndOwned,
          ];
    this.set(handles[0] as OwnedStateHandle<number>, clampRatio(value.position));
    this.set(handles[1] as OwnedStateHandle<number>, clampRatio(value.visibleRatio));
    this.set(handles[2] as OwnedStateHandle<boolean>, value.canScrollBefore);
    this.set(handles[3] as OwnedStateHandle<boolean>, value.canScrollAfter);
    this.set(handles[4] as OwnedStateHandle<boolean>, value.atEnd);
  }

  private set<V>(handle: OwnedStateHandle<V>, value: V): void {
    if (Object.is(handle.get(), value)) return;
    this.statePort.set(handle, value, 'reason: scroll host fact');
  }

  disconnect(): void {
    this.leaseEpoch++;
    this.lease?.dispose();
    this.lease = null;
    this.set(this.scrollingOwned, false);
    this.set(this.projectionOwned, 'unresolved');
    this.set(this.endFollowStateOwned, 'off');
    this.set(this.endFollowRequestStatusOwned, 'idle');
  }
}
