import { createContextKey } from '@proto.ui/core';

// JsonObject excludes callable values; this consumer must be rejected with TS2344.
createContextKey<{ count: () => number }>('invalid-callable-context');
