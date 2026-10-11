import type { PropsBaseType } from '@proto.ui/types';
import type { AnatomyFamily } from './anatomy';
import type { RunHandle } from './handles';

/** Host-owned association only. It contains no coordinates, contact ID, or DOM access. */
declare const inputOriginAnchorBrand: unique symbol;
export type InputOriginAnchor = Readonly<{ [inputOriginAnchorBrand]: true }>;
export type ContextMenuInputIntent = Readonly<{
  origin: 'pointer' | 'keyboard' | 'long-press';
  anchor: InputOriginAnchor;
}>;
export type ContextMenuInputBinding = Readonly<{
  anatomy: AnatomyFamily;
  /** The current instance's claimed role. */
  inputRole: string;
}>;
export type ContextMenuInputHandle<P extends PropsBaseType = PropsBaseType> = Readonly<{
  configure(binding: ContextMenuInputBinding): void;
  /** Return true only when the consumer accepts this menu request. */
  on(callback: (run: RunHandle<P>, intent: ContextMenuInputIntent) => boolean): void;
  sync(config: Readonly<{ disabled: boolean }>): void;
}>;
