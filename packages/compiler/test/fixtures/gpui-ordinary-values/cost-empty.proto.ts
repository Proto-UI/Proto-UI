import { definePrototype } from '@proto.ui/core';

// The empty cost baseline has no hooks, State, Props, listeners or authored render.
// Its implicit anonymous slot is the shared void-setup projection.
export default definePrototype({ name: 'native-cost-empty', setup() {} });
