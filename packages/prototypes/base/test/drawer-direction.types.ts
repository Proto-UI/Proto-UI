import { definePrototype } from '@proto.ui/core';
import { asDrawerContent, asDrawerAcceptedSide, type DrawerSide } from '../src/drawer';

// Compile-only negative capability checks. This prototype is never instantiated.
definePrototype({
  name: 'drawer-direction-type-boundary',
  setup(def) {
    const content = asDrawerContent();
    const observer = asDrawerAcceptedSide();
    const value: DrawerSide | null = observer.read();
    void value;
    observer.observe((side) => {
      const direction: DrawerSide | null = side;
      void direction;
    });
    // @ts-expect-error The observation cannot mutate accepted direction.
    content.acceptedSide.set('top');
    // @ts-expect-error The observation cannot change default ownership.
    observer.setDefault('left');
    // @ts-expect-error No raw captured state access is exposed.
    observer.getState('acceptedSide');
    // @ts-expect-error An observation is not a Rule State identity token.
    def.rule({ when: (w) => w.state(observer).eq('top'), intent() {} });
    // @ts-expect-error Accepted Content direction is not a writable borrowed state entry.
    content.stateHandles.drawerSide.set('top');
  },
});
