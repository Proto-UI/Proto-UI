import type {
  ModuleInstance,
  ModulePort,
  TextControlHandle,
  TextControlSnapshot,
} from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';

export type TextControlFacade = {
  declare<P extends PropsBaseType = PropsBaseType>(): TextControlHandle<P>;
};

export type TextControlPort = ModulePort & {
  isDeclared(): boolean;
  getSnapshot(): TextControlSnapshot | null;
};

export type TextControlModule = ModuleInstance<TextControlFacade> & {
  name: 'text-control';
  scope: 'instance';
  port: TextControlPort;
};
