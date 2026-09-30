declare module 'virtual:presentation/*/Component.tsx' {
  import type { ComponentType } from 'react';
  export const Presentation: ComponentType<Record<string, unknown>>;
  export function createComponent(options: {
    schedule(task: () => void): void;
    autoUpdateOnPropsChange: boolean;
  }): ComponentType<Record<string, unknown>>;
}
