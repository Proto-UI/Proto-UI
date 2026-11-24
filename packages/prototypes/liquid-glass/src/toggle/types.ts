import type { ToggleProps, ToggleExposes } from '@proto.ui/prototypes-base/toggle';

export interface ToggleProjectionProps extends ToggleProps {
  /** Opaque is explicit; auto enhances only when the shared host admits material. */
  material?: 'auto' | 'opaque';
  size?: 'sm' | 'default' | 'lg';
}
export type { ToggleExposes };
