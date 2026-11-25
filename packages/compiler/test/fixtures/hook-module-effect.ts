import { defineAsHook } from '@proto.ui/core';

// This module is parsed by the compiler regression, never imported by the test runner.
console.log('An authored module initializer must not silently disappear.');

export const decoration = defineAsHook({
  name: 'effectful-decoration',
  setup() {
    return (renderer) => renderer.el('span', 'content');
  },
});
