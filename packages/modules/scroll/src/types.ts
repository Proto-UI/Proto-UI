import type {
  ModuleInstance,
  ScrollComposedChromeBinding,
  ScrollSurfaceConfig,
  ScrollSurfaceConfigPatch,
  ScrollSurfaceHandle,
  ScrollSurfaceRequest,
  ScrollSurfaceSnapshot,
} from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';

export type ScrollFacade = {
  getSurface<P extends PropsBaseType = PropsBaseType>(): ScrollSurfaceHandle<P>;
};

export type ScrollPort = {
  configureSurface(patch: ScrollSurfaceConfigPatch): void;
  bindComposedChrome(binding: ScrollComposedChromeBinding): void;
  request(request: ScrollSurfaceRequest): void;
  getConfig(): ScrollSurfaceConfig;
  getSnapshot(): ScrollSurfaceSnapshot;
};

export type ScrollModule = ModuleInstance<ScrollFacade> & {
  name: 'scroll';
  scope: 'instance';
  port: ScrollPort;
};
