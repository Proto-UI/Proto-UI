import assert from 'node:assert/strict';
import { createContextKey } from '@proto.ui/core';

const first = createContextKey('packed-counter');
const second = createContextKey('packed-counter');
assert.notEqual(first, second, 'debugName must not supply ContextKey identity');
assert.equal(first.debugName, 'packed-counter');
assert.equal(second.debugName, 'packed-counter');
console.log(JSON.stringify({ distinctKeys: 2, debugName: first.debugName }));
