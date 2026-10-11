import { definePrototype, tw } from '@proto.ui/core';
import {
  asToastViewport,
  type ToastViewportProps,
  type ToastViewportExposes,
} from '@proto.ui/prototypes-base/toast';

export default definePrototype<ToastViewportProps, ToastViewportExposes>({
  name: 'brutalist-toast-viewport',
  setup(def) {
    const behavior = asToastViewport();
    def.feedback.style.use(
      tw(
        'fixed bottom-4 right-4 z-50 grid gap-3 w-96 max-w-[calc(100vw_-_2rem)] max-h-[calc(100vh_-_2rem)] overflow-y-auto p-1'
      )
    );
  },
});
