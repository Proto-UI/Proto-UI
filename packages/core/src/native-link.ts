import type { PropsBaseType } from '@proto.ui/types';
import type { RunHandle } from './handles';

/** Complete replacement, not an attribute bag or a navigation command. */
export type NativeLinkConfig = Readonly<{
  href?: string;
  target?: string;
  rel?: string;
  disabled?: boolean;
}>;
export type NativeLinkSnapshot = Readonly<{
  href: string;
  target: string;
  rel: string;
  disabled: boolean;
}>;
/** Observation of native activation. The browser retains default navigation. */
export type NativeLinkNavigate = Readonly<{
  href: string;
  target: string;
  rel: string;
  modified: boolean;
}>;
export type NativeLinkHandle<P extends PropsBaseType = PropsBaseType> = {
  sync(config: NativeLinkConfig): void;
  snapshot(): NativeLinkSnapshot | null;
  on(
    type: 'navigate',
    callback: (run: RunHandle<P>, event: NativeLinkNavigate) => void
  ): () => void;
};
