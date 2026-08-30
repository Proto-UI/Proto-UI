import type {
  ModuleInstance,
  ModulePort,
  TextControlHandle,
  TextControlLineMode,
  TextControlSnapshot,
} from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';

export type TextControlFacade = {
  declare<
    P extends PropsBaseType = PropsBaseType,
    Mode extends TextControlLineMode = TextControlLineMode,
  >(): TextControlHandle<P, Mode>;
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
