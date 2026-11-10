import { createContextKey } from '@proto.ui/core';

export const counter = createContextKey<{
  count: number;
  phase: 'idle' | 'ready';
}>('packed-counter');

const debugName: string = counter.debugName;
const brand: 'ContextKey' = counter.__brand;
void [debugName, brand];
